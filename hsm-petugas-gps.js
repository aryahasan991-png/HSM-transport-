/*
============================================================
HSM TRANSPORT
PT HIDAYAH SARANA MULIA

LIVE GPS PETUGAS - VERSION 1

- Menggunakan sesi login yang sudah ada
- Meminta izin lokasi melalui tombol
- Mengirim lokasi ke Edge Function
- Update maksimal setiap 15 detik
- Berhenti saat logout atau halaman tersembunyi
- Tidak mengubah sistem QR, manifest, atau perjalanan
============================================================
*/

(function () {
  "use strict";

  if (window.HSM_STAFF_GPS_READY) return;
  window.HSM_STAFF_GPS_READY = true;

  const ENDPOINT =
    "https://lbykbgtxxlnbdixkkcsw.supabase.co/functions/v1/hsm-staff-auth";

  const TOKEN_KEY = "hsm_staff_session_token";
  const DATE_KEY = "hsm_staff_login_date";

  const SEND_INTERVAL = 15000;

  const dashboard = document.getElementById("dashboard");

  if (!dashboard) return;

  let watchId = null;
  let lastSent = 0;
  let sending = false;
  let enabled = false;
  let generation = 0;
  let activeToken = null;

  function todayWIT() {
    const parts = new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Jayapura",
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

  function getSessionToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    const date = localStorage.getItem(DATE_KEY);

    if (!token || date !== todayWIT()) {
      return null;
    }

    return token;
  }

  function dashboardVisible() {
    return (
      dashboard.style.display === "block" &&
      !document.hidden
    );
  }

  /* ========================================================
     TAMPILAN GPS
  ======================================================== */

  const card = document.createElement("div");

  card.id = "hsmGpsCard";
  card.className = "hsm-premium-card";

  card.style.cssText = `
    padding:17px;
    margin-bottom:13px;
    border:1px solid #c7d8e9;
    border-radius:18px;
    background:linear-gradient(145deg,#e8f1fa,#d9e7f5);
    box-shadow:0 8px 24px rgba(6,30,66,.09);
  `;

  card.innerHTML = `
    <h2 style="
      margin:0 0 10px;
      color:#071e42;
      font-size:17px;
      font-weight:900;
    ">
      📍 Live GPS Armada
    </h2>

    <p style="
      font-size:12px;
      line-height:1.7;
      color:#426182;
      margin:0 0 13px;
    ">
      Aktifkan GPS agar lokasi armada dapat
      dipantau melalui dashboard Owner selama
      portal petugas terbuka.
    </p>

    <div
      id="hsmGpsStatus"
      role="status"
      aria-live="polite"
      style="
        padding:12px;
        margin-bottom:12px;
        border-radius:11px;
        background:#d2e4f6;
        color:#0b2a55;
        font-size:12px;
        line-height:1.6;
      "
    >
      GPS belum diaktifkan.
    </div>

    <button
      id="hsmGpsStart"
      type="button"
      style="
        width:100%;
        padding:14px;
        border:0;
        border-radius:12px;
        background:linear-gradient(120deg,#0754a6,#0b2a55);
        color:white;
        font-size:13px;
        font-weight:800;
      "
    >
      📍 Aktifkan Live GPS
    </button>

    <button
      id="hsmGpsStop"
      type="button"
      style="
        display:none;
        width:100%;
        padding:13px;
        margin-top:9px;
        border:1px solid #bdd0e5;
        border-radius:12px;
        background:#e7f0fb;
        color:#0b2a55;
        font-size:12px;
        font-weight:800;
      "
    >
      Hentikan GPS
    </button>
  `;

  /*
    Premium Navy memindahkan konten dashboard
    ke halaman Beranda.

    Tempatkan GPS di halaman Beranda jika ada.
  */

  const home =
    document.getElementById("hsmPremiumPage-home");

  if (home) {
    home.appendChild(card);
  } else {
    dashboard.insertBefore(card, dashboard.firstChild);
  }

  const status = document.getElementById("hsmGpsStatus");
  const startButton = document.getElementById("hsmGpsStart");
  const stopButton = document.getElementById("hsmGpsStop");

  function setStatus(message, type = "info") {
    status.textContent = message;

    const styles = {
      info: ["#d2e4f6", "#0b2a55"],
      success: ["#ddf2e7", "#17834d"],
      error: ["#fae7e8", "#b42318"]
    };

    const selected = styles[type] || styles.info;

    status.style.background = selected[0];
    status.style.color = selected[1];
  }

  function updateButtons() {
    startButton.style.display =
      enabled ? "none" : "block";

    stopButton.style.display =
      enabled ? "block" : "none";
  }

  /* ========================================================
     KIRIM LOKASI KE SUPABASE
  ======================================================== */

  async function sendLocation(position, currentGeneration) {
    if (
      !enabled ||
      currentGeneration !== generation ||
      !dashboardVisible()
    ) {
      return;
    }

    const token = getSessionToken();

    if (!token || token !== activeToken) {
      stopGPS("Sesi berakhir. GPS dihentikan.");
      return;
    }

    const coords = position.coords;

    const latitude = coords.latitude;
    const longitude = coords.longitude;
    const accuracy = coords.accuracy;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(accuracy)
    ) {
      setStatus("Koordinat GPS belum valid.", "error");
      return;
    }

    if (accuracy > 10000 || accuracy < 0) {
      setStatus("Akurasi lokasi belum memadai.", "error");
      return;
    }

    const now = Date.now();

    if (
      sending ||
      now - lastSent < SEND_INTERVAL
    ) {
      return;
    }

    sending = true;
    lastSent = now;

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      20000
    );

    try {
      const response = await fetch(
        ENDPOINT,
        {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            action: "gps_update",
            token,
            latitude,
            longitude,
            accuracy_m: accuracy
          }),
          signal: controller.signal
        }
      );

      const result = await response.json();

      if (
        !enabled ||
        currentGeneration !== generation ||
        getSessionToken() !== token
      ) {
        return;
      }

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.error ||
          "Server menolak pembaruan GPS."
        );
      }

      const time = new Intl.DateTimeFormat(
        "id-ID",
        {
          timeZone: "Asia/Jayapura",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }
      ).format(new Date());

      setStatus(
        "🟢 GPS Aktif\n" +
        "Lokasi berhasil dikirim pukul " +
        time +
        " WIT.\n" +
        "Akurasi ±" +
        Math.round(accuracy) +
        " meter.",
        "success"
      );

      status.style.whiteSpace = "pre-line";

    } catch (error) {
      if (
        !enabled ||
        currentGeneration !== generation
      ) {
        return;
      }

      setStatus(
        "GPS memperoleh lokasi, tetapi gagal mengirim: " +
        (error.message || "Kesalahan koneksi"),
        "error"
      );

    } finally {
      clearTimeout(timeout);
      sending = false;
    }
  }

  /* ========================================================
     MULAI GPS
  ======================================================== */

  function startGPS() {
    if (enabled) return;

    const token = getSessionToken();

    if (!token || !dashboardVisible()) {
      setStatus(
        "Silakan login dan buka portal terlebih dahulu.",
        "error"
      );
      return;
    }

    if (!navigator.geolocation) {
      setStatus(
        "Perangkat atau browser tidak mendukung GPS.",
        "error"
      );
      return;
    }

    enabled = true;
    activeToken = token;
    lastSent = 0;

    const currentGeneration = ++generation;

    updateButtons();

    setStatus(
      "⏳ Meminta izin lokasi dan mencari sinyal GPS..."
    );

    watchId = navigator.geolocation.watchPosition(
      position => {
        sendLocation(position, currentGeneration);
      },

      error => {
        if (
          !enabled ||
          currentGeneration !== generation
        ) {
          return;
        }

        if (error.code === 1) {
          stopGPS(
            "Izin lokasi ditolak. Aktifkan izin lokasi melalui pengaturan browser."
          );
        } else if (error.code === 2) {
          setStatus(
            "Lokasi belum tersedia. Aktifkan GPS HP dan coba di area terbuka.",
            "error"
          );
        } else {
          setStatus(
            "GPS terlalu lama mendapatkan lokasi. Periksa pengaturan lokasi HP.",
            "error"
          );
        }
      },

      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000
      }
    );
  }

  /* ========================================================
     HENTIKAN GPS
  ======================================================== */

  function stopGPS(message = "GPS tidak aktif.") {
    generation++;
    enabled = false;
    activeToken = null;
    lastSent = 0;

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    updateButtons();
    setStatus(message);
  }

  startButton.addEventListener("click", startGPS);

  stopButton.addEventListener("click", () => {
    stopGPS("GPS dihentikan oleh petugas.");
  });

  /* ========================================================
     SESI, LOGOUT, DAN VISIBILITAS
  ======================================================== */

  function checkSession() {
    if (!getSessionToken()) {
      if (enabled) {
        stopGPS("Sesi berakhir. GPS dihentikan.");
      }
      return;
    }

    if (!dashboardVisible() && enabled) {
      stopGPS(
        "GPS berhenti karena portal tidak aktif. " +
        "Tekan Aktifkan Live GPS saat kembali."
      );
    }
  }

  const observer = new MutationObserver(checkSession);

  observer.observe(dashboard, {
    attributes: true,
    attributeFilter: ["style"]
  });

  document.addEventListener(
    "visibilitychange",
    checkSession
  );

  window.addEventListener(
    "storage",
    checkSession
  );

  document.getElementById("logoutBtn")
    ?.addEventListener(
      "click",
      () => stopGPS("GPS dihentikan karena logout.")
    );

  setInterval(checkSession, 5000);

  updateButtons();

  console.log("HSM STAFF GPS: Siap.");

})();
