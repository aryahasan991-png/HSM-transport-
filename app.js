// ============================================================
// HSM TRANSPORT - APP.JS
// FINAL
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
let isProcessingBooking = false;


// ============================================================
// DESTINATIONS
// ============================================================

const HSM_DESTINATIONS = {
  Sofifi: ["Weda", "Lelilef"],
  Loleo: ["Weda", "Lelilef"],
  Weda: ["Loleo", "Sofifi", "Lelilef"],
  Lelilef: ["Weda", "Loleo", "Sofifi"]
};


// ============================================================
// RUPIAH
// ============================================================

function rupiah(value) {
  return "Rp" + Number(value || 0).toLocaleString("id-ID");
}


// ============================================================
// TANGGAL WIT
// ============================================================

function getLocalDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jayapura",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}


// ============================================================
// WAKTU WIT
// ============================================================

function getCurrentWIT() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jayapura",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}


// ============================================================
// JAM KE MENIT
// ============================================================

function timeToMinutes(time) {
  if (!time) return 0;

  const parts = String(time)
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

function isDeparturePassed(travelDate, departureTime) {
  if (!travelDate || !departureTime) {
    return false;
  }

  const now = getCurrentWIT();
  const date = String(travelDate).substring(0, 10);

  if (date < now.date) {
    return true;
  }

  if (date > now.date) {
    return false;
  }

  const currentMinutes =
    now.hour * 60 + now.minute;

  return (
    currentMinutes >=
    timeToMinutes(departureTime)
  );
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
// FORMAT TIME
// ============================================================

function formatTime(time) {
  if (!time) return "";

  return String(time).substring(0, 5);
}


// ============================================================
// VEHICLE
// ============================================================

function normalizeVehicle(vehicle) {
  if (vehicle === null || vehicle === undefined) {
    return "";
  }

  const value = String(vehicle)
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


function resolveVehicle(row, direction = "") {
  const dbVehicle = normalizeVehicle(row?.vehicle);

  if (dbVehicle) {
    return dbVehicle;
  }

  const time = formatTime(row?.departure_time);

  if (direction === "forward") {
    if (time === "09:00") return "HSM-01";
    if (time === "13:00") return "HSM-02";
  }

  if (direction === "reverse") {
    if (time === "09:00") return "HSM-02";
    if (time === "13:00") return "HSM-01";
  }

  return "";
}


// ============================================================
// BOOKING STATUS
// ============================================================

function getBookingStatus(booking) {
  const status = String(
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

function updateDestinationOptions(keepCurrent = true) {
  if (!fromEl || !toEl) return;

  const origin = String(fromEl.value || "").trim();
  const oldDestination = String(toEl.value || "").trim();

  const destinations =
    HSM_DESTINATIONS[origin] || [];

  toEl.innerHTML = "";

  const placeholder =
    document.createElement("option");

  placeholder.value = "";

  placeholder.textContent =
    origin
      ? "Pilih tujuan"
      : "Pilih lokasi dahulu";

  toEl.appendChild(placeholder);

  if (!origin) {
    toEl.disabled = true;

    selectedOrigin = "";
    selectedDestination = "";

    return;
  }

  destinations.forEach(destination => {
    const option =
      document.createElement("option");

    option.value = destination;
    option.textContent = destination;

    toEl.appendChild(option);
  });

  toEl.disabled =
    destinations.length === 0;

  if (
    keepCurrent &&
    destinations.includes(oldDestination)
  ) {
    toEl.value = oldDestination;
  } else {
    toEl.value = "";
  }

  selectedOrigin = origin;
  selectedDestination = toEl.value || "";
}


// ============================================================
// GET ROUTE
// ============================================================

function getSelectedRoute() {
  return {
    origin: fromEl
      ? String(fromEl.value || "").trim()
      : "",

    destination: toEl
      ? String(toEl.value || "").trim()
      : ""
  };
}


// ============================================================
// RESET
// ============================================================

function resetScheduleSelection() {
  selectedSchedule = null;
  selectedSeat = null;
  currentBookings = [];

  document
    .querySelectorAll(
      ".schedule-card, .scheduleBtn"
    )
    .forEach(button => {
      button.classList.remove(
        "selected",
        "active"
      );
    });

  if (seatsEl) {
    seatsEl.innerHTML = `
      <div style="padding:15px;text-align:center;">
        Pilih jadwal terlebih dahulu.
      </div>
    `;
  }
}


// ============================================================
// ROUTE EVENTS
// ============================================================

if (fromEl) {
  fromEl.addEventListener("change", () => {
    updateDestinationOptions(false);

    resetScheduleSelection();

    if (resultEl) {
      resultEl.innerHTML = "";
    }

    if (scheduleEl) {
      scheduleEl.innerHTML = `
        <div style="padding:15px;text-align:center;">
          Pilih tujuan terlebih dahulu.
        </div>
      `;
    }
  });
}


if (toEl) {
  toEl.addEventListener("change", () => {
    selectedOrigin =
      fromEl ? fromEl.value : "";

    selectedDestination =
      toEl.value;

    resetScheduleSelection();

    if (resultEl) {
      resultEl.innerHTML = "";
    }

    if (
      selectedOrigin &&
      selectedDestination
    ) {
      loadSchedules();
    }
  });
}


// ============================================================
// FETCH SCHEDULES
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
    segmentEnd,
    serviceType,
    vehicle
  ) {
    services.push({
      ...row,

      displayOrigin: origin,
      displayDestination: destination,
      displayRoute: `${origin} → ${destination}`,
      displayTime,
      displayPrice: price,
      segmentStart,
      segmentEnd,
      serviceType,
      displayVehicle: vehicle
    });
  }

  rows.forEach(row => {
    const route =
      normalizeRoute(row.route);

    const time =
      formatTime(row.departure_time);


    // ========================================================
    // SOFIFI -> LOLEO -> WEDA -> LELILEF
    // ========================================================

    if (
      route === "Sofifi→Weda" ||
      route === "Sofifi→Lelilef"
    ) {
      const vehicle =
        resolveVehicle(row, "forward");

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
        "SOFIFI_WEDA",
        vehicle
      );


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


    // ========================================================
    // LELILEF -> WEDA -> LOLEO -> SOFIFI
    // ========================================================

    if (
      route === "Weda→Sofifi" ||
      route === "Lelilef→Sofifi"
    ) {
      const vehicle =
        resolveVehicle(row, "reverse");

      const lelilefTime = time;

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
        "LELILEF_WEDA",
        vehicle
      );


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
  });

  return services;
}


// ============================================================
// FETCH BOOKINGS
// ============================================================

async function fetchBookings(scheduleId) {
  try {
    const { data, error } =
      await db.rpc(
        "get_hsm_seat_statuses",
        {
          p_schedule_id: scheduleId
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


  const { data, error } = await db
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

function getSeatStatusFromBookings(
  seatNumber,
  schedule,
  bookingRows
) {
  const newStart =
    Number(schedule.segmentStart || 1);

  const newEnd =
    Number(schedule.segmentEnd || 1);

  let seatStatus = "available";


  (bookingRows || []).forEach(booking => {
    if (
      Number(booking.seat_number) !==
      Number(seatNumber)
    ) {
      return;
    }


    const bookingStatus =
      getBookingStatus(booking);


    // CANCELLED = KURSI BEBAS

    if (
      bookingStatus === "cancelled"
    ) {
      return;
    }


    const bookingStart =
      Number(
        booking.segment_start || 1
      );

    const bookingEnd =
      Number(
        booking.segment_end ||
        bookingStart
      );


    const overlap =
      bookingStart <= newEnd &&
      bookingEnd >= newStart;


    if (!overlap) {
      return;
    }


    if (
      bookingStatus === "paid" ||
      bookingStatus === "completed"
    ) {
      seatStatus = "paid";
      return;
    }


    if (
      bookingStatus === "pending" &&
      seatStatus !== "paid"
    ) {
      seatStatus = "pending";
    }
  });


  return seatStatus;
}


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
  let available = 0;

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

    if (status === "available") {
      available++;
    }
  }

  return available;
}


// ============================================================
// LOAD SCHEDULES
// ============================================================

async function loadSchedules() {
  if (!scheduleEl) return;

  const selectedDate =
    dateEl
      ? dateEl.value
      : getLocalDate();

  const route =
    getSelectedRoute();

  selectedOrigin = route.origin;
  selectedDestination =
    route.destination;


  if (!route.origin) {
    scheduleEl.innerHTML = `
      <div style="padding:15px;text-align:center;">
        Pilih lokasi keberangkatan terlebih dahulu.
      </div>
    `;
    return;
  }


  if (!route.destination) {
    scheduleEl.innerHTML = `
      <div style="padding:15px;text-align:center;">
        Pilih tujuan terlebih dahulu.
      </div>
    `;
    return;
  }


  if (!selectedDate) {
    scheduleEl.innerHTML = `
      <div style="padding:15px;text-align:center;">
        Pilih tanggal keberangkatan terlebih dahulu.
      </div>
    `;
    return;
  }


  if (
    selectedDate < getLocalDate()
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
    <div style="padding:15px;text-align:center;">
      Memuat jadwal...
    </div>
  `;


  try {
    const rows =
      await fetchSchedules();

    schedules = rows;


    const dateRows =
      rows.filter(row => {
        const rowDate =
          row.travel_date
            ? String(
                row.travel_date
              ).substring(0, 10)
            : "";

        return (
          rowDate === selectedDate
        );
      });


    const allServices =
      buildServices(dateRows);


    const services =
      allServices.filter(service => {
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
      });


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


    if (unique.length === 0) {
      const today =
        selectedDate ===
        getLocalDate();

      scheduleEl.innerHTML = `
        <div style="padding:15px;text-align:center;">

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
                <b>${selectedDate}</b>.
              `
          }

        </div>
      `;

      return;
    }


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
            String(service.id)
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
              String(scheduleId),
              bookings || []
            );
          } catch (error) {
            console.error(
              "AVAILABILITY ERROR:",
              error
            );

            bookingCache.set(
              String(scheduleId),
              null
            );
          }
        }
      )
    );


    scheduleEl.innerHTML = "";


    unique.forEach(service => {
      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "schedule-card scheduleBtn";


      const bookings =
        bookingCache.get(
          String(service.id)
        );


      let availableSeats = null;

      if (Array.isArray(bookings)) {
        availableSeats =
          countAvailableSeats(
            service,
            bookings
          );
      }


      const isFull =
        availableSeats === 0;


      let availabilityHTML = "";


      if (availableSeats === null) {
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
      } else if (isFull) {
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


      if (isFull) {
        button.disabled = true;
        button.style.opacity = "0.62";
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
              .forEach(btn => {
                btn.classList.remove(
                  "selected"
                );
              });


            button.classList.add(
              "selected"
            );


            selectedSchedule =
              service;

            selectedSeat = null;


            if (resultEl) {
              resultEl.innerHTML = "";
            }


            await loadSeats(service);
          }
        );
      }


      scheduleEl.appendChild(
        button
      );
    });

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

function createSeat(number, schedule) {
  const seat =
    document.createElement("button");

  seat.type = "button";

  seat.className =
    "seat seat-passenger";

  seat.textContent = number;

  seat.dataset.seat =
    String(number);


  const status =
    getSeatStatus(
      number,
      schedule
    );


  seat.dataset.status =
    status;


  if (status === "available") {
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
          .forEach(otherSeat => {
            otherSeat.classList.remove(
              "selected"
            );
          });


        seat.classList.add(
          "selected"
        );

        selectedSeat = number;
      }
    );

  } else if (
    status === "pending"
  ) {
    seat.classList.add(
      "pending"
    );

    seat.disabled = true;

    seat.title =
      `Kursi ${number} menunggu pembayaran`;

  } else {
    seat.classList.add(
      "paid"
    );

    seat.disabled = true;

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
    document.createElement("div");

  block.style.width = "48px";
  block.style.height = "45px";
  block.style.boxSizing =
    "border-box";
  block.style.borderRadius = "9px";
  block.style.background =
    background;
  block.style.color = "#fff";
  block.style.display = "flex";
  block.style.alignItems =
    "center";
  block.style.justifyContent =
    "center";
  block.style.fontSize = "9px";
  block.style.fontWeight =
    "bold";
  block.style.textAlign =
    "center";
  block.style.lineHeight =
    "11px";

  block.textContent = label;
  block.title = label;

  return block;
}


function createAisle() {
  const aisle =
    document.createElement("div");

  aisle.style.width = "48px";
  aisle.style.height = "45px";

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
    document.createElement("div");

  row.style.display = "grid";

  row.style.gridTemplateColumns =
    "48px 48px 48px 48px";

  row.style.columnGap = "7px";

  row.style.width = "213px";

  row.style.margin =
    "0 auto 9px";

  row.style.minHeight = "45px";

  row.style.alignItems =
    "center";


  items.forEach(item => {
    if (item === "AISLE") {
      row.appendChild(
        createAisle()
      );
      return;
    }


    if (item === "KERNET") {
      row.appendChild(
        createFixedBlock(
          "KERNET",
          "#111"
        )
      );
      return;
    }


    if (item === "SLIDING") {
      row.appendChild(
        createFixedBlock(
          "PINTU",
          "#111"
        )
      );
      return;
    }


    if (item === "SUPIR") {
      row.appendChild(
        createFixedBlock(
          "SUPIR",
          "#374151"
        )
      );
      return;
    }


    if (typeof item === "number") {
      row.appendChild(
        createSeat(
          item,
          schedule
        )
      );
    }
  });


  return row;
}


// ============================================================
// RENDER SEATS
// ============================================================

function renderSeats(schedule) {
  if (!seatsEl) return;

  seatsEl.innerHTML = "";


  const available =
    countAvailableSeats(
      schedule,
      currentBookings
    );


  const availability =
    document.createElement("div");

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


  const legend =
    document.createElement("div");

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

  seatsEl.appendChild(legend);


  const front =
    document.createElement("div");

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

  seatsEl.appendChild(front);


  // ==========================================================
  // LAYOUT HIACE 14 KURSI
  // ==========================================================

  seatsEl.appendChild(
    createSeatRow(
      [1, 2, "AISLE", "SUPIR"],
      schedule
    )
  );


  seatsEl.appendChild(
    createSeatRow(
      ["SLIDING", 3, 4, 5],
      schedule
    )
  );


  seatsEl.appendChild(
    createSeatRow(
      ["KERNET", "AISLE", 6, 7],
      schedule
    )
  );


  seatsEl.appendChild(
    createSeatRow(
      [8, "AISLE", 9, 10],
      schedule
    )
  );


  seatsEl.appendChild(
    createSeatRow(
      [11, 12, 13, 14],
      schedule
    )
  );


  const back =
    document.createElement("div");

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

  seatsEl.appendChild(back);


  const summary =
    document.createElement("div");

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

  seatsEl.appendChild(summary);
}


// ============================================================
// LOAD SEATS
// ============================================================

async function loadSeats(schedule) {
  if (!seatsEl) return;

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
    <div style="padding:15px;text-align:center;">
      Memuat kursi...
    </div>
  `;


  try {
    currentBookings =
      await fetchBookings(
        schedule.id
      );

    renderSeats(schedule);

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

  return "HSM-" + random;
}


// ============================================================
// WHATSAPP
// ============================================================

function normalizeWhatsApp(value) {
  let number =
    String(value || "")
      .replace(/\D/g, "");

  if (number.startsWith("0")) {
    number =
      "62" +
      number.substring(1);
  }

  return number;
}


function getAdminWhatsApp(origin) {
  const pool =
    String(origin || "")
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
  if (isProcessingBooking) {
    return;
  }


  // ==========================================================
  // VALIDASI
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


  if (!passengerName) {
    alert(
      "Masukkan nama penumpang."
    );

    if (nameEl) {
      nameEl.focus();
    }

    return;
  }


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
      seatStatus !== "available"
    ) {
      alert(
        "Maaf, kursi tersebut baru saja dipesan. Silakan pilih kursi lain."
      );

      selectedSeat = null;

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
  // CEK JAM LAGI
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

  isProcessingBooking = true;


  if (bookBtn) {
    bookBtn.disabled = true;
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
  // BOOKING DATA
  // ==========================================================
  // FLEXIBLE SUDAH TIDAK DIPAKAI
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
    // SIMPAN KE SUPABASE
    // ========================================================

    const { error } = await db
      .from("bookings")
      .insert(bookingData);


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
            encodeURIComponent(message)
          )
        : "";


    // ========================================================
    // BOOKING BERHASIL
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
            ${selectedSchedule.displayTime} WIT
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
    // REFRESH KURSI
    // ========================================================

    selectedSeat = null;

    await loadSeats(
      selectedSchedule
    );


    // ========================================================
    // OTOMATIS BUKA WHATSAPP
    // ========================================================
    // Tidak ada tombol lagi.
    //
    // Booking SUDAH masuk Supabase sebelum WhatsApp dibuka.
    // Jadi jika WA ditutup, booking tetap tercatat dan kursi
    // tetap terkunci sebagai pending.
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

    isProcessingBooking = false;

    if (bookBtn) {
      bookBtn.disabled = false;
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
        resultEl.innerHTML = "";
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
      } else if (scheduleEl) {
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

updateDestinationOptions(true);


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

} else if (scheduleEl) {

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


    // Jadwal yang sedang dipilih
    // tiba-tiba sudah lewat.

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


    // Jangan refresh saat user
    // sedang melakukan booking.

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


    if (
      route.origin &&
      route.destination
    ) {
      loadSchedules();
    }

  },
  30000
);
