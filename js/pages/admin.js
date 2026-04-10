import { supabase } from "../supabaseClient.js";
import { renderNav, requireAuth, showToast } from "../common.js";

await renderNav();
await requireAuth(["admin"]);

const usersTable = document.getElementById("usersTable");

async function loadUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .order("name", { ascending: true });

  if (error) {
    showToast(error.message);
    return;
  }

  usersTable.innerHTML = data
    .map((user) => `
      <tr>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>
          <select data-role-id="${user.id}">
            <option value="patient" ${user.role === "patient" ? "selected" : ""}>patient</option>
            <option value="doctor" ${user.role === "doctor" ? "selected" : ""}>doctor</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td><button class="btn btn-secondary" data-save-role="${user.id}">Сохранить</button></td>
      </tr>
    `)
    .join("");
}

async function saveRole(id) {
  const roleSelect = document.querySelector(`[data-role-id="${id}"]`);
  if (!roleSelect) {
    return;
  }

  const { error } = await supabase
    .from("users")
    .update({ role: roleSelect.value })
    .eq("id", id);

  if (error) {
    showToast(error.message);
    return;
  }

  showToast("Роль обновлена");
}

document.addEventListener("click", (event) => {
  const saveButton = event.target.closest("[data-save-role]");
  if (saveButton) {
    saveRole(saveButton.dataset.saveRole);
    return;
  }
});

await loadUsers();
