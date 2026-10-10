// ============================================================
// HSM TRANSPORT - ADMIN EXTRA
// ============================================================
// FITUR:
// - Navigasi Booking / Manifest / Sopir & Kernet
// - Tidak mengubah fungsi admin.js
// - Data Sopir & Kernet dari Supabase
// - Edit nama dan nomor WhatsApp
// - Upload / ganti foto petugas
// - Foto disimpan di private Supabase Storage
// ============================================================

(function () {
  "use strict";

  // ==========================================================
  // KONFIGURASI
  // ==========================================================

  const CREW_BUCKET = "hsm-crew-photos";

  const db = adminDb;

  let activeMenu = "booking";

  let crewData = [];

  let manifestSection = null;

  let crewSection = null;

  let navigation = null;

  // ==========================================================
  // ELEMENT DASHBOARD LAMA
  // ==========================================================

  const dashboardElement =
    document.getElementById("dashboard");

  const dashboardHead =
    document.querySelector(".dashboard-head");

  const statsElement =
    document.querySelector(".stats");

  const filtersElement =
    document.querySelector(".filters");

  const bookingListElement =
    document.getElementById("bookingList");

  const footerElement =
    document.querySelector(".admin-footer");

  if (
    !dashboardElement ||
    !dashboardHead ||
    !bookingListElement
  ) {
    console.error(
      "HSM EXTRA: Struktur dashboard tidak ditemukan."
    );

    return;
  }

  // ==========================================================
  // CSS TAMBAHAN
  // ==========================================================

  const style = document.createElement("style");

  style.textContent = `
    .hsm-extra-nav {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }

    .hsm-extra-nav button {
      min-height: 45px;
      padding: 9px 7px;
      border: 1px solid #dbe3ee;
      border-radius: 10px;
      background: #ffffff;
      color: #374151;
      font-size: 12px;
      font-weight: 800;
    }

    .hsm-extra-nav button.active {
      background: #0754a6;
      border-color: #0754a6;
      color: #ffffff;
    }

    .hsm-extra-panel {
      display: none;
    }

    .hsm-extra-panel.active {
      display: block;
    }

    .hsm-extra-card {
      padding: 17px;
      margin-bottom: 13px;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 3px 12px rgba(15,23,42,.05);
    }

    .hsm-extra-title {
      margin: 0 0 6px;
      font-size: 19px;
      font-weight: 900;
    }

    .hsm-extra-desc {
      margin: 0 0 16px;
      color: #6b7280;
      font-size: 12px;
      line-height: 1.6;
    }

    .hsm-crew-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 13px;
    }

    .hsm-crew-photo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100px;
      height: 115px;
      margin-bottom: 12px;
      border-radius: 10px;
      background: #eef2f7;
      color: #64748b;
      overflow: hidden;
      font-size: 11px;
      text-align: center;
    }

    .hsm-crew-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hsm-extra-field {
      margin-bottom: 12px;
    }

    .hsm-extra-field label {
      display: block;
      margin-bottom: 5px;
      color: #374151;
      font-size: 11px;
      font-weight: 800;
    }

    .hsm-extra-input {
      width: 100%;
      min-height: 42px;
      padding: 9px 11px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #ffffff;
      color: #111827;
    }

    .hsm-extra-button {
      min-height: 41px;
      padding: 9px 13px;
      border: 0;
      border-radius: 8px;
      background: #0754a6;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
    }

    .hsm-extra-button:disabled {
      opacity: .6;
      cursor: wait;
    }

    .hsm-crew-badge {
      display: inline-block;
      margin-bottom: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #dbeafe;
      color: #1e40af;
      font-size: 11px;
      font-weight: 900;
    }

    .hsm-extra-message {
      margin-top: 10px;
      font-size: 12px;
      line-height: 1.5;
    }

    @media (max-width: 600px) {
      .hsm-crew-grid {
        grid-template-columns: 1fr;
      }

      .hsm-extra-nav {
        gap: 5px;
      }

      .hsm-extra-nav button {
        padding: 8px 4px;
        font-size: 10px;
      }
    }
  `;

  document.head.appendChild(style);

  // ==========================================================
  // BUAT NAVIGASI
  // ==========================================================

  function createNavigation() {

    navigation = document.createElement("div");

    navigation.className = "hsm-extra-nav";

    navigation.innerHTML = `
      <button
        type="button"
        data-hsm-menu="booking"
        class="active"
      >
        📋 Booking
      </button>

      <button
        type="button"
        data-hsm-menu="manifest"
      >
        🚐 Manifest
      </button>

      <button
        type="button"
        data-hsm-menu="crew"
      >
        👨‍✈️ Sopir & Kernet
      </button>
    `;

    dashboardHead.insertAdjacentElement(
      "afterend",
      navigation
    );

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

        await switchMenu(menu);
      }
    );
  }

  // ==========================================================
  // BUAT HALAMAN MANIFEST
  // ==========================================================

  function createManifestSection() {

    manifestSection = document.createElement("section");

    manifestSection.className = "hsm-extra-panel";

    manifestSection.id = "hsmManifestSection";

    manifestSection.innerHTML = `
      <div class="hsm-extra-card">

        <h2 class="hsm-extra-title">
          🚐 Manifest Perjalanan
        </h2>

        <p class="hsm-extra-desc">
          Manifest perjalanan HSM Transport akan
          menampilkan daftar penumpang yang sudah
          dikonfirmasi naik berdasarkan armada,
          tanggal, dan kode perjalanan.
        </p>

        <div class="empty">
          Fitur manifest sedang disiapkan.

          <br><br>

          Tahap berikutnya:
          konfirmasi penumpang naik,
          pengelompokan berdasarkan trip_code,
          dan cetak manifest perjalanan.
        </div>

      </div>
    `;

    navigation.insertAdjacentElement(
      "afterend",
      manifestSection
    );
  }

  // ==========================================================
  // BUAT HALAMAN SOPIR & KERNET
  // ==========================================================

  function createCrewSection() {

    crewSection = document.createElement("section");

    crewSection.className = "hsm-extra-panel";

    crewSection.id = "hsmCrewSection";

    crewSection.innerHTML = `
      <div class="hsm-extra-card">

        <h2 class="hsm-extra-title">
          👨‍✈️ Data Sopir & Kernet
        </h2>

        <p class="hsm-extra-desc">
          Kelola identitas petugas HSM-01 dan HSM-02.
          Data petugas digunakan untuk manifest
          perjalanan.
        </p>

        <button
          type="button"
          id="hsmRefreshCrew"
          class="hsm-extra-button"
        >
          Refresh Data Petugas
        </button>

      </div>

      <div
        id="hsmCrewList"
        class="hsm-crew-grid"
      >
        <div class="empty">
          Memuat data petugas...
        </div>
      </div>
    `;

    manifestSection.insertAdjacentElement(
      "afterend",
      crewSection
    );

    document.getElementById(
      "hsmRefreshCrew"
    ).addEventListener(
      "click",
      loadCrew
    );
  }

  // ==========================================================
  // TAMPILKAN MENU
  // ==========================================================

  async function switchMenu(menu) {

    if (
      !["booking", "manifest", "crew"].includes(menu)
    ) {
      return;
    }

    activeMenu = menu;

    navigation.querySelectorAll(
      "[data-hsm-menu]"
    ).forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.hsmMenu === menu
      );
    });

    const showBooking = menu === "booking";

    if (statsElement) {
      statsElement.style.display =
        showBooking ? "" : "none";
    }

    if (filtersElement) {
      filtersElement.style.display =
        showBooking ? "" : "none";
    }

    bookingListElement.style.display =
      showBooking ? "" : "none";

    manifestSection.classList.toggle(
      "active",
      menu === "manifest"
    );

    crewSection.classList.toggle(
      "active",
      menu === "crew"
    );

    if (menu === "crew") {
      await loadCrew();
    }
  }

  // ==========================================================
  // AMBIL DATA SOPIR & KERNET
  // ==========================================================

  async function loadCrew() {

    const list = document.getElementById(
      "hsmCrewList"
    );

    list.innerHTML = `
      <div class="empty">
        Memuat data sopir dan kernet...
      </div>
    `;

    try {

      const allowed = await verifyAdmin();

      if (!allowed) {
        throw new Error(
          "Akses admin tidak valid."
        );
      }

      const { data, error } = await db
        .from("hsm_crew")
        .select("*")
        .order("vehicle", {
          ascending: true
        })
        .order("role", {
          ascending: false
        });

      if (error) {
        throw error;
      }

      crewData = data || [];

      await renderCrew();

    } catch (error) {

      console.error(
        "HSM CREW LOAD ERROR:",
        error
      );

      list.innerHTML = `
        <div class="empty">
          Gagal memuat data petugas.

          <br><br>

          ${escapeHtml(error.message)}
        </div>
      `;
    }
  }

  // ==========================================================
  // FOTO PRIVATE
  // ==========================================================

  async function getCrewPhotoUrl(path) {

    if (!path) {
      return null;
    }

    const { data, error } = await db.storage
      .from(CREW_BUCKET)
      .createSignedUrl(
        path,
        300
      );

    if (error) {
      console.warn(
        "HSM CREW PHOTO:",
        error
      );

      return null;
    }

    return data?.signedUrl || null;
  }

  // ==========================================================
  // TAMPILKAN DATA PETUGAS
  // ==========================================================

  async function renderCrew() {

    const list = document.getElementById(
      "hsmCrewList"
    );

    list.innerHTML = "";

    if (!crewData.length) {

      list.innerHTML = `
        <div class="empty">
          Belum ada data petugas.
        </div>
      `;

      return;
    }

    for (const crew of crewData) {

      const photoUrl = await getCrewPhotoUrl(
        crew.photo_path
      );

      const card = document.createElement(
        "article"
      );

      card.className = "hsm-extra-card";

      const roleLabel =
        crew.role === "driver"
          ? "Sopir"
          : "Kernet";

      card.innerHTML = `
        <span class="hsm-crew-badge">
          ${escapeHtml(crew.vehicle)}
          —
          ${escapeHtml(roleLabel)}
        </span>

        <div class="hsm-crew-photo">
          ${
            photoUrl
              ? `<img
                   src="${escapeHtml(photoUrl)}"
                   alt="Foto petugas"
                 >`
              : "Belum Ada Foto"
          }
        </div>

        <div class="hsm-extra-field">
          <label>Nama Petugas</label>

          <input
            type="text"
            class="hsm-extra-input"
            data-crew-name
            value="${escapeHtml(crew.name)}"
          >
        </div>

        <div class="hsm-extra-field">
          <label>Nomor WhatsApp</label>

          <input
            type="tel"
            class="hsm-extra-input"
            data-crew-phone
            value="${escapeHtml(crew.phone)}"
          >
        </div>

        <div class="hsm-extra-field">
          <label>Foto Petugas</label>

          <input
            type="file"
            class="hsm-extra-input"
            data-crew-photo
            accept="image/jpeg,image/png,image/webp"
          >
        </div>

        <button
          type="button"
          class="hsm-extra-button"
          data-save-crew
        >
          Simpan Perubahan
        </button>

        <div
          class="hsm-extra-message"
          data-crew-message
        ></div>
      `;

      list.appendChild(card);

      const saveButton = card.querySelector(
        "[data-save-crew]"
      );

      saveButton.addEventListener(
        "click",
        async function () {

          await saveCrew(
            crew,
            card,
            saveButton
          );
        }
      );
    }
  }

  // ==========================================================
  // SIMPAN DATA PETUGAS
  // ==========================================================

  async function saveCrew(
    crew,
    card,
    button
  ) {

    const name = card.querySelector(
      "[data-crew-name]"
    ).value.trim();

    const phone = card.querySelector(
      "[data-crew-phone]"
    ).value.trim();

    const fileInput = card.querySelector(
      "[data-crew-photo]"
    );

    const message = card.querySelector(
      "[data-crew-message]"
    );

    const file = fileInput.files[0];

    if (!name) {
      alert("Nama petugas wajib diisi.");
      return;
    }

    if (!/^0[0-9]{9,13}$/.test(phone)) {
      alert(
        "Masukkan nomor WhatsApp Indonesia yang valid."
      );
      return;
    }

    if (file) {

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];

      if (!allowedTypes.includes(file.type)) {
        alert(
          "Foto harus JPG, PNG, atau WebP."
        );
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        alert(
          "Ukuran foto maksimal 2 MB."
        );
        return;
      }
    }

    button.disabled = true;

    button.textContent = "Menyimpan...";

    message.textContent = "";

    let uploadedPath = null;

    try {

      const allowed = await verifyAdmin();

      if (!allowed) {
        throw new Error(
          "Sesi admin tidak valid."
        );
      }

      let photoPath = crew.photo_path || null;

      // ======================================================
      // UPLOAD FOTO BARU
      // ======================================================

      if (file) {

        const extension =
          file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "jpg";

        const uniqueName =
          crypto.randomUUID() +
          "." +
          extension;

        const path =
          crew.vehicle +
          "/" +
          crew.role +
          "/" +
          uniqueName;

        const upload = await db.storage
          .from(CREW_BUCKET)
          .upload(
            path,
            file,
            {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type
            }
          );

        if (upload.error) {
          throw upload.error;
        }

        uploadedPath = path;
        photoPath = path;
      }

      // ======================================================
      // UPDATE DATABASE
      // ======================================================

      const { data, error } = await db
        .from("hsm_crew")
        .update({
          name: name,
          phone: phone,
          photo_path: photoPath
        })
        .eq("id", crew.id)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Perubahan tidak tersimpan. Periksa izin admin."
        );
      }

      message.style.color = "#16a34a";

      message.textContent =
        "Data petugas berhasil disimpan.";

      // ======================================================
      // HAPUS FOTO LAMA SETELAH UPDATE BERHASIL
      // ======================================================

      if (
        uploadedPath &&
        crew.photo_path &&
        crew.photo_path !== uploadedPath
      ) {

        const removal = await db.storage
          .from(CREW_BUCKET)
          .remove([crew.photo_path]);

        if (removal.error) {
          console.warn(
            "Foto lama belum terhapus:",
            removal.error
          );
        }
      }

      await loadCrew();

    } catch (error) {

      console.error(
        "HSM CREW SAVE ERROR:",
        error
      );

      // Hapus foto baru jika update database gagal.
      if (uploadedPath) {

        await db.storage
          .from(CREW_BUCKET)
          .remove([uploadedPath]);
      }

      message.style.color = "#dc2626";

      message.textContent =
        "Gagal menyimpan: " +
        error.message;

      button.disabled = false;

      button.textContent =
        "Simpan Perubahan";
    }
  }

  // ==========================================================
  // INISIALISASI
  // ==========================================================

  function initializeExtra() {

    createNavigation();

    createManifestSection();

    createCrewSection();

    switchMenu("booking");

    console.log(
      "HSM ADMIN EXTRA: Siap."
    );
  }

  initializeExtra();

})();
