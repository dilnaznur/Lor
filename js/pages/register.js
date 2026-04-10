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
