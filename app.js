const supabase = window.supabase.createClient(
  window.HSM_CONFIG.SUPABASE_URL,
  window.HSM_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const WHATSAPP_ADMIN = window.HSM_CONFIG.WHATSAPP_ADMIN;

const PRICES = {
  "Sofifi-Weda": 225000,
  "Loleo-Weda": 200000,
  "Weda-Sofifi": 225000,
  "Weda-Loleo": 200000
};

const SEATS = Array.from({ length: 13 }, (_, i) => i + 1);

let schedules = [];
let selectedSchedule = null;
let selectedSeat = null;

function $(id) {
  return document.getElementById(id);
}

function route(value) {
  return String(value || "")
    .replace(/[–—-]/g, "→")
    .replace(/\s*→\s*/g, "→")
    .trim();
}

function money(value) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function normalizeTime(value) {
  return String(value || "").slice(0, 5);
}

function isToday(date) {
  const now = new Date();
  const local =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  return date === local;
}

/*
  Membuat jadwal yang bisa dipesan dari jadwal utama.

  Jalur utama:
  Sofifi → Weda
  Weda → Sofifi

  Jalur turunan:
  Loleo → Weda
  Weda → Loleo
*/

function buildAvailableSchedules(data, from, to) {
  const result = [];

  const fromRoute = `${from}→${to}`;

  data.forEach((s) => {
    const r = route(s.route);
    const time = normalizeTime(s.departure_time);

    // =========================================
    // SOFIFI → WEDA
    // =========================================

    if (fromRoute === "Sofifi→Weda") {
      if (r !== "Sofifi→Weda") return;

      result.push({
        ...s,
        display_time: time,
        display_route: "Sofifi → Weda",
        display_price: PRICES["Sofifi-Weda"],
        segment_start: 1,
        segment_end: 2,
        base_schedule_id: s.id,
        derived: false
      });

      return;
    }

    // =========================================
    // LOLEO → WEDA
    // =========================================

    if (fromRoute === "Loleo→Weda") {
      if (r !== "Sofifi→Weda") return;

      /*
        HSM-01 pagi:
        Sofifi 09:00
        Loleo 09:30
        Loleo → Weda

        HSM-02 sore:
        Sofifi 13:00
        Loleo 13:30
        Loleo → Weda
      */

      if (
        s.vehicle === "HSM-01" &&
        time === "09:00"
      ) {
        result.push({
          ...s,
          display_time: "09:30",
          display_route: "Loleo → Weda",
          display_price: PRICES["Loleo-Weda"],
          segment_start: 2,
          segment_end: 2,
          base_schedule_id: s.id,
          derived: true
        });
      }

      if (
        s.vehicle === "HSM-02" &&
        time === "13:00"
      ) {
        result.push({
          ...s,
          display_time: "13:30",
          display_route: "Loleo → Weda",
          display_price: PRICES["Loleo-Weda"],
          segment_start: 2,
          segment_end: 2,
          base_schedule_id: s.id,
          derived: true
        });
      }

      return;
    }

    // =========================================
    // WEDA → SOFIFI
    // =========================================

    if (fromRoute === "Weda→Sofifi") {
      if (r !== "Weda→Sofifi") return;

      result.push({
        ...s,
        display_time: time,
        display_route: "Weda → Sofifi",
        display_price: PRICES["Weda-Sofifi"],
        segment_start: 1,
        segment_end: 2,
        base_schedule_id: s.id,
        derived: false
      });

      return;
    }

    // =========================================
    // WEDA → LOLEO
    // =========================================

    if (fromRoute === "Weda→Loleo") {
      if (r !== "Weda→Sofifi") return;

      /*
        HSM-01:
        Weda 13:00
        Weda → Loleo
        hanya segment 1
      */

      if (
        s.vehicle === "HSM-01" &&
        time === "13:00"
      ) {
        result.push({
          ...s,
          display_time: "13:00",
          display_route: "Weda → Loleo",
          display_price: PRICES["Weda-Loleo"],
          segment_start: 1,
          segment_end: 1,
          base_schedule_id: s.id,
          derived: true
        });
      }

      return;
    }
  });

  result.sort((a, b) =>
    String(a.display_time).localeCompare(String(b.display_time))
  );

  return result;
}


// =========================================
// LOAD JADWAL
// =========================================

async function loadSchedules() {
  const from = $("from")?.value;
  const to = $("to")?.value;

  if (!from || !to || from === to) {
    schedules = [];
    renderSchedules();
    return;
  }

  const validRoutes = [
    "Sofifi→Weda",
    "Weda→Sofifi"
  ];

  try {
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("active", true)
      .in("route", validRoutes)
      .in("vehicle", ["HSM-01", "HSM-02"])
      .order("travel_date", { ascending: true })
      .order("departure_time", { ascending: true });

    if (error) {
      console.error(error);
      schedules = [];
      renderSchedules();
      return;
    }

    schedules = buildAvailableSchedules(
      data || [],
      from,
      to
    );

    renderSchedules();

  } catch (err) {
    console.error(err);
    schedules = [];
    renderSchedules();
  }
}


// =========================================
// RENDER JADWAL
// =========================================

function renderSchedules() {
  const container =
    $("scheduleList") ||
    $("schedules") ||
    $("schedule-container");

  if (!container) return;

  container.innerHTML = "";

  if (!schedules.length) {
    container.innerHTML = `
      <div class="empty-schedule">
        <p>Belum ada jadwal tersedia.</p>
      </div>
    `;
    return;
  }

  schedules.forEach((s, index) => {
    const card = document.createElement("div");

    card.className = "schedule-card";

    card.innerHTML = `
      <div class="schedule-info">
        <div class="schedule-route">
          ${s.display_route}
        </div>

        <div class="schedule-date">
          ${formatDate(s.travel_date)}
        </div>

        <div class="schedule-time">
          ${s.display_time} WIT
        </div>

        <div class="schedule-vehicle">
          ${s.vehicle || ""}
        </div>

        <div class="schedule-price">
          Rp ${money(s.display_price)}
        </div>
      </div>

      <button
        type="button"
        class="btn-pilih-jadwal"
        data-index="${index}"
      >
        Pilih Jadwal
      </button>
    `;

    const button =
      card.querySelector(".btn-pilih-jadwal");

    button.addEventListener("click", () => {
      pilihJadwal(s);
    });

    container.appendChild(card);
  });
}


// =========================================
// FORMAT TANGGAL
// =========================================

function formatDate(date) {
  if (!date) return "";

  const d = new Date(date + "T00:00:00");

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}


// =========================================
// PILIH JADWAL
// =========================================

async function pilihJadwal(schedule) {
  selectedSchedule = schedule;
  selectedSeat = null;

  const baseScheduleId =
    schedule.base_schedule_id || schedule.id;

  try {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        seat_number,
        payment_status,
        segment_start,
        segment_end
      `)
      .eq("schedule_id", baseScheduleId);

    if (error) {
      console.error(error);
      alert("Gagal mengambil data kursi.");
      return;
    }

    const occupiedSeats = new Set();

    (bookings || []).forEach((booking) => {
      if (
        String(booking.payment_status || "")
          .toLowerCase() === "batal"
      ) {
        return;
      }

      const oldStart =
        Number(booking.segment_start || 1);

      const oldEnd =
        Number(booking.segment_end || 2);

      const newStart =
        Number(schedule.segment_start || 1);

      const newEnd =
        Number(schedule.segment_end || 2);

      /*
        Kursi dianggap bentrok hanya kalau
        segmennya saling overlap.
      */

      const overlap =
        oldStart <= newEnd &&
        oldEnd >= newStart;

      if (overlap) {
        occupiedSeats.add(
          Number(booking.seat_number)
        );
      }
    });

    renderSeats(occupiedSeats);

    const seatSection =
      $("seatSection") ||
      $("seat-selection") ||
      $("seatContainer");

    if (seatSection) {
      seatSection.style.display = "block";

      seatSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

  } catch (err) {
    console.error(err);
    alert("Terjadi kesalahan saat mengambil kursi.");
  }
}


// =========================================
// RENDER KURSI
// =========================================

function renderSeats(occupiedSeats) {
  const container =
    $("seatGrid") ||
    $("seats") ||
    $("seat-container");

  if (!container) return;

  container.innerHTML = "";

  /*
    Layout 13 kursi:

    (1) (2) (3)
    (4)   (5) (6)
    (7)   (8) (9)
    (10)(11)(12)(13)
  */

  const layout = [
    [1, 2, 3],
    [4, null, 5, 6],
    [7, null, 8, 9],
    [10, 11, 12, 13]
  ];

  layout.forEach((row) => {
    const rowDiv = document.createElement("div");

    rowDiv.className = "seat-row";

    row.forEach((seatNumber) => {
      if (seatNumber === null) {
        const aisle = document.createElement("div");
        aisle.className = "seat-aisle";
        rowDiv.appendChild(aisle);
        return;
      }

      const button = document.createElement("button");

      button.type = "button";
      button.className = "seat";
      button.textContent = seatNumber;

      if (occupiedSeats.has(seatNumber)) {
        button.classList.add("occupied");
        button.disabled = true;
        button.title = "Kursi sudah dipesan";
      } else {
        button.addEventListener("click", () => {
          selectSeat(seatNumber);
        });
      }

      rowDiv.appendChild(button);
    });

    container.appendChild(rowDiv);
  });
}


// =========================================
// PILIH KURSI
// =========================================

function selectSeat(seatNumber) {
  selectedSeat = seatNumber;

  document
    .querySelectorAll(".seat.selected")
    .forEach((el) => {
      el.classList.remove("selected");
    });

  const buttons =
    document.querySelectorAll(".seat");

  buttons.forEach((button) => {
    if (
      Number(button.textContent) ===
      Number(seatNumber)
    ) {
      button.classList.add("selected");
    }
  });

  const selectedSeatInput =
    $("selectedSeat");

  if (selectedSeatInput) {
    selectedSeatInput.value = seatNumber;
  }

  const seatText =
    $("selectedSeatText");

  if (seatText) {
    seatText.textContent =
      `Kursi ${seatNumber}`;
  }
}


// =========================================
// BUAT KODE BOOKING
// =========================================

function generateBookingCode() {
  const random =
    Math.floor(1000 + Math.random() * 9000);

  return `HSM-${Date.now()
    .toString()
    .slice(-6)}-${random}`;
}


// =========================================
// BUAT BOOKING
// =========================================

async function createBooking() {
  if (!selectedSchedule) {
    alert("Silakan pilih jadwal terlebih dahulu.");
    return;
  }

  if (!selectedSeat) {
    alert("Silakan pilih kursi terlebih dahulu.");
    return;
  }

  const name =
    $("passengerName")?.value?.trim() ||
    $("nama")?.value?.trim() ||
    "";

  const phone =
    $("passengerPhone")?.value?.trim() ||
    $("phone")?.value?.trim() ||
    $("telepon")?.value?.trim() ||
    "";

  if (!name) {
    alert("Nama penumpang wajib diisi.");
    return;
  }

  if (!phone) {
    alert("Nomor WhatsApp wajib diisi.");
    return;
  }

  const baseScheduleId =
    selectedSchedule.base_schedule_id ||
    selectedSchedule.id;

  const segmentStart =
    Number(selectedSchedule.segment_start || 1);

  const segmentEnd =
    Number(selectedSchedule.segment_end || 2);

  try {
    // =======================================
    // CEK JADWAL MASIH AKTIF
    // =======================================

    const { data: latest, error: scheduleError } =
      await supabase
        .from("schedules")
        .select("*")
        .eq("id", baseScheduleId)
        .eq("active", true)
        .single();

    if (scheduleError || !latest) {
      alert(
        "Maaf, jadwal ini sudah tidak tersedia."
      );

      await loadSchedules();
      return;
    }

    // =======================================
    // CEK KURSI TERBARU
    // =======================================

    const { data: existingBookings, error: bookingError } =
      await supabase
        .from("bookings")
        .select(`
          seat_number,
          payment_status,
          segment_start,
          segment_end
        `)
        .eq("schedule_id", baseScheduleId)
        .eq("seat_number", selectedSeat);

    if (bookingError) {
      console.error(bookingError);
      alert("Gagal mengecek kursi.");
      return;
    }

    const seatTaken =
      (existingBookings || []).some((booking) => {
        if (
          String(booking.payment_status || "")
            .toLowerCase() === "batal"
        ) {
          return false;
        }

        const oldStart =
          Number(booking.segment_start || 1);

        const oldEnd =
          Number(booking.segment_end || 2);

        return (
          oldStart <= segmentEnd &&
          oldEnd >= segmentStart
        );
      });

    if (seatTaken) {
      alert(
        "Kursi tersebut baru saja dipesan orang lain. Silakan pilih kursi lain."
      );

      await pilihJadwal(selectedSchedule);
      return;
    }

    // =======================================
    // BUAT BOOKING
    // =======================================

    const bookingCode =
      generateBookingCode();

    const from =
      $("from")?.value || "";

    const to =
      $("to")?.value || "";

    const price =
      selectedSchedule.display_price ||
      PRICES[`${from}-${to}`] ||
      latest.price ||
      0;

    const bookingData = {
      booking_code: bookingCode,

      schedule_id: baseScheduleId,

      passenger_name: name,

      phone: phone,

      seat_number: selectedSeat,

      total: price,

      payment_status: "Belum Bayar",

      trip_code:
        latest.trip_code || null,

      segment_start: segmentStart,

      segment_end: segmentEnd,

      origin: from,

      destination: to
    };

    const { data: inserted, error: insertError } =
      await supabase
        .from("bookings")
        .insert([bookingData])
        .select()
        .single();

    if (insertError) {
      console.error(insertError);

      alert(
        "Booking gagal. Silakan coba lagi."
      );

      return;
    }

    // =======================================
    // WHATSAPP
    // =======================================

    const message = `
Halo Admin HSM Transport,

Saya ingin melakukan pemesanan tiket.

Kode Booking: ${bookingCode}

Nama: ${name}
No. WhatsApp: ${phone}

Rute: ${from} → ${to}
Tanggal: ${formatDate(latest.travel_date)}
Jam: ${selectedSchedule.display_time} WIT
Kendaraan: ${latest.vehicle || "-"}
Kursi: ${selectedSeat}

Total: Rp ${money(price)}

Status: Belum Bayar

Mohon konfirmasi booking saya.
`.trim();

    const waUrl =
      `https://wa.me/${WHATSAPP_ADMIN}?text=` +
      encodeURIComponent(message);

    // =======================================
    // SUKSES
    // =======================================

    alert(
      `Booking berhasil!\n\nKode Booking: ${bookingCode}`
    );

    window.open(
      waUrl,
      "_blank"
    );

    selectedSeat = null;

    await pilihJadwal(selectedSchedule);

  } catch (err) {
    console.error(err);

    alert(
      "Terjadi kesalahan saat membuat booking."
    );
  }
}


// =========================================
// HUBUNGKAN FORM BOOKING
// =========================================

function setupBookingForm() {
  const form =
    $("bookingForm");

  if (!form) return;

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      await createBooking();
    }
  );
}


// =========================================
// ROUTE SELECT
// =========================================

function setupRouteSelector() {
  const from =
    $("from");

  const to =
    $("to");

  if (!from || !to) return;

  from.addEventListener(
    "change",
    loadSchedules
  );

  to.addEventListener(
    "change",
    loadSchedules
  );
}


// =========================================
// TOMBOL ROUTE
// =========================================

function setupRouteButtons() {
  const buttons =
    document.querySelectorAll(
      "[data-from][data-to]"
    );

  buttons.forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const from =
          button.dataset.from;

        const to =
          button.dataset.to;

        const fromSelect =
          $("from");

        const toSelect =
          $("to");

        if (fromSelect) {
          fromSelect.value = from;

          fromSelect.dispatchEvent(
            new Event("change", {
              bubbles: true
            })
          );
        }

        if (toSelect) {
          toSelect.value = to;

          toSelect.dispatchEvent(
            new Event("change", {
              bubbles: true
            })
          );
        }

        loadSchedules();
      }
    );
  });
}


// =========================================
// AUTO REFRESH JADWAL
// =========================================

function startScheduleRefresh() {
  setInterval(() => {
    const from =
      $("from")?.value;

    const to =
      $("to")?.value;

    if (
      from &&
      to &&
      from !== to
    ) {
      loadSchedules();
    }
  }, 30000);
}


// =========================================
// INIT
// =========================================

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setupRouteSelector();
    setupRouteButtons();
    setupBookingForm();
    startScheduleRefresh();

    loadSchedules();
  }
);
