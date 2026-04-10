import { supabase } from "../supabaseClient.js";
import { formatDate, renderNav, requireAuth, showToast, statusBadge } from "../common.js";

await renderNav();
const profile = await requireAuth(["doctor", "admin"]);
const tableBody = document.getElementById("doctorAppointmentsTable");

async function getDoctorIds() {
  const { data, error } = await supabase
    .from("doctors")
    .select("id")
    .eq("user_id", profile.id);

  if (error) {
    showToast(error.message);
    return [];
  }

  return data.map((d) => d.id);
}

async function loadAppointments() {
  if (!profile) {
    return;
  }

  const doctorIds = profile.role === "admin" ? null : await getDoctorIds();

  let query = supabase
    .from("appointments")
    .select("id, date, time, status, users(name, email), doctors(name, specialization)")
    .order("date", { ascending: true });

  if (doctorIds && doctorIds.length > 0) {
    query = query.in("doctor_id", doctorIds);
  }

  if (doctorIds && doctorIds.length === 0 && profile.role !== "admin") {
    tableBody.innerHTML = "<tr><td colspan='7'>Ваш профиль не связан с таблицей doctors (поле user_id).</td></tr>";
    return;
  }

  const { data, error } = await query;

  if (error) {
    showToast(error.message);
    return;
  }

  tableBody.innerHTML = data
    .map((item) => `
      <tr>
        <td>${item.users?.name || "-"}</td>
        <td>${item.users?.email || "-"}</td>
        <td>${item.doctors?.name || "-"}</td>
        <td>${formatDate(item.date)}</td>
        <td>${item.time}</td>
        <td>${statusBadge(item.status)}</td>
        <td>
          ${item.status === "pending" ? `
            <button class="btn btn-primary" data-confirm="${item.id}">Подтвердить</button>
            <button class="btn btn-danger" data-cancel="${item.id}">Отменить</button>
          ` : "-"}
        </td>
      </tr>
    `)
    .join("");
}

async function setStatus(id, status) {
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);

  if (error) {
    showToast(error.message);
    return;
  }

  showToast(`Статус обновлен: ${status}`);
  loadAppointments();
}

document.addEventListener("click", (event) => {
  const confirmButton = event.target.closest("[data-confirm]");
  if (confirmButton) {
    setStatus(confirmButton.dataset.confirm, "confirmed");
    return;
  }

  const cancelButton = event.target.closest("[data-cancel]");
  if (cancelButton) {
    setStatus(cancelButton.dataset.cancel, "cancelled");
  }
});

await loadAppointments();
