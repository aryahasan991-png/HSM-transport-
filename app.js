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

let schedules = [];
let selectedSchedule = null;
let selectedSeat = null;


// =====================================================
// HELPER
// =====================================================

function $(id) {
  return document.getElementById(id);
}

function normalizeRoute(value) {
  return String(value || "")
    .trim()
    .replace(/[–—-]/g, "→")
    .replace(/\s*→\s*/g, "→");
}

function normalizeVehicle(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeTime(value) {
  return String(value || "").substring(0, 5);
}

function money(value) {
  return new Intl.NumberFormat("id-ID").format(
    Number(value || 0)
  );
}

function formatDate(date) {
  if (!date) return "-";

  const d = new Date(`${date}T00:00:00`);

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}


// =====================================================
// TANGGAL HARI INI
// =====================================================

function getTodayLocal() {
  const now = new Date();

  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}


// =====================================================
// TAMPILKAN PESAN
// =====================================================

function showScheduleMessage(message) {

  const container = $("schedule");

  if (!container) return;

  container.innerHTML = `
    <p class="muted">
      ${message}
    </p>
  `;
}


// =====================================================
// BANGUN JADWAL DARI DATA SUPABASE
// =====================================================

function buildAvailableSchedules(
  data,
  from,
  to,
  selectedDate
) {

  const requestedRoute =
    `${from}→${to}`;

  const result = [];


  data.forEach((s) => {

    const dbRoute =
      normalizeRoute(s.route);

    const vehicle =
      normalizeVehicle(s.vehicle);

    const time =
      normalizeTime(s.departure_time);


    // ===============================================
    // FILTER TANGGAL
    // ===============================================

    if (
      selectedDate &&
      String(s.travel_date) !==
      String(selectedDate)
    ) {
      return;
    }


    // ===============================================
    // SOFIFI → WEDA
    // ===============================================

    if (
      requestedRoute ===
      "Sofifi→Weda"
    ) {

      if (
        dbRoute !==
        "Sofifi→Weda"
      ) {
        return;
      }


      result.push({
        ...s,

        display_route:
          "Sofifi → Weda",

        display_time:
          time,

        display_price:
          PRICES["Sofifi-Weda"],

        segment_start: 1,
        segment_end: 2,

        base_schedule_id:
          s.id
      });

      return;
    }


    // ===============================================
    // LOLEO → WEDA
    // ===============================================

    if (
      requestedRoute ===
      "Loleo→Weda"
    ) {

      if (
        dbRoute !==
        "Sofifi→Weda"
      ) {
        return;
      }


      // HSM-01 pagi
      if (
        vehicle === "HSM-01" &&
        time === "09:00"
      ) {

        result.push({
          ...s,

          display_route:
            "Loleo → Weda",

          display_time:
            "09:30",

          display_price:
            PRICES["Loleo-Weda"],

          segment_start: 2,
          segment_end: 2,

          base_schedule_id:
            s.id
        });
      }


      // HSM-02 sore
      if (
        vehicle === "HSM-02" &&
        time === "13:00"
      ) {

        result.push({
          ...s,

          display_route:
            "Loleo → Weda",

          display_time:
            "13:30",

          display_price:
            PRICES["Loleo-Weda"],

          segment_start: 2,
          segment_end: 2,

          base_schedule_id:
            s.id
        });
      }

      return;
    }


    // ===============================================
    // WEDA → SOFIFI
    // ===============================================

    if (
      requestedRoute ===
      "Weda→Sofifi"
    ) {

      if (
        dbRoute !==
        "Weda→Sofifi"
      ) {
        return;
      }


      result.push({
        ...s,

        display_route:
          "Weda → Sofifi",

        display_time:
          time,

        display_price:
          PRICES["Weda-Sofifi"],

        segment_start: 1,
        segment_end: 2,

        base_schedule_id:
          s.id
      });

      return;
    }


    // ===============================================
    // WEDA → LOLEO
    // ===============================================

    if (
      requestedRoute ===
      "Weda→Loleo"
    ) {

      if (
        dbRoute !==
        "Weda→Sofifi"
      ) {
        return;
      }


      // HSM-01 sore
      if (
        vehicle === "HSM-01" &&
        time === "13:00"
      ) {

        result.push({
          ...s,

          display_route:
            "Weda → Loleo",

          display_time:
            "13:00",

          display_price:
            PRICES["Weda-Loleo"],

          segment_start: 1,
          segment_end: 1,

          base_schedule_id:
            s.id
        });
      }

      return;
    }

  });


  result.sort((a, b) => {

    const dateCompare =
      String(a.travel_date)
        .localeCompare(
          String(b.travel_date)
        );

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return String(a.display_time)
      .localeCompare(
        String(b.display_time)
      );
  });


  return result;
}


// =====================================================
// LOAD JADWAL
// =====================================================

async function loadSchedules() {

  const from =
    $("from")?.value;

  const to =
    $("to")?.value;

  const date =
    $("date")?.value;


  if (
    !from ||
    !to ||
    from === to
  ) {

    showScheduleMessage(
      "Pilih rute terlebih dahulu."
    );

    return;
  }


  if (!date) {

    showScheduleMessage(
      "Pilih tanggal keberangkatan terlebih dahulu."
    );

    return;
  }


  showScheduleMessage(
    "Memuat jadwal..."
  );


  try {

    /*
      TIDAK menggunakan filter route
      dari query Supabase supaya format
      route di database tidak menjadi masalah.
    */

    const {
      data,
      error
    } = await supabase
      .from("schedules")
      .select("*")
      .eq("active", true)
      .in("vehicle", [
        "HSM-01",
        "HSM-02"
      ])
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

      console.error(
        "SUPABASE ERROR:",
        error
      );

      showScheduleMessage(
        "Gagal mengambil jadwal dari server."
      );

      return;
    }


    console.log(
      "DATA SUPABASE:",
      data
    );


    schedules =
      buildAvailableSchedules(
        data || [],
        from,
        to,
        date
      );


    console.log(
      "HASIL JADWAL:",
      schedules
    );


    renderSchedules();

  } catch (error) {

    console.error(
      "LOAD ERROR:",
      error
    );

    showScheduleMessage(
      "Terjadi kesalahan saat memuat jadwal."
    );
  }
}


// =====================================================
// RENDER JADWAL
// =====================================================

function renderSchedules() {

  const container =
    $("schedule");

  if (!container) {
    console.error(
      "ID #schedule tidak ditemukan."
    );
    return;
  }


  container.innerHTML = "";


  if (!schedules.length) {

    container.innerHTML = `
      <p class="muted">
        Tidak ada jadwal tersedia
        untuk rute dan tanggal tersebut.
      </p>
    `;

    return;
  }


  schedules.forEach(
    (schedule, index) => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";

      button.className =
        "scheduleBtn";


      button.innerHTML = `
        <strong>
          ${schedule.display_time} WIT
        </strong>

        <small>
          ${schedule.display_route}
        </small>

        <small>
          ${schedule.vehicle || ""}
        </small>

        <small>
          Rp ${money(
            schedule.display_price
          )}
        </small>
      `;


      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".scheduleBtn"
            )
            .forEach(
              (btn) => {
                btn.classList.remove(
                  "active"
                );
              }
            );


          button.classList.add(
            "active"
          );


          pilihJadwal(
            schedule
          );

        }
      );


      container.appendChild(
        button
      );

    }
  );
}


// =====================================================
// PILIH JADWAL
// =====================================================

async function pilihJadwal(
  schedule
) {

  selectedSchedule =
    schedule;

  selectedSeat =
    null;


  const baseScheduleId =
    schedule.base_schedule_id ||
    schedule.id;


  try {

    const {
      data: bookings,
      error
    } = await supabase
      .from("bookings")
      .select(`
        seat_number,
        payment_status,
        segment_start,
        segment_end
      `)
      .eq(
        "schedule_id",
        baseScheduleId
      );


    if (error) {

      console.error(
        "BOOKING QUERY ERROR:",
        error
      );

      alert(
        "Gagal mengambil data kursi."
      );

      return;
    }


    const occupiedSeats =
      new Set();


    (
      bookings || []
    ).forEach(
      (booking) => {

        if (
          String(
            booking.payment_status || ""
          ).toLowerCase() ===
          "batal"
        ) {
          return;
        }


        const oldStart =
          Number(
            booking.segment_start || 1
          );

        const oldEnd =
          Number(
            booking.segment_end || 2
          );


        const newStart =
          Number(
            schedule.segment_start || 1
          );

        const newEnd =
          Number(
            schedule.segment_end || 2
          );


        const overlap =
          oldStart <= newEnd &&
          oldEnd >= newStart;


        if (overlap) {

          occupiedSeats.add(
            Number(
              booking.seat_number
            )
          );

        }

      }
    );


    renderSeats(
      occupiedSeats
    );


    const seatContainer =
      $("seats");


    if (seatContainer) {

      seatContainer.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    }

  } catch (error) {

    console.error(
      error
    );

    alert(
      "Terjadi kesalahan saat mengambil kursi."
    );
  }
}


// =====================================================
// RENDER KURSI
// =====================================================

function renderSeats(
  occupiedSeats
) {

  const container =
    $("seats");

  if (!container) return;


  container.innerHTML = "";


  const title =
    document.createElement(
      "p"
    );

  title.className =
    "muted";

  title.innerHTML =
    "Pilih kursi yang tersedia:";

  container.appendChild(
    title
  );


  const grid =
    document.createElement(
      "div"
    );


  grid.style.display =
    "flex";

  grid.style.flexDirection =
    "column";

  grid.style.gap =
    "8px";


  const layout = [

    [1, 2, 3],

    [4, null, 5, 6],

    [7, null, 8, 9],

    [10, 11, 12, 13]

  ];


  layout.forEach(
    (row) => {

      const rowDiv =
        document.createElement(
          "div"
        );


      rowDiv.style.display =
        "grid";

      rowDiv.style.gridTemplateColumns =
        row.length === 4
          ? "1fr 0.35fr 1fr 1fr"
          : "1fr 1fr 1fr";

      rowDiv.style.gap =
        "8px";


      row.forEach(
        (seatNumber) => {

          if (
            seatNumber === null
          ) {

            const aisle =
              document.createElement(
                "div"
              );

            rowDiv.appendChild(
              aisle
            );

            return;
          }


          const seat =
            document.createElement(
              "button"
            );


          seat.type =
            "button";

          seat.textContent =
            seatNumber;


          seat.style.padding =
            "14px 5px";

          seat.style.borderRadius =
            "10px";

          seat.style.border =
            "1px solid #c9daf5";

          seat.style.fontWeight =
            "bold";


          if (
            occupiedSeats.has(
              seatNumber
            )
          ) {

            seat.disabled =
              true;

            seat.textContent =
              `${seatNumber} ✕`;

            seat.style.background =
              "#e5e7eb";

            seat.style.color =
              "#9ca3af";

            seat.style.cursor =
              "not-allowed";

          } else {

            seat.style.background =
              "#eef4ff";

            seat.style.color =
              "#0b4ea2";

            seat.style.cursor =
              "pointer";


            seat.addEventListener(
              "click",
              () => {

                selectSeat(
                  seatNumber
                );

              }
            );

          }


          rowDiv.appendChild(
            seat
          );

        }
      );


      grid.appendChild(
        rowDiv
      );

    }
  );


  container.appendChild(
    grid
  );
}


// =====================================================
// PILIH KURSI
// =====================================================

function selectSeat(
  seatNumber
) {

  selectedSeat =
    seatNumber;


  const container =
    $("seats");


  if (!container) return;


  const buttons =
    container.querySelectorAll(
      "button"
    );


  buttons.forEach(
    (button) => {

      if (
        Number(
          button.textContent
            .replace("✓", "")
            .trim()
        ) ===
        Number(
          seatNumber
        )
      ) {

        button.style.background =
          "#0b4ea2";

        button.style.color =
          "white";

        button.textContent =
          `${seatNumber} ✓`;

      }

    }
  );
}


// =====================================================
// BOOKING CODE
// =====================================================

function generateBookingCode() {

  return (
    "HSM-" +
    Date.now()
      .toString()
      .slice(-8)
  );
}


// =====================================================
// BUAT BOOKING
// =====================================================

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


  const name =
    $("name")?.value?.trim() ||
    "";


  const phone =
    $("phone")?.value?.trim() ||
    "";


  if (!name) {

    alert(
      "Nama penumpang wajib diisi."
    );

    $("name")?.focus();

    return;
  }


  if (!phone) {

    alert(
      "Nomor WhatsApp wajib diisi."
    );

    $("phone")?.focus();

    return;
  }


  const from =
    $("from")?.value ||
    "";

  const to =
    $("to")?.value ||
    "";


  const baseScheduleId =
    selectedSchedule.base_schedule_id ||
    selectedSchedule.id;


  const segmentStart =
    Number(
      selectedSchedule.segment_start || 1
    );

  const segmentEnd =
    Number(
      selectedSchedule.segment_end || 2
    );


  try {

    // ---------------------------------------------
    // CEK JADWAL
    // ---------------------------------------------

    const {
      data: latest,
      error: scheduleError
    } = await supabase
      .from("schedules")
      .select("*")
      .eq(
        "id",
        baseScheduleId
      )
      .eq(
        "active",
        true
      )
      .single();


    if (
      scheduleError ||
      !latest
    ) {

      alert(
        "Jadwal sudah tidak tersedia."
      );

      await loadSchedules();

      return;
    }


    // ---------------------------------------------
    // CEK KURSI
    // ---------------------------------------------

    const {
      data: bookings,
      error: bookingError
    } = await supabase
      .from("bookings")
      .select(`
        seat_number,
        payment_status,
        segment_start,
        segment_end
      `)
      .eq(
        "schedule_id",
        baseScheduleId
      )
      .eq(
        "seat_number",
        selectedSeat
      );


    if (bookingError) {

      console.error(
        bookingError
      );

      alert(
        "Gagal mengecek kursi."
      );

      return;
    }


    const seatTaken =
      (bookings || [])
        .some(
          (booking) => {

            if (
              String(
                booking.payment_status || ""
              ).toLowerCase() ===
              "batal"
            ) {
              return false;
            }


            const oldStart =
              Number(
                booking.segment_start || 1
              );

            const oldEnd =
              Number(
                booking.segment_end || 2
              );


            return (
              oldStart <= segmentEnd &&
              oldEnd >= segmentStart
            );

          }
        );


    if (seatTaken) {

      alert(
        "Kursi baru saja dipesan orang lain."
      );

      await pilihJadwal(
        selectedSchedule
      );

      return;
    }


    // ---------------------------------------------
    // SIMPAN BOOKING
    // ---------------------------------------------

    const bookingCode =
      generateBookingCode();


    const price =
      Number(
        selectedSchedule.display_price ||
        PRICES[
          `${from}-${to}`
        ] ||
        latest.price ||
        0
      );


    const bookingData = {

      booking_code:
        bookingCode,

      schedule_id:
        baseScheduleId,

      passenger_name:
        name,

      phone:
        phone,

      seat_number:
        selectedSeat,

      total:
        price,

      payment_status:
        "Belum Bayar",

      trip_code:
        latest.trip_code ||
        null,

      segment_start:
        segmentStart,

      segment_end:
        segmentEnd,

      origin:
        from,

      destination:
        to
    };


    const {
      error: insertError
    } = await supabase
      .from("bookings")
      .insert([
        bookingData
      ]);


    if (insertError) {

      console.error(
        "INSERT BOOKING ERROR:",
        insertError
      );

      alert(
        "Booking gagal: " +
        insertError.message
      );

      return;
    }


    // ---------------------------------------------
    // WHATSAPP
    // ---------------------------------------------

    const message = `
Halo Admin HSM Transport,

Saya ingin melakukan pemesanan tiket.

Kode Booking: ${bookingCode}

Nama: ${name}
No. WhatsApp: ${phone}

Rute: ${from} → ${to}
Tanggal: ${formatDate(
      latest.travel_date
    )}
Jam: ${selectedSchedule.display_time} WIT
Kendaraan: ${latest.vehicle || "-"}
Kursi: ${selectedSeat}

Total: Rp ${money(price)}

Status: Belum Bayar

Mohon konfirmasi booking saya.
`.trim();


    const waUrl =
      "https://wa.me/" +
      WHATSAPP_ADMIN +
      "?text=" +
      encodeURIComponent(
        message
      );


    // ---------------------------------------------
    // HASIL BOOKING
    // ---------------------------------------------

    const result =
      $("result");


    if (result) {

      result.innerHTML = `
        <div class="success">

          <div>Booking berhasil!</div>

          <strong>
            ${bookingCode}
          </strong>

          <div>
            ${from} → ${to}
          </div>

          <div>
            Kursi ${selectedSeat}
          </div>

          <div>
            Total Rp ${money(price)}
          </div>

          <a
            href="${waUrl}"
            target="_blank"
            rel="noopener"
          >
            Konfirmasi via WhatsApp
          </a>

        </div>
      `;

      result.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    } else {

      alert(
        `Booking berhasil!\n\nKode: ${bookingCode}`
      );

      window.open(
        waUrl,
        "_blank"
      );

    }


    selectedSeat =
      null;


    await pilihJadwal(
      selectedSchedule
    );

  } catch (error) {

    console.error(
      error
    );

    alert(
      "Terjadi kesalahan: " +
      error.message
    );
  }
}


// =====================================================
// TOMBOL PESAN
// =====================================================

function setupBookButton() {

  const button =
    $("book");


  if (!button) {

    console.error(
      "Tombol #book tidak ditemukan."
    );

    return;
  }


  button.addEventListener(
    "click",
    createBooking
  );
}


// =====================================================
// ROUTE SELECT
// =====================================================

function setupRouteSelector() {

  const from =
    $("from");

  const to =
    $("to");

  const date =
    $("date");


  if (from) {

    from.addEventListener(
      "change",
      loadSchedules
    );

  }


  if (to) {

    to.addEventListener(
      "change",
      loadSchedules
    );

  }


  if (date) {

    date.addEventListener(
      "change",
      loadSchedules
    );

  }
}


// =====================================================
// SET DEFAULT TANGGAL
// =====================================================

function setupDate() {

  const date =
    $("date");


  if (!date) return;


  if (!date.value) {

    date.value =
      getTodayLocal();

  }


  date.min =
    getTodayLocal();
}


// =====================================================
// REFRESH
// =====================================================

function startRefresh() {

  setInterval(
    () => {

      const from =
        $("from")?.value;

      const to =
        $("to")?.value;

      const date =
        $("date")?.value;


      if (
        from &&
        to &&
        date
      ) {

        loadSchedules();

      }

    },
    30000
  );
}


// =====================================================
// START APP
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupDate();

    setupRouteSelector();

    setupBookButton();

    startRefresh();

    console.log(
      "HSM Transport App aktif."
    );

  }
);
