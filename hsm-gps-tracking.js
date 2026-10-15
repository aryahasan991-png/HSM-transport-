/*
============================================================
HSM TRANSPORT
PT HIDAYAH SARANA MULIA

HSM INTERNAL - GPS LIVE TRACKING

KHUSUS:
SOPIR DAN KERNET

FITUR:
01. Integrasi Premium Navy
02. Panel GPS pada menu Akun
03. Status berbagi lokasi
04. Permintaan persetujuan petugas
05. Mulai layanan GPS Android
06. Berhenti layanan GPS Android
07. Informasi waktu lokasi terakhir
08. Informasi armada
09. Berhenti setelah logout
10. Berhenti setelah sesi berakhir
11. Pemeriksaan pergantian tanggal WIT
12. Tidak mengganggu QR Scanner
13. Tidak mengganggu Manifest
14. Tidak mengganggu Status Perjalanan
15. Tidak mengubah login PIN

CATATAN:
File ini mengendalikan layanan native Android.

Background GPS dijalankan oleh
HSMGpsService.java.

Pelacakan harus dilakukan secara transparan
dengan persetujuan petugas.
============================================================
*/

(function () {

  "use strict";

  /* ========================================================
     1. CEGAH INITIALIZATION GANDA
  ======================================================== */

  if (window.HSM_GPS_TRACKING_READY) {
    return;
  }

  window.HSM_GPS_TRACKING_READY = true;

  /* ========================================================
     2. CONFIGURATION
  ======================================================== */

  const TOKEN_KEY =
    "hsm_staff_session_token";

  const LOGIN_DATE_KEY =
    "hsm_staff_login_date";

  const WIT_TIMEZONE =
    "Asia/Jayapura";

  const STATUS_INTERVAL =
    8000;

  const $gps = id =>
    document.getElementById(id);

  /* ========================================================
     3. ELEMENT
  ======================================================== */

  const dashboard =
    $gps("dashboard");

  const logoutBtn =
    $gps("logoutBtn");

  if (!dashboard) {

    console.error(
      "HSM GPS: Dashboard tidak ditemukan."
    );

    return;

  }

  /* ========================================================
     4. DETEKSI APK ANDROID
  ======================================================== */

  const isAndroid =
    /Android/i.test(navigator.userAgent);

  const isCapacitor =
    window.location.origin ===
      "https://localhost" ||
    window.location.protocol ===
      "capacitor:";

  const isAndroidAPK =
    isAndroid && isCapacitor;

  /*
    GPS native hanya digunakan pada APK
    HSM Internal Android.

    Website biasa dan PWA iPhone tidak
    akan menjalankan layanan native ini.
  */

  if (!isAndroidAPK) {

    console.log(
      "HSM GPS: Native tracking hanya tersedia di APK Android."
    );

    return;

  }

  /* ========================================================
     5. ICON SVG PROFESIONAL
  ======================================================== */

  const icons = {

    location: `
      <path
        d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"
      />
      <circle
        cx="12"
        cy="10"
        r="2.5"
      />
    `,

    satellite: `
      <path
        d="m8 16-4 4"
      />
      <path
        d="m5 13 6 6"
      />
      <path
        d="m13 4 7 7"
      />
      <path
        d="m10 7 7 7"
      />
      <path
        d="m14 3 7 7"
      />
      <path
        d="M10 10 7 13"
      />
    `,

    clock: `
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path
        d="M12 7v5l3 2"
      />
    `,

    shield: `
      <path
        d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z"
      />
      <path
        d="m8 12 3 3 5-6"
      />
    `,

    power: `
      <path
        d="M12 2v10"
      />
      <path
        d="M6 5a9 9 0 1 0 12 0"
      />
    `,

    check: `
      <path
        d="m5 12 5 5L20 7"
      />
    `,

    alert: `
      <path
        d="m12 3 10 18H2z"
      />
      <path
        d="M12 9v5"
      />
      <path
        d="M12 18h.01"
      />
    `

  };

  function icon(
    name,
    size = 20
  ) {

    return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${size}"
        height="${size}"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        ${icons[name] || ""}
      </svg>
    `;

  }

  /* ========================================================
     6. CSS PREMIUM NAVY
  ======================================================== */

  const style =
    document.createElement("style");

  style.id =
    "hsmGpsPremiumStyle";

  style.textContent = `

    /* =====================================================
       HSM GPS CARD
    ===================================================== */

    .hsm-gps-card {

      position:relative;

      overflow:hidden;

      margin-bottom:13px;

      padding:18px;

      border:1px solid #bfd2e7;

      border-radius:18px;

      background:
        linear-gradient(
          145deg,
          #e8f1fa,
          #d7e6f5
        );

      box-shadow:
        0 8px 24px rgba(6,30,66,.08);

      color:#071e42;

    }

    .hsm-gps-card::before {

      content:"";

      position:absolute;

      top:0;
      left:0;

      width:100%;
      height:4px;

      background:
        linear-gradient(
          90deg,
          #0754a6 75%,
          #e31e2d 75%
        );

    }

    /* =====================================================
       HEADER
    ===================================================== */

    .hsm-gps-heading {

      display:flex;

      align-items:center;

      justify-content:space-between;

      gap:12px;

      margin-bottom:15px;

    }

    .hsm-gps-heading-left {

      display:flex;

      align-items:center;

      gap:11px;

      min-width:0;

    }

    .hsm-gps-icon {

      width:45px;
      height:45px;

      display:grid;

      place-items:center;

      flex-shrink:0;

      border-radius:13px;

      background:#d6e7f9;

      color:#0754a6;

    }

    .hsm-gps-heading h2 {

      margin:0;

      font-size:16px;

      font-weight:900;

      color:#071e42;

    }

    .hsm-gps-heading small {

      display:block;

      margin-top:5px;

      font-size:10px;

      color:#627b98;

    }

    /* =====================================================
       STATUS BADGE
    ===================================================== */

    .hsm-gps-badge {

      display:inline-flex;

      align-items:center;

      gap:6px;

      padding:8px 10px;

      border-radius:20px;

      background:#d4deea;

      color:#52657d;

      font-size:10px;

      font-weight:900;

      white-space:nowrap;

    }

    .hsm-gps-badge::before {

      content:"";

      width:7px;

      height:7px;

      border-radius:50%;

      background:currentColor;

    }

    .hsm-gps-badge.active {

      background:#d8f3e3;

      color:#17834d;

    }

    .hsm-gps-badge.error {

      background:#fde5e5;

      color:#b42318;

    }

    /* =====================================================
       DESCRIPTION
    ===================================================== */

    .hsm-gps-description {

      margin:0 0 18px;

      color:#58718d;

      font-size:12px;

      line-height:1.8;

    }

    /* =====================================================
       INFORMATION
    ===================================================== */

    .hsm-gps-info {

      margin-bottom:15px;

      overflow:hidden;

      border:1px solid #c3d5e8;

      border-radius:13px;

      background:#eaf2fb;

    }

    .hsm-gps-row {

      display:flex;

      justify-content:space-between;

      align-items:center;

      gap:12px;

      padding:12px 13px;

      border-bottom:1px solid #cfdeee;

      font-size:11px;

    }

    .hsm-gps-row:last-child {

      border-bottom:0;

    }

    .hsm-gps-row span {

      color:#667d98;

    }

    .hsm-gps-row strong {

      color:#071e42;

      text-align:right;

      overflow-wrap:anywhere;

    }

    /* =====================================================
       STATUS MESSAGE
    ===================================================== */

    .hsm-gps-status {

      display:flex;

      align-items:flex-start;

      gap:9px;

      margin-bottom:16px;

      padding:13px;

      border-radius:12px;

      background:#dceafb;

      color:#315a89;

      font-size:11px;

      line-height:1.7;

    }

    .hsm-gps-status svg {

      flex-shrink:0;

      margin-top:1px;

    }

    .hsm-gps-status.success {

      background:#dff5e9;

      color:#176c40;

    }

    .hsm-gps-status.error {

      background:#fbe6e6;

      color:#a52b23;

    }

    /* =====================================================
       ACTION BUTTONS
    ===================================================== */

    .hsm-gps-buttons {

      display:grid;

      grid-template-columns:1fr 1fr;

      gap:9px;

    }

    .hsm-gps-button {

      min-height:47px;

      display:flex;

      align-items:center;

      justify-content:center;

      gap:7px;

      padding:10px 9px;

      border:0;

      border-radius:11px;

      font-size:11px;

      font-weight:850;

      line-height:1.4;

    }

    .hsm-gps-button.start {

      background:
        linear-gradient(
          120deg,
          #0754a6,
          #0b2a55
        );

      color:white;

    }

    .hsm-gps-button.stop {

      background:#e8eef6;

      color:#92362d;

      border:1px solid #c8d4e1;

    }

    .hsm-gps-button:disabled {

      opacity:.5;

      cursor:not-allowed;

    }

    /* =====================================================
       NOTICE
    ===================================================== */

    .hsm-gps-notice {

      display:flex;

      align-items:flex-start;

      gap:8px;

      margin-top:15px;

      padding-top:14px;

      border-top:1px solid #c6d8e9;

      color:#6a829e;

      font-size:10px;

      line-height:1.7;

    }

    .hsm-gps-notice svg {

      flex-shrink:0;

      margin-top:2px;

    }

    /* =====================================================
       MOBILE
    ===================================================== */

    @media(max-width:370px) {

      .hsm-gps-card {

        padding:15px;

      }

      .hsm-gps-heading h2 {

        font-size:14px;

      }

      .hsm-gps-button {

        font-size:10px;

      }

      .hsm-gps-badge {

        font-size:9px;

        padding:7px 8px;

      }

    }

  `;

  document.head.appendChild(style);

  /* ========================================================
     7. TANGGAL WIT
  ======================================================== */

  function todayWIT() {

    const parts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:WIT_TIMEZONE,

          year:"numeric",

          month:"2-digit",

          day:"2-digit"
        }
      ).formatToParts(
        new Date()
      );

    const values = {};

    parts.forEach(part => {

      values[part.type] =
        part.value;

    });

    return (
      values.year +
      "-" +
      values.month +
      "-" +
      values.day
    );

  }

  /* ========================================================
     8. FORMAT WAKTU WIT
  ======================================================== */

  function formatWIT(
    timestamp
  ) {

    if (!timestamp) {
      return "Belum tersedia";
    }

    const date =
      new Date(timestamp);

    if (
      !Number.isFinite(
        date.getTime()
      )
    ) {

      return "Belum tersedia";

    }

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone:WIT_TIMEZONE,

        day:"2-digit",

        month:"short",

        hour:"2-digit",

        minute:"2-digit",

        hour12:false
      }
    ).format(date) + " WIT";

  }

  /* ========================================================
     9. SESI PETUGAS
  ======================================================== */

  function isDashboardOpen() {

    return (
      getComputedStyle(
        dashboard
      ).display !== "none"
    );

  }

  function getSessionToken() {

    const token =
      localStorage.getItem(
        TOKEN_KEY
      );

    const loginDate =
      localStorage.getItem(
        LOGIN_DATE_KEY
      );

    if (!token) {
      return null;
    }

    if (
      loginDate !==
      todayWIT()
    ) {

      return null;

    }

    if (
      !isDashboardOpen()
    ) {

      return null;

    }

    return token;

  }

  /* ========================================================
     10. NATIVE BRIDGE
  ======================================================== */

  function getNative() {

    if (
      window.HSMGPS &&
      typeof window.HSMGPS.start === "function" &&
      typeof window.HSMGPS.stop === "function"
    ) {

      return window.HSMGPS;

    }

    return null;

  }

  /* ========================================================
     11. UI
  ======================================================== */

  const panel =
    document.createElement("section");

  panel.id =
    "hsmGpsPanel";

  panel.className =
    "hsm-gps-card";

  panel.innerHTML = `

    <div class="hsm-gps-heading">

      <div class="hsm-gps-heading-left">

        <div class="hsm-gps-icon">

          ${icon("location", 25)}

        </div>

        <div>

          <h2>
            Live Tracking GPS
          </h2>

          <small>
            HSM INTERNAL • LOKASI OPERASIONAL
          </small>

        </div>

      </div>

      <span
        id="hsmGpsBadge"
        class="hsm-gps-badge"
      >
        NONAKTIF
      </span>

    </div>


    <p class="hsm-gps-description">

      Bagikan lokasi selama bertugas agar
      HSM Owner dapat melihat posisi
      operasional sopir dan kernet.

      Pelacakan dapat berjalan saat
      aplikasi diminimalkan atau
      layar HP terkunci.

      Android akan menampilkan notifikasi
      selama pelacakan berlangsung.

    </p>


    <div class="hsm-gps-info">

      <div class="hsm-gps-row">

        <span>
          Petugas
        </span>

        <strong id="hsmGpsName">
          -
        </strong>

      </div>


      <div class="hsm-gps-row">

        <span>
          Jabatan
        </span>

        <strong id="hsmGpsRole">
          -
        </strong>

      </div>


      <div class="hsm-gps-row">

        <span>
          Armada
        </span>

        <strong id="hsmGpsVehicle">
          -
        </strong>

      </div>


      <div class="hsm-gps-row">

        <span>
          Lokasi Terakhir Terkirim
        </span>

        <strong id="hsmGpsLastSent">
          Belum tersedia
        </strong>

      </div>

    </div>


    <div
      id="hsmGpsStatus"
      class="hsm-gps-status"
      role="status"
      aria-live="polite"
    >

      ${icon("satellite", 19)}

      <span id="hsmGpsStatusText">

        GPS belum aktif.
        Aktifkan saat mulai bertugas.

      </span>

    </div>


    <div class="hsm-gps-buttons">

      <button
        type="button"
        id="hsmGpsStart"
        class="hsm-gps-button start"
      >

        ${icon("location", 17)}

        Mulai Berbagi

      </button>


      <button
        type="button"
        id="hsmGpsStop"
        class="hsm-gps-button stop"
      >

        ${icon("power", 17)}

        Hentikan GPS

      </button>

    </div>


    <div class="hsm-gps-notice">

      ${icon("shield", 17)}

      <span>

        GPS hanya dibagikan saat fitur
        ini diaktifkan untuk keperluan kerja.

        Berbagi lokasi dapat dihentikan
        melalui tombol di atas atau logout.

        Target pembaruan sekitar 30 detik,
        tergantung GPS, jaringan, dan Android.

      </span>

    </div>

  `;

  /* ========================================================
     12. PASANG PANEL
  ======================================================== */

  let mounted = false;

  function mountPanel() {

    if (mounted) {
      return true;
    }

    const accountPage =
      $gps(
        "hsmPremiumPage-account"
      );

    const target =
      accountPage ||
      dashboard;

    if (!target) {
      return false;
    }

    target.insertBefore(
      panel,
      target.firstChild
    );

    mounted = true;

    return true;

  }

  /* ========================================================
     13. STATUS MESSAGE
  ======================================================== */

  function setStatus(
    message,
    type = ""
  ) {

    const container =
      $gps("hsmGpsStatus");

    const text =
      $gps("hsmGpsStatusText");

    if (container) {

      container.className =
        "hsm-gps-status" +
        (
          type
            ? " " + type
            : ""
        );

    }

    if (text) {

      text.textContent =
        message;

    }

  }

  /* ========================================================
     14. STATUS BADGE
  ======================================================== */

  function setBadge(
    state
  ) {

    const badge =
      $gps("hsmGpsBadge");

    if (!badge) {
      return;
    }

    badge.className =
      "hsm-gps-badge";

    if (state === "active") {

      badge.classList.add(
        "active"
      );

      badge.textContent =
        "GPS AKTIF";

    } else if (
      state === "error"
    ) {

      badge.classList.add(
        "error"
      );

      badge.textContent =
        "GANGGUAN";

    } else {

      badge.textContent =
        "NONAKTIF";

    }

  }

  /* ========================================================
     15. IDENTITAS PETUGAS
  ======================================================== */

  function updateProfile() {

    const name =
      $gps("infoName")?.textContent ||
      "-";

    const role =
      $gps("infoRole")?.textContent ||
      "-";

    const vehicle =
      $gps("infoVehicle")?.textContent ||
      "-";

    const nameOutput =
      $gps("hsmGpsName");

    const roleOutput =
      $gps("hsmGpsRole");

    const vehicleOutput =
      $gps("hsmGpsVehicle");

    if (nameOutput) {

      nameOutput.textContent =
        name;

    }

    if (roleOutput) {

      roleOutput.textContent =
        role;

    }

    if (vehicleOutput) {

      vehicleOutput.textContent =
        vehicle;

    }

  }

  /* ========================================================
     16. ENABLE / DISABLE BUTTON
  ======================================================== */

  function updateButtons(
    active
  ) {

    const start =
      $gps("hsmGpsStart");

    const stop =
      $gps("hsmGpsStop");

    if (start) {

      start.disabled =
        active;

    }

    if (stop) {

      stop.disabled =
        !active;

    }

  }

  /* ========================================================
     17. STOP NATIVE
  ======================================================== */

  function stopNative() {

    const native =
      getNative();

    if (!native) {
      return;
    }

    try {

      native.stop();

    } catch (error) {

      console.error(
        "HSM GPS STOP:",
        error
      );

    }

  }

  /* ========================================================
     18. MULAI TRACKING
  ======================================================== */

  function startTracking() {

    const token =
      getSessionToken();

    if (!token) {

      setStatus(
        "Sesi petugas tidak aktif. Silakan login kembali.",
        "error"
      );

      return;

    }

    const native =
      getNative();

    if (!native) {

      setStatus(
        "Fitur GPS Android tidak tersedia. Perbarui APK HSM Internal.",
        "error"
      );

      return;

    }

    const confirmed =
      window.confirm(

        "AKTIFKAN LIVE TRACKING HSM?\n\n" +

        "Nama petugas dan koordinat GPS " +
        "akan dibagikan kepada sistem HSM Transport " +
        "selama pelacakan aktif.\n\n" +

        "Owner dapat melihat lokasi operasional Anda.\n\n" +

        "Android akan menampilkan notifikasi " +
        "selama GPS aktif, termasuk saat layar terkunci.\n\n" +

        "Pelacakan dapat dihentikan melalui " +
        "tombol Hentikan GPS atau logout.\n\n" +

        "Lanjutkan?"

      );

    if (!confirmed) {
      return;
    }

    try {

      native.start(
        token,
        todayWIT()
      );

      setStatus(
        "Meminta izin lokasi dan memulai layanan GPS Android..."
      );

      setTimeout(
        refreshStatus,
        1000
      );

    } catch (error) {

      setStatus(
        "Tidak dapat memulai GPS: " +
        error.message,
        "error"
      );

    }

  }

  /* ========================================================
     19. BERHENTI TRACKING
  ======================================================== */

  function stopTracking() {

    const confirmed =
      window.confirm(

        "Hentikan berbagi lokasi sekarang?\n\n" +

        "Setelah dihentikan, HSM Owner tidak " +
        "menerima pembaruan GPS sampai fitur " +
        "diaktifkan kembali."

      );

    if (!confirmed) {
      return;
    }

    stopNative();

    setBadge(
      "inactive"
    );

    setStatus(
      "Berbagi lokasi telah dihentikan."
    );

    updateButtons(
      false
    );

    setTimeout(
      refreshStatus,
      300
    );

  }

  /* ========================================================
     20. BACA STATUS NATIVE
  ======================================================== */

  function readNativeStatus() {

    const native =
      getNative();

    if (
      !native ||
      typeof native.status !==
        "function"
    ) {

      return {
        active:false,
        lastSent:null,
        error:"Native GPS tidak tersedia."
      };

    }

    try {

      const raw =
        native.status();

      const result =
        JSON.parse(
          raw || "{}"
        );

      return {

        active:
          result.active === true,

        lastSent:
          result.lastSent || null,

        error:
          String(
            result.error || ""
          )

      };

    } catch (error) {

      console.error(
        "HSM GPS STATUS:",
        error
      );

      return {

        active:false,

        lastSent:null,

        error:
          "Status GPS tidak dapat dibaca."

      };

    }

  }

  /* ========================================================
     21. REFRESH STATUS
  ======================================================== */

  function refreshStatus() {

    if (!mountPanel()) {
      return;
    }

    updateProfile();

    const token =
      getSessionToken();

    /*
      Jika dashboard tidak login atau
      tanggal sesi sudah berakhir,
      layanan native harus dihentikan.
    */

    if (!token) {

      stopNative();

      setBadge(
        "inactive"
      );

      setStatus(
        "GPS tidak aktif. Login petugas diperlukan."
      );

      updateButtons(
        false
      );

      const output =
        $gps("hsmGpsLastSent");

      if (output) {

        output.textContent =
          "Belum tersedia";

      }

      return;

    }

    const status =
      readNativeStatus();

    const lastSent =
      $gps("hsmGpsLastSent");

    if (lastSent) {

      lastSent.textContent =
        formatWIT(
          status.lastSent
        );

    }

    if (status.active) {

      setBadge(
        "active"
      );

      updateButtons(
        true
      );

      if (status.error) {

        setStatus(
          "GPS aktif, tetapi terdapat kendala: " +
          status.error,
          "error"
        );

      } else {

        setStatus(
          status.lastSent
            ? "Berbagi lokasi aktif. Pembaruan terakhir berhasil dikirim ke server."
            : "Berbagi lokasi aktif. Menunggu pembacaan GPS pertama.",
          "success"
        );

      }

    } else if (
      status.error
    ) {

      setBadge(
        "error"
      );

      setStatus(
        status.error,
        "error"
      );

      updateButtons(
        false
      );

    } else {

      setBadge(
        "inactive"
      );

      setStatus(
        "GPS belum aktif. Tekan Mulai Berbagi saat mulai bertugas."
      );

      updateButtons(
        false
      );

    }

  }

  /* ========================================================
     22. EVENT BUTTONS
  ======================================================== */

  panel.querySelector(
    "#hsmGpsStart"
  )?.addEventListener(
    "click",
    startTracking
  );

  panel.querySelector(
    "#hsmGpsStop"
  )?.addEventListener(
    "click",
    stopTracking
  );

  /* ========================================================
     23. LOGOUT
  ======================================================== */

  /*
    Petugas logout menggunakan
    tombol logoutBtn asli.

    Stop listener ditempatkan pada capture
    agar layanan GPS dihentikan sebelum
    sistem login membersihkan token lokal.
  */

  if (logoutBtn) {

    logoutBtn.addEventListener(
      "click",
      () => {

        stopNative();

      },
      {
        capture:true
      }
    );

  }

  /* ========================================================
     24. AMATI PERUBAHAN LOGIN
  ======================================================== */

  const dashboardObserver =
    new MutationObserver(
      () => {

        const visible =
          isDashboardOpen();

        if (!visible) {

          stopNative();

        }

        refreshStatus();

      }
    );

  dashboardObserver.observe(
    dashboard,
    {
      attributes:true,
      attributeFilter:[
        "style"
      ]
    }
  );

  /* ========================================================
     25. AUTO REFRESH STATUS
  ======================================================== */

  setInterval(
    refreshStatus,
    STATUS_INTERVAL
  );

  /* ========================================================
     26. VISIBILITY CHANGE
  ======================================================== */

  document.addEventListener(
    "visibilitychange",
    () => {

      if (!document.hidden) {

        refreshStatus();

      }

    }
  );

  /* ========================================================
     27. PAGE SHOW
  ======================================================== */

  window.addEventListener(
    "pageshow",
    refreshStatus
  );

  /* ========================================================
     28. PROFILE OBSERVER
  ======================================================== */

  [
    "infoName",
    "infoRole",
    "infoVehicle"
  ].forEach(id => {

    const element =
      $gps(id);

    if (!element) {
      return;
    }

    new MutationObserver(
      updateProfile
    ).observe(
      element,
      {
        childList:true,
        characterData:true,
        subtree:true
      }
    );

  });

  /* ========================================================
     29. INITIALIZATION
  ======================================================== */

  mountPanel();

  updateProfile();

  refreshStatus();

  console.log(
    "HSM GPS PREMIUM: Siap."
  );

})();
