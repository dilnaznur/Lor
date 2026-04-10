import { registerUser } from "../auth.js";
import { supabase } from "../supabaseClient.js";
import { renderNav, showToast } from "../common.js";

await renderNav();

const form = document.getElementById("registerForm");
const roleSelect = document.getElementById("role");
const doctorFields = document.getElementById("doctorFields");
const specializationSelect = document.getElementById("specialization");
const descriptionInput = document.getElementById("description");
const avatarFileInput = document.getElementById("avatarFile");
const avatarUrlInput = document.getElementById("avatarUrl");

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

async function uploadDoctorAvatar({ userId, file }) {
  const safeName = sanitizeFilename(file.name);
  const path = `doctors/${userId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase
    .storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "image/*"
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) {
    throw new Error("Не удалось получить ссылку на загруженное фото");
  }

  const { error: dbError } = await supabase
    .from("doctors")
    .update({ avatar: publicUrl })
    .eq("user_id", userId);

  if (dbError) {
    throw dbError;
  }

  return publicUrl;
}

function syncDoctorFieldsVisibility() {
  const isDoctor = roleSelect?.value === "doctor";
  if (doctorFields) {
    doctorFields.style.display = isDoctor ? "block" : "none";
  }
  if (specializationSelect) {
    specializationSelect.required = isDoctor;
  }
  if (descriptionInput) {
    descriptionInput.required = isDoctor;
  }
}

roleSelect?.addEventListener("change", syncDoctorFieldsVisibility);
syncDoctorFieldsVisibility();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    role: document.getElementById("role").value,
    specialization: document.getElementById("specialization")?.value,
    description: document.getElementById("description")?.value?.trim(),
    avatar: document.getElementById("avatarUrl")?.value?.trim()
  };

  const avatarFile = avatarFileInput?.files?.[0] || null;

  if (payload.role === "doctor") {
    payload.specialization = "ЛОР";

    if (!payload.description) {
      showToast("Для специалиста обязательно заполнить описание");
      return;
    }

    if (!payload.avatar && !avatarFile) {
      showToast("Для специалиста добавьте фото: файл или ссылку");
      return;
    }

    if (payload.avatar) {
      try {
        new URL(payload.avatar);
      } catch {
        showToast("Ссылка на фото должна быть корректным URL (https://...)");
        return;
      }
    }
  }

  if (payload.password.length < 6) {
    showToast("Пароль должен быть не менее 6 символов");
    return;
  }

  try {
    const result = await registerUser(payload);

    // If a file is selected and session exists, upload to Supabase Storage and update doctors.avatar.
    if (payload.role === "doctor" && avatarFile) {
      if (result.session && result.user?.id) {
        try {
          await uploadDoctorAvatar({ userId: result.user.id, file: avatarFile });
        } catch (uploadError) {
          console.warn("Avatar upload failed:", uploadError.message);
          showToast("Аккаунт создан, но фото не загрузилось. Можно загрузить позже в кабинете врача.");
        }
      } else {
        // Email confirmation enabled -> no session yet
        showToast("Аккаунт создан. Подтвердите email, войдите и загрузите фото в кабинете врача.");
      }
    }

    const message = result.needsEmailConfirmation
      ? "Аккаунт создан. Подтвердите email и войдите."
      : "Аккаунт создан. Перенаправляем на вход.";

    showToast(message);

    setTimeout(() => {
      window.location.href = "login.html?registered=1";
    }, 700);
  } catch (error) {
    showToast(error.message || "Ошибка регистрации");
  }
});
