const cfg = window.HSM_CONFIG;

let db = null;
let selectedSchedule = null;
let selectedSeat = null;
let schedules = [];


/* =========================
   HARGA RUTE
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
   FORMAT RUPIAH
========================= */

function rupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);
}


/* =========================
   AMBIL PILIHAN
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
   HARGA
========================= */

function getPrice() {
  return HARGA[
    getFrom() + "-" + getTo()
  ] || 0;
}


/* =========================
   VEHICLE
========================= */

/*
   UNIT 01
   Sofifi → Weda → Lelilef

   UNIT 02
   Lelilef → Weda → Sofifi
*/

function vehicleCocok(vehicle, from, to) {

  const v = String(vehicle || "")
    .trim()
    .toLowerCase();


  /* =====================
     UNIT 01
  ===================== */

  if (v === "01" || v === "1") {

    if (
      from === "Sofifi" &&
      (
        to === "Weda" ||
        to === "Lelilef"
      )
    ) {
      return true;
    }

    if (
      from === "Weda" &&
      to === "Lelilef"
    ) {
      return true;
    }

    return false;
  }


  /* =====================
     UNIT 02
  ===================== */

  if (v === "02" || v === "2") {

    if (
      from === "Lelilef" &&
      (
        to === "Weda" ||
        to === "Sofifi"
      )
    ) {
      return true;
    }

    if (
      from === "Weda" &&
      to === "Sofifi"
    ) {
      return true;
    }

    return false;
  }


  return false;
}


/* =========================
   ERROR
========================= */

function showError(message, err) {

  const el =
    document.querySelector("#schedule");

  if (el) {

    el.innerHTML = `
      <p class="error">
        ${message}
      </p>
    `;

  }

  console.error(
    "HSM:",
    message,
    err || ""
  );
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


  /*
     Reset kursi
  */

  seatsEl.innerHTML = `
    <p class="muted">
      Pilih jadwal terlebih dahulu.
    </p>
  `;


  /*
     BELUM PILIH RUTE
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
     BELUM PILIH TANGGAL
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
     CEK DATABASE
  */

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
       Ambil jadwal pada tanggal
       yang dipilih.
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
       FILTER HANYA DENGAN VEHICLE
    */

    schedules =
      (data || []).filter(
        schedule =>
          vehicleCocok(
            schedule.vehicle,
            from,
            to
          )
      );


    /*
       TIDAK ADA JADWAL
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
       HARGA
    */

    const price =
      getPrice();


    /*
       TAMPILKAN JADWAL
    */

    scheduleEl.innerHTML =
      schedules.map(
        schedule => {

          const jam =
            String(
              schedule.departure_time || ""
            ).slice(
              0,
              5
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
                Unit ${schedule.vehicle || "-"}
              </small>

              <small>
                ${rupiah(price)}
              </small>

            </button>
          `;

        }
      ).join("");


    /*
       EVENT PILIH JADWAL
    */

    document
      .querySelectorAll(
        ".scheduleBtn"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              pickSchedule(
                Number(
                  button.dataset.id
                ),
                button
              );

            }
          );

        }
      );


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


  /*
     Tandai jadwal aktif
  */

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
       Ambil kursi yang sudah
       dipesan untuk jadwal ini.
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


    /*
       Nomor kursi yang sudah
       terisi.
    */

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
        (_, index) => {

          const number =
            index + 1;

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
       EVENT KURSI
    */

    document
      .querySelectorAll(
        ".seat:not(:disabled)"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              pickSeat(
                Number(
                  button.dataset.seat
                ),
                button
              );

            }
          );

        }
      );


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
   PILIH KURSI
========================= */

function pickSeat(
  number,
  button
) {

  selectedSeat =
    number;


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


  if (button) {

    button.classList.add(
      "selected"
    );

  }
}


/* =========================
   BUAT BOOKING
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


  const from =
    getFrom();

  const to =
    getTo();

  const date =
    getDate();


  const price =
    getPrice();


  if (!price) {

    alert(
      "Harga rute tidak ditemukan."
    );

    return;
  }


  /*
     KODE BOOKING
  */

  const code =
    "HSM-" +
    crypto
      .randomUUID()
      .slice(
        0,
        6
      )
      .toUpperCase();


  const bookButton =
    document.querySelector(
      "#book"
    );


  bookButton.disabled =
    true;

  bookButton.textContent =
    "Memproses...";


  try {

    /*
       CEK KURSI LAGI
    */

    const {
      data: existing,
      error: checkError
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


    if (checkError) {

      alert(
        "Gagal mengecek kursi: " +
        checkError.message
      );

      return;
    }


    /*
       KURSI SUDAH DIAMBIL
    */

    if (
      existing &&
      existing.length
    ) {

      alert(
        "Kursi tersebut sudah dipesan orang lain. Silakan pilih kursi lain."
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

      alert(
        error.code === "23505"
          ? "Kursi sudah dipesan orang lain. Silakan pilih kursi lain."
          : "Booking gagal: " +
            error.message
      );

      return;
    }


    /*
       WHATSAPP
    */

    const message = [

      "Halo HSM Transport, saya ingin konfirmasi booking.",

      "Kode: " +
        code,

      "Nama: " +
        name,

      "Rute: " +
        from +
        " → " +
        to,

      "Tanggal: " +
        date,

      "Jam: " +
        String(
          selectedSchedule.departure_time ||
          ""
        ).slice(
          0,
          5
        ),

      "Unit: " +
        (
          selectedSchedule.vehicle ||
          "-"
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

          ${from} → ${to}

          <br>

          Tanggal:
          ${date}

          <br>

          Jam:
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

          Unit:
          ${
            selectedSchedule.vehicle ||
            "-"
          }

          <br>

          Kursi:
          ${selectedSeat}

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
            : `
              <p class="error">
                Nomor WhatsApp admin belum diisi di config.js.
              </p>
            `
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

    bookButton.disabled =
      false;

    bookButton.textContent =
      "Pesan Sekarang";

  }
}


/* =========================
   MULAI HSM
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


  /*
     CEK CONFIG
  */

  if (
    !cfg ||
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ) {

    return showError(
      "Config HSM belum lengkap. Periksa config.js."
    );

  }


  /*
     CEK SUPABASE
  */

  if (!window.supabase) {

    return showError(
      "Library Supabase tidak termuat. Periksa koneksi internet."
    );

  }


  /*
     BUAT KONEKSI
  */

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
     CEK ELEMEN
  */

  if (
    !dateEl ||
    !bookButton
  ) {

    return showError(
      "Elemen halaman HSM tidak lengkap."
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


  if (!dateEl.value) {
    dateEl.value =
      today;
  }


  /*
     PILIH DARI
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
     PILIH KE
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
     PILIH TANGGAL
  */

  dateEl.addEventListener(
    "change",
    loadSchedules
  );


  /*
     TOMBOL BOOKING
  */

  bookButton.addEventListener(
    "click",
    createBooking
  );


  /*
     TAMPILAN AWAL
  */

  document.querySelector(
    "#schedule"
  ).innerHTML = `

    <p class="muted">
      Pilih keberangkatan, tujuan dan tanggal terlebih dahulu.
    </p>

  `;

}


/* =========================
   JALANKAN WEBSITE
========================= */

document.addEventListener(
  "DOMContentLoaded",
  startHSM
);
