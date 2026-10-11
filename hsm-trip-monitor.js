// ============================================================
// HSM TRANSPORT
// PT HIDAYAH SARANA MULIA
//
// ADMIN MONITORING PERJALANAN - VERSI 3
//
// FITUR:
// - Monitoring seluruh armada HSM
// - Status perjalanan
// - Filter tanggal dan armada
// - Titik keberangkatan terakhir
// - Waktu keberangkatan WIT
// - Nama petugas keberangkatan
// - Nama petugas penyelesaian
// - Riwayat aktivitas petugas
// - Riwayat pembatalan keberangkatan
// - Statistik boarding penumpang
// - Peringatan penumpang Belum Naik
// - Refresh otomatis setiap 60 detik
//
// KEAMANAN:
// - Menggunakan login admin Supabase
// - Verifikasi melalui is_hsm_admin
// - Data melalui RPC hsm_admin_get_trip_monitor
// - Tidak mengubah status perjalanan
// - Tidak mengubah booking
// - Tidak mengubah pembayaran
// ============================================================

(function () {
  "use strict";

  // ==========================================================
  // CONFIG
  // ==========================================================

  const db = adminDb;

  const TIMEZONE = "Asia/Jayapura";

  const REFRESH_INTERVAL = 60000;

  let monitorTrips = [];

  let monitorBusy = false;

  let monitorRequestId = 0;

  let refreshTimer = null;

  let monitorLoadedDate = "";

  // ==========================================================
  // ELEMENT
  // ==========================================================

  function el(id) {
    return document.getElementById(id);
  }

  // ==========================================================
  // ESCAPE HTML
  // ==========================================================

  function escapeText(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]
    );
  }

  // ==========================================================
  // TANGGAL WIT
  // ==========================================================

  function todayWIT() {
    const parts = new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(new Date());

    const values = {};

    for (const part of parts) {
      values[part.type] = part.value;
    }

    return (
      values.year + "-" +
      values.month + "-" +
      values.day
    );
  }

  // ==========================================================
  // FORMAT TANGGAL
  // ==========================================================

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(
      String(value).slice(0, 10) + "T12:00:00Z"
    );

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
      }
    ).format(date);
  }

  // ==========================================================
  // FORMAT JAM JADWAL
  // ==========================================================

  function formatTime(value) {
    if (!value) return "-";

    return String(value).slice(0, 5) + " WIT";
  }

  // ==========================================================
  // FORMAT TIMESTAMP WIT
  // ==========================================================

  function formatWIT(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }
    ).format(date) + " WIT";
  }

  // ==========================================================
  // FORMAT NAMA JABATAN
  // ==========================================================

  function roleLabel(role) {
    if (role === "driver") {
      return "Sopir";
    }

    if (role === "kernet") {
      return "Kernet";
    }

    return "Petugas";
  }

  // ==========================================================
  // FORMAT IDENTITAS PETUGAS
  // ==========================================================

  function staffLabel(name, role) {
    if (!name) {
      return "Belum tercatat";
    }

    return (
      String(name) +
      " (" +
      roleLabel(role) +
      ")"
    );
  }

  // ==========================================================
  // FORMAT STATUS PERJALANAN
  // ==========================================================

  function statusLabel(status) {
    if (status === "in_progress") {
      return "🟠 Dalam Perjalanan";
    }

    if (status === "completed") {
      return "🟢 Selesai";
    }

    return "🔵 Belum Berangkat";
  }

  // ==========================================================
  // FORMAT ANGKA
  // ==========================================================

  function number(value) {
    return Number(value) || 0;
  }

  // ==========================================================
  // FORMAT AKSI AUDIT
  // ==========================================================

  function actionLabel(action, stopName) {
    if (action === "depart") {
      return "🚐 Berangkat dari " + (stopName || "-");
    }

    if (action === "undo") {
      return "↩️ Batalkan keberangkatan dari " +
        (stopName || "-");
    }

    if (action === "complete") {
      return "🏁 Perjalanan diselesaikan";
    }

    return String(action || "Aktivitas");
  }

  // ==========================================================
  // VALIDASI ADMIN
  // ==========================================================

  async function checkAdmin() {
    const {
      data: userData,
      error: userError
    } = await db.auth.getUser();

    if (userError || !userData?.user) {
      throw new Error(
        "Sesi admin tidak valid. Silakan login kembali."
      );
    }

    const { data, error } = await db.rpc(
      "is_hsm_admin"
    );

    if (error || data !== true) {
      throw new Error(
        "Akses Monitoring hanya untuk admin HSM."
      );
    }

    return true;
  }

  // ==========================================================
  // CEK MENU MONITORING AKTIF
  // ==========================================================

  function isMonitorActive() {
    const panel = el("hsmTripMonitorSection");

    const dashboard = el("dashboard");

    return (
      !!panel &&
      panel.classList.contains("active") &&
      !!dashboard &&
      getComputedStyle(dashboard).display !== "none"
    );
  }

  // ==========================================================
  // CSS MONITORING
  // ==========================================================

  function installStyles() {
    const style = document.createElement("style");

    style.textContent = `

      /* ======================================================
         NAVIGASI ADMIN
      ====================================================== */

      .hsm-extra-nav {
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
      }

      .hsm-monitor-panel {
        display: none;
      }

      .hsm-monitor-panel.active {
        display: block;
      }

      /* ======================================================
         TOOLBAR
      ====================================================== */

      .hsm-monitor-toolbar {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 10px;
        align-items: end;
        margin-bottom: 16px;
      }

      .hsm-monitor-field label {
        display: block;
        margin-bottom: 6px;
        color: #475569;
        font-size: 11px;
        font-weight: 800;
      }

      .hsm-monitor-field input,
      .hsm-monitor-field select {
        width: 100%;
        height: 43px;
        padding: 0 11px;
        border: 1px solid #cbd5e1;
        border-radius: 9px;
        background: #ffffff;
        color: #111827;
      }

      .hsm-monitor-refresh {
        min-height: 43px;
        padding: 10px 15px;
        border: none;
        border-radius: 9px;
        background: #0754a6;
        color: white;
        font-size: 12px;
        font-weight: 800;
      }

      .hsm-monitor-refresh:disabled {
        opacity: .6;
        cursor: wait;
      }

      .hsm-monitor-message {
        margin-bottom: 14px;
        color: #dc2626;
        font-size: 12px;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .hsm-monitor-updated {
        margin-bottom: 15px;
        color: #64748b;
        font-size: 11px;
        text-align: right;
      }

      /* ======================================================
         RINGKASAN
      ====================================================== */

      .hsm-monitor-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 9px;
        margin-bottom: 17px;
      }

      .hsm-monitor-summary-card {
        padding: 14px 8px;
        border: 1px solid #e5e7eb;
        border-radius: 11px;
        background: #f8fafc;
        text-align: center;
      }

      .hsm-monitor-summary-card strong {
        display: block;
        margin-bottom: 5px;
        color: #0754a6;
        font-size: 22px;
        font-weight: 900;
      }

      .hsm-monitor-summary-card span {
        color: #64748b;
        font-size: 10px;
        font-weight: 700;
      }

      /* ======================================================
         KARTU PERJALANAN
      ====================================================== */

      .hsm-monitor-trip {
        margin-bottom: 16px;
        padding: 17px;
        border: 1px solid #dbe3ee;
        border-radius: 14px;
        background: #ffffff;
      }

      .hsm-monitor-trip-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 12px;
      }

      .hsm-monitor-route {
        color: #0754a6;
        font-size: 17px;
        font-weight: 900;
        line-height: 1.5;
      }

      .hsm-monitor-code {
        margin-top: 5px;
        color: #64748b;
        font-size: 11px;
        overflow-wrap: anywhere;
      }

      .hsm-monitor-status {
        display: inline-block;
        padding: 8px 10px;
        border-radius: 20px;
        font-size: 10px;
        font-weight: 900;
        white-space: nowrap;
      }

      .hsm-monitor-status.not_departed {
        background: #dbeafe;
        color: #1d4ed8;
      }

      .hsm-monitor-status.in_progress {
        background: #fef3c7;
        color: #92400e;
      }

      .hsm-monitor-status.completed {
        background: #dcfce7;
        color: #166534;
      }

      .hsm-monitor-trip-info {
        margin-bottom: 14px;
        color: #475569;
        font-size: 12px;
        line-height: 1.9;
      }

      /* ======================================================
         STATISTIK PENUMPANG
      ====================================================== */

      .hsm-monitor-passengers {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 7px;
        margin-bottom: 15px;
      }

      .hsm-monitor-passenger-stat {
        padding: 11px 5px;
        border: 1px solid #e5e7eb;
        border-radius: 9px;
        background: #f8fafc;
        text-align: center;
      }

      .hsm-monitor-passenger-stat strong {
        display: block;
        margin-bottom: 5px;
        font-size: 18px;
        font-weight: 900;
      }

      .hsm-monitor-passenger-stat span {
        display: block;
        color: #64748b;
        font-size: 10px;
      }

      .hsm-monitor-passenger-stat.total strong {
        color: #0754a6;
      }

      .hsm-monitor-passenger-stat.boarded strong {
        color: #15803d;
      }

      .hsm-monitor-passenger-stat.pending strong {
        color: #b45309;
      }

      .hsm-monitor-passenger-stat.absent strong {
        color: #dc2626;
      }

      /* ======================================================
         TITIK TERAKHIR
      ====================================================== */

      .hsm-monitor-last {
        margin-bottom: 14px;
        padding: 13px;
        border-radius: 10px;
        background: #eff6ff;
        color: #1e40af;
        font-size: 12px;
        line-height: 1.8;
      }

      /* ======================================================
         RIWAYAT TITIK
      ====================================================== */

      .hsm-monitor-stops {
        overflow: hidden;
        border: 1px solid #e5e7eb;
        border-radius: 11px;
      }

      .hsm-monitor-stop {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        padding: 13px;
        border-bottom: 1px solid #e5e7eb;
        background: #ffffff;
      }

      .hsm-monitor-stop:last-child {
        border-bottom: none;
      }

      .hsm-monitor-stop.done {
        background: #f0fdf4;
      }

      .hsm-monitor-stop-name {
        font-size: 12px;
        font-weight: 800;
      }

      .hsm-monitor-stop-time {
        color: #64748b;
        font-size: 11px;
        text-align: right;
        line-height: 1.7;
      }

      .hsm-monitor-stop-time.done {
        color: #15803d;
      }

      .hsm-monitor-staff {
        margin-top: 4px;
        color: #475569;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.6;
      }

      /* ======================================================
         PERINGATAN PENUMPANG
      ====================================================== */

      .hsm-monitor-warning {
        margin-bottom: 15px;
        padding: 13px;
        border: 1px solid #f4c78b;
        border-radius: 10px;
        background: #fffbeb;
        color: #92400e;
        font-size: 12px;
        line-height: 1.8;
      }

      /* ======================================================
         IDENTITAS PENYELESAIAN
      ====================================================== */

      .hsm-monitor-completion {
        margin-top: 14px;
        padding: 13px;
        border: 1px solid #bbf7d0;
        border-radius: 10px;
        background: #f0fdf4;
        color: #166534;
        font-size: 12px;
        line-height: 1.9;
      }

      /* ======================================================
         AUDIT AKTIVITAS
      ====================================================== */

      .hsm-monitor-audit {
        margin-top: 16px;
        border: 1px solid #e5e7eb;
        border-radius: 11px;
        overflow: hidden;
      }

      .hsm-monitor-audit summary {
        padding: 14px;
        background: #f8fafc;
        color: #0754a6;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      .hsm-monitor-audit-list {
        padding: 13px;
      }

      .hsm-monitor-audit-item {
        position: relative;
        padding: 0 0 15px 15px;
        margin-bottom: 14px;
        border-left: 2px solid #cbd5e1;
      }

      .hsm-monitor-audit-item:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
      }

      .hsm-monitor-audit-item::before {
        content: "";
        position: absolute;
        left: -5px;
        top: 3px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #0754a6;
      }

      .hsm-monitor-audit-item.undo::before {
        background: #d97706;
      }

      .hsm-monitor-audit-item.complete::before {
        background: #16a34a;
      }

      .hsm-monitor-audit-title {
        margin-bottom: 5px;
        color: #111827;
        font-size: 12px;
        font-weight: 900;
      }

      .hsm-monitor-audit-info {
        color: #64748b;
        font-size: 11px;
        line-height: 1.8;
      }

      /* ======================================================
         EMPTY
      ====================================================== */

      .hsm-monitor-empty {
        padding: 26px 15px;
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
        background: #ffffff;
        color: #64748b;
        text-align: center;
        font-size: 12px;
        line-height: 1.8;
      }

      /* ======================================================
         MOBILE
      ====================================================== */

      @media (max-width: 650px) {

        .hsm-extra-nav {
          grid-template-columns: repeat(2, 1fr);
        }

        .hsm-extra-nav button {
          min-height: 42px;
          font-size: 11px;
        }

        .hsm-monitor-toolbar {
          grid-template-columns: 1fr 1fr;
        }

        .hsm-monitor-refresh {
          grid-column: 1 / -1;
        }

        .hsm-monitor-summary {
          grid-template-columns: repeat(2, 1fr);
        }

        .hsm-monitor-trip-head {
          flex-wrap: wrap;
        }

        .hsm-monitor-passengers {
          grid-template-columns: repeat(2, 1fr);
        }

        .hsm-monitor-stop {
          gap: 8px;
        }

      }

    `;

    document.head.appendChild(style);
  }

  // ==========================================================
  // BUAT TOMBOL MONITORING
  // ==========================================================

  function createMenu() {
    const navigation = document.querySelector(
      ".hsm-extra-nav"
    );

    if (!navigation) {
      console.error(
        "HSM MONITOR: Navigasi admin tidak ditemukan."
      );
      return false;
    }

    let button = navigation.querySelector(
      '[data-hsm-menu="monitor"]'
    );

    if (!button) {
      button = document.createElement("button");

      button.type = "button";

      button.dataset.hsmMenu = "monitor";

      button.textContent = "📍 Monitoring";

      const crewButton = navigation.querySelector(
        '[data-hsm-menu="crew"]'
      );

      if (crewButton) {
        navigation.insertBefore(button, crewButton);
      } else {
        navigation.appendChild(button);
      }
    }

    // Listener capture dipakai supaya navigasi lama
    // tetap bisa menangani Booking, Manifest,
    // serta Sopir & Kernet tanpa modifikasi.

    navigation.addEventListener(
      "click",
      async function (event) {
        const clicked = event.target.closest(
          "[data-hsm-menu]"
        );

        if (!clicked) return;

        const menu = clicked.dataset.hsmMenu;

        if (menu === "monitor") {
          showMonitor();

          await loadMonitor();
        } else {
          hideMonitor();
        }
      },
      true
    );

    return true;
  }

  // ==========================================================
  // BUAT PANEL MONITORING
  // ==========================================================

  function createPanel() {
    const navigation = document.querySelector(
      ".hsm-extra-nav"
    );

    if (!navigation) return;

    if (el("hsmTripMonitorSection")) return;

    const panel = document.createElement("section");

    panel.id = "hsmTripMonitorSection";

    panel.className = "hsm-monitor-panel";

    panel.innerHTML = `

      <div class="hsm-extra-card">

        <h2 class="hsm-extra-title">
          📍 Monitoring Perjalanan
        </h2>

        <p class="hsm-extra-desc">
          Pantau aktivitas HSM-01 dan HSM-02,
          waktu keberangkatan, identitas petugas,
          serta status penumpang.
        </p>

        <div class="hsm-monitor-toolbar">

          <div class="hsm-monitor-field">

            <label for="hsmMonitorDate">
              Tanggal Perjalanan
            </label>

            <input
              id="hsmMonitorDate"
              type="date"
            >

          </div>

          <div class="hsm-monitor-field">

            <label for="hsmMonitorVehicle">
              Armada
            </label>

            <select id="hsmMonitorVehicle">

              <option value="">
                Semua Armada
              </option>

              <option value="HSM-01">
                HSM-01
              </option>

              <option value="HSM-02">
                HSM-02
              </option>

            </select>

          </div>

          <button
            id="hsmMonitorRefresh"
            type="button"
            class="hsm-monitor-refresh"
          >
            🔄 Refresh
          </button>

        </div>

        <div
          id="hsmMonitorMessage"
          class="hsm-monitor-message"
          role="status"
        ></div>

        <div class="hsm-monitor-updated" id="hsmMonitorUpdated">
          Belum diperbarui
        </div>

        <div class="hsm-monitor-summary">

          <div class="hsm-monitor-summary-card">

            <strong id="hsmMonitorTotalTrips">0</strong>
            <span>PERJALANAN</span>

          </div>

          <div class="hsm-monitor-summary-card">

            <strong id="hsmMonitorNotDeparted">0</strong>
            <span>BELUM BERANGKAT</span>

          </div>

          <div class="hsm-monitor-summary-card">

            <strong id="hsmMonitorInProgress">0</strong>
            <span>DALAM PERJALANAN</span>

          </div>

          <div class="hsm-monitor-summary-card">

            <strong id="hsmMonitorCompleted">0</strong>
            <span>SELESAI</span>

          </div>

        </div>

        <div id="hsmMonitorList">

          <div class="hsm-monitor-empty">
            Pilih menu Monitoring untuk melihat perjalanan.
          </div>

        </div>

      </div>
    `;

    navigation.insertAdjacentElement(
      "afterend",
      panel
    );

    el("hsmMonitorDate").value = todayWIT();

    el("hsmMonitorDate").addEventListener(
      "change",
      loadMonitor
    );

    el("hsmMonitorVehicle").addEventListener(
      "change",
      renderMonitor
    );

    el("hsmMonitorRefresh").addEventListener(
      "click",
      loadMonitor
    );
  }

  // ==========================================================
  // TAMPILKAN MONITORING
  // ==========================================================

  function showMonitor() {
    const panel = el("hsmTripMonitorSection");

    const navigation = document.querySelector(
      ".hsm-extra-nav"
    );

    if (!panel || !navigation) return;

    navigation.querySelectorAll(
      "[data-hsm-menu]"
    ).forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.hsmMenu === "monitor"
      );
    });

    const stats = document.querySelector(
      "#dashboard > .stats"
    );

    const filters = document.querySelector(
      "#dashboard > .filters"
    );

    const bookingList = el("bookingList");

    const manifest = el("hsmManifestSection");

    const crew = el("hsmCrewSection");

    if (stats) {
      stats.style.display = "none";
    }

    if (filters) {
      filters.style.display = "none";
    }

    if (bookingList) {
      bookingList.style.display = "none";
    }

    manifest?.classList.remove("active");

    crew?.classList.remove("active");

    panel.classList.add("active");

    startRefresh();
  }

  // ==========================================================
  // SEMBUNYIKAN MONITORING
  // ==========================================================

  function hideMonitor() {
    const panel = el("hsmTripMonitorSection");

    if (panel) {
      panel.classList.remove("active");
    }

    ++monitorRequestId;

    stopRefresh();
  }

  // ==========================================================
  // AMBIL DATA DARI SUPABASE
  // ==========================================================

  async function loadMonitor() {
    if (!isMonitorActive()) return;

    if (monitorBusy) return;

    const date = el("hsmMonitorDate")?.value;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
      el("hsmMonitorMessage").textContent =
        "Tanggal perjalanan tidak valid.";

      return;
    }

    monitorBusy = true;

    const requestId = ++monitorRequestId;

    const button = el("hsmMonitorRefresh");

    const message = el("hsmMonitorMessage");

    button.disabled = true;

    button.textContent = "Memuat...";

    message.textContent = "";

    try {
      await checkAdmin();

      const { data, error } = await db.rpc(
        "hsm_admin_get_trip_monitor",
        {
          p_travel_date: date
        }
      );

      if (error) {
        throw error;
      }

      if (data?.success !== true) {
        throw new Error(
          data?.error ||
          "Gagal memuat data Monitoring."
        );
      }

      if (requestId !== monitorRequestId) return;

      if (!isMonitorActive()) return;

      if (el("hsmMonitorDate").value !== date) return;

      monitorTrips = Array.isArray(data.trips)
        ? data.trips
        : [];

      monitorLoadedDate = date;

      el("hsmMonitorUpdated").textContent =
        "Terakhir diperbarui: " +
        formatWIT(new Date().toISOString());

      renderMonitor();

    } catch (error) {
      if (requestId !== monitorRequestId) return;

      console.error(
        "HSM MONITOR ERROR:",
        error
      );

      message.textContent =
        error.message ||
        "Gagal memuat data perjalanan.";

      monitorTrips = [];

      monitorLoadedDate = "";

      renderMonitor();

    } finally {
      monitorBusy = false;

      button.disabled = false;

      button.textContent = "🔄 Refresh";
    }
  }

  // ==========================================================
  // FILTER ARMADA
  // ==========================================================

  function filteredTrips() {
    const vehicle = el("hsmMonitorVehicle")?.value || "";

    return monitorTrips.filter(trip => {
      if (!vehicle) return true;

      return trip.vehicle === vehicle;
    });
  }

  // ==========================================================
  // RENDER STATISTIK PERJALANAN
  // ==========================================================

  function renderSummary(trips) {
    el("hsmMonitorTotalTrips").textContent =
      trips.length;

    el("hsmMonitorNotDeparted").textContent =
      trips.filter(
        trip => trip.status === "not_departed"
      ).length;

    el("hsmMonitorInProgress").textContent =
      trips.filter(
        trip => trip.status === "in_progress"
      ).length;

    el("hsmMonitorCompleted").textContent =
      trips.filter(
        trip => trip.status === "completed"
      ).length;
  }

  // ==========================================================
  // RENDER SATU TITIK
  // ==========================================================

  function renderStop(stop, trip) {
    const departed = !!stop.departed_at;

    const terminal = !!stop.is_terminal;

    let statusText = "";

    let staffText = "";

    if (terminal) {
      if (trip.status === "completed") {
        statusText =
          "✅ Tiba " +
          formatWIT(
            stop.arrived_at ||
            trip.completed_at
          );

        staffText = trip.completed_by_name
          ? "Diselesaikan oleh: " +
            staffLabel(
              trip.completed_by_name,
              trip.completed_by_role
            )
          : "Petugas penyelesaian belum tercatat";
      } else {
        statusText = "🏁 Tujuan Akhir";
      }

    } else if (departed) {
      statusText =
        "✅ Berangkat " +
        formatWIT(stop.departed_at);

      staffText = stop.departed_by_name
        ? "Dicatat oleh: " +
          staffLabel(
            stop.departed_by_name,
            stop.departed_by_role
          )
        : "Petugas belum tercatat";

    } else {
      statusText = "⏳ Belum Berangkat";
    }

    return `

      <div class="hsm-monitor-stop ${departed ? "done" : ""}">

        <div class="hsm-monitor-stop-name">
          ${number(stop.stop_order)}.
          ${escapeText(stop.stop_name)}
        </div>

        <div class="hsm-monitor-stop-time ${departed ? "done" : ""}">

          ${escapeText(statusText)}

          ${
            staffText
              ? `
                <div class="hsm-monitor-staff">
                  ${escapeText(staffText)}
                </div>
              `
              : ""
          }

        </div>

      </div>
    `;
  }

  // ==========================================================
  // RENDER RIWAYAT AKTIVITAS
  // ==========================================================

  function renderActivityLogs(trip) {
    const logs = Array.isArray(trip.activity_logs)
      ? [...trip.activity_logs].sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();

          if (timeA !== timeB) {
            return timeA - timeB;
          }

          return number(a.id) - number(b.id);
        })
      : [];

    if (!logs.length) {
      return `

        <details class="hsm-monitor-audit">

          <summary>
            📜 Riwayat Aktivitas
          </summary>

          <div class="hsm-monitor-audit-list">

            <div class="hsm-monitor-empty">
              Belum ada riwayat audit untuk perjalanan ini.

              <br><br>

              Perjalanan yang diuji sebelum fitur audit
              dipasang tetap memiliki catatan keberangkatan,
              tetapi tidak memiliki riwayat audit lama.
            </div>

          </div>

        </details>
      `;
    }

    const items = logs.map(log => {
      const title = actionLabel(
        log.action,
        log.stop_name
      );

      const staff = staffLabel(
        log.staff_name,
        log.staff_role
      );

      let detailText = "";

      if (
        log.action === "complete" &&
        number(log.details?.pending_passengers) > 0
      ) {
        detailText =
          "⚠️ " +
          number(log.details.pending_passengers) +
          " penumpang Belum Naik saat diselesaikan.";
      }

      if (
        log.action === "undo" &&
        log.details?.cancelled_departure_at
      ) {
        detailText =
          "Catatan keberangkatan yang dibatalkan: " +
          formatWIT(
            log.details.cancelled_departure_at
          );
      }

      return `

        <div class="hsm-monitor-audit-item ${escapeText(log.action)}">

          <div class="hsm-monitor-audit-title">
            ${escapeText(title)}
          </div>

          <div class="hsm-monitor-audit-info">

            🕒 ${escapeText(formatWIT(log.created_at))}

            <br>

            👨‍✈️ ${escapeText(staff)}

            ${
              detailText
                ? `
                  <br>
                  ${escapeText(detailText)}
                `
                : ""
            }

          </div>

        </div>
      `;
    }).join("");

    return `

      <details class="hsm-monitor-audit">

        <summary>
          📜 Riwayat Aktivitas (${logs.length})
        </summary>

        <div class="hsm-monitor-audit-list">
          ${items}
        </div>

      </details>
    `;
  }

  // ==========================================================
  // RENDER PERINGATAN PENUMPANG
  // ==========================================================

  function renderWarning(trip, pending) {
    if (
      trip.status !== "completed" ||
      pending <= 0
    ) {
      return "";
    }

    return `

      <div class="hsm-monitor-warning">

        <strong>
          ⚠️ Perhatian: Manifest Belum Lengkap
        </strong>

        <br>

        Perjalanan sudah berstatus Selesai,
        tetapi masih terdapat

        <strong>
          ${pending} penumpang
        </strong>

        yang belum dikonfirmasi naik
        atau ditandai Tidak Hadir.

        <br>

        Silakan periksa manifest perjalanan
        dan lakukan koreksi melalui admin
        apabila diperlukan.

      </div>
    `;
  }

  // ==========================================================
  // RENDER IDENTITAS PENYELESAIAN
  // ==========================================================

  function renderCompletion(trip) {
    if (trip.status !== "completed") {
      return "";
    }

    const staff = trip.completed_by_name
      ? staffLabel(
          trip.completed_by_name,
          trip.completed_by_role
        )
      : "Belum tercatat (perjalanan sebelum pembaruan audit)";

    return `

      <div class="hsm-monitor-completion">

        <strong>
          🏁 Perjalanan Selesai
        </strong>

        <br>

        🕒 Waktu:
        ${escapeText(formatWIT(trip.completed_at))}

        <br>

        👨‍✈️ Diselesaikan oleh:
        <strong>
          ${escapeText(staff)}
        </strong>

      </div>
    `;
  }

  // ==========================================================
  // RENDER KARTU PERJALANAN
  // ==========================================================

  function renderTrip(trip) {
    const stops = Array.isArray(trip.stops)
      ? [...trip.stops].sort(
          (a, b) =>
            number(a.stop_order) -
            number(b.stop_order)
        )
      : [];

    const departedStops = stops.filter(
      stop => !!stop.departed_at
    );

    const lastStop = departedStops.length
      ? departedStops[departedStops.length - 1]
      : null;

    const stats = trip.passenger_stats || {};

    const total = number(stats.total);

    const boarded = number(stats.boarded);

    const pending = number(stats.not_boarded);

    const absent = number(stats.no_show);

    let lastStopHTML = "";

    if (lastStop) {
      lastStopHTML = `

        <strong>
          📍 Keberangkatan Terakhir
        </strong>

        <br>

        ${escapeText(lastStop.stop_name)}

        —

        ${escapeText(formatWIT(lastStop.departed_at))}

        <br>

        👨‍✈️ Dicatat oleh:

        <strong>
          ${escapeText(
            staffLabel(
              lastStop.departed_by_name,
              lastStop.departed_by_role
            )
          )}
        </strong>
      `;

    } else {
      lastStopHTML = `

        <strong>
          📍 Belum Ada Keberangkatan
        </strong>

        <br>

        Armada belum mencatat keberangkatan
        dari titik awal.
      `;
    }

    const stopHTML = stops.map(
      stop => renderStop(stop, trip)
    ).join("");

    return `

      <article class="hsm-monitor-trip">

        <!-- HEADER -->

        <div class="hsm-monitor-trip-head">

          <div>

            <div class="hsm-monitor-route">

              🚐 ${escapeText(trip.vehicle)}

              <br>

              ${escapeText(trip.origin)}

              →

              ${escapeText(trip.destination)}

            </div>

            <div class="hsm-monitor-code">
              ${escapeText(trip.trip_code)}
            </div>

          </div>

          <span class="hsm-monitor-status ${escapeText(trip.status)}">
            ${escapeText(statusLabel(trip.status))}
          </span>

        </div>

        <!-- INFORMASI PERJALANAN -->

        <div class="hsm-monitor-trip-info">

          📅 Tanggal:

          <strong>
            ${escapeText(formatDate(trip.travel_date))}
          </strong>

          <br>

          🕘 Jadwal:

          <strong>
            ${escapeText(formatTime(trip.departure_time))}
          </strong>

          ${
            trip.started_at
              ? `

                <br>

                ▶ Mulai:

                <strong>
                  ${escapeText(formatWIT(trip.started_at))}
                </strong>
              `
              : ""
          }

          ${
            trip.completed_at
              ? `

                <br>

                🏁 Selesai:

                <strong>
                  ${escapeText(formatWIT(trip.completed_at))}
                </strong>
              `
              : ""
          }

        </div>

        <!-- STATISTIK PENUMPANG -->

        <div class="hsm-monitor-passengers">

          <div class="hsm-monitor-passenger-stat total">

            <strong>${total}</strong>

            <span>Total</span>

          </div>

          <div class="hsm-monitor-passenger-stat boarded">

            <strong>${boarded}</strong>

            <span>Sudah Naik</span>

          </div>

          <div class="hsm-monitor-passenger-stat pending">

            <strong>${pending}</strong>

            <span>Belum Naik</span>

          </div>

          <div class="hsm-monitor-passenger-stat absent">

            <strong>${absent}</strong>

            <span>Tidak Hadir</span>

          </div>

        </div>

        <!-- PERINGATAN -->

        ${renderWarning(trip, pending)}

        <!-- KEBERANGKATAN TERAKHIR -->

        <div class="hsm-monitor-last">
          ${lastStopHTML}
        </div>

        <!-- RIWAYAT TITIK -->

        <div class="hsm-monitor-stops">
          ${stopHTML}
        </div>

        <!-- PENYELESAIAN PERJALANAN -->

        ${renderCompletion(trip)}

        <!-- AUDIT AKTIVITAS -->

        ${renderActivityLogs(trip)}

      </article>
    `;
  }

  // ==========================================================
  // RENDER SEMUA MONITORING
  // ==========================================================

  function renderMonitor() {
    const list = el("hsmMonitorList");

    if (!list) return;

    if (
      monitorLoadedDate &&
      monitorLoadedDate !== el("hsmMonitorDate").value
    ) {
      list.innerHTML = `
        <div class="hsm-monitor-empty">
          Memuat data tanggal yang dipilih...
        </div>
      `;

      return;
    }

    const trips = filteredTrips();

    renderSummary(trips);

    if (!trips.length) {
      list.innerHTML = `

        <div class="hsm-monitor-empty">

          🚐

          <br>

          <strong>
            Belum Ada Perjalanan
          </strong>

          <br>

          Tidak ditemukan perjalanan untuk
          tanggal atau armada yang dipilih.

        </div>
      `;

      return;
    }

    list.innerHTML = trips.map(
      renderTrip
    ).join("");
  }

  // ==========================================================
  // AUTO REFRESH
  // ==========================================================

  function stopRefresh() {
    if (refreshTimer !== null) {
      clearInterval(refreshTimer);

      refreshTimer = null;
    }
  }

  function startRefresh() {
    stopRefresh();

    refreshTimer = setInterval(() => {
      if (
        document.hidden ||
        !isMonitorActive() ||
        monitorBusy
      ) {
        return;
      }

      loadMonitor();

    }, REFRESH_INTERVAL);
  }

  // ==========================================================
  // LOGOUT
  // ==========================================================

  function installLogoutListener() {
    el("logoutBtn")?.addEventListener(
      "click",
      () => {
        monitorTrips = [];

        monitorLoadedDate = "";

        hideMonitor();
      }
    );
  }

  // ==========================================================
  // TAMPILKAN DATA TERBARU KETIKA KEMBALI KE TAB
  // ==========================================================

  function installVisibilityListener() {
    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          !document.hidden &&
          isMonitorActive() &&
          !monitorBusy
        ) {
          loadMonitor();
        }
      }
    );
  }

  // ==========================================================
  // INITIALIZATION
  // ==========================================================

  function initialize() {
    installStyles();

    if (!createMenu()) {
      return;
    }

    createPanel();

    installLogoutListener();

    installVisibilityListener();

    console.log(
      "HSM TRIP MONITOR V3: Siap."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
