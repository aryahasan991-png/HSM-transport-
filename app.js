const cfg = window.HSM_CONFIG;

let db = null;
let schedules = [];
let selectedSchedule = null;
let selectedSeat = null;


/* =========================
   HARGA
========================= */

const HARGA = {
  "Sofifi-Weda": 200000,
  "Sofifi-Lelilef": 300000,
  "Weda-Lelilef": 100000,
  "Lelilef-Weda": 100000,
  "Lelilef-Sofifi": 300000,
  "Weda-Sofifi": 200000
};


/* =========================
   RUPIAH
========================= */

function rupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);
}


/* =========================
   FORM
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

function getPrice() {
  return HARGA[
    getFrom() + "-" + getTo()
  ] || 0;
}


/* =========================
   NORMALISASI VEHICLE
========================= */

function normalVehicle(value) {

  const v = String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();

  if (v === "01" || v === "HSM01") {
    return "01";
  }

  if (v === "02" || v === "HSM02") {
    return "02";
  }

  return v;
}


/* =========================
   NORMALISASI ROUTE
========================= */

function normalRoute(route) {

  return String(route || "")
    .replace(/[–—-]/g, "→")
    .replace(/\s*→\s*/g, "→")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}


/* =========================
   PECAH ROUTE
========================= */

function routeParts(route) {

  return normalRoute(route)
    .split("→")
    .map(x => x.trim())
    .filter(Boolean);
}


/* =========================
   CEK APAKAH PERJALANAN
   MELEWATI KOTA YANG DIPILIH
========================= */

function routeCocok(route, from, to) {

  const parts = routeParts(route);

  const dari = from.toLowerCase();
  const ke = to.toLowerCase();

  const a = parts.indexOf(dari);
  const b = parts.indexOf(ke);

  /*
    Harus dari kiri ke kanan.
  */

  if (a === -1 || b === -1) {
    return false;
  }

  return a < b;
}


/* =========================
   UNIT YANG BENAR
========================= */

function unitUntukRute(from, to) {

  /*
    Unit 01:
    Sofifi → Weda → Lelilef
  */

  if (
    from === "Sofifi" &&
    (
      to === "Weda" ||
      to === "Lelilef"
    )
  ) {
    return "01";
  }


  /*
    Unit 02:
    Lelilef → Weda → Sofifi
  */

  if (
    from === "Lelilef" &&
    (
      to === "Weda" ||
      to === "Sofifi"
    )
  ) {
    return "02";
  }


  /*
    Weda → Lelilef
  */

  if (
    from === "Weda" &&
    to === "Lelilef"
  ) {
    return "01";
  }


  /*
    Weda → Sofifi
  */

  if (
    from === "Weda" &&
    to === "Sofifi"
  ) {
    return "02";
  }


  return null;
}


/* =========================
   ERROR
========================= */

function showError(message, err) {

  const el = document.querySelector("#schedule");

  if (el) {
    el.innerHTML =
      '<p class="error">' +
      message +
      '</p>';
  }

  console.error("HSM:", message, err || "");
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


  /*
    RUTE
  */

  if (!from || !to) {

    scheduleEl.innerHTML = `
      <p class="muted">
        Pilih keberangkatan dan tujuan terlebih dahulu.
      </p>
    `;

    return;
  }


  /*
    KOTA SAMA
  */

  if (from === to) {

    scheduleEl.innerHTML = `
      <p class="error">
        Keberangkatan dan tujuan tidak boleh sama.
      </p>
    `;

    return;
  }


  /*
    TANGGAL
  */

  if (!date) {

    scheduleEl.innerHTML = `
      <p class="muted">
        Pilih tanggal terlebih dahulu.
      </p>
    `;

    return;
  }


  /*
    HARGA
  */

  const price = getPrice();

  if (!price) {

    scheduleEl.innerHTML = `
      <p class="error">
        Harga rute belum tersedia.
      </p>
    `;

    return;
  }


  /*
    UNIT
  */

  const unit = unitUntukRute(
    from,
    to
  );


  if (!unit) {

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

    /*
      Ambil semua jadwal
      tanggal tersebut.
    */

    const {
      data,
      error
    } = await db
      .from("schedules")
      .select("*")
      .eq(
        "travel_date",
        date
      )
      .eq(
        "active",
        true
      )
      .order(
        "departure_time"
      );


    if (error) {

      showError(
        "Gagal memuat jadwal: " +
        error.message,
        error
      );

      return;
    }


    /*
      FILTER:
      1. vehicle
      2. arah perjalanan
    */

    schedules =
      (data || []).filter(
        schedule => {

          const kendaraan =
            normalVehicle(
              schedule.vehicle
            );

          const cocokUnit =
            kendaraan === unit;


          const cocokArah =
            routeCocok(
              schedule.route,
              from,
              to
            );


          return (
            cocokUnit &&
            cocokArah
          );

        }
      );


    /*
      HILANGKAN DUPLIKAT
    */

    const unique =
      new Map();

    schedules.forEach(
      schedule => {

        const key =
          String(
            schedule.id
          );

        if (!unique.has(key)) {
          unique.set(
            key,
            schedule
          );
        }

      }
    );


    schedules =
      Array.from(
        unique.values()
      );


    /*
      TIDAK ADA
    */

    if (!schedules.length) {

      scheduleEl.innerHTML = `
        <p class="muted">
          Tidak ada jadwal
          ${from} → ${to}
          pada tanggal ${date}.
        </p>
      `;

      return;
    }


    /*
      TAMPILKAN
    */

    scheduleEl.innerHTML =
      schedules.map(
        schedule => {

          const jam =
            String(
              schedule.departure_time ||
              ""
            ).slice(
              0,
              5
            );


          const kendaraan =
            normalVehicle(
              schedule.vehicle
            );


          return `
            <button
              type="button"
              class="scheduleBtn"
              data-id="${schedule.id}"
            >

              <b>
                ${jam}
              </b>

              <small>
                ${from} → ${to}
              </small>

              <small>
                HSM ${kendaraan}
              </small>

              <small>
                ${rupiah(price)}
              </small>

            </button>
          `;

        }
      ).join("");


    /*
      KLIK JADWAL
    */

    document
      .querySelectorAll(
        ".scheduleBtn"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            function() {

              pickSchedule(
                Number(
                  this.dataset.id
                ),
                this
              );

            }
          );

        }
      );


  } catch (e) {

    showError(
      "Terjadi kesalahan saat memuat jadwal.",
      e
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
        Number(schedule.id) ===
        Number(id)
    );


  selectedSeat = null;


  if (!selectedSchedule) {

    alert(
      "Jadwal tidak ditemukan."
    );

    return;
  }


  document
    .querySelectorAll(
      ".scheduleBtn"
    )
    .forEach(
      btn =>
        btn.classList.remove(
          "active"
        )
    );


  if (button) {
    button.classList.add(
      "active"
    );
  }


  const seatsEl =
    document.querySelector(
      "#seats"
    );


  seatsEl.innerHTML = `
    <p class="muted">
      Memuat kursi...
    </p>
  `;


  try {

    /*
      BOOKING UNTUK
      JADWAL INI SAJA
    */

    const {
      data,
      error
    } = await db
      .from("bookings")
      .select(
        "seat_number"
      )
      .eq(
        "schedule_id",
        id
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


    const used =
      (data || []).map(
        item =>
          Number(
            item.seat_number
          )
      );


    /*
      14 KURSI
    */

    seatsEl.innerHTML =
      Array.from(
        {
          length: 14
        },
        (_, i) => {

          const number = i + 1;

          const taken =
            used.includes(
              number
            );


          return `
            <button
              type="button"
              class="seat ${
                taken
                  ? "taken"
                  : ""
              }"
              ${
                taken
                  ? "disabled"
                  : ""
              }
              data-seat="${number}"
            >

              Kursi ${number}

              ${
                taken
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
      .forEach(
        button => {

          button.addEventListener(
            "click",
            function() {

              selectedSeat =
                Number(
                  this.dataset.seat
                );


              document
                .querySelectorAll(
                  ".seat"
                )
                .forEach(
                  btn =>
                    btn.classList.remove(
                      "selected"
                    )
                );


              this.classList.add(
                "selected"
              );

            }
          );

        }
      );


  } catch (e) {

    seatsEl.innerHTML = `
      <p class="error">
        Terjadi kesalahan saat memuat kursi.
      </p>
    `;

    console.error(e);

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
    getPrice();


  const code =
    "HSM-" +
    crypto
      .randomUUID()
      .slice(
        0,
        6
      )
      .toUpperCase();


  const button =
    document.querySelector(
      "#book"
    );


  button.disabled = true;
  button.textContent =
    "Memproses...";


  try {

    /*
      CEK KURSI TERBARU
    */

    const {
      data: cek,
      error: cekError
    } = await db
      .from("bookings")
      .select(
        "seat_number"
      )
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


    if (cekError) {

      alert(
        "Gagal mengecek kursi: " +
        cekError.message
      );

      return;
    }


    if (
      cek &&
      cek.length
    ) {

      alert(
        "Kursi sudah dipesan orang lain."
      );

      await pickSchedule(
        selectedSchedule.id
      );

      return;
    }


    /*
      SIMPAN
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

      alert(
        "Booking gagal: " +
        error.message
      );

      return;
    }


    /*
      WHATSAPP
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
          selectedSchedule.departure_time ||
          ""
        ).slice(
          0,
          5
        ),

      "Unit: HSM " +
        normalVehicle(
          selectedSchedule.vehicle
        ),

      "Kursi: " +
        selectedSeat,

      "Total: " +
        rupiah(price)

    ].join("\n");


    const wa =
      String(
        cfg.WHATSAPP_ADMIN || ""
      ).replace(
        /\D/g,
        ""
      );


    /*
      HASIL BOOKING
    */

    document
      .querySelector(
        "#result"
      )
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
              selectedSchedule.departure_time ||
              ""
            ).slice(
              0,
              5
            )
          }

          <br>

          HSM ${
            normalVehicle(
              selectedSchedule.vehicle
            )
          }

          •
          Kursi ${selectedSeat}

          <br>

          Total:
          ${rupiah(price)}

        </p>


        ${
          wa
            ? `
              <a
                target="_blank"
                rel="noopener"
                href="https://wa.me/${wa}?text=${encodeURIComponent(message)}"
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


  } catch (e) {

    console.error(e);

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
   START
========================= */

async function startHSM() {

  const dateEl =
    document.querySelector(
      "#date"
    );

  const bookButton =
    document.querySelector(
      "#book"
    );


  if (
    !cfg ||
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ) {

    return showError(
      "Config HSM belum lengkap."
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

  } catch (e) {

    return showError(
      "Gagal membuat koneksi Supabase.",
      e
    );

  }


  /*
    TANGGAL HARI INI
  */

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );


  dateEl.min =
    today;


  /*
    JANGAN MEMILIH
    TANGGAL LAMA
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
    .querySelector(
      "#from"
    )
    .addEventListener(
      "change",
      loadSchedules
    );


  /*
    EVENT KE
  */

  document
    .querySelector(
      "#to"
    )
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
    BOOKING
  */

  bookButton.addEventListener(
    "click",
    createBooking
  );


  /*
    AWAL
  */

  document.querySelector(
    "#schedule"
  ).innerHTML = `
    <p class="muted">
      Pilih keberangkatan, tujuan dan tanggal terlebih dahulu.
    </p>
  `;
}


document.addEventListener(
  "DOMContentLoaded",
  startHSM
);
