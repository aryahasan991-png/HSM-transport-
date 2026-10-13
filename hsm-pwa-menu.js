/*
  HSM TRANSPORT
  PWA MENU KHUSUS IPHONE

  PT HIDAYAH SARANA MULIA
*/

(function () {
  "use strict";

  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const isStandalone =
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.navigator.standalone === true;

  // Menu hanya tampil di PWA iPhone.
  if (!isIOS || !isStandalone) {
    return;
  }

  const MENU_KEY = "hsm_pwa_last_menu";

  const menus = [
    {
      title: "🎫 Pesan Tiket",
      description: "Pemesanan tiket HSM Transport",
      url: "/index.html",
      key: "booking"
    },
    {
      title: "🔐 Login Admin",
      description: "Dashboard pengelolaan HSM",
      url: "/admin.html",
      key: "admin"
    },
    {
      title: "🚐 Login Sopir & Kernet",
      description: "Manifest dan scanner QR",
      url: "/petugas.html",
      key: "petugas"
    }
  ];

  const style = document.createElement("style");

  style.textContent = `
    #hsm-pwa-menu {
      margin: 20px auto 30px;
      width: calc(100% - 26px);
      max-width: 700px;
      padding: 22px;
      background: #ffffff;
      border: 1px solid #dce5f0;
      border-radius: 18px;
      box-shadow: 0 10px 30px rgba(7,84,166,.08);
      font-family: Arial, sans-serif;
    }

    #hsm-pwa-menu h2 {
      margin: 0 0 8px;
      color: #0754a6;
      font-size: 21px;
      text-align: center;
    }

    #hsm-pwa-menu p {
      margin: 0 0 20px;
      color: #64748b;
      font-size: 13px;
      line-height: 1.6;
      text-align: center;
    }

    .hsm-pwa-menu-item {
      display: block;
      margin-top: 12px;
      padding: 17px;
      border-radius: 12px;
      background: #f4f8fd;
      border: 1px solid #dce5f0;
      text-decoration: none;
      color: #172b4d;
    }

    .hsm-pwa-menu-item strong {
      display: block;
      font-size: 15px;
      color: #0754a6;
    }

    .hsm-pwa-menu-item span {
      display: block;
      margin-top: 6px;
      color: #718096;
      font-size: 12px;
    }

    .hsm-pwa-menu-item:active {
      background: #eaf2ff;
    }
  `;

  document.head.appendChild(style);

  const container = document.createElement("section");

  container.id = "hsm-pwa-menu";

  container.innerHTML = `
    <h2>Selamat Datang di HSM Transport</h2>

    <p>
      Pilih layanan yang ingin digunakan.
    </p>
  `;

  menus.forEach(menu => {
    const link = document.createElement("a");

    link.className = "hsm-pwa-menu-item";

    link.href = menu.url;

    link.innerHTML = `
      <strong>${menu.title}</strong>
      <span>${menu.description}</span>
    `;

    link.addEventListener("click", () => {
      localStorage.setItem(
        MENU_KEY,
        menu.key
      );
    });

    container.appendChild(link);
  });

  /*
    Tampilkan menu khusus PWA
    di bagian atas halaman utama.
  */

  const main = document.querySelector("main");

  if (main) {
    main.prepend(container);
  }

})();
