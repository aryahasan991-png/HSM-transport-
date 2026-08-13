const cfg = window.HSM_CONFIG;

let db = null;

let schedules = [];

let selectedSchedule = null;

let selectedSeat = null;


// ===============================
// FORMAT RUPIAH
// ===============================

function rupiah(n) {

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);

}


// ===============================
// BERSIHKAN TEKS
// ===============================

function cleanText(value) {

  return String(value || "").trim();

}


// ===============================
// ERROR
// ===============================

function showError(message, err) {

  const el = document.querySelector("#schedule");

  if (el) {

    el.innerHTML =
      `<p class="error">${message}</p>`;

  }

  console.error("HSM:", message, err || "");

}


// ===============================
// NORMALISASI ROUTE
// ===============================

function normalizeRoute(route) {

  return cleanText(route)

    .replace(/[–—]/g, "-")

    .replace(/\s+/g, " ")

    .split("-")

    .map(x => x.trim().toLowerCase())

    .filter(Boolean);

}


// ===============================
// CEK ROUTE
// ===============================

function routeMatches(route, from, to) {

  const parts = normalizeRoute(route);

  const f =
    cleanText(from).toLowerCase();

  const t =
    cleanText(to).toLowerCase();

  if (!f || !t || f === t) {

    return false;

  }

  if (parts.length < 2) {

    return false;

  }

  const start =
    parts.indexOf(f);

  const end =
    parts.indexOf(t, start + 1);

  return (
    start !== -1 &&
    end !== -1 &&
    end > start
  );

}


// ===============================
// NAMA KENDARAAN
// ===============================

function vehicleLabel(vehicle, route) {

  const v = cleanText(vehicle);

  if (v) {

    return "🚐 " + v;

  }

  const parts =
    normalizeRoute(route);

  if (parts[0] === "sofifi") {

    return "🚐 HSM-01";

  }

  if (parts[0] === "lelilef") {

    return "🚐 HSM-02";

  }

  return "🚐 Kendaraan HSM";

}


// ===============================
// LOAD JADWAL
// ===============================

async function loadSchedules() {

  selectedSchedule = null;

  selectedSeat = null;

  const from =
    document.querySelector("#from").value;

  const to =
    document.querySelector("#to").value;

  const date =
    document.querySelector("#date").value;

  const scheduleEl =
    document.querySelector("#schedule");

  const seatsEl =
    document.querySelector("#seats");


  seatsEl.innerHTML =
    '<p class="muted">Pilih jadwal terlebih dahulu.</p>';


  if (!from || !to) {

    scheduleEl.innerHTML =
      '<p class="muted">Pilih keberangkatan dan tujuan terlebih dahulu.</p>';

    return;

  }


  if (from === to) {

    scheduleEl.innerHTML =
      '<p class="error">Keberangkatan dan tujuan tidak boleh sama.</p>';

    return;

  }


  if (!date) {

    scheduleEl.innerHTML =
      '<p class="muted">Pilih tanggal keberangkatan.</p>';

    return;

  }


  if (!db) {

    showError(
      "Koneksi Supabase belum siap."
    );

    return;

  }


  scheduleEl.innerHTML =
    '<p class="muted">Memuat jadwal...</p>';


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

      showError(
        "Gagal memuat jadwal: " +
        error.message,
        error
      );

      return;

    }


    schedules =
      (data || []).filter(
        s =>
          routeMatches(
            s.route,
            from,
            to
          )
      );


    if (!schedules.length) {

      scheduleEl.innerHTML =
        '<p class="muted">Tidak ada jadwal untuk rute dan tanggal tersebut.</p>';

      return;

    }


    scheduleEl.innerHTML =
      schedules.map(s => `

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

          <div>
            ${cleanText(s.route)}
          </div>

          <div class="vehicle">
            ${vehicleLabel(
              s.vehicle,
              s.route
            )}
          </div>

          <small>
            ${rupiah(s.price)}
          </small>

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


  } catch (e) {

    showError(
      "Terjadi kesalahan saat memuat jadwal.",
      e
    );

  }

}


// ===============================
// PILIH JADWAL
// ===============================

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


  document
    .querySelectorAll(".scheduleBtn")
    .forEach(x =>
      x.classList.remove("active")
    );


  if (button) {

    button.classList.add("active");

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

      seatsEl.innerHTML =
        `<p class="error">
          Gagal memuat kursi:
          ${error.message}
        </p>`;

      return;

    }


    const used =
      (data || [])
        .map(
          x =>
            Number(
              x.seat_number
            )
        );


    seatsEl.innerHTML =
      Array.from(
        { length: 14 },
        (_, i) => {

          const n = i + 1;

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
                  ? " — Terisi"
                  : ""
              }

            </button>

          `;

        }
      ).join("");


    document
      .querySelectorAll(
        ".seat:not(:disabled)"
      )
      .forEach(btn => {

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

      });


  } catch (e) {

    seatsEl.innerHTML =
      '<p class="error">Terjadi kesalahan saat memuat kursi.</p>';

    console.error(e);

  }

}


// ===============================
// PILIH KURSI
// ===============================

function pickSeat(
  number,
  button
) {

  selectedSeat =
    number;


  document
    .querySelectorAll(".seat")
    .forEach(x =>
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


// ===============================
// BUAT BOOKING
// ===============================

async function createBooking() {

  if (
    !selectedSchedule ||
    !selectedSeat
  ) {

    alert(
      "Pilih jadwal dan kursi."
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
          selectedSchedule.price,

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


    const from =
      document.querySelector(
        "#from"
      ).value;


    const to =
      document.querySelector(
        "#to"
      ).value;


    const date =
      document.querySelector(
        "#date"
      ).value;


    const time =
      String(
        selectedSchedule.departure_time ||
        ""
      ).slice(0, 5);


    const vehicle =
      vehicleLabel(
        selectedSchedule.vehicle,
        selectedSchedule.route
      );


    const msg = [

      "Halo HSM Transport, saya ingin konfirmasi booking.",

      "Kode: " + code,

      "Nama: " + name,

      "Rute: " +
        from +
        " → " +
        to,

      "Tanggal: " +
        date,

      "Jam: " +
        time,

      "Kendaraan: " +
        vehicle.replace(
          "🚐 ",
          ""
        ),

      "Kursi: " +
        selectedSeat,

      "Total: " +
        rupiah(
          selectedSchedule.price
        )

    ].join("\n");


    const wa =
      String(
        cfg.WHATSAPP_ADMIN || ""
      ).replace(
        /\D/g,
        ""
      );


    document
      .querySelector("#result")
      .innerHTML = `

        <div class="success">

          <b>
            Booking berhasil!
          </b>

          <strong>
            ${code}
          </strong>

          <p>

            ${from} → ${to}
            <br>

            ${date} • ${time}
            <br>

            ${vehicle} •
            Kursi ${selectedSeat}
            <br>

            Total
            ${rupiah(
              selectedSchedule.price
            )}

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

                  Nomor WhatsApp admin
                  belum diisi di config.js.

                </p>

              `
          }

        </div>

      `;


    await pickSchedule(
      selectedSchedule.id
    );


  } catch (e) {

    console.error(e);

    alert(
      "Terjadi kesalahan saat menyimpan booking."
    );


  } finally {

    button.disabled =
      false;

    button.textContent =
      "Pesan Sekarang";

  }

}


// ===============================
// START HSM
// ===============================

async function startHSM() {

  const dateEl =
    document.querySelector(
      "#date"
    );


  const bookButton =
    document.querySelector(
      "#book"
    );


  if (
    !cfg ||
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ) {

    showError(
      "Config HSM belum lengkap. Periksa config.js."
    );

    return;

  }


  if (!window.supabase) {

    showError(
      "Library Supabase tidak termuat. Periksa koneksi internet."
    );

    return;

  }


  try {

    db =
      window.supabase.createClient(

        cfg.SUPABASE_URL,

        cfg.SUPABASE_PUBLISHABLE_KEY

      );

  } catch (e) {

    showError(
      "Gagal membuat koneksi Supabase.",
      e
    );

    return;

  }


  if (
    !dateEl ||
    !bookButton
  ) {

    showError(
      "Elemen halaman HSM tidak lengkap."
    );

    return;

  }


  const today =
    new Date()
      .toISOString()
      .slice(0, 10);


  dateEl.value =
    dateEl.value ||
    today;


  dateEl.min =
    today;


  document
    .querySelector(
      "#from"
    )
    .addEventListener(
      "change",
      loadSchedules
    );


  document
    .querySelector(
      "#to"
    )
    .addEventListener(
      "change",
      loadSchedules
    );


  dateEl.addEventListener(
    "change",
    loadSchedules
  );


  bookButton.addEventListener(
    "click",
    createBooking
  );

}


// ===============================
// START
// ===============================

document.addEventListener(
  "DOMContentLoaded",
  startHSM
);
