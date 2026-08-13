const cfg = window.HSM_CONFIG;

let db = null;
let schedules = [];
let selectedSchedule = null;
let selectedSeat = null;


/* =========================
   HARGA RUTE
========================= */

const PRICES = {
  "Sofifi-Weda": 200000,
  "Sofifi-Lelilef": 300000,
  "Weda-Lelilef": 100000,

  "Lelilef-Weda": 100000,
  "Lelilef-Sofifi": 300000,
  "Weda-Sofifi": 200000
};


/* =========================
   FORMAT RUPIAH
========================= */

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}


/* =========================
   AMBIL DATA FORM
========================= */

function getFrom() {
  return document.querySelector("#from")?.value || "";
}

function getTo() {
  return document.querySelector("#to")?.value || "";
}

function getDate() {
  return document.querySelector("#date")?.value || "";
}


/* =========================
   HARGA OTOMATIS
========================= */

function getRoutePrice() {
  const key = getFrom() + "-" + getTo();
  return PRICES[key] || 0;
}


/* =========================
   NORMALISASI VEHICLE
========================= */

function normalizeVehicle(vehicle) {
  const v = String(vehicle || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");

  if (v === "01" || v === "HSM01") {
    return "HSM-01";
  }

  if (v === "02" || v === "HSM02") {
    return "HSM-02";
  }

  return String(vehicle || "");
}


/* =========================
   ERROR
========================= */

function showError(message, error) {
  const el = document.querySelector("#schedule");

  if (el) {
    el.innerHTML = `
      <p class="error">${message}</p>
    `;
  }

  console.error("HSM:", message, error || "");
}


/* =========================
   TENTUKAN VEHICLE
========================= */

function vehicleUntukRute(from, to) {

  // HSM-01
  // Sofifi → Weda → Lelilef

  if (
    from === "Sofifi" &&
    (
      to === "Weda" ||
      to === "Lelilef"
    )
  ) {
    return "HSM-01";
  }


  // HSM-02
  // Lelilef → Weda → Sofifi

  if (
    from === "Lelilef" &&
    (
      to === "Weda" ||
      to === "Sofifi"
    )
  ) {
    return "HSM-02";
  }


  // Weda → Lelilef

  if (
    from === "Weda" &&
    to === "Lelilef"
  ) {
    return "HSM-01";
  }


  // Weda → Sofifi

  if (
    from === "Weda" &&
    to === "Sofifi"
  ) {
    return "HSM-02";
  }

  return null;
}


/* =========================
   LOAD JADWAL
========================= */

async function loadSchedules() {

  selectedSchedule = null;
  selectedSeat = null;

  const scheduleEl =
    document.querySelector("#schedule");

  const seatsEl =
    document.querySelector("#seats");

  const from = getFrom();
  const to = getTo();
  const date = getDate();


  seatsEl.innerHTML = `
    <p class="muted">
      Pilih jadwal terlebih dahulu.
    </p>
  `;


  /* BELUM PILIH RUTE */

  if (!from || !to) {

    scheduleEl.innerHTML = `
      <p class="muted">
        Pilih keberangkatan dan tujuan terlebih dahulu.
      </p>
    `;

    return;
  }


  /* RUTE SAMA */

  if (from === to) {

    scheduleEl.innerHTML = `
      <p class="error">
        Keberangkatan dan tujuan tidak boleh sama.
      </p>
    `;

    return;
  }


  /* BELUM PILIH TANGGAL */

  if (!date) {

    scheduleEl.innerHTML = `
      <p class="muted">
        Pilih tanggal terlebih dahulu.
      </p>
    `;

    return;
  }


  /* HARGA */

  const price = getRoutePrice();

  if (!price) {

    scheduleEl.innerHTML = `
      <p class="error">
        Harga rute belum tersedia.
      </p>
    `;

    return;
  }


  /* VEHICLE */

  const targetVehicle =
    vehicleUntukRute(from, to);

  if (!targetVehicle) {

    scheduleEl.innerHTML = `
      <p class="error">
        Rute belum tersedia.
      </p>
    `;

    return;
  }


  if (!db) {

    showError(
      "Koneksi Supabase belum siap."
    );

    return;
  }


  scheduleEl.innerHTML = `
    <p class="muted">
      Memuat jadwal...
    </p>
  `;


  try {

    const {
      data,
      error
    } = await db
      .from("schedules")
      .select("*")
      .eq("travel_date", date)
      .eq("active", true)
      .order("departure_time");


    if (error) {

      showError(
        "Gagal memuat jadwal: " +
        error.message,
        error
      );

      return;
    }


    /*
      FILTER VEHICLE

      Hanya kendaraan yang sesuai
      dengan arah perjalanan.
    */

    schedules = (data || []).filter(schedule => {

      const vehicle =
        normalizeVehicle(
          schedule.vehicle
        );

      return vehicle === targetVehicle;

    });


    /*
      HILANGKAN DUPLIKAT
    */

    const map = new Map();

    schedules.forEach(schedule => {

      map.set(
        String(schedule.id),
        schedule
      );

    });

    schedules = Array.from(
      map.values()
    );


    /* TIDAK ADA JADWAL */

    if (!schedules.length) {

      scheduleEl.innerHTML = `
        <p class="muted">
          Belum ada jadwal
          ${from} → ${to}
          pada tanggal ${date}.
        </p>
      `;

      return;
    }


    /*
      TAMPILKAN JADWAL
    */

    scheduleEl.innerHTML =
      schedules.map(schedule => {

        const time =
          String(
            schedule.departure_time || ""
          ).slice(0, 5);

        const vehicle =
          normalizeVehicle(
            schedule.vehicle
          );


        return `
          <button
            type="button"
            class="scheduleBtn"
            data-id="${schedule.id}"
          >

            <b>
              ${time}
            </b>

            <small>
              ${from} → ${to}
            </small>

            <small>
              ${vehicle}
            </small>

            <small>
              ${rupiah(price)}
            </small>

          </button>
        `;

      }).join("");


    /*
      EVENT JADWAL
    */

    document
      .querySelectorAll(".scheduleBtn")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            pickSchedule(
              Number(button.dataset.id),
              button
            );

          }
        );

      });

  } catch (error) {

    showError(
      "Terjadi kesalahan saat memuat jadwal.",
      error
    );

  }
}


/* =========================
   PILIH JADWAL
========================= */

async function pickSchedule(
  id,
  button
) {

  selectedSchedule =
    schedules.find(
      schedule =>
        Number(schedule.id) === Number(id)
    );


  selectedSeat = null;


  if (!selectedSchedule) {

    alert(
      "Jadwal tidak ditemukan."
    );

    return;
  }


  document
    .querySelectorAll(".scheduleBtn")
    .forEach(btn =>
      btn.classList.remove("active")
    );


  if (button) {
    button.classList.add("active");
  }


  const seatsEl =
    document.querySelector("#seats");


  seatsEl.innerHTML = `
    <p class="muted">
      Memuat kursi...
    </p>
  `;


  try {

    /*
      AMBIL BOOKING UNTUK
      JADWAL KENDARAAN INI
    */

    const {
      data,
      error
    } = await db
      .from("bookings")
      .select("seat_number")
      .eq(
        "schedule_id",
        selectedSchedule.id
      )
      .neq(
        "payment_status",
        "Batal"
      );


    if (error) {

      seatsEl.innerHTML = `
        <p class="error">
          Gagal memuat kursi:
          ${error.message}
        </p>
      `;

      return;
    }


    const bookedSeats =
      (data || []).map(
        item =>
          Number(item.seat_number)
      );


    /*
      14 KURSI
    */

    seatsEl.innerHTML =
      Array.from(
        { length: 14 },
        (_, index) => {

          const number = index + 1;

          const booked =
            bookedSeats.includes(
              number
            );


          return `
            <button
              type="button"
              class="seat ${
                booked ? "taken" : ""
              }"
              ${
                booked
                  ? "disabled"
                  : ""
              }
              data-seat="${number}"
            >
              Kursi ${number}
              ${
                booked
                  ? " - Sudah dipesan"
                  : ""
              }
            </button>
          `;

        }
      ).join("");


    /*
      PILIH KURSI
    */

    document
      .querySelectorAll(
        ".seat:not(:disabled)"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            selectedSeat =
              Number(
                button.dataset.seat
              );


            document
              .querySelectorAll(".seat")
              .forEach(seat =>
                seat.classList.remove(
                  "selected"
                )
              );


            button.classList.add(
              "selected"
            );

          }
        );

      });

  } catch (error) {

    seatsEl.innerHTML = `
      <p class="error">
        Terjadi kesalahan saat memuat kursi.
      </p>
    `;

    console.error(error);

  }
}


/* =========================
   BOOKING
========================= */

async function createBooking() {

  if (
    !selectedSchedule ||
    !selectedSeat
  ) {

    alert(
      "Pilih jadwal dan kursi terlebih dahulu."
    );

    return;
  }


  const name =
    document
      .querySelector("#name")
      .value
      .trim();


  const phone =
    document
      .querySelector("#phone")
      .value
      .trim();


  if (!name || !phone) {

    alert(
      "Isi nama dan nomor WhatsApp."
    );

    return;
  }


  const price =
    getRoutePrice();


  const code =
    "HSM-" +
    crypto
      .randomUUID()
      .slice(0, 6)
      .toUpperCase();


  const button =
    document.querySelector("#book");


  button.disabled = true;
  button.textContent =
    "Memproses...";


  try {

    /*
      CEK KURSI SEKALI LAGI
    */

    const {
      data: check,
      error: checkError
    } = await db
      .from("bookings")
      .select("seat_number")
      .eq(
        "schedule_id",
        selectedSchedule.id
      )
      .eq(
        "seat_number",
        selectedSeat
      )
      .neq(
        "payment_status",
        "Batal"
      );


    if (checkError) {

      alert(
        "Gagal mengecek kursi: " +
        checkError.message
      );

      return;
    }


    if (
      check &&
      check.length > 0
    ) {

      alert(
        "Kursi tersebut baru saja dipesan orang lain."
      );

      await pickSchedule(
        selectedSchedule.id
      );

      return;
    }


    /*
      SIMPAN BOOKING
    */

    const {
      error
    } = await db
      .from("bookings")
      .insert({

        booking_code:
          code,

        schedule_id:
          selectedSchedule.id,

        passenger_name:
          name,

        phone:
          phone,

        seat_number:
          selectedSeat,

        total:
          price,

        payment_status:
          "Belum Bayar"

      });


    if (error) {

      if (
        error.code === "23505"
      ) {

        alert(
          "Kursi sudah dipesan. Silakan pilih kursi lain."
        );

      } else {

        alert(
          "Booking gagal: " +
          error.message
        );

      }

      return;
    }


    /*
      PESAN WHATSAPP
    */

    const message = [

      "Halo HSM Transport, saya ingin konfirmasi booking.",

      "Kode: " + code,

      "Nama: " + name,

      "Rute: " +
        getFrom() +
        " → " +
        getTo(),

      "Tanggal: " +
        getDate(),

      "Jam: " +
        String(
          selectedSchedule.departure_time || ""
        ).slice(0, 5),

      "Kendaraan: " +
        normalizeVehicle(
          selectedSchedule.vehicle
        ),

      "Kursi: " +
        selectedSeat,

      "Total: " +
        rupiah(price)

    ].join("\n");


    const whatsapp =
      String(
        cfg.WHATSAPP_ADMIN || ""
      ).replace(/\D/g, "");


    /*
      HASIL
    */

    document
      .querySelector("#result")
      .innerHTML = `

        <div class="success">

          <b>
            Booking berhasil!
          </b>

          <strong>
            ${code}
          </strong>

          <p>

            ${getFrom()} →
            ${getTo()}

            <br>

            ${getDate()}

            •
            ${
              String(
                selectedSchedule.departure_time || ""
              ).slice(0, 5)
            }

            <br>

            ${
              normalizeVehicle(
                selectedSchedule.vehicle
              )
            }

            • Kursi ${selectedSeat}

            <br>

            Total:
            ${rupiah(price)}

          </p>

          ${
            whatsapp
              ? `
                <a
                  target="_blank"
                  rel="noopener"
                  href="https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}"
                >
                  Konfirmasi via WhatsApp
                </a>
              `
              : ""
          }

        </div>
      `;


    /*
      REFRESH KURSI
    */

    await pickSchedule(
      selectedSchedule.id
    );


  } catch (error) {

    console.error(error);

    alert(
      "Terjadi kesalahan saat menyimpan booking."
    );

  } finally {

    button.disabled = false;
    button.textContent =
      "Pesan Sekarang";

  }
}


/* =========================
   START HSM
========================= */

async function startHSM() {

  const dateEl =
    document.querySelector("#date");

  const bookButton =
    document.querySelector("#book");


  if (
    !cfg ||
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ) {

    return showError(
      "Config HSM belum lengkap. Periksa config.js."
    );

  }


  if (!window.supabase) {

    return showError(
      "Library Supabase tidak termuat."
    );

  }


  try {

    db =
      window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_PUBLISHABLE_KEY
      );

  } catch (error) {

    return showError(
      "Gagal membuat koneksi Supabase.",
      error
    );

  }


  /*
    TANGGAL HARI INI
  */

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);


  dateEl.min = today;


  /*
    KALAU TANGGAL LAMA
    DIKOSONGKAN
  */

  if (
    dateEl.value &&
    dateEl.value < today
  ) {

    dateEl.value = "";

  }


  /*
    EVENT DARI
  */

  document
    .querySelector("#from")
    .addEventListener(
      "change",
      loadSchedules
    );


  /*
    EVENT KE
  */

  document
    .querySelector("#to")
    .addEventListener(
      "change",
      loadSchedules
    );


  /*
    EVENT TANGGAL
  */

  dateEl.addEventListener(
    "change",
    loadSchedules
  );


  /*
    BUTTON BOOKING
  */

  bookButton.addEventListener(
    "click",
    createBooking
  );


  /*
    PESAN AWAL
  */

  document
    .querySelector("#schedule")
    .innerHTML = `
      <p class="muted">
        Pilih keberangkatan, tujuan dan tanggal terlebih dahulu.
      </p>
    `;

}


/* =========================
   JALANKAN
========================= */

document.addEventListener(
  "DOMContentLoaded",
  startHSM
);
