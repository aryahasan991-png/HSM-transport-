// ============================================================
// HSM TRANSPORT - APP.JS
//
// RUTE AKTIF:
//
// ARAH LELILEF:
// Sofifi -> Weda
// Sofifi -> Lelilef
// Loleo  -> Weda
// Loleo  -> Lelilef
// Weda   -> Lelilef
//
// ARAH SOFIFI:
// Lelilef -> Weda
// Lelilef -> Loleo
// Lelilef -> Sofifi
// Weda    -> Loleo
// Weda    -> Sofifi
//
// Sofifi <-> Loleo TIDAK dijual sebagai tiket tersendiri.
//
// URUTAN PERJALANAN:
// Sofifi -> Loleo -> Weda -> Lelilef
// Lelilef -> Weda -> Loleo -> Sofifi
//
// MULTI BOOKING:
// - Bisa memilih lebih dari 1 kursi.
// - Setiap kursi mempunyai nama + WhatsApp sendiri.
// - Setiap penumpang mendapatkan kode booking berbeda.
// - Setiap booking disimpan sebagai baris terpisah.
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
// ELEMENT
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
// STATE
// ============================================================

let schedules = [];

let selectedSchedule = null;

let selectedSeats = [];

let selectedOrigin = "";
let selectedDestination = "";

let currentBookings = [];

let isProcessingBooking = false;


// ============================================================
// RUTE YANG DIIZINKAN
// ============================================================

const HSM_DESTINATIONS = {

  Sofifi: [
    "Weda",
    "Lelilef"
  ],

  Loleo: [
    "Weda",
    "Lelilef"
  ],

  Weda: [
    "Loleo",
    "Sofifi",
    "Lelilef"
  ],

  Lelilef: [
    "Weda",
    "Loleo",
    "Sofifi"
  ]

};


// ============================================================
// RUPIAH
// ============================================================

function rupiah(value) {

  return "Rp" +
    Number(value || 0)
      .toLocaleString("id-ID");

}


// ============================================================
// TANGGAL WIT
// ============================================================

function getLocalDate() {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Jayapura",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(
      new Date()
    );


  const values =
    Object.fromEntries(
      parts.map(
        part => [
          part.type,
          part.value
        ]
      )
    );


  return (
    `${values.year}-${values.month}-${values.day}`
  );

}


// ============================================================
// WAKTU WIT
// ============================================================

function getCurrentWIT() {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Jayapura",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }
    ).formatToParts(
      new Date()
    );


  const values =
    Object.fromEntries(
      parts.map(
        part => [
          part.type,
          part.value
        ]
      )
    );


  return {

    date:
      `${values.year}-${values.month}-${values.day}`,

    hour:
      Number(values.hour),

    minute:
      Number(values.minute)

  };

}


// ============================================================
// JAM KE MENIT
// ============================================================

function timeToMinutes(time) {

  if (!time) {
    return 0;
  }


  const parts =
    String(time)
      .substring(0, 5)
      .split(":");


  return (
    Number(parts[0] || 0) * 60 +
    Number(parts[1] || 0)
  );

}


// ============================================================
// CEK JADWAL LEWAT
// ============================================================

function isDeparturePassed(
  travelDate,
  departureTime
) {

  if (
    !travelDate ||
    !departureTime
  ) {
    return false;
  }


  const now =
    getCurrentWIT();


  const date =
    String(travelDate)
      .substring(0, 10);


  if (
    date < now.date
  ) {
    return true;
  }


  if (
    date > now.date
  ) {
    return false;
  }


  const currentMinutes =
    now.hour * 60 +
    now.minute;


  return (
    currentMinutes >=
    timeToMinutes(
      departureTime
    )
  );

}


// ============================================================
// NORMALIZE ROUTE
// ============================================================

function normalizeRoute(route) {

  if (!route) {
    return "";
  }


  return String(route)
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "→")
    .replace(/–/g, "→")
    .replace(/>/g, "→");

}


// ============================================================
// FORMAT TIME
// ============================================================

function formatTime(time) {

  if (!time) {
    return "";
  }


  return String(time)
    .substring(0, 5);

}


// ============================================================
// VEHICLE
// ============================================================

function normalizeVehicle(vehicle) {

  if (
    vehicle === null ||
    vehicle === undefined
  ) {
    return "";
  }


  const value =
    String(vehicle)
      .trim()
      .toUpperCase();


  if (
    value === "HSM-01" ||
    value === "HSM01" ||
    value === "01" ||
    value === "1"
  ) {
    return "HSM-01";
  }


  if (
    value === "HSM-02" ||
    value === "HSM02" ||
    value === "02" ||
    value === "2"
  ) {
    return "HSM-02";
  }


  return value;

}


// ============================================================
// RESOLVE VEHICLE
// ============================================================

function resolveVehicle(
  row,
  direction = ""
) {

  const dbVehicle =
    normalizeVehicle(
      row?.vehicle
    );


  if (dbVehicle) {
    return dbVehicle;
  }


  const time =
    formatTime(
      row?.departure_time
    );


  // ARAH SOFIFI -> LELILEF

  if (
    direction === "forward"
  ) {

    if (
      time === "09:00"
    ) {
      return "HSM-01";
    }


    if (
      time === "13:00"
    ) {
      return "HSM-02";
    }

  }


  // ARAH LELILEF -> SOFIFI

  if (
    direction === "reverse"
  ) {

    if (
      time === "09:00"
    ) {
      return "HSM-02";
    }


    if (
      time === "13:00"
    ) {
      return "HSM-01";
    }

  }


  return "";

}


// ============================================================
// BOOKING STATUS
// ============================================================

function getBookingStatus(
  booking
) {

  const status =
    String(
      booking?.payment_status ||
      booking?.status ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    status === "paid" ||
    status === "lunas" ||
    status === "success" ||
    status === "settled" ||
    status === "sudah_dibayar"
  ) {
    return "paid";
  }


  if (
    status === "completed" ||
    status === "selesai"
  ) {
    return "completed";
  }


  if (
    status === "cancelled" ||
    status === "canceled" ||
    status === "dibatalkan" ||
    status === "failed" ||
    status === "gagal"
  ) {
    return "cancelled";
  }


  return "pending";

}


// ============================================================
// DESTINATION OPTIONS
// ============================================================

function updateDestinationOptions(
  keepCurrent = true
) {

  if (
    !fromEl ||
    !toEl
  ) {
    return;
  }


  const origin =
    String(
      fromEl.value || ""
    ).trim();


  const oldDestination =
    String(
      toEl.value || ""
    ).trim();


  const destinations =
    HSM_DESTINATIONS[origin] ||
    [];


  toEl.innerHTML = "";


  const placeholder =
    document.createElement(
      "option"
    );


  placeholder.value = "";


  placeholder.textContent =
    origin
      ? "Pilih tujuan"
      : "Pilih lokasi dahulu";


  toEl.appendChild(
    placeholder
  );


  if (!origin) {

    toEl.disabled =
      true;


    selectedOrigin =
      "";


    selectedDestination =
      "";


    return;

  }


  destinations.forEach(
    destination => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        destination;


      option.textContent =
        destination;


      toEl.appendChild(
        option
      );

    }
  );


  toEl.disabled =
    destinations.length === 0;


  if (
    keepCurrent &&
    destinations.includes(
      oldDestination
    )
  ) {

    toEl.value =
      oldDestination;

  } else {

    toEl.value =
      "";

  }


  selectedOrigin =
    origin;


  selectedDestination =
    toEl.value || "";

}


// ============================================================
// GET ROUTE
// ============================================================

function getSelectedRoute() {

  return {

    origin:
      fromEl
        ? String(
            fromEl.value || ""
          ).trim()
        : "",


    destination:
      toEl
        ? String(
            toEl.value || ""
          ).trim()
        : ""

  };

}


// ============================================================
// PASSENGER FORM CONTAINER
// ============================================================

function getPassengerContainer() {

  let container =
    document.getElementById(
      "passengerForms"
    );


  if (container) {
    return container;
  }


  container =
    document.createElement(
      "div"
    );


  container.id =
    "passengerForms";


  const reference =
    nameEl
      ? nameEl.closest(
          ".form-group"
        )
      : null;


  const phoneGroup =
    phoneEl
      ? phoneEl.closest(
          ".form-group"
        )
      : null;


  if (
    reference &&
    reference.parentNode
  ) {

    reference.parentNode.insertBefore(
      container,
      reference
    );


    reference.style.display =
      "none";


    if (phoneGroup) {
      phoneGroup.style.display =
        "none";
    }

  } else if (
    bookBtn &&
    bookBtn.parentNode
  ) {

    bookBtn.parentNode.insertBefore(
      container,
      bookBtn
    );

  }


  return container;

}


// ============================================================
// RESET PASSENGER FORMS
// ============================================================

function resetPassengerForms() {

  const container =
    getPassengerContainer();


  if (container) {

    container.innerHTML = `
      <div
        style="
          padding:15px;
          margin-bottom:18px;
          text-align:center;
          border:1px solid #dce5f0;
          border-radius:12px;
          background:#f8fbff;
          color:#687386;
          font-size:13px;
        "
      >
        Pilih kursi untuk mengisi data penumpang.
      </div>
    `;

  }

}


// ============================================================
// RENDER PASSENGER FORMS
// ============================================================

function renderPassengerForms() {

  const container =
    getPassengerContainer();


  if (!container) {
    return;
  }


  const previousValues =
    {};


  container
    .querySelectorAll(
      ".passenger-data"
    )
    .forEach(
      block => {

        const seat =
          block.dataset.seat;


        const name =
          block.querySelector(
            ".passenger-name"
          );


        const phone =
          block.querySelector(
            ".passenger-phone"
          );


        previousValues[seat] = {

          name:
            name
              ? name.value
              : "",

          phone:
            phone
              ? phone.value
              : ""

        };

      }
    );


  container.innerHTML =
    "";


  if (
    selectedSeats.length === 0
  ) {

    resetPassengerForms();

    return;

  }


  const heading =
    document.createElement(
      "div"
    );


  heading.style.marginBottom =
    "12px";


  heading.innerHTML = `
    <strong
      style="
        font-size:14px;
      "
    >
      Data Penumpang
    </strong>

    <div
      style="
        margin-top:4px;
        color:#687386;
        font-size:12px;
        line-height:1.5;
      "
    >
      Isi nama dan nomor WhatsApp untuk setiap kursi yang dipilih.
    </div>
  `;


  container.appendChild(
    heading
  );


  const sortedSeats =
    [...selectedSeats]
      .sort(
        (a, b) => a - b
      );


  sortedSeats.forEach(
    seatNumber => {

      const saved =
        previousValues[
          String(seatNumber)
        ] || {};


      const block =
        document.createElement(
          "div"
        );


      block.className =
        "passenger-data";


      block.dataset.seat =
        String(seatNumber);


      block.style.padding =
        "16px";


      block.style.marginBottom =
        "14px";


      block.style.border =
        "1px solid #dce5f0";


      block.style.borderRadius =
        "14px";


      block.style.background =
        "#f8fbff";


      block.innerHTML = `

        <div
          style="
            margin-bottom:13px;
            color:#0754a6;
            font-size:15px;
            font-weight:900;
          "
        >
          Penumpang Kursi ${seatNumber}
        </div>


        <div
          class="form-group"
          style="
            margin-bottom:14px;
          "
        >

          <label>
            Nama Penumpang
          </label>

          <input
            type="text"
            class="input passenger-name"
            data-seat="${seatNumber}"
            placeholder="Masukkan nama penumpang"
            autocomplete="name"
          >

        </div>


        <div
          class="form-group"
          style="
            margin-bottom:0;
          "
        >

          <label>
            Nomor WhatsApp
          </label>

          <input
            type="tel"
            class="input passenger-phone"
            data-seat="${seatNumber}"
            placeholder="Contoh: 081234567890"
            autocomplete="tel"
            inputmode="numeric"
            minlength="10"
            maxlength="15"
          >

        </div>

      `;


      container.appendChild(
        block
      );


      const newName =
        block.querySelector(
          ".passenger-name"
        );


      const newPhone =
        block.querySelector(
          ".passenger-phone"
        );


      if (newName) {
        newName.value =
          saved.name || "";
      }


      if (newPhone) {
        newPhone.value =
          saved.phone || "";
      }

    }
  );


  const totalBox =
    document.createElement(
      "div"
    );


  totalBox.style.padding =
    "14px 16px";


  totalBox.style.marginBottom =
    "20px";


  totalBox.style.border =
    "1px solid #dce5f0";


  totalBox.style.borderRadius =
    "12px";


  totalBox.style.background =
    "#f6faff";


  const total =
    selectedSchedule
      ? (
          Number(
            selectedSchedule.displayPrice
          ) *
          selectedSeats.length
        )
      : 0;


  totalBox.innerHTML = `
    <div
      style="
        display:flex;
        justify-content:space-between;
        gap:10px;
        font-size:13px;
      "
    >
      <span>
        ${selectedSeats.length} kursi dipilih
      </span>

      <strong
        style="
          color:#063d79;
        "
      >
        Total ${rupiah(total)}
      </strong>
    </div>
  `;


  container.appendChild(
    totalBox
  );

}


// ============================================================
// RESET
// ============================================================

function resetScheduleSelection() {

  selectedSchedule =
    null;


  selectedSeats =
    [];


  currentBookings =
    [];


  document
    .querySelectorAll(
      ".schedule-card, .scheduleBtn"
    )
    .forEach(
      button => {

        button.classList.remove(
          "selected",
          "active"
        );

      }
    );


  if (seatsEl) {

    seatsEl.innerHTML = `
      <div
        style="
          padding:15px;
          text-align:center;
        "
      >
        Pilih jadwal terlebih dahulu.
      </div>
    `;

  }


  resetPassengerForms();

}


// ============================================================
// ROUTE EVENTS
// ============================================================

if (fromEl) {

  fromEl.addEventListener(
    "change",
    () => {

      updateDestinationOptions(
        false
      );


      resetScheduleSelection();


      if (resultEl) {
        resultEl.innerHTML =
          "";
      }


      if (scheduleEl) {

        scheduleEl.innerHTML = `
          <div
            style="
              padding:15px;
              text-align:center;
            "
          >
            Pilih tujuan terlebih dahulu.
          </div>
        `;

      }

    }
  );

}


if (toEl) {

  toEl.addEventListener(
    "change",
    () => {

      selectedOrigin =
        fromEl
          ? fromEl.value
          : "";


      selectedDestination =
        toEl.value;


      resetScheduleSelection();


      if (resultEl) {
        resultEl.innerHTML =
          "";
      }


      if (
        selectedOrigin &&
        selectedDestination
      ) {
        loadSchedules();
      }

    }
  );

}


// ============================================================
// FETCH SCHEDULES
// ============================================================

async function fetchSchedules() {

  const {
    data,
    error
  } = await db
    .from("schedules")
    .select("*")
    .eq(
      "active",
      true
    )
    .order(
      "travel_date",
      {
        ascending: true
      }
    )
    .order(
      "departure_time",
      {
        ascending: true
      }
    );


  if (error) {
    throw error;
  }


  return data || [];

}


// ============================================================
// BUILD SERVICES
// ============================================================
//
// DATABASE LAMA TETAP DIPAKAI:
//
// Sofifi -> Weda
// dianggap perjalanan induk:
// Sofifi -> Loleo -> Weda -> Lelilef
//
// Weda -> Sofifi
// dianggap perjalanan induk:
// Lelilef -> Weda -> Loleo -> Sofifi
//
// ============================================================
//
// SEGMENT FORWARD:
//
// Sofifi  = 1
// Loleo   = 2
// Weda    = 3
// Lelilef = 4
//
// SEGMENT REVERSE:
//
// Lelilef = 1
// Weda    = 2
// Loleo   = 3
// Sofifi  = 4
//
// ============================================================

function buildServices(rows) {

  const services = [];


  function addService(
    row,
    origin,
    destination,
    displayTime,
    price,
    segmentStart,
    segmentEnd,
    serviceType,
    vehicle
  ) {

    services.push({

      ...row,

      displayOrigin:
        origin,

      displayDestination:
        destination,

      displayRoute:
        `${origin} → ${destination}`,

      displayTime:
        displayTime,

      displayPrice:
        price,

      segmentStart:
        segmentStart,

      segmentEnd:
        segmentEnd,

      serviceType:
        serviceType,

      displayVehicle:
        vehicle

    });

  }


  rows.forEach(
    row => {

      const route =
        normalizeRoute(
          row.route
        );


      const time =
        formatTime(
          row.departure_time
        );


      // ======================================================
      // FORWARD
      // SOFIFI -> LOLEO -> WEDA -> LELILEF
      // ======================================================

      if (
        route === "Sofifi→Weda" ||
        route === "Sofifi→Lelilef"
      ) {

        const vehicle =
          resolveVehicle(
            row,
            "forward"
          );


        let sofifiTime =
          time;


        let loleoTime =
          time;


        let wedaTime =
          time;


        if (
          time === "09:00"
        ) {

          sofifiTime =
            "09:00";

          loleoTime =
            "09:30";

          wedaTime =
            "11:30";

        }


        if (
          time === "13:00"
        ) {

          sofifiTime =
            "13:00";

          loleoTime =
            "13:30";

          wedaTime =
            "15:30";

        }


        // SOFIFI -> WEDA

        addService(
          row,
          "Sofifi",
          "Weda",
          sofifiTime,
          225000,
          1,
          3,
          "SOFIFI_WEDA",
          vehicle
        );


        // SOFIFI -> LELILEF

        addService(
          row,
          "Sofifi",
          "Lelilef",
          sofifiTime,
          300000,
          1,
          4,
          "SOFIFI_LELILEF",
          vehicle
        );


        // LOLEO -> WEDA

        addService(
          row,
          "Loleo",
          "Weda",
          loleoTime,
          200000,
          2,
          3,
          "LOLEO_WEDA",
          vehicle
        );


        // LOLEO -> LELILEF

        addService(
          row,
          "Loleo",
          "Lelilef",
          loleoTime,
          275000,
          2,
          4,
          "LOLEO_LELILEF",
          vehicle
        );


        // WEDA -> LELILEF

        addService(
          row,
          "Weda",
          "Lelilef",
          wedaTime,
          100000,
          3,
          4,
          "WEDA_LELILEF",
          vehicle
        );

      }


      // ======================================================
      // REVERSE
      // LELILEF -> WEDA -> LOLEO -> SOFIFI
      // ======================================================

      if (
        route === "Weda→Sofifi" ||
        route === "Lelilef→Sofifi"
      ) {

        const vehicle =
          resolveVehicle(
            row,
            "reverse"
          );


        let lelilefTime =
          time;


        let wedaTime =
          time;


        if (
          time === "09:00"
        ) {

          lelilefTime =
            "09:00";

          wedaTime =
            "09:45";

        }


        if (
          time === "13:00"
        ) {

          lelilefTime =
            "13:00";

          wedaTime =
            "13:45";

        }


        // LELILEF -> WEDA

        addService(
          row,
          "Lelilef",
          "Weda",
          lelilefTime,
          100000,
          1,
          2,
          "LELILEF_WEDA",
          vehicle
        );


        // LELILEF -> LOLEO

        addService(
          row,
          "Lelilef",
          "Loleo",
          lelilefTime,
          275000,
          1,
          3,
          "LELILEF_LOLEO",
          vehicle
        );


        // LELILEF -> SOFIFI

        addService(
          row,
          "Lelilef",
          "Sofifi",
          lelilefTime,
          300000,
          1,
          4,
          "LELILEF_SOFIFI",
          vehicle
        );


        // WEDA -> LOLEO

        addService(
          row,
          "Weda",
          "Loleo",
          wedaTime,
          200000,
          2,
          3,
          "WEDA_LOLEO",
          vehicle
        );


        // WEDA -> SOFIFI

        addService(
          row,
          "Weda",
          "Sofifi",
          wedaTime,
          225000,
          2,
          4,
          "WEDA_SOFIFI",
          vehicle
        );

      }

    }
  );


  return services;

}


// ============================================================
// FETCH BOOKINGS
// ============================================================

async function fetchBookings(
  scheduleId
) {

  try {

    const {
      data,
      error
    } = await db.rpc(
      "get_hsm_seat_statuses",
      {
        p_schedule_id:
          scheduleId
      }
    );


    if (
      !error &&
      Array.isArray(data)
    ) {
      return data;
    }


    if (error) {

      console.warn(
        "RPC seat gagal, memakai fallback:",
        error.message
      );

    }

  } catch (error) {

    console.warn(
      "RPC seat fallback:",
      error
    );

  }


  const {
    data,
    error
  } = await db
    .from("bookings")
    .select(`
      seat_number,
      payment_status,
      segment_start,
      segment_end
    `)
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
// SEAT STATUS
// ============================================================
//
// Segmen dianggap sebagai perjalanan ANTAR TITIK.
//
// Contoh:
//
// Sofifi -> Weda = 1 sampai 3
// Weda -> Lelilef = 3 sampai 4
//
// Kedua booking BOLEH memakai kursi yang sama,
// karena penumpang pertama turun di Weda
// sebelum penumpang berikutnya naik.
//
// Karena itu:
// bookingStart < newEnd
// bookingEnd   > newStart
//
// BUKAN <= dan >=
//
// ============================================================

function getSeatStatusFromBookings(
  seatNumber,
  schedule,
  bookingRows
) {

  const newStart =
    Number(
      schedule.segmentStart ||
      1
    );


  const newEnd =
    Number(
      schedule.segmentEnd ||
      1
    );


  let seatStatus =
    "available";


  (bookingRows || [])
    .forEach(
      booking => {

        if (
          Number(
            booking.seat_number
          ) !==
          Number(
            seatNumber
          )
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
            booking.segment_start ||
            1
          );


        const bookingEnd =
          Number(
            booking.segment_end ||
            bookingStart
          );


        const overlap =
          bookingStart < newEnd &&
          bookingEnd > newStart;


        if (!overlap) {
          return;
        }


        if (
          bookingStatus === "paid" ||
          bookingStatus === "completed"
        ) {

          seatStatus =
            "paid";

          return;

        }


        if (
          bookingStatus === "pending" &&
          seatStatus !== "paid"
        ) {

          seatStatus =
            "pending";

        }

      }
    );


  return seatStatus;

}


// ============================================================
// GET SEAT STATUS
// ============================================================

function getSeatStatus(
  seatNumber,
  schedule
) {

  return getSeatStatusFromBookings(
    seatNumber,
    schedule,
    currentBookings
  );

}


// ============================================================
// COUNT AVAILABLE
// ============================================================

function countAvailableSeats(
  schedule,
  bookingRows
) {

  let available =
    0;


  for (
    let seat = 1;
    seat <= 14;
    seat++
  ) {

    const status =
      getSeatStatusFromBookings(
        seat,
        schedule,
        bookingRows
      );


    if (
      status === "available"
    ) {
      available++;
    }

  }


  return available;

}


// ============================================================
// LOAD SCHEDULES
// ============================================================

async function loadSchedules() {

  if (!scheduleEl) {
    return;
  }


  const selectedDate =
    dateEl
      ? dateEl.value
      : getLocalDate();


  const route =
    getSelectedRoute();


  selectedOrigin =
    route.origin;


  selectedDestination =
    route.destination;


  if (!route.origin) {

    scheduleEl.innerHTML = `
      <div
        style="
          padding:15px;
          text-align:center;
        "
      >
        Pilih lokasi keberangkatan terlebih dahulu.
      </div>
    `;

    return;

  }


  if (!route.destination) {

    scheduleEl.innerHTML = `
      <div
        style="
          padding:15px;
          text-align:center;
        "
      >
        Pilih tujuan terlebih dahulu.
      </div>
    `;

    return;

  }


  if (!selectedDate) {

    scheduleEl.innerHTML = `
      <div
        style="
          padding:15px;
          text-align:center;
        "
      >
        Pilih tanggal keberangkatan terlebih dahulu.
      </div>
    `;

    return;

  }


  if (
    selectedDate <
    getLocalDate()
  ) {

    scheduleEl.innerHTML = `
      <div
        style="
          padding:15px;
          text-align:center;
          color:#dc2626;
        "
      >
        Tanggal keberangkatan sudah lewat.
      </div>
    `;

    return;

  }


  scheduleEl.innerHTML = `
    <div
      style="
        padding:15px;
        text-align:center;
      "
    >
      Memuat jadwal...
    </div>
  `;


  try {

    const rows =
      await fetchSchedules();


    schedules =
      rows;


    const dateRows =
      rows.filter(
        row => {

          const rowDate =
            row.travel_date
              ? String(
                  row.travel_date
                ).substring(
                  0,
                  10
                )
              : "";


          return (
            rowDate ===
            selectedDate
          );

        }
      );


    const allServices =
      buildServices(
        dateRows
      );


    const services =
      allServices.filter(
        service => {

          const originMatch =
            String(
              service.displayOrigin
            ).toLowerCase() ===
            String(
              route.origin
            ).toLowerCase();


          const destinationMatch =
            String(
              service.displayDestination
            ).toLowerCase() ===
            String(
              route.destination
            ).toLowerCase();


          const departurePassed =
            isDeparturePassed(
              selectedDate,
              service.displayTime
            );


          return (
            originMatch &&
            destinationMatch &&
            !departurePassed
          );

        }
      );


    // ========================================================
    // HAPUS DUPLIKAT
    // ========================================================

    const unique =
      [];


    const seen =
      new Set();


    services.forEach(
      service => {

        const key = [

          service.id,

          service.displayOrigin,

          service.displayDestination,

          service.displayTime,

          service.segmentStart,

          service.segmentEnd

        ].join("|");


        if (
          !seen.has(key)
        ) {

          seen.add(key);


          unique.push(
            service
          );

        }

      }
    );


    // ========================================================
    // TIDAK ADA JADWAL
    // ========================================================

    if (
      unique.length === 0
    ) {

      const today =
        selectedDate ===
        getLocalDate();


      scheduleEl.innerHTML = `
        <div
          style="
            padding:15px;
            text-align:center;
          "
        >

          ${
            today
              ? `
                Tidak ada jadwal keberangkatan berikutnya
                untuk
                <b>
                  ${route.origin} → ${route.destination}
                </b>
                hari ini.
              `
              : `
                Tidak ada jadwal tersedia untuk
                <b>
                  ${route.origin} → ${route.destination}
                </b>
                pada tanggal
                <b>
                  ${selectedDate}
                </b>.
              `
          }

        </div>
      `;


      return;

    }


    // ========================================================
    // SORT JAM
    // ========================================================

    unique.sort(
      (a, b) =>
        a.displayTime.localeCompare(
          b.displayTime
        )
    );


    // ========================================================
    // BOOKING CACHE
    // ========================================================

    const bookingCache =
      new Map();


    const scheduleIds = [
      ...new Set(
        unique.map(
          service =>
            String(
              service.id
            )
        )
      )
    ];


    await Promise.all(
      scheduleIds.map(
        async scheduleId => {

          try {

            const bookings =
              await fetchBookings(
                scheduleId
              );


            bookingCache.set(
              String(
                scheduleId
              ),
              bookings || []
            );

          } catch (error) {

            console.error(
              "AVAILABILITY ERROR:",
              error
            );


            bookingCache.set(
              String(
                scheduleId
              ),
              null
            );

          }

        }
      )
    );


    scheduleEl.innerHTML =
      "";


    // ========================================================
    // RENDER JADWAL
    // ========================================================

    unique.forEach(
      service => {

        const button =
          document.createElement(
            "button"
          );


        button.type =
          "button";


        button.className =
          "schedule-card scheduleBtn";


        const bookings =
          bookingCache.get(
            String(
              service.id
            )
          );


        let availableSeats =
          null;


        if (
          Array.isArray(
            bookings
          )
        ) {

          availableSeats =
            countAvailableSeats(
              service,
              bookings
            );

        }


        const isFull =
          availableSeats === 0;


        let availabilityHTML =
          "";


        if (
          availableSeats === null
        ) {

          availabilityHTML = `
            <span
              style="
                color:#687386;
                font-weight:800;
              "
            >
              Ketersediaan dicek saat memilih
            </span>
          `;

        } else if (
          isFull
        ) {

          availabilityHTML = `
            <span
              style="
                color:#dc2626;
                font-weight:900;
              "
            >
              🔴 FULL SEAT
            </span>
          `;

        } else {

          availabilityHTML = `
            <span
              style="
                color:#16a34a;
                font-weight:900;
              "
            >
              🟢 Tersedia ${availableSeats} kursi
            </span>
          `;

        }


        const vehicle =
          service.displayVehicle ||
          normalizeVehicle(
            service.vehicle
          ) ||
          "-";


        button.innerHTML = `

          <div
            class="schedule-time"
          >
            ${service.displayTime}
          </div>


          <div
            class="schedule-info"
          >

            <strong>
              ${service.displayRoute}
            </strong>

            <span>
              ${vehicle}
            </span>

            ${availabilityHTML}

            <span>
              ${rupiah(
                service.displayPrice
              )}
            </span>

          </div>

        `;


        if (isFull) {

          button.disabled =
            true;


          button.style.opacity =
            "0.62";


          button.style.cursor =
            "not-allowed";


          button.title =
            "Semua kursi pada rute ini sudah terisi";

        } else {

          button.addEventListener(
            "click",
            async () => {

              if (
                isDeparturePassed(
                  selectedDate,
                  service.displayTime
                )
              ) {

                alert(
                  "Jadwal ini sudah melewati waktu keberangkatan."
                );


                resetScheduleSelection();


                await loadSchedules();


                return;

              }


              document
                .querySelectorAll(
                  ".schedule-card"
                )
                .forEach(
                  btn => {

                    btn.classList.remove(
                      "selected"
                    );

                  }
                );


              button.classList.add(
                "selected"
              );


              selectedSchedule =
                service;


              selectedSeats =
                [];


              resetPassengerForms();


              if (resultEl) {
                resultEl.innerHTML =
                  "";
              }


              await loadSeats(
                service
              );

            }
          );

        }


        scheduleEl.appendChild(
          button
        );

      }
    );

  } catch (error) {

    console.error(
      "HSM LOAD ERROR:",
      error
    );


    scheduleEl.innerHTML = `
      <div
        style="
          padding:15px;
          color:#b00020;
        "
      >

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
// CREATE SEAT
// ============================================================

function createSeat(
  number,
  schedule
) {

  const seat =
    document.createElement(
      "button"
    );


  seat.type =
    "button";


  seat.className =
    "seat seat-passenger";


  seat.textContent =
    number;


  seat.dataset.seat =
    String(number);


  const status =
    getSeatStatus(
      number,
      schedule
    );


  seat.dataset.status =
    status;


  // ==========================================================
  // AVAILABLE
  // ==========================================================

  if (
    status === "available"
  ) {

    seat.classList.add(
      "available"
    );


    seat.title =
      `Kursi ${number} tersedia`;


    seat.addEventListener(
      "click",
      () => {

        const index =
          selectedSeats.indexOf(
            number
          );


        // BELUM DIPILIH

        if (
          index === -1
        ) {

          selectedSeats.push(
            number
          );


          seat.classList.add(
            "selected"
          );

        }

        // SUDAH DIPILIH

        else {

          selectedSeats.splice(
            index,
            1
          );


          seat.classList.remove(
            "selected"
          );

        }


        selectedSeats.sort(
          (a, b) => a - b
        );


        renderPassengerForms();

      }
    );

  }


  // ==========================================================
  // PENDING
  // ==========================================================

  else if (
    status === "pending"
  ) {

    seat.classList.add(
      "pending"
    );


    seat.disabled =
      true;


    seat.title =
      `Kursi ${number} menunggu pembayaran`;

  }


  // ==========================================================
  // PAID
  // ==========================================================

  else {

    seat.classList.add(
      "paid"
    );


    seat.disabled =
      true;


    seat.title =
      `Kursi ${number} sudah terisi`;

  }


  return seat;

}


// ============================================================
// FIXED BLOCK
// ============================================================

function createFixedBlock(
  label,
  background = "#111"
) {

  const block =
    document.createElement(
      "div"
    );


  block.style.width =
    "48px";

  block.style.height =
    "45px";

  block.style.boxSizing =
    "border-box";

  block.style.borderRadius =
    "9px";

  block.style.background =
    background;

  block.style.color =
    "#fff";

  block.style.display =
    "flex";

  block.style.alignItems =
    "center";

  block.style.justifyContent =
    "center";

  block.style.fontSize =
    "9px";

  block.style.fontWeight =
    "bold";

  block.style.textAlign =
    "center";

  block.style.lineHeight =
    "11px";


  block.textContent =
    label;


  block.title =
    label;


  return block;

}


// ============================================================
// AISLE
// ============================================================

function createAisle() {

  const aisle =
    document.createElement(
      "div"
    );


  aisle.style.width =
    "48px";

  aisle.style.height =
    "45px";


  return aisle;

}


// ============================================================
// SEAT ROW
// ============================================================

function createSeatRow(
  items,
  schedule
) {

  const row =
    document.createElement(
      "div"
    );


  row.style.display =
    "grid";


  row.style.gridTemplateColumns =
    "48px 48px 48px 48px";


  row.style.columnGap =
    "7px";


  row.style.width =
    "213px";


  row.style.margin =
    "0 auto 9px";


  row.style.minHeight =
    "45px";


  row.style.alignItems =
    "center";


  items.forEach(
    item => {

      if (
        item === "AISLE"
      ) {

        row.appendChild(
          createAisle()
        );

        return;

      }


      if (
        item === "KERNET"
      ) {

        row.appendChild(
          createFixedBlock(
            "KERNET",
            "#111"
          )
        );

        return;

      }


      if (
        item === "SLIDING"
      ) {

        row.appendChild(
          createFixedBlock(
            "PINTU",
            "#111"
          )
        );

        return;

      }


      if (
        item === "SUPIR"
      ) {

        row.appendChild(
          createFixedBlock(
            "SUPIR",
            "#374151"
          )
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
            schedule
          )
        );

      }

    }
  );


  return row;

}


// ============================================================
// RENDER SEATS
// ============================================================

function renderSeats(
  schedule
) {

  if (!seatsEl) {
    return;
  }


  seatsEl.innerHTML =
    "";


  const available =
    countAvailableSeats(
      schedule,
      currentBookings
    );


  // ==========================================================
  // AVAILABILITY
  // ==========================================================

  const availability =
    document.createElement(
      "div"
    );


  availability.style.textAlign =
    "center";

  availability.style.marginBottom =
    "14px";

  availability.style.fontWeight =
    "900";

  availability.style.fontSize =
    "13px";

  availability.style.color =
    available === 0
      ? "#dc2626"
      : "#16a34a";


  availability.innerHTML =
    available === 0
      ? "🔴 FULL SEAT"
      : `🟢 Tersedia ${available} kursi`;


  seatsEl.appendChild(
    availability
  );


  // ==========================================================
  // LEGEND
  // ==========================================================

  const legend =
    document.createElement(
      "div"
    );


  legend.className =
    "seatLegend";


  legend.innerHTML = `
    <span>
      <i class="legendAvailable"></i>
      Tersedia
    </span>

    <span>
      <i class="legendPending"></i>
      Menunggu pembayaran
    </span>

    <span>
      <i class="legendPaid"></i>
      Terisi / Lunas
    </span>
  `;


  seatsEl.appendChild(
    legend
  );


  // ==========================================================
  // DEPAN
  // ==========================================================

  const front =
    document.createElement(
      "div"
    );


  front.style.textAlign =
    "center";

  front.style.fontSize =
    "11px";

  front.style.fontWeight =
    "900";

  front.style.marginBottom =
    "10px";

  front.style.color =
    "#687386";


  front.textContent =
    "DEPAN";


  seatsEl.appendChild(
    front
  );


  // ==========================================================
  // LAYOUT HIACE
  // ==========================================================

  seatsEl.appendChild(
    createSeatRow(
      [
        1,
        2,
        "AISLE",
        "SUPIR"
      ],
      schedule
    )
  );


  seatsEl.appendChild(
    createSeatRow(
      [
        "SLIDING",
        3,
        4,
        5
      ],
      schedule
    )
  );


  seatsEl.appendChild(
    createSeatRow(
      [
        "KERNET",
        "AISLE",
        6,
        7
      ],
      schedule
    )
  );


  seatsEl.appendChild(
    createSeatRow(
      [
        8,
        "AISLE",
        9,
        10
      ],
      schedule
    )
  );


  seatsEl.appendChild(
    createSeatRow(
      [
        11,
        12,
        13,
        14
      ],
      schedule
    )
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

  back.style.color =
    "#687386";

  back.style.marginTop =
    "4px";


  back.textContent =
    "BELAKANG";


  seatsEl.appendChild(
    back
  );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    document.createElement(
      "div"
    );


  summary.className =
    "bookingSummary";


  summary.innerHTML = `

    <div>
      Rute
      <br>

      <strong>
        ${schedule.displayRoute}
      </strong>
    </div>


    <div>
      Jam
      <br>

      <strong>
        ${schedule.displayTime} WIT
      </strong>
    </div>


    <div>
      Armada
      <br>

      <strong>
        ${
          schedule.displayVehicle ||
          normalizeVehicle(
            schedule.vehicle
          ) ||
          "-"
        }
      </strong>
    </div>


    <div>
      Harga / Kursi
      <br>

      <strong>
        ${rupiah(
          schedule.displayPrice
        )}
      </strong>
    </div>

  `;


  seatsEl.appendChild(
    summary
  );

}


// ============================================================
// LOAD SEATS
// ============================================================

async function loadSeats(
  schedule
) {

  if (!seatsEl) {
    return;
  }


  const travelDate =
    dateEl
      ? dateEl.value
      : getLocalDate();


  if (
    isDeparturePassed(
      travelDate,
      schedule.displayTime
    )
  ) {

    resetScheduleSelection();


    await loadSchedules();


    return;

  }


  seatsEl.innerHTML = `
    <div
      style="
        padding:15px;
        text-align:center;
      "
    >
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

  } catch (error) {

    console.error(
      "BOOKING LOAD ERROR:",
      error
    );


    seatsEl.innerHTML = `
      <div
        style="
          padding:15px;
          color:#b00020;
          text-align:center;
        "
      >
        Gagal memuat kursi.

        <br><br>

        ${error.message}
      </div>
    `;

  }

}


// ============================================================
// BOOKING CODE
// ============================================================

function generateBookingCode() {

  const random =
    Math.random()
      .toString(16)
      .substring(2, 8)
      .toUpperCase();


  return (
    "HSM-" +
    random
  );

}


// ============================================================
// UNIQUE BOOKING CODES
// ============================================================

function generateUniqueBookingCodes(
  count
) {

  const codes =
    new Set();


  while (
    codes.size < count
  ) {

    codes.add(
      generateBookingCode()
    );

  }


  return [
    ...codes
  ];

}


// ============================================================
// WHATSAPP
// ============================================================

function normalizeWhatsApp(
  value
) {

  let number =
    String(
      value || ""
    )
      .replace(
        /\D/g,
        ""
      );


  if (
    number.startsWith("0")
  ) {

    number =
      "62" +
      number.substring(1);

  }


  return number;

}


// ============================================================
// ADMIN WHATSAPP
// ============================================================
//
// Weda = Admin 2
//
// Sofifi / Loleo / Lelilef
// memakai Admin 1 selama belum ada nomor admin khusus Lelilef.
//
// ============================================================

function getAdminWhatsApp(
  origin
) {

  const pool =
    String(
      origin || ""
    )
      .trim()
      .toLowerCase();


  if (
    pool === "weda"
  ) {

    return normalizeWhatsApp(
      HSM_CONFIG.WHATSAPP_ADMIN_2 ||
      HSM_CONFIG.WHATSAPP_ADMIN ||
      ""
    );

  }


  return normalizeWhatsApp(
    HSM_CONFIG.WHATSAPP_ADMIN ||
    HSM_CONFIG.WHATSAPP_ADMIN_2 ||
    ""
  );

}


// ============================================================
// GET PASSENGERS
// ============================================================

function getPassengerData() {

  const container =
    getPassengerContainer();


  const passengers =
    [];


  const validPhone =
    /^(08[0-9]{8,11}|628[0-9]{8,11})$/;


  const sortedSeats =
    [...selectedSeats]
      .sort(
        (a, b) => a - b
      );


  for (
    const seatNumber of sortedSeats
  ) {

    const block =
      container
        ? container.querySelector(
            `.passenger-data[data-seat="${seatNumber}"]`
          )
        : null;


    const nameInput =
      block
        ? block.querySelector(
            ".passenger-name"
          )
        : null;


    const phoneInput =
      block
        ? block.querySelector(
            ".passenger-phone"
          )
        : null;


    const passengerName =
      nameInput
        ? nameInput.value.trim()
        : "";


    const phone =
      phoneInput
        ? phoneInput.value.trim()
        : "";


    if (!passengerName) {

      alert(
        `Masukkan nama penumpang untuk kursi ${seatNumber}.`
      );


      if (nameInput) {
        nameInput.focus();
      }


      return null;

    }


    if (!phone) {

      alert(
        `Masukkan nomor WhatsApp penumpang kursi ${seatNumber}.`
      );


      if (phoneInput) {
        phoneInput.focus();
      }


      return null;

    }


    const cleanPhone =
      phone.replace(
        /[\s-]/g,
        ""
      );


    if (
      !validPhone.test(
        cleanPhone
      )
    ) {

      alert(
        `Nomor WhatsApp penumpang kursi ${seatNumber} tidak valid.\n\nContoh: 081234567890`
      );


      if (phoneInput) {
        phoneInput.focus();
      }


      return null;

    }


    passengers.push({

      seat:
        seatNumber,

      name:
        passengerName,

      phone:
        cleanPhone

    });

  }


  return passengers;

}


// ============================================================
// CREATE BOOKING
// ============================================================

async function createBooking() {

  if (
    isProcessingBooking
  ) {
    return;
  }


  // ==========================================================
  // VALIDASI JADWAL
  // ==========================================================

  if (!selectedSchedule) {

    alert(
      "Pilih jadwal terlebih dahulu."
    );

    return;

  }


  const travelDate =
    dateEl
      ? dateEl.value
      : getLocalDate();


  if (
    isDeparturePassed(
      travelDate,
      selectedSchedule.displayTime
    )
  ) {

    alert(
      "Maaf, jadwal ini sudah melewati waktu keberangkatan. Silakan pilih jadwal lain."
    );


    resetScheduleSelection();


    await loadSchedules();


    return;

  }


  // ==========================================================
  // VALIDASI KURSI
  // ==========================================================

  if (
    selectedSeats.length === 0
  ) {

    alert(
      "Pilih minimal satu kursi terlebih dahulu."
    );

    return;

  }


  // ==========================================================
  // VALIDASI PENUMPANG
  // ==========================================================

  const passengers =
    getPassengerData();


  if (!passengers) {
    return;
  }


  // ==========================================================
  // FINAL CHECK SEMUA KURSI
  // ==========================================================

  try {

    currentBookings =
      await fetchBookings(
        selectedSchedule.id
      );


    const unavailableSeats =
      [];


    selectedSeats.forEach(
      seatNumber => {

        const seatStatus =
          getSeatStatus(
            seatNumber,
            selectedSchedule
          );


        if (
          seatStatus !==
          "available"
        ) {

          unavailableSeats.push(
            seatNumber
          );

        }

      }
    );


    if (
      unavailableSeats.length > 0
    ) {

      alert(
        "Maaf, kursi " +
        unavailableSeats.join(", ") +
        " baru saja dipesan. Silakan pilih kursi lain."
      );


      selectedSeats =
        [];


      resetPassengerForms();


      await loadSeats(
        selectedSchedule
      );


      return;

    }

  } catch (error) {

    console.error(
      "FINAL SEAT CHECK ERROR:",
      error
    );


    alert(
      "Gagal mengecek ketersediaan kursi."
    );


    return;

  }


  // ==========================================================
  // CEK JAM SEKALI LAGI
  // ==========================================================

  if (
    isDeparturePassed(
      travelDate,
      selectedSchedule.displayTime
    )
  ) {

    alert(
      "Waktu keberangkatan sudah lewat. Booking tidak dapat dilanjutkan."
    );


    resetScheduleSelection();


    await loadSchedules();


    return;

  }


  // ==========================================================
  // PROCESS
  // ==========================================================

  isProcessingBooking =
    true;


  if (bookBtn) {

    bookBtn.disabled =
      true;


    bookBtn.textContent =
      "Memproses...";

  }


  const vehicle =
    selectedSchedule.displayVehicle ||
    normalizeVehicle(
      selectedSchedule.vehicle
    ) ||
    null;


  // ==========================================================
  // BUAT KODE BERBEDA UNTUK SETIAP PENUMPANG
  // ==========================================================

  const bookingCodes =
    generateUniqueBookingCodes(
      passengers.length
    );


  // ==========================================================
  // BOOKING DATA
  // ==========================================================

  const bookingData =
    passengers.map(
      (
        passenger,
        index
      ) => ({

        booking_code:
          bookingCodes[index],

        booking_type:
          "hiace",

        schedule_id:
          selectedSchedule.id,

        passenger_name:
          passenger.name,

        phone:
          passenger.phone,

        seat_number:
          passenger.seat,

        passenger_count:
          1,

        total:
          selectedSchedule.displayPrice,

        payment_status:
          "pending",

        assignment_status:
          "assigned",

        trip_code:
          selectedSchedule.trip_code ||
          null,

        segment_start:
          selectedSchedule.segmentStart,

        segment_end:
          selectedSchedule.segmentEnd,

        origin:
          selectedSchedule.displayOrigin,

        destination:
          selectedSchedule.displayDestination,

        travel_date:
          travelDate,

        departure_time:
          selectedSchedule.displayTime,

        requested_time:
          selectedSchedule.displayTime,

        passenger_note:
          null,

        assigned_vehicle_id:
          null,

        vehicle:
          vehicle

      })
    );


  try {

    // ========================================================
    // SIMPAN SEMUA PENUMPANG SEKALIGUS
    // ========================================================

    const {
      error
    } = await db
      .from("bookings")
      .insert(
        bookingData
      );


    if (error) {
      throw error;
    }


    // ========================================================
    // WHATSAPP ADMIN
    // ========================================================

    const adminNumber =
      getAdminWhatsApp(
        selectedSchedule.displayOrigin
      );


    const passengerMessage =
      passengers.map(
        (
          passenger,
          index
        ) => {

          return (
`Penumpang ${index + 1}
Kode Booking: ${bookingCodes[index]}
Nama: ${passenger.name}
No. WhatsApp: ${passenger.phone}
Kursi: ${passenger.seat}`
          );

        }
      ).join(
        "\n\n"
      );


    const grandTotal =
      Number(
        selectedSchedule.displayPrice
      ) *
      passengers.length;


    const message =
`Halo HSM Transport 👋

Saya sudah melakukan booking tiket.

${passengerMessage}

Rute: ${selectedSchedule.displayRoute}
Tanggal: ${travelDate}
Jam: ${selectedSchedule.displayTime} WIT
Armada: ${vehicle || "-"}

Jumlah Penumpang: ${passengers.length}
Total: ${rupiah(grandTotal)}

Status: Menunggu pembayaran.

Mohon konfirmasi booking saya.`;


    const whatsappURL =
      adminNumber
        ? (
            "https://wa.me/" +
            adminNumber +
            "?text=" +
            encodeURIComponent(
              message
            )
          )
        : "";


    // ========================================================
    // HASIL BOOKING
    // ========================================================

    if (resultEl) {

      const passengerResult =
        passengers.map(
          (
            passenger,
            index
          ) => `

            <div
              style="
                padding:12px 0;
                ${
                  index <
                  passengers.length - 1
                    ? "border-bottom:1px solid #eadcae;"
                    : ""
                }
              "
            >

              <strong>
                Penumpang ${index + 1}
              </strong>

              <br>

              Kode Booking:
              <strong>
                ${bookingCodes[index]}
              </strong>

              <br>

              Nama:
              <strong>
                ${passenger.name}
              </strong>

              <br>

              Kursi:
              <strong>
                ${passenger.seat}
              </strong>

            </div>

          `
        ).join("");


      resultEl.innerHTML = `

        <div
          style="
            padding:18px;
            margin-top:18px;
            border:1px solid #f2d889;
            border-radius:14px;
            background:#fff9e8;
            line-height:1.65;
          "
        >

          <strong
            style="
              font-size:17px;
            "
          >
            Booking berhasil 🟡
          </strong>

          <br><br>

          ${passengerResult}

          <br>

          Rute:
          <strong>
            ${selectedSchedule.displayRoute}
          </strong>

          <br>

          Tanggal:
          <strong>
            ${travelDate}
          </strong>

          <br>

          Jam:
          <strong>
            ${selectedSchedule.displayTime} WIT
          </strong>

          <br>

          Armada:
          <strong>
            ${vehicle || "-"}
          </strong>

          <br>

          Jumlah Penumpang:
          <strong>
            ${passengers.length}
          </strong>

          <br>

          Total:
          <strong>
            ${rupiah(
              grandTotal
            )}
          </strong>

          <br><br>

          Status:
          <strong>
            Menunggu pembayaran
          </strong>

          ${
            adminNumber
              ? `

                <br><br>

                <div
                  style="
                    text-align:center;
                    font-weight:800;
                    color:#687386;
                  "
                >
                  Membuka WhatsApp untuk konfirmasi...
                </div>

              `
              : ""
          }

        </div>

      `;

    }


    // ========================================================
    // RESET KURSI + FORM
    // ========================================================

    selectedSeats =
      [];


    resetPassengerForms();


    await loadSeats(
      selectedSchedule
    );


    // ========================================================
    // BUKA WHATSAPP
    // ========================================================

    if (
      adminNumber &&
      whatsappURL
    ) {

      setTimeout(
        () => {

          window.location.href =
            whatsappURL;

        },
        700
      );

    }

  } catch (error) {

    console.error(
      "BOOKING ERROR:",
      error
    );


    alert(
      "Booking gagal:\n" +
      error.message
    );

  } finally {

    isProcessingBooking =
      false;


    if (bookBtn) {

      bookBtn.disabled =
        false;


      bookBtn.textContent =
        "Pesan Sekarang";

    }

  }

}


// ============================================================
// BOOK EVENT
// ============================================================

if (bookBtn) {

  bookBtn.addEventListener(
    "click",
    createBooking
  );

}


// ============================================================
// DATE EVENT
// ============================================================

if (dateEl) {

  dateEl.addEventListener(
    "change",
    () => {

      resetScheduleSelection();


      if (resultEl) {

        resultEl.innerHTML =
          "";

      }


      if (
        dateEl.value <
        getLocalDate()
      ) {

        dateEl.value =
          getLocalDate();

      }


      const route =
        getSelectedRoute();


      if (
        route.origin &&
        route.destination
      ) {

        loadSchedules();

      } else if (
        scheduleEl
      ) {

        scheduleEl.innerHTML = `
          <div
            style="
              padding:15px;
              text-align:center;
            "
          >
            Pilih lokasi keberangkatan dan tujuan.
          </div>
        `;

      }

    }
  );

}


// ============================================================
// INITIAL DATE
// ============================================================

if (dateEl) {

  dateEl.min =
    getLocalDate();


  if (
    !dateEl.value ||
    dateEl.value <
    getLocalDate()
  ) {

    dateEl.value =
      getLocalDate();

  }

}


// ============================================================
// INITIAL DESTINATION
// ============================================================

updateDestinationOptions(
  true
);


selectedOrigin =
  fromEl
    ? fromEl.value
    : "";


selectedDestination =
  toEl
    ? toEl.value
    : "";


// ============================================================
// INITIAL PASSENGER FORMS
// ============================================================

resetPassengerForms();


// ============================================================
// INITIAL SCHEDULE
// ============================================================

if (
  selectedOrigin &&
  selectedDestination
) {

  loadSchedules();

} else if (
  scheduleEl
) {

  scheduleEl.innerHTML = `
    <div
      style="
        padding:15px;
        text-align:center;
      "
    >
      Pilih lokasi keberangkatan dan tujuan.
    </div>
  `;

}


// ============================================================
// INITIAL SEAT
// ============================================================

if (
  seatsEl &&
  !selectedSchedule
) {

  seatsEl.innerHTML = `
    <div
      style="
        padding:15px;
        text-align:center;
      "
    >
      Pilih jadwal terlebih dahulu.
    </div>
  `;

}


// ============================================================
// AUTO REFRESH 30 DETIK
// ============================================================

setInterval(
  () => {

    const route =
      getSelectedRoute();


    // ========================================================
    // JADWAL TERPILIH SUDAH LEWAT
    // ========================================================

    if (
      selectedSchedule &&
      dateEl &&
      isDeparturePassed(
        dateEl.value,
        selectedSchedule.displayTime
      )
    ) {

      resetScheduleSelection();


      if (
        route.origin &&
        route.destination
      ) {

        loadSchedules();

      }


      return;

    }


    // ========================================================
    // JANGAN REFRESH SAAT USER SEDANG BOOKING
    // ========================================================

    const passengerContainer =
      document.getElementById(
        "passengerForms"
      );


    const hasPassengerInput =
      passengerContainer
        ? Array.from(
            passengerContainer.querySelectorAll(
              "input"
            )
          ).some(
            input =>
              input.value.trim()
          )
        : false;


    if (
      isProcessingBooking ||
      selectedSchedule ||
      selectedSeats.length > 0 ||
      hasPassengerInput
    ) {
      return;
    }


    // ========================================================
    // REFRESH JADWAL
    // ========================================================

    if (
      route.origin &&
      route.destination
    ) {

      loadSchedules();

    }

  },
  30000
);
