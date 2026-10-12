// ============================================================
// HSM TRANSPORT
// PT HIDAYAH SARANA MULIA
//
// HSM-SITE-ADMIN.JS
// PENGATURAN WEBSITE KHUSUS ADMIN
//
// FITUR:
// - Booking Online ON / OFF
// - Pengumuman Website
// - Judul dan isi pengumuman
// - Jenis pengumuman
// - Tampilkan / sembunyikan pengumuman
// - Pratinjau
// - Simpan pengaturan ke Supabase
//
// KOMPATIBEL DENGAN:
// - admin.js
// - hsm-admin-extra.js
// - hsm-manifest.js
// - hsm-staff-admin.js
// - hsm-trip-monitor.js
// - hsm-trip-corrections.js
//
// Tidak mengubah sistem booking atau dashboard lama.
// ============================================================

(function () {
  "use strict";

  // ==========================================================
  // KONFIGURASI
  // ==========================================================

  const siteAdminDb = adminDb;

  let initialized = false;
  let saving = false;
  let loading = false;

  let savedSettings = null;

  const PANEL_ID = "hsmSiteAdminSection";
  const MENU_NAME = "site";

  const ALLOWED_TYPES = [
    "info",
    "warning",
    "important",
    "success"
  ];

  // ==========================================================
  // ELEMENT HELPER
  // ==========================================================

  function el(id) {
    return document.getElementById(id);
  }

  function getNavigation() {
    return document.querySelector(".hsm-extra-nav");
  }

  function getPanel() {
    return el(PANEL_ID);
  }

  function getMenuButton() {
    return document.querySelector(
      '[data-hsm-menu="site"]'
    );
  }

  // ==========================================================
  // LOGIN ADMIN
  // ==========================================================

  async function checkAdmin() {
    const { data, error } =
      await siteAdminDb.auth.getUser();

    if (error || !data?.user) {
      throw new Error(
        "Sesi admin tidak ditemukan. Silakan login ulang."
      );
    }

    const allowed = await verifyAdmin();

    if (!allowed) {
      throw new Error(
        "Akses hanya untuk admin HSM Transport."
      );
    }

    return true;
  }

  // ==========================================================
  // PESAN
  // ==========================================================

  function showMessage(message, isError = false) {
    const output = el("hsmSiteAdminMessage");

    if (!output) {
      return;
    }

    output.textContent = message || "";

    output.style.color = isError
      ? "#dc2626"
      : "#15803d";
  }

  // ==========================================================
  // CSS
  // ==========================================================

  function installStyles() {
    if (el("hsmSiteAdminStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "hsmSiteAdminStyles";

    style.textContent = `

      /* ======================================================
         NAVIGASI ADMIN
         ====================================================== */

      .hsm-extra-nav {
        grid-template-columns:
          repeat(5, minmax(0, 1fr));
      }

      .hsm-extra-nav button {
        min-width: 0;
        line-height: 1.4;
      }

      /* ======================================================
         PANEL
         ====================================================== */

      #hsmSiteAdminSection {
        display: none;
        margin-bottom: 22px;
      }

      #hsmSiteAdminSection.active {
        display: block;
      }

      .hsm-site-card {
        padding: 20px;
        margin-bottom: 16px;

        border: 1px solid #e2e8f0;
        border-radius: 15px;

        background: #ffffff;

        box-shadow:
          0 5px 18px rgba(15, 23, 42, .05);
      }

      .hsm-site-heading {
        margin: 0 0 8px;

        color: #0754a6;

        font-size: 19px;
        font-weight: 900;
      }

      .hsm-site-description {
        margin: 0 0 17px;

        color: #64748b;

        font-size: 12px;
        line-height: 1.7;
      }

      /* ======================================================
         STATUS BOOKING
         ====================================================== */

      .hsm-site-status {
        padding: 15px;
        margin-bottom: 15px;

        border-radius: 12px;

        text-align: center;
        font-size: 14px;
        font-weight: 900;
      }

      .hsm-site-status.on {
        background: #dcfce7;
        color: #166534;
      }

      .hsm-site-status.off {
        background: #fee2e2;
        color: #991b1b;
      }

      .hsm-site-status.loading {
        background: #f1f5f9;
        color: #475569;
      }

      /* ======================================================
         SWITCH
         ====================================================== */

      .hsm-site-switch-row {
        display: flex;
        align-items: center;

        justify-content: space-between;

        gap: 15px;
        padding: 13px 0;
      }

      .hsm-site-switch-row strong {
        display: block;

        font-size: 13px;
        color: #1e293b;
      }

      .hsm-site-switch-row small {
        display: block;

        margin-top: 5px;

        color: #64748b;

        font-size: 11px;
        line-height: 1.6;
      }

      .hsm-site-toggle {
        width: 24px;
        height: 24px;

        flex-shrink: 0;

        accent-color: #0754a6;
        cursor: pointer;
      }

      /* ======================================================
         INPUT
         ====================================================== */

      .hsm-site-field {
        margin-bottom: 16px;
      }

      .hsm-site-field label {
        display: block;

        margin-bottom: 8px;

        color: #334155;

        font-size: 12px;
        font-weight: 900;
      }

      .hsm-site-input,
      .hsm-site-textarea,
      .hsm-site-select {
        width: 100%;

        box-sizing: border-box;

        padding: 12px;

        border: 1px solid #cbd5e1;
        border-radius: 10px;

        outline: none;

        background: #ffffff;
        color: #0f172a;

        font-family: inherit;
        font-size: 13px;
      }

      .hsm-site-input:focus,
      .hsm-site-textarea:focus,
      .hsm-site-select:focus {
        border-color: #0754a6;

        box-shadow:
          0 0 0 3px rgba(7, 84, 166, .10);
      }

      .hsm-site-textarea {
        min-height: 155px;

        resize: vertical;

        line-height: 1.7;
      }

      /* ======================================================
         TOMBOL
         ====================================================== */

      .hsm-site-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .hsm-site-button {
        min-height: 45px;

        padding: 11px 17px;

        border: none;
        border-radius: 10px;

        background: #0754a6;
        color: #ffffff;

        font-size: 12px;
        font-weight: 900;

        cursor: pointer;
      }

      .hsm-site-button.secondary {
        background: #e2e8f0;
        color: #334155;
      }

      .hsm-site-button:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      /* ======================================================
         PESAN
         ====================================================== */

      .hsm-site-message {
        margin-top: 15px;

        font-size: 12px;
        line-height: 1.7;

        overflow-wrap: anywhere;
      }

      /* ======================================================
         PREVIEW
         ====================================================== */

      .hsm-site-preview {
        display: none;

        margin-top: 18px;
        padding: 18px;

        border: 1px solid #bfdbfe;
        border-radius: 12px;

        background: #eff6ff;
      }

      .hsm-site-preview.visible {
        display: block;
      }

      .hsm-site-preview.info {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1e40af;
      }

      .hsm-site-preview.warning {
        background: #fffbeb;
        border-color: #fcd34d;
        color: #92400e;
      }

      .hsm-site-preview.important {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }

      .hsm-site-preview.success {
        background: #f0fdf4;
        border-color: #bbf7d0;
        color: #166534;
      }

      .hsm-site-preview-title {
        margin-bottom: 9px;

        font-size: 15px;
        font-weight: 900;

        line-height: 1.5;
      }

      .hsm-site-preview-body {
        white-space: pre-wrap;
        overflow-wrap: anywhere;

        font-size: 12px;
        line-height: 1.8;
      }

      /* ======================================================
         INFO
         ====================================================== */

      .hsm-site-info {
        padding: 13px 15px;
        margin-top: 14px;

        border: 1px solid #bfdbfe;
        border-radius: 11px;

        background: #eff6ff;
        color: #1e40af;

        font-size: 12px;
        line-height: 1.7;
      }

      /* ======================================================
         RESPONSIVE
         ====================================================== */

      @media (max-width: 760px) {

        .hsm-extra-nav {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));

          gap: 7px;
        }

        .hsm-extra-nav button {
          min-height: 43px;

          padding: 8px 6px;

          font-size: 11px;
        }

        .hsm-site-card {
          padding: 16px;
        }

        .hsm-site-actions {
          display: grid;

          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .hsm-site-button {
          padding: 10px 8px;

          font-size: 11px;
        }
      }

      @media (min-width: 761px) {

        .hsm-extra-nav {
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
        }
      }

    `;

    document.head.appendChild(style);
  }

  // ==========================================================
  // BUAT MENU KELIMA
  // ==========================================================

  function createMenu() {
    const navigation = getNavigation();

    if (!navigation) {
      console.error(
        "HSM SITE ADMIN: Navigasi admin tidak ditemukan."
      );

      return false;
    }

    if (!getMenuButton()) {
      const button = document.createElement("button");

      button.type = "button";
      button.dataset.hsmMenu = MENU_NAME;

      button.textContent =
        "⚙️ Pengaturan Website";

      navigation.appendChild(button);
    }

    // ========================================================
    // PENANGANAN NAVIGASI
    //
    // Dibuat pada capture phase.
    // Untuk menu "site", event dihentikan sebelum diproses
    // switchMenu() lama yang hanya mengenal 3 menu.
    //
    // Saat pindah ke menu lain, panel ini disembunyikan.
    // ========================================================

    navigation.addEventListener(
      "click",
      async function (event) {
        const button = event.target.closest(
          "[data-hsm-menu]"
        );

        if (!button) {
          return;
        }

        const menu = button.dataset.hsmMenu;

        if (menu === MENU_NAME) {
          event.stopPropagation();

          showSettings();

          await loadSettings();

          return;
        }

        hideSettings();
      },
      true
    );

    return true;
  }

  // ==========================================================
  // BUAT PANEL PENGATURAN
  // ==========================================================

  function createPanel() {
    if (getPanel()) {
      return;
    }

    const navigation = getNavigation();

    if (!navigation) {
      return;
    }

    const panel = document.createElement("section");

    panel.id = PANEL_ID;

    panel.className = "hsm-site-admin-panel";

    panel.innerHTML = `

      <!-- ====================================================
           STATUS BOOKING
           ==================================================== -->

      <div class="hsm-site-card">

        <h2 class="hsm-site-heading">
          ⚙️ Pengaturan Website HSM
        </h2>

        <p class="hsm-site-description">
          Kelola pemesanan tiket online dan pemberitahuan
          yang ditampilkan pada website penumpang.
        </p>

        <div
          id="hsmSiteBookingStatus"
          class="hsm-site-status loading"
        >
          Memuat status booking...
        </div>

        <div class="hsm-site-switch-row">

          <div>

            <strong>
              Booking Online
            </strong>

            <small>
              Jika dinonaktifkan, penumpang tidak dapat
              membuat booking baru. Booking lama tetap
              tersimpan dan dapat dikelola admin.
            </small>

          </div>

          <input
            type="checkbox"
            id="hsmSiteBookingEnabled"
            class="hsm-site-toggle"
            aria-label="Aktifkan Booking Online"
          >

        </div>

        <div class="hsm-site-info">
          Perubahan status Booking ON/OFF berlaku
          setelah tombol Simpan Pengaturan ditekan.
        </div>

      </div>


      <!-- ====================================================
           PENGUMUMAN
           ==================================================== -->

      <div class="hsm-site-card">

        <h2 class="hsm-site-heading">
          📢 Pengumuman Website
        </h2>

        <p class="hsm-site-description">
          Pengumuman akan ditampilkan di atas formulir
          pemesanan tiket pada website penumpang.
        </p>

        <div class="hsm-site-switch-row">

          <div>

            <strong>
              Tampilkan Pengumuman
            </strong>

            <small>
              Aktifkan untuk menampilkan informasi
              kepada pelanggan HSM Transport.
            </small>

          </div>

          <input
            type="checkbox"
            id="hsmSiteAnnouncementEnabled"
            class="hsm-site-toggle"
            aria-label="Tampilkan Pengumuman"
          >

        </div>


        <div class="hsm-site-field">

          <label for="hsmSiteAnnouncementTitle">
            Judul Pengumuman
          </label>

          <input
            type="text"
            id="hsmSiteAnnouncementTitle"
            class="hsm-site-input"
            maxlength="150"
            placeholder="Contoh: Pemberitahuan Operasional"
          >

        </div>


        <div class="hsm-site-field">

          <label for="hsmSiteAnnouncementBody">
            Isi Pengumuman
          </label>

          <textarea
            id="hsmSiteAnnouncementBody"
            class="hsm-site-textarea"
            maxlength="3000"
            placeholder="Tulis isi pengumuman untuk pelanggan..."
          ></textarea>

        </div>


        <div class="hsm-site-field">

          <label for="hsmSiteAnnouncementType">
            Jenis Pengumuman
          </label>

          <select
            id="hsmSiteAnnouncementType"
            class="hsm-site-select"
          >

            <option value="info">
              🔵 Informasi
            </option>

            <option value="warning">
              🟡 Perhatian
            </option>

            <option value="important">
              🔴 Penting
            </option>

            <option value="success">
              🟢 Kabar Baik
            </option>

          </select>

        </div>


        <div class="hsm-site-actions">

          <button
            type="button"
            id="hsmSitePreviewButton"
            class="hsm-site-button secondary"
          >
            👁️ Pratinjau
          </button>

          <button
            type="button"
            id="hsmSiteSaveButton"
            class="hsm-site-button"
          >
            💾 Simpan Pengaturan
          </button>

        </div>


        <div
          id="hsmSiteAdminMessage"
          class="hsm-site-message"
          role="status"
        ></div>


        <div
          id="hsmSitePreview"
          class="hsm-site-preview"
        >

          <div
            id="hsmSitePreviewTitle"
            class="hsm-site-preview-title"
          ></div>

          <div
            id="hsmSitePreviewBody"
            class="hsm-site-preview-body"
          ></div>

        </div>

      </div>

    `;

    navigation.insertAdjacentElement(
      "afterend",
      panel
    );

    // ========================================================
    // EVENT
    // ========================================================

    el("hsmSiteBookingEnabled")
      .addEventListener(
        "change",
        updateBookingStatus
      );

    el("hsmSitePreviewButton")
      .addEventListener(
        "click",
        renderPreview
      );

    el("hsmSiteSaveButton")
      .addEventListener(
        "click",
        saveSettings
      );
  }

  // ==========================================================
  // STATUS BOOKING
  // ==========================================================

  function updateBookingStatus() {
    const checkbox = el("hsmSiteBookingEnabled");

    const badge = el("hsmSiteBookingStatus");

    if (!checkbox || !badge) {
      return;
    }

    const enabled = checkbox.checked;

    badge.className =
      "hsm-site-status " +
      (enabled ? "on" : "off");

    badge.textContent = enabled
      ? "🟢 BOOKING ONLINE AKTIF"
      : "🔴 BOOKING ONLINE DITUTUP";
  }

  // ==========================================================
  // SEMBUNYIKAN PANEL LAIN
  // ==========================================================

  function hideOtherPanels() {
    const stats = document.querySelector(".stats");

    const filters = document.querySelector(".filters");

    const bookingList = el("bookingList");

    if (stats) {
      stats.style.display = "none";
    }

    if (filters) {
      filters.style.display = "none";
    }

    if (bookingList) {
      bookingList.style.display = "none";
    }

    // Manifest
    el("hsmManifestSection")
      ?.classList.remove("active");

    // Sopir & Kernet
    el("hsmCrewSection")
      ?.classList.remove("active");

    // Monitoring
    el("hsmTripMonitorSection")
      ?.classList.remove("active");

    // Jika ada panel tambahan lain yang aktif,
    // tidak perlu mengubah struktur aslinya.
  }

  // ==========================================================
  // TAMPILKAN PENGATURAN
  // ==========================================================

  function showSettings() {
    const panel = getPanel();

    const navigation = getNavigation();

    if (!panel || !navigation) {
      return;
    }

    hideOtherPanels();

    navigation.querySelectorAll(
      "[data-hsm-menu]"
    ).forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.hsmMenu === MENU_NAME
      );
    });

    panel.classList.add("active");
  }

  // ==========================================================
  // SEMBUNYIKAN PENGATURAN
  // ==========================================================

  function hideSettings() {
    const panel = getPanel();

    if (panel) {
      panel.classList.remove("active");
    }
  }

  // ==========================================================
  // AMBIL PENGATURAN DARI DATABASE
  // ==========================================================

  async function loadSettings() {
    if (loading || saving) {
      return;
    }

    loading = true;

    showMessage(
      "Memuat pengaturan website..."
    );

    try {
      await checkAdmin();

      const { data, error } =
        await siteAdminDb.rpc(
          "hsm_get_public_settings"
        );

      if (error) {
        throw error;
      }

      if (!data || data.success !== true) {
        throw new Error(
          "Data pengaturan website tidak ditemukan."
        );
      }

      savedSettings = data;

      el("hsmSiteBookingEnabled").checked =
        data.booking_enabled === true;

      el("hsmSiteAnnouncementEnabled").checked =
        data.announcement_enabled === true;

      el("hsmSiteAnnouncementTitle").value =
        data.announcement_title || "";

      el("hsmSiteAnnouncementBody").value =
        data.announcement_body || "";

      el("hsmSiteAnnouncementType").value =
        ALLOWED_TYPES.includes(data.announcement_type)
          ? data.announcement_type
          : "info";

      updateBookingStatus();

      showMessage("");

    } catch (error) {
      console.error(
        "HSM SITE ADMIN LOAD ERROR:",
        error
      );

      showMessage(
        "Gagal memuat pengaturan: " +
        error.message,
        true
      );

    } finally {
      loading = false;
    }
  }

  // ==========================================================
  // PRATINJAU PENGUMUMAN
  // ==========================================================

  function renderPreview() {
    const preview = el("hsmSitePreview");

    if (!preview) {
      return;
    }

    const title =
      el("hsmSiteAnnouncementTitle").value.trim();

    const body =
      el("hsmSiteAnnouncementBody").value.trim();

    const type =
      el("hsmSiteAnnouncementType").value;

    const validType =
      ALLOWED_TYPES.includes(type)
        ? type
        : "info";

    preview.className =
      "hsm-site-preview visible " +
      validType;

    el("hsmSitePreviewTitle").textContent =
      title || "Informasi HSM Transport";

    el("hsmSitePreviewBody").textContent =
      body || "Belum ada isi pengumuman.";
  }

  // ==========================================================
  // SIMPAN PENGATURAN
  // ==========================================================

  async function saveSettings() {
    if (saving) {
      return;
    }

    const bookingEnabled =
      el("hsmSiteBookingEnabled").checked;

    const announcementEnabled =
      el("hsmSiteAnnouncementEnabled").checked;

    const title =
      el("hsmSiteAnnouncementTitle").value.trim();

    const body =
      el("hsmSiteAnnouncementBody").value.trim();

    const type =
      el("hsmSiteAnnouncementType").value;

    // ========================================================
    // VALIDASI
    // ========================================================

    if (
      announcementEnabled &&
      (!title || !body)
    ) {
      showMessage(
        "Judul dan isi pengumuman wajib diisi jika pengumuman aktif.",
        true
      );

      return;
    }

    if (!ALLOWED_TYPES.includes(type)) {
      showMessage(
        "Jenis pengumuman tidak valid.",
        true
      );

      return;
    }

    // ========================================================
    // KONFIRMASI
    // ========================================================

    const confirmationText =

      "Simpan pengaturan website HSM Transport?\n\n" +

      "Booking Online: " +
      (bookingEnabled ? "ON" : "OFF") +

      "\nPengumuman Website: " +
      (announcementEnabled ? "ON" : "OFF") +

      "\n\nPerubahan akan berlaku untuk website penumpang.";

    if (!window.confirm(confirmationText)) {
      return;
    }

    saving = true;

    const button =
      el("hsmSiteSaveButton");

    button.disabled = true;

    button.textContent =
      "Menyimpan...";

    showMessage("");

    try {
      await checkAdmin();

      const { data, error } =
        await siteAdminDb.rpc(
          "hsm_admin_update_site_settings",
          {
            p_booking_enabled:
              bookingEnabled,

            p_announcement_enabled:
              announcementEnabled,

            p_announcement_title:
              title,

            p_announcement_body:
              body,

            p_announcement_type:
              type
          }
        );

      if (error) {
        throw error;
      }

      if (!data || data.success !== true) {
        throw new Error(
          data?.error ||
          "Gagal menyimpan pengaturan website."
        );
      }

      // ======================================================
      // BACA ULANG HASIL SIMPAN
      // ======================================================

      const readResult =
        await siteAdminDb.rpc(
          "hsm_get_public_settings"
        );

      if (
        readResult.error ||
        !readResult.data ||
        readResult.data.success !== true
      ) {
        throw new Error(
          "Pengaturan tersimpan, tetapi verifikasi ulang gagal."
        );
      }

      savedSettings =
        readResult.data;

      el("hsmSiteBookingEnabled").checked =
        savedSettings.booking_enabled === true;

      el("hsmSiteAnnouncementEnabled").checked =
        savedSettings.announcement_enabled === true;

      el("hsmSiteAnnouncementTitle").value =
        savedSettings.announcement_title || "";

      el("hsmSiteAnnouncementBody").value =
        savedSettings.announcement_body || "";

      el("hsmSiteAnnouncementType").value =
        savedSettings.announcement_type || "info";

      updateBookingStatus();

      showMessage(
        "✅ Pengaturan berhasil disimpan. Website penumpang akan mengikuti pengaturan terbaru."
      );

    } catch (error) {
      console.error(
        "HSM SITE ADMIN SAVE ERROR:",
        error
      );

      showMessage(
        "Gagal menyimpan: " +
        error.message,
        true
      );

    } finally {
      saving = false;

      button.disabled = false;

      button.textContent =
        "💾 Simpan Pengaturan";
    }
  }

  // ==========================================================
  // INISIALISASI
  // ==========================================================

  function initialize() {
    if (initialized) {
      return;
    }

    const dashboard = el("dashboard");

    if (!dashboard) {
      console.error(
        "HSM SITE ADMIN: Dashboard tidak ditemukan."
      );

      return;
    }

    const navigation = getNavigation();

    if (!navigation) {
      console.error(
        "HSM SITE ADMIN: Menu navigasi belum tersedia."
      );

      return;
    }

    installStyles();

    if (!createMenu()) {
      return;
    }

    createPanel();

    initialized = true;

    console.log(
      "HSM SITE ADMIN: Pengaturan Website siap."
    );
  }

  // ==========================================================
  // JALANKAN SETELAH HALAMAN SIAP
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
