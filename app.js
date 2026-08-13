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
   AMBIL RUTE
========================= */

function getFrom() {
  return document.querySelector("#from")?.value || "";
}

function getTo() {
  return document.querySelector("#to")?.value || "";
}

function getPrice() {
  return HARGA[getFrom() + "-" + getTo()] || 0;
}


/* =========================
   CEK RUTE
========================= */

function routeCocok(route, from, to) {

  const text = String(route || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const a = String(from)
    .toLowerCase()
    .trim();

  const b = String(to)
    .toLowerCase()
    .trim();

  if (!text || !a || !b) {
    return false;
  }

  /*
    Contoh:
    Sofifi - Weda - Lelilef

    Maka:
    Sofifi -> Weda       = bisa
    Weda -> Lelilef      = bisa
    Sofifi -> Lelilef    = bisa
  */

  const posisiA = text.indexOf(a);
  const posisiB = text.indexOf(b);

  return posisiA !== -1 &&
         posisiB !== -1 &&
         posisiA < posisiB;
}


/* =========================
   TAMPILKAN ERROR
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

  const dateEl =
    document.querySelector("#date");

  const scheduleEl =
    document.querySelector("#schedule");

  const seatsEl =
    document.querySelector("#seats");

  const from = getFrom();
  const to = getTo();

  seatsEl.innerHTML = `
    <p class="muted">
      Pilih jadwal terlebih dahulu.
    </p>
  `;


  /* RUTE BELUM DIPILIH */

  if (!from || !to) {

    scheduleEl.innerHTML = `
      <p class="muted">
        Pilih keberangkatan, tujuan dan tanggal terlebih dahulu.
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


  /* TANGGAL BELUM DIPILIH */

  if (!dateEl.value) {

    scheduleEl.innerHTML = `
      <p class="muted">
        Pilih tanggal terlebih dahulu.
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
      .eq(
        "travel_date",
        dateEl.value
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
      Simpan semua jadwal
    */

    schedules = data || [];


    /*
      Hanya jadwal yang
      cocok dengan rute
    */

    schedules = schedules.filter(
      s =>
        routeCocok(
          s.route,
          from,
          to
        )
    );


    /*
      Jika tidak ada
    */

    if (!schedules.length) {

      scheduleEl.innerHTML = `
        <p class="muted">
          Tidak ada jadwal
          ${from} → ${to}
          pada tanggal
          ${dateEl.value}.
        </p>
      `;

      return;
    }


    /*
      Harga otomatis
    */

    const price = getPrice();


    /*
      Tampilkan jadwal
    */

    scheduleEl.innerHTML =
      schedules.map(s => {

        const jam =
          String(
            s.departure_time || ""
          ).slice(0, 5);

        return `
          <button
            type="button"
            class="scheduleBtn"
            data-id="${s.id}"
          >

            <b>${jam}</b>

            <small>
              ${from} → ${to}
            </small>

            <small>
              Unit ${s.vehicle || "-"}
            </small>

            <small>
              ${rupiah(price)}
            </small>

          </button>
        `;

      }).join("");


    /*
      Tombol jadwal
    */

    document
      .querySelectorAll(".scheduleBtn")
      .forEach(btn => {

        btn.addEventListener(
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

      });


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
      s =>
        Number(s.id) ===
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
      Ambil kursi yang sudah
      dipesan
    */

    const {
      data,
      error
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
      Nomor kursi terisi
    */

    const used =
      (data || []).map(
        x =>
          Number(
            x.seat_number
          )
      );


    /*
      Buat 14 kursi
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
      Pilih kursi
    */

    document
      .querySelectorAll(
        ".seat:not(:disabled)"
      )
      .forEach(btn => {

        btn.addEventListener(
          "click",
          function() {

            pickSeat(
              Number(
                this.dataset.seat
              ),
              this
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
   PILIH KURSI
========================= */

function pickSeat(
  number,
  button
) {

  selectedSeat = number;


  document
    .querySelectorAll(".seat")
    .forEach(btn =>
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
    document.querySelector("#name")
      .value
      .trim();

  const phone =
    document.querySelector("#phone")
      .value
      .trim();


  if (!name || !phone) {

    alert(
      "Isi nama dan nomor WhatsApp."
    );

    return;
  }


  const from = getFrom();
  const to = getTo();

  const price = getPrice();


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
  button.textContent =
    "Memproses...";


  try {

    /*
      CEK LAGI KURSI

      Supaya dua orang tidak
      bisa mengambil kursi yang sama.
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
        "Kursi ini sudah dipesan. Silakan pilih kursi lain."
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

      "Kode: " + code,

      "Nama: " + name,

      "Rute: " +
        from +
        " → " +
        to,

      "Tanggal: " +
        document.querySelector("#date").value,

      "Jam: " +
        String(
          selectedSchedule.departure_time || ""
        ).slice(0, 5),

      "Unit: " +
        (selectedSchedule.vehicle || "-"),

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

        <b>Booking berhasil!</b>

        <strong>
          ${code}
        </strong>

        <p>

          ${from} → ${to}

          <br>

          Tanggal:
          ${
            document.querySelector(
              "#date"
            ).value
          }

          <br>

          Jam:
          ${
            String(
              selectedSchedule.departure_time || ""
            ).slice(0, 5)
          }

          <br>

          Unit:
          ${
            selectedSchedule.vehicle || "-"
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
      Refresh kursi

      Kursi yang baru dibooking
      langsung menjadi tidak
      bisa dipilih lagi.
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
   MULAI WEBSITE
========================= */

async function startHSM() {

  const dateEl =
    document.querySelector("#date");

  const bookButton =
    document.querySelector("#book");


  /*
    Cek config
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
    Cek Supabase
  */

  if (!window.supabase) {

    return showError(
      "Library Supabase tidak termuat."
    );

  }


  /*
    Buat koneksi
  */

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
    Cek elemen
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
    Tanggal hari ini
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
    Saat pilih Dari
  */

  document
    .querySelector("#from")
    .addEventListener(
      "change",
      loadSchedules
    );


  /*
    Saat pilih Ke
  */

  document
    .querySelector("#to")
    .addEventListener(
      "change",
      loadSchedules
    );


  /*
    Saat pilih tanggal
  */

  dateEl.addEventListener(
    "change",
    loadSchedules
  );


  /*
    Tombol booking
  */

  bookButton.addEventListener(
    "click",
    createBooking
  );


  /*
    Tampilan awal
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
   JALANKAN
========================= */

document.addEventListener(
  "DOMContentLoaded",
  startHSM
);
