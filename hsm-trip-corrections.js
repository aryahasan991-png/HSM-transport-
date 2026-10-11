// ============================================================
// HSM TRANSPORT
// PT HIDAYAH SARANA MULIA
//
// KOREKSI PERJALANAN KHUSUS ADMIN
//
// Terintegrasi dengan hsm-trip-monitor.js
//
// TIDAK MENGUBAH KODE MONITORING LAMA
// ============================================================

(function () {
  "use strict";

  const db = adminDb;

  const TIMEZONE = "Asia/Jayapura";

  let busy = false;

  // ==========================================================
  // HELPERS
  // ==========================================================

  function el(id) {
    return document.getElementById(id);
  }

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
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }
    ).format(date) + " WIT";
  }

  // ==========================================================
  // CSS
  // ==========================================================

  function installStyles() {
    const style = document.createElement("style");

    style.textContent = `

      .hsm-correction {
        margin-top: 15px;
        border: 1px solid #f5c6a5;
        border-radius: 11px;
        overflow: hidden;
        background: #fffaf5;
      }

      .hsm-correction > summary {
        padding: 14px;
        color: #9a3412;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      .hsm-correction-body {
        padding: 14px;
        border-top: 1px solid #fed7aa;
      }

      .hsm-correction-desc {
        margin-bottom: 12px;
        color: #7c2d12;
        font-size: 12px;
        line-height: 1.7;
      }

      .hsm-correction-label {
        display: block;
        margin-bottom: 6px;
        color: #374151;
        font-size: 12px;
        font-weight: 800;
      }

      .hsm-correction-select,
      .hsm-correction-reason {
        width: 100%;
        box-sizing: border-box;
        padding: 11px;
        margin-bottom: 12px;
        border: 1px solid #d1d5db;
        border-radius: 9px;
        background: white;
        color: #111827;
        font: inherit;
        font-size: 13px;
      }

      .hsm-correction-reason {
        min-height: 90px;
        resize: vertical;
      }

      .hsm-correction-submit {
        width: 100%;
        min-height: 44px;
        padding: 11px;
        border: 0;
        border-radius: 9px;
        background: #c2410c;
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      .hsm-correction-submit:disabled {
        opacity: .55;
        cursor: wait;
      }

      .hsm-correction-message {
        margin-top: 12px;
        font-size: 12px;
        line-height: 1.7;
        overflow-wrap: anywhere;
      }

      .hsm-correction-history {
        margin-top: 16px;
        padding-top: 13px;
        border-top: 1px solid #fed7aa;
      }

      .hsm-correction-history-title {
        margin-bottom: 10px;
        color: #7c2d12;
        font-size: 12px;
        font-weight: 900;
      }

      .hsm-correction-log {
        padding: 11px;
        margin-bottom: 9px;
        border: 1px solid #e5e7eb;
        border-radius: 9px;
        background: white;
        color: #475569;
        font-size: 11px;
        line-height: 1.8;
      }

      .hsm-correction-log strong {
        color: #111827;
      }

    `;

    document.head.appendChild(style);
  }

  // ==========================================================
  // CEK STATUS PERJALANAN
  // ==========================================================

  function getTripStatus(card) {
    const badge = card.querySelector(
      ".hsm-monitor-status"
    );

    if (!badge) return "";

    if (badge.classList.contains("completed")) {
      return "completed";
    }

    if (badge.classList.contains("in_progress")) {
      return "in_progress";
    }

    if (badge.classList.contains("not_departed")) {
      return "not_departed";
    }

    return "";
  }

  // ==========================================================
  // BUAT FORM KOREKSI
  // ==========================================================

  function createCorrectionPanel(card) {
    if (card.querySelector(".hsm-correction")) {
      return;
    }

    const code = card.querySelector(
      ".hsm-monitor-code"
    )?.textContent.trim();

    if (!code) return;

    const status = getTripStatus(card);

    const correction = document.createElement(
      "details"
    );

    correction.className = "hsm-correction";

    let options = `
      <option value="">
        Pilih tindakan koreksi
      </option>
    `;

    if (status === "completed") {
      options += `
        <option value="reopen_completed">
          ↩️ Batalkan penyelesaian perjalanan
        </option>
      `;
    }

    if (status === "in_progress") {
      options += `
        <option value="undo_last_departure">
          ↩️ Batalkan keberangkatan terakhir
        </option>
      `;
    }

    correction.innerHTML = `

      <summary>
        🛠️ Koreksi Perjalanan Khusus Admin
      </summary>

      <div class="hsm-correction-body">

        <div class="hsm-correction-desc">
          Gunakan fitur ini hanya jika terdapat kesalahan
          pencatatan perjalanan.

          <br><br>

          Setiap koreksi wajib memiliki alasan dan
          disimpan dalam riwayat audit admin.

          <br>

          <strong>
            Data booking, pembayaran, dan status boarding
            tidak diubah otomatis.
          </strong>
        </div>

        <label class="hsm-correction-label">
          Jenis Koreksi
        </label>

        <select class="hsm-correction-select">
          ${options}
        </select>

        <label class="hsm-correction-label">
          Alasan Koreksi
        </label>

        <textarea
          class="hsm-correction-reason"
          maxlength="500"
          placeholder="Contoh: Petugas tidak sengaja menekan tombol Selesaikan Perjalanan."
        ></textarea>

        <button
          type="button"
          class="hsm-correction-submit"
        >
          Simpan Koreksi
        </button>

        <div
          class="hsm-correction-message"
          role="status"
        ></div>

        <div class="hsm-correction-history">

          <div class="hsm-correction-history-title">
            📜 Riwayat Koreksi Admin
          </div>

          <div class="hsm-correction-history-list">
            Buka panel untuk memuat riwayat.
          </div>

        </div>

      </div>
    `;

    card.appendChild(correction);

    const select = correction.querySelector(
      ".hsm-correction-select"
    );

    const reason = correction.querySelector(
      ".hsm-correction-reason"
    );

    const button = correction.querySelector(
      ".hsm-correction-submit"
    );

    const message = correction.querySelector(
      ".hsm-correction-message"
    );

    // ========================================================
    // KIRIM KOREKSI
    // ========================================================

    button.addEventListener(
      "click",
      async () => {

        if (busy) {
          message.textContent =
            "Tunggu proses koreksi sebelumnya.";
          return;
        }

        const action = select.value;

        const correctionReason = reason.value.trim();

        if (!action) {
          message.style.color = "#dc2626";

          message.textContent =
            "Pilih jenis koreksi terlebih dahulu.";

          return;
        }

        if (correctionReason.length < 12) {
          message.style.color = "#dc2626";

          message.textContent =
            "Alasan koreksi minimal 12 karakter.";

          return;
        }

        const actionName =
          action === "reopen_completed"
            ? "MEMBUKA KEMBALI PERJALANAN"
            : "MEMBATALKAN KEBERANGKATAN TERAKHIR";

        const confirmed = window.confirm(
          "KONFIRMASI KOREKSI HSM TRANSPORT\n\n" +
          "Perjalanan: " + code + "\n\n" +
          "Tindakan:\n" + actionName + "\n\n" +
          "Alasan:\n" + correctionReason + "\n\n" +
          "Perubahan ini akan dicatat sebagai aktivitas admin.\n\n" +
          "Lanjutkan?"
        );

        if (!confirmed) return;

        busy = true;

        button.disabled = true;

        button.textContent = "Menyimpan...";

        message.textContent = "";

        try {

          const { data, error } = await db.rpc(
            "hsm_admin_correct_trip",
            {
              p_trip_code: code,
              p_action: action,
              p_reason: correctionReason
            }
          );

          if (error) {
            throw error;
          }

          if (data?.success !== true) {
            throw new Error(
              data?.error ||
              "Koreksi perjalanan gagal."
            );
          }

          message.style.color = "#15803d";

          message.textContent =
            data.message ||
            "Koreksi berhasil disimpan.";

          // Perbarui data monitoring setelah koreksi.
          // Tombol refresh berasal dari monitoring V3.

          el("hsmMonitorRefresh")?.click();

        } catch (error) {

          console.error(
            "HSM CORRECTION ERROR:",
            error
          );

          message.style.color = "#dc2626";

          message.textContent =
            "Gagal melakukan koreksi: " +
            (error.message || "Kesalahan tidak diketahui");

        } finally {

          busy = false;

          button.disabled = false;

          button.textContent = "Simpan Koreksi";

        }
      }
    );

    // ========================================================
    // AMBIL RIWAYAT KOREKSI KETIKA PANEL DIBUKA
    // ========================================================

    correction.addEventListener(
      "toggle",
      async () => {

        if (!correction.open) return;

        await loadCorrectionHistory(
          code,
          correction
        );

      }
    );
  }

  // ==========================================================
  // RIWAYAT KOREKSI ADMIN
  // ==========================================================

  async function loadCorrectionHistory(
    tripCode,
    correction
  ) {
    const list = correction.querySelector(
      ".hsm-correction-history-list"
    );

    if (!list) return;

    list.textContent =
      "Memuat riwayat koreksi...";

    try {

      const { data, error } = await db.rpc(
        "hsm_admin_get_trip_corrections",
        {
          p_trip_code: tripCode
        }
      );

      if (error) {
        throw error;
      }

      if (data?.success !== true) {
        throw new Error(
          data?.error ||
          "Gagal mengambil riwayat koreksi."
        );
      }

      const logs = Array.isArray(data.logs)
        ? data.logs
        : [];

      if (!logs.length) {
        list.textContent =
          "Belum ada koreksi admin untuk perjalanan ini.";

        return;
      }

      list.innerHTML = logs.map(log => {

        let title = "Koreksi Perjalanan";

        if (log.action === "reopen_completed") {
          title = "↩️ Batalkan Penyelesaian";
        }

        if (log.action === "undo_last_departure") {
          title = "↩️ Batalkan Keberangkatan";
        }

        return `

          <div class="hsm-correction-log">

            <strong>
              ${escapeText(title)}
            </strong>

            <br>

            📍 Titik:
            ${escapeText(log.stop_name || "-")}

            <br>

            🕒 Waktu:
            ${escapeText(formatWIT(log.created_at))}

            <br>

            👤 Admin ID:
            ${escapeText(log.admin_user_id)}

            <br>

            📝 Alasan:
            ${escapeText(log.reason)}

          </div>
        `;

      }).join("");

    } catch (error) {

      list.textContent =
        "Gagal memuat riwayat: " +
        (error.message || "Kesalahan tidak diketahui");

    }
  }

  // ==========================================================
  // TAMBAHKAN PANEL KE SETIAP PERJALANAN
  // ==========================================================

  function installCorrectionPanels() {
    const list = el("hsmMonitorList");

    if (!list) return;

    const cards = list.querySelectorAll(
      ".hsm-monitor-trip"
    );

    for (const card of cards) {
      createCorrectionPanel(card);
    }
  }

  // ==========================================================
  // PANTAU RENDER MONITORING
  // ==========================================================
  // Setiap Monitoring V3 memperbarui daftar perjalanan,
  // tombol koreksi otomatis dipasang kembali.
  // ==========================================================

  function observeMonitor() {
    const list = el("hsmMonitorList");

    if (!list) {
      console.warn(
        "HSM CORRECTION: Daftar Monitoring belum ada."
      );
      return;
    }

    const observer = new MutationObserver(() => {
      installCorrectionPanels();
    });

    observer.observe(
      list,
      {
        childList: true,
        subtree: true
      }
    );

    installCorrectionPanels();
  }

  // ==========================================================
  // INITIALIZE
  // ==========================================================

  function initialize() {
    installStyles();

    observeMonitor();

    console.log(
      "HSM ADMIN TRIP CORRECTIONS: Siap."
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
