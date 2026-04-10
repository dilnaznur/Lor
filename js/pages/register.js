import { registerUser } from "../auth.js";
import { renderNav, showToast } from "../common.js";

await renderNav();

const form = document.getElementById("registerForm");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    role: document.getElementById("role").value
  };

  if (payload.password.length < 6) {
    showToast("Пароль должен быть не менее 6 символов");
    return;
  }

  try {
    await registerUser(payload);
    showToast("Аккаунт создан. Теперь войдите.");
    window.location.href = "login.html";
  } catch (error) {
    showToast(error.message || "Ошибка регистрации");
  }
});
