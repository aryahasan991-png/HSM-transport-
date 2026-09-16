// ============================================================
// HSM TRANSPORT - ADMIN.JS
// ============================================================

const HSM_CONFIG = window.HSM_CONFIG;

if (!HSM_CONFIG) {
  throw new Error("config.js tidak ditemukan.");
}

if (!window.supabase) {
  throw new Error("Supabase tidak ditemukan.");
}

const adminDb = window.supabase.createClient(
  HSM_CONFIG.SUPABASE_URL,
  HSM_CONFIG.SUPABASE_PUBLISHABLE_KEY
);


// ============================================================
// ELEMENTS
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

  return (
    `${parts[2]}/${parts[1]}/${parts[0]}`
  );
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  return String(value).substring(0, 5);
}

function formatCreatedAt(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  return date.toLocaleString(
    "id-ID",
    {
      dateStyle:"medium",
      timeStyle:"short"
    }
  );
}

function normalizeStatus(value) {
  const status = String(
    value || "pending"
  )
    .trim()
    .toLowerCase();

  if (
    status === "success" ||
    status === "settled"
  ) {
    return "paid";
  }

  if (status === "canceled") {
    return "cancelled";
  }

  return status;
}

function statusLabel(status) {
  switch (normalizeStatus(status)) {

    case "pending":
      return "Menunggu Pembayaran";

    case "paid":
      return "Lunas";

    case "completed":
      return "Selesai";

    case "cancelled":
      return "Dibatalkan";

    case "failed":
      return "Gagal";

    default:
      return status || "-";
  }
}

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
// SHOW LOGIN
// ============================================================

function showLogin() {
  loginSection.style.display = "flex";
  dashboard.style.display = "none";
  logoutBtn.style.display = "none";
}


// ============================================================
// SHOW DASHBOARD
// ============================================================

function showDashboard() {
  loginSection.style.display = "none";
  dashboard.style.display = "block";
  logoutBtn.style.display = "block";
}


// ============================================================
// VERIFY ADMIN
// ============================================================

async function verifyAdmin() {
  const { data, error } =
    await adminDb.rpc(
      "is_hsm_admin"
    );

  if (error) {
    throw error;
  }

  return data === true;
}


// ============================================================
// LOGIN
// ============================================================

async function login() {
  const email =
    adminEmail.value.trim();

  const password =
    adminPassword.value;

  if (!email || !password) {
    loginMessage.style.color =
      "#dc2626";

    loginMessage.textContent =
      "Masukkan email dan password.";

    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Memeriksa...";

  loginMessage.textContent = "";

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

    adminPassword.value = "";

    showDashboard();

    await loadBookings();
  }

  catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    loginMessage.style.color =
      "#dc2626";

    loginMessage.textContent =
      error.message;
  }

  finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Masuk";
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
  bookingList.innerHTML = `
    <div class="empty">
      Memuat data booking...
    </div>
  `;

  try {
    const { data, error } =
      await adminDb
        .from("bookings")
        .select(`
          id,
          booking_code,
          passenger_name,
          phone,
          origin,
          destination,
          travel_date,
          departure_time,
          vehicle,
          seat_number,
          total,
          payment_status,
          created_at,
          schedule_id,
          segment_start,
          segment_end
        `)
        .order(
          "travel_date",
          {
            ascending:false
          }
        )
        .order(
          "departure_time",
          {
            ascending:false
          }
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        );

    if (error) {
      throw error;
    }

    allBookings =
      data || [];

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
        Gagal memuat booking.
        <br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}


// ============================================================
// STATS
// ============================================================

function updateStats() {
  const counts = {
    pending:0,
    paid:0,
    completed:0,
    cancelled:0
  };

  allBookings.forEach(item => {
    const status =
      normalizeStatus(
        item.payment_status
      );

    if (status === "pending") {
      counts.pending++;
    }

    else if (status === "paid") {
      counts.paid++;
    }

    else if (status === "completed") {
      counts.completed++;
    }

    else if (
      status === "cancelled" ||
      status === "failed"
    ) {
      counts.cancelled++;
    }
  });

  statPending.textContent =
    counts.pending;

  statPaid.textContent =
    counts.paid;

  statCompleted.textContent =
    counts.completed;

  statCancelled.textContent =
    counts.cancelled;
}


// ============================================================
// FILTER
// ============================================================

function getFilteredBookings() {
  const search =
    String(
      searchInput.value || ""
    )
      .trim()
      .toLowerCase();

  const selectedDate =
    dateFilter.value;

  const selectedStatus =
    statusFilter.value;

  return allBookings.filter(item => {
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

    if (
      selectedDate &&
      item.travel_date !== selectedDate
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
        item.vehicle,
        item.seat_number
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  });
}


// ============================================================
// RENDER
// ============================================================

function renderBookings() {
  const rows =
    getFilteredBookings();

  bookingList.innerHTML = "";

  if (!rows.length) {
    bookingList.innerHTML = `
      <div class="empty">
        Tidak ada booking yang cocok.
      </div>
    `;

    return;
  }

  rows.forEach(item => {
    const status =
      normalizeStatus(
        item.payment_status
      );

    const card =
      document.createElement("article");

    card.className =
      "booking-card";

    const phone =
      whatsappNumber(
        item.phone
      );

    const whatsappUrl =
      phone
        ? `https://wa.me/${phone}`
        : "#";

    let actions = "";

    if (status === "pending") {
      actions += `
        <button
          class="btn-paid"
          data-action="paid"
          data-id="${escapeHtml(item.id)}"
        >
          Tandai Lunas
        </button>
      `;

      actions += `
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
          class="btn-completed"
          data-action="completed"
          data-id="${escapeHtml(item.id)}"
        >
          Tandai Selesai
        </button>
      `;

      actions += `
        <button
          class="btn-cancel"
          data-action="cancelled"
          data-id="${escapeHtml(item.id)}"
        >
          Batalkan
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

        <span class="status ${escapeHtml(status)}">
          ${escapeHtml(
            statusLabel(status)
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
            )}
          </strong>
        </div>

        <div class="info">
          <span>Kendaraan</span>
          <strong>
            ${escapeHtml(
              item.vehicle || "-"
            )}
          </strong>
        </div>

        <div class="info">
          <span>Kursi</span>
          <strong>
            ${String(
              item.seat_number || "-"
            ).padStart(2, "0")}
          </strong>
        </div>

        <div class="info">
          <span>Total</span>
          <strong>
            ${escapeHtml(
              rupiah(
                item.total
              )
            )}
          </strong>
        </div>

        <div class="info">
          <span>Status</span>
          <strong>
            ${escapeHtml(
              statusLabel(status)
            )}
          </strong>
        </div>

      </div>


      <div class="actions">
        ${actions}
      </div>
    `;

    bookingList.appendChild(card);
  });

  bindActionButtons();
}


// ============================================================
// ACTION BUTTONS
// ============================================================

function bindActionButtons() {
  bookingList
    .querySelectorAll(
      "button[data-action]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          const id =
            button.dataset.id;

          const action =
            button.dataset.action;

          await changeStatus(
            id,
            action
          );
        }
      );
    });
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
    return;
  }

  let question = "";

  if (newStatus === "paid") {
    question =
      `Tandai booking ${booking.booking_code} sebagai LUNAS?`;
  }

  else if (newStatus === "completed") {
    question =
      `Tandai booking ${booking.booking_code} sebagai SELESAI? Kursi akan kembali dianggap tersedia untuk sistem.`;
  }

  else if (newStatus === "cancelled") {
    question =
      `Batalkan booking ${booking.booking_code}? Data tetap tersimpan sebagai riwayat dan kursi akan tersedia kembali.`;
  }

  if (!window.confirm(question)) {
    return;
  }

  try {
    const { error } =
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

    await loadBookings();
  }

  catch (error) {
    console.error(
      "UPDATE STATUS ERROR:",
      error
    );

    alert(
      "Gagal mengubah status:\n" +
      error.message
    );
  }
}


// ============================================================
// EVENTS
// ============================================================

loginBtn.addEventListener(
  "click",
  login
);

adminPassword.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      login();
    }
  }
);

logoutBtn.addEventListener(
  "click",
  logout
);

refreshBtn.addEventListener(
  "click",
  loadBookings
);

searchInput.addEventListener(
  "input",
  renderBookings
);

dateFilter.addEventListener(
  "change",
  renderBookings
);

statusFilter.addEventListener(
  "change",
  renderBookings
);


// ============================================================
// INITIAL AUTH
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
      await adminDb.auth.signOut();

      showLogin();

      loginMessage.style.color =
        "#dc2626";

      loginMessage.textContent =
        "Akun ini bukan administrator HSM.";

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

    loginMessage.style.color =
      "#dc2626";

    loginMessage.textContent =
      error.message;
  }
}

initAdmin();
