const supabase = window.supabase.createClient(
  window.HSM_CONFIG.SUPABASE_URL,
  window.HSM_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const scheduleEl = document.getElementById("schedule");
const seatsEl = document.getElementById("seats");
const dateEl = document.getElementById("date");
const nameEl = document.getElementById("name");
const phoneEl = document.getElementById("phone");
const bookBtn = document.getElementById("book");
const resultEl = document.getElementById("result");

let selectedSchedule = null;
let selectedSeat = null;
let currentBookings = [];

// ===============================
// NORMALIZE ROUTE
// ===============================
function normalizeRoute(route) {
  if (!route) return "";

  return route
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/-/g, "→")
    .replace(/–/g, "→")
    .replace(/>/g, "→");
}

// ===============================
// NORMALIZE VEHICLE
// ===============================
function normalizeVehicle(vehicle) {
  if (vehicle === null || vehicle === undefined) return "";

  const v = vehicle.toString().trim().toUpperCase();

  if (
    v === "HSM-01" ||
    v === "HSM01" ||
    v === "01" ||
    v === "1" ||
    v.includes("HSM-01") ||
    v.includes("HSM01")
  ) {
    return "HSM-01";
  }

  if (
    v === "HSM-02" ||
    v === "HSM02" ||
    v === "02" ||
    v === "2" ||
    v.includes("HSM-02") ||
    v.includes("HSM02")
  ) {
    return "HSM-02";
  }

  return v;
}

// ===============================
// FORMAT RUPIAH
// ===============================
function rupiah(value) {
  return "Rp" + Number(value || 0).toLocaleString("id-ID");
}

// ===============================
// LOAD SCHEDULE
// ===============================
async function loadSchedules() {
  scheduleEl.innerHTML = `
    <div style="padding:15px;text-align:center">
      Memuat jadwal...
    </div>
  `;

  seatsEl.innerHTML = "";
  resultEl.innerHTML = "";
  selectedSchedule = null;
  selectedSeat = null;

  const selectedDate = dateEl.value;

  try {
    // JANGAN FILTER VEHICLE DI SINI
    // Supaya 01, 02, HSM-01, HSM-02 semuanya tetap terbaca.
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("active", true)
      .order("departure_time", { ascending: true });

    if (error) {
      console.error("SUPABASE ERROR:", error);

      scheduleEl.innerHTML = `
        <div style="padding:15px;color:red">
          Gagal mengambil jadwal.<br>
          ${error.message}
        </div>
      `;

      return;
    }

    console.log("SEMUA SCHEDULE:", data);

    if (!data || data.length === 0) {
      scheduleEl.innerHTML = `
        <div style="padding:15px;text-align:center">
          Tidak ada jadwal aktif di database.
        </div>
      `;
      return;
    }

    // Filter tanggal di browser
    let schedules = data.filter(row => {
      if (!selectedDate) return true;

      const rowDate = row.travel_date
        ? row.travel_date.toString().slice(0, 10)
        : "";

      return rowDate === selectedDate;
    });

    console.log("SCHEDULE TANGGAL:", schedules);

    if (schedules.length === 0) {
      scheduleEl.innerHTML = `
        <div style="padding:15px;text-align:center">
          Tidak ada jadwal untuk tanggal
          <b>${selectedDate}</b>.
        </div>
      `;
      return;
    }

    // Buat daftar layanan yang bisa dipesan
    const services = [];

    schedules.forEach(row => {
      const route = normalizeRoute(row.route);
      const vehicle = normalizeVehicle(row.vehicle);

      const time = row.departure_time
        ? row.departure_time.toString().slice(0, 5)
        : "";

      // ==========================================
      // SOFIFI → WEDA
      // ==========================================
      if (
        route === "Sofifi→Weda" &&
        vehicle === "HSM-01"
      ) {
        services.push({
          ...row,
          displayRoute: "Sofifi → Weda",
          displayTime: time,
          displayPrice: 225000,
          segmentStart: 1,
          segmentEnd: 2
        });
      }

      if (
        route === "Sofifi→Weda" &&
        vehicle === "HSM-02"
      ) {
        services.push({
          ...row,
          displayRoute: "Sofifi → Weda",
          displayTime: time,
          displayPrice: 225000,
          segmentStart: 1,
          segmentEnd: 2
        });
      }

      // ==========================================
      // WEDA → SOFIFI
      // ==========================================
      if (
        route === "Weda→Sofifi" &&
        (vehicle === "HSM-01" || vehicle === "HSM-02")
      ) {
        services.push({
          ...row,
          displayRoute: "Weda → Sofifi",
          displayTime: time,
          displayPrice: 225000,
          segmentStart: 1,
          segmentEnd: 2
        });
      }
    });

    // ==========================================
    // TAMBAHKAN LAYANAN LOLEO
    // ==========================================

    schedules.forEach(row => {
      const route = normalizeRoute(row.route);
      const vehicle = normalizeVehicle(row.vehicle);

      const time = row.departure_time
        ? row.departure_time.toString().slice(0, 5)
        : "";

      // HSM-01 pagi:
      // Sofifi 09:00 → Loleo → Weda
      // Loleo → Weda sekitar 09:30
      if (
        route === "Sofifi→Weda" &&
        vehicle === "HSM-01" &&
        time === "09:00"
      ) {
        services.push({
          ...row,
          displayRoute: "Loleo → Weda",
          displayTime: "09:30",
          displayPrice: 200000,
          segmentStart: 2,
          segmentEnd: 2
        });
      }

      // HSM-02 sore:
      // Sofifi 13:00 → Loleo → Weda
      // Loleo → Weda sekitar 13:30
      if (
        route === "Sofifi→Weda" &&
        vehicle === "HSM-02" &&
        time === "13:00"
      ) {
        services.push({
          ...row,
          displayRoute: "Loleo → Weda",
          displayTime: "13:30",
          displayPrice: 200000,
          segmentStart: 2,
          segmentEnd: 2
        });
      }

      // Weda → Loleo
      if (
        route === "Weda→Sofifi" &&
        vehicle === "HSM-01" &&
        time === "13:00"
      ) {
        services.push({
          ...row,
          displayRoute: "Weda → Loleo",
          displayTime: "13:00",
          displayPrice: 200000,
          segmentStart: 1,
          segmentEnd: 1
        });
      }

      // HSM-02 pagi:
      // Weda 09:00 → Loleo → Sofifi
      if (
        route === "Weda→Sofifi" &&
        vehicle === "HSM-02" &&
        time === "09:00"
      ) {
        services.push({
          ...row,
          displayRoute: "Weda → Loleo",
          displayTime: "09:00",
          displayPrice: 200000,
          segmentStart: 1,
          segmentEnd: 1
        });
      }
    });

    // ==========================================
    // TAMPILKAN JADWAL
    // ==========================================

    scheduleEl.innerHTML = "";

    if (services.length === 0) {
      scheduleEl.innerHTML = `
        <div style="padding:15px;text-align:center">
          Jadwal ditemukan di database,
          tetapi belum cocok dengan rute kendaraan HSM.
          <br><br>
          Cek Console untuk melihat data database.
        </div>
      `;

      console.log("DATA DATABASE:", schedules);
      return;
    }

    services.sort((a, b) =>
      a.displayTime.localeCompare(b.displayTime)
    );

    services.forEach(service => {
      const btn = document.createElement("button");

      btn.className = "scheduleBtn";

      btn.innerHTML = `
        <div>
          <strong>${service.displayRoute}</strong>
        </div>

        <div style="font-size:18px;margin-top:5px">
          ${service.displayTime}
        </div>

        <div style="margin-top:5px">
          ${rupiah(service.displayPrice)}
        </div>

        <small>
          ${normalizeVehicle(service.vehicle) || "HSM"}
        </small>
      `;

      btn.onclick = () => {
        document
          .querySelectorAll(".scheduleBtn")
          .forEach(x => x.classList.remove("active"));

        btn.classList.add("active");

        selectedSchedule = service;
        selectedSeat = null;

        loadSeats(service);
      };

      scheduleEl.appendChild(btn);
    });

  } catch (err) {
    console.error(err);

    scheduleEl.innerHTML = `
      <div style="padding:15px;color:red">
        Error JavaScript:<br>
        ${err.message}
      </div>
    `;
  }
}

// ===============================
// LOAD SEATS
// ===============================
async function loadSeats(schedule) {
  seatsEl.innerHTML = `
    <div style="padding:10px;text-align:center">
      Memuat kursi...
    </div>
  `;

  selectedSeat = null;

  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("schedule_id", schedule.id);

    if (error) {
      console.error(error);

      seatsEl.innerHTML = `
        <div style="color:red">
          Gagal mengambil data kursi.
        </div>
      `;

      return;
    }

    currentBookings = data || [];

    renderSeats(schedule);

  } catch (err) {
    console.error(err);

    seatsEl.innerHTML = `
      <div style="color:red">
        ${err.message}
      </div>
    `;
  }
}

// ===============================
// CHECK SEAT OCCUPIED
// ===============================
function isSeatOccupied(seatNumber, schedule) {
  return currentBookings.some(booking => {
    if (Number(booking.seat_number) !== Number(seatNumber)) {
      return false;
    }

    const bookingStart =
      Number(booking.segment_start || 1);

    const bookingEnd =
      Number(booking.segment_end || 2);

    const newStart =
      Number(schedule.segmentStart || 1);

    const newEnd =
      Number(schedule.segmentEnd || 2);

    return (
      bookingStart <= newEnd &&
      bookingEnd >= newStart
    );
  });
}

// ===============================
// RENDER 14 SEAT
// ===============================
function renderSeats(schedule) {
  seatsEl.innerHTML = "";

  const layout = [
    [1, 2, 3],
    [4, null, 5, 6],
    [7, null, 8, 9],
    [10, 11, 12, 13, 14]
  ];

  layout.forEach(row => {
    const rowEl = document.createElement("div");

    rowEl.style.display = "flex";
    rowEl.style.gap = "8px";
    rowEl.style.marginBottom = "8px";
    rowEl.style.justifyContent = "center";

    row.forEach(number => {
      if (number === null) {
        const aisle = document.createElement("div");
        aisle.style.width = "35px";
        rowEl.appendChild(aisle);
        return;
      }

      const seat = document.createElement("button");

      seat.className = "seat";
      seat.textContent = number;

      const occupied =
        isSeatOccupied(number, schedule);

      if (occupied) {
        seat.disabled = true;
        seat.classList.add("booked");
      }

      seat.onclick = () => {
        if (occupied) return;

        document
          .querySelectorAll(".seat")
          .forEach(x => x.classList.remove("selected"));

        seat.classList.add("selected");

        selectedSeat = number;
      };

      rowEl.appendChild(seat);
    });

    seatsEl.appendChild(rowEl);
  });
}

// ===============================
// BOOKING
// ===============================
bookBtn.addEventListener("click", async () => {
  if (!selectedSchedule) {
    alert("Pilih jadwal dulu.");
    return;
  }

  if (!selectedSeat) {
    alert("Pilih kursi dulu.");
    return;
  }

  if (!nameEl.value.trim()) {
    alert("Masukkan nama penumpang.");
    nameEl.focus();
    return;
  }

  if (!phoneEl.value.trim()) {
    alert("Masukkan nomor WhatsApp.");
    phoneEl.focus();
    return;
  }

  bookBtn.disabled = true;
  bookBtn.textContent = "Memproses...";

  const bookingCode =
    "HSM-" +
    Date.now().toString().slice(-8);

  const { error } = await supabase
    .from("bookings")
    .insert({
      booking_code: bookingCode,
      schedule_id: selectedSchedule.id,
      passenger_name: nameEl.value.trim(),
      phone: phoneEl.value.trim(),
      seat_number: selectedSeat,
      total: selectedSchedule.displayPrice,
      payment_status: "pending",
      trip_code: selectedSchedule.trip_code || null,
      segment_start: selectedSchedule.segmentStart || 1,
      segment_end: selectedSchedule.segmentEnd || 2,
      origin: selectedSchedule.displayRoute.split(" → ")[0],
      destination: selectedSchedule.displayRoute.split(" → ")[1]
    });

  if (error) {
    console.error(error);

    alert("Booking gagal: " + error.message);

    bookBtn.disabled = false;
    bookBtn.textContent = "Pesan Tiket";

    return;
  }

  const message = `
Halo HSM Transport 👋

Saya ingin memesan tiket.

Kode Booking: ${bookingCode}
Nama: ${nameEl.value.trim()}
Rute: ${selectedSchedule.displayRoute}
Tanggal: ${dateEl.value}
Jam: ${selectedSchedule.displayTime}
Kursi: ${selectedSeat}
Total: ${rupiah(selectedSchedule.displayPrice)}

Mohon konfirmasi booking saya.
  `.trim();

  const waUrl =
    "https://wa.me/" +
    window.HSM_CONFIG.WHATSAPP_ADMIN +
    "?text=" +
    encodeURIComponent(message);

  resultEl.innerHTML = `
    <div style="padding:15px">
      <strong>Booking berhasil!</strong><br><br>
      Kode Booking: <b>${bookingCode}</b><br>
      Kursi: <b>${selectedSeat}</b><br><br>

      <a
        href="${waUrl}"
        target="_blank"
        style="
          display:inline-block;
          padding:12px 18px;
          border-radius:8px;
          text-decoration:none;
          background:#25D366;
          color:white;
          font-weight:bold;
        "
      >
        Konfirmasi WhatsApp
      </a>
    </div>
  `;

  await loadSeats(selectedSchedule);

  bookBtn.disabled = false;
  bookBtn.textContent = "Pesan Tiket";
});

// ===============================
// DATE CHANGE
// ===============================
dateEl.addEventListener("change", loadSchedules);

// ===============================
// DEFAULT DATE
// ===============================
const today =
  new Date().toISOString().split("T")[0];

if (!dateEl.value) {
  dateEl.value = today;
}

// ===============================
// START
// ===============================
loadSchedules();

// Refresh setiap 30 detik
setInterval(loadSchedules, 30000);
