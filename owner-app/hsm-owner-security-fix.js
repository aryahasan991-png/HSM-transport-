/*
========================================================
HSM OWNER - SECURITY READ STATUS FIX
PT HIDAYAH SARANA MULIA

FITUR:
- Tombol Perbarui Riwayat berfungsi
- Menandai peringatan sudah dibaca
- Menghilangkan angka dan titik merah
- Riwayat keamanan tetap tersimpan
- Peringatan baru muncul kembali
- Sinkronisasi status baca via Supabase
- Mempertahankan desain dan fitur Owner
========================================================
*/

(function () {
  "use strict";

  let lastReadAt = "1970-01-01T00:00:00Z";

  let refreshRunning = false;
  let securityRequest = null;

  const byId = id => document.getElementById(id);

  /* ========================================
     STATUS PERINGATAN
  ======================================== */

  function unreadAlert(event) {
    const severity = String(
      event?.severity || "info"
    ).toLowerCase();

    if (severity === "info") {
      return false;
    }

    const eventTime = Date.parse(
      event?.created_at || ""
    );

    const readTime = Date.parse(lastReadAt);

    if (!Number.isFinite(eventTime)) {
      return true;
    }

    return eventTime > readTime;
  }

  /* ========================================
     INDIKATOR MERAH
  ======================================== */

  function updateIndicators() {
    const unread = securityEvents.filter(unreadAlert);

    const count = unread.length;

    const badge = byId("securityWarningCount");

    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }

    const bell = byId("headerNotificationDot");

    if (bell) {
      bell.hidden = count === 0;
    }

    const nav = byId("securityNavBadge");

    if (nav) {
      nav.hidden = count === 0;
    }

    const homeCount = byId("homeSecurityCount");

    if (homeCount) {
      homeCount.textContent =
        count + " peringatan belum dibaca";
    }
  }

  /* ========================================
     RENDER RIWAYAT
  ======================================== */

  function renderSecurityFixed() {
    const warnings = securityEvents.filter(isAlert);

    const home = byId("homeSecurityList");

    if (home) {
      home.replaceChildren();

      if (!warnings.length) {
        node(
          home,
          "div",
          "empty",
          "Belum ada peringatan keamanan."
        );
      } else {
        warnings.slice(0, 3).forEach(event => {
          home.appendChild(eventItem(event));
        });
      }
    }

    const list = byId("securityList");

    if (list) {
      list.replaceChildren();

      const shown =
        securityFilter === "alerts"
          ? warnings
          : securityEvents;

      if (!shown.length) {
        node(
          list,
          "div",
          "empty",
          "Belum ada aktivitas untuk filter ini."
        );
      } else {
        shown.forEach(event => {
          list.appendChild(eventItem(event));
        });
      }
    }

    updateIndicators();
  }

  /* ========================================
     AMBIL RIWAYAT DARI SUPABASE
  ======================================== */

  async function fetchSecurity() {
    if (!ownerDB) {
      throw new Error("Supabase belum tersedia.");
    }

    await ownerAccess();

    const [eventsResult, readResult] =
      await Promise.all([
        ownerDB.rpc("hsm_owner_get_security_events"),
        ownerDB.rpc("hsm_owner_get_security_read_at")
      ]);

    if (eventsResult.error) {
      throw eventsResult.error;
    }

    if (readResult.error) {
      throw readResult.error;
    }

    if (!Array.isArray(eventsResult.data)) {
      throw new Error(
        "Format data keamanan tidak valid."
      );
    }

    return {
      events: eventsResult.data,
      readAt:
        readResult.data ||
        "1970-01-01T00:00:00Z"
    };
  }

  /* ========================================
     MUAT RIWAYAT
  ======================================== */

  async function reloadSecurity() {
    if (!byId("dashboardPage")?.classList.contains("active")) {
      return false;
    }

    if (securityRequest) {
      return securityRequest;
    }

    const request = (async () => {
      try {
        const result = await fetchSecurity();

        if (
          !byId("dashboardPage")?.classList.contains("active")
        ) {
          return false;
        }

        securityEvents = result.events;
        lastReadAt = result.readAt;

        renderSecurityFixed();

        return true;

      } catch (error) {
        console.error("HSM OWNER SECURITY:", error);

        message(
          "Gagal memuat keamanan: " +
          (error.message || "Kesalahan tidak diketahui")
        );

        return false;
      }
    })();

    securityRequest = request;

    try {
      return await request;
    } finally {
      if (securityRequest === request) {
        securityRequest = null;
      }
    }
  }

  /* ========================================
     TOMBOL PERBARUI RIWAYAT
  ======================================== */

  async function refreshAndMarkRead() {
    if (refreshRunning) {
      return;
    }

    const button = byId("securityRefreshBtn");

    if (!button) {
      return;
    }

    refreshRunning = true;

    const originalHTML = button.innerHTML;

    button.disabled = true;
    button.textContent = "Memperbarui...";

    try {
      /*
       * Tunggu pengambilan sebelumnya selesai,
       * kemudian ambil data terbaru.
       */

      if (securityRequest) {
        await securityRequest;
      }

      const latest = await fetchSecurity();

      securityEvents = latest.events;
      lastReadAt = latest.readAt;

      renderSecurityFixed();

      /*
       * Hanya tandai kejadian yang
       * benar-benar diterima saat ini.
       */

      const timestamps = latest.events
        .map(event => Date.parse(event.created_at || ""))
        .filter(Number.isFinite);

      if (timestamps.length > 0) {
        const newest = Math.max(...timestamps);

        const { error } = await ownerDB.rpc(
          "hsm_owner_mark_security_read",
          {
            p_through: new Date(newest).toISOString()
          }
        );

        if (error) {
          throw error;
        }
      }

      /*
       * Verifikasi ulang dari server.
       */

      const verified = await fetchSecurity();

      securityEvents = verified.events;
      lastReadAt = verified.readAt;

      renderSecurityFixed();

      message(
        "Riwayat berhasil diperbarui. " +
        "Peringatan sebelumnya sudah dibaca.",
        "success"
      );

    } catch (error) {
      console.error(
        "HSM OWNER SECURITY REFRESH:",
        error
      );

      message(
        "Gagal memperbarui riwayat: " +
        (error.message || "Kesalahan tidak diketahui")
      );

    } finally {
      button.innerHTML = originalHTML;
      button.disabled = false;

      refreshRunning = false;
    }
  }

  /* ========================================
     HUBUNGKAN KE SISTEM LAMA
  ======================================== */

  function initializeFix() {
    if (
      typeof renderSecurity !== "function" ||
      typeof loadSecurity !== "function"
    ) {
      console.error(
        "HSM OWNER: Fungsi keamanan utama tidak ditemukan."
      );
      return;
    }

    /*
     * Ganti hanya implementasi fungsi keamanan.
     * Fungsi lain tidak disentuh.
     */

    renderSecurity = renderSecurityFixed;

    loadSecurity = reloadSecurity;

    /*
     * Gunakan capture agar event klik lama
     * tidak menjalankan refresh kedua.
     */

    const refreshButton = byId("securityRefreshBtn");

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        event => {
          event.stopImmediatePropagation();

          void refreshAndMarkRead();
        },
        true
      );
    }

    /*
     * Ambil status terbaru saat masuk Owner.
     */

    if (byId("dashboardPage")?.classList.contains("active")) {
      void reloadSecurity();
    }

    console.log(
      "HSM OWNER SECURITY FIX: Aktif."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeFix
    );
  } else {
    initializeFix();
  }

})();
