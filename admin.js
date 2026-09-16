// ============================================================
// HSM TRANSPORT - ADMIN.JS
// ============================================================
// - Login Supabase email + password
// - Verifikasi akun admin
// - Lihat semua booking
// - Statistik status
// - Cari nama / kode / WA
// - Filter tanggal & status
// - Tandai Lunas
// - Tandai Selesai
// - Batalkan booking
// - Data tidak dihapus
// ============================================================

const HSM_CONFIG = window.HSM_CONFIG;

if (!HSM_CONFIG) {
  throw new Error(
    "config.js tidak ditemukan."
  );
}

if (!window.supabase) {
  throw new Error(
    "Supabase tidak ditemukan."
  );
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
  document.getElementById(
    "loginSection"
  );

const dashboard =
  document.getElementById(
    "dashboard"
  );

const adminEmail =
  document.getElementById(
    "adminEmail"
  );

const adminPassword =
  document.getElementById(
    "adminPassword"
  );

const loginBtn =
  document.getElementById(
    "loginBtn"
  );

const loginMessage =
  document.getElementById(
    "loginMessage"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );

const bookingList =
  document.getElementById(
    "bookingList"
  );

const searchInput =
  document.getElementById(
    "searchInput"
  );

const dateFilter =
  document.getElementById(
    "dateFilter"
  );

const statusFilter =
  document.getElementById(
    "statusFilter"
  );

const refreshBtn =
  document.getElementById(
    "refreshBtn"
  );

const statPending =
  document.getElementById(
    "statPending"
  );

const statPaid =
  document.getElementById(
    "statPaid"
  );

const statCompleted =
  document.getElementById(
    "statCompleted"
  );

const statCancelled =
  document.getElementById(
    "statCancelled"
  );


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

  return String(
    value ?? ""
  )
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


function formatDate(value) {

  if (!value) {
    return "-";
  }


  const parts =
    String(value)
      .split("-");


  if (
    parts.length !== 3
  ) {

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
        dateStyle:
          "medium",

        timeStyle:
          "short"
      }
    );

  }


  catch {

    return String(value);

  }

}


// ============================================================
// NORMALIZE STATUS
// ============================================================

function normalizeStatus(value) {

  const status =
    String(
      value || ""
    )
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
    status === "dibatalkan"
  ) {

    return "cancelled";

  }


  if (
    status === "failed" ||
    status === "gagal"
  ) {

    return "cancelled";

  }


  // Termasuk pending / Belum Bayar
  return "pending";

}


// ============================================================
// STATUS LABEL
// ============================================================

function statusLabel(value) {

  const status =
    normalizeStatus(value);


  if (
    status === "pending"
  ) {

    return "Menunggu Pembayaran";

  }


  if (
    status === "paid"
  ) {

    return "Lunas";

  }


  if (
    status === "completed"
  ) {

    return "Selesai";

  }


  if (
    status === "cancelled"
  ) {

    return "Dibatalkan";

  }


  return status;

}


// ============================================================
// PHONE
// ============================================================

function whatsappNumber(phone) {

  let value =
    String(phone || "")
      .replace(/\D/g, "");


  if (
    value.startsWith("0")
  ) {

    value =
      "62" +
      value.substring(1);

  }


  else if (
    value.startsWith("8")
  ) {

    value =
      "62" + value;

  }


  return value;

}


// ============================================================
// LOGIN DISPLAY
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
// DASHBOARD DISPLAY
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
    await adminDb.auth
      .getUser();


  if (userError) {
    throw userError;
  }


  const user =
    userData?.user;


  if (!user) {

    return false;

  }


  // Cek tabel admin langsung.
  const {
    data,
    error
  } =
    await adminDb
      .from("hsm_admins")
      .select(
        "user_id,email"
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();


  if (error) {

    console.error(
      "ADMIN CHECK:",
      error
    );


    // Fallback RPC jika tersedia
    const rpcResult =
      await adminDb.rpc(
        "is_hsm_admin"
      );


    if (
      !rpcResult.error
    ) {

      return (
        rpcResult.data === true
      );

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


  if (
    !email ||
    !password
  ) {

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

    loginMessage.textContent =
      "";

  }


  try {

    const {
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


    const isAdmin =
      await verifyAdmin();


    if (!isAdmin) {

      await adminDb.auth
        .signOut();


      throw new Error(
        "Akun ini bukan administrator HSM."
      );

    }


    if (adminPassword) {

      adminPassword.value =
        "";

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

  await adminDb.auth
    .signOut();


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

    // Pastikan user masih login
    const {
      data: sessionData
    } =
      await adminDb.auth
        .getSession();


    if (
      !sessionData.session
    ) {

      showLogin();

      return;

    }


    const {
      data,
      error
    } =
      await adminDb
        .from("bookings")
        .select("*")
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


      if (
        status === "pending"
      ) {

        pending++;

      }


      else if (
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


  const selectedDate =
    dateFilter
      ? dateFilter.value
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
        status !==
          selectedStatus
      ) {

        return false;

      }


      if (
        selectedDate &&
        item.travel_date !==
          selectedDate
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


  bookingList.innerHTML =
    "";


  if (!rows.length) {

    bookingList.innerHTML = `
      <div class="empty">
        Belum ada data booking.
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
Tanggal: ${item.travel_date || "-"}
Jam: ${formatTime(item.departure_time)}
Kursi: ${item.seat_number || "-"}
Status: ${statusLabel(item.payment_status)}
      `.trim();


      const whatsappUrl =
        phone
          ? (
              "https://api.whatsapp.com/send?phone=" +
              encodeURIComponent(
                phone
              ) +
              "&text=" +
              encodeURIComponent(
                waMessage
              )
            )
          : "#";


      let actions =
        "";


      if (
        status === "pending"
      ) {

        actions += `
          <button
            class="btn-paid"
            data-action="paid"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            Tandai Lunas
          </button>
        `;


        actions += `
          <button
            class="btn-cancel"
            data-action="cancelled"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            Batalkan
          </button>
        `;

      }


      else if (
        status === "paid"
      ) {

        actions += `
          <button
            class="btn-completed"
            data-action="completed"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            Tandai Selesai
          </button>
        `;


        actions += `
          <button
            class="btn-cancel"
            data-action="cancelled"
            data-id="${escapeHtml(
              item.id
            )}"
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
                item.booking_code ||
                "-"
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
            class="
              status
              ${escapeHtml(status)}
            "
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

            <span>
              Nama
            </span>

            <strong>
              ${escapeHtml(
                item.passenger_name ||
                "-"
              )}
            </strong>

          </div>


          <div class="info">

            <span>
              WhatsApp
            </span>

            <strong>
              ${escapeHtml(
                item.phone ||
                "-"
              )}
            </strong>

          </div>


          <div class="info">

            <span>
              Dari
            </span>

            <strong>
              ${escapeHtml(
                item.origin ||
                "-"
              )}
            </strong>

          </div>


          <div class="info">

            <span>
              Tujuan
            </span>

            <strong>
              ${escapeHtml(
                item.destination ||
                "-"
              )}
            </strong>

          </div>


          <div class="info">

            <span>
              Tanggal
            </span>

            <strong>
              ${escapeHtml(
                formatDate(
                  item.travel_date
                )
              )}
            </strong>

          </div>


          <div class="info">

            <span>
              Jam
            </span>

            <strong>
              ${escapeHtml(
                formatTime(
                  item.departure_time
                )
              )}
            </strong>

          </div>


          <div class="info">

            <span>
              Kendaraan
            </span>

            <strong>
              ${escapeHtml(
                item.vehicle ||
                "-"
              )}
            </strong>

          </div>


          <div class="info">

            <span>
              Kursi
            </span>

            <strong>
              ${escapeHtml(
                String(
                  item.seat_number ||
                  "-"
                )
              )}
            </strong>

          </div>


          <div class="info">

            <span>
              Total
            </span>

            <strong>
              ${escapeHtml(
                rupiah(
                  item.total
                )
              )}
            </strong>

          </div>


          <div class="info">

            <span>
              Status
            </span>

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
// ACTION BUTTON
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


  let question =
    "";


  if (
    newStatus === "paid"
  ) {

    question =
      `Tandai booking ${booking.booking_code} sebagai LUNAS?`;

  }


  else if (
    newStatus === "completed"
  ) {

    question =
      `Tandai booking ${booking.booking_code} sebagai SELESAI? Data tetap tersimpan sebagai riwayat.`;

  }


  else if (
    newStatus === "cancelled"
  ) {

    question =
      `Batalkan booking ${booking.booking_code}? Data tidak dihapus dan kursi akan tersedia kembali.`;

  }


  if (
    !window.confirm(
      question
    )
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
    loadBookings
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
    renderBookings
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
