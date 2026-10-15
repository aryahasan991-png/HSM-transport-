/*
============================================================
HSM TRANSPORT
PT HIDAYAH SARANA MULIA

HSM OWNER - LIVE GPS TRACKING

FITUR:
01. Menu Live GPS di navigasi Owner
02. Desain Premium Navy
03. Peta OpenStreetMap
04. Empat petugas HSM
05. Identitas sopir dan kernet
06. Lokasi per petugas
07. Status Online / Terlambat / Offline
08. Koordinat GPS
09. Akurasi lokasi
10. Waktu update WIT
11. Google Maps
12. Refresh otomatis 30 detik
13. Filter HSM-01 / HSM-02
14. Akses khusus Owner + MFA
15. Tidak mengubah fitur Owner lainnya

DATABASE:
public.hsm_owner_get_live_locations()

============================================================
*/

(function () {
  "use strict";

  if (window.HSM_OWNER_LIVE_GPS_READY) {
    return;
  }

  const $gps = id => document.getElementById(id);

  const dashboard = $gps("dashboardPage");

  const navigation =
    document.querySelector(".bottomnav");

  const main =
    document.querySelector(
      "#dashboardPage .main"
    );

  if (
    !dashboard ||
    !navigation ||
    !main
  ) {
    console.error(
      "HSM GPS: Struktur Owner tidak ditemukan."
    );

    return;
  }

  window.HSM_OWNER_LIVE_GPS_READY = true;

  /* ========================================================
     KONFIGURASI
  ======================================================== */

  const REFRESH_INTERVAL = 30000;

  const ONLINE_LIMIT = 120000;

  const STALE_LIMIT = 300000;

  const GPS_ICON = `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 22s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12z"/>
      <circle cx="12" cy="10" r="2.5"/>
    </svg>
  `;

  const REFRESH_ICON = `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20 7v5h-5"/>
      <path d="M4 17v-5h5"/>
      <path d="M5 9a8 8 0 0 1 14-2l1 5"/>
      <path d="M19 15a8 8 0 0 1-14 2l-1-5"/>
    </svg>
  `;

  /* ========================================================
     STATE
  ======================================================== */

  let gpsRows = [];

  let gpsMap = null;

  let gpsMarkers = [];

  let gpsTimer = null;

  let gpsLoading = false;

  let gpsGeneration = 0;

  let selectedVehicle = "ALL";

  let leafletPromise = null;

  /* ========================================================
     CSS PREMIUM NAVY
  ======================================================== */

  const style =
    document.createElement("style");

  style.id = "hsmOwnerGpsStyles";

  style.textContent = `

    /* NAVIGASI 6 MENU */

    .bottomnav {
      grid-template-columns:
        repeat(6,minmax(0,1fr));
    }

    .bottomnav .navbutton {
      min-width:0;
      font-size:8px;
    }

    .bottomnav .navbutton svg {
      width:19px;
      height:19px;
    }

    /* LIVE GPS */

    .hsm-gps-heading {
      margin:4px 0 15px;
    }

    .hsm-gps-heading h2 {
      margin:0 0 7px;

      color:#071e42;

      font-size:21px;
      font-weight:900;
    }

    .hsm-gps-heading p {
      margin:0;

      color:#687e98;

      font-size:11px;
      line-height:1.7;
    }

    .hsm-gps-summary {
      display:grid;

      grid-template-columns:
        repeat(3,minmax(0,1fr));

      gap:9px;

      margin-bottom:15px;
    }

    .hsm-gps-stat {
      padding:14px 9px;

      text-align:center;

      border:1px solid #c3d4e6;
      border-radius:14px;

      background:linear-gradient(
        145deg,
        #e9f1fa,
        #cedff0
      );
    }

    .hsm-gps-stat strong {
      display:block;

      font-size:23px;
      font-weight:900;

      color:#071e42;
    }

    .hsm-gps-stat span {
      display:block;

      margin-top:6px;

      font-size:10px;

      color:#687e98;
    }

    .hsm-gps-filters {
      display:grid;

      grid-template-columns:
        repeat(3,minmax(0,1fr));

      gap:8px;

      margin-bottom:13px;
    }

    .hsm-gps-filter {
      padding:11px 5px;

      border:1px solid #b9cce1;
      border-radius:11px;

      background:#dae7f4;

      color:#0b2a55;

      font-size:11px;
      font-weight:800;
    }

    .hsm-gps-filter.active {
      background:#0b2a55;

      border-color:#0b2a55;

      color:white;
    }

    .hsm-gps-map-card {
      padding:12px;

      border:1px solid #c7d8e8;
      border-radius:18px;

      background:#eaf1f8;

      box-shadow:0 8px 24px #061e4217;

      margin-bottom:15px;
    }

    #hsmOwnerGpsMap {
      width:100%;
      height:355px;

      border-radius:13px;

      overflow:hidden;

      background:#d5e3f1;
    }

    .hsm-gps-map-note {
      margin:11px 4px 2px;

      font-size:10px;
      line-height:1.7;

      color:#687e98;
    }

    .hsm-gps-toolbar {
      display:flex;

      justify-content:space-between;
      align-items:center;

      gap:10px;

      margin:12px 0;
    }

    .hsm-gps-toolbar strong {
      color:#071e42;

      font-size:14px;
    }

    .hsm-gps-refresh {
      display:flex;

      align-items:center;
      justify-content:center;

      gap:6px;

      border:1px solid #bfd0e3;
      border-radius:10px;

      padding:10px 12px;

      background:#d9e8f7;

      color:#0b2a55;

      font-size:11px;
      font-weight:800;
    }

    .hsm-gps-refresh svg {
      width:16px;
      height:16px;
    }

    .hsm-gps-staff {
      padding:16px;

      margin-bottom:11px;

      border:1px solid #c3d4e6;
      border-radius:16px;

      background:linear-gradient(
        145deg,
        #eaf2fa,
        #dae7f4
      );

      box-shadow:0 6px 19px #061e4210;
    }

    .hsm-gps-staff-head {
      display:flex;

      justify-content:space-between;
      align-items:flex-start;

      gap:12px;
    }

    .hsm-gps-staff-name {
      color:#071e42;

      font-size:14px;
      font-weight:900;
    }

    .hsm-gps-staff-role {
      margin-top:5px;

      color:#687e98;

      font-size:11px;
    }

    .hsm-gps-badge {
      flex-shrink:0;

      border-radius:20px;

      padding:7px 9px;

      font-size:10px;
      font-weight:900;
    }

    .hsm-gps-badge.online {
      background:#d9f6e6;
      color:#147c4b;
    }

    .hsm-gps-badge.stale {
      background:#fff0cc;
      color:#9b650a;
    }

    .hsm-gps-badge.offline {
      background:#e0e6ee;
      color:#64748b;
    }

    .hsm-gps-staff-detail {
      display:grid;

      grid-template-columns:
        repeat(2,minmax(0,1fr));

      gap:10px;

      margin-top:15px;
    }

    .hsm-gps-detail {
      min-width:0;

      padding:11px;

      border:1px solid #cad9e9;
      border-radius:11px;

      background:#edf4fb;
    }

    .hsm-gps-detail span {
      display:block;

      color:#687e98;

      font-size:10px;

      margin-bottom:5px;
    }

    .hsm-gps-detail strong {
      display:block;

      color:#142844;

      font-size:11px;

      overflow-wrap:anywhere;
    }

    .hsm-gps-map-link {
      display:block;

      margin-top:14px;

      padding:12px;

      text-align:center;
      text-decoration:none;

      border-radius:11px;

      background:linear-gradient(
        120deg,
        #0754a6,
        #0b2a55
      );

      color:white;

      font-size:12px;
      font-weight:900;
    }

    .hsm-gps-message {
      padding:15px;

      border:1px solid #cad9e9;
      border-radius:12px;

      background:#e6eef8;

      color:#526a86;

      font-size:11px;
      line-height:1.7;

      margin-bottom:13px;
    }

    .hsm-gps-message.error {
      background:#fff0f0;

      border-color:#f1c8c8;

      color:#b42318;
    }

    .hsm-gps-popup {
      min-width:155px;

      line-height:1.6;

      color:#142844;
    }

    .hsm-gps-popup strong {
      font-size:13px;
    }

    .hsm-gps-popup small {
      font-size:11px;
    }

    @media(max-width:390px) {

      .bottomnav .navbutton {
        font-size:7.5px;
      }

      .bottomnav .navbutton svg {
        width:18px;
        height:18px;
      }

      #hsmOwnerGpsMap {
        height:300px;
      }

      .hsm-gps-staff {
        padding:13px;
      }

    }

    @media(min-width:750px) {

      #hsmOwnerGpsMap {
        height:470px;
      }

    }

  `;

  document.head.appendChild(style);

  /* ========================================================
     BUAT MENU NAVIGASI
  ======================================================== */

  const navButton =
    document.createElement("button");

  navButton.className = "navbutton";

  navButton.type = "button";

  navButton.dataset.nav = "gps";

  navButton.innerHTML = `
    ${GPS_ICON}
    <span>Live GPS</span>
  `;

  const reportNav =
    navigation.querySelector(
      '[data-nav="reports"]'
    );

  if (reportNav) {

    navigation.insertBefore(
      navButton,
      reportNav
    );

  } else {

    navigation.appendChild(
      navButton
    );

  }

  /* ========================================================
     BUAT HALAMAN LIVE GPS
  ======================================================== */

  const gpsPage =
    document.createElement("section");

  gpsPage.id = "screen-gps";

  gpsPage.className = "screen";

  gpsPage.innerHTML = `

    <div class="hsm-gps-heading">

      <h2>Live Tracking Armada</h2>

      <p>
        Pantau lokasi Sopir dan Kernet
        HSM Transport selama bertugas.
      </p>

    </div>

    <div class="hsm-gps-summary">

      <div class="hsm-gps-stat">
        <strong id="hsmGpsTotal">0</strong>
        <span>Total Petugas</span>
      </div>

      <div class="hsm-gps-stat">
        <strong id="hsmGpsOnline">0</strong>
        <span>GPS Online</span>
      </div>

      <div class="hsm-gps-stat">
        <strong id="hsmGpsOffline">0</strong>
        <span>Tidak Online</span>
      </div>

    </div>

    <div class="hsm-gps-filters">

      <button
        type="button"
        class="hsm-gps-filter active"
        data-gps-vehicle="ALL"
      >
        Semua
      </button>

      <button
        type="button"
        class="hsm-gps-filter"
        data-gps-vehicle="HSM-01"
      >
        HSM-01
      </button>

      <button
        type="button"
        class="hsm-gps-filter"
        data-gps-vehicle="HSM-02"
      >
        HSM-02
      </button>

    </div>

    <div class="hsm-gps-map-card">

      <div id="hsmOwnerGpsMap"></div>

      <div class="hsm-gps-map-note">
        Peta OpenStreetMap.
        Penanda menunjukkan posisi GPS
        terakhir yang diterima server.
        Lokasi dapat berbeda dari posisi sebenarnya
        apabila jaringan atau GPS terganggu.
      </div>

    </div>

    <div class="hsm-gps-toolbar">

      <strong>Lokasi Petugas</strong>

      <button
        id="hsmGpsRefreshBtn"
        type="button"
        class="hsm-gps-refresh"
      >
        ${REFRESH_ICON}
        Refresh
      </button>

    </div>

    <div
      id="hsmGpsMessage"
      class="hsm-gps-message"
    >
      Menunggu data lokasi...
    </div>

    <div id="hsmGpsStaffList"></div>

    <div class="notice">

      <strong>Informasi Live Tracking</strong>
      <br>

      Lokasi diperbarui selama petugas
      mengaktifkan berbagi lokasi dan
      sesi kerjanya masih berlaku.

      Setelah petugas logout, status
      ditampilkan Offline.

      Data lokasi terakhir tidak berarti
      petugas masih berada di titik tersebut.

    </div>

  `;

  main.appendChild(gpsPage);

  /* ========================================================
     TOMBOL AKSES CEPAT BERANDA
  ======================================================== */

  const quickActions =
    document.querySelector(
      "#screen-home .actions"
    );

  if (quickActions) {

    const quickButton =
      document.createElement("button");

    quickButton.className = "action";

    quickButton.type = "button";

    quickButton.dataset.go = "gps";

    quickButton.innerHTML = `
      ${GPS_ICON}
      <span>Live GPS</span>
    `;

    quickActions.appendChild(
      quickButton
    );

    quickActions.style.gridTemplateColumns =
      "repeat(auto-fit,minmax(64px,1fr))";

  }

  /* ========================================================
     FORMAT DATA
  ======================================================== */

  function clean(value) {
    return String(
      value ?? ""
    );
  }

  function formatVehicle(value) {

    const normalized =
      clean(value)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g,"");

    if (normalized === "HSM01") {
      return "HSM-01";
    }

    if (normalized === "HSM02") {
      return "HSM-02";
    }

    return clean(value) || "-";

  }

  function roleName(role) {

    if (role === "driver") {
      return "Sopir";
    }

    if (role === "kernet") {
      return "Kernet";
    }

    return clean(role) || "Petugas";

  }

  function formatCoordinate(value) {

    const number = Number(value);

    return Number.isFinite(number)
      ? number.toFixed(6)
      : "-";

  }

  function formatGpsTime(value) {

    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone:"Asia/Jayapura",
        day:"2-digit",
        month:"short",
        year:"numeric",
        hour:"2-digit",
        minute:"2-digit",
        second:"2-digit",
        hour12:false
      }
    ).format(date) + " WIT";

  }

  function validPosition(row) {

    if (
      row.latitude === null ||
      row.longitude === null ||
      row.latitude === undefined ||
      row.longitude === undefined
    ) {
      return false;
    }

    const lat = Number(row.latitude);
    const lng = Number(row.longitude);

    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );

  }

  /* ========================================================
     STATUS LOKASI
  ======================================================== */

  function locationStatus(row) {

    if (!row.session_active) {

      return {
        key:"offline",
        text:"Offline"
      };

    }

    if (
      !validPosition(row) ||
      !row.recorded_at
    ) {

      return {
        key:"offline",
        text:"Belum Ada Lokasi"
      };

    }

    const time =
      Date.parse(row.recorded_at);

    if (!Number.isFinite(time)) {

      return {
        key:"offline",
        text:"Offline"
      };

    }

    const age =
      Date.now() - time;

    if (
      age >= 0 &&
      age <= ONLINE_LIMIT
    ) {

      return {
        key:"online",
        text:"Online"
      };

    }

    if (
      age >= 0 &&
      age <= STALE_LIMIT
    ) {

      return {
        key:"stale",
        text:"Lokasi Terlambat"
      };

    }

    return {
      key:"offline",
      text:"Offline"
    };

  }

  /* ========================================================
     FILTER
  ======================================================== */

  function filteredRows() {

    return gpsRows.filter(row => {

      return (
        selectedVehicle === "ALL" ||
        formatVehicle(row.vehicle) ===
          selectedVehicle
      );

    });

  }

  /* ========================================================
     BUAT ELEMEN
  ======================================================== */

  function addText(
    parent,
    tag,
    className,
    value
  ) {

    const element =
      document.createElement(tag);

    if (className) {
      element.className = className;
    }

    element.textContent =
      clean(value);

    parent.appendChild(element);

    return element;

  }

  function detail(
    parent,
    label,
    value
  ) {

    const item =
      addText(
        parent,
        "div",
        "hsm-gps-detail",
        ""
      );

    addText(
      item,
      "span",
      "",
      label
    );

    addText(
      item,
      "strong",
      "",
      value
    );

  }

  /* ========================================================
     RENDER PETUGAS
  ======================================================== */

  function renderStaff() {

    const rows = filteredRows();

    const host =
      $gps("hsmGpsStaffList");

    host.replaceChildren();

    const online =
      rows.filter(
        row =>
          locationStatus(row).key ===
          "online"
      ).length;

    $gps("hsmGpsTotal").textContent =
      rows.length;

    $gps("hsmGpsOnline").textContent =
      online;

    $gps("hsmGpsOffline").textContent =
      rows.length - online;

    if (!rows.length) {

      addText(
        host,
        "div",
        "empty",
        "Belum ada petugas untuk armada ini."
      );

      return;

    }

    rows.forEach(row => {

      const status =
        locationStatus(row);

      const card =
        addText(
          host,
          "article",
          "hsm-gps-staff",
          ""
        );

      const head =
        addText(
          card,
          "div",
          "hsm-gps-staff-head",
          ""
        );

      const identity =
        addText(
          head,
          "div",
          "",
          ""
        );

      addText(
        identity,
        "div",
        "hsm-gps-staff-name",
        row.crew_name || "Petugas HSM"
      );

      addText(
        identity,
        "div",
        "hsm-gps-staff-role",
        roleName(row.crew_role) +
        " • " +
        formatVehicle(row.vehicle)
      );

      addText(
        head,
        "span",
        "hsm-gps-badge " + status.key,
        status.text
      );

      const details =
        addText(
          card,
          "div",
          "hsm-gps-staff-detail",
          ""
        );

      detail(
        details,
        "Latitude",
        validPosition(row)
          ? formatCoordinate(row.latitude)
          : "-"
      );

      detail(
        details,
        "Longitude",
        validPosition(row)
          ? formatCoordinate(row.longitude)
          : "-"
      );

      detail(
        details,
        "Akurasi GPS",
        row.accuracy_m !== null &&
        row.accuracy_m !== undefined
          ? Number(row.accuracy_m)
              .toFixed(0) + " meter"
          : "-"
      );

      detail(
        details,
        "Update Terakhir",
        formatGpsTime(
          row.recorded_at
        )
      );

      if (validPosition(row)) {

        const lat =
          Number(row.latitude);

        const lng =
          Number(row.longitude);

        const link =
          document.createElement("a");

        link.className =
          "hsm-gps-map-link";

        link.href =
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent(
            lat + "," + lng
          );

        link.target = "_blank";

        link.rel =
          "noopener noreferrer";

        link.textContent =
          "Buka Lokasi Terakhir di Google Maps";

        card.appendChild(link);

      }

    });

  }

  /* ========================================================
     LOAD LEAFLET
  ======================================================== */

  function loadLeaflet() {

    if (window.L) {
      return Promise.resolve();
    }

    if (leafletPromise) {
      return leafletPromise;
    }

    leafletPromise =
      new Promise((resolve,reject) => {

        if (
          !document.getElementById(
            "hsmLeafletCSS"
          )
        ) {

          const css =
            document.createElement("link");

          css.id = "hsmLeafletCSS";

          css.rel = "stylesheet";

          css.href =
            "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";

          document.head.appendChild(css);

        }

        const script =
          document.createElement("script");

        script.src =
          "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";

        script.onload = () => {

          if (window.L) {
            resolve();
          } else {
            reject(
              new Error(
                "Pustaka peta tidak tersedia."
              )
            );
          }

        };

        script.onerror = () => {

          reject(
            new Error(
              "Gagal memuat peta. Periksa koneksi internet."
            )
          );

        };

        document.head.appendChild(
          script
        );

      }).catch(error => {

        leafletPromise = null;

        throw error;

      });

    return leafletPromise;

  }

  /* ========================================================
     INITIALIZE MAP
  ======================================================== */

  async function initializeMap() {

    await loadLeaflet();

    if (gpsMap) {

      setTimeout(() => {
        gpsMap.invalidateSize();
      },100);

      return;
    }

    gpsMap = window.L.map(
      "hsmOwnerGpsMap",
      {
        zoomControl:true,
        attributionControl:true
      }
    );

    /*
      Tampilan awal Maluku Utara.

      Ini hanya pusat peta,
      bukan koordinat petugas.
    */

    gpsMap.setView(
      [0.73,127.60],
      9
    );

    window.L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom:19,
        attribution:
          '&copy; OpenStreetMap contributors'
      }
    ).addTo(gpsMap);

    setTimeout(() => {
      gpsMap.invalidateSize();
    },200);

  }

  /* ========================================================
     RENDER MARKER GPS
  ======================================================== */

  function renderMap() {

    if (!gpsMap || !window.L) {
      return;
    }

    gpsMarkers.forEach(marker => {

      gpsMap.removeLayer(marker);

    });

    gpsMarkers = [];

    const bounds = [];

    filteredRows().forEach(row => {

      if (!validPosition(row)) {
        return;
      }

      const lat =
        Number(row.latitude);

      const lng =
        Number(row.longitude);

      const status =
        locationStatus(row);

      const color =
        status.key === "online"
          ? "#17834d"
          : status.key === "stale"
            ? "#b76a0b"
            : "#64748b";

      const marker =
        window.L.circleMarker(
          [lat,lng],
          {
            radius:10,
            color:"#ffffff",
            weight:3,
            fillColor:color,
            fillOpacity:1
          }
        ).addTo(gpsMap);

      /*
        Popup menggunakan elemen DOM,
        bukan memasukkan nama petugas
        langsung ke HTML.
      */

      const popup =
        document.createElement("div");

      popup.className =
        "hsm-gps-popup";

      addText(
        popup,
        "strong",
        "",
        row.crew_name || "Petugas HSM"
      );

      popup.appendChild(
        document.createElement("br")
      );

      addText(
        popup,
        "small",
        "",
        roleName(row.crew_role) +
        " • " +
        formatVehicle(row.vehicle)
      );

      popup.appendChild(
        document.createElement("br")
      );

      addText(
        popup,
        "small",
        "",
        status.text
      );

      popup.appendChild(
        document.createElement("br")
      );

      addText(
        popup,
        "small",
        "",
        formatGpsTime(
          row.recorded_at
        )
      );

      marker.bindPopup(popup);

      gpsMarkers.push(marker);

      bounds.push([lat,lng]);

    });

    if (bounds.length > 0) {

      gpsMap.fitBounds(
        bounds,
        {
          padding:[35,35],
          maxZoom:14
        }
      );

    }

    gpsMap.invalidateSize();

  }

  /* ========================================================
     LOAD DATA OWNER
  ======================================================== */

  async function refreshGPS() {

    if (
      gpsLoading ||
      !ownerDB ||
      !dashboard.classList.contains(
        "active"
      )
    ) {
      return;
    }

    gpsLoading = true;

    const generation =
      gpsGeneration;

    const refreshButton =
      $gps("hsmGpsRefreshBtn");

    refreshButton.disabled = true;

    $gps("hsmGpsMessage").textContent =
      "Memperbarui lokasi petugas...";

    $gps("hsmGpsMessage").className =
      "hsm-gps-message";

    try {

      /*
        Perlindungan akses Owner.

        ownerAccess() memeriksa:
        - Google Authenticator AAL2
        - Hak akses Owner

        RPC database juga melakukan
        pemeriksaan independen.
      */

      await ownerAccess();

      const {data,error} =
        await ownerDB.rpc(
          "hsm_owner_get_live_locations"
        );

      if (error) {
        throw error;
      }

      if (
        generation !== gpsGeneration ||
        !dashboard.classList.contains(
          "active"
        )
      ) {
        return;
      }

      if (!Array.isArray(data)) {

        throw new Error(
          "Format lokasi GPS dari server tidak valid."
        );

      }

      gpsRows = data;

      renderStaff();

      await initializeMap();

      if (
        generation !== gpsGeneration ||
        !dashboard.classList.contains(
          "active"
        )
      ) {
        return;
      }

      renderMap();

      $gps("hsmGpsMessage").textContent =
        gpsRows.length
          ? "Data lokasi terakhir berhasil diperbarui."
          : "Belum ada data petugas pada sistem GPS.";

    } catch(error) {

      console.error(
        "HSM OWNER LIVE GPS:",
        error
      );

      if (generation === gpsGeneration) {

        $gps("hsmGpsMessage").textContent =
          error?.message ||
          "Gagal mengambil lokasi petugas.";

        $gps("hsmGpsMessage").className =
          "hsm-gps-message error";

      }

    } finally {

      gpsLoading = false;

      refreshButton.disabled = false;

    }

  }

  /* ========================================================
     TIMER REFRESH
  ======================================================== */

  function startGpsTimer() {

    stopGpsTimer();

    gpsTimer = setInterval(() => {

      if (
        !document.hidden &&
        dashboard.classList.contains(
          "active"
        ) &&
        gpsPage.classList.contains(
          "active"
        )
      ) {

        void refreshGPS();

      }

    },REFRESH_INTERVAL);

  }

  function stopGpsTimer() {

    if (gpsTimer) {

      clearInterval(
        gpsTimer
      );

      gpsTimer = null;

    }

  }

  /* ========================================================
     BUKA HALAMAN GPS
  ======================================================== */

  function openGpsPage() {

    if (
      !dashboard.classList.contains(
        "active"
      )
    ) {
      return;
    }

    /*
      Gunakan fungsi screen() asli,
      supaya navigasi lama tetap bekerja.
    */

    if (
      typeof screen === "function"
    ) {

      screen("gps");

    } else {

      document
        .querySelectorAll(".screen")
        .forEach(element => {

          element.classList.toggle(
            "active",
            element === gpsPage
          );

        });

    }

    $gps("headerScreenTitle").textContent =
      "Live Tracking Armada";

    startGpsTimer();

    void refreshGPS();

    setTimeout(() => {

      if (gpsMap) {
        gpsMap.invalidateSize();
      }

    },250);

  }

  /* ========================================================
     EVENT NAVIGASI
  ======================================================== */

  navButton.addEventListener(
    "click",
    openGpsPage
  );

  if (quickActions) {

    const button =
      quickActions.querySelector(
        '[data-go="gps"]'
      );

    button?.addEventListener(
      "click",
      openGpsPage
    );

  }

  /*
    Ketika membuka menu lain,
    hentikan refresh GPS otomatis.
  */

  navigation.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-nav]"
        );

      if (
        button &&
        button.dataset.nav !== "gps"
      ) {

        stopGpsTimer();

      }

    }
  );

  document
    .querySelectorAll(
      '#screen-home [data-go]:not([data-go="gps"])'
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        stopGpsTimer
      );

    });

  /* ========================================================
     FILTER ARMADA
  ======================================================== */

  gpsPage
    .querySelectorAll(
      "[data-gps-vehicle]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          selectedVehicle =
            button.dataset.gpsVehicle;

          gpsPage
            .querySelectorAll(
              "[data-gps-vehicle]"
            )
            .forEach(element => {

              element.classList.toggle(
                "active",
                element === button
              );

            });

          renderStaff();

          renderMap();

        }
      );

    });

  /* ========================================================
     MANUAL REFRESH
  ======================================================== */

  $gps("hsmGpsRefreshBtn")
    .addEventListener(
      "click",
      () => void refreshGPS()
    );

  /* ========================================================
     REFRESH KETIKA APLIKASI DIBUKA
  ======================================================== */

  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        !document.hidden &&
        dashboard.classList.contains(
          "active"
        ) &&
        gpsPage.classList.contains(
          "active"
        )
      ) {

        void refreshGPS();

      }

    }
  );

  /* ========================================================
     RESET SAAT LOGOUT
  ======================================================== */

  const observer =
    new MutationObserver(() => {

      const loggedIn =
        dashboard.classList.contains(
          "active"
        );

      if (!loggedIn) {

        gpsGeneration++;

        stopGpsTimer();

        gpsRows = [];

        renderStaff();

        if (gpsMap) {

          gpsMarkers.forEach(marker => {

            gpsMap.removeLayer(marker);

          });

          gpsMarkers = [];

        }

      }

    });

  observer.observe(
    dashboard,
    {
      attributes:true,
      attributeFilter:["class"]
    }
  );

  /* ========================================================
     INITIALIZATION
  ======================================================== */

  console.log(
    "HSM OWNER LIVE GPS: Siap."
  );

})();
