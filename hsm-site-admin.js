// ============================================================
// HSM TRANSPORT
// PT HIDAYAH SARANA MULIA
//
// PENGATURAN WEBSITE PUBLIK
//
// - Membaca Booking ON/OFF
// - Menampilkan pengumuman admin
// - Menonaktifkan tombol booking jika OFF
// - Tidak mengubah layout booking yang sudah ada
//
// Pengaman sebenarnya tetap berada di database.
// ============================================================

(function () {
  "use strict";

  const siteDb = db;

  const REFRESH_INTERVAL = 60000;

  let bookingEnabled = false;
  let settingsLoaded = false;
  let checkingBooking = false;

  // ==========================================================
  // HELPERS
  // ==========================================================

  function el(id) {
    return document.getElementById(id);
  }

  function setBookingEnabled(enabled) {
    bookingEnabled = enabled === true;

    const bookButton = el("book");

    if (!bookButton) return;

    bookButton.disabled = !bookingEnabled;

    bookButton.textContent = bookingEnabled
      ? "Pesan Sekarang"
      : "Pemesanan Sementara Ditutup";
  }

  // ==========================================================
  // CSS
  // ==========================================================

  function installStyles() {
    const style = document.createElement("style");

    style.textContent = `

      .hsm-public-announcement {
        display: none;
        padding: 20px;
        margin-bottom: 22px;
        border: 1px solid #bfdbfe;
        border-radius: 15px;
        background: #eff6ff;
        color: #1e40af;
        box-shadow: 0 5px 18px rgba(15,23,42,.04);
      }

      .hsm-public-announcement.visible {
        display: block;
      }

      .hsm-public-announcement.info {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1e40af;
      }

      .hsm-public-announcement.warning {
        background: #fffbeb;
        border-color: #fcd34d;
        color: #92400e;
      }

      .hsm-public-announcement.important {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }

      .hsm-public-announcement.success {
        background: #f0fdf4;
        border-color: #bbf7d0;
        color: #166534;
      }

      .hsm-public-title {
        margin: 0 0 10px;
        font-size: 17px;
        font-weight: 900;
        line-height: 1.4;
      }

      .hsm-public-body {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 13px;
        line-height: 1.8;
      }

      .hsm-public-closed {
        display: none;
        margin-bottom: 20px;
        padding: 16px;
        border: 1px solid #fecaca;
        border-radius: 12px;
        background: #fef2f2;
        color: #991b1b;
        font-size: 13px;
        line-height: 1.8;
      }

      .hsm-public-closed.visible {
        display: block;
      }

      #book:disabled {
        cursor: not-allowed;
      }
    `;

    document.head.appendChild(style);
  }

  // ==========================================================
  // BUAT KOTAK PENGUMUMAN
  // ==========================================================

  function createAnnouncement() {
    const bookingSection = el("booking");

    if (!bookingSection) return;

    const main = bookingSection.parentElement;

    const announcement = document.createElement("section");

    announcement.id = "hsmPublicAnnouncement";

    announcement.className = "hsm-public-announcement";

    announcement.setAttribute("role", "status");

    const title = document.createElement("h2");
    title.id = "hsmPublicAnnouncementTitle";
    title.className = "hsm-public-title";

    const body = document.createElement("div");
    body.id = "hsmPublicAnnouncementBody";
    body.className = "hsm-public-body";

    announcement.append(title, body);

    main.insertBefore(announcement, bookingSection);
  }

  // ==========================================================
  // KOTAK BOOKING DITUTUP
  // ==========================================================

  function createClosedNotice() {
    const bookingButton = el("book");

    if (!bookingButton) return;

    const notice = document.createElement("div");

    notice.id = "hsmPublicClosed";

    notice.className = "hsm-public-closed";

    notice.textContent =
      "📢 Pemesanan tiket HSM Transport sementara ditutup. " +
      "Anda tetap dapat melihat informasi jadwal dan tarif. " +
      "Silakan menunggu pemberitahuan pembukaan kembali.";

    bookingButton.parentNode.insertBefore(
      notice,
      bookingButton
    );
  }

  // ==========================================================
  // RENDER PENGUMUMAN
  // ==========================================================

  function renderAnnouncement(settings) {
    const announcement = el("hsmPublicAnnouncement");

    if (!announcement) return;

    const enabled =
      settings.announcement_enabled === true;

    announcement.className =
      "hsm-public-announcement";

    if (!enabled) return;

    const allowedTypes = [
      "info",
      "warning",
      "important",
      "success"
    ];

    const type = allowedTypes.includes(
      settings.announcement_type
    )
      ? settings.announcement_type
      : "info";

    announcement.classList.add("visible", type);

    el("hsmPublicAnnouncementTitle").textContent =
      settings.announcement_title ||
      "Informasi HSM Transport";

    el("hsmPublicAnnouncementBody").textContent =
      settings.announcement_body || "";
  }

  // ==========================================================
  // RENDER BOOKING
  // ==========================================================

  function renderBooking(settings) {
    setBookingEnabled(
      settings.booking_enabled === true
    );

    const notice = el("hsmPublicClosed");

    if (!notice) return;

    notice.classList.toggle(
      "visible",
      !bookingEnabled
    );
  }

  // ==========================================================
  // LOAD PENGATURAN
  // ==========================================================

  async function loadSettings() {
    try {
      const { data, error } = await siteDb.rpc(
        "hsm_get_public_settings"
      );

      if (error) throw error;

      if (data?.success !== true) {
        throw new Error("Pengaturan tidak tersedia.");
      }

      settingsLoaded = true;

      renderAnnouncement(data);
      renderBooking(data);

    } catch (error) {
      console.error("HSM PUBLIC SETTINGS:", error);

      settingsLoaded = false;

      // Jika gagal membaca pengaturan,
      // jangan izinkan booking sampai berhasil.
      setBookingEnabled(false);

      const notice = el("hsmPublicClosed");

      if (notice) {
        notice.classList.add("visible");

        notice.textContent =
          "Pengaturan pemesanan sedang tidak dapat diperiksa. " +
          "Silakan coba kembali beberapa saat lagi.";
      }
    }
  }

  // ==========================================================
  // PENGAMAN KLIK TOMBOL BOOKING
  //
  // Listener capture berjalan sebelum listener app.js.
  // ==========================================================

  function installBookingGuard() {
    const bookButton = el("book");

    if (!bookButton) return;

    bookButton.addEventListener(
      "click",
      async event => {
        if (
          !settingsLoaded ||
          !bookingEnabled ||
          checkingBooking
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();

          if (!settingsLoaded) {
            alert(
              "Sedang memeriksa status pemesanan. " +
              "Silakan coba sebentar lagi."
            );
          }

          return;
        }

        // Status ON tetap diperiksa oleh trigger database
        // pada saat INSERT sebenarnya dilakukan.

      },
      true
    );
  }

  // ==========================================================
  // INITIALIZE
  // ==========================================================

  function initialize() {
    installStyles();

    createAnnouncement();

    createClosedNotice();

    setBookingEnabled(false);

    installBookingGuard();

    loadSettings();

    setInterval(() => {
      if (!document.hidden) {
        loadSettings();
      }
    }, REFRESH_INTERVAL);

    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          loadSettings();
        }
      }
    );

    console.log("HSM PUBLIC SETTINGS: Siap.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

})();
