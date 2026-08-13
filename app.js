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
   ELEMENT
========================= */

function el(id) {
  return document.getElementById(id);
}


/* =========================
   HARGA OTOMATIS
========================= */

function hargaRute() {

  const from = el("from").value;
  const to = el("to").value;

  return HARGA[from + "-" + to] || 0;
}


/* =========================
   ROUTE DATABASE
========================= */

function routeDatabase(from, to) {

  /*
    Pilihan user:
    Sofifi → Weda
    Database:
    Sofifi → Weda → Lelilef
  */

  if (from === "Sofifi" && to === "Weda") {
    return "Sofifi → Weda → Lelilef";
  }


  /*
    Sofifi → Lelilef
  */

  if (from === "Sofifi" && to === "Lelilef") {
    return "Sofifi → Weda → Lelilef";
  }


  /*
    Weda → Lelilef
  */

  if (from === "Weda" && to === "Lelilef") {
    return "Sofifi → Weda → Lelilef";
  }


  /*
    Lelilef → Weda
  */

  if (from === "Lelilef" && to === "Weda") {
    return "Lelilef → Weda → Sofifi";
  }


  /*
    Lelilef → Sofifi
  */

  if (from === "Lelilef" && to === "Sofifi") {
    return "Lelilef → Weda → Sofifi";
  }


  /*
    Weda → Sofifi
  */

  if (from === "Weda" && to === "Sofifi") {
    return "Lelilef → Weda → Sofifi";
  }


  return null;
}


/* =========================
   LOAD JADWAL
========================= */

async function loadSchedules() {

  selectedSchedule = null;
  selectedSeat = null;

  const scheduleBox = el("schedule");
  const seatsBox = el("seats");

  const from = el("from").value;
  const to = el("to").value;
  const date = el("date").value;


  seatsBox.innerHTML = `
    <p class="muted">
      Pilih jadwal terlebih dahulu.
    </p>
  `;


  if (!from || !to) {

    scheduleBox.innerHTML = `
      <p class="muted">
        Pilih keberangkatan dan tujuan terlebih dahulu.
      </p>
    `;

    return;
  }


  if (from === to) {

    scheduleBox.innerHTML = `
      <p class="error">
        Keberangkatan dan tujuan tidak boleh sama.
      </p>
    `;

    return;
  }


  if (!date) {

    scheduleBox.innerHTML = `
      <p class="muted">
        Pilih tanggal terlebih dahulu.
      </p>
    `;

    return;
  }


  const price = hargaRute();

  if (!price) {

    scheduleBox.innerHTML = `
      <p class="error">
        Harga rute belum tersedia.
      </p>
    `;

    return;
  }


  const dbRoute = routeDatabase(from, to);

  if (!dbRoute) {

    scheduleBox.innerHTML = `
      <p class="error">
        Rute belum tersedia.
      </p>
    `;

    return;
  }


  scheduleBox.innerHTML = `
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
      .eq("route", dbRoute)
      .order("departure_time");


    if (error) {

      scheduleBox.innerHTML = `
        <p class="error">
          Gagal memuat jadwal:<br>
          ${error.message}
        </p>
      `;

      console.error(error);

      return;
    }


    schedules = data || [];


    if (!schedules.length) {

      scheduleBox.innerHTML = `
        <p class="muted">
          Belum ada jadwal untuk
          ${from} → ${to}
          pada ${date}.
        </p>
      `;

      return;
    }


    /*
      TAMPILKAN JADWAL
    */

    scheduleBox.innerHTML =
      schedules.map(schedule => {

        const jam =
          String(
            schedule.departure_time || ""
          ).substring(0, 5);


        const vehicle =
          schedule.vehicle || "";


        return `
          <button
            type="button"
            class="scheduleBtn"
            data-id="${schedule.id}"
          >

            <b>${jam}</b>

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
      EVENT PILIH JADWAL
    */

    document
      .querySelectorAll(".scheduleBtn")
      .forEach(button => {

        button.addEventListener(
          "click",
          function() {

            pickSchedule(
              Number(this.dataset.id),
              this
            );

          }
        );

      });

  } catch (error) {

    console.error(error);

    scheduleBox.innerHTML = `
      <p class="error">
        Terjadi kesalahan saat memuat jadwal.
      </p>
    `;
  }
}


/* =========================
   PILIH JADWAL
========================= */

async function pickSchedule(id, button) {

  selectedSchedule =
    schedules.find(
      item =>
        Number(item.id) === Number(id)
    );


  selectedSeat = null;


  if (!selectedSchedule) {

    alert("Jadwal tidak ditemukan.");

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


  const seatsBox = el("seats");


  seatsBox.innerHTML = `
    <p class="muted">
      Memuat kursi...
    </p>
  `;


  try {

    /*
      AMBIL KURSI YANG SUDAH BOOKING
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

      seatsBox.innerHTML = `
        <p class="error">
          Gagal memuat kursi:<br>
          ${error.message}
        </p>
      `;

      console.error(error);

      return;
    }


    const booked =
      (data || []).map(
        item =>
          Number(item.seat_number)
      );


    /*
      14 KURSI
    */

    seatsBox.innerHTML =
      Array.from(
        { length: 14 },
        (_, i) => {

          const number = i + 1;

          const sudahDipesan =
            booked.includes(number);


          return `
            <button
              type="button"
              class="seat ${
                sudahDipesan
                  ? "taken"
                  : ""
              }"
              ${
                sudahDipesan
                  ? "disabled"
                  : ""
              }
              data-seat="${number}"
            >
              Kursi ${number}
              ${
                sudahDipesan
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
          function() {

            selectedSeat =
              Number(
                this.dataset.seat
              );


            document
              .querySelectorAll(".seat")
              .forEach(seat =>
                seat.classList.remove(
                  "selected"
                )
              );


            this.classList.add(
              "selected"
            );

          }
        );

      });

  } catch (error) {

    console.error(error);

    seatsBox.innerHTML = `
      <p class="error">
        Terjadi kesalahan saat memuat kursi.
      </p>
    `;
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
    el("name").value.trim();


  const phone =
    el("phone").value.trim();


  if (!name || !phone) {

    alert(
      "Isi nama dan nomor WhatsApp."
    );

    return;
  }


  const price =
    hargaRute();


  const code =
    "HSM-" +
    crypto
      .randomUUID()
      .substring(0, 6)
      .toUpperCase();


  const button = el("book");

  button.disabled = true;
  button.textContent =
    "Memproses...";


  try {

    /*
      CEK LAGI KURSI
    */

    const {
      data: cek,
      error: cekError
    } = await db
      .from("bookings")
      .select("id")
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


    if (cek && cek.length) {

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

        booking_code: code,

        schedule_id:
          selectedSchedule.id,

        passenger_name: name,

        phone: phone,

        seat_number:
          selectedSeat,

        total: price,

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

    const wa =
      String(
        cfg.WHATSAPP_ADMIN || ""
      ).replace(/\D/g, "");


    const pesan = [
      "Halo HSM Transport, saya ingin konfirmasi booking.",
      "Kode: " + code,
      "Nama: " + name,
      "Rute: " +
        el("from").value +
        " → " +
        el("to").value,
      "Tanggal: " +
        el("date").value,
      "Jam: " +
        String(
          selectedSchedule.departure_time || ""
        ).substring(0, 5),
      "Kendaraan: " +
        (selectedSchedule.vehicle || ""),
      "Kursi: " +
        selectedSeat,
      "Total: " +
        rupiah(price)
    ].join("\n");


    el("result").innerHTML = `

      <div class="success">

        <b>Booking berhasil!</b>

        <strong>
          ${code}
        </strong>

        <p>

          ${el("from").value}
          →
          ${el("to").value}

          <br>

          ${el("date").value}

          •
          ${
            String(
              selectedSchedule.departure_time || ""
            ).substring(0, 5)
          }

          <br>

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
                href="https://wa.me/${wa}?text=${encodeURIComponent(pesan)}"
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
      "Terjadi kesalahan saat booking."
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

  if (
    !cfg ||
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ) {

    showError(
      "Config HSM belum lengkap."
    );

    return;
  }


  if (!window.supabase) {

    showError(
      "Library Supabase tidak termuat."
    );

    return;
  }


  try {

    db =
      window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_PUBLISHABLE_KEY
      );

  } catch (error) {

    showError(
      "Gagal membuat koneksi Supabase.",
      error
    );

    return;
  }


  const today =
    new Date()
      .toISOString()
      .substring(0, 10);


  const dateInput = el("date");


  dateInput.min = today;


  /*
    KALAU TANGGAL YANG TERSIMPAN
    SUDAH LEWAT, KOSONGKAN
  */

  if (
    dateInput.value &&
    dateInput.value < today
  ) {

    dateInput.value = "";

  }


  /*
    EVENT RUTE
  */

  el("from")
    .addEventListener(
      "change",
      loadSchedules
    );


  el("to")
    .addEventListener(
      "change",
      loadSchedules
    );


  dateInput
    .addEventListener(
      "change",
      loadSchedules
    );


  /*
    BOOKING
  */

  el("book")
    .addEventListener(
      "click",
      createBooking
    );


  /*
    PESAN AWAL
  */

  el("schedule").innerHTML = `
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
