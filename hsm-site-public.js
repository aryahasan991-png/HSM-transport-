// ============================================================
// HSM TRANSPORT
// PT HIDAYAH SARANA MULIA
//
// FILE: hsm-site-public.js
//
// PENGATURAN WEBSITE PENUMPANG
//
// FITUR:
// - Booking Online ON/OFF
// - Pengumuman dari Dashboard Admin
// - 4 jenis pengumuman
// - Pemberitahuan ketika booking ditutup
// - Pembaruan otomatis setiap 30 detik
// - Pengamanan tombol pemesanan
//
// KOMPATIBEL DENGAN:
// - index.html
// - config.js
// - app.js
// - Supabase hsm_get_public_settings()
//
// Tidak mengubah sistem booking yang sudah ada.
// ============================================================

(function () {
  "use strict";

  // ==========================================================
  // KONFIGURASI
  // ==========================================================

  const REFRESH_INTERVAL = 30000;

  const RPC_NAME = "hsm_get_public_settings";

  const ALLOWED_TYPES = [
    "info",
    "warning",
    "important",
    "success"
  ];

  let siteDb = null;

  let bookingEnabled = false;
  let settingsLoaded = false;

  let refreshInProgress = false;

  let initialized = false;

  // ==========================================================
  // HELPER
  // ==========================================================

  function el(id) {
    return document.getElementById(id);
  }

  function getBookingButton() {
    return el("book");
  }

  function getBookingSection() {
    return el("booking");
  }

  // ==========================================================
  // KONEKSI SUPABASE
  // ==========================================================

  function initializeDatabase() {
    if (typeof db !== "undefined" && db) {
      siteDb = db;
      return true;
    }

    console.error(
      "HSM PUBLIC: Supabase belum tersedia. " +
      "Pastikan config.js dan app.js dimuat lebih dahulu."
    );

    return false;
  }

  // ==========================================================
  // CSS
  // ==========================================================

  function installStyles() {
    if (el("hsmPublicSettingsStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "hsmPublicSettingsStyles";

    style.textContent = `

      /* ======================================================
         PENGUMUMAN PUBLIK
         ====================================================== */

      .hsm-public-announcement {
        display: none;

        padding: 20px;
        margin-bottom: 22px;

        border: 1px solid #bfdbfe;
        border-left-width: 5px;
        border-radius: 15px;

        background: #eff6ff;
        color: #1e40af;

        box-shadow:
          0 5px 18px rgba(15,23,42,.05);

        animation:
          hsmPublicAppear .3s ease;
      }

      .hsm-public-announcement.visible {
        display: block;
      }

      /* INFORMASI */

      .hsm-public-announcement.info {
        background: #eff6ff;
        border-color: #93c5fd;
        color: #1e40af;
      }

      /* PERHATIAN */

      .hsm-public-announcement.warning {
        background: #fffbeb;
        border-color: #fbbf24;
        color: #92400e;
      }

      /* PENTING */

      .hsm-public-announcement.important {
        background: #fef2f2;
        border-color: #f87171;
        color: #991b1b;
      }

      /* KABAR BAIK */

      .hsm-public-announcement.success {
        background: #f0fdf4;
        border-color: #4ade80;
        color: #166534;
      }

      /* HEADER PENGUMUMAN */

      .hsm-public-announcement-header {
        display: flex;
        align-items: flex-start;

        gap: 11px;
        margin-bottom: 12px;
      }

      .hsm-public-announcement-icon {
        flex-shrink: 0;

        font-size: 25px;
        line-height: 1.1;
      }

      .hsm-public-title {
        margin: 0;

        font-size: 18px;
        font-weight: 900;
        line-height: 1.45;

        overflow-wrap: anywhere;
      }

      .hsm-public-body {
        font-size: 13px;
        line-height: 1.9;

        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      /* ======================================================
         BOOKING OFF
         ====================================================== */

      .hsm-public-closed {
        display: none;

        margin-bottom: 18px;
        padding: 16px;

        border: 1px solid #fecaca;
        border-left: 5px solid #ef4444;
        border-radius: 12px;

        background: #fef2f2;
        color: #991b1b;

        font-size: 13px;
        line-height: 1.8;
      }

      .hsm-public-closed.visible {
        display: block;
      }

      .hsm-public-closed strong {
        font-size: 14px;
      }

      /* ======================================================
         LOADING
         ====================================================== */

      .hsm-public-loading {
        color: #64748b;

        font-size: 12px;
        text-align: center;
      }

      /* ======================================================
         TOMBOL BOOKING
         ====================================================== */

      #book:disabled {
        opacity: .60;
        cursor: not-allowed;
      }

      /* ======================================================
         ANIMASI
         ====================================================== */

      @keyframes hsmPublicAppear {

        from {
          opacity: 0;
          transform: translateY(-5px);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }

      }

      /* ======================================================
         MOBILE
         ====================================================== */

      @media (max-width: 760px) {

        .hsm-public-announcement {
          padding: 16px;
          margin-bottom: 17px;
          border-radius: 13px;
        }

        .hsm-public-announcement-icon {
          font-size: 23px;
        }

        .hsm-public-title {
          font-size: 16px;
        }

        .hsm-public-body {
          font-size: 12px;
          line-height: 1.8;
        }

        .hsm-public-closed {
          padding: 14px;
          font-size: 12px;
        }

      }

    `;

    document.head.appendChild(style);
  }

  // ==========================================================
  // MEMBUAT KOTAK PENGUMUMAN
  // ==========================================================

  function createAnnouncement() {
    if (el("hsmPublicAnnouncement")) {
      return;
    }

    const bookingSection = getBookingSection();

    if (!bookingSection || !bookingSection.parentNode) {
      console.error(
        "HSM PUBLIC: Section booking tidak ditemukan."
      );

      return;
    }

    const announcement = document.createElement("section");

    announcement.id = "hsmPublicAnnouncement";

    announcement.className = "hsm-public-announcement";

    announcement.setAttribute("role", "status");

    announcement.innerHTML = `

      <div class="hsm-public-announcement-header">

        <span
          id="hsmPublicAnnouncementIcon"
          class="hsm-public-announcement-icon"
          aria-hidden="true"
        >
          📢
        </span>

        <h2
          id="hsmPublicAnnouncementTitle"
          class="hsm-public-title"
        >
          Informasi HSM Transport
        </h2>

      </div>

      <div
        id="hsmPublicAnnouncementBody"
        class="hsm-public-body"
      ></div>

    `;

    bookingSection.parentNode.insertBefore(
      announcement,
      bookingSection
    );
  }

  // ==========================================================
  // MEMBUAT PEMBERITAHUAN BOOKING OFF
  // ==========================================================

  function createClosedNotice() {
    if (el("hsmPublicClosed")) {
      return;
    }

    const bookingButton = getBookingButton();

    if (!bookingButton || !bookingButton.parentNode) {
      console.error(
        "HSM PUBLIC: Tombol booking tidak ditemukan."
      );

      return;
    }

    const notice = document.createElement("div");

    notice.id = "hsmPublicClosed";

    notice.className = "hsm-public-closed";

    notice.setAttribute("role", "status");

    notice.innerHTML = `

      <strong>
        📢 PEMESANAN TIKET SEMENTARA DITUTUP
      </strong>

      <br><br>

      Saat ini HSM Transport sementara belum
      menerima pemesanan tiket online.

      <br><br>

      Website tetap dapat digunakan untuk
      melihat informasi rute, jadwal, dan tarif.

      <br><br>

      Informasi pembukaan kembali layanan
      akan kami sampaikan melalui kanal
      resmi HSM Transport.

    `;

    bookingButton.parentNode.insertBefore(
      notice,
      bookingButton
    );
  }

  // ==========================================================
  // MENGATUR TOMBOL BOOKING
  // ==========================================================

  function setBookingState(enabled) {
    bookingEnabled = enabled === true;

    const button = getBookingButton();

    if (!button) {
      return;
    }

    // Jangan mengganggu tombol saat proses
    // penyimpanan booking di app.js berjalan.

    if (
      typeof isProcessingBooking !== "undefined" &&
      isProcessingBooking
    ) {
      return;
    }

    button.disabled = !bookingEnabled;

    button.textContent = bookingEnabled
      ? "Pesan Sekarang"
      : "Pemesanan Sementara Ditutup";

    const notice = el("hsmPublicClosed");

    if (notice) {
      notice.classList.toggle(
        "visible",
        !bookingEnabled
      );
    }
  }

  // ==========================================================
  // PENGUMUMAN
  // ==========================================================

  function renderAnnouncement(settings) {
    const announcement = el("hsmPublicAnnouncement");

    if (!announcement) {
      return;
    }

    const enabled =
      settings.announcement_enabled === true;

    if (!enabled) {
      announcement.className =
        "hsm-public-announcement";

      return;
    }

    const type =
      ALLOWED_TYPES.includes(settings.announcement_type)
        ? settings.announcement_type
        : "info";

    const icons = {
      info: "📢",
      warning: "⚠️",
      important: "🚨",
      success: "✅"
    };

    announcement.className =
      "hsm-public-announcement visible " + type;

    el("hsmPublicAnnouncementIcon").textContent =
      icons[type];

    el("hsmPublicAnnouncementTitle").textContent =
      settings.announcement_title ||
      "Informasi HSM Transport";

    el("hsmPublicAnnouncementBody").textContent =
      settings.announcement_body || "";
  }

  // ==========================================================
  // BOOKING ONLINE
  // ==========================================================

  function renderBooking(settings) {
    setBookingState(
      settings.booking_enabled === true
    );
  }

  // ==========================================================
  // MENAMPILKAN PESAN JIKA KONEKSI GAGAL
  // ==========================================================

  function renderSettingsError() {
    const notice = el("hsmPublicClosed");

    if (!notice) {
      return;
    }

    notice.classList.add("visible");

    notice.textContent =
      "Pengaturan pemesanan sedang tidak dapat diperiksa. " +
      "Silakan refresh halaman atau coba kembali beberapa saat lagi.";
  }

  // ==========================================================
  // MENGAMBIL PENGATURAN DARI SUPABASE
  // ==========================================================

  async function loadSettings() {
    if (!siteDb || refreshInProgress) {
      return;
    }

    refreshInProgress = true;

    try {
      const { data, error } = await siteDb.rpc(
        RPC_NAME
      );

      if (error) {
        throw error;
      }

      if (!data || data.success !== true) {
        throw new Error(
          "Pengaturan website belum tersedia."
        );
      }

      settingsLoaded = true;

      renderAnnouncement(data);
      renderBooking(data);

      console.log(
        "HSM PUBLIC SETTINGS:",
        "Booking " +
        (bookingEnabled ? "ON" : "OFF"),
        "Pengumuman " +
        (data.announcement_enabled ? "ON" : "OFF")
      );

    } catch (error) {
      console.error(
        "HSM PUBLIC SETTINGS ERROR:",
        error
      );

      settingsLoaded = false;

      setBookingState(false);
      renderSettingsError();

    } finally {
      refreshInProgress = false;
    }
  }

  // ==========================================================
  // PENGAMAN KLIK TOMBOL BOOKING
  // ==========================================================

  function installBookingGuard() {
    const button = getBookingButton();

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      function (event) {
        if (
          !settingsLoaded ||
          !bookingEnabled
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();

          alert(
            "Pemesanan tiket HSM Transport sementara tidak tersedia."
          );
        }
      },
      true
    );
  }

  // ==========================================================
  // MEMULAI FITUR
  // ==========================================================

  function initialize() {
    if (initialized) {
      return;
    }

    initialized = true;

    installStyles();

    createAnnouncement();
    createClosedNotice();

    // Keamanan awal:
    // Tombol booking nonaktif sampai
    // pengaturan Supabase berhasil dibaca.

    setBookingState(false);

    if (!initializeDatabase()) {
      renderSettingsError();
      return;
    }

    installBookingGuard();

    loadSettings();

    // Perbarui otomatis setiap 30 detik.

    setInterval(() => {
      if (!document.hidden) {
        loadSettings();
      }
    }, REFRESH_INTERVAL);

    // Perbarui saat pengunjung kembali ke tab.

    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          loadSettings();
        }
      }
    );

    console.log(
      "HSM PUBLIC: Pengaturan website siap."
    );
  }

  // ==========================================================
  // TUNGGU HALAMAN SIAP
  // ==========================================================

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
