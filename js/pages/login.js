import { ensureProfileExists, loginUser } from "../auth.js";
import { renderNav, showToast } from "../common.js";
import { supabase } from "../supabaseClient.js";

await renderNav();

const params = new URLSearchParams(window.location.search);
if (params.get("registered") === "1") {
  showToast("Регистрация успешна. Выполните вход.");
}

const form = document.getElementById("loginForm");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await loginUser({ email, password });

    const { data: userData } = await supabase.auth.getUser();
    const authUser = userData.user;
    const userId = authUser?.id;
    if (!userId) {
      throw new Error("Пользователь не найден");
    }

    await ensureProfileExists(authUser);

    const { data: profile, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    if (profile.role === "admin") {
      window.location.href = "admin.html";
      return;
    }

    if (profile.role === "doctor") {
      window.location.href = "appointments.html";
      return;
    }

    window.location.href = "dashboard.html";
  } catch (error) {
    showToast(error.message || "Ошибка входа");
  }
});
