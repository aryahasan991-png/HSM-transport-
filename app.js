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
      displayOrigin: origin,
      displayDestination: destination,
      displayRoute: `${origin} → ${destination}`,
      displayTime,
      displayPrice: price,
      segmentStart,
      segmentEnd,
      serviceType: "SEGMENT"
    });
  }

  rows.forEach(row => {

    const route = normalizeRoute(row.route);
    const vehicle = normalizeVehicle(row.vehicle);
    const time = formatTime(row.departure_time);


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

      // HSM-01 pagi
      if (
        vehicle === "HSM-01" &&
        time === "09:00"
      ) {
        sofifiTime = "09:00";
        loleoTime = "09:30";
        wedaTime = "11:30";
      }

      // HSM-02 siang
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


      // Sofifi → Weda
      addService(
        row,
        "Sofifi",
        "Weda",
        sofifiTime,
        225000,
        1,
        2
      );

      // Sofifi → Lelilef
      addService(
        row,
        "Sofifi",
        "Lelilef",
        sofifiTime,
        300000,
        1,
        3
      );

      // Loleo → Weda
      addService(
        row,
        "Loleo",
        "Weda",
        loleoTime,
        200000,
        2,
        2
      );

      // Loleo → Lelilef
      addService(
        row,
        "Loleo",
        "Lelilef",
        loleoTime,
        275000,
        2,
        3
      );

      // Weda → Lelilef
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

      // HSM-02 pagi
      if (
        vehicle === "HSM-02" &&
        time === "09:00"
      ) {
        lelilefTime = "09:00";
        wedaTime = "09:45";
      }

      // HSM-01 siang
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


      // Lelilef → Weda
      addService(
        row,
        "Lelilef",
        "Weda",
        lelilefTime,
        100000,
        1,
        1
      );

      // Lelilef → Loleo
      addService(
        row,
        "Lelilef",
        "Loleo",
        lelilefTime,
        275000,
        1,
        2
      );

      // Lelilef → Sofifi
      addService(
        row,
        "Lelilef",
        "Sofifi",
        lelilefTime,
        300000,
        1,
        3
      );

      // Weda → Loleo
      addService(
        row,
        "Weda",
        "Loleo",
        wedaTime,
        200000,
        2,
        2
      );

      // Weda → Sofifi
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
  }// ============================================================
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
// CEK STATUS KURSI BERDASARKAN SEGMENT
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


      // BOOKING BATAL TIDAK MENGUNCI KURSI
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


      // ======================================================
      // CEK APAKAH SEGMENT BERTABRAKAN
      //
      // Contoh:
      // Lelilef → Weda = 1-1
      // Weda → Sofifi = 2-3
      //
      // Tidak overlap, jadi kursi yang sama bisa dipakai lagi.
      // ======================================================

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
// BUAT KURSI PENUMPANG
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

  seat.textContent = number;  const status =
    getSeatStatus(
      number,
      schedule
    );


  seat.dataset.status =
    status;


  // ==========================================================
  // KURSI TERSEDIA
  // ==========================================================

  if (
    status ===
    "available"
  ) {

    seat.classList.add(
      "available"
    );


    seat.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".seat"
          )
          .forEach(
            item => {

              item.classList.remove(
                "selected"
              );

            }
          );


        seat.classList.add(
          "selected"
        );


        selectedSeat =
          number;


        updateBookingSummary();

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

    seat.classList.add(
      "pending"
    );

    seat.disabled =
      true;

    seat.title =
      "Kursi sedang menunggu pembayaran";

  }


  // ==========================================================
  // SUDAH DIBAYAR
  // ==========================================================

  else if (
    status ===
    "paid"
  ) {

    seat.classList.add(
      "paid"
    );

    seat.disabled =
      true;

    seat.title =
      "Kursi sudah terisi";

  }


  return seat;
}


// ============================================================
// LOAD KURSI
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
    // KETERANGAN WARNA
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
    // CABIN / DRIVER
    // ========================================================

    const cabin =
      document.createElement(
        "div"
      );

    cabin.className =
      "seatCabin";

    cabin.innerHTML = `
      <div class="driverSeat">
        SOPIR
      </div>

      <div class="kernetSeat">
        KERNET
      </div>
    `;

    seatsEl.appendChild(
      cabin
    );


    // ========================================================
    // LAYOUT KURSI PENUMPANG
    //
    // 01 02 03
    //
    // 04    05 06
    //
    // 07    08 09
    //
    // 10 11 12 13
    //
    // + kursi 14
    //
    // Sistem nomor tetap mengikuti layout website lama.
    // ========================================================

    const layout =
      document.createElement(
        "div"
      );

    layout.className =
      "seatLayout";


    // BARIS 1
    const row1 =
      document.createElement(
        "div"
      );

    row1.className =
      "seatRow";

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
      createSeat(
        3,
        schedule
      )
    );

    layout.appendChild(
      row1
    );


    // BARIS 2
    const row2 =
      document.createElement(
        "div"
      );

    row2.className =
      "seatRow";

    row2.appendChild(
      createSeat(
        4,
        schedule
      )
    );


    const aisle1 =
      document.createElement(
        "div"
      );

    aisle1.className =
      "seatAisle";

    row2.appendChild(
      aisle1
    );


    row2.appendChild(
      createSeat(
        5,
        schedule
      )
    );

    row2.appendChild(
      createSeat(
        6,
        schedule
      )
    );

    layout.appendChild(
      row2
    );


    // BARIS 3
    const row3 =
      document.createElement(
        "div"
      );

    row3.className =
      "seatRow";

    row3.appendChild(
      createSeat(
        7,
        schedule
      )
    );


    const aisle2 =
      document.createElement(
        "div"
      );

    aisle2.className =
      "seatAisle";

    row3.appendChild(
      aisle2
    );


    row3.appendChild(
      createSeat(
        8,
        schedule
      )
    );

    row3.appendChild(
      createSeat(
        9,
        schedule
      )
    );

    layout.appendChild(
      row3
    );


    // BARIS BELAKANG
    const row4 =
      document.createElement(
        "div"
      );

    row4.className =
      "seatRow seatRowBack";


    [
      10,
      11,
      12,
      13,
      14
    ].forEach(
      number => {

        row4.appendChild(
          createSeat(
            number,
            schedule
          )
        );

      }
    );


    layout.appendChild(
      row4
    );


    seatsEl.appendChild(
      layout
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
        Gagal memuat data kursi.

        <br><br>

        ${error.message}
      </div>
    `;

  }
}


// ============================================================
// UPDATE RINGKASAN PEMESANAN
// ============================================================

function updateBookingSummary() {

  if (!resultEl) {
    return;
  }


  if (
    !selectedSchedule
  ) {

    resultEl.innerHTML = "";

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
// NORMALISASI NOMOR WHATSAPP
// ============================================================

function normalizePhone(
  value
) {

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
// GENERATE KODE BOOKING
// ============================================================

function generateBookingCode() {

  const now =
    new Date();


  const year =
    String(
      now.getFullYear()
    ).slice(-2);


  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );


  const random =
    Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();


  return `HSM${year}${month}${day}${random}`;
      }// ============================================================
// CREATE BOOKING
// ============================================================

async function createBooking() {

  // ==========================================================
  // VALIDASI JADWAL
  // ==========================================================

  if (!selectedSchedule) {

    alert(
      "Pilih jadwal terlebih dahulu."
    );

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

    if (nameEl) {
      nameEl.focus();
    }

    return;
  }


  if (!rawPhone) {

    alert(
      "Masukkan nomor WhatsApp."
    );

    if (phoneEl) {
      phoneEl.focus();
    }

    return;
  }


  const phone =
    normalizePhone(
      rawPhone
    );


  if (
    phone.length < 10
  ) {

    alert(
      "Nomor WhatsApp tidak valid."
    );

    if (phoneEl) {
      phoneEl.focus();
    }

    return;
  }


  // ==========================================================
  // CEK ULANG KURSI SEBELUM BOOKING
  //
  // Ini penting karena bisa saja kursi dipesan orang lain
  // setelah penumpang membuka halaman.
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
      "Gagal mengecek kursi: " +
      error.message
    );


    return;
  }


  // ==========================================================
  // DISABLE TOMBOL
  // ==========================================================

  if (bookBtn) {

    bookBtn.disabled =
      true;

    bookBtn.textContent =
      "Memproses...";

  }


  // ==========================================================
  // BOOKING CODE
  // ==========================================================

  const bookingCode =
    generateBookingCode();


  // ==========================================================
  // DATA YANG DISIMPAN KE SUPABASE
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
      1,

    origin:
      selectedSchedule.displayOrigin,

    destination:
      selectedSchedule.displayDestination

  };


  // ==========================================================
  // INSERT BOOKING
  // ==========================================================

  try {

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


    if (bookBtn) {

      bookBtn.disabled =
        false;

      bookBtn.textContent =
        "Pesan Sekarang";

    }


    return;
  }


  // ==========================================================
  // NOMOR WHATSAPP ADMIN
  // ==========================================================

  let adminNumber =
    HSM_CONFIG.WHATSAPP_ADMIN ||
    "";


  adminNumber =
    String(
      adminNumber
    ).replace(
      /\D/g,
      ""
    );


  if (
    adminNumber.startsWith(
      "0"
    )
  ) {

    adminNumber =
      "62" +
      adminNumber.substring(1);

  }


  // ==========================================================
  // TANGGAL
  // ==========================================================

  const date =
    dateEl
      ? dateEl.value
      : "";


  // ==========================================================
  // FORMAT NOMOR KURSI
  // ==========================================================

  const seatNumber =
    String(
      selectedSeat
    ).padStart(
      2,
      "0"
    );


  // ==========================================================
  // PESAN WHATSAPP
  // ==========================================================

  const message = `
Halo HSM Transport 👋

Saya ingin memesan tiket.

Kode Booking: ${bookingCode}

Nama: ${passengerName}
No. WhatsApp: ${rawPhone}

Rute: ${selectedSchedule.displayOrigin} → ${selectedSchedule.displayDestination}
Tanggal: ${date}
Jam Berangkat: ${selectedSchedule.displayTime}
Kendaraan: ${normalizeVehicle(selectedSchedule.vehicle)}
Kursi: ${seatNumber}

Total: ${rupiah(selectedSchedule.displayPrice)}

Status: Menunggu pembayaran.

Mohon konfirmasi booking saya.
  `.trim();


  // ==========================================================
  // LINK WHATSAPP
  // ==========================================================

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
        border-radius:12px;
        background:#fff3cd;
        line-height:1.6;
      ">

        <strong style="
          font-size:18px;
        ">
          Booking berhasil! 🟡
        </strong>

        <br><br>

        Kode Booking:
        <b>
          ${bookingCode}
        </b>

        <br>

        Nama:
        <b>
          ${passengerName}
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
          ${date}
        </b>

        <br>

        Jam Berangkat:
        <b>
          ${selectedSchedule.displayTime}
        </b>

        <br>

        Kendaraan:
        <b>
          ${normalizeVehicle(
            selectedSchedule.vehicle
          )}
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


  // ==========================================================
  // RESET PILIHAN KURSI
  // ==========================================================

  selectedSeat =
    null;


  // ==========================================================
  // AKTIFKAN TOMBOL
  // ==========================================================

  if (bookBtn) {

    bookBtn.disabled =
      false;

    bookBtn.textContent =
      "Pesan Sekarang";

  }

}// ============================================================
// EVENT TOMBOL BOOKING
// ============================================================

if (bookBtn) {

  bookBtn.addEventListener(
    "click",
    createBooking
  );

}


// ============================================================
// EVENT PERUBAHAN TANGGAL
// ============================================================

if (dateEl) {

  dateEl.addEventListener(
    "change",
    () => {

      selectedSchedule =
        null;

      selectedSeat =
        null;

      if (resultEl) {
        resultEl.innerHTML = "";
      }

      loadSchedules();

    }
  );

}


// ============================================================
// SET TANGGAL MINIMUM
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
// AUTO REFRESH JADWAL
// ============================================================

setInterval(
  () => {

    // Jangan refresh saat user sedang memproses booking
    if (
      bookBtn &&
      bookBtn.disabled
    ) {
      return;
    }

    loadSchedules();

  },
  30000
);
