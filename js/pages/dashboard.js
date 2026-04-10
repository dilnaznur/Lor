import { supabase } from "../supabaseClient.js";
import { formatDate, renderNav, requireAuth, showToast, statusBadge } from "../common.js";

await renderNav();
const profile = await requireAuth(["patient", "doctor", "admin"]);

const profileBlock = document.getElementById("profileBlock");
const tableBody = document.getElementById("appointmentsTable");
const statPending = document.getElementById("statPending");
const statConfirmed = document.getElementById("statConfirmed");
const statCancelled = document.getElementById("statCancelled");

if (profile && profileBlock) {
  profileBlock.innerHTML = `
    <div class="card">
      <h3>${profile.name}</h3>
      <p>${profile.email}</p>
      <span class="badge">Роль: ${profile.role}</span>
    </div>
  `;
}

async function loadMyAppointments() {
  if (!profile) {
    return;
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("id, date, time, status, doctors(name, specialization)")
    .eq("user_id", profile.id)
    .order("date", { ascending: true });

  if (error) {
    showToast(error.message);
    return;
  }

  const counts = { pending: 0, confirmed: 0, cancelled: 0 };

  tableBody.innerHTML = data
    .map((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      return `
      <tr>
        <td>${item.doctors?.name || "-"}</td>
        <td>${item.doctors?.specialization || "-"}</td>
        <td>${formatDate(item.date)}</td>
        <td>${item.time}</td>
        <td>${statusBadge(item.status)}</td>
        <td>
          ${item.status === "pending" || item.status === "confirmed"
            ? `<button class="btn btn-danger" data-cancel="${item.id}">Отменить</button>`
            : "-"}
        </td>
      </tr>
    `;
    })
    .join("");

  statPending.textContent = counts.pending;
  statConfirmed.textContent = counts.confirmed;
  statCancelled.textContent = counts.cancelled;
}

async function cancelAppointment(id) {
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) {
    showToast(error.message);
    return;
  }

  showToast("Запись отменена");
  loadMyAppointments();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cancel]");
  if (!button) {
    return;
  }
  cancelAppointment(button.dataset.cancel);
});

await loadMyAppointments();
