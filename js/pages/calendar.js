import { supabase } from "../supabaseClient.js";
import { formatDate, renderNav, requireAuth, showToast, statusBadge } from "../common.js";

await renderNav();
const profile = await requireAuth(["patient", "doctor"]);

const calendarRoot = document.getElementById("calendarRoot");
const calendarNotice = document.getElementById("calendarNotice");

function groupByDate(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.date;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }
  return Array.from(map.entries()).sort(([a], [b]) => (a > b ? 1 : -1));
}

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

async function loadCalendar() {
  if (!profile || !calendarRoot) {
    return;
  }

  let rows = [];

  if (profile.role === "patient") {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, date, time, status, doctors(name, specialization)")
      .eq("user_id", profile.id)
      .order("date", { ascending: true });

    if (error) {
      showToast(error.message);
      return;
    }

    rows = (data || []).map((r) => ({
      ...r,
      kind: "patient"
    }));
  }

  if (profile.role === "doctor") {
    const doctorIds = await getDoctorIds();

    if (doctorIds.length === 0) {
      calendarRoot.innerHTML =
        "<div class='notice'>Для этого аккаунта врача нет карточки в таблице doctors. Выполните SQL-патч синхронизации (fix_users_sync.sql) и войдите заново, либо создайте нового врача через регистрацию.</div>";
      return;
    }

    const { data, error } = await supabase
      .from("appointments")
      .select("id, date, time, status, users(name, email), doctors(name, specialization)")
      .in("doctor_id", doctorIds)
      .order("date", { ascending: true });

    if (error) {
      showToast(error.message);
      return;
    }

    const hasHiddenPatientData = (data || []).some((item) => !item.users?.name && !item.users?.email);
    if (hasHiddenPatientData && calendarNotice) {
      calendarNotice.textContent =
        "Если у пациентов отображается '-' — данные скрыты настройками Supabase (RLS). Примените SQL-патч из supabase/fix_users_sync.sql (политика doctors can read patients for own appointments) и войдите снова.";
    }

    rows = (data || []).map((r) => ({
      ...r,
      kind: "doctor"
    }));
  }

  if (!rows.length) {
    calendarRoot.innerHTML = "<div class='notice'>Пока нет записей.</div>";
    return;
  }

  const grouped = groupByDate(rows);

  calendarRoot.innerHTML = grouped
    .map(([date, items]) => {
      const tableHead =
        profile.role === "doctor"
          ? `
            <tr>
              <th>Пациент</th>
              <th>Email</th>
              <th>Специалист</th>
              <th>Время</th>
              <th>Статус</th>
            </tr>
          `
          : `
            <tr>
              <th>Специалист</th>
              <th>Направление</th>
              <th>Время</th>
              <th>Статус</th>
            </tr>
          `;

      const tableRows = items
        .sort((a, b) => (a.time > b.time ? 1 : -1))
        .map((item) => {
          if (profile.role === "doctor") {
            return `
              <tr>
                <td>${item.users?.name || "-"}</td>
                <td>${item.users?.email || "-"}</td>
                <td>${item.doctors?.name || "-"}</td>
                <td>${item.time}</td>
                <td>${statusBadge(item.status)}</td>
              </tr>
            `;
          }

          return `
            <tr>
              <td>${item.doctors?.name || "-"}</td>
              <td>${item.doctors?.specialization || "-"}</td>
              <td>${item.time}</td>
              <td>${statusBadge(item.status)}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <section class="card">
          <h3 style="margin:0 0 10px;">${formatDate(date)}</h3>
          <div class="table-wrap" style="margin-top:0;">
            <table>
              <thead>${tableHead}</thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </section>
      `;
    })
    .join("");
}

await loadCalendar();
