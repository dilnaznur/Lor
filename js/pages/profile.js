import { supabase } from "../supabaseClient.js";
import { renderNav, requireAuth, showToast } from "../common.js";

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

  if (!nextName) {
    showToast("Введите имя");
    return;
  }

  // Update public.users row (name)
  const { error: dbError } = await supabase
    .from("users")
    .update({ name: nextName })
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
