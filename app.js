const cfg = window.HSM_CONFIG;

let db = null;
let selectedSchedule = null;
let selectedSeat = null;
let schedules = [];


/* =========================
   HARGA RUTE
========================= */

const PRICES = {
  "Sofifi-Weda": 200000,
  "Sofifi-Lelilef": 300000,
  "Weda-Lelilef": 100000,

  "Lelilef-Weda": 100000,
  "Weda-Sofifi": 200000,
  "Lelilef-Sofifi": 300000
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
   ERROR
========================= */

function showError(message, err) {

  const el = document.querySelector("#schedule");

  if (el) {
    el.innerHTML =
      '<span class="error">' +
      message +
      '</span>';
  }

  console.error(
    "HSM:",
    message,
    err || ""
  );
}


/* =========================
   AMBIL HARGA RUTE
========================= */

function getRouteKey(from, to) {

  return `${from}-${to}`;

}


function getRoutePrice(from, to) {

  return PRICES[
    getRouteKey(from, to)
  ] || 0;

}


/* =========================
   TAMPILKAN HARGA
========================= */

function updatePrice() {

  const from =
    document.querySelector("#from").value;

  const to =
    document.querySelector("#to").value;

  const priceBox =
    document.querySelector("#priceBox");

  if (!priceBox) return;


  if (!from || !to) {

    priceBox.innerHTML = `
      <small>Harga tiket</small>
      <strong>Pilih rute</strong>
    `;

    return;
  }


  if (from === to) {

    priceBox.innerHTML = `
      <small class="error">
        Keberangkatan dan tujuan tidak boleh sama
      </small>
    `;

    return;
  }


  const price =
    getRoutePrice(
      from,
      to
    );


  if (!price) {

    priceBox.innerHTML = `
      <small>Harga tiket</small>
      <strong>Rute tidak tersedia</strong>
    `;

    return;
  }


  priceBox.innerHTML = `
    <small>
      ${from} → ${to}
    </small>

    <strong>
      ${rupiah(price)}
    </strong>
  `;
}


/* =========================
   NORMALISASI ROUTE
========================= */

function normalisasiRoute(route) {

  return String(route || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

}


/* =========================
   CEK ROUTE
========================= */

function routeCocok(route, from, to) {

  const text =
    normalisasiRoute(route);

  const a =
    String(from || "")
      .toLowerCase()
      .trim();

  const b =
    String(to || "")
      .toLowerCase()
      .trim();


  if (!text || !a || !b) {
    return false;
  }


  /*
    Contoh:

    sofifi - weda - lelilef

    Sofifi -> Weda
    Sofifi -> Lelilef
    Weda -> Lelilef

    semuanya dianggap cocok.
  */


  const posisiFrom =
    text.indexOf(a);

  const posisiTo =
    text.indexOf(b);


  return (
    posisiFrom !== -1 &&
    posisiTo !== -1 &&
    posisiFrom < posisiTo
  );

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

  const from =
    document.querySelector("#from").value;

  const to =
    document.querySelector("#to").value;


  updatePrice();


  seatsEl.innerHTML = `
    <p class="muted">
      Pilih jadwal terlebih dahulu.
    </p>
  `;


  /*
    Belum pilih rute
  */

  if (!from || !to) {

    scheduleEl.innerHTML = `
      <p class="muted">
        Pilih rute dan tanggal terlebih dahulu.
      </p>
    `;

    return;
  }


  /*
    Tujuan sama
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
    Belum pilih tanggal
  */

  if (!dateEl.value) {

    scheduleEl.innerHTML = `
      <p class="muted">
        Pilih tanggal terlebih dahulu.
      </p>
    `;

    return;
  }


  /*
    Cek database
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
        error.message +
        " | Code: " +
        (error.code || "-"),
        error
      );

      return;
    }


    /*
      Simpan semua jadwal
    */

    schedules = data || [];


    /*
      Jangan tampilkan tanggal yang sudah lewat
    */

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);


    schedules =
      schedules.filter(
        s =>
          String(
            s.travel_date || ""
          ) >= today
      );


    /*
      Filter berdasarkan route
      SAJA.

      Vehicle tidak dipakai sebagai
      syarat agar jadwal tidak hilang
      kalau vehicle masih NULL.
    */

    const hasil =
      schedules.filter(
        s =>
          routeCocok(
            s.route,
            from,
            to
          )
      );


    /*
      Tidak ada jadwal
    */

    if (!hasil.length) {

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

    const harga =
      getRoutePrice(
        from,
        to
      );


    /*
      Tampilkan jadwal
    */

    scheduleEl.innerHTML =
      hasil.map(
        s => `

        <button
          type="button"
          class="scheduleBtn"
          data-id="${s.id}"
        >

          <b>
            ${String(
              s.departure_time || ""
            ).slice(0, 5)}
          </b>

          <br>

          ${from} → ${to}

          <small>
            🚐 Unit
            ${s.vehicle || "-"}
          </small>

          <small>
            ${rupiah(harga)}
          </small>

        </button>

      `
      ).join("");


    /*
      Event tombol jadwal
    */

    document
      .querySelectorAll(
        ".scheduleBtn"
      )
      .forEach(
        btn => {

          btn.addEventListener(
            "click",
            () =>
              pickSchedule(
                Number(
                  btn.dataset.id
                ),
                btn
              )
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
      x =>
        Number(x.id) ===
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
    Tandai jadwal terpilih
  */

  document
    .querySelectorAll(
      ".scheduleBtn"
    )
    .forEach(
      x =>
        x.classList.remove(
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
      Ambil kursi yang sudah dibooking
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

      seatsEl.innerHTML =
        `<p class="error">
          Gagal memuat kursi:
          ${error.message}
        </p>`;

      return;
    }


    /*
      Nomor kursi yang sudah terisi
    */

    const used =
      (data || [])
        .map(
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
        {
          length: 14
        },
        (_, i) => {

          const n =
            i + 1;

          const taken =
            used.includes(n);


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
              data-seat="${n}"
            >

              Kursi ${n}

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
      Klik kursi
    */

    document
      .querySelectorAll(
        ".seat:not(:disabled)"
      )
      .forEach(
        btn => {

          btn.addEventListener(
            "click",
            () =>
              pickSeat(
                Number(
                  btn.dataset.seat
                ),
                btn
              )
          );

        }
      );


  } catch (e) {

    seatsEl.innerHTML =
      `<p class="error">
        Terjadi kesalahan saat memuat kursi.
      </p>`;

    console.error(e);

  }

}


/* =========================
   PILIH KURSI
========================= */

function pickSeat(
  n,
  button
) {

  selectedSeat = n;


  document
    .querySelectorAll(
      ".seat"
    )
    .forEach(
      x =>
        x.classList.remove(
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

  /*
    Pastikan jadwal + kursi
  */

  if (
    !selectedSchedule ||
    !selectedSeat
  ) {

    alert(
      "Pilih jadwal dan kursi."
    );

    return;
  }


  const from =
    document.querySelector(
      "#from"
    ).value;


  const to =
    document.querySelector(
      "#to"
    ).value;


  const name =
    document.querySelector(
      "#name"
    ).value.trim();


  const phone =
    document.querySelector(
      "#phone"
    ).value.trim();


  /*
    Data penumpang
  */

  if (!name || !phone) {

    alert(
      "Isi nama dan nomor WhatsApp."
    );

    return;
  }


  /*
    Harga otomatis
  */

  const price =
    getRoutePrice(
      from,
      to
    );


  if (!price) {

    alert(
      "Harga rute tidak ditemukan."
    );

    return;
  }


  /*
    Kode booking
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


  const button =
    document.querySelector(
      "#book"
    );


  button.disabled = true;

  button.textContent =
    "Memproses...";


  try {

    /*
      CEK ULANG KURSI

      Ini penting agar dua orang
      tidak berhasil mengambil kursi
      yang sama hampir bersamaan.
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
      Kursi sudah diambil
    */

    if (
      existing &&
      existing.length > 0
    ) {

      alert(
        "Kursi tersebut baru saja dipesan orang lain. Silakan pilih kursi lain."
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


    /*
      Gagal booking
    */

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
      PESAN WHATSAPP
    */

    const msg = [

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
        document.querySelector(
          "#date"
        ).value,

      "Jam: " +
        String(
          selectedSchedule.departure_time ||
          ""
        ).slice(
          0,
          5
        ),

      "Kendaraan: Unit " +
        (
          selectedSchedule.vehicle ||
          "-"
        ),

      "Kursi: " +
        selectedSeat,

      "Total: " +
        rupiah(price)

    ].join("\n");


    /*
      Nomor WhatsApp admin
    */

    const wa =
      String(
        cfg.WHATSAPP_ADMIN || ""
      ).replace(
        /\D/g,
        ""
      );


    /*
      Tampilkan hasil booking
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

          Rute:
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
              selectedSchedule.departure_time ||
              ""
            ).slice(
              0,
              5
            )
          }

          <br>

          Kendaraan:
          Unit ${
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
                href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}"
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
      langsung menjadi tidak tersedia.
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
   START HSM
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
    Cek library Supabase
  */

  if (!window.supabase) {

    return showError(
      "Library Supabase tidak termuat. Periksa koneksi internet."
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
      .slice(
        0,
        10
      );


  dateEl.value =
    dateEl.value ||
    today;


  /*
    Tidak boleh pilih tanggal
    sebelum hari ini.
  */

  dateEl.min =
    today;


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
    EVENT BOOKING
  */

  bookButton.addEventListener(
    "click",
    createBooking
  );


  /*
    Harga awal
  */

  updatePrice();


  /*
    Jangan tampilkan jadwal
    sebelum rute dipilih.
  */

  document.querySelector(
    "#schedule"
  ).innerHTML = `

    <p class="muted">
      Pilih rute dan tanggal terlebih dahulu.
    </p>

  `;

}


/* =========================
   JALANKAN HSM
========================= */

document.addEventListener(
  "DOMContentLoaded",
  startHSM
);
