const cfg = window.HSM_CONFIG;

let db = null;
let schedules = [];
let selectedSchedule = null;
let selectedSeat = null;


/* =====================================================
   HARGA RUTE
===================================================== */

const HARGA = {
  "Sofifi-Weda": 200000,
  "Sofifi-Lelilef": 300000,

  "Weda-Lelilef": 100000,
  "Weda-Sofifi": 200000,

  "Lelilef-Weda": 100000,
  "Lelilef-Sofifi": 300000
};


/* =====================================================
   FORMAT RUPIAH
===================================================== */

function rupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);
}


/* =====================================================
   DATA FORM
===================================================== */

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


/* =====================================================
   NORMALISASI VEHICLE
=====================================================

   HSM 01 -> 01
   HSM01   -> 01
   01      -> 01

   HSM 02 -> 02
   HSM02   -> 02
   02      -> 02
===================================================== */

function normalVehicle(vehicle) {

  const value =
    String(vehicle || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");


  if (
    value === "01" ||
    value === "HSM01"
  ) {
    return "01";
  }


  if (
    value === "02" ||
    value === "HSM02"
  ) {
    return "02";
  }


  return value;
}


/* =====================================================
   MENENTUKAN KENDARAAN BERDASARKAN ARAH
=====================================================

   UNIT 01
   Sofifi -> Weda -> Lelilef

   UNIT 02
   Lelilef -> Weda -> Sofifi
===================================================== */

function vehicleUntukRute(from, to) {

  if (
    from === "Sofifi" &&
    (
      to === "Weda" ||
      to === "Lelilef"
    )
  ) {
    return "01";
  }


  if (
    from === "Lelilef" &&
    (
      to === "Weda" ||
      to === "Sofifi"
    )
  ) {
    return "02";
  }


  if (
    from === "Weda" &&
    to === "Lelilef"
  ) {
    return "01";
  }


  if (
    from === "Weda" &&
    to === "Sofifi"
  ) {
    return "02";
  }


  return null;
}


/* =====================================================
   ERROR
===================================================== */

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


/* =====================================================
   LOAD JADWAL
===================================================== */

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
    RESET KURSI
  */

  seatsEl.innerHTML = `
    <p class="muted">
      Pilih jadwal terlebih dahulu.
    </p>
  `;


  /*
    RUTE BELUM DIPILIH
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
    TANGGAL BELUM DIPILIH
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
    TENTUKAN UNIT
  */

  const unitTujuan =
    vehicleUntukRute(
      from,
      to
    );


  if (!unitTujuan) {

    scheduleEl.innerHTML = `
      <p class="error">
        Rute belum tersedia.
      </p>
    `;

    return;
  }


  /*
    SUPABASE
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
      AMBIL JADWAL PADA TANGGAL
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
      FILTER UNIT

      HSM 01 / 01 -> 01
      HSM 02 / 02 -> 02
    */

    schedules =
      (data || []).filter(
        schedule =>
          normalVehicle(
            schedule.vehicle
          ) === unitTujuan
      );


    /*
      HILANGKAN DUPLIKAT ID
    */

    const unique =
      new Map();

    schedules.forEach(
      schedule => {

        unique.set(
          String(schedule.id),
          schedule
        );

      }
    );

    schedules =
      Array.from(
        unique.values()
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
      HARGA OTOMATIS
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
              schedule.departure_time ||
              ""
            ).slice(
              0,
              5
            );


          const unit =
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
                HSM ${unit}
              </small>

              <small>
                ${rupiah(price)}
              </small>

            </button>
          `;

        }
      ).join("");


    /*
      EVENT JADWAL
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


  } catch (e) {

    showError(
      "Terjadi kesalahan saat memuat jadwal.",
      e
    );

  }
}


/* =====================================================
   PILIH JADWAL
===================================================== */

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


  selectedSeat =
