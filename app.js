// ============================================================
// HSM TRANSPORT - APP.JS FINAL
// Layout Hiace: 14 kursi penumpang + 1 kursi kernet
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


      // LOLEO → WEDA
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


      // WEDA → LOLEO
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
    // FILTER ROUTE
    // ========================================================

    const services =
      allServices.filter(service => {

        return (
          service.displayOrigin.toLowerCase() ===
            route.origin.toLowerCase()
          &&
          service.displayDestination.toLowerCase() ===
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
    // TAMPILKAN JADWAL
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
              btn.classList.remove("active");
            });


          button.classList.add("active");


          selectedSchedule = service;
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
// AMBIL BOOKING
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
// STATUS BOOKING
// ============================================================

function getBookingStatus(booking) {

  const status =
    String(
      booking.payment_status || ""
    )
      .trim()
      .toLowerCase();


  // SUDAH DIBAYAR
  if (
    status === "paid" ||
    status === "lunas" ||
    status === "success" ||
    status === "settled" ||
    status === "sudah_dibayar"
  ) {
    return "paid";
  }


  // DIBATALKAN
  if (
    status === "cancelled" ||
    status === "canceled" ||
    status === "failed"
  ) {
    return "cancelled";
  }


  // DEFAULT = MENUNGGU PEMBAYARAN
  return "pending";
}


// ============================================================
// CEK STATUS KURSI
// ============================================================

function getSeatStatus(
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


  let seatStatus = "available";


  currentBookings.forEach(
    booking => {

      if (
        Number(
          booking.seat_number
        ) !== Number(seatNumber)
      ) {
        return;
      }


      const bookingStatus =
        getBookingStatus(
          booking
        );


      if (
        bookingStatus ===
        "cancelled"
      ) {
        return;
      }


      const bookingStart =
        Number(
          booking.segment_start || 1
        );

      const bookingEnd =
        Number(
          booking.segment_end || 2
        );


      // CEK BENTROK SEGMENT
      const overlap =
        bookingStart <= newEnd &&
        bookingEnd >= newStart;


      if (!overlap) {
        return;
      }


      // PAID LEBIH KUAT DARI PENDING
      if (
        bookingStatus ===
        "paid"
      ) {

        seatStatus =
          "paid";

      }
      else if (
        bookingStatus ===
          "pending" &&
        seatStatus !==
          "paid"
      ) {

        seatStatus =
          "pending";

      }

    }
  );


  return seatStatus;
}


// ============================================================
// BUAT KURSI
// ============================================================

function createSeat(
  number,
  schedule
) {

  const seat =
    document.createElement(
      "button"
    );


  seat.type = "button";

  seat.className = "seat";

  seat.textContent = number;


  seat.style.width = "48px";
  seat.style.height = "48px";
  seat.style.border = "none";
  seat.style.borderRadius = "8px";
  seat.style.fontWeight = "bold";
  seat.style.fontSize = "15px";
  seat.style.cursor = "pointer";
  seat.style.color = "#fff";
  seat.style.flexShrink = "0";


  const status =
    getSeatStatus(
      number,
      schedule
    );


  // ==========================================================
  // TERSEDIA
  // ==========================================================

  if (
    status ===
    "available"
  ) {

    seat.style.background =
      "#22c55e";

    seat.title =
      `Kursi ${number} tersedia`;


    seat.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".seat-passenger"
          )
          .forEach(
            s => {
              s.style.outline =
                "none";
            }
          );


        seat.style.outline =
          "3px solid #111";


        selectedSeat =
          number;

      }
    );

  }


  // ==========================================================
  // MENUNGGU PEMBAYARAN
  // ==========================================================

  else if (
    status ===
    "pending"
  ) {

    seat.style.background =
      "#facc15";

    seat.style.color =
      "#111";

    seat.disabled =
      true;

    seat.title =
      `Kursi ${number} menunggu pembayaran`;

  }


  // ==========================================================
  // SUDAH DIBAYAR
  // ==========================================================

  else if (
    status ===
    "paid"
  ) {

    seat.style.background =
      "#ef4444";

    seat.disabled =
      true;

    seat.title =
      `Kursi ${number} sudah dibayar`;

  }


  seat.dataset.status =
    status;

  seat.dataset.seat =
    number;

  seat.classList.add(
    "seat-passenger"
  );


  return seat;
}


// ============================================================
// KURSI KERNET
// ============================================================

function createKernetSeat() {

  const kernet =
    document.createElement(
      "div"
    );


  kernet.style.width =
    "48px";

  kernet.style.height =
    "48px";

  kernet.style.borderRadius =
    "8px";

  kernet.style.background =
    "#111";

  kernet.style.color =
    "#fff";

  kernet.style.display =
    "flex";

  kernet.style.alignItems =
    "center";

  kernet.style.justifyContent =
    "center";

  kernet.style.fontSize =
    "10px";

  kernet.style.fontWeight =
    "bold";

  kernet.style.textAlign =
    "center";

  kernet.style.lineHeight =
    "12px";

  kernet.style.flexShrink =
    "0";

  kernet.textContent =
    "KERNET";


  kernet.title =
    "Kursi khusus kernet";


  return kernet;
}


// ============================================================
// PEMBATAS / LORONG
// ============================================================

function createAisle(
  width = 32
) {

  const aisle =
    document.createElement(
      "div"
    );


  aisle.style.width =
    `${width}px`;

  aisle.style.height =
    "48px";

  aisle.style.flexShrink =
    "0";


  return aisle;
}


// ============================================================
// ROW LAYOUT
// ============================================================

function createSeatRow(
  items
) {

  const row =
    document.createElement(
      "div"
    );


  row.style.display =
    "flex";

  row.style.alignItems =
    "center";

  row.style.justifyContent =
    "center";

  row.style.gap =
    "7px";

  row.style.marginBottom =
    "9px";

  row.style.minHeight =
    "48px";


  items.forEach(item => {

    if (
      item ===
      "AISLE"
    ) {

      row.appendChild(
        createAisle()
      );

      return;
    }


    if (
      item ===
      "KERNET"
    ) {

      row.appendChild(
        createKernetSeat()
      );

      return;
    }


    if (
      typeof item ===
      "number"
    ) {

      row.appendChild(
        createSeat(
          item,
          selectedSchedule
        )
      );

    }

  });


  return row;
}


// ============================================================
// RENDER KURSI
// ============================================================

function renderSeats(schedule) {

  if (!seatsEl) return;


  seatsEl.innerHTML =
    "";


  // ==========================================================
  // JUDUL
  // ==========================================================

  const title =
    document.createElement(
      "div"
    );


  title.style.textAlign =
    "center";

  title.style.marginBottom =
    "10px";


  title.innerHTML = `
    <strong>
      Pilih Kursi
    </strong>
  `;


  seatsEl.appendChild(
    title
  );


  // ==========================================================
  // LABEL DEPAN
  // ==========================================================

  const front =
    document.createElement(
      "div"
    );


  front.style.textAlign =
    "center";

  front.style.fontSize =
    "12px";

  front.style.fontWeight =
    "bold";

  front.style.marginBottom =
    "7px";

  front.style.opacity =
    "0.7";


  front.textContent =
    "DEPAN / KABIN SUPIR";


  seatsEl.appendChild(
    front
  );


  // ==========================================================
  // ROW 1
  //
  // (1) (2)       (SUPIR)
  //
  // Posisi supir hanya sebagai label.
  // Tidak bisa dibooking.
  // ==========================================================

  const row1 =
    document.createElement(
      "div"
    );


  row1.style.display =
    "flex";

  row1.style.alignItems =
    "center";

  row1.style.justifyContent =
    "center";

  row1.style.gap =
    "7px";

  row1.style.marginBottom =
    "9px";


  row1.appendChild(
    createSeat(
      1,
      schedule
    )
  );

  row1.appendChild(
    createSeat(
      2,
      schedule
    )
  );

  row1.appendChild(
    createAisle(
      32
    )
  );


  const driver =
    document.createElement(
      "div"
    );


  driver.style.width =
    "48px";

  driver.style.height =
    "48px";

  driver.style.borderRadius =
    "8px";

  driver.style.background =
    "#374151";

  driver.style.color =
    "#fff";

  driver.style.display =
    "flex";

  driver.style.alignItems =
    "center";

  driver.style.justifyContent =
    "center";

  driver.style.fontSize =
    "9px";

  driver.style.fontWeight =
    "bold";

  driver.textContent =
    "SUPIR";


  row1.appendChild(
    driver
  );


  seatsEl.appendChild(
    row1
  );


  // ==========================================================
  // PINTU SLIDING
  // ==========================================================

  const sliding =
    document.createElement(
      "div"
    );


  sliding.style.textAlign =
    "center";

  sliding.style.fontSize =
    "10px";

  sliding.style.opacity =
    "0.6";

  sliding.style.margin =
    "2px 0 8px";


  sliding.textContent =
    "PINTU SLIDING";


  seatsEl.appendChild(
    sliding
  );


  // ==========================================================
  // ROW 2
  //
  // KERNET    (3) (4) (5)
  //
  // ==========================================================

  const row2 =
    document.createElement(
      "div"
    );


  row2.style.display =
    "flex";

  row2.style.alignItems =
    "center";

  row2.style.justifyContent =
    "center";

  row2.style.gap =
    "7px";

  row2.style.marginBottom =
    "9px";


  row2.appendChild(
    createKernetSeat()
  );


  row2.appendChild(
    createAisle(
      32
    )
  );


  row2.appendChild(
    createSeat(
      3,
      schedule
    )
  );

  row2.appendChild(
    createSeat(
      4,
      schedule
    )
  );

  row2.appendChild(
    createSeat(
      5,
      schedule
    )
  );


  seatsEl.appendChild(
    row2
  );


  // ==========================================================
  // ROW 3
  //
  //            (6) (7)
  //
  // ==========================================================

  const row3 =
    createSeatRow([
      "KERNET",
      "AISLE",
      6,
      7
    ]);


  // Hapus KERNET kedua karena row ini hanya
  // untuk kursi 6 dan 7.
  row3.innerHTML =
    "";


  row3.appendChild(
    createKernetSeat()
  );

  row3.appendChild(
    createAisle(
      32
    )
  );

  row3.appendChild(
    createSeat(
      6,
      schedule
    )
  );

  row3.appendChild(
    createSeat(
      7,
      schedule
    )
  );


  seatsEl.appendChild(
    row3
  );


  // ==========================================================
  // ROW 4
  //
  // (8)       (9) (10)
  //
  // 8 TEPAT DI BELAKANG KERNET
  // ==========================================================

  const row4 =
    document.createElement(
      "div"
    );


  row4.style.display =
    "flex";

  row4.style.alignItems =
    "center";

  row4.style.justifyContent =
    "center";

  row4.style.gap =
    "7px";

  row4.style.marginBottom =
    "9px";


  row4.appendChild(
    createSeat(
      8,
      schedule
    )
  );


  row4.appendChild(
    createAisle(
      32
    )
  );


  row4.appendChild(
    createSeat(
      9,
      schedule
    )
  );

  row4.appendChild(
    createSeat(
      10,
      schedule
    )
  );


  seatsEl.appendChild(
    row4
  );


  // ==========================================================
  // ROW 5
  //
  // (11) (12) (13) (14)
  //
  // ==========================================================

  const row5 =
    document.createElement(
      "div"
    );


  row5.style.display =
    "flex";

  row5.style.alignItems =
    "center";

  row5.style.justifyContent =
    "center";

  row5.style.gap =
    "7px";

  row5.style.marginBottom =
    "12px";


  [11, 12, 13, 14]
    .forEach(number => {

      row5.appendChild(
        createSeat(
          number,
          schedule
        )
      );

    });


  seatsEl.appendChild(
    row5
  );


  // ==========================================================
  // BELAKANG
  // ==========================================================

  const back =
    document.createElement(
      "div"
    );


  back.style.textAlign =
    "center";

  back.style.fontSize =
    "11px";

  back.style.opacity =
    "0.6";

  back.style.marginTop =
    "3px";


  back.textContent =
    "BELAKANG";


  seatsEl.appendChild(
    back
  );


  // ==========================================================
  // LEGENDA WARNA
  // ==========================================================

  const legend =
    document.createElement(
      "div"
    );


  legend.style.display =
    "flex";

  legend.style.justifyContent =
    "center";

  legend.style.flexWrap =
    "wrap";

  legend.style.gap =
    "12px";

  legend.style.marginTop =
    "18px";

  legend.style.fontSize =
    "12px";


  legend.innerHTML = `

    <span>
      <span style="
        display:inline-block;
        width:15px;
        height:15px;
        background:#22c55e;
        border-radius:4px;
        vertical-align:middle;
        margin-right:4px;
      "></span>
      Tersedia
    </span>

    <span>
      <span style="
        display:inline-block;
        width:15px;
        height:15px;
        background:#facc15;
        border-radius:4px;
        vertical-align:middle;
        margin-right:4px;
      "></span>
      Menunggu pembayaran
    </span>

    <span>
      <span style="
        display:inline-block;
        width:15px;
        height:15px;
        background:#ef4444;
        border-radius:4px;
        vertical-align:middle;
        margin-right:4px;
      "></span>
      Sudah dibayar
    </span>

    <span>
      <span style="
        display:inline-block;
        width:15px;
        height:15px;
        background:#111;
        border-radius:4px;
        vertical-align:middle;
        margin-right:4px;
      "></span>
      Kernet
    </span>

  `;


  seatsEl.appendChild(
    legend
  );


  // ==========================================================
  // INFO
  // ==========================================================

  const info =
    document.createElement(
      "div"
    );


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


  seatsEl.appendChild(
    info
  );
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
  // CEK ULANG KURSI
  // ==========================================================

  try {

    currentBookings =
      await fetchBookings(
        selectedSchedule.id
      );


    const seatStatus =
      getSeatStatus(
        selectedSeat,
        selectedSchedule
      );


    if (
      seatStatus !==
      "available"
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

Status: Menunggu pembayaran.

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
        background:#fff3cd;
      ">

        <strong>
          Booking berhasil! 🟡
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

        Status:
        <b>
          Menunggu pembayaran
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

if (
  dateEl &&
  !dateEl.value
) {

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
// ============================================================

setInterval(
  () => {

    loadSchedules();

  },
  30000
);
