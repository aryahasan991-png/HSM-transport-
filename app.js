// ============================================================
// HSM TRANSPORT - APP.JS FINAL
// ============================================================

const HSM_CONFIG = window.HSM_CONFIG;

if (!HSM_CONFIG) {
  throw new Error("config.js tidak ditemukan.");
}

if (!window.supabase) {
  throw new Error("Library Supabase tidak ditemukan.");
}

const db = window.supabase.createClient(
  HSM_CONFIG.SUPABASE_URL,
  HSM_CONFIG.SUPABASE_PUBLISHABLE_KEY
);


// ============================================================
// ELEMENT HTML
// ============================================================

const scheduleEl = document.getElementById("schedule");
const seatsEl = document.getElementById("seats");
const dateEl = document.getElementById("date");
const nameEl = document.getElementById("name");
const phoneEl = document.getElementById("phone");
const bookBtn = document.getElementById("book");
const resultEl = document.getElementById("result");

const fromEl = document.getElementById("from");
const toEl = document.getElementById("to");


// ============================================================
// VARIABLE
// ============================================================

let schedules = [];
let selectedSchedule = null;
let selectedSeat = null;
let selectedOrigin = "";
let selectedDestination = "";
let currentBookings = [];


// ============================================================
// FORMAT RUPIAH
// ============================================================

function rupiah(value) {
  return "Rp" + Number(value || 0).toLocaleString("id-ID");
}


// ============================================================
// TANGGAL LOCAL
// ============================================================

function getLocalDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


// ============================================================
// NORMALIZE ROUTE
// ============================================================

function normalizeRoute(route) {
  if (!route) return "";

  return String(route)
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "→")
    .replace(/–/g, "→")
    .replace(/>/g, "→");
}


// ============================================================
// NORMALIZE VEHICLE
// ============================================================

function normalizeVehicle(vehicle) {
  if (vehicle === null || vehicle === undefined) {
    return "";
  }

  const v = String(vehicle)
    .trim()
    .toUpperCase();

  if (
    v === "HSM-01" ||
    v === "HSM01" ||
    v === "01" ||
    v === "1"
  ) {
    return "HSM-01";
  }

  if (
    v === "HSM-02" ||
    v === "HSM02" ||
    v === "02" ||
    v === "2"
  ) {
    return "HSM-02";
  }

  return v;
}


// ============================================================
// JAM
// ============================================================

function formatTime(time) {
  if (!time) return "";

  return String(time).substring(0, 5);
}


// ============================================================
// ROUTE YANG DIPILIH
// ============================================================

function getSelectedRoute() {
  const checked = document.querySelector(
    'input[name="route"]:checked'
  );

  if (!checked) {
    return {
      origin: fromEl ? fromEl.value : "",
      destination: toEl ? toEl.value : ""
    };
  }

  const value = checked.value || "";

  const parts = value.split("|");

  return {
    origin: (parts[0] || "").trim(),
    destination: (parts[1] || "").trim()
  };
}


// ============================================================
// UPDATE ROUTE
// ============================================================

function updateSelectedRoute() {
  const route = getSelectedRoute();

  selectedOrigin = route.origin;
  selectedDestination = route.destination;

  if (fromEl) {
    fromEl.value = route.origin;
  }

  if (toEl) {
    toEl.value = route.destination;
  }

  selectedSchedule = null;
  selectedSeat = null;

  if (seatsEl) {
    seatsEl.innerHTML = `
      <div style="padding:15px;text-align:center">
        Pilih jadwal terlebih dahulu.
      </div>
    `;
  }

  loadSchedules();
}


// ============================================================
// EVENT ROUTE
// ============================================================

document
  .querySelectorAll('input[name="route"]')
  .forEach(input => {
    input.addEventListener("change", updateSelectedRoute);
  });


// ============================================================
// AMBIL DATA SCHEDULE
// ============================================================

async function fetchSchedules() {

  const { data, error } = await db
    .from("schedules")
    .select("*")
    .eq("active", true)
    .order("travel_date", {
      ascending: true
    })
    .order("departure_time", {
      ascending: true
    });

  if (error) {
    throw error;
  }

  return data || [];
}


// ============================================================
// BUAT LAYANAN DARI SCHEDULE
// ============================================================

function buildServices(rows) {

  const services = [];

  rows.forEach(row => {

    const route = normalizeRoute(row.route);
    const vehicle = normalizeVehicle(row.vehicle);
    const time = formatTime(row.departure_time);

    // ========================================================
    // SOFIFI → WEDA
    // ========================================================

    if (route === "Sofifi→Weda") {

      // FULL ROUTE
      services.push({
        ...row,

        displayOrigin: "Sofifi",
        displayDestination: "Weda",

        displayRoute: "Sofifi → Weda",

        displayTime: time,

        displayPrice: 225000,

        segmentStart: 1,
        segmentEnd: 2,

        serviceType: "FULL"
      });


      // ======================================================
      // LOLEO → WEDA
      // ======================================================

      if (
        vehicle === "HSM-01" &&
        time === "09:00"
      ) {

        services.push({
          ...row,

          displayOrigin: "Loleo",
          displayDestination: "Weda",

          displayRoute: "Loleo → Weda",

          displayTime: "09:30",

          displayPrice: 200000,

          segmentStart: 2,
          segmentEnd: 2,

          serviceType: "LOLEO"
        });
      }


      if (
        vehicle === "HSM-02" &&
        time === "13:00"
      ) {

        services.push({
          ...row,

          displayOrigin: "Loleo",
          displayDestination: "Weda",

          displayRoute: "Loleo → Weda",

          displayTime: "13:30",

          displayPrice: 200000,

          segmentStart: 2,
          segmentEnd: 2,

          serviceType: "LOLEO"
        });
      }
    }


    // ========================================================
    // WEDA → SOFIFI
    // ========================================================

    if (route === "Weda→Sofifi") {

      // FULL ROUTE
      services.push({
        ...row,

        displayOrigin: "Weda",
        displayDestination: "Sofifi",

        displayRoute: "Weda → Sofifi",

        displayTime: time,

        displayPrice: 225000,

        segmentStart: 1,
        segmentEnd: 2,

        serviceType: "FULL"
      });


      // ======================================================
      // WEDA → LOLEO
      // ======================================================

      if (
        vehicle === "HSM-02" &&
        time === "09:00"
      ) {

        services.push({
          ...row,

          displayOrigin: "Weda",
          displayDestination: "Loleo",

          displayRoute: "Weda → Loleo",

          displayTime: "09:00",

          displayPrice: 200000,

          segmentStart: 1,
          segmentEnd: 1,

          serviceType: "LOLEO"
        });
      }


      if (
        vehicle === "HSM-01" &&
        time === "13:00"
      ) {

        services.push({
          ...row,

          displayOrigin: "Weda",
          displayDestination: "Loleo",

          displayRoute: "Weda → Loleo",

          displayTime: "13:00",

          displayPrice: 200000,

          segmentStart: 1,
          segmentEnd: 1,

          serviceType: "LOLEO"
        });
      }
    }

  });

  return services;
}


// ============================================================
// LOAD SCHEDULE
// ============================================================

async function loadSchedules() {

  if (!scheduleEl) return;

  scheduleEl.innerHTML = `
    <div style="
      padding:15px;
      text-align:center;
    ">
      Memuat jadwal...
    </div>
  `;

  selectedSchedule = null;
  selectedSeat = null;

  if (seatsEl) {
    seatsEl.innerHTML = `
      <div style="
        padding:15px;
        text-align:center;
      ">
        Pilih jadwal terlebih dahulu.
      </div>
    `;
  }

  if (resultEl) {
    resultEl.innerHTML = "";
  }


  const selectedDate = dateEl
    ? dateEl.value
    : getLocalDate();

  const route = getSelectedRoute();

  selectedOrigin = route.origin;
  selectedDestination = route.destination;


  try {

    const rows = await fetchSchedules();

    schedules = rows;

    console.log(
      "HSM schedules:",
      rows
    );


    // ========================================================
    // FILTER TANGGAL
    // ========================================================

    const dateRows = rows.filter(row => {

      const rowDate = row.travel_date
        ? String(row.travel_date).substring(0, 10)
        : "";

      return rowDate === selectedDate;
    });


    // ========================================================
    // BUILD SERVICE
    // ========================================================

    const allServices =
      buildServices(dateRows);


    // ========================================================
    // FILTER ROUTE USER
    // ========================================================

    const services =
      allServices.filter(service => {

        return (
          service.displayOrigin
            .toLowerCase() ===
            route.origin.toLowerCase()
          &&
          service.displayDestination
            .toLowerCase() ===
            route.destination.toLowerCase()
        );

      });


    // ========================================================
    // HINDARI DUPLIKAT
    // ========================================================

    const unique = [];

    const seen = new Set();

    services.forEach(service => {

      const key = [
        service.id,
        service.displayOrigin,
        service.displayDestination,
        service.displayTime,
        service.segmentStart,
        service.segmentEnd
      ].join("|");

      if (!seen.has(key)) {

        seen.add(key);

        unique.push(service);

      }

    });


    // ========================================================
    // TIDAK ADA JADWAL
    // ========================================================

    if (unique.length === 0) {

      scheduleEl.innerHTML = `
        <div style="
          padding:15px;
          text-align:center;
        ">
          Tidak ada jadwal tersedia untuk
          <b>${route.origin} → ${route.destination}</b>
          pada tanggal
          <b>${selectedDate}</b>.
        </div>
      `;

      return;
    }


    // ========================================================
    // TAMPILKAN
    // ========================================================

    scheduleEl.innerHTML = "";


    unique.sort((a, b) => {

      return a.displayTime.localeCompare(
        b.displayTime
      );

    });


    unique.forEach(service => {

      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "scheduleBtn";


      button.innerHTML = `
        <div>
          <strong>
            ${service.displayRoute}
          </strong>
        </div>

        <div style="
          font-size:20px;
          margin-top:5px;
        ">
          ${service.displayTime}
        </div>

        <div style="
          margin-top:5px;
        ">
          ${rupiah(service.displayPrice)}
        </div>

        <small style="
          display:block;
          margin-top:5px;
        ">
          ${normalizeVehicle(service.vehicle)}
        </small>
      `;


      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".scheduleBtn")
            .forEach(btn => {

              btn.classList.remove(
                "active"
              );

            });


          button.classList.add(
            "active"
          );


          selectedSchedule =
            service;

          selectedSeat = null;

          loadSeats(service);

        }
      );


      scheduleEl.appendChild(
        button
      );

    });

  }

  catch (error) {

    console.error(
      "HSM LOAD ERROR:",
      error
    );


    scheduleEl.innerHTML = `
      <div style="
        padding:15px;
        color:#b00020;
      ">
        <strong>
          Gagal memuat jadwal.
        </strong>

        <br><br>

        ${error.message}
      </div>
    `;

  }
}


// ============================================================
// AMBIL BOOKING UNTUK SCHEDULE
// ============================================================

async function fetchBookings(scheduleId) {

  const { data, error } =
    await db
      .from("bookings")
      .select("*")
      .eq(
        "schedule_id",
        scheduleId
      );

  if (error) {
    throw error;
  }

  return data || [];
}


// ============================================================
// CEK APAKAH KURSI TERISI
// ============================================================

function isSeatOccupied(
  seatNumber,
  schedule
) {

  const newStart =
    Number(
      schedule.segmentStart || 1
    );

  const newEnd =
    Number(
      schedule.segmentEnd || 2
    );


  return currentBookings.some(
    booking => {

      // Hanya booking yang sama
      // dengan status yang masih relevan.
      const status =
        String(
          booking.payment_status || ""
        ).toLowerCase();


      if (
        status === "cancelled" ||
        status === "canceled"
      ) {
        return false;
      }


      if (
        Number(
          booking.seat_number
        ) !== Number(seatNumber)
      ) {
        return false;
      }


      // Booking lama yang belum punya
      // segment dianggap full trip.
      const bookingStart =
        Number(
          booking.segment_start || 1
        );

      const bookingEnd =
        Number(
          booking.segment_end || 2
        );


      // Cek bentrok segment
      return (
        bookingStart <= newEnd &&
        bookingEnd >= newStart
      );

    }
  );
}


// ============================================================
// RENDER KURSI 14 SEAT
// ============================================================

function renderSeats(schedule) {

  if (!seatsEl) return;

  seatsEl.innerHTML = "";


  const title =
    document.createElement("div");

  title.style.textAlign =
    "center";

  title.style.marginBottom =
    "12px";

  title.innerHTML = `
    <strong>
      Pilih Kursi
    </strong>
  `;

  seatsEl.appendChild(title);


  // ==========================================================
  // Layout 14 kursi
  //
  // Depan
  // [1] [2] [3]
  //
  // [4]  AISLE  [5] [6]
  //
  // [7]  AISLE  [8] [9]
  //
  // [10][11][12][13]
  //
  // [14]
  // ==========================================================

  const layout = [
    [1, 2, 3],
    [4, null, 5, 6],
    [7, null, 8, 9],
    [10, 11, 12, 13],
    [14]
  ];


  layout.forEach(row => {

    const rowEl =
      document.createElement("div");

    rowEl.style.display =
      "flex";

    rowEl.style.justifyContent =
      "center";

    rowEl.style.alignItems =
      "center";

    rowEl.style.gap =
      "8px";

    rowEl.style.marginBottom =
      "8px";


    row.forEach(number => {

      // AISLE
      if (number === null) {

        const aisle =
          document.createElement("div");

        aisle.style.width =
          "25px";

        rowEl.appendChild(
          aisle
        );

        return;
      }


      const seat =
        document.createElement("button");

      seat.type = "button";

      seat.className =
        "seat";

      seat.textContent =
        number;


      const occupied =
        isSeatOccupied(
          number,
          schedule
        );


      if (occupied) {

        seat.disabled = true;

        seat.classList.add(
          "booked"
        );

        seat.title =
          "Kursi sudah dipesan";

      }


      seat.addEventListener(
        "click",
        () => {

          if (occupied) {
            return;
          }


          document
            .querySelectorAll(
              ".seat"
            )
            .forEach(
              s =>
                s.classList.remove(
                  "selected"
                )
            );


          seat.classList.add(
            "selected"
          );


          selectedSeat =
            number;

        }
      );


      rowEl.appendChild(
        seat
      );

    });


    seatsEl.appendChild(
      rowEl
    );

  });


  // INFO SEGMENT

  const info =
    document.createElement("div");

  info.style.textAlign =
    "center";

  info.style.marginTop =
    "15px";

  info.style.fontSize =
    "13px";

  info.innerHTML = `
    Rute:
    <b>
      ${schedule.displayRoute}
    </b>
    <br>
    Harga:
    <b>
      ${rupiah(schedule.displayPrice)}
    </b>
  `;

  seatsEl.appendChild(info);
}


// ============================================================
// LOAD KURSI
// ============================================================

async function loadSeats(schedule) {

  if (!seatsEl) return;

  seatsEl.innerHTML = `
    <div style="
      padding:15px;
      text-align:center;
    ">
      Memuat kursi...
    </div>
  `;


  try {

    currentBookings =
      await fetchBookings(
        schedule.id
      );


    renderSeats(
      schedule
    );

  }

  catch (error) {

    console.error(
      "BOOKING LOAD ERROR:",
      error
    );


    seatsEl.innerHTML = `
      <div style="
        padding:15px;
        color:#b00020;
      ">
        Gagal memuat kursi.
        <br><br>
        ${error.message}
      </div>
    `;

  }
}


// ============================================================
// GENERATE BOOKING CODE
// ============================================================

function generateBookingCode() {

  const now =
    Date.now()
      .toString()
      .slice(-8);

  const random =
    Math.floor(
      Math.random() * 900
    ) + 100;

  return `HSM-${now}-${random}`;
}


// ============================================================
// BOOK TICKET
// ============================================================

async function createBooking() {

  if (!selectedSchedule) {

    alert(
      "Pilih jadwal terlebih dahulu."
    );

    return;

  }


  if (!selectedSeat) {

    alert(
      "Pilih kursi terlebih dahulu."
    );

    return;

  }


  const passengerName =
    nameEl
      ? nameEl.value.trim()
      : "";


  const phone =
    phoneEl
      ? phoneEl.value.trim()
      : "";


  if (!passengerName) {

    alert(
      "Masukkan nama penumpang."
    );

    if (nameEl) {
      nameEl.focus();
    }

    return;

  }


  if (!phone) {

    alert(
      "Masukkan nomor WhatsApp."
    );

    if (phoneEl) {
      phoneEl.focus();
    }

    return;

  }


  // ==========================================================
  // CEK ULANG KURSI SEBELUM INSERT
  // ==========================================================

  try {

    currentBookings =
      await fetchBookings(
        selectedSchedule.id
      );


    if (
      isSeatOccupied(
        selectedSeat,
        selectedSchedule
      )
    ) {

      alert(
        "Maaf, kursi tersebut baru saja dipesan."
      );

      await loadSeats(
        selectedSchedule
      );

      return;

    }

  }

  catch (error) {

    alert(
      "Gagal mengecek kursi: " +
      error.message
    );

    return;

  }


  // ==========================================================
  // DISABLE BUTTON
  // ==========================================================

  if (bookBtn) {

    bookBtn.disabled =
      true;

    bookBtn.textContent =
      "Memproses...";

  }


  const bookingCode =
    generateBookingCode();


  // ==========================================================
  // INSERT BOOKING
  // ==========================================================

  const bookingData = {

    booking_code:
      bookingCode,

    schedule_id:
      selectedSchedule.id,

    passenger_name:
      passengerName,

    phone:
      phone,

    seat_number:
      selectedSeat,

    total:
      selectedSchedule.displayPrice,

    payment_status:
      "pending",

    trip_code:
      selectedSchedule.trip_code ||
      null,

    segment_start:
      selectedSchedule.segmentStart ||
      1,

    segment_end:
      selectedSchedule.segmentEnd ||
      2,

    origin:
      selectedSchedule.displayOrigin,

    destination:
      selectedSchedule.displayDestination

  };


  const {
    error
  } = await db
    .from("bookings")
    .insert(
      bookingData
    );


  if (error) {

    console.error(
      "BOOKING ERROR:",
      error
    );


    alert(
      "Booking gagal:\n" +
      error.message
    );


    if (bookBtn) {

      bookBtn.disabled =
        false;

      bookBtn.textContent =
        "Pesan Sekarang";

    }

    return;

  }


  // ==========================================================
  // WHATSAPP
  // ==========================================================

  let adminNumber =
    HSM_CONFIG.WHATSAPP_ADMIN ||
    "";


  adminNumber =
    String(adminNumber)
      .replace(/\D/g, "");


  // Kalau config masih 0812...
  if (
    adminNumber.startsWith("0")
  ) {

    adminNumber =
      "62" +
      adminNumber.substring(1);

  }


  const date =
    dateEl
      ? dateEl.value
      : "";


  const message = `
Halo HSM Transport 👋

Saya ingin memesan tiket.

Kode Booking: ${bookingCode}

Nama: ${passengerName}
No. WhatsApp: ${phone}

Rute: ${selectedSchedule.displayRoute}
Tanggal: ${date}
Jam: ${selectedSchedule.displayTime}
Kendaraan: ${normalizeVehicle(selectedSchedule.vehicle)}
Kursi: ${selectedSeat}

Total: ${rupiah(selectedSchedule.displayPrice)}

Mohon konfirmasi booking saya.
  `.trim();


  const whatsappURL =
    "https://wa.me/" +
    adminNumber +
    "?text=" +
    encodeURIComponent(
      message
    );


  // ==========================================================
  // HASIL BOOKING
  // ==========================================================

  if (resultEl) {

    resultEl.innerHTML = `
      <div style="
        padding:18px;
        margin-top:15px;
        border-radius:10px;
        background:#e8f5e9;
      ">

        <strong>
          Booking berhasil! ✅
        </strong>

        <br><br>

        Kode Booking:
        <b>
          ${bookingCode}
        </b>

        <br>

        Rute:
        <b>
          ${selectedSchedule.displayRoute}
        </b>

        <br>

        Tanggal:
        <b>
          ${date}
        </b>

        <br>

        Jam:
        <b>
          ${selectedSchedule.displayTime}
        </b>

        <br>

        Kursi:
        <b>
          ${selectedSeat}
        </b>

        <br>

        Total:
        <b>
          ${rupiah(selectedSchedule.displayPrice)}
        </b>

        <br><br>

        <a
          href="${whatsappURL}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            display:inline-block;
            padding:12px 18px;
            border-radius:8px;
            background:#25D366;
            color:white;
            text-decoration:none;
            font-weight:bold;
          "
        >
          Konfirmasi via WhatsApp
        </a>

      </div>
    `;

  }


  // ==========================================================
  // REFRESH KURSI
  // ==========================================================

  await loadSeats(
    selectedSchedule
  );


  if (bookBtn) {

    bookBtn.disabled =
      false;

    bookBtn.textContent =
      "Pesan Sekarang";

  }

}


// ============================================================
// EVENT BOOK
// ============================================================

if (bookBtn) {

  bookBtn.addEventListener(
    "click",
    createBooking
  );

}


// ============================================================
// EVENT DATE
// ============================================================

if (dateEl) {

  dateEl.addEventListener(
    "change",
    () => {

      selectedSchedule =
        null;

      selectedSeat =
        null;

      loadSchedules();

    }
  );

}


// ============================================================
// INITIAL DATE
// ============================================================

if (dateEl && !dateEl.value) {

  dateEl.value =
    getLocalDate();

}


// ============================================================
// INITIAL ROUTE
// ============================================================

const initialRoute =
  getSelectedRoute();

selectedOrigin =
  initialRoute.origin;

selectedDestination =
  initialRoute.destination;


if (fromEl) {
  fromEl.value =
    selectedOrigin;
}

if (toEl) {
  toEl.value =
    selectedDestination;
}


// ============================================================
// INITIAL LOAD
// ============================================================

loadSchedules();


// ============================================================
// AUTO REFRESH
// Setiap 30 detik untuk update kursi/jadwal
// ============================================================

setInterval(
  () => {

    loadSchedules();

  },
  30000
);
