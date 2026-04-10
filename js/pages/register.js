import { registerUser } from "../auth.js";
import { renderNav, showToast } from "../common.js";

await renderNav();

const form = document.getElementById("registerForm");
const roleSelect = document.getElementById("role");
const doctorFields = document.getElementById("doctorFields");
const specializationSelect = document.getElementById("specialization");

function syncDoctorFieldsVisibility() {
  const isDoctor = roleSelect?.value === "doctor";
  if (doctorFields) {
    doctorFields.style.display = isDoctor ? "block" : "none";
  }
  if (specializationSelect) {
    specializationSelect.required = isDoctor;
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
    avatar: document.getElementById("avatar")?.value?.trim()
  };

  if (payload.role === "doctor") {
    payload.specialization = "ЛОР";
  }

  if (payload.password.length < 6) {
    showToast("Пароль должен быть не менее 6 символов");
    return;
  }

  try {
    const result = await registerUser(payload);
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
