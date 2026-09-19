// ============================================================
// HSM TRANSPORT - APP.JS FINAL
// ============================================================
// FITUR:
// - Route dropdown
// - Jadwal berdasarkan tanggal
// - Filter jadwal yang sudah lewat berdasarkan WIT
// - FULL SEAT
// - Segmented seat
// - 14 kursi penumpang
// - Pending mengunci kursi
// - Paid mengunci kursi
// - Completed tetap mengunci kursi
// - Cancelled membuka kursi
// - Booking type = hiace
// - WhatsApp admin per pool
// - Timezone Asia/Jayapura / WIT
// ============================================================


// ============================================================
// CONFIG
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

const scheduleEl =
  document.getElementById("schedule");

const seatsEl =
  document.getElementById("seats");

const dateEl =
  document.getElementById("date");

const nameEl =
  document.getElementById("name");

const phoneEl =
  document.getElementById("phone");

const bookBtn =
  document.getElementById("book");

const resultEl =
  document.getElementById("result");

const fromEl =
  document.getElementById("from");

const toEl =
  document.getElementById("to");


// ============================================================
// STATE
// ============================================================

let schedules = [];

let selectedSchedule = null;

let selectedSeat = null;

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
// FORMAT RUPIAH
// ============================================================

function rupiah(value) {

  return (
    "Rp" +
    Number(value || 0)
      .toLocaleString("id-ID")
  );

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
    )
    .formatToParts(
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
// WAKTU SEKARANG WIT
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
    )
    .formatToParts(
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


  const hour =
    Number(
      parts[0] || 0
    );


  const minute =
    Number(
      parts[1] || 0
    );


  return (
    hour * 60 +
    minute
  );

}


// ============================================================
// CEK JADWAL SUDAH LEWAT
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
      .substring(
        0,
        10
      );


  // Tanggal lampau

  if (
    date < now.date
  ) {

    return true;

  }


  // Tanggal masa depan

  if (
    date > now.date
  ) {

    return false;

  }


  // Hari ini

  const currentMinutes =
    now.hour * 60 +
    now.minute;


  const departureMinutes =
    timeToMinutes(
      departureTime
    );


  return (
    currentMinutes >=
    departureMinutes
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
// FORMAT JAM
// ============================================================

function formatTime(time) {

  if (!time) {
    return "";
  }


  return String(time)
    .substring(
      0,
      5
    );

}


// ============================================================
// NORMALIZE VEHICLE
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


  // Sofifi -> Lelilef

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


  // Lelilef -> Sofifi

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
// NORMALIZE BOOKING STATUS
// ============================================================

function getBookingStatus(booking) {

  const status =
    String(
      booking?.payment_status ||
      booking?.status ||
      ""
    )
      .trim()
      .toLowerCase();


  // PAID

  if (
    status === "paid" ||
    status === "lunas" ||
    status === "success" ||
    status === "settled" ||
    status === "sudah_dibayar"
  ) {

    return "paid";

  }


  // COMPLETED
  // Tetap mengunci kursi

  if (
    status === "completed" ||
    status === "selesai"
  ) {

    return "completed";

  }


  // CANCELLED
  // Membuka kursi

  if (
    status === "cancelled" ||
    status === "canceled" ||
    status === "dibatalkan" ||
    status === "failed" ||
    status === "gagal"
  ) {

    return "cancelled";

  }


  // Default = pending

  return "pending";

}


// ============================================================
// UPDATE DROPDOWN TUJUAN
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
    )
      .trim();


  const oldDestination =
    String(
      toEl.value || ""
    )
      .trim();


  const destinations =
    HSM_DESTINATIONS[
      origin
    ] || [];


  // Bersihkan tujuan lama

  toEl.innerHTML =
    "";


  // Placeholder

  const placeholder =
    document.createElement(
      "option"
    );


  placeholder.value =
    "";


  placeholder.textContent =
    origin
      ? "Pilih tujuan"
      : "Pilih lokasi dahulu";


  placeholder.selected =
    true;


  toEl.appendChild(
    placeholder
  );


  // Belum pilih asal

  if (!origin) {

    toEl.disabled =
      true;


    selectedOrigin =
      "";


    selectedDestination =
      "";


    return;

  }


  // Tambahkan tujuan

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


  // Aktifkan dropdown tujuan

  toEl.disabled =
    destinations.length === 0;


  // Pertahankan pilihan jika valid

  if (
    keepCurrent &&
    destinations.includes(
      oldDestination
    )
  ) {

    toEl.value =
      oldDestination;

  }

  else {

    toEl.value =
      "";

  }


  selectedOrigin =
    origin;


  selectedDestination =
    toEl.value || "";

}


// ============================================================
// GET SELECTED ROUTE
// ============================================================

function getSelectedRoute() {

  return {

    origin:
      fromEl
        ? String(
            fromEl.value || ""
          )
          .trim()
        : "",

    destination:
      toEl
        ? String(
            toEl.value || ""
          )
          .trim()
        : ""

  };

}


// ============================================================
// RESET JADWAL
// ============================================================

function resetScheduleSelection() {

  selectedSchedule =
    null;


  selectedSeat =
    null;


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

}


// ============================================================
// EVENT ASAL
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


// ============================================================
// EVENT TUJUAN
// ============================================================

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
  } =
    await db
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

function buildServices(rows) {

  const services =
    [];


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
      // ARAH:
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


        const loleoTime =
          time === "09:00"
            ? "09:30"
            : time === "13:00"
              ? "13:30"
              : time;


        const wedaTime =
          time === "09:00"
            ? "11:30"
            : time === "13:00"
              ? "15:30"
              : time;


        // SOFIFI -> WEDA

        addService(
          row,
          "Sofifi",
          "Weda",
          time,
          225000,
          1,
          2,
          "SOFIFI_WEDA",
          vehicle
        );


        // SOFIFI -> LELILEF

        addService(
          row,
          "Sofifi",
          "Lelilef",
          time,
          300000,
          1,
          3,
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
          2,
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
          3,
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
          3,
          "WEDA_LELILEF",
          vehicle
        );

      }


      // ======================================================
      // ARAH:
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


        const lelilefTime =
          time;


        const wedaTime =
          time === "09:00"
            ? "09:45"
            : time === "13:00"
              ? "13:45"
              : time;


        // LELILEF -> WEDA

        addService(
          row,
          "Lelilef",
          "Weda",
          lelilefTime,
          100000,
          1,
          1,
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
          2,
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
          3,
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
          2,
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
          3,
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

  // ==========================================================
  // COBA RPC
  // ==========================================================

  try {

    const {
      data,
      error
    } =
      await db.rpc(
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

  }

  catch (rpcError) {

    console.warn(
      "RPC seat fallback:",
      rpcError
    );

  }


  // ==========================================================
  // FALLBACK BOOKINGS TABLE
  // ==========================================================

  const {
    data,
    error
  } =
    await db
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
// STATUS KURSI BERDASARKAN SEGMENT
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


  (
    bookingRows ||
    []
  )
  .forEach(
    booking => {

      // Beda kursi

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


      // ======================================================
      // CANCELLED = TIDAK MENGUNCI
      // ======================================================

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


      // ======================================================
      // CEK OVERLAP SEGMENT
      // ======================================================

      const overlap =
        bookingStart <= newEnd &&
        bookingEnd >= newStart;


      if (!overlap) {

        return;

      }


      // ======================================================
      // PAID / COMPLETED = MERAH
      // ======================================================

      if (
        bookingStatus === "paid" ||
        bookingStatus === "completed"
      ) {

        seatStatus =
          "paid";

        return;

      }


      // ======================================================
      // PENDING = KUNING
      // ======================================================

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
// STATUS KURSI CURRENT
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
// HITUNG KURSI TERSEDIA
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


  // ==========================================================
  // BELUM PILIH ASAL
  // ==========================================================

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


  // ==========================================================
  // BELUM PILIH TUJUAN
  // ==========================================================

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


  // ==========================================================
  // BELUM PILIH TANGGAL
  // ==========================================================

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


  // ==========================================================
  // TANGGAL SUDAH LEWAT
  // ==========================================================

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


  // ==========================================================
  // LOADING
  // ==========================================================

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


    // ========================================================
    // FILTER TANGGAL
    // ========================================================

    const dateRows =
      rows.filter(
        row => {

          const rowDate =
            row.travel_date
              ? String(
                  row.travel_date
                )
                .substring(
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


    // ========================================================
    // BUILD SERVICES
    // ========================================================

    const allServices =
      buildServices(
        dateRows
      );


    // ========================================================
    // FILTER:
    // - ASAL
    // - TUJUAN
    // - JAM BELUM LEWAT
    // ========================================================

    const services =
      allServices.filter(
        service => {

          const originMatch =
            String(
              service.displayOrigin
            )
              .toLowerCase() ===
            String(
              route.origin
            )
              .toLowerCase();


          const destinationMatch =
            String(
              service.displayDestination
            )
              .toLowerCase() ===
            String(
              route.destination
            )
              .toLowerCase();


          // Pakai displayTime karena waktu
          // naik penumpang berbeda per pool.

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

        const key =
          [
            service.id,
            service.displayOrigin,
            service.displayDestination,
            service.displayTime,
            service.segmentStart,
            service.segmentEnd
          ]
          .join("|");


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
      (a, b) => {

        return (
          a.displayTime
            .localeCompare(
              b.displayTime
            )
        );

      }
    );


    // ========================================================
    // CACHE BOOKING PER SCHEDULE
    // ========================================================

    const bookingCache =
      new Map();


    const scheduleIds =
      [
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

          }

          catch (error) {

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


    // ========================================================
    // RENDER JADWAL
    // ========================================================

    scheduleEl.innerHTML =
      "";


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


        // ====================================================
        // GAGAL CEK KURSI
        // ====================================================

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

        }


        // ====================================================
        // FULL SEAT
        // ====================================================

        else if (
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

        }


        // ====================================================
        // TERSEDIA
        // ====================================================

        else {

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


        // ====================================================
        // CARD JADWAL
        // ====================================================

        button.innerHTML = `

          <div class="schedule-time">
            ${service.displayTime}
          </div>

          <div class="schedule-info">

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


        // ====================================================
        // FULL = TIDAK BISA DIPILIH
        // ====================================================

        if (isFull) {

          button.disabled =
            true;


          button.style.opacity =
            "0.62";


          button.style.cursor =
            "not-allowed";


          button.title =
            "Semua kursi pada rute ini sudah terisi";

        }


        // ====================================================
        // PILIH JADWAL
        // ====================================================

        else {

          button.addEventListener(
            "click",
            async () => {

              // Cek jam lagi

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


              selectedSeat =
                null;


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

  }

  catch (error) {

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

        document
          .querySelectorAll(
            ".seat-passenger"
          )
          .forEach(
            otherSeat => {

              otherSeat.classList.remove(
                "selected"
              );

            }
          );


        seat.classList.add(
          "selected"
        );


        selectedSeat =
          number;

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
  // PAID / COMPLETED
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
// CREATE SEAT ROW
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
        typeof item === "number"
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
  // KETERSEDIAAN
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
  // LEGENDA
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
      Harga
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


  // ==========================================================
  // CEK JADWAL SUDAH LEWAT
  // ==========================================================

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

  }

  catch (error) {

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
// GENERATE BOOKING CODE
// ============================================================

function generateBookingCode() {

  const random =
    Math.random()
      .toString(16)
      .substring(
        2,
        8
      )
      .toUpperCase();


  return (
    "HSM-" +
    random
  );

}


// ============================================================
// NORMALIZE WHATSAPP
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
    number.startsWith(
      "0"
    )
  ) {

    number =
      "62" +
      number.substring(1);

  }


  return number;

}


// ============================================================
// ADMIN WHATSAPP PER POOL
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


  // WEDA / LELILEF

  if (
    pool === "weda" ||
    pool === "lelilef"
  ) {

    return normalizeWhatsApp(

      HSM_CONFIG.WHATSAPP_ADMIN_2 ||
      HSM_CONFIG.WHATSAPP_ADMIN ||
      ""

    );

  }


  // SOFIFI / LOLEO

  return normalizeWhatsApp(

    HSM_CONFIG.WHATSAPP_ADMIN ||
    HSM_CONFIG.WHATSAPP_ADMIN_2 ||
    ""

  );

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

  if (
    !selectedSchedule
  ) {

    alert(
      "Pilih jadwal terlebih dahulu."
    );

    return;

  }


  const travelDate =
    dateEl
      ? dateEl.value
      : getLocalDate();


  // ==========================================================
  // CEK JAM JADWAL
  // ==========================================================

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
    !selectedSeat
  ) {

    alert(
      "Pilih kursi terlebih dahulu."
    );

    return;

  }


  // ==========================================================
  // NAMA
  // ==========================================================

  const passengerName =
    nameEl
      ? nameEl.value.trim()
      : "";


  if (
    !passengerName
  ) {

    alert(
      "Masukkan nama penumpang."
    );


    if (nameEl) {

      nameEl.focus();

    }


    return;

  }


  // ==========================================================
  // PHONE
  // ==========================================================

  const phone =
    phoneEl
      ? phoneEl.value.trim()
      : "";


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
  // FINAL CHECK KURSI
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
        "Maaf, kursi tersebut baru saja dipesan. Silakan pilih kursi lain."
      );


      selectedSeat =
        null;


      await loadSeats(
        selectedSchedule
      );


      return;

    }

  }

  catch (error) {

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
  // CEK JAM LAGI SETELAH FINAL CHECK
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
  // PROCESSING
  // ==========================================================

  isProcessingBooking =
    true;


  if (bookBtn) {

    bookBtn.disabled =
      true;


    bookBtn.textContent =
      "Memproses...";

  }


  const bookingCode =
    generateBookingCode();


  const vehicle =
    selectedSchedule.displayVehicle ||
    normalizeVehicle(
      selectedSchedule.vehicle
    ) ||
    null;


  // ==========================================================
  // DATA BOOKING
  // ==========================================================
  // PENTING:
  // booking_type sekarang HIACE.
  // FLEXIBLE sudah tidak dipakai.
  // ==========================================================

  const bookingData = {

    booking_code:
      bookingCode,

    booking_type:
      "hiace",

    schedule_id:
      selectedSchedule.id,

    passenger_name:
      passengerName,

    phone:
      phone,

    seat_number:
      selectedSeat,

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

  };


  try {

    // ========================================================
    // INSERT BOOKING
    // ========================================================

    const {
      error
    } =
      await db
        .from("bookings")
        .insert(
          bookingData
        );


    if (error) {

      throw error;

    }


    // ========================================================
    // ADMIN WHATSAPP
    // ========================================================

    const adminNumber =
      getAdminWhatsApp(
        selectedSchedule
          .displayOrigin
      );


    // ========================================================
    // MESSAGE WHATSAPP
    // ========================================================

    const message =
`Halo HSM Transport 👋

Saya sudah melakukan booking tiket.

Kode Booking: ${bookingCode}

Nama: ${passengerName}
No. WhatsApp: ${phone}

Rute: ${selectedSchedule.displayRoute}
Tanggal: ${travelDate}
Jam: ${selectedSchedule.displayTime} WIT
Armada: ${vehicle || "-"}
Kursi: ${selectedSeat}

Total: ${rupiah(selectedSchedule.displayPrice)}

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
        : "#";


    // ========================================================
    // RESULT
    // ========================================================

    if (resultEl) {

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

          Kode Booking:
          <strong>
            ${bookingCode}
          </strong>

          <br>

          Nama:
          <strong>
            ${passengerName}
          </strong>

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
            ${selectedSchedule.displayTime}
            WIT
          </strong>

          <br>

          Armada:
          <strong>
            ${vehicle || "-"}
          </strong>

          <br>

          Kursi:
          <strong>
            ${selectedSeat}
          </strong>

          <br>

          Total:
          <strong>
            ${rupiah(
              selectedSchedule.displayPrice
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

                <a
                  href="${whatsappURL}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="
                    display:block;
                    padding:13px 18px;
                    border-radius:10px;
                    background:#25D366;
                    color:#ffffff;
                    text-decoration:none;
                    text-align:center;
                    font-weight:900;
                  "
                >
                  Konfirmasi via WhatsApp
                </a>

              `
              : ""
          }

        </div>

      `;

    }


    // ========================================================
    // REFRESH KURSI
    // ========================================================

    selectedSeat =
      null;


    await loadSeats(
      selectedSchedule
    );

  }

  catch (error) {

    console.error(
      "BOOKING ERROR:",
      error
    );


    alert(
      "Booking gagal:\n" +
      error.message
    );

  }

  finally {

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
// EVENT BOOK
// ============================================================

if (bookBtn) {

  bookBtn.addEventListener(
    "click",
    createBooking
  );

}


// ============================================================
// EVENT TANGGAL
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


      // ======================================================
      // CEGAH TANGGAL LAMPAU
      // ======================================================

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

      }

      else if (
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

  // Minimum tanggal = hari ini WIT

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
// INITIAL ROUTE
// ============================================================

if (fromEl) {

  selectedOrigin =
    fromEl.value || "";

}


// ============================================================
// INITIALIZE DESTINATION
// ============================================================

updateDestinationOptions(
  true
);


// ============================================================
// INITIAL STATE
// ============================================================

selectedOrigin =
  fromEl
    ? fromEl.value
    : "";


selectedDestination =
  toEl
    ? toEl.value
    : "";


// ============================================================
// INITIAL SCHEDULE
// ============================================================

if (
  selectedOrigin &&
  selectedDestination
) {

  loadSchedules();

}

else if (
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
    // JADWAL TERPILIH TIBA-TIBA SUDAH LEWAT
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
    // JANGAN GANGGU USER YANG SEDANG BOOKING
    // ========================================================

    if (
      isProcessingBooking ||
      selectedSchedule ||
      selectedSeat ||
      (
        nameEl &&
        nameEl.value.trim()
      ) ||
      (
        phoneEl &&
        phoneEl.value.trim()
      )
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
