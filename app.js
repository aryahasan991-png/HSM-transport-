// ============================================================
// HSM TRANSPORT - APP.JS
// ============================================================
// FINAL HIACE ONLY:
// - Dari → Tujuan
// - Jadwal otomatis
// - Jadwal lewat otomatis hilang
// - Harga otomatis
// - Segment kursi
// - 14 kursi + kernet
// - Booking Supabase
// - Kode booking 6 karakter HURUF + ANGKA
// - Status pending
// - Kursi pending = kuning
// - Kursi paid = merah
// - Redirect WhatsApp admin
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
let selectedSeat = null;

let selectedOrigin = "";
let selectedDestination = "";

let currentBookings = [];


// ============================================================
// ROUTES
// ============================================================

const ROUTES = {

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
// UTILITIES
// ============================================================

function rupiah(value) {

  return "Rp" +
    Number(value || 0)
      .toLocaleString("id-ID");

}


function getLocalDate() {

  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;

}


function normalizeRoute(route) {

  if (!route) return "";

  return String(route)
    .trim()
    .replace(/\s+/g, "")
    .replace(/->/g, "→")
    .replace(/–>/g, "→")
    .replace(/—>/g, "→")
    .replace(/→+/g, "→");

}


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


function formatTime(time) {

  if (!time) return "";

  return String(time)
    .substring(0, 5);

}


// ============================================================
// CEK JADWAL LEWAT
// ============================================================

function isScheduleExpired(service) {

  if (!service) {
    return true;
  }

  const travelDate =
    String(
      service.travel_date || ""
    ).trim();

  const departureTime =
    String(
      service.displayTime || ""
    ).substring(0, 5);

  if (
    !travelDate ||
    !departureTime
  ) {
    return false;
  }

  const dateParts =
    travelDate.split("-");

  const timeParts =
    departureTime.split(":");

  if (
    dateParts.length !== 3 ||
    timeParts.length !== 2
  ) {
    return false;
  }

  const departureDateTime =
    new Date(
      Number(dateParts[0]),
      Number(dateParts[1]) - 1,
      Number(dateParts[2]),
      Number(timeParts[0]),
      Number(timeParts[1]),
      0,
      0
    );

  return (
    departureDateTime.getTime() <=
    Date.now()
  );

}


// ============================================================
// RESET
// ============================================================

function resetTripSelection() {

  selectedSchedule = null;
  selectedSeat = null;

  currentBookings = [];

  if (resultEl) {
    resultEl.innerHTML = "";
  }

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

}


// ============================================================
// DESTINATION
// ============================================================

function updateDestinationOptions() {

  if (!fromEl || !toEl) {
    return;
  }

  const origin =
    fromEl.value;

  toEl.innerHTML = `
    <option value="">
      Pilih tujuan
    </option>
  `;

  if (!origin) {

    toEl.disabled = true;

    selectedOrigin = "";
    selectedDestination = "";

    return;

  }

  const destinations =
    ROUTES[origin] || [];

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

  toEl.disabled = false;

  selectedOrigin =
    origin;

  selectedDestination = "";

}


// ============================================================
// FROM
// ============================================================

if (fromEl) {

  fromEl.addEventListener(
    "change",
    () => {

      updateDestinationOptions();

      selectedOrigin =
        fromEl.value;

      selectedDestination = "";

      resetTripSelection();

      loadSchedules();

    }
  );

}


// ============================================================
// TO
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

      resetTripSelection();

      loadSchedules();

    }
  );

}


// ============================================================
// FETCH SCHEDULES
// ============================================================

async function fetchSchedules() {

  const { data, error } =
    await db
      .from("schedules")
      .select("*")
      .eq("active", true)
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

  const services = [];


  function addService(
    row,
    origin,
    destination,
    displayTime,
    price,
    segmentStart,
    segmentEnd
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
        "SEGMENT"

    });

  }


  rows.forEach(row => {

    const route =
      normalizeRoute(
        row.route
      );

    const vehicle =
      normalizeVehicle(
        row.vehicle
      );

    const time =
      formatTime(
        row.departure_time
      );


    // ========================================================
    // SOFIFI → LOLEO → WEDA → LELILEF
    // ========================================================

    if (
      route === "Sofifi→Lelilef" ||
      route === "Sofifi→Weda"
    ) {

      let sofifiTime = null;
      let loleoTime = null;
      let wedaTime = null;


      // HSM-01
      // Sofifi 09:00
      // Loleo 09:30
      // Weda 11:30

      if (
        vehicle === "HSM-01" &&
        time === "09:00"
      ) {

        sofifiTime = "09:00";
        loleoTime = "09:30";
        wedaTime = "11:30";

      }


      // HSM-02
      // Sofifi 13:00
      // Loleo 13:30
      // Weda 15:30

      else if (
        vehicle === "HSM-02" &&
        time === "13:00"
      ) {

        sofifiTime = "13:00";
        loleoTime = "13:30";
        wedaTime = "15:30";

      }


      else {
        return;
      }


      addService(
        row,
        "Sofifi",
        "Weda",
        sofifiTime,
        225000,
        1,
        2
      );

      addService(
        row,
        "Sofifi",
        "Lelilef",
        sofifiTime,
        300000,
        1,
        3
      );

      addService(
        row,
        "Loleo",
        "Weda",
        loleoTime,
        200000,
        2,
        2
      );

      addService(
        row,
        "Loleo",
        "Lelilef",
        loleoTime,
        275000,
        2,
        3
      );

      addService(
        row,
        "Weda",
        "Lelilef",
        wedaTime,
        100000,
        3,
        3
      );

    }


    // ========================================================
    // LELILEF → WEDA → LOLEO → SOFIFI
    // ========================================================

    if (
      route === "Lelilef→Sofifi" ||
      route === "Weda→Sofifi"
    ) {

      let lelilefTime = null;
      let wedaTime = null;


      // HSM-02
      // Lelilef 09:00
      // Weda 09:45

      if (
        vehicle === "HSM-02" &&
        time === "09:00"
      ) {

        lelilefTime = "09:00";
        wedaTime = "09:45";

      }


      // HSM-01
      // Lelilef 13:00
      // Weda 13:45

      else if (
        vehicle === "HSM-01" &&
        time === "13:00"
      ) {

        lelilefTime = "13:00";
        wedaTime = "13:45";

      }


      else {
        return;
      }


      addService(
        row,
        "Lelilef",
        "Weda",
        lelilefTime,
        100000,
        1,
        1
      );

      addService(
        row,
        "Lelilef",
        "Loleo",
        lelilefTime,
        275000,
        1,
        2
      );

      addService(
        row,
        "Lelilef",
        "Sofifi",
        lelilefTime,
        300000,
        1,
        3
      );

      addService(
        row,
        "Weda",
        "Loleo",
        wedaTime,
        200000,
        2,
        2
      );

      addService(
        row,
        "Weda",
        "Sofifi",
        wedaTime,
        225000,
        2,
        3
      );

    }

  });

  return services;

}


// ============================================================
// LOAD SCHEDULES
// ============================================================

async function loadSchedules() {

  if (!scheduleEl) {
    return;
  }


  selectedOrigin =
    fromEl
      ? fromEl.value
      : "";

  selectedDestination =
    toEl
      ? toEl.value
      : "";


  if (!selectedOrigin) {

    scheduleEl.innerHTML = `
      <div style="
        padding:15px;
        text-align:center;
      ">
        Pilih lokasi keberangkatan terlebih dahulu.
      </div>
    `;

    return;

  }


  if (!selectedDestination) {

    scheduleEl.innerHTML = `
      <div style="
        padding:15px;
        text-align:center;
      ">
        Pilih tujuan perjalanan.
      </div>
    `;

    return;

  }


  scheduleEl.innerHTML = `
    <div style="
      padding:15px;
      text-align:center;
    ">
      Memuat jadwal...
    </div>
  `;


  try {

    schedules =
      await fetchSchedules();


    const selectedDate =
      dateEl
        ? dateEl.value
        : "";


    const rows =
      schedules.filter(row => {

        if (
          selectedDate &&
          row.travel_date !==
            selectedDate
        ) {
          return false;
        }

        return true;

      });


    const services =
      buildServices(rows);


    const filtered =
      services.filter(service => {

        const correctRoute =
          service.displayOrigin ===
            selectedOrigin &&
          service.displayDestination ===
            selectedDestination;


        if (!correctRoute) {
          return false;
        }


        if (
          isScheduleExpired(
            service
          )
        ) {
          return false;
        }


        return true;

      });


    scheduleEl.innerHTML = "";


    if (!filtered.length) {

      scheduleEl.innerHTML = `
        <div style="
          padding:15px;
          text-align:center;
        ">
          Jadwal tidak tersedia atau waktu keberangkatan sudah lewat.
        </div>
      `;

      return;

    }


    filtered.forEach(service => {

      const card =
        document.createElement(
          "button"
        );

      card.type =
        "button";

      card.className =
        "schedule-card";


      card.innerHTML = `
        <div class="schedule-time">
          ${service.displayTime}
        </div>

        <div class="schedule-info">

          <strong>
            ${normalizeVehicle(
              service.vehicle
            )}
          </strong>

          <span>
            ${service.displayRoute}
          </span>

          <span>
            ${rupiah(
              service.displayPrice
            )}
          </span>

        </div>
      `;


      card.addEventListener(
        "click",
        async () => {

          document
            .querySelectorAll(
              ".schedule-card"
            )
            .forEach(el => {

              el.classList.remove(
                "selected"
              );

            });


          card.classList.add(
            "selected"
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


      scheduleEl.appendChild(
        card
      );

    });

  }


  catch (error) {

    console.error(
      "SCHEDULE ERROR:",
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
// FETCH SEAT STATUS
// ============================================================

async function fetchBookings(
  scheduleId
) {

  const rpcResult =
    await db.rpc(
      "get_hsm_seat_statuses",
      {
        p_schedule_id:
          scheduleId
      }
    );


  if (!rpcResult.error) {

    return rpcResult.data || [];

  }


  console.warn(
    "RPC seat status gagal, mencoba SELECT:",
    rpcResult.error
  );


  const { data, error } =
    await db
      .from("bookings")
      .select(
        "seat_number,payment_status,segment_start,segment_end"
      )
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
// NORMALIZE STATUS
// ============================================================

function normalizeBookingStatus(
  value
) {

  const status =
    String(value || "")
      .trim()
      .toLowerCase();


  if (
    status === "paid" ||
    status === "success" ||
    status === "settled" ||
    status === "lunas"
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
    status === "failed" ||
    status === "dibatalkan"
  ) {
    return "cancelled";
  }


  return "pending";

}


// ============================================================
// SEAT STATUS
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
      schedule.segmentEnd || 1
    );

  let result =
    "available";


  currentBookings.forEach(
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


      const status =
        normalizeBookingStatus(
          booking.payment_status
        );


      if (
        status === "cancelled" ||
        status === "completed"
      ) {
        return;
      }


      const bookingStart =
        Number(
          booking.segment_start || 1
        );

      const bookingEnd =
        Number(
          booking.segment_end || 1
        );


      const overlap =
        newStart <= bookingEnd &&
        newEnd >= bookingStart;


      if (!overlap) {
        return;
      }


      if (
        status === "paid"
      ) {

        result =
          "paid";

      }

      else if (
        result !== "paid"
      ) {

        result =
          "pending";

      }

    }
  );


  return result;

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
    "seat";

  seat.textContent =
    String(number)
      .padStart(
        2,
        "0"
      );


  const status =
    getSeatStatus(
      number,
      schedule
    );


  seat.dataset.status =
    status;


  if (
    status === "available"
  ) {

    seat.classList.add(
      "available"
    );


    seat.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".seat.available"
          )
          .forEach(el => {

            el.classList.remove(
              "selected"
            );

          });


        seat.classList.add(
          "selected"
        );


        selectedSeat =
          number;


        updateBookingSummary();

      }
    );

  }


  else if (
    status === "pending"
  ) {

    seat.classList.add(
      "pending"
    );

    seat.disabled =
      true;

  }


  else {

    seat.classList.add(
      "paid"
    );

    seat.disabled =
      true;

  }


  return seat;

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


    seatsEl.innerHTML = "";


    // ========================================================
    // LEGEND
    // ========================================================

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
        Menunggu Pembayaran
      </span>

      <span>
        <i class="legendPaid"></i>
        Terisi
      </span>
    `;


    seatsEl.appendChild(
      legend
    );


    // ========================================================
    // BUS BODY
    // ========================================================

    const busLayout =
      document.createElement(
        "div"
      );


    busLayout.style.cssText = `
      width:100%;
      max-width:390px;
      margin:0 auto;
      padding:16px 8px 20px;
      border:2px solid #d1d5db;
      border-radius:18px;
      background:#ffffff;
      box-sizing:border-box;
    `;


    // ========================================================
    // FRONT LABEL
    // ========================================================

    const frontLabel =
      document.createElement(
        "div"
      );


    frontLabel.textContent =
      "DEPAN / KABIN SUPIR";


    frontLabel.style.cssText = `
      text-align:center;
      font-size:11px;
      font-weight:800;
      color:#6b7280;
      margin-bottom:12px;
    `;


    busLayout.appendChild(
      frontLabel
    );


    // ========================================================
    // GRID
    // ========================================================

    const grid =
      document.createElement(
        "div"
      );


    grid.style.cssText = `
      display:grid;
      grid-template-columns:
        54px 54px 54px 54px;
      grid-template-rows:
        48px 20px 48px 48px 48px 48px;
      column-gap:8px;
      row-gap:10px;
      justify-content:center;
      align-items:center;
      position:relative;
    `;


    function placeSeat(
      number,
      column,
      row
    ) {

      const seat =
        createSeat(
          number,
          schedule
        );


      seat.style.gridColumn =
        column;

      seat.style.gridRow =
        row;


      grid.appendChild(
        seat
      );

    }


    // ========================================================
    // DEPAN
    // ========================================================

    placeSeat(
      1,
      2,
      1
    );

    placeSeat(
      2,
      3,
      1
    );


    // ========================================================
    // SOPIR
    // ========================================================

    const driver =
      document.createElement(
        "div"
      );


    driver.textContent =
      "SOPIR";


    driver.style.cssText = `
      grid-column:4;
      grid-row:1;
      width:54px;
      height:48px;
      display:flex;
      align-items:center;
      justify-content:center;
      border-radius:9px;
      background:#111827;
      color:#ffffff;
      font-size:10px;
      font-weight:800;
      box-sizing:border-box;
    `;


    grid.appendChild(
      driver
    );


    // ========================================================
    // PINTU SLIDING
    // ========================================================

    const slidingDoor =
      document.createElement(
        "div"
      );


    slidingDoor.innerHTML = `
      <span>PINTU</span>
      <span>SLIDING</span>
    `;


    slidingDoor.style.cssText = `
      position:absolute;
      left:-4px;
      top:70px;
      width:38px;
      height:105px;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:3px;
      border-left:4px solid #f97316;
      color:#6b7280;
      font-size:8px;
      line-height:1;
      font-weight:800;
      box-sizing:border-box;
    `;


    grid.appendChild(
      slidingDoor
    );


    // ========================================================
    // BARIS 2
    // ========================================================

    placeSeat(
      3,
      2,
      3
    );

    placeSeat(
      4,
      3,
      3
    );

    placeSeat(
      5,
      4,
      3
    );


    // ========================================================
    // KERNET
    // ========================================================

    const kernet =
      document.createElement(
        "div"
      );


    kernet.textContent =
      "KERNET";


    kernet.style.cssText = `
      grid-column:1;
      grid-row:4;
      width:54px;
      height:48px;
      display:flex;
      align-items:center;
      justify-content:center;
      border-radius:9px;
      background:#111827;
      color:#ffffff;
      font-size:9px;
      font-weight:800;
      box-sizing:border-box;
    `;


    grid.appendChild(
      kernet
    );


    // ========================================================
    // BARIS 3
    // ========================================================

    placeSeat(
      6,
      3,
      4
    );

    placeSeat(
      7,
      4,
      4
    );


    // ========================================================
    // BARIS 4
    // ========================================================

    placeSeat(
      8,
      1,
      5
    );

    placeSeat(
      9,
      3,
      5
    );

    placeSeat(
      10,
      4,
      5
    );


    // ========================================================
    // BARIS BELAKANG
    // ========================================================

    placeSeat(
      11,
      1,
      6
    );

    placeSeat(
      12,
      2,
      6
    );

    placeSeat(
      13,
      3,
      6
    );

    placeSeat(
      14,
      4,
      6
    );


    busLayout.appendChild(
      grid
    );


    // ========================================================
    // REAR LABEL
    // ========================================================

    const rearLabel =
      document.createElement(
        "div"
      );


    rearLabel.textContent =
      "BELAKANG";


    rearLabel.style.cssText = `
      margin-top:14px;
      padding-top:8px;
      border-top:1px dashed #d1d5db;
      text-align:center;
      font-size:10px;
      font-weight:800;
      color:#6b7280;
    `;


    busLayout.appendChild(
      rearLabel
    );


    seatsEl.appendChild(
      busLayout
    );


    updateBookingSummary();

  }


  catch (error) {

    console.error(
      "HSM SEAT ERROR:",
      error
    );


    seatsEl.innerHTML = `
      <div style="
        padding:15px;
        color:#b00020;
      ">

        <strong>
          Gagal memuat data kursi.
        </strong>

        <br><br>

        ${error.message}

      </div>
    `;

  }

}


// ============================================================
// BOOKING SUMMARY
// ============================================================

function updateBookingSummary() {

  if (!resultEl) {
    return;
  }


  if (!selectedSchedule) {

    resultEl.innerHTML =
      "";

    return;

  }


  const seatText =
    selectedSeat
      ? `Kursi ${String(
          selectedSeat
        ).padStart(2, "0")}`
      : "Belum memilih kursi";


  resultEl.innerHTML = `
    <div class="bookingSummary">

      <div>
        <strong>Rute</strong>
        <br>
        ${selectedSchedule.displayOrigin}
        →
        ${selectedSchedule.displayDestination}
      </div>

      <div>
        <strong>Jam Berangkat</strong>
        <br>
        ${selectedSchedule.displayTime}
      </div>

      <div>
        <strong>Kendaraan</strong>
        <br>
        ${normalizeVehicle(
          selectedSchedule.vehicle
        )}
      </div>

      <div>
        <strong>Kursi</strong>
        <br>
        ${seatText}
      </div>

      <div>
        <strong>Total</strong>
        <br>
        ${rupiah(
          selectedSchedule.displayPrice
        )}
      </div>

    </div>
  `;

}


// ============================================================
// PHONE
// ============================================================

function normalizePhone(value) {

  let phone =
    String(value || "")
      .replace(/\D/g, "");


  if (
    phone.startsWith("0")
  ) {

    phone =
      "62" +
      phone.substring(1);

  }


  else if (
    phone.startsWith("8")
  ) {

    phone =
      "62" + phone;

  }


  return phone;

}


// ============================================================
// BOOKING CODE
// ============================================================

function generateBookingCode() {

  const letters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";

  const numbers =
    "23456789";

  const all =
    letters + numbers;

  const chars = [];


  // Minimal 1 huruf
  chars.push(
    letters.charAt(
      Math.floor(
        Math.random() *
        letters.length
      )
    )
  );


  // Minimal 1 angka
  chars.push(
    numbers.charAt(
      Math.floor(
        Math.random() *
        numbers.length
      )
    )
  );


  // Isi sampai 6 karakter
  while (
    chars.length < 6
  ) {

    chars.push(
      all.charAt(
        Math.floor(
          Math.random() *
          all.length
        )
      )
    );

  }


  // Acak posisi
  for (
    let i =
      chars.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );


    [
      chars[i],
      chars[j]
    ] = [
      chars[j],
      chars[i]
    ];

  }


  return chars.join("");

}


// ============================================================
// DUPLICATE BOOKING CODE
// ============================================================

function isBookingCodeDuplicate(
  error
) {

  if (!error) {
    return false;
  }


  if (
    String(error.code || "") !==
    "23505"
  ) {
    return false;
  }


  const text = `
    ${error.message || ""}
    ${error.details || ""}
    ${error.hint || ""}
  `.toLowerCase();


  return (
    text.includes(
      "booking_code"
    ) ||
    text.includes(
      "bookings_booking_code"
    )
  );

}


// ============================================================
// INSERT BOOKING
// ============================================================

async function insertBooking(
  bookingData
) {

  for (
    let attempt = 1;
    attempt <= 10;
    attempt++
  ) {

    const bookingCode =
      generateBookingCode();


    const { error } =
      await db
        .from("bookings")
        .insert({
          ...bookingData,
          booking_code:
            bookingCode
        });


    if (!error) {

      return bookingCode;

    }


    console.error(
      "INSERT BOOKING ERROR:",
      error
    );


    if (
      isBookingCodeDuplicate(
        error
      )
    ) {

      continue;

    }


    throw error;

  }


  throw new Error(
    "Tidak berhasil mendapatkan kode booking unik."
  );

}


// ============================================================
// VALIDASI DATA PENUMPANG
// ============================================================

function getPassengerData() {

  const passengerName =
    nameEl
      ? nameEl.value.trim()
      : "";


  const rawPhone =
    phoneEl
      ? phoneEl.value.trim()
      : "";


  if (!passengerName) {

    alert(
      "Masukkan nama penumpang."
    );

    nameEl?.focus();

    return null;

  }


  if (!rawPhone) {

    alert(
      "Masukkan nomor WhatsApp."
    );

    phoneEl?.focus();

    return null;

  }


  const phone =
    normalizePhone(
      rawPhone
    );


  if (
    phone.length < 10 ||
    phone.length > 15
  ) {

    alert(
      "Nomor WhatsApp tidak valid."
    );

    phoneEl?.focus();

    return null;

  }


  return {

    passengerName:
      passengerName,

    rawPhone:
      rawPhone,

    phone:
      phone

  };

}


// ============================================================
// ADMIN NUMBER
// ============================================================

function getAdminNumber() {

  let adminNumber =
    String(
      HSM_CONFIG.WHATSAPP_ADMIN ||
      ""
    )
      .replace(/\D/g, "");


  if (
    adminNumber.startsWith("0")
  ) {

    adminNumber =
      "62" +
      adminNumber.substring(1);

  }


  return adminNumber;

}


// ============================================================
// WHATSAPP
// ============================================================

function redirectWhatsApp(
  message
) {

  const adminNumber =
    getAdminNumber();


  const whatsappURL =
    "https://api.whatsapp.com/send?phone=" +
    encodeURIComponent(
      adminNumber
    ) +
    "&text=" +
    encodeURIComponent(
      message
    );


  setTimeout(
    () => {

      window.location.assign(
        whatsappURL
      );

    },
    250
  );

}


// ============================================================
// BOOKING ERROR
// ============================================================

function handleBookingError(
  error
) {

  console.error(
    "BOOKING ERROR:",
    error
  );


  let errorMessage =
    error?.message ||
    "Terjadi kesalahan saat membuat booking.";


  if (
    errorMessage
      .toLowerCase()
      .includes(
        "row-level security"
      )
  ) {

    errorMessage =
      "Booking ditolak oleh keamanan database Supabase.";

  }


  alert(
    "Booking gagal:\n" +
    errorMessage
  );


  if (bookBtn) {

    bookBtn.disabled =
      false;

    bookBtn.textContent =
      "Pesan Sekarang";

  }

}


// ============================================================
// CREATE BOOKING
// ============================================================

async function createBooking() {

  selectedOrigin =
    fromEl
      ? fromEl.value
      : "";

  selectedDestination =
    toEl
      ? toEl.value
      : "";


  // ==========================================================
  // VALIDASI RUTE
  // ==========================================================

  if (!selectedOrigin) {

    alert(
      "Pilih lokasi keberangkatan."
    );

    return;

  }


  if (!selectedDestination) {

    alert(
      "Pilih tujuan perjalanan."
    );

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


  if (
    isScheduleExpired(
      selectedSchedule
    )
  ) {

    alert(
      "Maaf, waktu keberangkatan untuk jadwal ini sudah lewat."
    );


    resetTripSelection();


    await loadSchedules();

    return;

  }


  // ==========================================================
  // VALIDASI KURSI
  // ==========================================================

  if (!selectedSeat) {

    alert(
      "Pilih kursi terlebih dahulu."
    );

    return;

  }


  // ==========================================================
  // DATA PENUMPANG
  // ==========================================================

  const passenger =
    getPassengerData();


  if (!passenger) {
    return;
  }


  // ==========================================================
  // RECHECK KURSI
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
        "Maaf, kursi tersebut baru saja dipesan oleh penumpang lain."
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
      "SEAT CHECK ERROR:",
      error
    );


    alert(
      "Gagal mengecek kursi:\n" +
      (
        error.message ||
        "Terjadi kesalahan."
      )
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


  // ==========================================================
  // DATA BOOKING
  // ==========================================================

  const travelDate =
    dateEl?.value ||
    selectedSchedule.travel_date;


  const departureTime =
    selectedSchedule.displayTime;


  const vehicle =
    normalizeVehicle(
      selectedSchedule.vehicle
    );


  const bookedSeat =
    selectedSeat;


  const bookingData = {

    // Kolom tambahan hasil update database.
    // Semua booking dari website sekarang adalah Hiace.
    booking_type:
      "hiace",

    schedule_id:
      selectedSchedule.id,

    passenger_name:
      passenger.passengerName,

    phone:
      passenger.phone,

    seat_number:
      bookedSeat,

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
      selectedSchedule.segmentStart ||
      1,

    segment_end:
      selectedSchedule.segmentEnd ||
      1,

    origin:
      selectedSchedule.displayOrigin,

    destination:
      selectedSchedule.displayDestination,

    travel_date:
      travelDate,

    departure_time:
      departureTime,

    // Kolom fleksibel tidak digunakan.
    requested_time:
      null,

    passenger_note:
      null,

    assigned_vehicle_id:
      null,

    vehicle:
      vehicle

  };


  // ==========================================================
  // INSERT SUPABASE
  // ==========================================================

  let bookingCode;


  try {

    bookingCode =
      await insertBooking(
        bookingData
      );

  }


  catch (error) {

    handleBookingError(
      error
    );

    return;

  }


  // ==========================================================
  // BOOKING SUCCESS
  // ==========================================================

  const seatNumber =
    String(bookedSeat)
      .padStart(
        2,
        "0"
      );


  const message = `
*BOOKING BARU HSM TRANSPORT*

*Kode Booking: ${bookingCode}*

Nama: ${passenger.passengerName}
No. WhatsApp: ${passenger.rawPhone}

*DETAIL PERJALANAN*
Dari: ${selectedSchedule.displayOrigin}
Tujuan: ${selectedSchedule.displayDestination}
Tanggal: ${travelDate}
Jam Berangkat: ${departureTime}
Kendaraan: ${vehicle}
Kursi: ${seatNumber}

*Total: ${rupiah(
    selectedSchedule.displayPrice
  )}*

Status: MENUNGGU PEMBAYARAN

Mohon konfirmasi booking saya.
  `.trim();


  // ==========================================================
  // SUCCESS UI
  // ==========================================================

  if (resultEl) {

    resultEl.innerHTML = `
      <div style="
        padding:18px;
        margin-top:15px;
        border-radius:12px;
        background:#fff3cd;
        border:1px solid #ffe69c;
        line-height:1.65;
      ">

        <strong style="
          font-size:18px;
        ">
          Booking berhasil
        </strong>

        <br><br>

        Kode Booking:
        <b>
          ${bookingCode}
        </b>

        <br>

        Rute:
        <b>
          ${selectedSchedule.displayOrigin}
          →
          ${selectedSchedule.displayDestination}
        </b>

        <br>

        Tanggal:
        <b>
          ${travelDate}
        </b>

        <br>

        Jam:
        <b>
          ${departureTime}
        </b>

        <br>

        Kendaraan:
        <b>
          ${vehicle}
        </b>

        <br>

        Kursi:
        <b>
          ${seatNumber}
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
          Menunggu Pembayaran
        </b>

        <br><br>

        Mengarahkan ke WhatsApp...

      </div>
    `;

  }


  // ==========================================================
  // WHATSAPP
  // ==========================================================

  redirectWhatsApp(
    message
  );

}


// ============================================================
// BOOK BUTTON
// ============================================================

if (bookBtn) {

  bookBtn.addEventListener(
    "click",
    createBooking
  );

}


// ============================================================
// DATE CHANGE
// ============================================================

if (dateEl) {

  dateEl.addEventListener(
    "change",
    () => {

      resetTripSelection();

      loadSchedules();

    }
  );

}


// ============================================================
// MINIMUM DATE
// ============================================================

if (dateEl) {

  const today =
    getLocalDate();


  dateEl.min =
    today;


  if (
    !dateEl.value ||
    dateEl.value < today
  ) {

    dateEl.value =
      today;

  }

}


// ============================================================
// INITIAL
// ============================================================

if (fromEl) {

  fromEl.value =
    "";

}


if (toEl) {

  toEl.innerHTML = `
    <option value="">
      Pilih tujuan
    </option>
  `;


  toEl.disabled =
    true;

}


selectedOrigin = "";
selectedDestination = "";


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
  () => {

    // Jangan refresh ketika booking sedang diproses.
    if (
      bookBtn &&
      bookBtn.disabled
    ) {
      return;
    }


    // Kalau user sedang memilih kursi,
    // jangan ganggu pilihannya kecuali jadwal sudah lewat.
    if (
      selectedSchedule
    ) {

      if (
        isScheduleExpired(
          selectedSchedule
        )
      ) {

        resetTripSelection();


        if (
          selectedOrigin &&
          selectedDestination
        ) {

          loadSchedules();

        }

      }


      return;

    }


    // Refresh daftar jadwal jika rute sudah dipilih.
    if (
      selectedOrigin &&
      selectedDestination
    ) {

      loadSchedules();

    }

  },

  30000
);
