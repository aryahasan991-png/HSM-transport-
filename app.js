const cfg = window.HSM_CONFIG;

let db = null;
let schedules = [];
let selectedSchedule = null;
let selectedSeat = null;


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
   AMBIL DATA FORM
========================= */

function from() {
  return document.querySelector("#from").value;
}

function to() {
  return document.querySelector("#to").value;
}

function date() {
  return document.querySelector("#date").value;
}

function harga() {
  return HARGA[from() + "-" + to()] || 0;
}


/* =========================
   ERROR
========================= */

function error(message) {

  const el = document.querySelector("#schedule");

  if (el) {
    el.innerHTML = `
      <p class="error">${message}</p>
    `;
  }

  console.error("HSM:", message);
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


  seatsEl.innerHTML = `
    <p class="muted">
      Pilih jadwal terlebih dahulu.
    </p>
  `;


  /*
    WAJIB PILIH RUTE
  */

  if (!from() || !to()) {

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

  if (from() === to()) {

    scheduleEl.innerHTML = `
      <p class="error">
        Keberangkatan dan tujuan tidak boleh sama.
      </p>
    `;

    return;
  }


  /*
    WAJIB PILIH TANGGAL
  */

  if (!date()) {

    scheduleEl.innerHTML = `
      <p class="muted">
        Pilih tanggal terlebih dahulu.
      </p>
    `;

    return;
  }


  if (!db) {

    error(
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
      PENTING:

      Tidak ada filter route.
      Tidak ada filter vehicle.

      Semua jadwal pada tanggal
      tersebut diambil.
    */

    const {
      data,
      error: dbError
    } = await db
      .from("schedules")
      .select("*")
      .eq(
        "travel_date",
        date()
      )
      .eq(
        "active",
        true
      )
      .order(
        "departure_time"
      );


    if (dbError) {

      error(
        "Gagal memuat jadwal: " +
        dbError.message
      );

      return;
    }


    schedules = data || [];


    /*
      TIDAK ADA JADWAL
    */

    if (!schedules.length) {

      scheduleEl.innerHTML = `
        <p class="muted">
          Tidak ada jadwal pada tanggal ${date()}.
        </p>
      `;

      return;
    }


    /*
      HARGA DARI RUTE
    */

    const price = harga();


    /*
      TAMPILKAN SEMUA JADWAL
    */

    scheduleEl.innerHTML =
      schedules.map(schedule => {

        const jam =
          String(
            schedule.departure_time || ""
          ).slice(0, 5);


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
              ${from()} → ${to()}
            </small>

            <small>
              Unit ${schedule.vehicle || "-"}
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
              Number(
                button.dataset.id
              ),
              button
            );

          }
        );

      });


  } catch (e) {

    error(
      "Terjadi kesalahan saat memuat jadwal."
    );

    console.error(e);

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
      s =>
        Number(s.id) === Number(id)
    );


  selectedSeat = null;


  if (!selectedSchedule) {

    alert(
      "Jadwal tidak ditemukan."
    );

    return;
  }


  /*
    Tandai jadwal
  */

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
      AMBIL BOOKING

      Kursi berdasarkan
      schedule_id.
    */

    const {
      data,
      error: dbError
    } = await db
      .from("bookings")
      .select("seat_number")
      .eq(
        "schedule_id",
        id
      )
      .neq(
        "payment_status",
        "Batal"
      );


    if (dbError) {

      seatsEl.innerHTML = `
        <p class="error">
          Gagal memuat kursi:
          ${dbError.message}
        </p>
      `;

      return;
    }


    /*
      KURSI YANG SUDAH TERISI
    */

    const used =
      (data || []).map(
        x =>
          Number(
            x.seat_number
          )
      );


    /*
      14 KURSI
    */

    seatsEl.innerHTML =
      Array.from(
        { length: 14 },
        (_, i) => {

          const number = i + 1;

          const taken =
            used.includes(number);


          return `
            <button
              type="button"
              class="seat ${
                taken ? "taken" : ""
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
              .forEach(btn =>
                btn.classList.remove(
                  "selected"
                )
              );


            button.classList.add(
              "selected"
            );

          }
        );

      });


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


  const price = harga();


  if (!price) {

    alert(
      "Harga rute tidak ditemukan."
    );

    return;
  }


  const code =
    "HSM-" +
    crypto
      .randomUUID()
      .slice(0, 6)
      .toUpperCase();


  const button =
    document.querySelector("#book");


  button.disabled = true;
  button.textContent = "Memproses...";


  try {

    /*
      CEK KURSI SEKALI LAGI
    */

    const {
      data: cek,
      error: cekError
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


    if (cekError) {

      alert(
        "Gagal mengecek kursi: " +
        cekError.message
      );

      return;
    }


    if (
      cek &&
      cek.length > 0
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
      SIMPAN
    */

    const {
      error: insertError
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


    if (insertError) {

      alert(
        insertError.code === "23505"
          ? "Kursi sudah dipesan orang lain."
          : "Booking gagal: " +
            insertError.message
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
        from() +
        " → " +
        to(),

      "Tanggal: " +
        date(),

      "Jam: " +
        String(
          selectedSchedule.departure_time ||
          ""
        ).slice(0, 5),

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
      HASIL
    */

    document.querySelector(
      "#result"
    ).innerHTML = `

      <div class="success">

        <b>
          Booking berhasil!
        </b>

        <strong>
          ${code}
        </strong>

        <p>

          Rute:
          ${from()} → ${to()}

          <br>

          Tanggal:
          ${date()}

          <br>

          Jam:
          ${
            String(
              selectedSchedule.departure_time ||
              ""
            ).slice(0, 5)
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
   MULAI
========================= */

async function startHSM() {

  const dateEl =
    document.querySelector("#date");

  const bookButton =
    document.querySelector("#book");


  /*
    CONFIG
  */

  if (
    !cfg ||
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ) {

    return error(
      "Config HSM belum lengkap. Periksa config.js."
    );

  }


  /*
    SUPABASE
  */

  if (!window.supabase) {

    return error(
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

    return error(
      "Gagal membuat koneksi Supabase."
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


  if (!dateEl.value) {
    dateEl.value = today;
  }


  /*
    PILIH DARI
  */

  document
    .querySelector("#from")
    .addEventListener(
      "change",
      loadSchedules
    );


  /*
    PILIH KE
  */

  document
    .querySelector("#to")
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
    BOOKING
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


document.addEventListener(
  "DOMContentLoaded",
  startHSM
);
