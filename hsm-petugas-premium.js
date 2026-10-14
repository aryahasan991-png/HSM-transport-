/*
============================================================
HSM TRANSPORT
PT HIDAYAH SARANA MULIA

HSM INTERNAL - PREMIUM NAVY
SOPIR & KERNET

FITUR:
- Desain mengikuti HSM Owner
- Ikon SVG profesional
- Navigasi bawah 5 menu
- Beranda dengan statistik langsung
- Scanner QR tetap menggunakan sistem asli
- Perjalanan tetap menggunakan sistem asli
- Manifest tetap menggunakan sistem asli
- Login, PIN, dan sesi tidak diubah
- Kompatibel Android dan iPhone

PENTING:
File ini hanya mengubah tampilan dan susunan DOM.
Tidak mengganti API atau fungsi bisnis petugas.
============================================================
*/

(function () {
  "use strict";

  if (window.HSM_PETUGAS_PREMIUM_READY) return;

  const $p = id => document.getElementById(id);

  const dashboard = $p("dashboard");
  const header = document.querySelector(".header");
  const authCard = $p("authCard");

  if (!dashboard || !header || !authCard) {
    console.error("HSM PREMIUM: Elemen utama tidak ditemukan.");
    return;
  }

  window.HSM_PETUGAS_PREMIUM_READY = true;

  /* ========================================================
     IKON SVG
  ======================================================== */

  const icons = {
    home: `
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
      <path d="M9 21v-8h6v8"/>
    `,

    scan: `
      <path d="M4 9V5a1 1 0 0 1 1-1h4"/>
      <path d="M15 4h4a1 1 0 0 1 1 1v4"/>
      <path d="M20 15v4a1 1 0 0 1-1 1h-4"/>
      <path d="M9 20H5a1 1 0 0 1-1-1v-4"/>
      <rect x="8" y="8" width="3" height="3" rx=".3"/>
      <rect x="13" y="8" width="3" height="3" rx=".3"/>
      <rect x="8" y="13" width="3" height="3" rx=".3"/>
      <path d="M13 13h3v3h-3"/>
    `,

    trip: `
      <rect x="3" y="7" width="18" height="12" rx="3"/>
      <path d="M6 7V4h12v3"/>
      <path d="M3 12h18"/>
      <path d="M7 19v2m10-2v2"/>
      <path d="M7 15h2m6 0h2"/>
    `,

    manifest: `
      <rect x="5" y="4" width="14" height="17" rx="2"/>
      <path d="M9 4.5V3h6v1.5"/>
      <path d="m8.5 10 1.5 1.5 2-2"/>
      <path d="M14 10.5h2"/>
      <path d="m8.5 16 1.5 1.5 2-2"/>
      <path d="M14 16.5h2"/>
    `,

    account: `
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21v-2a8 8 0 0 1 16 0v2"/>
    `,

    refresh: `
      <path d="M20 7v5h-5"/>
      <path d="M4 17v-5h5"/>
      <path d="M5 9a8 8 0 0 1 14-2l1 5"/>
      <path d="M19 15a8 8 0 0 1-14 2l-1-5"/>
    `
  };

  function icon(name, size = 23) {
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
     PREMIUM CSS
  ======================================================== */

  const style = document.createElement("style");

  style.id = "hsmPremiumStyles";

  style.textContent = `

    :root {
      --blue:#0754a6;
      --dark:#071e42;
      --navy:#071e42;
      --navy2:#0b2a55;
      --navy3:#123a70;

      --bg:#dfe8f2;
      --surface:#eaf1f8;
      --surface2:#d4e2f0;

      --text:#142844;
      --muted:#687e98;
      --border:#bfd0e3;

      --green:#17834d;
      --orange:#b76a0b;
    }

    * {
      box-sizing:border-box;
    }

    body {
      background:#dfe8f2;
      color:#142844;

      font-family:
        system-ui,
        -apple-system,
        "Segoe UI",
        sans-serif;

      -webkit-tap-highlight-color:transparent;
    }

    button,
    input {
      font-family:inherit;
    }

    /* =====================================================
       HEADER
    ===================================================== */

    .header {
      position:relative;
      overflow:hidden;

      min-height:170px;

      padding:
        calc(18px + env(safe-area-inset-top))
        17px
        30px;

      text-align:left;

      background:
        radial-gradient(
          circle at 95% 10%,
          #185cac 0%,
          transparent 44%
        ),
        linear-gradient(
          115deg,
          #061936,
          #0b3975
        );

      border-radius:0 0 23px 23px;
    }

    .header::before {
      content:"";

      position:absolute;
      right:-75px;
      top:-60px;

      width:180px;
      height:180px;

      border:24px solid #ffffff08;
      border-radius:50%;

      pointer-events:none;
    }

    .header > .logo,
    .header > .logo-sub,
    .header > h1,
    .header > p {
      display:none;
    }

    .hsm-premium-brand {
      position:relative;
      z-index:1;

      display:flex;
      align-items:center;
      gap:11px;
    }

    .hsm-premium-logo {
      width:49px;
      height:49px;

      display:grid;
      place-items:center;

      flex-shrink:0;

      padding:5px;

      border-radius:13px;

      background:white;

      box-shadow:0 6px 15px #0002;
    }

    .hsm-premium-logo img {
      width:100%;
      height:100%;
      object-fit:contain;
    }

    .hsm-premium-brand strong {
      display:block;

      color:white;

      font-size:15px;
      font-weight:900;

      letter-spacing:.4px;
    }

    .hsm-premium-brand small {
      display:block;

      margin-top:5px;

      color:#c2ddfb;

      font-size:9px;
    }

    .hsm-premium-heading {
      position:relative;
      z-index:1;

      margin-top:25px;
    }

    .hsm-premium-heading small {
      color:#bdd9fb;

      font-size:10px;

      letter-spacing:.6px;
    }

    .hsm-premium-heading h1 {
      margin:6px 0;

      color:white;

      font-size:23px;
      font-weight:900;
    }

    .hsm-premium-heading p {
      margin:0;

      color:#c8dffa;

      font-size:11px;
    }

    /* =====================================================
       KONTAINER
    ===================================================== */

    .container {
      width:min(1050px,100%);

      margin:-12px auto 0;

      padding:
        0 12px
        calc(105px + env(safe-area-inset-bottom));

      position:relative;
    }

    #authCard {
      max-width:450px;

      margin:0 auto;

      position:relative;
      z-index:2;
    }

    #dashboard {
      position:relative;
      z-index:2;

      padding:0;

      background:transparent;

      border:0;
      border-radius:0;

      box-shadow:none;
    }

    .hsm-premium-page {
      display:none;
    }

    .hsm-premium-page.active {
      display:block;

      animation:hsmPremiumFade .2s ease;
    }

    @keyframes hsmPremiumFade {
      from {
        opacity:.5;
        transform:translateY(6px);
      }

      to {
        opacity:1;
        transform:translateY(0);
      }
    }

    /* =====================================================
       KARTU PREMIUM
    ===================================================== */

    .hsm-premium-card {
      padding:17px;

      margin-bottom:13px;

      border:1px solid #c7d8e9;
      border-radius:18px;

      background:
        linear-gradient(
          145deg,
          #e8f1fa,
          #d9e7f5
        );

      box-shadow:
        0 8px 24px rgba(6,30,66,.09);
    }

    .hsm-premium-title {
      margin:0 0 13px;

      color:#071e42;

      font-size:17px;
      font-weight:900;
    }

    /* =====================================================
       BERANDA
    ===================================================== */

    .hsm-home-hero {
      position:relative;
      overflow:hidden;

      padding:21px;

      margin-bottom:13px;

      color:white;

      border-radius:19px;

      background:
        radial-gradient(
          circle at 100% 0%,
          #ffffff18 0%,
          transparent 48%
        ),
        linear-gradient(
          125deg,
          #082653,
          #0e4c99
        );
    }

    .hsm-home-hero::after {
      content:"";

      position:absolute;

      right:-35px;
      bottom:-55px;

      width:140px;
      height:140px;

      border:20px solid #ffffff08;
      border-radius:50%;

      pointer-events:none;
    }

    .hsm-home-hero small {
      color:#cde5ff;
      font-size:11px;
    }

    .hsm-home-hero h2 {
      margin:10px 0;

      color:white;

      font-size:24px;
      font-weight:900;
    }

    .hsm-home-hero p {
      margin:7px 0;

      color:#d5e8ff;
      font-size:12px;
    }

    .hsm-home-hero .badge {
      margin-top:10px;
    }

    .hsm-home-grid {
      display:grid;

      grid-template-columns:
        repeat(2,minmax(0,1fr));

      gap:9px;
      margin-bottom:16px;
    }

    .hsm-home-metric {
      min-width:0;

      padding:15px;

      border:1px solid #c3d4e6;
      border-radius:15px;

      background:
        linear-gradient(
          145deg,
          #e9f1fa,
          #cedff0
        );
    }

    .hsm-home-metric:nth-child(2) {
      background:
        linear-gradient(
          145deg,
          #d9e9f9,
          #c0d8f0
        );
    }

    .hsm-home-metric strong {
      display:block;

      color:#071e42;

      font-size:25px;
      font-weight:900;
    }

    .hsm-home-metric span {
      display:block;

      margin-top:7px;

      color:#56708d;

      font-size:11px;
    }

    /* =====================================================
       AKSES CEPAT
    ===================================================== */

    .hsm-quick-grid {
      display:grid;

      grid-template-columns:
        repeat(4,minmax(0,1fr));

      gap:8px;
    }

    .hsm-quick-button {
      min-height:83px;

      padding:11px 4px;

      display:grid;
      justify-items:center;
      align-content:center;

      gap:8px;

      border:1px solid #bdcfe3;
      border-radius:14px;

      background:
        linear-gradient(
          155deg,
          #d5e6f7,
          #c4d9ef
        );

      color:#0b2a55;

      font-size:10px;
      font-weight:800;
    }

    .hsm-quick-button svg {
      width:25px;
      height:25px;
    }

    /* =====================================================
       FORM
    ===================================================== */

    input {
      background:#f8fbff;
      color:#142844;

      border:1px solid #bdd0e5;
      border-radius:12px;
    }

    .btn,
    .scan-btn,
    .action-btn.depart {
      background:
        linear-gradient(
          120deg,
          #0754a6,
          #0b2a55
        );

      color:white;
      border-radius:12px;
    }

    .btn-outline,
    .feedback-btn,
    .refresh-btn {
      background:#e7f0fb;

      color:#0b2a55;

      border:1px solid #bdd0e5;
    }

    .hsm-premium-page .section {
      margin:0;

      padding:0;

      border-top:0;
    }

    .hsm-premium-page .section-heading h2 {
      color:#071e42;
      font-size:17px;
    }

    /* =====================================================
       PERJALANAN
    ===================================================== */

    .trip-card {
      padding:15px;

      border:1px solid #c7d8e8;
      border-radius:16px;

      background:
        linear-gradient(
          145deg,
          #eaf2fa,
          #dae7f4
        );
    }

    .stop-list {
      border-color:#c7d8e8;
    }

    .stop-item {
      background:#edf4fb;
      border-color:#c7d8e8;
    }

    .stop-item.done {
      background:#ddf2e7;
    }

    .stop-item.current {
      background:#d8eaff;
    }

    .trip-note,
    .manifest-note,
    .notice {
      background:#d2e4f6;

      color:#426182;

      border-radius:12px;
    }

    /* =====================================================
       SCANNER
    ===================================================== */

    .scanner-panel {
      border:1px solid #225182;

      box-shadow:
        0 8px 25px #071e4220;
    }

    .scanner-top,
    .scanner-instruction {
      background:#071e42;
    }

    .scan-state {
      background:#d5e7f8;
      color:#0754a6;
    }

    .qr-result {
      background:#e6f6ed;
    }

    /* =====================================================
       MANIFEST
    ===================================================== */

    .stats {
      grid-template-columns:
        repeat(4,minmax(0,1fr));
    }

    .stat {
      border:1px solid #c3d4e6;
      border-radius:13px;

      background:
        linear-gradient(
          145deg,
          #e9f1fa,
          #cedff0
        );
    }

    .manifest-trip-title {
      background:#d4e6fa;

      color:#071e42;

      border-radius:12px;
    }

    .passenger-card {
      border:1px solid #c7d8e8;
      border-radius:15px;

      background:
        linear-gradient(
          145deg,
          #eaf2fa,
          #dbe8f5
        );
    }

    .passenger-card.is-boarded {
      background:#e0f4e9;
    }

    .passenger-card.is-no-show {
      background:#fae7e8;
    }

    .pickup-heading {
      background:#d5e5f5;
    }

    /* =====================================================
       PROFIL
    ===================================================== */

    .welcome {
      padding:10px 0 20px;
    }

    .info {
      background:#e0ebf7;
      border-color:#c3d4e6;
    }

    .info-row {
      border-color:#c3d4e6;
    }

    /* =====================================================
       NAVIGASI BAWAH
    ===================================================== */

    .hsm-premium-nav {
      position:fixed;

      z-index:100;

      bottom:0;
      left:50%;

      transform:translateX(-50%);

      width:min(1050px,100%);

      display:none;

      grid-template-columns:
        repeat(5,minmax(0,1fr));

      padding:
        7px 5px
        calc(7px + env(safe-area-inset-bottom));

      background:
        linear-gradient(
          120deg,
          #06162f,
          #0c2b55
        );

      border-top:1px solid #275080;

      box-shadow:
        0 -5px 22px #071b3b25;
    }

    .hsm-premium-nav.visible {
      display:grid;
    }

    .hsm-premium-nav button {
      min-height:52px;

      padding:6px 1px;

      display:grid;
      justify-items:center;
      align-content:center;

      gap:4px;

      border:0;
      border-radius:11px;

      background:transparent;

      color:#91aecf;

      font-size:9px;
      font-weight:800;
    }

    .hsm-premium-nav button.active {
      background:#1b4c88;
      color:white;
    }

    .hsm-premium-nav button svg {
      width:22px;
      height:22px;
    }

    /* =====================================================
       RESPONSIVE
    ===================================================== */

    @media(max-width:450px) {

      .container {
        padding-left:10px;
        padding-right:10px;
      }

      .hsm-premium-card {
        padding:14px;
      }

      .hsm-home-hero {
        padding:19px;
      }

      .hsm-home-hero h2 {
        font-size:21px;
      }

      .hsm-quick-button {
        min-height:78px;
        font-size:9px;
      }

      .stat {
        padding:10px 4px;
      }

      .stat strong {
        font-size:19px;
      }

      .stat span {
        font-size:9px;
      }
    }

    @media(min-width:750px) {

      .container {
        padding-left:22px;
        padding-right:22px;
      }

      .hsm-home-grid {
        grid-template-columns:
          repeat(4,minmax(0,1fr));
      }
    }

  `;

  document.head.appendChild(style);

  /* ========================================================
     HEADER PREMIUM
  ======================================================== */

  const brand = document.createElement("div");

  brand.className = "hsm-premium-brand";

  brand.innerHTML = `
    <div class="hsm-premium-logo">
      <img
        src="hsm-logo.png"
        alt="Logo HSM Transport"
      >
    </div>

    <div>
      <strong>HSM INTERNAL</strong>
      <small>PT HIDAYAH SARANA MULIA</small>
    </div>
  `;

  const heading = document.createElement("div");

  heading.className = "hsm-premium-heading";

  heading.innerHTML = `
    <small>STAFF CONTROL CENTER</small>

    <h1 id="hsmPremiumScreenTitle">
      Portal Petugas
    </h1>

    <p id="hsmPremiumDate">-</p>
  `;

  header.append(brand, heading);

  /* ========================================================
     HALAMAN
  ======================================================== */

  const pages = {};

  [
    "home",
    "scan",
    "trip",
    "manifest",
    "account"
  ].forEach(name => {

    const section = document.createElement("section");

    section.id = "hsmPremiumPage-" + name;
    section.className = "hsm-premium-page";

    dashboard.appendChild(section);

    pages[name] = section;

  });

  /* ========================================================
     AMBIL ELEMEN LAMA
  ======================================================== */

  const welcome = dashboard.querySelector(".welcome");
  const info = dashboard.querySelector(".info");
  const notice = dashboard.querySelector(".notice");
  const toolbar = dashboard.querySelector(".toolbar");

  const originalSections = Array.from(
    dashboard.querySelectorAll(":scope > .section")
  );

  const tripSection = originalSections[0];
  const scanSection = originalSections[1];
  const manifestSection = originalSections[2];

  const logoutBtn = $p("logoutBtn");

  /* ========================================================
     BERANDA
  ======================================================== */

  const hero = document.createElement("div");

  hero.className = "hsm-home-hero";

  hero.innerHTML = `
    <small>SELAMAT DATANG</small>

    <h2 id="hsmHomeName">
      Petugas HSM
    </h2>

    <p id="hsmHomeRole">-</p>

    <p id="hsmHomeVehicle">
      Armada -
    </p>

    <span class="badge">
      ● Akun Aktif
    </span>
  `;

  const homeStats = document.createElement("div");

  homeStats.className = "hsm-home-grid";

  homeStats.innerHTML = `
    <div class="hsm-home-metric">
      <strong id="hsmHomeTotal">0</strong>
      <span>Total Penumpang</span>
    </div>

    <div class="hsm-home-metric">
      <strong id="hsmHomeBoarded">0</strong>
      <span>Sudah Naik</span>
    </div>

    <div class="hsm-home-metric">
      <strong id="hsmHomePending">0</strong>
      <span>Belum Naik</span>
    </div>

    <div class="hsm-home-metric">
      <strong id="hsmHomeNoShow">0</strong>
      <span>Tidak Hadir</span>
    </div>
  `;

  pages.home.append(hero, homeStats);

  /* ========================================================
     TANGGAL OPERASIONAL
  ======================================================== */

  if (toolbar) {

    const dateCard = document.createElement("div");

    dateCard.className = "hsm-premium-card";

    const title = document.createElement("h2");

    title.className = "hsm-premium-title";
    title.textContent = "Tanggal Operasional";

    dateCard.appendChild(title);
    dateCard.appendChild(toolbar);

    pages.home.appendChild(dateCard);
  }

  /* ========================================================
     AKSES CEPAT
  ======================================================== */

  const quickCard = document.createElement("div");

  quickCard.className = "hsm-premium-card";

  quickCard.innerHTML = `
    <h2 class="hsm-premium-title">
      Akses Cepat
    </h2>

    <div class="hsm-quick-grid">

      <button
        class="hsm-quick-button"
        type="button"
        data-premium-go="scan"
      >
        ${icon("scan", 25)}
        <span>Scan QR</span>
      </button>

      <button
        class="hsm-quick-button"
        type="button"
        data-premium-go="trip"
      >
        ${icon("trip", 25)}
        <span>Perjalanan</span>
      </button>

      <button
        class="hsm-quick-button"
        type="button"
        data-premium-go="manifest"
      >
        ${icon("manifest", 25)}
        <span>Manifest</span>
      </button>

      <button
        class="hsm-quick-button"
        type="button"
        data-premium-go="account"
      >
        ${icon("account", 25)}
        <span>Akun</span>
      </button>

    </div>
  `;

  pages.home.appendChild(quickCard);

  /* ========================================================
     INFORMASI OPERASIONAL
  ======================================================== */

  if (notice) {

    const card = document.createElement("div");

    card.className = "hsm-premium-card";

    const title = document.createElement("h2");

    title.className = "hsm-premium-title";
    title.textContent = "Informasi Operasional";

    card.appendChild(title);
    card.appendChild(notice);

    pages.home.appendChild(card);
  }

  /* ========================================================
     PINDAHKAN MODUL ASLI

     appendChild memindahkan elemen tanpa
     menghapus event listener yang terpasang.
  ======================================================== */

  function moveModule(section, target) {

    if (!section) return;

    const wrapper = document.createElement("div");

    wrapper.className = "hsm-premium-card";

    wrapper.appendChild(section);

    target.appendChild(wrapper);
  }

  moveModule(scanSection, pages.scan);
  moveModule(tripSection, pages.trip);
  moveModule(manifestSection, pages.manifest);

  /* ========================================================
     HALAMAN AKUN
  ======================================================== */

  const accountCard = document.createElement("div");

  accountCard.className = "hsm-premium-card";

  const accountTitle = document.createElement("h2");

  accountTitle.className = "hsm-premium-title";
  accountTitle.textContent = "Profil Petugas";

  accountCard.appendChild(accountTitle);

  if (welcome) {
    accountCard.appendChild(welcome);
  }

  if (info) {
    accountCard.appendChild(info);
  }

  pages.account.appendChild(accountCard);

  if (logoutBtn) {

    const logoutCard = document.createElement("div");

    logoutCard.className = "hsm-premium-card";

    logoutCard.appendChild(logoutBtn);

    pages.account.appendChild(logoutCard);
  }

  /* ========================================================
     NAVIGASI BAWAH
  ======================================================== */

  const nav = document.createElement("nav");

  nav.id = "hsmPremiumBottomNav";
  nav.className = "hsm-premium-nav";

  nav.setAttribute(
    "aria-label",
    "Navigasi HSM Internal"
  );

  const navItems = [
    ["home", "Beranda"],
    ["scan", "Scan QR"],
    ["trip", "Perjalanan"],
    ["manifest", "Manifest"],
    ["account", "Akun"]
  ];

  nav.innerHTML = navItems.map(([name, label]) => `
    <button
      type="button"
      data-premium-nav="${name}"
      ${name === "home" ? 'class="active"' : ""}
    >
      ${icon(name)}
      <span>${label}</span>
    </button>
  `).join("");

  document.body.appendChild(nav);

  /* ========================================================
     IDENTITAS PETUGAS
  ======================================================== */

  function updateProfile() {

    const name =
      $p("infoName")?.textContent || "Petugas HSM";

    const role =
      $p("infoRole")?.textContent || "-";

    const vehicle =
      $p("infoVehicle")?.textContent || "-";

    $p("hsmHomeName").textContent = name;
    $p("hsmHomeRole").textContent = role;

    $p("hsmHomeVehicle").textContent =
      "Armada " + vehicle;
  }

  /* ========================================================
     STATISTIK LANGSUNG
  ======================================================== */

  function updateHomeStats() {

    const mapping = {
      statTotal:"hsmHomeTotal",
      statBoarded:"hsmHomeBoarded",
      statPending:"hsmHomePending",
      statNoShow:"hsmHomeNoShow"
    };

    Object.entries(mapping).forEach(([source, target]) => {

      const value =
        $p(source)?.textContent || "0";

      const output = $p(target);

      if (output) {
        output.textContent = value;
      }

    });
  }

  /* ========================================================
     NAVIGASI HALAMAN
  ======================================================== */

  const screenTitles = {
    home:"Selamat Datang",
    scan:"Scan Tiket",
    trip:"Status Perjalanan",
    manifest:"Manifest Penumpang",
    account:"Profil Petugas"
  };

  let activePage = "home";

  function openPage(name) {

    if (!pages[name]) return;

    if (
      name !== "scan" &&
      activePage === "scan" &&
      typeof stopScanner === "function"
    ) {
      stopScanner(true);
    }

    activePage = name;

    Object.entries(pages).forEach(([key, page]) => {
      page.classList.toggle(
        "active",
        key === name
      );
    });

    nav.querySelectorAll(
      "[data-premium-nav]"
    ).forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.premiumNav === name
      );

    });

    $p("hsmPremiumScreenTitle").textContent =
      screenTitles[name] || "HSM Internal";

    if (name === "home") {
      updateProfile();
      updateHomeStats();
    }

    window.scrollTo({
      top:0,
      behavior:"smooth"
    });
  }

  nav.addEventListener("click", event => {

    const button = event.target.closest(
      "[data-premium-nav]"
    );

    if (!button) return;

    openPage(button.dataset.premiumNav);

  });

  dashboard.addEventListener("click", event => {

    const button = event.target.closest(
      "[data-premium-go]"
    );

    if (!button) return;

    openPage(button.dataset.premiumGo);

  });

  /* ========================================================
     PERBARUI HEADER WIT
  ======================================================== */

  function updateHeaderDate() {

    const date = new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone:"Asia/Jayapura",
        day:"numeric",
        month:"long",
        year:"numeric"
      }
    ).format(new Date());

    $p("hsmPremiumDate").textContent =
      date + " • WIT";
  }

  /* ========================================================
     PANTAU PERUBAHAN SESI
  ======================================================== */

  function syncDashboardVisibility() {

    const visible =
      getComputedStyle(dashboard).display !== "none";

    nav.classList.toggle("visible", visible);

    if (visible) {

      updateProfile();
      updateHomeStats();

    } else {

      if (typeof stopScanner === "function") {
        stopScanner(true);
      }

      openPage("home");
    }
  }

  const dashboardObserver = new MutationObserver(
    syncDashboardVisibility
  );

  dashboardObserver.observe(dashboard, {
    attributes:true,
    attributeFilter:["style"]
  });

  /* ========================================================
     AMATI PERUBAHAN STATISTIK
  ======================================================== */

  [
    "statTotal",
    "statBoarded",
    "statPending",
    "statNoShow"
  ].forEach(id => {

    const element = $p(id);

    if (!element) return;

    new MutationObserver(
      updateHomeStats
    ).observe(element, {
      childList:true,
      characterData:true,
      subtree:true
    });

  });

  /* ========================================================
     AMATI PROFIL
  ======================================================== */

  [
    "infoName",
    "infoRole",
    "infoVehicle"
  ].forEach(id => {

    const element = $p(id);

    if (!element) return;

    new MutationObserver(
      updateProfile
    ).observe(element, {
      childList:true,
      characterData:true,
      subtree:true
    });

  });

  /* ========================================================
     INISIALISASI
  ======================================================== */

  updateHeaderDate();
  updateHomeStats();

  openPage("home");

  syncDashboardVisibility();

  setInterval(updateHeaderDate, 60000);

  console.log(
    "HSM INTERNAL PREMIUM NAVY: Siap."
  );

})();
