const cfg = window.HSM_CONFIG;

let db = null;
let selectedSchedule = null;
let selectedSeat = null;
let schedules = [];

function rupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);
}

function showError(message, err) {
  const el = document.querySelector("#schedule");
  if (el) {
    el.innerHTML =
      '<span class="error">' + message + '</span>';
  }
  console.error("HSM:", message, err || "");
}

/* =========================
   FILTER RUTE
========================= */

function cocokRoute(route, dari, ke) {
  if (!dari || !ke) return true;

  const text = String(route || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const a = dari.toLowerCase();
  const b = ke.toLowerCase();

  if (a === b) return false;

  /*
    Contoh:
    Sofifi - Weda - Lelilef

    Bisa:
    Sofifi -> Weda
    Sofifi -> Lelilef
    Weda -> Lelilef
  */

  const posisiDari = text.indexOf(a);
  const posisiKe = text.indexOf(b);

  return (
    posisiDari !== -1 &&
    posisiKe !== -1 &&
    posisiDari < posisiKe
  );
}

/* =========================
   TAMPILKAN JADWAL
========================= */

function tampilkanJadwal(list) {

  const scheduleEl =
    document.querySelector("#schedule");

  if (!list.length) {
    scheduleEl.innerHTML =
      '<p class="muted">Tidak ada jadwal untuk pilihan tersebut.</p>';
    return;
  }

  scheduleEl.innerHTML =
    list.map(s => `
      <button
        type="button"
        class="scheduleBtn"
        data-id="${s.id}"
      >

        <b>
          ${String(
            s.departure_time || ""
          ).slice(0,5)}
        </b>

        <br>

        <span>
          ${s.route || ""}
        </span>

        <small>
          ${rupiah(s.price)}
        </small>

        ${
          s.vehicle
            ? `<small>🚐 ${s.vehicle}</small>`
            : ""
        }

      </button>
    `).join("");

  document
    .querySelectorAll(".scheduleBtn")
    .forEach(btn => {

      btn.addEventListener(
        "click",
        () =>
          pickSchedule(
            Number(btn.dataset.id),
            btn
          )
      );

    });
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

  if (!db) {
    return showError(
      "Koneksi Supabase belum siap."
    );
  }

  scheduleEl.textContent =
    "Memuat jadwal...";

  seatsEl.innerHTML =
    '<p class="muted">Pilih jadwal terlebih dahulu.</p>';

  try {

    /*
      INI SAMA SEPERTI APP.JS LAMA
      YANG SUDAH BERHASIL.
    */

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

    schedules = data || [];

    if (!schedules.length) {

      scheduleEl.textContent =
        "Belum ada jadwal pada tanggal " +
        dateEl.value +
        ".";

      return;
    }

    /*
      Ambil pilihan Dari dan Ke.
    */

    const dariEl =
      document.querySelector("#from");

    const keEl =
      document.querySelector("#to");

    const dari =
      dariEl
        ? dariEl.value
        : "";

    const ke =
      keEl
        ? keEl.value
        : "";

    /*
      Kalau belum memilih rute,
      tampilkan semua jadwal.
    */

    if (!dari || !ke) {

      tampilkanJadwal(
        schedules
      );

      return;
    }

    /*
      Filter hanya tampilan.
    */

    const hasil =
      schedules.filter(s =>
        cocokRoute(
          s.route,
          dari,
          ke
        )
      );

    /*
      Jika ditemukan, tampilkan hasil.
      Jika tidak ditemukan, tetap
      tampilkan semua jadwal agar
      website tidak kosong.
    */

    if (hasil.length) {

      tampilkanJadwal(
        hasil
      );

    } else {

      scheduleEl.innerHTML = `
        <p class="muted">
          Tidak ditemukan jadwal yang
          cocok dengan rute ${dari}
          → ${ke}.
        </p>

        <p class="muted">
          Jadwal pada tanggal ini:
        </p>
      `;

      tampilkanJadwal(
        schedules
      );
    }

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

    return alert(
      "Jadwal tidak ditemukan."
    );

  }

  document
    .querySelectorAll(".scheduleBtn")
    .forEach(x =>
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
    document.querySelector("#seats");

  seatsEl.innerHTML =
    "<p class='muted'>Memuat kursi...</p>";

  try {

    const {
      data,
      error
    } = await db
      .from("bookings
