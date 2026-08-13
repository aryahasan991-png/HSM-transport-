const cfg = window.HSM_CONFIG;

let db = null;
let schedules = [];
let selectedSchedule = null;
let selectedSeat = null;


/* =========================
   HARGA
========================= */

const PRICES = {
  "Sofifi-Weda": 200000,
  "Weda-Sofifi": 200000,
  "Weda-Lelilef": 100000,
  "Lelilef-Weda": 100000,
  "Sofifi-Lelilef": 300000,
  "Lelilef-Sofifi": 300000
};


/* =========================
   ELEMENT
========================= */

function $(id) {
  return document.getElementById(id);
}


/* =========================
   RUPIAH
========================= */

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}


/* =========================
   NORMALISASI RUTE
========================= */

function cleanRoute(route) {

  return String(route || "")
    .replace(/[–—]/g, "→")
    .replace(/\s*→\s*/g, "→")
    .trim();
}


/* =========================
   WAKTU
========================= */

function jam(time) {

  return String(time || "")
    .substring(0, 5);
}


/* =========================
   HARGA RUTE
========================= */

function getPrice(from, to) {

  return PRICES[
    from + "-" + to
  ] || 0;
}


/* =========================
   CARI PERJALANAN
=========================

   Untuk rute panjang:

   Sofifi → Lelilef
   menggunakan:
   Sofifi → Weda
   lalu
   Weda → Lelilef

   Lelilef → Sofifi
   menggunakan:
   Lelilef → Weda
   lalu
   Weda → Sofifi
*/


function buildTrips(from, to) {

  const result = [];

  /* -------------------------
     SOFIFI → WEDA
  ------------------------- */

  if (
    from === "Sofifi" &&
    to === "Weda"
  ) {

    schedules
      .filter(s =>
        cleanRoute(s.route) === "Sofifi→Weda"
      )
      .forEach(s => {

        result.push({
          main: s,
          from: from,
          to: to,
          departure: s.departure_time,
          price: 200000,
          vehicle: s.vehicle
        });

      });

    return result;
  }


  /* -------------------------
     WEDA → LELILEF
  ------------------------- */

  if (
    from === "Weda" &&
    to === "Lelilef"
  ) {

    schedules
      .filter(s =>
        cleanRoute(s.route) === "Weda→Lelilef"
      )
      .forEach(s => {

        result.push({
          main: s,
          from: from,
          to: to,
          departure: s.departure_time,
          price: 100000,
          vehicle: s.vehicle
        });

      });

    return result;
  }


  /* -------------------------
     LELILEF → WEDA
  ------------------------- */

  if (
    from === "Lelilef" &&
    to === "Weda"
  ) {

    schedules
      .filter(s =>
        cleanRoute(s.route) === "Lelilef→Weda"
      )
      .forEach(s => {

        result.push({
          main: s,
          from: from,
          to: to,
          departure: s.departure_time,
          price: 100000,
          vehicle: s.vehicle
        });

      });

    return result;
  }


  /* -------------------------
     WEDA → SOFIFI
  ------------------------- */

  if (
    from === "Weda" &&
    to === "Sofifi"
  ) {

    schedules
      .filter(s =>
        cleanRoute(s.route) === "Weda→Sofifi"
      )
      .forEach(s => {

        result.push({
          main: s,
          from: from,
          to: to,
          departure: s.departure_time,
          price: 200000,
          vehicle: s.vehicle
        });

      });

    return result;
  }


  /* =========================
     SOFIFI → LELILEF
  ========================= */

  if (
    from === "Sofifi" &&
    to === "Lelilef"
  ) {

    const firstLeg =
      schedules.filter(s =>
        cleanRoute(s.route) === "Sofifi→Weda"
      );


    firstLeg.forEach(first => {

      const second =
        schedules.find(s =>

          cleanRoute(s.route) ===
          "Weda→Lelilef"

          &&

          s.vehicle === first.vehicle

          &&

          String(s.travel_date) ===
          String(first.travel_date)

          &&

          String(s.departure_time) >
          String(first.departure_time)

        );


      if (second) {

        result.push({

          main: first,

          second: second,

          from: from,

          to: to,

          departure:
            first.departure_time,

          arrival:
            second.departure_time,

          price: 300000,

          vehicle:
            first.vehicle

        });

      }

    });

    return result;
  }


  /* =========================
     LELILEF → SOFIFI
  ========================= */

  if (
    from === "Lelilef" &&
    to === "Sofifi"
  ) {

    const firstLeg =
      schedules.filter(s =>
        cleanRoute(s.route) ===
        "Lelilef→Weda"
      );


    firstLeg.forEach(first => {

      const second =
        schedules.find(s =>

          cleanRoute(s.route) ===
          "Weda→Sofifi"

          &&

          s.vehicle === first.vehicle

          &&

          String(s.travel_date) ===
          String(first.travel_date)

          &&

          String(s.departure_time) >
          String(first.departure_time)

        );


      if (second) {

        result.push({

          main: first,

          second: second,

          from: from,

          to: to,

          departure:
            first.departure_time,

          arrival:
            second.departure_time,

          price: 300000,

          vehicle:
            first.vehicle

        });

      }

    });

    return result;
  }


  return result;
}


/* =========================
   LOAD DATA JADWAL
========================= */

async function loadSchedules() {

  selectedSchedule = null;
  selectedSeat = null;

  const scheduleBox = $("schedule");
  const seatsBox = $("seats");

  const from = $("from").value;
  const to = $("to").value;
  const date = $("date").value;


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


    const trips =
      buildTrips(from, to);


    if (!trips.length) {

      scheduleBox.innerHTML = `
        <p class="muted">
          Tidak ada jadwal ${from} → ${to}
          pada tanggal ${date}.
        </p>
      `;

      return;
    }


    /* =========================
       TAMPILKAN JADWAL
    ========================= */

    scheduleBox.innerHTML =
      trips.map((trip, index) => {

        const arrival =
          trip.arrival
            ? `<small>Weda: ${jam(trip.arrival)}</small>`
            : "";


        return `

          <button
            type="button"
            class="scheduleBtn"
            data-trip="${index}"
          >

            <b>
              Berangkat ${jam(trip.departure)}
            </b>

            ${arrival}

            <small>
              ${trip.vehicle || ""}
            </small>

            <small>
              ${rupiah(trip.price)}
            </small>

          </button>

        `;

      }).join("");


    /* =========================
       EVENT
    ========================= */

    document
      .querySelectorAll(".scheduleBtn")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const index =
              Number(
                button.dataset.trip
              );


            pickTrip(
              trips[index],
              button
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
   PILIH PERJALANAN
========================= */

async function pickTrip(trip, button) {

  selectedSchedule = trip;
  selectedSeat = null;


  document
    .querySelectorAll(".scheduleBtn")
    .forEach(btn =>
      btn.classList.remove("active")
    );


  if (button) {
    button.classList.add("active");
  }


  const seatsBox = $("seats");


  seatsBox.innerHTML = `
    <p class="muted">
      Memuat kursi...
    </p>
  `;


  /*
    Untuk perjalanan panjang,
    kursi harus dikunci berdasarkan
    kendaraan dan tanggal.

    Untuk perjalanan pendek,
    menggunakan schedule utama.
  */

  const scheduleId =
    trip.main.id;


  try {

    const {
      data,
      error
    } = await db
      .from("bookings")
      .select(
        "seat_number, schedule_id, payment_status"
      )
      .eq(
        "schedule_id",
        scheduleId
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
      (data || [])
        .map(x =>
          Number(x.seat_number)
        );


    /* =========================
       14 KURSI
    ========================= */

    seatsBox.innerHTML =
      Array.from(
        { length: 14 },
        (_, i) => {

          const number = i + 1;

          const taken =
            booked.includes(number);


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
                  ? "<br><small>Sudah dipesan</small>"
                  : ""
              }

            </button>

          `;

        }
      ).join("");


    /* =========================
       PILIH KURSI
    ========================= */

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

    console.error(error);

    seatsBox.innerHTML = `
      <p class="error">
        Gagal memuat kursi.
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
    $("name").value.trim();


  const phone =
    $("phone").value.trim();


  if (!name || !phone) {

    alert(
      "Isi nama dan nomor WhatsApp."
    );

    return;
  }


  const from =
    $("from").value;


  const to =
    $("to").value;


  const price =
    getPrice(from, to);


  const code =
    "HSM-" +
    crypto
      .randomUUID()
      .substring(0, 6)
      .toUpperCase();


  const button = $("book");


  button.disabled = true;
  button.textContent =
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
      .select("id")
      .eq(
        "schedule_id",
        selectedSchedule.main.id
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
      existing &&
      existing.length > 0
    ) {

      alert(
        "Kursi tersebut baru saja dipesan orang lain."
      );

      await pickTrip(
        selectedSchedule
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
          selectedSchedule.main.id,

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


    /* =========================
       WHATSAPP
    ========================= */

    const wa =
      String(
        cfg.WHATSAPP_ADMIN || ""
      ).replace(
        /\D/g,
        ""
      );


    const message = [

      "Halo HSM Transport, saya ingin konfirmasi booking.",

      "Kode: " + code,

      "Nama: " + name,

      "Rute: " +
        from +
        " → " +
        to,

      "Tanggal: " +
        $("date").value,

      "Berangkat: " +
        jam(
          selectedSchedule.departure
        ),

      "Kendaraan: " +
        (
          selectedSchedule.vehicle ||
          ""
        ),

      "Kursi: " +
        selectedSeat,

      "Total: " +
        rupiah(price)

    ].join("\n");


    $("result").innerHTML = `

      <div class="success">

        <b>Booking berhasil!</b>

        <strong>
          ${code}
        </strong>

        <p>

          ${from} → ${to}

          <br>

          ${$("date").value}

          <br>

          Berangkat:
          ${jam(
            selectedSchedule.departure
          )}

          <br>

          Kendaraan:
          ${selectedSchedule.vehicle || ""}

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
            : ""
        }

      </div>

    `;


    /*
      REFRESH KURSI
    */

    await pickTrip(
      selectedSchedule
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
   START HSM
========================= */

async function startHSM() {

  if (
    !cfg ||
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ) {

    console.error(
      "Config HSM belum lengkap."
    );

    return;
  }


  if (!window.supabase) {

    console.error(
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

    console.error(error);

    return;
  }


  const today =
    new Date()
      .toISOString()
      .substring(0, 10);


  $("date").min = today;


  /*
    EVENT RUTE
  */

  $("from")
    .addEventListener(
      "change",
      loadSchedules
    );


  $("to")
    .addEventListener(
      "change",
      loadSchedules
    );


  $("date")
    .addEventListener(
      "change",
      loadSchedules
    );


  /*
    BOOKING
  */

  $("book")
    .addEventListener(
      "click",
      createBooking
    );


  $("schedule").innerHTML = `

    <p class="muted">
      Pilih keberangkatan, tujuan dan tanggal terlebih dahulu.
    </p>

  `;

}


/* =========================
   MULAI
========================= */

document.addEventListener(
  "DOMContentLoaded",
  startHSM
);
