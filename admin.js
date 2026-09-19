// ============================================================
// HSM TRANSPORT - ADMIN.JS
// ============================================================
// FITUR:
// - Login admin Supabase
// - Password diverifikasi Supabase
// - Verifikasi hsm_admins
// - Pilih Pool: Sofifi / Loleo / Weda / Lelilef
// - Booking otomatis difilter berdasarkan origin pool
// - Filter tanggal / status / pencarian
// - Statistik
// - Konfirmasi CASH / LUNAS
// - Setelah LUNAS tiket langsung dibuka untuk dicetak
// - Tandai perjalanan selesai
// - Batalkan pending / paid / completed
// - Data pembatalan TIDAK dihapus
// - Tiket thermal 58mm
// - Barcode booking_code
// - QR verifikasi tiket
// - Armada HSM-01 / HSM-02
// ============================================================


// ============================================================
// CONFIG
// ============================================================

const HSM_CONFIG = window.HSM_CONFIG;

if (!HSM_CONFIG) {
  throw new Error("config.js tidak ditemukan.");
}

if (!window.supabase) {
  throw new Error("Supabase tidak ditemukan.");
}


// ============================================================
// SUPABASE
// ============================================================

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

const poolSelect =
  document.getElementById("poolSelect");

const loginBtn =
  document.getElementById("loginBtn");

const loginMessage =
  document.getElementById("loginMessage");

const logoutBtn =
  document.getElementById("logoutBtn");

const refreshBtn =
  document.getElementById("refreshBtn");

const bookingList =
  document.getElementById("bookingList");

const searchInput =
  document.getElementById("searchInput");

const dateFilter =
  document.getElementById("dateFilter");

const statusFilter =
  document.getElementById("statusFilter");

const statPending =
  document.getElementById("statPending");

const statPaid =
  document.getElementById("statPaid");

const statCompleted =
  document.getElementById("statCompleted");

const statCancelled =
  document.getElementById("statCancelled");

const dashboardTitle =
  document.getElementById("dashboardTitle");

const activePoolBadge =
  document.getElementById("activePoolBadge");


// ============================================================
// STATE
// ============================================================

let bookings = [];

let selectedPool =
  sessionStorage.getItem(
    "hsm_admin_pool"
  ) || "";

let currentAdminUser =
  null;


// ============================================================
// VALID POOLS
// ============================================================

const VALID_POOLS = [
  "Sofifi",
  "Loleo",
  "Weda",
  "Lelilef"
];


// ============================================================
// HELPERS
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


function statusLabel(status) {

  const normalized =
    normalizeStatus(status);


  if (normalized === "paid") {
    return "LUNAS";
  }

  if (normalized === "completed") {
    return "SELESAI";
  }

  if (normalized === "cancelled") {
    return "DIBATALKAN";
  }

  return "MENUNGGU";
}


function rupiah(value) {

  return "Rp" +
    Number(value || 0)
      .toLocaleString("id-ID");
}


function formatDate(value) {

  if (!value) {
    return "-";
  }


  const parts =
    String(value)
      .split("-");


  if (parts.length !== 3) {
    return value;
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


  const year =
    parts[0];

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);


  if (
    !month ||
    month < 1 ||
    month > 12
  ) {
    return value;
  }


  return (
    day +
    " " +
    months[month - 1] +
    " " +
    year
  );
}


function formatTime(value) {

  if (!value) {
    return "-";
  }


  return (
    String(value)
      .substring(0, 5) +
    " WIT"
  );
}


function formatCreated(value) {

  if (!value) {
    return "-";
  }


  try {

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone:
          "Asia/Jayapura",

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    ).format(
      new Date(value)
    ) + " WIT";

  }

  catch {

    return value;
  }
}


function escapeHtml(value) {

  return String(value ?? "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


function normalizePhone(value) {

  let phone =
    String(value || "")
      .replace(/\D/g, "");


  if (
    phone.startsWith("0")
  ) {

    phone =
      "62" +
      phone.substring(1);

  }


  else if (
    phone.startsWith("8")
  ) {

    phone =
      "62" + phone;

  }


  return phone;
}


// ============================================================
// VEHICLE
// ============================================================

function getVehicle(booking) {

  if (
    booking.vehicle &&
    String(
      booking.vehicle
    ).trim()
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
    String(
      booking.departure_time || ""
    )
      .substring(0, 5);


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
// LOGIN MESSAGE
// ============================================================

function setLoginMessage(
  message,
  type = ""
) {

  if (!loginMessage) {
    return;
  }


  loginMessage.textContent =
    message;


  if (type === "error") {

    loginMessage.style.color =
      "#dc2626";

  }

  else if (type === "success") {

    loginMessage.style.color =
      "#16a34a";

  }

  else {

    loginMessage.style.color =
      "#374151";

  }
}


// ============================================================
// POOL
// ============================================================

function isValidPool(pool) {

  return VALID_POOLS.includes(
    pool
  );
}


function setSelectedPool(pool) {

  if (!isValidPool(pool)) {
    return false;
  }


  selectedPool =
    pool;


  sessionStorage.setItem(
    "hsm_admin_pool",
    pool
  );


  if (poolSelect) {

    poolSelect.value =
      pool;
  }


  updatePoolUI();


  return true;
}


function updatePoolUI() {

  if (
    !selectedPool ||
    !isValidPool(
      selectedPool
    )
  ) {
    return;
  }


  if (dashboardTitle) {

    dashboardTitle.textContent =
      "Admin Pool " +
      selectedPool;
  }


  if (activePoolBadge) {

    activePoolBadge.textContent =
      "POOL " +
      selectedPool.toUpperCase();
  }
}


// ============================================================
// SHOW LOGIN
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


// ============================================================
// SHOW DASHBOARD
// ============================================================

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
      "inline-flex";
  }


  updatePoolUI();
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


  if (
    userError ||
    !userData?.user
  ) {

    return false;
  }


  const user =
    userData.user;


  currentAdminUser =
    user;


  // ==========================================================
  // CHECK hsm_admins
  // ==========================================================

  const {
    data,
    error
  } =
    await adminDb
      .from("hsm_admins")
      .select("*")
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();


  if (
    !error &&
    data
  ) {

    return true;
  }


  // ==========================================================
  // FALLBACK RPC
  // ==========================================================

  try {

    const {
      data: rpcData,
      error: rpcError
    } =
      await adminDb.rpc(
        "is_hsm_admin"
      );


    if (
      !rpcError &&
      rpcData === true
    ) {

      return true;
    }

  }

  catch (rpcError) {

    console.warn(
      "RPC ADMIN CHECK:",
      rpcError
    );
  }


  return false;
}


// ============================================================
// LOGIN
// ============================================================

async function loginAdmin() {

  const email =
    adminEmail
      ? adminEmail.value.trim()
      : "";


  const password =
    adminPassword
      ? adminPassword.value
      : "";


  const pool =
    poolSelect
      ? poolSelect.value
      : "";


  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (!email) {

    setLoginMessage(
      "Masukkan email admin.",
      "error"
    );

    adminEmail?.focus();

    return;
  }


  if (!password) {

    setLoginMessage(
      "Masukkan password.",
      "error"
    );

    adminPassword?.focus();

    return;
  }


  if (
    !pool ||
    !isValidPool(pool)
  ) {

    setLoginMessage(
      "Pilih pool terlebih dahulu.",
      "error"
    );

    poolSelect?.focus();

    return;
  }


  if (loginBtn) {

    loginBtn.disabled =
      true;

    loginBtn.textContent =
      "Memeriksa...";
  }


  setLoginMessage(
    "Memeriksa akun..."
  );


  try {

    // ========================================================
    // SUPABASE AUTH
    // PASSWORD SALAH AKAN GAGAL DI SINI
    // ========================================================

    const {
      data,
      error
    } =
      await adminDb.auth
        .signInWithPassword({
          email:
            email,

          password:
            password
        });


    if (error) {

      throw error;
    }


    if (
      !data?.user
    ) {

      throw new Error(
        "Akun admin tidak ditemukan."
      );
    }


    // ========================================================
    // VERIFY ADMIN ROLE
    // ========================================================

    const allowed =
      await verifyAdmin();


    if (!allowed) {

      await adminDb.auth
        .signOut();


      throw new Error(
        "Akun ini tidak memiliki akses admin HSM."
      );
    }


    // ========================================================
    // SAVE POOL
    // ========================================================

    setSelectedPool(
      pool
    );


    setLoginMessage(
      "Login berhasil.",
      "success"
    );


    showDashboard();


    await loadBookings();

  }

  catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );


    let message =
      String(
        error?.message ||
        ""
      );


    const lower =
      message.toLowerCase();


    if (
      lower.includes(
        "invalid login credentials"
      ) ||
      lower.includes(
        "invalid credentials"
      )
    ) {

      message =
        "Email atau password salah.";
    }


    else if (
      lower.includes(
        "email not confirmed"
      )
    ) {

      message =
        "Email admin belum dikonfirmasi.";
    }


    else if (!message) {

      message =
        "Login gagal.";
    }


    setLoginMessage(
      message,
      "error"
    );


    showLogin();

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

async function logoutAdmin() {

  try {

    await adminDb.auth
      .signOut();

  }

  catch (error) {

    console.warn(
      "LOGOUT:",
      error
    );
  }


  currentAdminUser =
    null;


  selectedPool =
    "";


  sessionStorage.removeItem(
    "hsm_admin_pool"
  );


  bookings =
    [];


  if (adminPassword) {
    adminPassword.value =
      "";
  }


  if (poolSelect) {
    poolSelect.value =
      "";
  }


  setLoginMessage(
    ""
  );


  showLogin();
}


// ============================================================
// LOAD BOOKINGS
// ============================================================

async function loadBookings() {

  if (
    !selectedPool ||
    !isValidPool(
      selectedPool
    )
  ) {

    showLogin();


    setLoginMessage(
      "Pilih pool terlebih dahulu.",
      "error"
    );


    return;
  }


  if (bookingList) {

    bookingList.innerHTML = `
      <div class="empty">
        Memuat booking Pool
        ${escapeHtml(selectedPool)}...
      </div>
    `;
  }


  try {

    let query =
      adminDb
        .from("bookings")
        .select("*");


    // ========================================================
    // FILTER BERDASARKAN POOL / ORIGIN
    // ========================================================

    query =
      query.eq(
        "origin",
        selectedPool
      );


    // ========================================================
    // FILTER TANGGAL
    // ========================================================

    const selectedDate =
      dateFilter
        ? dateFilter.value
        : "";


    if (selectedDate) {

      query =
        query.eq(
          "travel_date",
          selectedDate
        );
    }


    // ========================================================
    // ORDER
    // ========================================================

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


    bookings =
      data || [];


    renderBookings();

  }

  catch (error) {

    console.error(
      "LOAD BOOKINGS ERROR:",
      error
    );


    if (bookingList) {

      bookingList.innerHTML = `
        <div class="empty">
          <strong>
            Gagal memuat booking.
          </strong>

          <br><br>

          ${escapeHtml(
            error.message ||
            "Terjadi kesalahan."
          )}
        </div>
      `;
    }

  }
}


// ============================================================
// FILTER BOOKINGS
// ============================================================

function getFilteredBookings() {

  const search =
    String(
      searchInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const status =
    String(
      statusFilter?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  return bookings.filter(
    booking => {

      const bookingStatus =
        normalizeStatus(
          booking.payment_status
        );


      if (
        status &&
        bookingStatus !==
          status
      ) {

        return false;
      }


      if (!search) {
        return true;
      }


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
      ]
        .join(" ")
        .toLowerCase();


      return haystack.includes(
        search
      );

    }
  );
}


// ============================================================
// STATS
// ============================================================

function updateStats() {

  let pending =
    0;

  let paid =
    0;

  let completed =
    0;

  let cancelled =
    0;


  bookings.forEach(
    booking => {

      const status =
        normalizeStatus(
          booking.payment_status
        );


      if (
        status === "paid"
      ) {
        paid++;
      }


      else if (
        status === "completed"
      ) {
        completed++;
      }


      else if (
        status === "cancelled"
      ) {
        cancelled++;
      }


      else {
        pending++;
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
// RENDER BOOKINGS
// ============================================================

function renderBookings() {

  updateStats();


  if (!bookingList) {
    return;
  }


  const rows =
    getFilteredBookings();


  if (!rows.length) {

    bookingList.innerHTML = `
      <div class="empty">
        Tidak ada booking untuk
        <strong>
          Pool ${escapeHtml(
            selectedPool
          )}
        </strong>
        dengan filter yang dipilih.
      </div>
    `;

    return;
  }


  bookingList.innerHTML =
    "";


  rows.forEach(
    booking => {

      const status =
        normalizeStatus(
          booking.payment_status
        );


      const vehicle =
        getVehicle(
          booking
        );


      const phone =
        normalizePhone(
          booking.phone
        );


      const waText =
        encodeURIComponent(
          `Halo ${booking.passenger_name || ""}, ` +
          `terkait booking HSM Transport ` +
          `${booking.booking_code || ""}.`
        );


      const waURL =
        phone
          ? `https://wa.me/${phone}?text=${waText}`
          : "#";


      const card =
        document.createElement(
          "article"
        );


      card.className =
        "booking-card";


      // ======================================================
      // ACTION BUTTONS
      // ======================================================

      let actions =
        "";


      // PENDING

      if (
        status === "pending"
      ) {

        actions += `
          <button
            type="button"
            class="btn-paid"
            data-action="paid"
            data-id="${escapeHtml(
              booking.id
            )}"
          >
            Konfirmasi Cash / Lunas
          </button>
        `;


        actions += `
          <button
            type="button"
            class="btn-cancel"
            data-action="cancel"
            data-id="${escapeHtml(
              booking.id
            )}"
          >
            Batalkan Tiket
          </button>
        `;
      }


      // PAID

      else if (
        status === "paid"
      ) {

        actions += `
          <button
            type="button"
            class="btn-print"
            data-action="print"
            data-id="${escapeHtml(
              booking.id
            )}"
          >
            Cetak Tiket
          </button>
        `;


        actions += `
          <button
            type="button"
            class="btn-completed"
            data-action="completed"
            data-id="${escapeHtml(
              booking.id
            )}"
          >
            Perjalanan Selesai
          </button>
        `;


        actions += `
          <button
            type="button"
            class="btn-cancel"
            data-action="cancel"
            data-id="${escapeHtml(
              booking.id
            )}"
          >
            Batalkan Tiket
          </button>
        `;
      }


      // COMPLETED
      // TETAP BISA DIBATALKAN

      else if (
        status === "completed"
      ) {

        actions += `
          <button
            type="button"
            class="btn-print"
            data-action="print"
            data-id="${escapeHtml(
              booking.id
            )}"
          >
            Cetak Ulang Tiket
          </button>
        `;


        actions += `
          <button
            type="button"
            class="btn-cancel"
            data-action="cancel"
            data-id="${escapeHtml(
              booking.id
            )}"
          >
            Batalkan Tiket
          </button>
        `;
      }


      // CANCELLED

      else if (
        status === "cancelled"
      ) {

        actions += `
          <button
            type="button"
            class="btn-cancel"
            disabled
            style="opacity:.6;cursor:not-allowed;"
          >
            Tiket Dibatalkan
          </button>
        `;
      }


      // WHATSAPP

      if (phone) {

        actions += `
          <a
            class="btn-wa"
            href="${waURL}"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        `;
      }


      // ======================================================
      // CARD
      // ======================================================

      card.innerHTML = `

        <div class="booking-head">

          <div>

            <div class="booking-code">
              ${escapeHtml(
                booking.booking_code ||
                "-"
              )}
            </div>

            <div class="created">
              Dibuat:
              ${escapeHtml(
                formatCreated(
                  booking.created_at
                )
              )}
            </div>

          </div>


          <span
            class="status ${status}"
          >
            ${statusLabel(
              booking.payment_status
            )}
          </span>

        </div>


        <div class="booking-grid">

          <div class="info">
            <span>Penumpang</span>
            <strong>
              ${escapeHtml(
                booking.passenger_name ||
                "-"
              )}
            </strong>
          </div>


          <div class="info">
            <span>WhatsApp</span>
            <strong>
              ${escapeHtml(
                booking.phone ||
                "-"
              )}
            </strong>
          </div>


          <div class="info">
            <span>Rute</span>
            <strong>
              ${escapeHtml(
                booking.origin ||
                "-"
              )}
              →
              ${escapeHtml(
                booking.destination ||
                "-"
              )}
            </strong>
          </div>


          <div class="info">
            <span>Tanggal</span>
            <strong>
              ${escapeHtml(
                formatDate(
                  booking.travel_date
                )
              )}
            </strong>
          </div>


          <div class="info">
            <span>Jam</span>
            <strong>
              ${escapeHtml(
                formatTime(
                  booking.departure_time
                )
              )}
            </strong>
          </div>


          <div class="info">
            <span>Armada</span>
            <strong>
              ${escapeHtml(
                vehicle
              )}
            </strong>
          </div>


          <div class="info">
            <span>Kursi</span>
            <strong>
              ${escapeHtml(
                booking.seat_number ||
                "-"
              )}
            </strong>
          </div>


          <div class="info">
            <span>Total</span>
            <strong>
              ${escapeHtml(
                rupiah(
                  booking.total
                )
              )}
            </strong>
          </div>


          <div class="info">
            <span>Pool</span>
            <strong>
              ${escapeHtml(
                booking.origin ||
                "-"
              )}
            </strong>
          </div>


          <div class="info">
            <span>Status</span>
            <strong>
              ${escapeHtml(
                statusLabel(
                  booking.payment_status
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
}


// ============================================================
// GET BOOKING BY ID
// ============================================================

function getBookingById(id) {

  return bookings.find(
    booking =>
      String(booking.id) ===
      String(id)
  );
}


// ============================================================
// CHANGE STATUS
// ============================================================

async function changeStatus(
  id,
  newStatus
) {

  const {
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
      );


  if (error) {
    throw error;
  }
}


// ============================================================
// CONFIRM PAID + AUTO PRINT
// ============================================================

async function confirmPaid(id) {

  const booking =
    getBookingById(
      id
    );


  if (!booking) {

    alert(
      "Booking tidak ditemukan."
    );

    return;
  }


  const confirmed =
    confirm(
      "Konfirmasi pembayaran CASH / LUNAS?\n\n" +
      "Kode: " +
      (
        booking.booking_code ||
        "-"
      ) +
      "\n" +
      "Penumpang: " +
      (
        booking.passenger_name ||
        "-"
      ) +
      "\n" +
      "Total: " +
      rupiah(
        booking.total
      )
    );


  if (!confirmed) {
    return;
  }


  try {

    await changeStatus(
      id,
      "paid"
    );


    // ========================================================
    // UPDATE LOCAL STATE SEBELUM PRINT
    // ========================================================

    booking.payment_status =
      "paid";


    renderBookings();


    // ========================================================
    // CETAK OTOMATIS
    // ========================================================

    printTicket(
      id
    );


    // Refresh dari database

    await loadBookings();

  }

  catch (error) {

    console.error(
      "PAID ERROR:",
      error
    );


    alert(
      "Gagal mengonfirmasi pembayaran:\n" +
      (
        error.message ||
        "Terjadi kesalahan."
      )
    );
  }
}


// ============================================================
// COMPLETED
// ============================================================

async function markCompleted(id) {

  const booking =
    getBookingById(
      id
    );


  if (!booking) {

    alert(
      "Booking tidak ditemukan."
    );

    return;
  }


  const confirmed =
    confirm(
      "Tandai perjalanan ini sebagai SELESAI?\n\n" +
      "Kode: " +
      (
        booking.booking_code ||
        "-"
      )
    );


  if (!confirmed) {
    return;
  }


  try {

    await changeStatus(
      id,
      "completed"
    );


    await loadBookings();

  }

  catch (error) {

    console.error(
      "COMPLETED ERROR:",
      error
    );


    alert(
      "Gagal mengubah status perjalanan:\n" +
      (
        error.message ||
        "Terjadi kesalahan."
      )
    );
  }
}


// ============================================================
// CANCEL
// ============================================================

async function cancelBooking(id) {

  const booking =
    getBookingById(
      id
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
    status === "cancelled"
  ) {

    alert(
      "Tiket ini sudah dibatalkan."
    );

    return;
  }


  const confirmed =
    confirm(
      "Yakin ingin MEMBATALKAN tiket ini?\n\n" +
      "Kode: " +
      (
        booking.booking_code ||
        "-"
      ) +
      "\n" +
      "Penumpang: " +
      (
        booking.passenger_name ||
        "-"
      ) +
      "\n" +
      "Kursi: " +
      (
        booking.seat_number ||
        "-"
      ) +
      "\n\n" +
      "Setelah dibatalkan:\n" +
      "- QR tiket tidak berlaku\n" +
      "- Kursi akan tersedia kembali\n" +
      "- Data booking tetap tersimpan"
    );


  if (!confirmed) {
    return;
  }


  try {

    await changeStatus(
      id,
      "cancelled"
    );


    await loadBookings();


    alert(
      "Tiket berhasil dibatalkan.\n\n" +
      "Kursi dapat digunakan kembali."
    );

  }

  catch (error) {

    console.error(
      "CANCEL ERROR:",
      error
    );


    alert(
      "Gagal membatalkan tiket:\n" +
      (
        error.message ||
        "Terjadi kesalahan."
      )
    );
  }
}


// ============================================================
// PRINT TICKET
// ============================================================

function printTicket(id) {

  const booking =
    getBookingById(
      id
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


  // ==========================================================
  // HANYA LUNAS / SELESAI
  // ==========================================================

  if (
    status !== "paid" &&
    status !== "completed"
  ) {

    alert(
      status === "cancelled"
        ? "Tiket yang dibatalkan tidak dapat dicetak."
        : "Tiket hanya dapat dicetak setelah pembayaran LUNAS."
    );

    return;
  }


  const vehicle =
    getVehicle(
      booking
    );


  const bookingCodeValue =
    booking.booking_code ||
    "-";


  const qrURL =
    "https://hsm-transport.vercel.app/tiket.html?kode=" +
    encodeURIComponent(
      bookingCodeValue
    );


  // ==========================================================
  // SAFE PRINT VALUES
  // ==========================================================

  const safeBookingCode =
    escapeHtml(
      bookingCodeValue
    );


  const safePassenger =
    escapeHtml(
      booking.passenger_name ||
      "-"
    );


  const safeOrigin =
    escapeHtml(
      booking.origin ||
      "-"
    );


  const safeDestination =
    escapeHtml(
      booking.destination ||
      "-"
    );


  const safeDate =
    escapeHtml(
      formatDate(
        booking.travel_date
      )
    );


  const safeTime =
    escapeHtml(
      formatTime(
        booking.departure_time
      )
    );


  const safeVehicle =
    escapeHtml(
      vehicle
    );


  const safeSeat =
    escapeHtml(
      booking.seat_number ||
      "-"
    );


  const safeTotal =
    escapeHtml(
      rupiah(
        booking.total
      )
    );


  const printWindow =
    window.open(
      "",
      "_blank",
      "width=420,height=720"
    );


  if (!printWindow) {

    alert(
      "Browser memblokir halaman cetak.\n" +
      "Izinkan pop-up untuk website admin HSM."
    );

    return;
  }


  printWindow.document.open();


  printWindow.document.write(`
<!DOCTYPE html>

<html lang="id">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
Tiket ${safeBookingCode}
</title>


<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>

<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>


<style>

@page {
  size: 58mm auto;
  margin: 2mm;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  width: 54mm;

  margin: 0 auto;

  background: #ffffff;

  color: #000000;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size: 10px;

  line-height: 1.35;
}

.ticket {
  width: 100%;
}

.center {
  text-align: center;
}

.brand {
  margin-top: 2mm;

  font-size: 20px;

  font-weight: 900;

  letter-spacing: -1px;
}

.transport {
  margin-top: -2px;

  font-size: 9px;

  font-weight: 900;

  letter-spacing: 3px;
}

.company {
  margin-top: 3px;

  font-size: 7px;

  font-weight: 700;
}

.slogan {
  margin-top: 2px;

  font-size: 7px;
}

.line {
  margin: 7px 0;

  border-top: 1px dashed #000000;
}

.code {
  margin: 6px 0 3px;

  text-align: center;

  font-size: 14px;

  font-weight: 900;
}

.row {
  display: flex;

  align-items: flex-start;

  justify-content: space-between;

  gap: 6px;

  margin: 4px 0;
}

.label {
  flex: 0 0 37%;

  font-size: 8px;
}

.value {
  flex: 1;

  text-align: right;

  font-size: 8px;

  font-weight: 800;

  overflow-wrap: anywhere;
}

.status {
  margin-top: 5px;

  text-align: center;

  font-size: 11px;

  font-weight: 900;
}

.qr-title {
  margin-top: 7px;

  text-align: center;

  font-size: 7px;

  font-weight: 800;
}

#qrcode {
  display: flex;

  justify-content: center;

  margin: 5px auto;
}

#qrcode img,
#qrcode canvas {
  width: 25mm !important;

  height: 25mm !important;
}

#barcode {
  display: block;

  width: 46mm;

  max-height: 13mm;

  margin: 3px auto 0;
}

.note {
  margin-top: 5px;

  text-align: center;

  font-size: 7px;

  line-height: 1.4;
}

.footer {
  margin-top: 6px;

  text-align: center;

  font-size: 7px;

  line-height: 1.5;
}

@media print {

  body {
    width: 54mm;
  }

}

</style>

</head>


<body>

<div class="ticket">


  <div class="center">

    <div class="brand">
      HSM
    </div>

    <div class="transport">
      TRANSPORT
    </div>

    <div class="company">
      PT HIDAYAH SARANA MULIA
    </div>

    <div class="slogan">
      Satu Perjalanan, Banyak Cerita
    </div>

  </div>


  <div class="line"></div>


  <div class="code">
    ${safeBookingCode}
  </div>


  <div class="status">
    TIKET LUNAS
  </div>


  <div class="line"></div>


  <div class="row">
    <span class="label">
      Penumpang
    </span>

    <span class="value">
      ${safePassenger}
    </span>
  </div>


  <div class="row">
    <span class="label">
      Rute
    </span>

    <span class="value">
      ${safeOrigin}
      →
      ${safeDestination}
    </span>
  </div>


  <div class="row">
    <span class="label">
      Tanggal
    </span>

    <span class="value">
      ${safeDate}
    </span>
  </div>


  <div class="row">
    <span class="label">
      Jam
    </span>

    <span class="value">
      ${safeTime}
    </span>
  </div>


  <div class="row">
    <span class="label">
      Armada
    </span>

    <span class="value">
      ${safeVehicle}
    </span>
  </div>


  <div class="row">
    <span class="label">
      Kursi
    </span>

    <span class="value">
      ${safeSeat}
    </span>
  </div>


  <div class="row">
    <span class="label">
      Tarif
    </span>

    <span class="value">
      ${safeTotal}
    </span>
  </div>


  <div class="row">
    <span class="label">
      Pembayaran
    </span>

    <span class="value">
      CASH
    </span>
  </div>


  <div class="row">
    <span class="label">
      Status
    </span>

    <span class="value">
      LUNAS
    </span>
  </div>


  <div class="line"></div>


  <div class="qr-title">
    SCAN UNTUK VERIFIKASI TIKET
  </div>


  <div id="qrcode"></div>


  <svg id="barcode"></svg>


  <div class="note">
    Tiket hanya berlaku sesuai tanggal perjalanan.
    Tiket yang telah dibatalkan tidak berlaku
    meskipun struk masih dimiliki penumpang.
  </div>


  <div class="line"></div>


  <div class="footer">

    HSM Transport

    <br>

    081356902006

    <br>

    hsm-transport.vercel.app

  </div>

</div>


<script>

window.addEventListener(
  "load",
  function () {

    try {

      new QRCode(
        document.getElementById(
          "qrcode"
        ),
        {
          text:
            ${JSON.stringify(qrURL)},

          width:
            180,

          height:
            180,

          correctLevel:
            QRCode.CorrectLevel.H
        }
      );

    }

    catch (error) {

      console.error(
        "QR ERROR:",
        error
      );
    }


    try {

      JsBarcode(
        "#barcode",
        ${JSON.stringify(bookingCodeValue)},
        {
          format:
            "CODE128",

          displayValue:
            true,

          fontSize:
            11,

          height:
            35,

          margin:
            0
        }
      );

    }

    catch (error) {

      console.error(
        "BARCODE ERROR:",
        error
      );
    }


    setTimeout(
      function () {

        window.print();

      },
      650
    );

  }
);

<\/script>

</body>

</html>
  `);


  printWindow.document.close();
}


// ============================================================
// BOOKING ACTION CLICK
// ============================================================

if (bookingList) {

  bookingList.addEventListener(
    "click",
    async function (event) {

      const button =
        event.target.closest(
          "[data-action]"
        );


      if (!button) {
        return;
      }


      const action =
        button.dataset.action;


      const id =
        button.dataset.id;


      if (
        !action ||
        !id
      ) {
        return;
      }


      button.disabled =
        true;


      try {

        if (
          action === "paid"
        ) {

          await confirmPaid(
            id
          );

        }


        else if (
          action === "print"
        ) {

          printTicket(
            id
          );

        }


        else if (
          action === "completed"
        ) {

          await markCompleted(
            id
          );

        }


        else if (
          action === "cancel"
        ) {

          await cancelBooking(
            id
          );

        }

      }

      finally {

        button.disabled =
          false;
      }

    }
  );
}


// ============================================================
// LOGIN EVENTS
// ============================================================

if (loginBtn) {

  loginBtn.addEventListener(
    "click",
    loginAdmin
  );
}


if (adminPassword) {

  adminPassword.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key === "Enter"
      ) {

        loginAdmin();

      }
    }
  );
}


// ============================================================
// LOGOUT EVENT
// ============================================================

if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    logoutAdmin
  );
}


// ============================================================
// REFRESH
// ============================================================

if (refreshBtn) {

  refreshBtn.addEventListener(
    "click",
    loadBookings
  );
}


// ============================================================
// SEARCH
// ============================================================

if (searchInput) {

  searchInput.addEventListener(
    "input",
    renderBookings
  );
}


// ============================================================
// STATUS FILTER
// ============================================================

if (statusFilter) {

  statusFilter.addEventListener(
    "change",
    renderBookings
  );
}


// ============================================================
// DATE FILTER
// ============================================================

if (dateFilter) {

  dateFilter.addEventListener(
    "change",
    loadBookings
  );
}


// ============================================================
// INITIAL SESSION
// ============================================================

async function initializeAdmin() {

  try {

    const {
      data,
      error
    } =
      await adminDb.auth
        .getSession();


    if (error) {
      throw error;
    }


    const session =
      data?.session;


    if (!session) {

      showLogin();

      return;
    }


    // ========================================================
    // USER SUDAH LOGIN
    // ========================================================

    const allowed =
      await verifyAdmin();


    if (!allowed) {

      await adminDb.auth
        .signOut();


      sessionStorage.removeItem(
        "hsm_admin_pool"
      );


      selectedPool =
        "";


      showLogin();


      setLoginMessage(
        "Akun tidak memiliki akses admin HSM.",
        "error"
      );


      return;
    }


    // ========================================================
    // SESSION ADA TAPI POOL BELUM DIPILIH
    // ========================================================

    if (
      !selectedPool ||
      !isValidPool(
        selectedPool
      )
    ) {

      showLogin();


      setLoginMessage(
        "Pilih pool lalu masuk kembali.",
        "error"
      );


      return;
    }


    if (poolSelect) {

      poolSelect.value =
        selectedPool;
    }


    showDashboard();


    await loadBookings();

  }

  catch (error) {

    console.error(
      "INITIAL ADMIN ERROR:",
      error
    );


    showLogin();


    setLoginMessage(
      "Gagal memeriksa sesi admin.",
      "error"
    );
  }
}


// ============================================================
// START
// ============================================================

initializeAdmin();
