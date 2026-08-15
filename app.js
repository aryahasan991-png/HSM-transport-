const cfg = window.HSM_CONFIG;

let db = null;
let schedules = [];
let selectedSchedule = null;
let selectedSeat = null;

const PRICES = {
  "Sofifi-Weda": 200000,
  "Weda-Sofifi": 200000
};

const TZ = "Asia/Jayapura";

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

function jam(value) {
  return String(value || "").substring(0, 5);
}

function route(value) {
  return String(value || "")
    .replace(/[–—-]/g, "→")
    .replace(/\s*→\s*/g, "→")
    .trim();
}

function vehicle(value) {
  const v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");

  if (v === "01" || v === "HSM-01") return "HSM-01";
  if (v === "02" || v === "HSM-02") return "HSM-02";

  return v;
}

function nowWIT() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const x = {};
  p.forEach(a => {
    if (a.type !== "literal") x[a.type] = a.value;
  });

  return x;
}

function todayWIT() {
  const n = nowWIT();
  return `${n.year}-${n.month}-${n.day}`;
}

function timeWIT() {
  const n = nowWIT();
  return `${n.hour}:${n.minute}:${n.second}`;
}

function lewat(tanggal, jamBerangkat) {
  const date = String(tanggal || "").substring(0, 10);

  if (date !== todayWIT()) return false;

  return String(jamBerangkat || "").substring(0, 8) <= timeWIT();
}

function harga(from, to) {
  return PRICES[`${from}-${to}`] || 0;
}


/* =========================
   JADWAL
========================= */

async function loadSchedules() {
  selectedSchedule = null;
  selectedSeat = null;

  const schedule = $("schedule");
  const seats = $("seats");

  const from = $("from").value;
  const to = $("to").value;
  const date = $("date").value;

  seats.innerHTML = `
    <p class="muted">
      Pilih jadwal terlebih dahulu.
    </p>
  `;

  if (!from || !to || !date) {
    schedule.innerHTML = `
      <p class="muted">
        Pilih keberangkatan, tujuan dan tanggal terlebih dahulu.
      </p>
    `;
    return;
  }

  if (from === to) {
    schedule.innerHTML = `
      <p class="error">
        Keberangkatan dan tujuan tidak boleh sama.
      </p>
    `;
    return;
  }

  if (
    !(
      (from === "Sofifi" && to === "Weda") ||
      (from === "Weda" && to === "Sofifi")
    )
  ) {
    schedule.innerHTML = `
      <p class="muted">
        Rute tersebut belum tersedia.
      </p>
    `;
    return;
  }

  schedule.innerHTML = `
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
      .order("departure_time", {
        ascending: true
      });

    if (error) {
      schedule.innerHTML = `
        <p class="error">
          Gagal memuat jadwal:<br>
          ${error.message}
        </p>
      `;
      console.error(error);
      return;
    }

    schedules = (data || [])
      .filter(s => !lewat(
        s.travel_date,
        s.departure_time
      ))
      .filter(s => {
        const v = vehicle(s.vehicle);
        return v === "HSM-01" || v === "HSM-02";
      })
      .filter(s => {
        const r = route(s.route);

        return (
          r === "Sofifi→Weda" ||
          r === "Weda→Sofifi"
        );
      })
      .filter(s => {
        const r = route(s.route);

        if (
          from === "Sofifi" &&
          to === "Weda"
        ) {
          return r === "Sofifi→Weda";
        }

        if (
          from === "Weda" &&
          to === "Sofifi"
        ) {
          return r === "Weda→Sofifi";
        }

        return false;
      });

    if (!schedules.length) {
      schedule.innerHTML = `
        <p class="muted">
          Tidak ada jadwal ${from} → ${to}
          yang tersedia.
        </p>
      `;
      return;
    }

    schedule.innerHTML = schedules.map(
      (s, i) => `
        <button
          type="button"
          class="scheduleBtn"
          data-index="${i}"
        >
          <b>
            Berangkat ${jam(s.departure_time)}
          </b>

          <small>
            🚐 ${vehicle(s.vehicle)}
          </small>

          <small>
            ${rupiah(harga(from, to))}
          </small>
        </button>
      `
    ).join("");

    document
      .querySelectorAll(".scheduleBtn")
      .forEach(btn => {
        btn.addEventListener("click", () => {
          const s =
            schedules[
              Number(btn.dataset.index)
            ];

          pilihJadwal(s, btn);
        });
      });

  } catch (err) {
    console.error(err);

    schedule.innerHTML = `
      <p class="error">
        Terjadi kesalahan saat memuat jadwal.
      </p>
    `;
  }
}


/* =========================
   PILIH JADWAL
========================= */

async function pilihJadwal(s, button) {
  selectedSchedule = {
    main: s,
    departure: s.departure_time,
    vehicle: vehicle(s.vehicle)
  };

  selectedSeat = null;

  document
    .querySelectorAll(".scheduleBtn")
    .forEach(b =>
      b.classList.remove("active")
    );

  if (button) {
    button.classList.add("active");
  }

  const seats = $("seats");

  seats.innerHTML = `
    <p class="muted">
      Memuat kursi...
    </p>
  `;

  try {
    const { data, error } = await db
      .from("bookings")
      .select(
        "seat_number,payment_status"
      )
      .eq(
        "schedule_id",
        s.id
      )
      .neq(
        "payment_status",
        "Batal"
      );

    if (error) {
      seats.innerHTML = `
        <p class="error">
          Gagal memuat kursi:<br>
          ${error.message}
        </p>
      `;
      console.error(error);
      return;
    }

    const booked = (data || [])
      .map(x => Number(x.seat_number));

    const seat = n => {
      const taken = booked.includes(n);

      return `
        <button
          type="button"
          class="seat ${taken ? "taken" : ""}"
          data-seat="${n}"
          ${taken ? "disabled" : ""}
          style="
            min-height:62px;
            border-radius:10px;
            border:2px solid #d1d5db;
            background:${taken ? "#9ca3af" : "#22c55e"};
            color:white;
            font-weight:bold;
            padding:7px;
          "
        >
          <span style="
            display:block;
            font-size:18px;
          ">
            ${String(n).padStart(2, "0")}
          </span>

          <small>
            ${taken ? "Sudah dipesan" : "Tersedia"}
          </small>
        </button>
      `;
    };

    seats.innerHTML = `
      <div style="
        max-width:420px;
        margin:auto;
      ">

        <div style="
          text-align:center;
          font-weight:bold;
          margin-bottom:10px;
        ">
          DEPAN / SOPIR
        </div>

        <div style="
          text-align:left;
          margin-bottom:12px;
          font-size:13px;
          font-weight:bold;
        ">
          🚪 SLIDING DOOR
        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:8px;
          margin-bottom:12px;
        ">
          ${seat(1)}
          ${seat(2)}
          ${seat(3)}
        </div>

        <div style="
          display:grid;
          grid-template-columns:1fr 25px 1fr 1fr;
          gap:8px;
          margin-bottom:12px;
        ">
          ${seat(4)}
          <div></div>
          ${seat(5)}
          ${seat(6)}
        </div>

        <div style="
          display:grid;
          grid-template-columns:1fr 25px 1fr 1fr;
          gap:8px;
          margin-bottom:12px;
        ">
          ${seat(7)}
          <div></div>
          ${seat(8)}
          ${seat(9)}
        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:8px;
        ">
          ${seat(10)}
          ${seat(11)}
          ${seat(12)}
          ${seat(13)}
        </div>

        <div style="
          margin-top:15px;
          padding:10px;
          background:#f3f4f6;
          border-radius:8px;
          font-size:13px;
        ">
          🟢 Tersedia<br>
          ⚪ Sudah dipesan<br>
          🔵 Dipilih
        </div>

      </div>
    `;

    document
      .querySelectorAll(
        ".seat:not(:disabled)"
      )
      .forEach(btn => {
        btn.addEventListener(
          "click",
          () => {

            selectedSeat =
              Number(btn.dataset.seat);

            document
              .querySelectorAll(".seat")
              .forEach(x => {
                if (!x.disabled) {
                  x.style.background =
                    "#22c55e";
                }

                x.classList.remove(
                  "selected"
                );
              });

            btn.classList.add("selected");
            btn.style.background =
              "#2563eb";
          }
        );
      });

  } catch (err) {
    console.error(err);

    seats.innerHTML = `
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
    harga(from, to);

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

    /* Cek jadwal lagi */

    const {
      data: latest,
      error: latestError
    } = await db
      .from("schedules")
      .select("*")
      .eq(
        "id",
        selectedSchedule.main.id
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

    if (latestError) {
      alert(
        "Gagal mengecek jadwal: " +
        latestError.message
      );
      return;
    }

    if (!latest) {
      alert(
        "Jadwal sudah tidak tersedia."
      );

      await loadSchedules();
      return;
    }

    if (
      lewat(
        latest.travel_date,
        latest.departure_time
      )
    ) {
      alert(
        "Maaf, jadwal tersebut sudah lewat."
      );

      await loadSchedules();
      return;
    }

    /* Cek kursi */

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
      existing.length
    ) {
      alert(
        "Kursi tersebut baru saja dipesan orang lain."
      );

      await pilihJadwal(
        selectedSchedule.main
      );

      return;
    }

    /* Simpan booking */

    const { error } =
      await db
        .from("bookings")
        .insert({
          booking_code: code,
          schedule_id:
            selectedSchedule.main.id,
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

    /* WhatsApp */

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
      "Rute: " + from + " → " + to,
      "Tanggal: " + $("date").value,
      "Berangkat: " +
        jam(
          selectedSchedule.departure
        ),
      "Kendaraan: " +
        selectedSchedule.vehicle,
      "Kursi: " + selectedSeat,
      "Total: " + rupiah(price)
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
          ${selectedSchedule.vehicle}
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

    await pilihJadwal(
      selectedSchedule.main
    );

  } catch (err) {
    console.error(err);

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

  } catch (err) {
    console.error(err);
    return;
  }

  /* Tanggal minimum WIT */

  $("date").min =
    todayWIT();

  /* Event */

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

  $("book")
    .addEventListener(
      "click",
      createBooking
    );

  $("schedule").innerHTML = `
    <p class="muted">
      Pilih keberangkatan, tujuan
      dan tanggal terlebih dahulu.
    </p>
  `;

  /* Periksa jadwal setiap 30 detik */

  setInterval(() => {

    if (
      $("date").value ===
      todayWIT()
    ) {
      loadSchedules();
    }

  }, 30000);
}


/* =========================
   MULAI
========================= */

document.addEventListener(
  "DOMContentLoaded",
  startHSM
);
