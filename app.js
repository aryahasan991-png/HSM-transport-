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
========================= */

function buildTrips(from, to) {

  const result = [];


  /* =========================
     SOFIFI → WEDA
  ========================= */

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


  /* =========================
     WEDA → LELILEF
  ========================= */

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


  /* =========================
     LELILEF → WEDA
  ========================= */

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


  /* =========================
     WEDA → SOFIFI
  ========================= */

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


  const scheduleBox =
    $("schedule");

  const seatsBox =
    $("seats");


  const from =
    $("from").value;

  const to =
    $("to").value;

  const date =
    $("date").value;


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

async function pickTrip(
  trip,
  button
) {

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


  const seatsBox =
    $("seats");


  seatsBox.innerHTML = `
    <p class="muted">
      Memuat kursi...
    </p>
  `;


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
       LAYOUT 13 KURSI
    ========================= */

    function createSeat(
      number
    ) {

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
          style="
            min-height:65px;
            border-radius:10px;
            border:2px solid #d1d5db;
            background:${
              taken
                ? "#9ca3af"
                : "#22c55e"
            };
            color:white;
            font-weight:bold;
            padding:8px;
          "
        >

          <span style="
            display:block;
            font-size:19px;
            font-weight:bold;
          ">
            ${String(number).padStart(2, "0")}
          </span>

          <small>
            ${
              taken
                ? "Sudah dipesan"
                : "Tersedia"
            }
          </small>

        </button>

      `;
    }


    seatsBox.innerHTML = `

      <div style="
        max-width:420px;
        margin:auto;
      ">


        <!-- DEPAN -->

        <div style="
          text-align:center;
          font-weight:bold;
          margin-bottom:10px;
        ">
          DEPAN / SOPIR
        </div>


        <!-- SLIDING DOOR -->

        <div style="
          text-align:left;
          margin-bottom:12px;
          font-size:13px;
          font-weight:bold;
          color:#374151;
        ">
          🚪 SLIDING DOOR
        </div>


        <!-- BARIS 1 : 01 02 03 -->

        <div style="
          display:grid;
          grid-template-columns:
            repeat(3,1fr);
          gap:8px;
          margin-bottom:12px;
        ">

          ${createSeat(1)}
          ${createSeat(2)}
          ${createSeat(3)}

        </div>


        <!-- BARIS 2 : 04   05 06 -->

        <div style="
          display:grid;
          grid-template-columns:
            1fr 25px 1fr 1fr;
          gap:8px;
          margin-bottom:12px;
        ">

          ${createSeat(4)}

          <!-- LORONG -->

          <div></div>

          ${createSeat(5)}
          ${createSeat(6)}

        </div>


        <!-- BARIS 3 : 07   08 09 -->

        <div style="
          display:grid;
          grid-template-columns:
            1fr 25px 1fr 1fr;
          gap:8px;
          margin-bottom:12px;
        ">

          ${createSeat(7)}

          <!-- LORONG -->

          <div></div>

          ${createSeat(8)}
          ${createSeat(9
