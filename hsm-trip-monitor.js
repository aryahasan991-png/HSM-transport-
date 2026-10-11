// ============================================================
// HSM TRANSPORT
// PT HIDAYAH SARANA MULIA
//
// ADMIN MONITORING PERJALANAN
//
// FITUR:
// - Menu Monitoring
// - Monitoring seluruh armada
// - Filter tanggal
// - Filter armada
// - Status perjalanan
// - Titik keberangkatan terakhir
// - Riwayat keberangkatan
// - Statistik boarding
// - Refresh otomatis
//
// TIDAK MENGUBAH STATUS PERJALANAN
// TIDAK MENGUBAH BOOKING
// TIDAK MENGUBAH PEMBAYARAN
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

  // ==========================================================
  // HELPERS
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
      values.year +
      "-" +
      values.month +
      "-" +
      values.day
    );
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(
      String(value).slice(0, 10) + "T12:00:00Z"
    );

    if (Number.isNaN(date.getTime())) {
      return String(value);
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

  function formatTime(value) {
    if (!value) return "-";

    return String(value).slice(0, 5) + " WIT";
  }

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
        hour12: false
      }
    ).format(date) + " WIT";
  }

  function statusLabel(status) {
    if (status === "in_progress") {
      return "🟠 Dalam Perjalanan";
    }

    if (status === "completed") {
      return "🟢 Selesai";
    }

    return "🔵 Belum Berangkat";
  }

  function number(value) {
    return Number(value) || 0;
  }

  // ==========================================================
  // AUTH CHECK
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
        "Akses monitoring hanya untuk admin HSM."
      );
    }

    return true;
  }

  // ==========================================================
  // CSS
  // ==========================================================

  function installStyles() {
    const style = document.createElement("style");

    style.textContent = `

      /* NAVIGASI EMPAT MENU */

      .hsm-extra-nav {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .hsm-monitor-panel {
        display: none;
      }

      .hsm-monitor-panel.active {
        display: block;
      }

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
      }

      .hsm-monitor-refresh {
        height: 43px;
        padding: 0 15px;
        border: none;
        border-radius: 9px;
        background: #0754a6;
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .hsm-monitor-refresh:disabled {
        opacity: .6;
      }

      .hsm-monitor-message {
        margin-bottom: 14px;
        font-size: 12px;
        line-height: 1.6;
        color: #dc2626;
      }

      /* RINGKASAN */

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

      /* KARTU PERJALANAN */

      .hsm-monitor-trip {
        margin-bottom: 15px;
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

      /* STATUS PENUMPANG */

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

      /* RIWAYAT TITIK */

      .hsm-monitor-stops {
        overflow: hidden;
        border: 1px solid #e5e7eb;
        border-radius: 11px;
      }

      .hsm-monitor-stop {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px;
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
        line-height: 1.6;
      }

      .hsm-monitor-stop-time.done {
        color: #15803d;
        font-weight: 800;
      }

      .hsm-monitor-last {
        margin-bottom: 14px;
        padding: 12px;
        border-radius: 10px;
        background: #eff6ff;
        color: #1e40af;
        font-size: 12px;
        line-height: 1.8;
      }

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

      }
    `;

    document.head.appendChild(style);
  }

  // ==========================================================
  // MENU
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

    if (navigation.querySelector(
      '[data-hsm-menu="monitor"]'
    )) {
      return true;
    }

    const button = document.createElement("button");

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

    // ========================================================
    // Integrasi dengan navigasi dari hsm-admin-extra.js
    //
    // File lama tetap menangani Booking, Manifest,
    // dan Sopir & Kernet.
    //
    // File ini menangani Monitoring.
    // ========================================================

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
  // PANEL
  // ==========================================================

  function createPanel() {
    const navigation = document.querySelector(
      ".hsm-extra-nav"
    );

    if (!navigation) return;

    if (document.getElementById(
      "hsmTripMonitorSection"
    )) {
      return;
    }

    const panel = document.createElement("section");

    panel.id = "hsmTripMonitorSection";

    panel.className = "hsm-monitor-panel";

    panel.innerHTML = `

      <div class="hsm-extra-card">

        <h2 class="hsm-extra-title">
          📍 Monitoring Perjalanan
        </h2>

        <p class="hsm-extra-desc">
          Pantau perjalanan HSM-01 dan HSM-02,
          waktu keberangkatan setiap titik,
          serta status boarding penumpang.
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

    document.getElementById(
      "hsmMonitorDate"
    ).value = todayWIT();

    document.getElementById(
      "hsmMonitorDate"
    ).addEventListener(
      "change",
      loadMonitor
    );

    document.getElementById(
      "hsmMonitorVehicle"
    ).addEventListener(
      "change",
      renderMonitor
    );

    document.getElementById(
      "hsmMonitorRefresh"
    ).addEventListener(
      "click",
      loadMonitor
    );
  }

  // ==========================================================
  // TAMPILKAN MONITORING
  // ==========================================================

  function showMonitor() {
    const panel = document.getElementById(
      "hsmTripMonitorSection"
    );

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

    const bookingList = document.getElementById(
      "bookingList"
    );

    const manifest = document.getElementById(
      "hsmManifestSection"
    );

    const crew = document.getElementById(
      "hsmCrewSection"
    );

    if (stats) stats.style.display = "none";
    if (filters) filters.style.display = "none";

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
    const panel = document.getElementById(
      "hsmTripMonitorSection"
    );

    if (panel) {
      panel.classList.remove("active");
    }

    stopRefresh();
  }

  // ==========================================================
  // AMBIL DATA MONITORING
  // ==========================================================

  async function loadMonitor() {
    const panel = document.getElementById(
      "hsmTripMonitorSection"
    );

    if (!panel?.classList.contains("active")) {
      return;
    }

    if (monitorBusy) return;

    const date = document.getElementById(
      "hsmMonitorDate"
    )?.value;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
      document.getElementById(
        "hsmMonitorMessage"
      ).textContent = "Tanggal tidak valid.";

      return;
    }

    monitorBusy = true;

    const requestId = ++monitorRequestId;

    const button = document.getElementById(
      "hsmMonitorRefresh"
    );

    const message = document.getElementById(
      "hsmMonitorMessage"
    );

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

      if (error) throw error;

      if (data?.success !== true) {
        throw new Error(
          data?.error ||
          "Gagal memuat monitoring perjalanan."
        );
      }

      if (requestId !== monitorRequestId) return;

      monitorTrips = Array.isArray(data.trips)
        ? data.trips
        : [];

      renderMonitor();

    } catch (error) {
      if (requestId !== monitorRequestId) return;

      console.error(
        "HSM MONITOR ERROR:",
        error
      );

      message.textContent =
        error.message ||
        "Gagal memuat perjalanan.";

      monitorTrips = [];

      renderMonitor();

    } finally {
      if (requestId === monitorRequestId) {
        monitorBusy = false;
        button.disabled = false;
        button.textContent = "🔄 Refresh";
      }
    }
  }

  // ==========================================================
  // DATA TERFILTER
  // ==========================================================

  function filteredTrips() {
    const vehicle = document.getElementById(
      "hsmMonitorVehicle"
    )?.value || "";

    return monitorTrips.filter(trip => {
      if (!vehicle) return true;

      return trip.vehicle === vehicle;
    });
  }

  // ==========================================================
  // RINGKASAN
  // ==========================================================

  function renderSummary(trips) {
    const total = trips.length;

    const notDeparted = trips.filter(
      trip => trip.status === "not_departed"
    ).length;

    const inProgress = trips.filter(
      trip => trip.status === "in_progress"
    ).length;

    const completed = trips.filter(
      trip => trip.status === "completed"
    ).length;

    document.getElementById(
      "hsmMonitorTotalTrips"
    ).textContent = total;

    document.getElementById(
      "hsmMonitorNotDeparted"
    ).textContent = notDeparted;

    document.getElementById(
      "hsmMonitorInProgress"
    ).textContent = inProgress;

    document.getElementById(
      "hsmMonitorCompleted"
    ).textContent = completed;
  }

  // ==========================================================
  // RENDER MONITORING
  // ==========================================================

  function renderMonitor() {
    const list = document.getElementById(
      "hsmMonitorList"
    );

    if (!list) return;

    const trips = filteredTrips();

    renderSummary(trips);

    if (!trips.length) {
      list.innerHTML = `
        <div class="hsm-monitor-empty">
          🚐<br>
          <strong>Belum ada perjalanan</strong>
          <br>
          Tidak ditemukan jadwal untuk tanggal dan
          armada yang dipilih.
        </div>
      `;

      return;
    }

    list.innerHTML = trips.map(trip => {
      const stops = Array.isArray(trip.stops)
        ? [...trip.stops].sort(
            (a, b) =>
              number(a.stop_order) - number(b.stop_order)
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

      const lastStopHTML = lastStop
        ? `
          <strong>📍 Keberangkatan Terakhir</strong>
          <br>
          ${escapeText(lastStop.stop_name)}
          — ${escapeText(formatWIT(lastStop.departed_at))}
        `
        : `
          <strong>📍 Belum Ada Keberangkatan</strong>
          <br>
          Armada belum mencatat keberangkatan dari
          titik awal.
        `;

      const stopHTML = stops.map(stop => {
        const departed = !!stop.departed_at;

        let text = "";

        if (stop.is_terminal) {
          text = trip.status === "completed"
            ? "✅ Tiba " +
              formatWIT(
                stop.arrived_at || trip.completed_at
              )
            : "🏁 Tujuan Akhir";

        } else if (departed) {
          text =
            "✅ Berangkat " +
            formatWIT(stop.departed_at);

        } else {
          text = "⏳ Belum Berangkat";
        }

        return `
          <div class="hsm-monitor-stop ${departed ? "done" : ""}">

            <div class="hsm-monitor-stop-name">
              ${number(stop.stop_order)}.
              ${escapeText(stop.stop_name)}
            </div>

            <div class="hsm-monitor-stop-time ${departed ? "done" : ""}">
              ${escapeText(text)}
            </div>

          </div>
        `;
      }).join("");

      return `

        <article class="hsm-monitor-trip">

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

          <div class="hsm-monitor-last">
            ${lastStopHTML}
          </div>

          <div class="hsm-monitor-stops">
            ${stopHTML}
          </div>

        </article>
      `;
    }).join("");
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
      const panel = document.getElementById(
        "hsmTripMonitorSection"
      );

      const dashboard = document.getElementById(
        "dashboard"
      );

      if (
        document.hidden ||
        !panel?.classList.contains("active") ||
        dashboard?.style.display !== "block" ||
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
    document.getElementById(
      "logoutBtn"
    )?.addEventListener(
      "click",
      () => {
        monitorTrips = [];
        hideMonitor();
        renderMonitor();
      }
    );
  }

  // ==========================================================
  // INITIALIZATION
  // ==========================================================

  function initialize() {
    installStyles();

    if (!createMenu()) return;

    createPanel();

    installLogoutListener();

    console.log(
      "HSM TRIP MONITOR: Siap."
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
