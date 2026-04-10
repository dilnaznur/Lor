import { supabase } from "../supabaseClient.js";
import { formatDate, renderNav, requireAuth, showToast, statusBadge } from "../common.js";

await renderNav();
const profile = await requireAuth(["patient", "doctor", "admin"]);

if (profile?.role === "doctor") {
  window.location.href = "appointments.html";
}

if (profile?.role === "admin") {
  window.location.href = "admin.html";
}

const profileBlock = document.getElementById("profileBlock");
const tableBody = document.getElementById("appointmentsTable");
const statPending = document.getElementById("statPending");
const statConfirmed = document.getElementById("statConfirmed");
const statCancelled = document.getElementById("statCancelled");

const reviewSection = document.getElementById("reviewSection");
const reviewDoctorLine = document.getElementById("reviewDoctorLine");
const reviewForm = document.getElementById("reviewForm");
const reviewDoctorIdInput = document.getElementById("reviewDoctorId");
const reviewRating = document.getElementById("reviewRating");
const reviewComment = document.getElementById("reviewComment");
const reviewCancelBtn = document.getElementById("reviewCancelBtn");

let reviewsByDoctorId = new Map();
let doctorsById = new Map();

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
    .select("id, doctor_id, date, time, status, doctors(id, name, specialization)")
    .eq("user_id", profile.id)
    .order("date", { ascending: true });

  if (error) {
    showToast(error.message);
    return;
  }

  const counts = { pending: 0, confirmed: 0, cancelled: 0 };

  doctorsById = new Map(
    (data || [])
      .filter((row) => row.doctors?.id)
      .map((row) => [row.doctors.id, row.doctors])
  );

  // Load existing reviews once (per doctor).
  const doctorIds = Array.from(new Set((data || []).map((r) => r.doctor_id).filter(Boolean)));
  await loadMyReviews(doctorIds);

  tableBody.innerHTML = data
    .map((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;

      const doctorId = item.doctor_id;
      const existingReview = doctorId ? reviewsByDoctorId.get(doctorId) : null;
      const canReview = item.status === "confirmed" && !!doctorId;
      const reviewCell = canReview
        ? `<button class="btn btn-secondary" data-review-doctor="${doctorId}">${existingReview ? "Редактировать" : "Оставить"}</button>`
        : "-";

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
        <td>${reviewCell}</td>
      </tr>
    `;
    })
    .join("");

  statPending.textContent = counts.pending;
  statConfirmed.textContent = counts.confirmed;
  statCancelled.textContent = counts.cancelled;
}

async function loadMyReviews(doctorIds) {
  reviewsByDoctorId = new Map();

  if (!profile || !doctorIds?.length) {
    return;
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("id, doctor_id, rating, comment")
    .eq("user_id", profile.id)
    .in("doctor_id", doctorIds);

  if (error) {
    // Reviews are optional; don't break the dashboard.
    console.warn("Reviews load failed:", error.message);
    return;
  }

  for (const r of data || []) {
    if (r.doctor_id) {
      reviewsByDoctorId.set(r.doctor_id, r);
    }
  }
}

function openReviewForm(doctorId) {
  if (!reviewSection || !reviewForm) {
    return;
  }

  const doctor = doctorsById.get(Number(doctorId));
  const existing = reviewsByDoctorId.get(Number(doctorId));

  reviewDoctorIdInput.value = String(doctorId);
  reviewDoctorLine.textContent = doctor?.name ? `Врач: ${doctor.name}` : "";
  reviewRating.value = String(existing?.rating || 5);
  reviewComment.value = existing?.comment || "";

  reviewSection.style.display = "block";
  reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeReviewForm() {
  if (!reviewSection) {
    return;
  }
  reviewSection.style.display = "none";
  reviewDoctorIdInput.value = "";
  reviewDoctorLine.textContent = "";
  reviewComment.value = "";
  reviewRating.value = "5";
}

async function saveReview() {
  if (!profile) {
    return;
  }

  const doctorId = Number(reviewDoctorIdInput.value);
  if (!doctorId) {
    showToast("Не выбран врач для отзыва");
    return;
  }

  const rating = Number(reviewRating.value);
  const comment = (reviewComment.value || "").trim();

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    showToast("Оценка должна быть от 1 до 5");
    return;
  }

  const existing = reviewsByDoctorId.get(doctorId);

  if (existing?.id) {
    const { error } = await supabase
      .from("reviews")
      .update({ rating, comment })
      .eq("id", existing.id)
      .eq("user_id", profile.id);

    if (error) {
      showToast(error.message);
      return;
    }
  } else {
    const { error } = await supabase
      .from("reviews")
      .insert({ user_id: profile.id, doctor_id: doctorId, rating, comment });

    if (error) {
      showToast(error.message);
      return;
    }
  }

  showToast("Отзыв сохранён");
  closeReviewForm();
  await loadMyAppointments();
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
    const reviewBtn = event.target.closest("[data-review-doctor]");
    if (reviewBtn) {
      openReviewForm(reviewBtn.dataset.reviewDoctor);
    }
    return;
  }
  cancelAppointment(button.dataset.cancel);
});

reviewCancelBtn?.addEventListener("click", closeReviewForm);
reviewForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveReview();
});

await loadMyAppointments();
