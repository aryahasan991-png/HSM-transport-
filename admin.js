// ============================================================
// HSM TRANSPORT - APP.JS FINAL
// FULL SEAT + SEGMENTED SEAT + ROUTE DROPDOWN
// 14 KURSI PENUMPANG
// TIMEZONE: ASIA/JAYAPURA / WIT
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
// KONFIGURASI RUTE
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
      "en-US",
      {
        timeZone:
          "Asia/Jayapura",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit"
      }
    )
    .formatToParts(
      new Date()
    );


  const values = {};


  parts.forEach(part => {

    if (
      part.type !==
      "literal"
    ) {

      values[
        part.type
      ] =
        part.value;

    }

  });


  return (
    values.year +
    "-" +
    values.month +
    "-" +
    values.day
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
// NORMALIZE VEHICLE
// ============================================================

function normalizeVehicle(vehicle) {

  if (
    vehicle === null ||
    vehicle === undefined
  ) {
    return "";
  }


  const v =
    String(vehicle)
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
// STATUS BOOKING
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


  // ==========================================================
  // PAID
  // ==========================================================

  if (
    status === "paid" ||
    status === "lunas" ||
    status === "success" ||
    status === "settled" ||
    status === "sudah_dibayar"
  ) {

    return "paid";

  }


  // ==========================================================
  // COMPLETED
  // TETAP MENGUNCI KURSI
  // ==========================================================

  if (
    status === "completed" ||
    status === "selesai"
  ) {

    return "completed";

  }


  // ==========================================================
  // CANCELLED
  // HANYA CANCELLED YANG MEMBUKA KURSI
  // ==========================================================

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
// ISI DROPDOWN TUJUAN
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
    HSM_DESTINATIONS[
      origin
    ] || [];


  // HAPUS OPTION LAMA

  toEl.innerHTML = "";


  // PLACEHOLDER

  const placeholder =
    document.createElement(
      "option"
    );


  placeholder.value =
    "";


  placeholder.textContent =
    "Pilih tujuan";


  placeholder.disabled =
    true;


  placeholder.selected =
    true;


  toEl.appendChild(
    placeholder
  );


  // TAMBAHKAN TUJUAN

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


  // PERTAHANKAN TUJUAN
  // JIKA MASIH VALID

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
// RESET PILIHAN JADWAL
// ============================================================

function resetScheduleSelection() {

  selectedSchedule =
    null;


  selectedSeat =
    null;


  currentBookings =
    [];


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


      loadSchedules();

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
          ascending:
            true
        }
      )
      .order(
        "departure_time",
        {
          ascending:
            true
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


  // ==========================================================
  // SEGMENT ARAH SOFIFI
  //
  // 1 = SOFIFI -> LOLEO
  // 2 = LOLEO -> WEDA
  // 3 = WEDA -> LELILEF
  //
  // SEGMENT ARAH LELILEF
  //
  // 1 = LELILEF -> WEDA
  // 2 = WEDA -> LOLEO
  // 3 = LOLEO -> SOFIFI
  // ==========================================================


  function addService(
    row,
    origin,
    destination,
    displayTime,
    price,
    segmentStart,
    segmentEnd,
    serviceType
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
        serviceType

    });

  }


  rows.forEach(row => {

    const route =
      normalizeRoute(
        row.route
      );


    const time =
      formatTime(
        row.departure_time
      );


    // ========================================================
    // SOFIFI -> LOLEO -> WEDA -> LELILEF
    // ========================================================

    if (
      route ===
        "Sofifi→Weda" ||
      route ===
        "Sofifi→Lelilef"
    ) {

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


      addService(
        row,
        "Sofifi",
        "Weda",
        time,
        225000,
        1,
        2,
        "SOFIFI_WEDA"
      );


      addService(
        row,
        "Sofifi",
        "Lelilef",
        time,
        300000,
        1,
        3,
        "SOFIFI_LELILEF"
      );


      addService(
        row,
        "Loleo",
        "Weda",
        loleoTime,
        200000,
        2,
        2,
        "LOLEO_WEDA"
      );


      addService(
        row,
        "Loleo",
        "Lelilef",
        loleoTime,
        275000,
        2,
        3,
        "LOLEO_LELILEF"
      );


      addService(
        row,
        "Weda",
        "Lelilef",
        wedaTime,
        100000,
        3,
        3,
        "WEDA_LELILEF"
      );

    }


    // ========================================================
    // LELILEF -> WEDA -> LOLEO -> SOFIFI
    // ========================================================

    if (
      route ===
        "Weda→Sofifi" ||
      route ===
        "Lelilef→Sofifi"
    ) {

      const lelilefTime =
        time;


      const wedaTime =
        time === "09:00"
          ? "09:45"
          : time === "13:00"
            ? "13:45"
            : time;


      addService(
        row,
        "Lelilef",
        "Weda",
        lelilefTime,
        100000,
        1,
        1,
        "LELILEF_WEDA"
      );


      addService(
        row,
        "Lelilef",
        "Loleo",
        lelilefTime,
        275000,
        1,
        2,
        "LELILEF_LOLEO"
      );


      addService(
        row,
        "Lelilef",
        "Sofifi",
        lelilefTime,
        300000,
        1,
        3,
        "LELILEF_SOFIFI"
      );


      addService(
        row,
        "Weda",
        "Loleo",
        wedaTime,
        200000,
        2,
        2,
        "WEDA_LOLEO"
      );


      addService(
        row,
        "Weda",
        "Sofifi",
        wedaTime,
        225000,
        2,
        3,
        "WEDA_SOFIFI"
      );

    }

  });


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

  }

  catch (rpcError) {

    console.warn(
      "RPC seat fallback:",
      rpcError
    );

  }


  // ==========================================================
  // FALLBACK TABLE BOOKINGS
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
// GET SEAT STATUS
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
      2
    );


  let seatStatus =
    "available";


  (
    bookingRows ||
    []
  )
  .forEach(booking => {

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


    // ========================================================
    // CANCELLED TIDAK MENGUNCI
    // ========================================================

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
        2
      );


    const overlap =
      bookingStart <=
        newEnd &&
      bookingEnd >=
        newStart;


    if (!overlap) {

      return;

    }


    // ========================================================
    // PAID / COMPLETED = MERAH
    // ========================================================

    if (
      bookingStatus ===
        "paid" ||
      bookingStatus ===
        "completed"
    ) {

      seatStatus =
        "paid";

      return;

    }


    // ========================================================
    // PENDING = KUNING
    // ========================================================

    if (
      bookingStatus ===
        "pending" &&
      seatStatus !==
        "paid"
    ) {

      seatStatus =
        "pending";

    }

  });


  return seatStatus;

}


// ============================================================
// GET CURRENT SEAT STATUS
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
      status ===
      "available"
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
      rows.filter(row => {

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

      });


    // ========================================================
    // BUILD SERVICES
    // ========================================================

    const allServices =
      buildServices(
        dateRows
      );


    // ========================================================
    // FILTER ASAL + TUJUAN
    // ========================================================

    const services =
      allServices.filter(
        service => {

          return (

            String(
              service.displayOrigin
            )
              .toLowerCase() ===

            String(
              route.origin
            )
              .toLowerCase()

            &&

            String(
              service.displayDestination
            )
              .toLowerCase() ===

            String(
              route.destination
            )
              .toLowerCase()

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
      unique.length ===
      0
    ) {

      scheduleEl.innerHTML = `
        <div
          style="
            padding:15px;
            text-align:center;
          "
        >

          Tidak ada jadwal tersedia untuk

          <b>
            ${route.origin}
            →
            ${route.destination}
          </b>

          pada tanggal

          <b>
            ${selectedDate}
          </b>.

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
    // CACHE BOOKING
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
    // RENDER CARD
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
          "scheduleBtn";


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
          availableSeats ===
          0;


        let availabilityHTML =
          "";


        // ====================================================
        // GAGAL CEK
        // ====================================================

        if (
          availableSeats ===
          null
        ) {

          availabilityHTML = `
            <div
              style="
                margin-top:7px;
                font-size:12px;
                font-weight:800;
                color:#6b7280;
              "
            >
              Ketersediaan kursi akan dicek
            </div>
          `;

        }


        // ====================================================
        // FULL
        // ====================================================

        else if (
          isFull
        ) {

          availabilityHTML = `
            <div
              style="
                margin-top:7px;
                font-size:13px;
                font-weight:900;
                color:#dc2626;
              "
            >
              🔴 FULL SEAT
            </div>
          `;

        }


        // ====================================================
        // TERSEDIA
        // ====================================================

        else {

          availabilityHTML = `
            <div
              style="
                margin-top:7px;
                font-size:12px;
                font-weight:900;
                color:#16a34a;
              "
            >
              🟢 Tersedia
              ${availableSeats}
              kursi
            </div>
          `;

        }


        button.innerHTML = `

          <div>
            <strong>
              ${service.displayRoute}
            </strong>
          </div>


          <div
            style="
              font-size:20px;
              margin-top:5px;
            "
          >
            ${service.displayTime}
            WIT
          </div>


          <div
            style="
              margin-top:5px;
            "
          >
            ${rupiah(
              service.displayPrice
            )}
          </div>


          <small
            style="
              display:block;
              margin-top:5px;
            "
          >
            ${
              normalizeVehicle(
                service.vehicle
              ) ||
              "-"
            }
          </small>


          ${availabilityHTML}

        `;


        // ====================================================
        // FULL = TIDAK BISA DIKLIK
        // ====================================================

        if (
          isFull
        ) {

          button.disabled =
            true;


          button.style.opacity =
            "0.68";


          button.style.cursor =
            "not-allowed";


          button.title =
            "Semua kursi pada rute ini sudah terisi";

        }


        // ====================================================
        // BISA DIPILIH
        // ====================================================

        else {

          button.addEventListener(
            "click",
            async () => {

              document
                .querySelectorAll(
                  ".scheduleBtn"
                )
                .forEach(btn => {

                  btn.classList
                    .remove(
                      "active"
                    );

                });


              button.classList.add(
                "active"
              );


              selectedSchedule =
                service;


              selectedSeat =
                null;


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


  seat.style.width =
    "48px";

  seat.style.height =
    "48px";

  seat.style.boxSizing =
    "border-box";

  seat.style.border =
    "none";

  seat.style.borderRadius =
    "8px";

  seat.style.fontWeight =
    "bold";

  seat.style.fontSize =
    "15px";

  seat.style.cursor =
    "pointer";

  seat.style.color =
    "#fff";

  seat.style.flexShrink =
    "0";


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
          .forEach(s => {

            s.style.outline =
              "none";

          });


        seat.style.outline =
          "3px solid #111";


        selectedSeat =
          number;

      }
    );

  }


  // ==========================================================
  // PENDING
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


    seat.style.cursor =
      "not-allowed";


    seat.title =
      `Kursi ${number} menunggu pembayaran`;

  }


  // ==========================================================
  // PAID / COMPLETED
  // ==========================================================

  else {

    seat.style.background =
      "#ef4444";


    seat.disabled =
      true;


    seat.style.cursor =
      "not-allowed";


    seat.title =
      `Kursi ${number} sudah terisi`;

  }


  seat.dataset.status =
    status;


  seat.dataset.seat =
    number;


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
    "48px";

  block.style.boxSizing =
    "border-box";

  block.style.borderRadius =
    "8px";

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

  block.style.flexShrink =
    "0";

  block.textContent =
    label;

  block.title =
    label;


  return block;

}


// ============================================================
// KERNET
// ============================================================

function createKernetSeat() {

  return createFixedBlock(
    "KERNET",
    "#111"
  );

}


// ============================================================
// PINTU SLIDING
// ============================================================

function createSlidingDoor() {

  return createFixedBlock(
    "PINTU SLIDING",
    "#111"
  );

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
    "48px";


  aisle.style.flexShrink =
    "0";


  return aisle;

}


// ============================================================
// CREATE ROW
// ============================================================

function createSeatRow(
  items
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
    "48px";


  row.style.alignItems =
    "center";


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
      item ===
      "SLIDING"
    ) {

      row.appendChild(
        createSlidingDoor()
      );

      return;

    }


    if (
      item ===
      "SUPIR"
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
          selectedSchedule
        )

      );

    }

  });


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
  // TITLE
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

    <div
      style="
        margin-top:5px;
        font-size:12px;
        font-weight:800;
        color:${
          available === 0
            ? "#dc2626"
            : "#16a34a"
        };
      "
    >

      ${
        available === 0
          ? "🔴 FULL SEAT"
          : `🟢 Tersedia ${available} kursi`
      }

    </div>

  `;


  seatsEl.appendChild(
    title
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
    "12px";

  front.style.fontWeight =
    "bold";

  front.style.marginBottom =
    "10px";

  front.style.opacity =
    "0.7";

  front.textContent =
    "DEPAN";


  seatsEl.appendChild(
    front
  );


  // ==========================================================
  // LAYOUT HIACE
  // ==========================================================

  seatsEl.appendChild(

    createSeatRow([
      1,
      2,
      "AISLE",
      "SUPIR"
    ])

  );


  seatsEl.appendChild(

    createSeatRow([
      "SLIDING",
      3,
      4,
      5
    ])

  );


  seatsEl.appendChild(

    createSeatRow([
      "KERNET",
      "AISLE",
      6,
      7
    ])

  );


  seatsEl.appendChild(

    createSeatRow([
      8,
      "AISLE",
      9,
      10
    ])

  );


  seatsEl.appendChild(

    createSeatRow([
      11,
      12,
      13,
      14
    ])

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
  // LEGENDA
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
      🟢 Tersedia
    </span>

    <span>
      🟡 Menunggu pembayaran
    </span>

    <span>
      🔴 Terisi / Lunas
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

    Jam:
    <b>
      ${schedule.displayTime} WIT
    </b>

    <br>

    Harga:
    <b>
      ${rupiah(
        schedule.displayPrice
      )}
    </b>

  `;


  seatsEl.appendChild(
    info
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
      .substring(2, 8)
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
      value ||
      ""
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
      origin ||
      ""
    )
      .trim()
      .toLowerCase();


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


  if (
    !selectedSchedule
  ) {

    alert(
      "Pilih jadwal terlebih dahulu."
    );

    return;

  }


  if (
    !selectedSeat
  ) {

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


  const travelDate =
    dateEl
      ? dateEl.value
      : getLocalDate();


  const vehicle =
    normalizeVehicle(
      selectedSchedule.vehicle
    );


  // ==========================================================
  // DATA BOOKING
  // ==========================================================

  const bookingData = {

    booking_code:
      bookingCode,

    booking_type:
      "online",

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
      vehicle ||
      null

  };


  try {

    const {
      error
    } =
      await db
        .from(
          "bookings"
        )
        .insert(
          bookingData
        );


    if (error) {

      throw error;

    }


    // ========================================================
    // WHATSAPP
    // ========================================================

    const adminNumber =
      getAdminWhatsApp(
        selectedSchedule
          .displayOrigin
      );


    const message = `Halo HSM Transport 👋

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
            margin-top:15px;
            border-radius:10px;
            background:#fff3cd;
          "
        >

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
            ${travelDate}
          </b>

          <br>

          Jam:
          <b>
            ${selectedSchedule.displayTime}
            WIT
          </b>

          <br>

          Armada:
          <b>
            ${vehicle || "-"}
          </b>

          <br>

          Kursi:
          <b>
            ${selectedSeat}
          </b>

          <br>

          Total:
          <b>
            ${rupiah(
              selectedSchedule.displayPrice
            )}
          </b>

          <br><br>

          Status:
          <b>
            Menunggu pembayaran
          </b>


          ${
            adminNumber
              ? `

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
// EVENT DATE
// ============================================================

if (dateEl) {

  dateEl.addEventListener(
    "change",
    () => {

      resetScheduleSelection();


      if (
        fromEl &&
        toEl &&
        fromEl.value &&
        toEl.value
      ) {

        loadSchedules();

      }

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
// INITIALIZE DROPDOWN
// ============================================================

if (fromEl) {

  // Jika index.html belum memilih asal,
  // gunakan Sofifi sebagai default.

  if (
    !fromEl.value
  ) {

    fromEl.value =
      "Sofifi";

  }


  selectedOrigin =
    fromEl.value;

}


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
// INITIAL LOAD
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
      Pilih tujuan terlebih dahulu.
    </div>
  `;

}


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
  () => {

    // Jangan ganggu user yang sedang booking

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


    const route =
      getSelectedRoute();


    if (
      route.origin &&
      route.destination
    ) {

      loadSchedules();

    }

  },
  30000
);
