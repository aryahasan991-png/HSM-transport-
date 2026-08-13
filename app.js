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
   HELPER
========================= */

function $(id) {
  return document.getElementById(id);
}

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function jam(time) {
  return String(time || "").substring(0, 5);
}

function cleanRoute(route) {
  return String(route || "")
    .replace(/[–—]/g, "→")
    .replace(/\s*→\s*/g, "→")
    .trim();
}

function getPrice(from, to) {
  return PRICES[from + "-" + to] || 0;
}


/* =========================
   BUAT PERJALANAN
========================= */

function buildTrips(from, to) {

  const result = [];

  /* SOFIFI → WEDA */

  if (from === "Sofifi" && to === "Weda") {

    schedules
      .filter(s =>
        cleanRoute(s.route) === "Sofifi→Weda"
      )
      .forEach(s => {

        result.push({
          main: s,
          from,
          to,
          departure: s.departure_time,
          price: 200000,
          vehicle: s.vehicle
        });

      });

    return result;
  }


  /* WEDA → LELILEF */

  if (from === "Weda" && to === "Lelilef") {

    schedules
      .filter(s =>
        cleanRoute(s.route) === "Weda→Lelilef"
      )
      .forEach(s => {

        result.push({
          main: s,
          from,
          to,
          departure: s.departure_time,
          price: 100000,
          vehicle: s.vehicle
        });

      });

    return result;
  }


  /* LELILEF → WEDA */

  if (from === "Lelilef" && to === "Weda") {

    schedules
      .filter(s =>
        cleanRoute(s.route) === "Lelilef→Weda"
      )
      .forEach(s => {

        result.push({
          main: s,
          from,
          to,
          departure: s.departure_time,
          price: 100000,
          vehicle: s.vehicle
        });

      });

    return result;
  }


  /* WEDA → SOFIFI */

  if (from === "Weda" && to === "Sofifi") {

    schedules
      .filter(s =>
        cleanRoute(s.route) === "Weda→Sofifi"
      )
      .forEach(s => {

        result.push({
          main: s,
          from,
          to,
          departure: s.departure_time,
          price: 200000,
          vehicle: s.vehicle
        });

      });

    return result;
  }


  /* SOFIFI → LELILEF */

  if (from === "Sofifi" && to === "Lelilef") {

    const firstLeg = schedules.filter(s =>
      cleanRoute(s.route) === "Sofifi→Weda"
    );

    firstLeg.forEach(first => {

      const second = schedules.find(s =>
        cleanRoute(s.route) === "Weda→Lelilef" &&
        String(s.vehicle).trim() === String(first.vehicle).trim() &&
        String(s.travel_date) === String(first.travel_date) &&
        String(s.departure_time) > String(first.departure_time)
      );

      if (second) {

        result.push({
          main: first,
          second,
          from,
          to,
          departure: first.departure_time,
          arrival: second.departure_time,
          price: 300000,
          vehicle: first.vehicle
        });

      }

    });

    return result;
  }


  /* LELILEF → SOFIFI */

  if (from === "Lelilef" && to === "Sofifi") {

    const firstLeg = schedules.filter(s =>
      cleanRoute(s.route) === "Lelilef→Weda"
    );

    firstLeg.forEach(first => {

      const second = schedules.find(s =>
        cleanRoute(s.route) === "Weda→Sofifi" &&
        String(s.vehicle).trim() === String(first.vehicle).trim() &&
        String(s.travel_date) === String(first.travel_date) &&
        String(s.departure_time) > String(first.departure_time)
      );

      if (second) {

        result.push({
          main: first,
          second,
          from,
          to,
          departure: first.departure_time,
          arrival: second.departure_time,
          price: 300000,
          vehicle: first.vehicle
        });

      }

    });

    return result;
  }


  return result;
}


/* =========================
   LOAD JADWAL
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

    const { data, error } = await db
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

    const trips = buildTrips(from, to);


    if (!trips.length) {

      scheduleBox.innerHTML = `
        <p class="muted">
          Tidak ada jadwal untuk rute ini pada tanggal tersebut.
        </p>
      `;

      return;
    }


    scheduleBox.innerHTML = trips.map((trip, index) => {

      return `
        <button
          type="button"
          class="scheduleBtn"
          data-trip="${index}"
        >

          <b>
            Berangkat ${jam(trip.departure)}
          </b>

          ${
            trip.arrival
              ? `<small>Lanjut Weda: ${jam(trip.arrival)}</small>`
              : ""
          }

          <small>
            Kendaraan ${trip.vehicle || ""}
          </small>

          <small>
            ${rupiah(trip.price)}
          </small>

        </button>
      `;

    }).join("");


    document
      .querySelectorAll(".scheduleBtn")
      .forEach(button => {

        button.addEventListener("click", () => {

          const index =
            Number(button.dataset.trip);

          pickTrip(trips[index], button);

        });

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


  await loadSeats();
}


/* =========================
   LAYOUT 14 KURSI
========================= */

function seatButton(number, taken) {

  return `
    <button
      type="button"
      class="seat ${
        taken ? "taken" : ""
      }"
      ${taken ? "disabled" : ""}
      data-seat="${number}"
    >

      <span style="
        display:block;
        font-size:20px;
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


/* =========================
   TAMPILKAN KURSI
========================= */

function renderSeats(booked) {

  const seatsBox = $("seats");

  const isTaken = number =>
    booked.includes(number);


  seatsBox.innerHTML = `

    <div style="
      text-align:center;
      margin-bottom:15px;
      font-weight:bold;
      color:#374151;
    ">
      DEPAN / SOPIR
    </div>


    <div style="
      background:#f3f4f6;
      border-radius:12px;
      padding:10px;
      margin-bottom:15px;
      text-align:center;
    ">
      🚪 <b>SLIDING DOOR</b>
    </div>


    <div
      class="hsm-seat-layout"
      style="
        display:flex;
        flex-direction:column;
        gap:12px;
        max-width:360px;
        margin:auto;
      "
    >


      <!-- BARIS 1 -->

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:8px;
      ">

        ${seatButton(1, isTaken(1))}
        ${seatButton(2, isTaken(2))}
        ${seatButton(3, isTaken(3))}

      </div>


      <!-- BARIS 2 -->

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:8px;
      ">

        ${seatButton(4, isTaken(4))}

        <div></div>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:8px;
        ">

          ${seatButton(5, isTaken(5))}
          ${seatButton(6, isTaken(6))}

        </div>

      </div>


      <!-- BARIS 3 -->

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:8px;
      ">

        ${seatButton(7, isTaken(7))}

        <div></div>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:8px;
        ">

          ${seatButton(8, isTaken(8))}
          ${seatButton(9, isTaken(9))}

        </div>

      </div>


      <!-- BARIS 4 -->

      <div style="
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:8px;
      ">

        ${seatButton(10, isTaken(10))}
        ${seatButton(11, isTaken(11))}
        ${seatButton(12, isTaken(12))}
        ${seatButton(13, isTaken(13))}

      </div>


      <!-- KURSI 14 -->

      <div style="
        display:flex;
        justify-content:center;
      ">

        <div style="
          width:25%;
        ">

          ${seatButton(14, isTaken(14))}

        </div>

      </div>


    </div>


    <div style="
      text-align:center;
      margin-top:15px;
      color:#374151;
      font-weight:bold;
    ">
      BELAKANG
    </div>


    <div style="
      display:flex;
      justify-content:center;
      gap:15px;
      margin-top:15px;
      font-size:13px;
    ">

      <span>
        🟢 Tersedia
      </span>

      <span>
        🔵 Dipilih
      </span>

      <span>
        ⚫ Sudah dipesan
      </span>

    </div>

  `;


  document
    .querySelectorAll(
      ".seat:not(:disabled)"
    )
    .forEach(button => {

      button.addEventListener("click", () => {

        selectedSeat =
          Number(button.dataset.seat);


        document
          .querySelectorAll(".seat")
          .forEach(seat =>
            seat.classList.remove("selected")
          );


        button.classList.add("selected");


        /*
          Tambahkan efek visual
          agar kursi yang dipilih
          terlihat jelas.
        */

        button.style.background =
          "#0b4ea2";

        button.style.color =
          "white";


        button.querySelector("small")
          .textContent =
          "Dipilih";


        const result =
          $("result");


        if (result) {

          result.innerHTML = `
            <div style="
              background:#eff6ff;
              border:1px solid #bfdbfe;
              border-radius:10px;
              padding:12px;
              margin-bottom:15px;
              text-align:center;
              color:#1e40af;
              font-weight:bold;
            ">
              Kursi ${String(selectedSeat).padStart(2, "0")}
              dipilih
            </div>
          `;

        }

      });

    });
}


/* =========================
   LOAD KURSI
========================= */

async function loadSeats() {

  const seatsBox = $("seats");


  if (!selectedSchedule) {

    seatsBox.innerHTML = `
      <p class="muted">
        Pilih jadwal terlebih dahulu.
      </p>
    `;

    return;
  }


  seatsBox.innerHTML = `
    <p class="muted">
      Memuat kursi...
    </p>
  `;


  try {

    const scheduleId =
      selectedSchedule.main.id;


    const {
      data,
      error
    } = await db
      .from("bookings")
      .select(
        "seat_number, payment_status"
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
        .map(item =>
          Number(item.seat_number)
        );


    renderSeats(booked);


  } catch (error) {

    console.error(error);

    seatsBox.innerHTML = `
      <p class="error">
        Terjadi kesalahan saat mem
