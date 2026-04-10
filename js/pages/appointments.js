import { supabase } from "../supabaseClient.js";
import { formatDate, renderNav, requireAuth, showToast, statusBadge } from "../common.js";

await renderNav();
const profile = await requireAuth(["doctor", "admin"]);
const tableBody = document.getElementById("doctorAppointmentsTable");
const doctorNotice = document.getElementById("doctorNotice");

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
    tableBody.innerHTML = "<tr><td colspan='7'>Для этого аккаунта врача нет карточки в таблице doctors. Выполните SQL-патч синхронизации (fix_users_sync.sql) и войдите заново, либо создайте нового врача через регистрацию.</td></tr>";
    return;
  }

  const { data, error } = await query;

  if (error) {
    showToast(error.message);
    return;
  }

  if (profile.role === "doctor") {
    const hasHiddenPatientData = (data || []).some((item) => !item.users?.name && !item.users?.email);
    if (hasHiddenPatientData && doctorNotice) {
      doctorNotice.textContent =
        "Имя и email пациента могут быть скрыты настройками Supabase (RLS). Если видите '-' — примените SQL-патч из supabase/fix_users_sync.sql (политика doctors can read patients for own appointments), затем выйдите и войдите снова.";
    }
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
