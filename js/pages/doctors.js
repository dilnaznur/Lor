import { supabase } from "../supabaseClient.js";
import { formatDate, renderNav, requireAuth, showToast } from "../common.js";

await renderNav();
const profile = await requireAuth(["patient"]);

const doctorsGrid = document.getElementById("doctorsGrid");
const dateInput = document.getElementById("dateInput");
const slotGrid = document.getElementById("slotGrid");
const bookingInfo = document.getElementById("bookingInfo");
const bookButton = document.getElementById("bookButton");

const SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
];

let selectedDoctorId = null;
let selectedDoctorName = "";
let selectedTime = null;

if (dateInput) {
  dateInput.value = new Date().toISOString().slice(0, 10);
  dateInput.min = new Date().toISOString().slice(0, 10);
}

async function loadDoctors() {
  const { data, error } = await supabase
    .from("doctors")
    .select("id, name, specialization, description, avatar")
    .order("name", { ascending: true });

  if (error) {
    showToast(error.message);
    return;
  }

  if (!data.length) {
    doctorsGrid.innerHTML = '<div class="notice">Врачи пока не добавлены. Добавьте записи в таблицу doctors.</div>';
    return;
  }

  doctorsGrid.innerHTML = data
    .map((doctor, i) => `
      <article class="card fade-in ${i % 2 ? "delay-1" : ""}">
        <div style="display:flex; gap:12px; align-items:center;">
          <img class="avatar" src="${doctor.avatar || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200"}" alt="${doctor.name}">
          <div>
            <h3>${doctor.name}</h3>
            <span class="badge">${doctor.specialization}</span>
          </div>
        </div>
        <p style="color:var(--muted);">${doctor.description || "Описание отсутствует"}</p>
        <button class="btn btn-primary" data-doctor="${doctor.id}" data-name="${doctor.name}">
          Выбрать врача
        </button>
      </article>
    `)
    .join("");
}

async function getBookedTimes(doctorId, date) {
  const { data, error } = await supabase
    .from("appointments")
    .select("time")
    .eq("doctor_id", doctorId)
    .eq("date", date)
    .in("status", ["pending", "confirmed"]);

  if (error) {
    showToast(error.message);
    return [];
  }

  return data.map((item) => item.time);
}

async function renderSlots() {
  if (!selectedDoctorId || !dateInput.value) {
    slotGrid.innerHTML = "";
    return;
  }

  const booked = await getBookedTimes(selectedDoctorId, dateInput.value);

  slotGrid.innerHTML = SLOTS.map((slot) => {
    const bookedClass = booked.includes(slot) ? "booked" : "";
    return `
      <button class="slot-btn ${bookedClass}" data-slot="${slot}" ${bookedClass ? "disabled" : ""}>
        ${slot}
      </button>
    `;
  }).join("");

  bookingInfo.innerHTML = `Выбран врач: <b>${selectedDoctorName}</b>, дата: <b>${formatDate(dateInput.value)}</b>`;
}

async function createAppointment() {
  if (!profile || !selectedDoctorId || !selectedTime) {
    showToast("Выберите врача и время");
    return;
  }

  const payload = {
    user_id: profile.id,
    doctor_id: selectedDoctorId,
    date: dateInput.value,
    time: selectedTime,
    status: "pending"
  };

  const { error } = await supabase.from("appointments").insert(payload);

  if (error) {
    showToast(error.message);
    return;
  }

  showToast("Запись создана, ожидает подтверждения");
  selectedTime = null;
  await renderSlots();
}

document.addEventListener("click", async (event) => {
  const doctorButton = event.target.closest("[data-doctor]");
  if (doctorButton) {
    selectedDoctorId = Number(doctorButton.dataset.doctor);
    selectedDoctorName = doctorButton.dataset.name;
    selectedTime = null;
    await renderSlots();
    return;
  }

  const slotButton = event.target.closest("[data-slot]");
  if (slotButton && !slotButton.disabled) {
    selectedTime = slotButton.dataset.slot;
    document.querySelectorAll(".slot-btn").forEach((btn) => btn.classList.remove("selected"));
    slotButton.classList.add("selected");
  }
});

bookButton?.addEventListener("click", createAppointment);
dateInput?.addEventListener("change", renderSlots);

await loadDoctors();
