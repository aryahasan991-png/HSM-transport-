// ============================================================
// HSM TRANSPORT - ADMIN.JS
// ============================================================
// FITUR:
// - Login admin Supabase
// - Verifikasi admin
// - Data booking
// - Filter tanggal / status / pencarian
// - Statistik
// - Konfirmasi CASH / LUNAS
// - Tandai perjalanan selesai
// - Batalkan tiket
// - Cetak tiket thermal 58mm
// - Barcode booking_code
// - QR verifikasi tiket
// - Armada HSM-01 / HSM-02
// ============================================================

const HSM_CONFIG = window.HSM_CONFIG;

if (!HSM_CONFIG) {
  throw new Error("config.js tidak ditemukan.");
}

if (!window.supabase) {
  throw new Error("Supabase tidak ditemukan.");
}

const adminDb =
  window.supabase.createClient(
    HSM_CONFIG.SUPABASE_URL,
    HSM_CONFIG.SUPABASE_PUBLISHABLE_KEY
  );


// ============================================================
// ELEMENT
// ============================================================

const loginSection =
  document.getElementById("loginSection");

const dashboard =
  document.getElementById("dashboard");

const adminEmail =
  document.getElementById("adminEmail");

const adminPassword =
  document.getElementById("adminPassword");

const loginBtn =
  document.getElementById("loginBtn");

const loginMessage =
  document.getElementById("loginMessage");

const logoutBtn =
  document.getElementById("logoutBtn");

const bookingList =
  document.getElementById("bookingList");

const searchInput =
  document.getElementById("searchInput");

const dateFilter =
  document.getElementById("dateFilter");

const statusFilter =
  document.getElementById("statusFilter");

const refreshBtn =
  document.getElementById("refreshBtn");

const statPending =
  document.getElementById("statPending");

const statPaid =
  document.getElementById("statPaid");

const statCompleted =
  document.getElementById("statCompleted");

const statCancelled =
  document.getElementById("statCancelled");


// ============================================================
// STATE
// ============================================================

let allBookings = [];


// ============================================================
// UTILITIES
// ============================================================

function rupiah(value) {
  return "Rp" +
    Number(value || 0)
      .toLocaleString("id-ID");
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatDate(value) {

  if (!value) {
    return "-";
  }

  const parts =
    String(value).split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


function formatTime(value) {

  if (!value) {
    return "-";
  }

  return String(value)
    .substring(0, 5);
}


function formatCreatedAt(value) {

  if (!value) {
    return "-";
  }

  try {

    const date =
      new Date(value);

    return date.toLocaleString(
      "id-ID",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );

  }

  catch {

    return String(value);

  }
}


// ============================================================
// STATUS
// ============================================================

function normalizeStatus(value) {

  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    status === "paid" ||
    status === "success" ||
    status === "settled" ||
    status === "lunas"
  ) {
    return "paid";
  }

  if (
    status === "completed" ||
    status === "selesai"
  ) {
    return "completed";
  }

  if (
    status === "cancelled" ||
    status === "canceled" ||
    status === "dibatalkan" ||
    status === "failed" ||
    status === "gagal"
  ) {
    return "cancelled";
  }

  return "pending";
}


function statusLabel(value) {

  const status =
    normalizeStatus(value);

  if (status === "pending") {
    return "Menunggu Pembayaran";
  }

  if (status === "paid") {
    return "Lunas";
  }

  if (status === "completed") {
    return "Selesai";
  }

  if (status === "cancelled") {
    return "Dibatalkan";
  }

  return status;
}


// ============================================================
// WHATSAPP
// ============================================================

function whatsappNumber(phone) {

  let value =
    String(phone || "")
      .replace(/\D/g, "");

  if (value.startsWith("0")) {

    value =
      "62" +
      value.substring(1);

  }

  else if (value.startsWith("8")) {

    value =
      "62" + value;

  }

  return value;
}


// ============================================================
// ARMADA
// ============================================================

function getVehicle(booking) {

  if (
    booking.vehicle &&
    String(booking.vehicle).trim()
  ) {

    return String(
      booking.vehicle
    ).trim();

  }

  const origin =
    String(
      booking.origin || ""
    )
      .trim()
      .toLowerCase();

  const time =
    formatTime(
      booking.departure_time
    );

  if (
    origin === "sofifi" &&
    time === "09:00"
  ) {
    return "HSM-01";
  }

  if (
    origin === "lelilef" &&
    time === "09:00"
  ) {
    return "HSM-02";
  }

  if (
    origin === "lelilef" &&
    time === "13:00"
  ) {
    return "HSM-01";
  }

  if (
    origin === "sofifi" &&
    time === "13:00"
  ) {
    return "HSM-02";
  }

  return "-";
}


// ============================================================
// DISPLAY
// ============================================================

function showLogin() {

  if (loginSection) {
    loginSection.style.display =
      "flex";
  }

  if (dashboard) {
    dashboard.style.display =
      "none";
  }

  if (logoutBtn) {
    logoutBtn.style.display =
      "none";
  }
}


function showDashboard() {

  if (loginSection) {
    loginSection.style.display =
      "none";
  }

  if (dashboard) {
    dashboard.style.display =
      "block";
  }

  if (logoutBtn) {
    logoutBtn.style.display =
      "block";
  }
}


// ============================================================
// VERIFY ADMIN
// ============================================================

async function verifyAdmin() {

  const {
    data: userData,
    error: userError
  } =
    await adminDb.auth.getUser();

  if (userError) {
    throw userError;
  }

  const user =
    userData?.user;

  if (!user) {
    return false;
  }

  const {
    data,
    error
  } =
    await adminDb
      .from("hsm_admins")
      .select("user_id,email")
      .eq("user_id", user.id)
      .maybeSingle();

  if (error) {

    console.error(
      "ADMIN CHECK:",
      error
    );

    const rpcResult =
      await adminDb.rpc(
        "is_hsm_admin"
      );

    if (!rpcResult.error) {
      return rpcResult.data === true;
    }

    throw error;
  }

  return Boolean(data);
}


// ============================================================
// LOGIN
// ============================================================

async function login() {

  const email =
    adminEmail
      ? adminEmail.value.trim()
      : "";

  const password =
    adminPassword
      ? adminPassword.value
      : "";

  if (!email || !password) {

    if (loginMessage) {

      loginMessage.style.color =
        "#dc2626";

      loginMessage.textContent =
        "Masukkan email dan password.";
    }

    return;
  }

  if (loginBtn) {

    loginBtn.disabled =
      true;

    loginBtn.textContent =
      "Memeriksa...";
  }

  if (loginMessage) {
    loginMessage.textContent = "";
  }

  try {

    const { error } =
      await adminDb.auth
        .signInWithPassword({
          email,
          password
        });

    if (error) {
      throw error;
    }

    const isAdmin =
      await verifyAdmin();

    if (!isAdmin) {

      await adminDb.auth.signOut();

      throw new Error(
        "Akun ini bukan administrator HSM."
      );
    }

    if (adminPassword) {
      adminPassword.value = "";
    }

    showDashboard();

    await loadBookings();

  }

  catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    if (loginMessage) {

      loginMessage.style.color =
        "#dc2626";

      loginMessage.textContent =
        error.message ||
        "Login gagal.";
    }

  }

  finally {

    if (loginBtn) {

      loginBtn.disabled =
        false;

      loginBtn.textContent =
        "Masuk";
    }
  }
}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

  await adminDb.auth.signOut();

  allBookings = [];

  showLogin();
}


// ============================================================
// LOAD BOOKINGS
// ============================================================

async function loadBookings() {

  if (!bookingList) {
    return;
  }

  bookingList.innerHTML = `
    <div class="empty">
      Memuat data booking...
    </div>
  `;

  try {

    const {
      data: sessionData
    } =
      await adminDb.auth
        .getSession();

    if (!sessionData.session) {

      showLogin();

      return;
    }

    const selectedDate =
      dateFilter
        ? dateFilter.value
        : "";

    let query =
      adminDb
        .from("bookings")
        .select("*");

    if (selectedDate) {

      query =
        query.eq(
          "travel_date",
          selectedDate
        );
    }

    query =
      query.order(
        "created_at",
        {
          ascending: false
        }
      );

    const {
      data,
      error
    } =
      await query;

    if (error) {
      throw error;
    }

    allBookings =
      Array.isArray(data)
        ? data
        : [];

    updateStats();

    renderBookings();

  }

  catch (error) {

    console.error(
      "LOAD BOOKINGS ERROR:",
      error
    );

    bookingList.innerHTML = `
      <div class="empty">

        <strong>
          Gagal memuat data booking
        </strong>

        <br><br>

        ${escapeHtml(
          error.message
        )}

      </div>
    `;
  }
}


// ============================================================
// STATS
// ============================================================

function updateStats() {

  let pending = 0;
  let paid = 0;
  let completed = 0;
  let cancelled = 0;

  allBookings.forEach(
    booking => {

      const status =
        normalizeStatus(
          booking.payment_status
        );

      if (status === "pending") {
        pending++;
      }

      else if (status === "paid") {
        paid++;
      }

      else if (status === "completed") {
        completed++;
      }

      else if (status === "cancelled") {
        cancelled++;
      }
    }
  );

  if (statPending) {
    statPending.textContent =
      pending;
  }

  if (statPaid) {
    statPaid.textContent =
      paid;
  }

  if (statCompleted) {
    statCompleted.textContent =
      completed;
  }

  if (statCancelled) {
    statCancelled.textContent =
      cancelled;
  }
}


// ============================================================
// FILTER
// ============================================================

function getFilteredBookings() {

  const search =
    searchInput
      ? String(
          searchInput.value || ""
        )
          .trim()
          .toLowerCase()
      : "";

  const selectedStatus =
    statusFilter
      ? statusFilter.value
      : "";

  return allBookings.filter(
    item => {

      const status =
        normalizeStatus(
          item.payment_status
        );

      if (
        selectedStatus &&
        status !== selectedStatus
      ) {
        return false;
      }

      if (search) {

        const haystack = [
          item.booking_code,
          item.passenger_name,
          item.phone,
          item.origin,
          item.destination,
          getVehicle(item),
          item.seat_number
        ]
          .join(" ")
          .toLowerCase();

        if (
          !haystack.includes(
            search
          )
        ) {
          return false;
        }
      }

      return true;
    }
  );
}


// ============================================================
// RENDER BOOKINGS
// ============================================================

function renderBookings() {

  if (!bookingList) {
    return;
  }

  const rows =
    getFilteredBookings();

  bookingList.innerHTML = "";

  if (!rows.length) {

    const selectedDate =
      dateFilter
        ? dateFilter.value
        : "";

    bookingList.innerHTML = `
      <div class="empty">
        ${
          selectedDate
            ? "Tidak ada booking untuk tanggal " +
              escapeHtml(
                formatDate(selectedDate)
              ) +
              "."
            : "Belum ada data booking."
        }
      </div>
    `;

    return;
  }

  rows.forEach(
    item => {

      const status =
        normalizeStatus(
          item.payment_status
        );

      const vehicle =
        getVehicle(item);

      const card =
        document.createElement(
          "article"
        );

      card.className =
        "booking-card";

      const phone =
        whatsappNumber(
          item.phone
        );

      const waMessage = `
Halo ${item.passenger_name || ""},

Booking HSM Transport Anda:

Kode: ${item.booking_code || "-"}
Rute: ${item.origin || "-"} → ${item.destination || "-"}
Tanggal: ${formatDate(item.travel_date)}
Jam: ${formatTime(item.departure_time)} WIT
Armada: ${vehicle}
Kursi: ${item.seat_number || "-"}
Status: ${statusLabel(item.payment_status)}
      `.trim();

      const whatsappUrl =
        phone
          ? (
              "https://api.whatsapp.com/send?phone=" +
              encodeURIComponent(phone) +
              "&text=" +
              encodeURIComponent(waMessage)
            )
          : "#";

      let actions = "";

      if (status === "pending") {

        actions += `
          <button
            class="btn-paid"
            data-action="paid"
            data-id="${escapeHtml(item.id)}"
          >
            ✓ Konfirmasi Cash / Lunas
          </button>

          <button
            class="btn-cancel"
            data-action="cancelled"
            data-id="${escapeHtml(item.id)}"
          >
            Batalkan
          </button>
        `;
      }

      else if (status === "paid") {

        actions += `
          <button
            class="btn-print"
            data-action="print"
            data-id="${escapeHtml(item.id)}"
          >
            🖨 Cetak Tiket
          </button>

          <button
            class="btn-completed"
            data-action="completed"
            data-id="${escapeHtml(item.id)}"
          >
            Tandai Selesai
          </button>

          <button
            class="btn-cancel"
            data-action="cancelled"
            data-id="${escapeHtml(item.id)}"
          >
            Batalkan Tiket
          </button>
        `;
      }

      else if (status === "completed") {

        actions += `
          <button
            class="btn-print"
            data-action="print"
            data-id="${escapeHtml(item.id)}"
          >
            🖨 Cetak Ulang Tiket
          </button>
        `;
      }

      if (phone) {

        actions += `
          <a
            class="btn-wa"
            href="${whatsappUrl}"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        `;
      }

      card.innerHTML = `

        <div class="booking-head">

          <div>

            <div class="booking-code">
              ${escapeHtml(
                item.booking_code || "-"
              )}
            </div>

            <div class="created">
              Dibooking:
              ${escapeHtml(
                formatCreatedAt(
                  item.created_at
                )
              )}
            </div>

          </div>

          <span
            class="status ${escapeHtml(status)}"
          >
            ${escapeHtml(
              statusLabel(
                item.payment_status
              )
            )}
          </span>

        </div>


        <div class="booking-grid">

          <div class="info">
            <span>Nama</span>
            <strong>
              ${escapeHtml(
                item.passenger_name || "-"
              )}
            </strong>
          </div>

          <div class="info">
            <span>WhatsApp</span>
            <strong>
              ${escapeHtml(
                item.phone || "-"
              )}
            </strong>
          </div>

          <div class="info">
            <span>Dari</span>
            <strong>
              ${escapeHtml(
                item.origin || "-"
              )}
            </strong>
          </div>

          <div class="info">
            <span>Tujuan</span>
            <strong>
              ${escapeHtml(
                item.destination || "-"
              )}
            </strong>
          </div>

          <div class="info">
            <span>Tanggal</span>
            <strong>
              ${escapeHtml(
                formatDate(
                  item.travel_date
                )
              )}
            </strong>
          </div>

          <div class="info">
            <span>Jam</span>
            <strong>
              ${escapeHtml(
                formatTime(
                  item.departure_time
                )
              )} WIT
            </strong>
          </div>

          <div class="info">
            <span>Armada</span>
            <strong>
              ${escapeHtml(vehicle)}
            </strong>
          </div>

          <div class="info">
            <span>Kursi</span>
            <strong>
              ${escapeHtml(
                String(
                  item.seat_number || "-"
                )
              )}
            </strong>
          </div>

          <div class="info">
            <span>Total</span>
            <strong>
              ${escapeHtml(
                rupiah(item.total)
              )}
            </strong>
          </div>

          <div class="info">
            <span>Status</span>
            <strong>
              ${escapeHtml(
                statusLabel(
                  item.payment_status
                )
              )}
            </strong>
          </div>

        </div>

        <div class="actions">
          ${actions}
        </div>
      `;

      bookingList.appendChild(
        card
      );
    }
  );

  bindActionButtons();
}


// ============================================================
// ACTION BUTTONS
// ============================================================

function bindActionButtons() {

  if (!bookingList) {
    return;
  }

  bookingList
    .querySelectorAll(
      "button[data-action]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          async () => {

            const id =
              button.dataset.id;

            const action =
              button.dataset.action;

            if (
              action === "print"
            ) {

              printTicket(id);

              return;
            }

            await changeStatus(
              id,
              action
            );
          }
        );
      }
    );
}


// ============================================================
// CHANGE STATUS
// ============================================================

async function changeStatus(
  id,
  newStatus
) {

  const booking =
    allBookings.find(
      item =>
        String(item.id) ===
        String(id)
    );

  if (!booking) {

    alert(
      "Booking tidak ditemukan."
    );

    return;
  }

  let question = "";

  if (newStatus === "paid") {

    question =
      `Konfirmasi pembayaran CASH untuk ${booking.booking_code} dan tandai sebagai LUNAS?`;
  }

  else if (
    newStatus === "completed"
  ) {

    question =
      `Tandai booking ${booking.booking_code} sebagai SELESAI?`;
  }

  else if (
    newStatus === "cancelled"
  ) {

    const currentStatus =
      normalizeStatus(
        booking.payment_status
      );

    if (
      currentStatus === "paid"
    ) {

      question =
        `Batalkan tiket LUNAS ${booking.booking_code}?\n\nBooking tetap tersimpan sebagai riwayat dan kursi dapat tersedia kembali. Pengembalian uang ditangani secara terpisah.`;

    }

    else {

      question =
        `Batalkan booking ${booking.booking_code}?\n\nData tidak akan dihapus dan kursi dapat tersedia kembali.`;

    }
  }

  if (
    !window.confirm(question)
  ) {
    return;
  }

  try {

    const {
      data,
      error
    } =
      await adminDb
        .from("bookings")
        .update({
          payment_status:
            newStatus
        })
        .eq(
          "id",
          id
        )
        .select(
          "id,payment_status"
        );

    if (error) {
      throw error;
    }

    if (
      !data ||
      data.length === 0
    ) {

      throw new Error(
        "Database tidak mengubah booking. Periksa policy UPDATE admin."
      );
    }

    await loadBookings();

  }

  catch (error) {

    console.error(
      "UPDATE STATUS ERROR:",
      error
    );

    alert(
      "Gagal mengubah status:\n" +
      (
        error.message ||
        "Unknown error"
      )
    );
  }
}


// ============================================================
// PRINT TICKET - THERMAL 58MM
// ============================================================

function printTicket(id) {

  const booking =
    allBookings.find(
      item =>
        String(item.id) ===
        String(id)
    );

  if (!booking) {

    alert(
      "Booking tidak ditemukan."
    );

    return;
  }

  const status =
    normalizeStatus(
      booking.payment_status
    );

  if (
    status !== "paid" &&
    status !== "completed"
  ) {

    alert(
      "Tiket hanya dapat dicetak setelah pembayaran LUNAS."
    );

    return;
  }

  const vehicle =
    getVehicle(booking);

  const code =
    String(
      booking.booking_code || "-"
    );

  // QR mengarah ke halaman verifikasi publik.
  const verificationUrl =
    "https://hsm-transport.vercel.app/tiket.html?kode=" +
    encodeURIComponent(code);

  const printWindow =
    window.open(
      "",
      "_blank",
      "width=420,height=900"
    );

  if (!printWindow) {

    alert(
      "Browser memblokir jendela cetak. Izinkan pop-up untuk halaman admin HSM."
    );

    return;
  }

  const ticketHtml = `
<!DOCTYPE html>

<html lang="id">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1.0"
>

<title>
Tiket ${escapeHtml(code)}
</title>

<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>

<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>

<style>

@page {
  size: 58mm auto;
  margin: 1.5mm;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #000;

  font-family:
    Arial,
    Helvetica,
    sans-serif;
}

.ticket {
  width: 55mm;
  margin: 0 auto;
  padding:
    2mm
    1.5mm
    5mm;
}


/* =========================
   LOGO
========================= */

.logo {
  text-align: center;
}

.logo-hsm {
  font-family:
    Arial Black,
    Arial,
    sans-serif;

  font-size: 27px;
  line-height: 26px;
  font-weight: 900;
  letter-spacing: -2px;
}

.logo-transport {
  margin-top: 1px;

  font-size: 9px;
  font-weight: 900;
  letter-spacing: 3.2px;
}

.company-name {
  margin-top: 5px;

  text-align: center;

  font-size: 8px;
  font-weight: 800;
}

.tagline-top {
  margin-top: 3px;

  text-align: center;

  font-size: 7px;
  font-style: italic;
}


/* =========================
   DIVIDER
========================= */

.line {
  border-top:
    1px dashed #000;

  margin:
    7px 0;
}


/* =========================
   TITLE
========================= */

.ticket-title {
  text-align: center;

  font-size: 13px;
  font-weight: 900;

  letter-spacing:
    .5px;
}


/* =========================
   DATA
========================= */

.row {
  display: flex;
  align-items: flex-start;

  margin:
    3px 0;

  font-size:
    9px;

  line-height:
    1.35;
}

.label {
  width: 34%;
}

.separator {
  width: 5%;
}

.value {
  width: 61%;

  font-weight:
    800;

  word-break:
    break-word;
}

.code-value {
  font-size:
    11px;

  font-weight:
    900;
}

.seat-value {
  font-size:
    16px;

  line-height:
    16px;

  font-weight:
    900;
}

.paid-value {
  font-size:
    11px;

  font-weight:
    900;
}


/* =========================
   NOTICE
========================= */

.notice {
  margin:
    5px 1px;

  text-align:
    center;

  font-size:
    7px;

  line-height:
    1.45;
}


/* =========================
   QR
========================= */

.qr-section {
  text-align:
    center;

  margin-top:
    5px;
}

#ticketQr {
  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  width:
    26mm;

  height:
    26mm;

  margin:
    0 auto 4px;
}

#ticketQr img,
#ticketQr canvas {
  display:
    block;

  width:
    25mm !important;

  height:
    25mm !important;
}

.qr-title {
  font-size:
    8px;

  font-weight:
    900;
}

.qr-subtitle {
  margin-top:
    2px;

  font-size:
    6.5px;

  line-height:
    1.3;
}


/* =========================
   BARCODE
========================= */

.barcode {
  text-align:
    center;

  overflow:
    hidden;

  margin-top:
    4px;
}

.barcode svg {
  width:
    100%;

  max-width:
    50mm;

  height:
    auto;
}


/* =========================
   FOOTER
========================= */

.thank-you {
  margin-top:
    6px;

  text-align:
    center;

  font-size:
    9px;

  font-weight:
    900;
}

.contact {
  margin-top:
    5px;

  text-align:
    center;

  font-size:
    7px;

  line-height:
    1.55;
}

.story {
  margin-top:
    8px;

  text-align:
    center;

  font-family:
    "Brush Script MT",
    cursive;

  font-size:
    11px;

  font-style:
    italic;

  font-weight:
    700;
}


/* =========================
   BUTTON
========================= */

.no-print {
  margin-top:
    18px;

  text-align:
    center;
}

.no-print button {
  border:
    none;

  border-radius:
    7px;

  padding:
    11px 20px;

  background:
    #111;

  color:
    #fff;

  font-weight:
    900;

  cursor:
    pointer;
}


@media print {

  .no-print {
    display:
      none;
  }

  html,
  body {
    width:
      58mm;
  }
}

</style>

</head>


<body>

<div class="ticket">


  <!-- LOGO -->

  <div class="logo">

    <div class="logo-hsm">
      HSM
    </div>

    <div class="logo-transport">
      TRANSPORT
    </div>

  </div>


  <div class="company-name">
    PT HIDAYAH SARANA MULIA
  </div>


  <div class="tagline-top">
    Perjalanan Nyaman, Sampai Tujuan
  </div>


  <div class="line"></div>


  <!-- TITLE -->

  <div class="ticket-title">
    TIKET PENUMPANG
  </div>


  <div class="line"></div>


  <!-- BOOKING -->

  <div class="row">

    <div class="label">
      Kode Booking
    </div>

    <div class="separator">
      :
    </div>

    <div class="value code-value">
      ${escapeHtml(code)}
    </div>

  </div>


  <div class="row">

    <div class="label">
      Nama
    </div>

    <div class="separator">
      :
    </div>

    <div class="value">
      ${escapeHtml(
        booking.passenger_name || "-"
      )}
    </div>

  </div>


  <div class="row">

    <div class="label">
      Rute
    </div>

    <div class="separator">
      :
    </div>

    <div class="value">
      ${escapeHtml(
        booking.origin || "-"
      )}
      →
      ${escapeHtml(
        booking.destination || "-"
      )}
    </div>

  </div>


  <div class="row">

    <div class="label">
      Tanggal
    </div>

    <div class="separator">
      :
    </div>

    <div class="value">
      ${escapeHtml(
        formatDate(
          booking.travel_date
        )
      )}
    </div>

  </div>


  <div class="row">

    <div class="label">
      Jam
    </div>

    <div class="separator">
      :
    </div>

    <div class="value">
      ${escapeHtml(
        formatTime(
          booking.departure_time
        )
      )} WIT
    </div>

  </div>


  <div class="row">

    <div class="label">
      Armada
    </div>

    <div class="separator">
      :
    </div>

    <div class="value">
      ${escapeHtml(vehicle)}
    </div>

  </div>


  <div class="row">

    <div class="label">
      No. Kursi
    </div>

    <div class="separator">
      :
    </div>

    <div class="value seat-value">
      ${escapeHtml(
        String(
          booking.seat_number || "-"
        )
      )}
    </div>

  </div>


  <div class="row">

    <div class="label">
      Tarif
    </div>

    <div class="separator">
      :
    </div>

    <div class="value">
      ${escapeHtml(
        rupiah(
          booking.total
        )
      )}
    </div>

  </div>


  <div class="row">

    <div class="label">
      Pembayaran
    </div>

    <div class="separator">
      :
    </div>

    <div class="value">
      CASH
    </div>

  </div>


  <div class="row">

    <div class="label">
      Status
    </div>

    <div class="separator">
      :
    </div>

    <div class="value paid-value">
      LUNAS
    </div>

  </div>


  <div class="line"></div>


  <!-- NOTICE -->

  <div class="notice">

    Harap hadir sebelum waktu keberangkatan.

    <br>

    Simpan tiket ini selama perjalanan.

    <br>

    Tunjukkan tiket kepada petugas
    HSM Transport apabila diperlukan.

  </div>


  <div class="line"></div>


  <!-- QR -->

  <div class="qr-section">

    <div id="ticketQr"></div>

    <div class="qr-title">
      SCAN UNTUK VERIFIKASI TIKET
    </div>

    <div class="qr-subtitle">
      Status tiket diperiksa melalui sistem HSM Transport
    </div>

  </div>


  <div class="line"></div>


  <!-- BARCODE -->

  <div class="barcode">
    <svg id="ticketBarcode"></svg>
  </div>


  <div class="line"></div>


  <!-- FOOTER -->

  <div class="thank-you">
    TERIMA KASIH
  </div>


  <div class="contact">

    HSM Transport

    <br>

    081356902006

    <br>

    hsm-transport.vercel.app

  </div>


  <div class="story">
    Satu Perjalanan, Banyak Cerita
  </div>


  <div class="no-print">

    <button
      onclick="window.print()"
    >
      CETAK TIKET
    </button>

  </div>

</div>


<script>

window.addEventListener(
  "load",
  function () {

    // BARCODE

    try {

      JsBarcode(
        "#ticketBarcode",
        ${JSON.stringify(code)},
        {
          format:
            "CODE128",

          displayValue:
            true,

          fontSize:
            10,

          height:
            35,

          margin:
            0,

          width:
            1.15
        }
      );

    }

    catch (error) {

      console.error(
        "BARCODE ERROR:",
        error
      );

    }


    // QR VERIFIKASI

    try {

      new QRCode(
        document.getElementById(
          "ticketQr"
        ),
        {
          text:
            ${JSON.stringify(
              verificationUrl
            )},

          width:
            180,

          height:
            180,

          colorDark:
            "#000000",

          colorLight:
            "#ffffff",

          correctLevel:
            QRCode.CorrectLevel.M
        }
      );

    }

    catch (error) {

      console.error(
        "QR ERROR:",
        error
      );

    }

  }
);

<\/script>

</body>

</html>
  `;


  printWindow.document.open();

  printWindow.document.write(
    ticketHtml
  );

  printWindow.document.close();
}


// ============================================================
// EVENTS
// ============================================================

if (loginBtn) {

  loginBtn.addEventListener(
    "click",
    login
  );
}


if (adminPassword) {

  adminPassword.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {
        login();
      }
    }
  );
}


if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    logout
  );
}


if (refreshBtn) {

  refreshBtn.addEventListener(
    "click",
    async () => {

      await loadBookings();

    }
  );
}


if (searchInput) {

  searchInput.addEventListener(
    "input",
    renderBookings
  );
}


if (dateFilter) {

  dateFilter.addEventListener(
    "change",
    async () => {

      if (searchInput) {
        searchInput.value = "";
      }

      await loadBookings();

    }
  );
}


if (statusFilter) {

  statusFilter.addEventListener(
    "change",
    renderBookings
  );
}


// ============================================================
// INITIAL ADMIN
// ============================================================

async function initAdmin() {

  try {

    const {
      data: {
        session
      }
    } =
      await adminDb.auth
        .getSession();

    if (!session) {

      showLogin();

      return;
    }

    const isAdmin =
      await verifyAdmin();

    if (!isAdmin) {

      await adminDb.auth
        .signOut();

      showLogin();

      if (loginMessage) {

        loginMessage.style.color =
          "#dc2626";

        loginMessage.textContent =
          "Akun ini bukan administrator HSM.";
      }

      return;
    }

    showDashboard();

    await loadBookings();

  }

  catch (error) {

    console.error(
      "ADMIN INIT ERROR:",
      error
    );

    showLogin();

    if (loginMessage) {

      loginMessage.style.color =
        "#dc2626";

      loginMessage.textContent =
        error.message ||
        "Gagal membuka dashboard.";
    }
  }
}


initAdmin();
