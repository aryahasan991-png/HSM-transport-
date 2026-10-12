/*
============================================================
HSM TRANSPORT - ADMIN.JS
PT HIDAYAH SARANA MULIA

FITUR:
- Login admin Supabase
- Verifikasi hsm_admins / RPC
- Login harian sampai 00.00 WIT
- Pool Sofifi / Loleo / Weda / Lelilef
- Filter dan statistik booking
- Konfirmasi CASH / LUNAS
- Tiket thermal 58mm
- Tiket gambar PNG
- QR Code dan barcode
- Bagikan tiket ke WhatsApp Business
- Kirim ulang tiket
- Perjalanan selesai dan pembatalan
- Kompatibel dengan modul admin lain
============================================================
*/

"use strict";

/* ============================================================
   KONFIGURASI
============================================================ */

const HSM_CONFIG = window.HSM_CONFIG;

if (!HSM_CONFIG || !window.supabase) {
  throw new Error(
    "config.js atau Supabase tidak ditemukan."
  );
}

const adminDb = window.supabase.createClient(
  HSM_CONFIG.SUPABASE_URL,
  HSM_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

/* ============================================================
   ELEMENT
============================================================ */

const $admin = id => document.getElementById(id);

const loginSection = $admin("loginSection");
const dashboard = $admin("dashboard");
const adminEmail = $admin("adminEmail");
const adminPassword = $admin("adminPassword");
const poolSelect = $admin("poolSelect");
const loginBtn = $admin("loginBtn");
const loginMessage = $admin("loginMessage");
const logoutBtn = $admin("logoutBtn");
const refreshBtn = $admin("refreshBtn");
const bookingList = $admin("bookingList");
const searchInput = $admin("searchInput");
const dateFilter = $admin("dateFilter");
const statusFilter = $admin("statusFilter");
const statPending = $admin("statPending");
const statPaid = $admin("statPaid");
const statCompleted = $admin("statCompleted");
const statCancelled = $admin("statCancelled");
const dashboardTitle = $admin("dashboardTitle");
const activePoolBadge = $admin("activePoolBadge");

/* ============================================================
   STATE
============================================================ */

const ADMIN_DAY_KEY = "hsm_admin_login_date_wit";
const ADMIN_POOL_KEY = "hsm_admin_pool_daily";

const VALID_POOLS = [
  "Sofifi",
  "Loleo",
  "Weda",
  "Lelilef"
];

const WIT_ZONE = "Asia/Jayapura";

let bookings = [];

let selectedPool =
  localStorage.getItem(ADMIN_POOL_KEY) || "";

let currentAdminUser = null;
let adminUpdating = false;
let adminDaySigningOut = false;
let adminLoading = false;

/* ============================================================
   WAKTU INDONESIA TIMUR
============================================================ */

function todayAdminWIT() {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: WIT_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(new Date());

  const values = {};

  parts.forEach(part => {
    values[part.type] = part.value;
  });

  return (
    values.year + "-" +
    values.month + "-" +
    values.day
  );
}

/* ============================================================
   HELPERS
============================================================ */

function normalizeStatus(value) {
  const status = String(value || "")
    .trim()
    .toLowerCase();

  if (
    ["paid", "success", "settled", "lunas"]
      .includes(status)
  ) {
    return "paid";
  }

  if (
    ["completed", "selesai"]
      .includes(status)
  ) {
    return "completed";
  }

  if (
    [
      "cancelled",
      "canceled",
      "dibatalkan",
      "failed",
      "gagal"
    ].includes(status)
  ) {
    return "cancelled";
  }

  return "pending";
}

function statusLabel(value) {
  const labels = {
    pending: "MENUNGGU",
    paid: "LUNAS",
    completed: "SELESAI",
    cancelled: "DIBATALKAN"
  };

  return labels[normalizeStatus(value)];
}

function rupiah(value) {
  return "Rp" +
    Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value) {
  if (!value) return "-";

  const parts = String(value)
    .slice(0, 10)
    .split("-");

  if (parts.length !== 3) {
    return String(value);
  }

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ];

  const month = months[Number(parts[1]) - 1] || "-";

  return (
    Number(parts[2]) + " " +
    month + " " +
    parts[0]
  );
}

function formatTime(value) {
  if (!value) return "-";

  return String(value).slice(0, 5) + " WIT";
}

function formatCreated(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: WIT_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(new Date(value)) + " WIT";
  } catch {
    return String(value);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizePhone(value) {
  let phone = String(value || "")
    .replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = "62" + phone.slice(1);
  } else if (phone.startsWith("8")) {
    phone = "62" + phone;
  }

  return /^628\d{8,11}$/.test(phone)
    ? phone
    : "";
}

/* ============================================================
   ARMADA
============================================================ */

function getVehicle(booking) {
  if (String(booking.vehicle || "").trim()) {
    return String(booking.vehicle).trim();
  }

  const origin = String(booking.origin || "")
    .trim()
    .toLowerCase();

  const time = String(
    booking.departure_time || ""
  ).slice(0, 5);

  if (origin === "sofifi") {
    return {
      "09:00": "HSM-01",
      "13:00": "HSM-02"
    }[time] || "-";
  }

  if (origin === "loleo") {
    return {
      "09:30": "HSM-01",
      "13:30": "HSM-02"
    }[time] || "-";
  }

  if (origin === "lelilef") {
    return {
      "09:00": "HSM-02",
      "13:00": "HSM-01"
    }[time] || "-";
  }

  if (origin === "weda") {
    return {
      "09:45": "HSM-02",
      "09:00": "HSM-02",
      "13:45": "HSM-01",
      "13:00": "HSM-01",
      "11:30": "HSM-01",
      "15:30": "HSM-02"
    }[time] || "-";
  }

  return "-";
}

/* ============================================================
   LOGIN UI
============================================================ */

function setLoginMessage(message, type = "") {
  loginMessage.textContent = message;

  loginMessage.style.color =
    type === "error"
      ? "#dc2626"
      : type === "success"
        ? "#16a34a"
        : "#374151";
}

function isValidPool(pool) {
  return VALID_POOLS.includes(pool);
}

function setSelectedPool(pool) {
  if (!isValidPool(pool)) return false;

  selectedPool = pool;

  localStorage.setItem(ADMIN_POOL_KEY, pool);

  poolSelect.value = pool;

  updatePoolUI();

  return true;
}

function updatePoolUI() {
  if (!isValidPool(selectedPool)) return;

  dashboardTitle.textContent =
    "Admin Pool " + selectedPool;

  activePoolBadge.textContent =
    "POOL " + selectedPool.toUpperCase();
}

function showLogin() {
  loginSection.style.display = "flex";
  dashboard.style.display = "none";
  logoutBtn.style.display = "none";
}

function showDashboard() {
  loginSection.style.display = "none";
  dashboard.style.display = "block";
  logoutBtn.style.display = "inline-flex";

  updatePoolUI();
}

/* ============================================================
   VERIFIKASI ADMIN
============================================================ */

async function verifyAdmin() {
  const {
    data: userData,
    error: userError
  } = await adminDb.auth.getUser();

  if (userError || !userData?.user) {
    return false;
  }

  const user = userData.user;

  currentAdminUser = user;

  const {
    data,
    error
  } = await adminDb
    .from("hsm_admins")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!error && data) {
    return true;
  }

  try {
    const result = await adminDb.rpc("is_hsm_admin");

    return (
      !result.error &&
      result.data === true
    );
  } catch {
    return false;
  }
}

/* ============================================================
   LOGIN HARIAN SAMPAI 00.00 WIT
============================================================ */

function clearDailyLogin() {
  localStorage.removeItem(ADMIN_DAY_KEY);
  localStorage.removeItem(ADMIN_POOL_KEY);

  sessionStorage.removeItem("hsm_admin_pool");

  selectedPool = "";
}

async function expireDailyAdmin() {
  if (adminDaySigningOut) return;

  adminDaySigningOut = true;

  try {
    await adminDb.auth.signOut();
  } catch (error) {
    console.warn("ADMIN EXPIRE:", error);
  } finally {
    clearDailyLogin();

    bookings = [];
    currentAdminUser = null;

    closeTicketModal();
    showLogin();

    setLoginMessage(
      "Hari WIT telah berganti. Silakan login kembali.",
      "error"
    );

    adminDaySigningOut = false;
  }
}

async function ensureAdminDay() {
  const loginDay = localStorage.getItem(
    ADMIN_DAY_KEY
  );

  if (loginDay === todayAdminWIT()) {
    return true;
  }

  await expireDailyAdmin();

  return false;
}

/* ============================================================
   LOGIN
============================================================ */

async function loginAdmin() {
  if (adminUpdating) return;

  const email = adminEmail.value.trim();
  const password = adminPassword.value;
  const pool = poolSelect.value;

  if (
    !email ||
    !password ||
    !isValidPool(pool)
  ) {
    setLoginMessage(
      "Masukkan email, password, dan pilih pool yang benar.",
      "error"
    );
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Memeriksa...";

  try {
    const {
      data,
      error
    } = await adminDb.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (!data?.user) {
      throw new Error(
        "Akun admin tidak ditemukan."
      );
    }

    const allowed = await verifyAdmin();

    if (!allowed) {
      await adminDb.auth.signOut();

      throw new Error(
        "Akun ini tidak memiliki akses admin HSM."
      );
    }

    setSelectedPool(pool);

    localStorage.setItem(
      ADMIN_DAY_KEY,
      todayAdminWIT()
    );

    adminPassword.value = "";

    showDashboard();

    setLoginMessage(
      "Login berhasil.",
      "success"
    );

    await loadBookings();

  } catch (error) {
    showLogin();

    setLoginMessage(
      /invalid login credentials/i.test(error.message)
        ? "Email atau password salah."
        : error.message || "Login gagal.",
      "error"
    );

  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Masuk";
  }
}

/* ============================================================
   LOGOUT MANUAL
============================================================ */

async function logoutAdmin() {
  clearDailyLogin();

  bookings = [];
  currentAdminUser = null;

  closeTicketModal();

  adminPassword.value = "";
  poolSelect.value = "";

  showLogin();

  setLoginMessage(
    "Berhasil keluar dari akun.",
    "success"
  );

  try {
    await adminDb.auth.signOut();
  } catch (error) {
    console.warn("LOGOUT:", error);
  }
}

/* ============================================================
   LOAD BOOKINGS
============================================================ */

async function loadBookings() {
  if (
    adminLoading ||
    !isValidPool(selectedPool)
  ) {
    return;
  }

  if (!await ensureAdminDay()) return;

  adminLoading = true;

  bookingList.innerHTML = `
    <div class="empty">
      Memuat booking Pool
      ${escapeHtml(selectedPool)}...
    </div>
  `;

  try {
    let query = adminDb
      .from("bookings")
      .select("*")
      .eq("origin", selectedPool);

    if (dateFilter.value) {
      query = query.eq(
        "travel_date",
        dateFilter.value
      );
    }

    const {
      data,
      error
    } = await query.order(
      "created_at",
      { ascending: false }
    );

    if (error) throw error;

    bookings = data || [];

    renderBookings();

  } catch (error) {
    console.error("LOAD BOOKINGS:", error);

    bookingList.innerHTML = `
      <div class="empty">
        Gagal memuat booking.<br>
        ${escapeHtml(error.message)}
      </div>
    `;

  } finally {
    adminLoading = false;
  }
}

/* ============================================================
   FILTER
============================================================ */

function getFilteredBookings() {
  const search = searchInput.value
    .trim()
    .toLowerCase();

  const status = statusFilter.value;

  return bookings.filter(booking => {
    if (
      status &&
      normalizeStatus(booking.payment_status) !== status
    ) {
      return false;
    }

    if (!search) return true;

    const haystack = [
      booking.booking_code,
      booking.passenger_name,
      booking.phone,
      booking.origin,
      booking.destination,
      booking.travel_date,
      booking.departure_time,
      booking.vehicle,
      booking.seat_number
    ].join(" ").toLowerCase();

    return haystack.includes(search);
  });
}

/* ============================================================
   STATS
============================================================ */

function updateStats() {
  const count = {
    pending: 0,
    paid: 0,
    completed: 0,
    cancelled: 0
  };

  bookings.forEach(booking => {
    const status = normalizeStatus(
      booking.payment_status
    );

    count[status]++;
  });

  statPending.textContent = count.pending;
  statPaid.textContent = count.paid;
  statCompleted.textContent = count.completed;
  statCancelled.textContent = count.cancelled;
}

/* ============================================================
   RENDER BOOKINGS
============================================================ */

function renderBookings() {
  updateStats();

  const rows = getFilteredBookings();

  if (!rows.length) {
    bookingList.innerHTML = `
      <div class="empty">
        Tidak ada booking untuk
        Pool ${escapeHtml(selectedPool)}
        dengan filter yang dipilih.
      </div>
    `;
    return;
  }

  bookingList.innerHTML = "";

  for (const booking of rows) {
    const status = normalizeStatus(
      booking.payment_status
    );

    const phone = normalizePhone(booking.phone);
    const vehicle = getVehicle(booking);

    let actions = "";

    const button = (action, cls, label) => `
      <button
        type="button"
        class="${cls}"
        data-action="${action}"
        data-id="${escapeHtml(booking.id)}"
      >
        ${label}
      </button>
    `;

    if (status === "pending") {
      actions += button(
        "paid",
        "btn-paid",
        "Konfirmasi Cash / Lunas"
      );

      actions += button(
        "cancel",
        "btn-cancel",
        "Batalkan Tiket"
      );
    }

    if (
      status === "paid" ||
      status === "completed"
    ) {
      actions += button(
        "print",
        "btn-print",
        status === "paid"
          ? "Cetak Tiket"
          : "Cetak Ulang Tiket"
      );

      actions += button(
        "ticket-wa",
        "btn-wa",
        "🎫 Kirim Tiket WA"
      );

      if (status === "paid") {
        actions += button(
          "completed",
          "btn-completed",
          "Perjalanan Selesai"
        );
      }

      actions += button(
        "cancel",
        "btn-cancel",
        "Batalkan Tiket"
      );
    }

    if (status === "cancelled") {
      actions += `
        <button
          type="button"
          class="btn-cancel"
          disabled
        >
          Tiket Dibatalkan
        </button>
      `;
    }

    if (phone) {
      const message = encodeURIComponent(
        "Halo " +
        (booking.passenger_name || "") +
        ", terkait booking HSM Transport " +
        (booking.booking_code || "") + "."
      );

      actions += `
        <a
          class="btn-wa"
          href="https://wa.me/${phone}?text=${message}"
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
      `;
    }

    const fields = [
      ["Penumpang", booking.passenger_name],
      ["WhatsApp", booking.phone],
      [
        "Rute",
        (booking.origin || "-") +
        " → " +
        (booking.destination || "-")
      ],
      ["Tanggal", formatDate(booking.travel_date)],
      ["Jam", formatTime(booking.departure_time)],
      ["Armada", vehicle],
      ["Kursi", booking.seat_number],
      ["Total", rupiah(booking.total)],
      ["Pool", booking.origin],
      ["Status", statusLabel(status)]
    ];

    const card = document.createElement("article");
    card.className = "booking-card";

    card.innerHTML = `
      <div class="booking-head">

        <div>
          <div class="booking-code">
            ${escapeHtml(booking.booking_code || "-")}
          </div>

          <div class="created">
            Dibuat:
            ${escapeHtml(formatCreated(booking.created_at))}
          </div>
        </div>

        <span class="status ${status}">
          ${statusLabel(status)}
        </span>

      </div>

      <div class="booking-grid">
        ${fields.map(([name, value]) => `
          <div class="info">
            <span>${name}</span>
            <strong>
              ${escapeHtml(value ?? "-")}
            </strong>
          </div>
        `).join("")}
      </div>

      <div class="actions">
        ${actions}
      </div>
    `;

    bookingList.appendChild(card);
  }
}

/* ============================================================
   GET BOOKING BY ID
============================================================ */

function getBookingById(id) {
  return bookings.find(
    booking =>
      String(booking.id) === String(id)
  );
}

/* ============================================================
   UPDATE STATUS
============================================================ */

async function changeStatus(
  id,
  newStatus,
  expectedStatus
) {
  let query = adminDb
    .from("bookings")
    .update({
      payment_status: newStatus
    })
    .eq("id", id);

  if (expectedStatus) {
    query = query.eq(
      "payment_status",
      expectedStatus
    );
  }

  const {
    data,
    error
  } = await query.select(
    "id,payment_status"
  );

  if (error) throw error;

  if (!data?.length) {
    throw new Error(
      "Status tiket sudah berubah atau akses update ditolak. Refresh data."
    );
  }
}

/* ============================================================
   KONFIRMASI LUNAS
============================================================ */

async function confirmPaid(id) {
  if (adminUpdating) return;

  if (!await ensureAdminDay()) return;

  const booking = getBookingById(id);

  if (!booking) {
    alert("Booking tidak ditemukan.");
    return;
  }

  if (
    normalizeStatus(booking.payment_status) !== "pending"
  ) {
    alert("Status booking sudah berubah.");
    return;
  }

  const confirmed = confirm(
    "Konfirmasi pembayaran CASH / LUNAS?\n\n" +
    "Kode: " + (booking.booking_code || "-") + "\n" +
    "Penumpang: " +
    (booking.passenger_name || "-") + "\n" +
    "Total: " + rupiah(booking.total)
  );

  if (!confirmed) return;

  adminUpdating = true;

  try {
    await changeStatus(
      id,
      "paid",
      booking.payment_status
    );

    booking.payment_status = "paid";

    renderBookings();

    await loadBookings();

    const freshBooking =
      getBookingById(id) || booking;

    try {
      await openTicketModal(freshBooking);
    } catch (error) {
      alert(
        "Pembayaran SUDAH LUNAS, tetapi gambar tiket " +
        "gagal disiapkan:\n" +
        error.message +
        "\n\nGunakan tombol Kirim Tiket WA " +
        "untuk mencoba lagi."
      );
    }

  } catch (error) {
    console.error("PAID:", error);

    alert(
      "Gagal mengonfirmasi pembayaran:\n" +
      error.message
    );

  } finally {
    adminUpdating = false;
  }
}

/* ============================================================
   PERJALANAN SELESAI
============================================================ */

async function markCompleted(id) {
  if (adminUpdating) return;
  if (!await ensureAdminDay()) return;

  const booking = getBookingById(id);

  if (
    !booking ||
    normalizeStatus(booking.payment_status) !== "paid"
  ) {
    alert("Booking tidak dapat diselesaikan.");
    return;
  }

  if (
    !confirm(
      "Tandai perjalanan " +
      (booking.booking_code || "-") +
      " sebagai SELESAI?"
    )
  ) {
    return;
  }

  adminUpdating = true;

  try {
    await changeStatus(
      id,
      "completed",
      booking.payment_status
    );

    await loadBookings();

  } catch (error) {
    alert(
      "Gagal mengubah status: " + error.message
    );

  } finally {
    adminUpdating = false;
  }
}

/* ============================================================
   BATALKAN TIKET
============================================================ */

async function cancelBooking(id) {
  if (adminUpdating) return;
  if (!await ensureAdminDay()) return;

  const booking = getBookingById(id);

  if (
    !booking ||
    normalizeStatus(booking.payment_status) === "cancelled"
  ) {
    alert(
      "Tiket sudah dibatalkan atau tidak ditemukan."
    );
    return;
  }

  const confirmed = confirm(
    "Yakin MEMBATALKAN tiket " +
    (booking.booking_code || "-") + "?\n\n" +
    "QR tidak berlaku, kursi kembali tersedia, " +
    "dan data tidak dihapus."
  );

  if (!confirmed) return;

  adminUpdating = true;

  try {
    await changeStatus(
      id,
      "cancelled",
      booking.payment_status
    );

    await loadBookings();

    alert("Tiket berhasil dibatalkan.");

  } catch (error) {
    alert(
      "Gagal membatalkan tiket: " +
      error.message
    );

  } finally {
    adminUpdating = false;
  }
}

/* ============================================================
   LINK QR TIKET
============================================================ */

function ticketUrl(booking) {
  return (
    "https://hsm-transport.vercel.app/tiket.html?kode=" +
    encodeURIComponent(
      booking.booking_code || ""
    )
  );
}

/* ============================================================
   CETAK TIKET THERMAL 58MM
============================================================ */

function printTicket(id) {
  const booking = getBookingById(id);

  if (!booking) {
    alert("Booking tidak ditemukan.");
    return;
  }

  if (
    !["paid", "completed"].includes(
      normalizeStatus(booking.payment_status)
    )
  ) {
    alert(
      "Tiket hanya bisa dicetak jika lunas."
    );
    return;
  }

  const printWindow = window.open(
    "",
    "_blank",
    "width=420,height=720"
  );

  if (!printWindow) {
    alert(
      "Izinkan pop-up untuk mencetak tiket."
    );
    return;
  }

  const fields = [
    ["Penumpang", booking.passenger_name],
    [
      "Rute",
      (booking.origin || "-") +
      " → " +
      (booking.destination || "-")
    ],
    ["Tanggal", formatDate(booking.travel_date)],
    ["Jam", formatTime(booking.departure_time)],
    ["Armada", getVehicle(booking)],
    ["Kursi", booking.seat_number],
    ["Tarif", rupiah(booking.total)],
    ["Pembayaran", "CASH"],
    ["Status", "LUNAS"]
  ];

  const code = String(
    booking.booking_code || "-"
  );

  printWindow.document.open();

  printWindow.document.write(`
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>Tiket ${escapeHtml(code)}</title>

<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>

<style>
@page{
  size:58mm auto;
  margin:2mm;
}
*{box-sizing:border-box}
body{
  width:54mm;
  margin:0 auto;
  color:#000;
  background:#fff;
  font-family:Arial,sans-serif;
  font-size:10px;
  line-height:1.35;
}
.center,.code,.status,.qr-title,.note,.footer{
  text-align:center;
}
.brand{
  font-size:20px;
  font-weight:900;
  letter-spacing:-1px;
  margin-top:2mm;
}
.transport{
  font-size:9px;
  letter-spacing:3px;
  font-weight:900;
}
.company,.slogan{
  font-size:7px;
  margin-top:3px;
}
.line{
  border-top:1px dashed #000;
  margin:7px 0;
}
.code{
  font-size:14px;
  font-weight:900;
  margin:6px 0 3px;
}
.status{
  font-size:11px;
  font-weight:900;
}
.row{
  display:flex;
  gap:6px;
  justify-content:space-between;
  margin:4px 0;
}
.label{
  flex:0 0 37%;
  font-size:8px;
}
.value{
  flex:1;
  text-align:right;
  font-size:8px;
  font-weight:800;
  overflow-wrap:anywhere;
}
.qr-title{
  font-size:7px;
  font-weight:800;
  margin-top:7px;
}
#qrcode{
  display:flex;
  justify-content:center;
  margin:5px auto;
}
#qrcode img,
#qrcode canvas{
  width:25mm!important;
  height:25mm!important;
}
#barcode{
  display:block;
  width:46mm;
  max-height:13mm;
  margin:3px auto;
}
.note,.footer{
  font-size:7px;
  line-height:1.45;
  margin-top:6px;
}
</style>
</head>

<body>
<div class="center">
  <div class="brand">HSM</div>
  <div class="transport">TRANSPORT</div>
  <div class="company">
    PT HIDAYAH SARANA MULIA
  </div>
  <div class="slogan">
    Satu Perjalanan, Banyak Cerita
  </div>
</div>

<div class="line"></div>

<div class="code">
  ${escapeHtml(code)}
</div>

<div class="status">
  TIKET LUNAS
</div>

<div class="line"></div>

${fields.map(([label, value]) => `
  <div class="row">
    <span class="label">
      ${label}
    </span>
    <span class="value">
      ${escapeHtml(value ?? "-")}
    </span>
  </div>
`).join("")}

<div class="line"></div>

<div class="qr-title">
  SCAN UNTUK VERIFIKASI TIKET
</div>

<div id="qrcode"></div>
<svg id="barcode"></svg>

<div class="note">
  <b>PENTING:</b>
  Simpan tiket ini.
  QR Code wajib ditunjukkan kepada petugas
  HSM Transport saat akan naik ke mobil
  untuk proses scan dan verifikasi tiket.
  <br><br>
  Tiket berlaku sesuai tanggal perjalanan.
  Tiket dibatalkan tidak berlaku.
</div>

<div class="line"></div>

<div class="footer">
  HSM Transport<br>
  081356902006<br>
  hsm-transport.vercel.app
</div>

<script>
window.addEventListener("load",function(){
  try {
    new QRCode(
      document.getElementById("qrcode"),
      {
        text:${JSON.stringify(ticketUrl(booking))},
        width:180,
        height:180,
        correctLevel:QRCode.CorrectLevel.H
      }
    );

    JsBarcode(
      "#barcode",
      ${JSON.stringify(code)},
      {
        format:"CODE128",
        displayValue:true,
        fontSize:11,
        height:35,
        margin:0
      }
    );

    setTimeout(function(){
      window.print();
    },750);

  } catch(error) {
    alert(
      "Gagal menyiapkan QR/barcode: " +
      error.message
    );
  }
});
<\/script>
</body>
</html>
  `);

  printWindow.document.close();
}

/* ============================================================
   GAMBAR TIKET PNG - HELPER
============================================================ */

function rounded(
  context,
  x,
  y,
  width,
  height,
  radius,
  color
) {
  context.fillStyle = color;
  context.beginPath();

  context.roundRect(
    x,
    y,
    width,
    height,
    radius
  );

  context.fill();
}

function wrapTicketText(
  context,
  value,
  maxWidth
) {
  const words = String(value ?? "-")
    .split(/\s+/);

  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line
      ? line + " " + word
      : word;

    if (
      context.measureText(next).width > maxWidth &&
      line
    ) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);

  return lines.length ? lines : ["-"];
}

function loadCanvasImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => reject(
      new Error(
        "Gambar QR gagal dimuat."
      )
    );

    image.src = source;
  });
}

/* ============================================================
   GENERATE QR GAMBAR
============================================================ */

async function makeQRImage(text) {
  if (typeof QRCode !== "function") {
    throw new Error(
      "Library QR Code belum termuat. Refresh halaman."
    );
  }

  const host = document.createElement("div");

  host.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;" +
    "background:white";

  document.body.appendChild(host);

  try {
    new QRCode(
      host,
      {
        text,
        width:280,
        height:280,
        colorDark:"#000000",
        colorLight:"#ffffff",
        correctLevel:QRCode.CorrectLevel.H
      }
    );

    const canvas = host.querySelector("canvas");

    if (
      canvas &&
      canvas.width &&
      canvas.height
    ) {
      return await loadCanvasImage(
        canvas.toDataURL("image/png")
      );
    }

    const image = host.querySelector("img");

    if (image) {
      if (!image.complete) {
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
        });
      }

      return await loadCanvasImage(image.src);
    }

    throw new Error(
      "QR tidak terbentuk."
    );

  } finally {
    host.remove();
  }
}

/* ============================================================
   GENERATE TIKET PNG
============================================================ */

async function createTicketPNG(booking) {
  const status = normalizeStatus(
    booking.payment_status
  );

  if (
    status !== "paid" &&
    status !== "completed"
  ) {
    throw new Error(
      "Hanya tiket lunas yang dapat dibagikan."
    );
  }

  if (typeof JsBarcode !== "function") {
    throw new Error(
      "Library barcode belum termuat."
    );
  }

  const code = String(
    booking.booking_code || ""
  );

  if (!code) {
    throw new Error(
      "Kode booking kosong."
    );
  }

  const qrImage = await makeQRImage(
    ticketUrl(booking)
  );

  const barcode = document.createElement(
    "canvas"
  );

  JsBarcode(
    barcode,
    code,
    {
      format:"CODE128",
      displayValue:true,
      background:"#ffffff",
      lineColor:"#000000",
      fontSize:25,
      height:83,
      margin:10
    }
  );

  const canvas = document.createElement(
    "canvas"
  );

  canvas.width = 660;
  canvas.height = 1600;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "Canvas tidak tersedia."
    );
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.fillStyle = "#0754a6";
  ctx.fillRect(0, 0, 660, 18);

  ctx.textAlign = "center";
  ctx.fillStyle = "#111827";

  ctx.font = "900 50px Arial";
  ctx.fillText("HSM", 330, 91);

  ctx.font = "bold 21px Arial";
  ctx.fillText(
    "T R A N S P O R T",
    330,
    123
  );

  ctx.font = "bold 17px Arial";
  ctx.fillText(
    "PT HIDAYAH SARANA MULIA",
    330,
    156
  );

  ctx.font = "15px Arial";
  ctx.fillText(
    "Satu Perjalanan, Banyak Cerita",
    330,
    182
  );

  ctx.strokeStyle = "#64748b";
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(43, 207);
  ctx.lineTo(617, 207);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = "bold 32px Arial";
  ctx.fillText(code, 330, 250);

  rounded(
    ctx,
    224,
    265,
    212,
    46,
    10,
    "#e5f7eb"
  );

  ctx.fillStyle = "#167a43";
  ctx.font = "bold 24px Arial";
  ctx.fillText(
    "TIKET LUNAS",
    330,
    296
  );

  const rows = [
    [
      "Penumpang",
      booking.passenger_name || "-"
    ],
    [
      "Rute",
      (booking.origin || "-") +
      " → " +
      (booking.destination || "-")
    ],
    [
      "Tanggal",
      formatDate(booking.travel_date)
    ],
    [
      "Jam",
      formatTime(booking.departure_time)
    ],
    [
      "Armada",
      getVehicle(booking)
    ],
    [
      "Kursi",
      String(booking.seat_number ?? "-")
    ],
    [
      "Tarif",
      rupiah(booking.total)
    ],
    [
      "Pembayaran",
      "CASH"
    ],
    [
      "Status",
      "LUNAS"
    ]
  ];

  let y = 341;

  for (const [label, value] of rows) {
    ctx.textAlign = "left";
    ctx.font = "18px Arial";
    ctx.fillStyle = "#64748b";
    ctx.fillText(label, 45, y);

    ctx.font = "bold 19px Arial";
    ctx.fillStyle = "#111827";

    const lines = wrapTicketText(
      ctx,
      value,
      360
    );

    lines.forEach((line, index) => {
      ctx.textAlign = "right";
      ctx.fillText(
        line,
        615,
        y + index * 23
      );
    });

    y += Math.max(
      39,
      lines.length * 24 + 11
    );
  }

  ctx.strokeStyle = "#b9c4d2";
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(43, y);
  ctx.lineTo(617, y);
  ctx.stroke();
  ctx.setLineDash([]);

  y += 30;

  ctx.textAlign = "center";
  ctx.fillStyle = "#111827";
  ctx.font = "bold 19px Arial";

  ctx.fillText(
    "SCAN UNTUK VERIFIKASI TIKET",
    330,
    y
  );

  y += 15;

  const qrSize = 245;

  ctx.drawImage(
    qrImage,
    330 - qrSize / 2,
    y,
    qrSize,
    qrSize
  );

  y += qrSize + 15;

  const barcodeHeight = Math.round(
    barcode.height * 534 / barcode.width
  );

  ctx.drawImage(
    barcode,
    63,
    y,
    534,
    barcodeHeight
  );

  y += barcodeHeight + 26;

  rounded(
    ctx,
    38,
    y,
    584,
    92,
    10,
    "#edf5ff"
  );

  ctx.fillStyle = "#0754a6";
  ctx.textAlign = "center";

  ctx.font = "bold 17px Arial";
  ctx.fillText(
    "PENTING — SIMPAN TIKET INI",
    330,
    y + 28
  );

  ctx.font = "15px Arial";

  ctx.fillText(
    "Tunjukkan QR Code kepada petugas saat naik mobil",
    330,
    y + 53
  );

  ctx.fillText(
    "untuk scan dan verifikasi tiket.",
    330,
    y + 76
  );

  y += 113;

  ctx.fillStyle = "#475569";
  ctx.font = "14px Arial";

  ctx.fillText(
    "Tiket batal tidak berlaku meskipun gambar masih disimpan.",
    330,
    y
  );

  y += 29;

  ctx.fillStyle = "#0754a6";
  ctx.font = "bold 16px Arial";

  ctx.fillText(
    "HSM Transport • 081356902006",
    330,
    y
  );

  ctx.font = "14px Arial";

  ctx.fillText(
    "hsm-transport.vercel.app",
    330,
    y + 24
  );

  const usedHeight = Math.max(
    1160,
    y + 55
  );

  const output = document.createElement(
    "canvas"
  );

  output.width = canvas.width;
  output.height = usedHeight;

  const outputCtx = output.getContext("2d");

  outputCtx.fillStyle = "#ffffff";

  outputCtx.fillRect(
    0,
    0,
    output.width,
    output.height
  );

  outputCtx.drawImage(
    canvas,
    0,
    0
  );

  return new Promise((resolve, reject) => {
    output.toBlob(
      blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error("PNG gagal dibuat.")
          );
        }
      },
      "image/png"
    );
  });
}

/* ============================================================
   MODAL TIKET GAMBAR
============================================================ */

let activeTicketUrl = null;
let activeTicketBlob = null;
let activeTicketBooking = null;

function closeTicketModal() {
  const modal = $admin("hsmTicketModal");

  if (modal) {
    modal.remove();
  }

  if (activeTicketUrl) {
    URL.revokeObjectURL(activeTicketUrl);
  }

  activeTicketUrl = null;
  activeTicketBlob = null;
  activeTicketBooking = null;
}

/* ============================================================
   PESAN WHATSAPP PENUMPANG
============================================================ */

function ticketWAMessage(booking) {
  return (
    "🎫 *E-TIKET HSM TRANSPORT*\n\n" +

    "Halo Kak " +
    (booking.passenger_name || "Penumpang") +
    " 👋\n\n" +

    "Pembayaran tiket " +
    (booking.booking_code || "-") +
    " telah dikonfirmasi *LUNAS*. ✅\n\n" +

    "Rute: " +
    (booking.origin || "-") +
    " → " +
    (booking.destination || "-") + "\n" +

    "Tanggal: " +
    formatDate(booking.travel_date) + "\n" +

    "Jam: " +
    formatTime(booking.departure_time) + "\n" +

    "Armada: " +
    getVehicle(booking) + "\n" +

    "Kursi: " +
    (booking.seat_number ?? "-") + "\n\n" +

    "⚠️ *PENTING:* Simpan gambar tiket ini. " +
    "QR Code wajib ditunjukkan kepada petugas " +
    "saat akan naik ke mobil untuk proses " +
    "scan dan verifikasi.\n\n" +

    "Terima kasih telah memilih HSM Transport. 🚐"
  );
}

/* ============================================================
   SIMPAN PNG
============================================================ */

function downloadTicket() {
  if (
    !activeTicketBlob ||
    !activeTicketBooking
  ) {
    return;
  }

  const link = document.createElement("a");

  link.href = activeTicketUrl;

  link.download =
    "HSM-Tiket-" +
    String(
      activeTicketBooking.booking_code ||
      "booking"
    ).replace(/[^a-zA-Z0-9-]/g, "") +
    ".png";

  document.body.appendChild(link);

  link.click();
  link.remove();
}

/* ============================================================
   BUKA CHAT PENUMPANG
============================================================ */

function openTicketChat() {
  const booking = activeTicketBooking;

  if (!booking) return;

  const phone = normalizePhone(
    booking.phone
  );

  if (!phone) {
    alert(
      "Nomor WhatsApp penumpang tidak valid. " +
      "Simpan gambar lalu hubungi penumpang secara manual."
    );
    return;
  }

  const message = encodeURIComponent(
    ticketWAMessage(booking)
  );

  window.open(
    "https://wa.me/" +
    phone +
    "?text=" +
    message,
    "_blank",
    "noopener,noreferrer"
  );
}

/* ============================================================
   SHARE TIKET GAMBAR
============================================================ */

async function shareTicketFile() {
  if (
    !activeTicketBlob ||
    !activeTicketBooking
  ) {
    return;
  }

  const booking = activeTicketBooking;

  const filename =
    "HSM-Tiket-" +
    String(
      booking.booking_code || "booking"
    ).replace(/[^a-zA-Z0-9-]/g, "") +
    ".png";

  const file = new File(
    [activeTicketBlob],
    filename,
    {
      type:"image/png"
    }
  );

  if (
    navigator.canShare?.({
      files:[file]
    }) &&
    navigator.share
  ) {
    try {
      await navigator.share({
        files:[file],
        title:"Tiket HSM Transport",
        text:ticketWAMessage(booking)
      });

      return;

    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.warn("SHARE:", error);
    }
  }

  alert(
    "Berbagi gambar tidak didukung atau gagal " +
    "pada browser ini.\n\n" +
    "Simpan gambar PNG, lalu gunakan " +
    "Buka Chat WA dan lampirkan gambarnya."
  );

  downloadTicket();
}

/* ============================================================
   BUKA MODAL KIRIM TIKET
============================================================ */

async function openTicketModal(booking) {
  if (!await ensureAdminDay()) return;

  closeTicketModal();

  const ticket = {
    ...booking
  };

  const blob = await createTicketPNG(ticket);

  activeTicketBooking = ticket;
  activeTicketBlob = blob;

  activeTicketUrl = URL.createObjectURL(blob);

  const modal = document.createElement("div");

  modal.id = "hsmTicketModal";

  modal.style.cssText = `
    position:fixed;
    inset:0;
    z-index:100000;
    background:rgba(15,23,42,.72);
    display:flex;
    align-items:center;
    justify-content:center;
    padding:14px;
  `;

  modal.innerHTML = `
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Kirim tiket gambar"
      style="
        background:#fff;
        border-radius:15px;
        width:min(510px,100%);
        max-height:94vh;
        overflow:auto;
        padding:17px;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:8px;
        "
      >

        <strong style="font-size:18px">
          🎫 Tiket PNG Siap Dikirim
        </strong>

        <button
          type="button"
          id="hsmTicketClose"
          style="
            padding:9px;
            border:0;
            border-radius:8px;
          "
        >
          ✕
        </button>

      </div>

      <p
        style="
          font-size:12px;
          line-height:1.6;
          color:#475569;
        "
      >
        Pembayaran sudah LUNAS.
        Tiket untuk
        <b>${escapeHtml(ticket.passenger_name || "-")}</b>
        (${escapeHtml(ticket.booking_code || "-")})
        siap dibagikan.
        Pengiriman tetap dilakukan admin.
      </p>

      <img
        src="${activeTicketUrl}"
        alt="Gambar tiket PNG dengan QR dan barcode"
        style="
          display:block;
          width:min(300px,100%);
          max-height:48vh;
          object-fit:contain;
          margin:10px auto;
          border:1px solid #ddd;
        "
      >

      <div style="display:grid;gap:9px">

        <button
          id="hsmTicketShare"
          type="button"
          style="
            padding:13px;
            border:0;
            border-radius:9px;
            background:#25d366;
            color:#fff;
            font-weight:bold;
          "
        >
          📲 Bagikan Gambar ke WA Business
        </button>

        <button
          id="hsmTicketDownload"
          type="button"
          style="
            padding:13px;
            border:0;
            border-radius:9px;
            background:#0754a6;
            color:#fff;
            font-weight:bold;
          "
        >
          ⬇ Simpan Tiket PNG
        </button>

        <button
          id="hsmTicketChat"
          type="button"
          style="
            padding:13px;
            border:1px solid #16a34a;
            border-radius:9px;
            background:#fff;
            color:#166534;
            font-weight:bold;
          "
        >
          💬 Buka Chat Nomor Penumpang
        </button>

      </div>

      <p
        style="
          font-size:11px;
          line-height:1.6;
          color:#64748b;
        "
      >
        Jika menu Bagikan tersedia,
        pilih WhatsApp Business dan penerima,
        lalu tekan Kirim.

        Jika tidak didukung,
        simpan PNG dan lampirkan di chat penumpang.

        Link WhatsApp tidak bisa
        menyematkan gambar otomatis.
      </p>

    </section>
  `;

  document.body.appendChild(modal);

  $admin("hsmTicketClose").onclick =
    closeTicketModal;

  $admin("hsmTicketShare").onclick =
    shareTicketFile;

  $admin("hsmTicketDownload").onclick =
    downloadTicket;

  $admin("hsmTicketChat").onclick =
    openTicketChat;

  modal.addEventListener(
    "click",
    event => {
      if (event.target === modal) {
        closeTicketModal();
      }
    }
  );
}

/* ============================================================
   BOOKING ACTION EVENTS
============================================================ */

bookingList.addEventListener(
  "click",
  async event => {
    const button = event.target.closest(
      "[data-action]"
    );

    if (
      !button ||
      button.disabled
    ) {
      return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    button.disabled = true;

    try {
      if (action === "paid") {
        await confirmPaid(id);

      } else if (action === "print") {
        printTicket(id);

      } else if (action === "ticket-wa") {
        const booking = getBookingById(id);

        if (booking) {
          await openTicketModal(booking);
        }

      } else if (action === "completed") {
        await markCompleted(id);

      } else if (action === "cancel") {
        await cancelBooking(id);
      }

    } catch (error) {
      console.error("BOOKING ACTION:", error);

      alert(
        "Gagal memproses: " + error.message
      );

    } finally {
      button.disabled = false;
    }
  }
);

/* ============================================================
   LOGIN / LOGOUT / FILTER EVENTS
============================================================ */

loginBtn.addEventListener(
  "click",
  loginAdmin
);

adminPassword.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      loginAdmin();
    }
  }
);

logoutBtn.addEventListener(
  "click",
  logoutAdmin
);

refreshBtn.addEventListener(
  "click",
  loadBookings
);

searchInput.addEventListener(
  "input",
  renderBookings
);

statusFilter.addEventListener(
  "change",
  renderBookings
);

dateFilter.addEventListener(
  "change",
  loadBookings
);

/* ============================================================
   INITIAL SESSION
============================================================ */

async function initializeAdmin() {
  try {
    const {
      data,
      error
    } = await adminDb.auth.getSession();

    if (error) throw error;

    if (!data?.session) {
      clearDailyLogin();
      showLogin();
      return;
    }

    if (
      localStorage.getItem(ADMIN_DAY_KEY) !==
      todayAdminWIT()
    ) {
      await expireDailyAdmin();
      return;
    }

    if (!isValidPool(selectedPool)) {
      showLogin();

      setLoginMessage(
        "Pilih pool dan login kembali.",
        "error"
      );

      return;
    }

    const allowed = await verifyAdmin();

    if (!allowed) {
      await expireDailyAdmin();
      return;
    }

    poolSelect.value = selectedPool;

    showDashboard();

    await loadBookings();

  } catch (error) {
    console.error(
      "INITIAL ADMIN:",
      error
    );

    showLogin();

    setLoginMessage(
      "Gagal memeriksa sesi admin.",
      "error"
    );
  }
}

/* ============================================================
   OTOMATIS LOGOUT SAAT PERGANTIAN HARI WIT
============================================================ */

setInterval(
  () => {
    if (
      dashboard.style.display === "block" &&
      localStorage.getItem(ADMIN_DAY_KEY) !==
      todayAdminWIT()
    ) {
      expireDailyAdmin();
    }
  },
  10000
);

/* ============================================================
   SAAT TAB ADMIN DIBUKA KEMBALI
============================================================ */

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.hidden ||
      dashboard.style.display !== "block"
    ) {
      return;
    }

    ensureAdminDay().then(valid => {
      if (!valid) return;

      adminDb.auth.getUser().then(
        ({ data, error }) => {
          if (
            error ||
            !data?.user
          ) {
            expireDailyAdmin();
          }
        }
      );
    });
  }
);

/* ============================================================
   START
============================================================ */

initializeAdmin();
