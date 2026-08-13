const cfg = window.HSM_CONFIG;

let db = null;
let selectedSchedule = null;
let selectedSeat = null;
let schedules = [];


/* =========================
   HARGA 6 RUTE
========================= */

const PRICES = {
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
   HARGA
========================= */

function getRouteKey(from, to) {
  return `${from}-${to}`;
}


function getRoutePrice(from, to) {
  return PRICES[getRouteKey(from, to)] || 0;
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
   NORMALISASI TEKS
========================= */

function normalisasi(text) {

  return String(text || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

}


/* =========================
   CEK VEHICLE
========================= */

function vehicleDirection(vehicle) {

  const v =
    String(vehicle || "")
      .trim()
      .toLowerCase();


  if (
    v === "01" ||
    v === "1"
  ) {

    return [
      "Sofifi",
      "Weda",
      "Lelilef"
    ];

  }


  if (
    v === "02" ||
    v === "2"
  ) {

    return [
      "Lelilef",
      "Weda",
      "Sofifi"
    ];

  }


  return null;
}


/* =========================
   CEK ROUTE DARI VEHICLE
========================= */

function routeDariVehicle(
  vehicle,
  from,
  to
) {

  const jalur =
    vehicleDirection(
      vehicle
    );


  if (!jalur) {
    return false;
  }


  const posisiFrom =
    jalur.indexOf(from);


  const posisiTo =
    jalur.indexOf(to);


  return (
    posisiFrom !== -1 &&
    posisiTo !== -1 &&
    posisiFrom < posisiTo
  );

}


/* =========================
   CEK ROUTE DARI KOLOM ROUTE
========================= */

function routeDariKolom(
  route,
  from,
  to
) {

  const text =
    normalisasi(route);


  const a =
    normalisasi(from);

  const b =
    normalisasi(to);


  if (!text) {
    return false;
  }


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
   CEK JADWAL SESUAI RUTE
========================= */

function jadwalCocok(
  schedule,
  from,
  to
) {

  /*
    PRIORITAS 1:
    vehicle.

    Kalau vehicle 01:
    Sofifi -> Weda -> Lelilef

    Kalau vehicle 02:
    Lelilef -> Weda -> Sofifi
  */

  const vehicle =
    String(
      schedule.vehicle || ""
    ).trim();


  if (vehicle) {

    const cocokVehicle =
      routeDariVehicle(
        vehicle,
        from,
        to
      );


    if (cocokVehicle) {
      return true;
    }

  }


  /*
    PRIORITAS 2:
    Kalau vehicle kosong
    atau tidak dikenali,
    cek kolom route.
  */

  return routeDariKolom(
    schedule.route,
    from,
    to
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
    Kota sama
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
      Simpan jadwal
    */

    schedules =
      data || [];


    /*
      Jangan tampilkan tanggal
      yang sudah lewat
    */

    const today =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );


    schedules =
      schedules.filter(
        s =>
          String(
            s.travel_date || ""
          ) >= today
      );


    /*
      FILTER RUTE

      Tidak lagi hanya memakai
      kolom route.

      Vehicle digunakan untuk
      menentukan arah perjalanan.
    */

    const hasil =
      schedules.filter(
        s =>
          jadwalCocok(
            s,
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
            ).slice(
              0,
              5
            )}
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
      Event jadwal
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
        Number
