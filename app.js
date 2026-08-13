const cfg = window.HSM_CONFIG;
let db = null, selectedSchedule = null, selectedSeat = null, schedules = [];

function rupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0
  }).format(Number(n) || 0);
}

function showError(message, err) {
  const el = document.querySelector("#schedule");
  if (el) el.innerHTML = '<span class="error">' + message + '</span>';
  console.error("HSM:", message, err || "");
}

async function loadSchedules() {
  selectedSchedule = null;
  selectedSeat = null;
  const dateEl = document.querySelector("#date");
  const scheduleEl = document.querySelector("#schedule");
  const seatsEl = document.querySelector("#seats");

  if (!db) return showError("Koneksi Supabase belum siap.");
  scheduleEl.textContent = "Memuat jadwal...";
  seatsEl.innerHTML = '<p class="muted">Pilih jadwal terlebih dahulu.</p>';

  try {
    const { data, error } = await db.from("schedules")
      .select("*")
      .eq("travel_date", dateEl.value)
      .eq("active", true)
      .order("departure_time");

    if (error) return showError("Gagal memuat jadwal: " + error.message, error);

    schedules = data || [];
    if (!schedules.length) {
      scheduleEl.textContent = "Belum ada jadwal pada tanggal " + dateEl.value + ".";
      return;
    }

    scheduleEl.innerHTML = schedules.map(s => `
      <button type="button" class="scheduleBtn" data-id="${s.id}">
        ${String(s.departure_time || "").slice(0,5)}
        <small>${rupiah(s.price)}</small>
      </button>
    `).join("");

    document.querySelectorAll(".scheduleBtn").forEach(btn => {
      btn.addEventListener("click", () => pickSchedule(Number(btn.dataset.id), btn));
    });
  } catch (e) {
    showError("Terjadi kesalahan saat memuat jadwal.", e);
  }
}

async function pickSchedule(id, button) {
  selectedSchedule = schedules.find(x => Number(x.id) === Number(id));
  selectedSeat = null;
  if (!selectedSchedule) return alert("Jadwal tidak ditemukan.");

  document.querySelectorAll(".scheduleBtn").forEach(x => x.classList.remove("active"));
  if (button) button.classList.add("active");

  const seatsEl = document.querySelector("#seats");
  seatsEl.innerHTML = "<p class='muted'>Memuat kursi...</p>";

  try {
    const { data, error } = await db.from("bookings")
      .select("seat_number")
      .eq("schedule_id", id)
      .neq("payment_status", "Batal");

    if (error) {
      seatsEl.innerHTML = '<p class="error">Gagal memuat kursi: ' + error.message + '</p>';
      return;
    }

    const used = (data || []).map(x => Number(x.seat_number));
    seatsEl.innerHTML = Array.from({length:14}, (_,i) => {
      const n = i + 1, taken = used.includes(n);
      return `<button type="button" class="seat ${taken ? "taken" : ""}" ${taken ? "disabled" : ""} data-seat="${n}">Kursi ${n}</button>`;
    }).join("");

    document.querySelectorAll(".seat:not(:disabled)").forEach(btn => {
      btn.addEventListener("click", () => pickSeat(Number(btn.dataset.seat), btn));
    });
  } catch (e) {
    seatsEl.innerHTML = '<p class="error">Terjadi kesalahan saat memuat kursi.</p>';
    console.error(e);
  }
}

function pickSeat(n, button) {
  selectedSeat = n;
  document.querySelectorAll(".seat").forEach(x => x.classList.remove("selected"));
  if (button) button.classList.add("selected");
}

async function createBooking() {
  if (!selectedSchedule || !selectedSeat) return alert("Pilih jadwal dan kursi.");

  const name = document.querySelector("#name").value.trim();
  const phone = document.querySelector("#phone").value.trim();
  if (!name || !phone) return alert("Isi nama dan nomor WhatsApp.");

  const code = "HSM-" + crypto.randomUUID().slice(0,6).toUpperCase();
  const button = document.querySelector("#book");
  button.disabled = true;
  button.textContent = "Memproses...";

  try {
    const { error } = await db.from("bookings").insert({
      booking_code: code,
      schedule_id: selectedSchedule.id,
      passenger_name: name,
      phone,
      seat_number: selectedSeat,
      total: selectedSchedule.price,
      payment_status: "Belum Bayar"
    });

    if (error) {
      alert(error.code === "23505"
        ? "Kursi sudah dipesan orang lain. Silakan pilih kursi lain."
        : "Booking gagal: " + error.message);
      return;
    }

    const msg = [
      "Halo HSM Transport, saya ingin konfirmasi booking.",
      "Kode: " + code,
      "Nama: " + name,
      "Rute: " + (selectedSchedule.route || ""),
      "Tanggal: " + document.querySelector("#date").value,
      "Jam: " + String(selectedSchedule.departure_time || "").slice(0,5),
      "Kursi: " + selectedSeat,
      "Total: " + rupiah(selectedSchedule.price)
    ].join("\n");

    const wa = String(cfg.WHATSAPP_ADMIN || "").replace(/\D/g, "");
    document.querySelector("#result").innerHTML = `
      <div class="success">
        <b>Booking berhasil!</b><strong>${code}</strong>
        <p>${selectedSchedule.route || ""}<br>
        ${document.querySelector("#date").value} • ${String(selectedSchedule.departure_time || "").slice(0,5)}
        • Kursi ${selectedSeat}<br>Total ${rupiah(selectedSchedule.price)}</p>
        ${wa ? `<a target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">Konfirmasi via WhatsApp</a>` :
        '<p class="error">Nomor WhatsApp admin belum diisi di config.js.</p>'}
      </div>`;
    await pickSchedule(selectedSchedule.id);
  } catch (e) {
    console.error(e);
    alert("Terjadi kesalahan saat menyimpan booking.");
  } finally {
    button.disabled = false;
    button.textContent = "Pesan Sekarang";
  }
}

async function startHSM() {
  const dateEl = document.querySelector("#date");
  const bookButton = document.querySelector("#book");

  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY)
    return showError("Config HSM belum lengkap. Periksa config.js.");

  if (!window.supabase)
    return showError("Library Supabase tidak termuat. Periksa koneksi internet.");

  try {
    db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  } catch (e) {
    return showError("Gagal membuat koneksi Supabase.", e);
  }

  if (!dateEl || !bookButton) return showError("Elemen halaman HSM tidak lengkap.");

  const today = new Date().toISOString().slice(0,10);
  dateEl.value = dateEl.value || today;
  dateEl.min = today;
  dateEl.addEventListener("change", loadSchedules);
  bookButton.addEventListener("click", createBooking);
  await loadSchedules();
}

document.addEventListener("DOMContentLoaded", startHSM);
