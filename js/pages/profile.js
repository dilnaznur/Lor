import { supabase } from "../supabaseClient.js";
import { getSessionUser, renderNav, requireAuth, showToast } from "../common.js";

await renderNav();
const profile = await requireAuth(["patient", "doctor"]);

const form = document.getElementById("profileForm");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const backLink = document.getElementById("backLink");

if (profile) {
  nameInput.value = profile.name || "";
  emailInput.value = profile.email || "";

  if (backLink) {
    backLink.href = profile.role === "doctor" ? "appointments.html" : "dashboard.html";
  }
}

async function saveProfile() {
  if (!profile) {
    return;
  }

  const nextName = (nameInput.value || "").trim();
  const nextEmail = (emailInput.value || "").trim().toLowerCase();

  if (!nextName || !nextEmail) {
    showToast("Заполните имя и email");
    return;
  }

  const currentUser = await getSessionUser();
  if (!currentUser) {
    showToast("Сессия не найдена");
    return;
  }

  // 1) If email changed, update Supabase Auth email first (may require confirmation)
  if (nextEmail !== (profile.email || "").toLowerCase()) {
    const { error: authError } = await supabase.auth.updateUser({ email: nextEmail });
    if (authError) {
      showToast(authError.message);
      return;
    }
  }

  // 2) Update public.users row (name/email)
  const { error: dbError } = await supabase
    .from("users")
    .update({ name: nextName, email: nextEmail })
    .eq("id", profile.id);

  if (dbError) {
    showToast(dbError.message);
    return;
  }

  showToast("Профиль обновлён");
  setTimeout(() => window.location.reload(), 350);
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  saveProfile();
});
