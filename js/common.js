import { supabase } from "./supabaseClient.js";

export function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

export function statusBadge(status) {
  return `<span class="status ${status}">${status}</span>`;
}

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return data.user;
}

export async function getCurrentProfile() {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function requireAuth(allowedRoles = []) {
  const profile = await getCurrentProfile();
  if (!profile) {
    window.location.href = "login.html";
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    showToast("У вас нет доступа к этой странице");
    window.location.href = "dashboard.html";
    return null;
  }

  return profile;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

export function setActiveNav() {
  const file = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach((el) => {
    if (el.getAttribute("href") === file) {
      el.classList.add("active");
    }
  });
}

export async function renderNav() {
  const navRoot = document.getElementById("nav");
  if (!navRoot) {
    return;
  }

  const user = await getSessionUser();
  const profile = user ? await getCurrentProfile() : null;

  const authLinks = !profile
    ? `
      <a class="link" data-nav href="login.html">Вход</a>
      <a class="link" data-nav href="register.html">Регистрация</a>
    `
    : `
      <a class="link" data-nav href="dashboard.html">Панель</a>
      <a class="link" data-nav href="doctors.html">Специалисты</a>
      ${profile.role === "doctor" ? '<a class="link" data-nav href="appointments.html">Расписание</a>' : ""}
      ${profile.role === "admin" ? '<a class="link" data-nav href="admin.html">Админ</a>' : ""}
      <button class="btn btn-secondary" id="logoutBtn">Выход</button>
    `;

  navRoot.innerHTML = `
    <div class="container nav-inner">
      <a class="brand" href="index.html">MediSlot</a>
      <div class="nav-links">${authLinks}</div>
    </div>
  `;

  setActiveNav();

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", signOut);
  }
}
