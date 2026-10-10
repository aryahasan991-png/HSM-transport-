// ============================================================
// HSM TRANSPORT - MANAJEMEN AKUN PETUGAS
// ============================================================

(function () {
  "use strict";

  const db = adminDb;

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

  function showMessage(element, message, error = false) {
    element.textContent = message;
    element.style.color = error ? "#dc2626" : "#15803d";
  }

  async function checkAdmin() {
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error("Silakan login sebagai admin.");
    }

    const { data, error } = await db.rpc("is_hsm_admin");

    if (error || data !== true) {
      throw new Error("Akses hanya untuk admin HSM.");
    }
  }

  async function issueCode(staffId, purpose, button, output) {
    button.disabled = true;
    output.textContent = "Membuat kode...";

    try {
      await checkAdmin();

      const { data, error } = await db.rpc(
        "hsm_issue_staff_code",
        {
          p_staff_id: staffId,
          p_purpose: purpose
        }
      );

      if (error) throw error;

      output.innerHTML = "";

      const label = document.createElement("div");
      label.textContent =
        purpose === "activation"
          ? "Kode aktivasi:"
          : "Kode pemulihan:";

      const code = document.createElement("strong");
      code.style.cssText =
        "display:block;font-size:24px;letter-spacing:3px;margin:8px 0";
      code.textContent = String(data);

      const note = document.createElement("div");
      note.textContent =
        "Berlaku 15 menit. Berikan langsung kepada petugas. " +
        "Kode hanya ditampilkan sekali.";

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "📋 Salin Kode";
      copy.className = "hsm-extra-button";
      copy.style.marginTop = "10px";

      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(String(data));
          copy.textContent = "✓ Tersalin";
        } catch {
          alert("Silakan salin kode secara manual.");
        }
      });

      output.append(label, code, note, copy);

    } catch (error) {
      showMessage(output, error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  async function loadStaffAccounts() {
    const container = document.getElementById(
      "hsmStaffAccountList"
    );

    if (!container) return;

    container.textContent = "Memuat akun petugas...";

    try {
      await checkAdmin();

      const { data, error } = await db
        .from("hsm_staff_accounts")
        .select("id,crew_id,phone,is_active,is_activated")
        .order("created_at");

      if (error) throw error;

      const { data: crew, error: crewError } = await db
        .from("hsm_crew")
        .select("id,name,role,vehicle");

      if (crewError) throw crewError;

      const crewMap = new Map(
        (crew || []).map(item => [String(item.id), item])
      );

      container.innerHTML = "";

      for (const account of data || []) {
        const person = crewMap.get(String(account.crew_id));

        if (!person) continue;

        const card = document.createElement("article");
        card.className = "hsm-extra-card";

        const status = account.is_activated
          ? "🟢 Sudah Aktivasi"
          : "🔴 Belum Aktivasi";

        card.innerHTML = `
          <div style="font-weight:900;margin-bottom:7px">
            ${escapeText(person.vehicle)} —
            ${escapeText(person.name)}
          </div>

          <div style="font-size:12px;margin-bottom:5px">
            ${person.role === "driver" ? "Sopir" : "Kernet"}
            · ${escapeText(account.phone)}
          </div>

          <div style="font-size:12px;margin-bottom:12px">
            ${account.is_active ? status : "⛔ Akun Nonaktif"}
          </div>

          <div data-actions style="display:flex;gap:8px;flex-wrap:wrap"></div>

          <div data-result style="margin-top:12px;font-size:12px"></div>
        `;

        const actions = card.querySelector("[data-actions]");
        const result = card.querySelector("[data-result]");

        const purpose = account.is_activated
          ? "recovery"
          : "activation";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "hsm-extra-button";
        button.textContent = account.is_activated
          ? "🔄 Buat Kode Pemulihan PIN"
          : "🔑 Buat Kode Aktivasi";

        button.disabled = !account.is_active;

        button.addEventListener("click", () =>
          issueCode(account.id, purpose, button, result)
        );

        actions.appendChild(button);
        container.appendChild(card);
      }

    } catch (error) {
      showMessage(container, error.message, true);
    }
  }

  function initialize() {
    const crewSection = document.getElementById(
      "hsmCrewSection"
    );

    if (!crewSection) {
      console.warn("HSM STAFF ADMIN: Menu petugas belum ditemukan.");
      return;
    }

    const section = document.createElement("div");
    section.className = "hsm-extra-card";

    section.innerHTML = `
      <h2 class="hsm-extra-title">🔐 Akun Login Petugas</h2>

      <p class="hsm-extra-desc">
        Buat kode aktivasi atau pemulihan PIN untuk
        sopir dan kernet HSM Transport.
      </p>

      <button
        type="button"
        class="hsm-extra-button"
        id="hsmRefreshStaffAccounts"
      >
        Refresh Akun
      </button>

      <div
        id="hsmStaffAccountList"
        style="margin-top:15px"
      ></div>
    `;

    crewSection.appendChild(section);

    document.getElementById(
      "hsmRefreshStaffAccounts"
    ).addEventListener("click", loadStaffAccounts);

    const crewButton = document.querySelector(
      '[data-hsm-menu="crew"]'
    );

    crewButton?.addEventListener(
      "click",
      loadStaffAccounts
    );

    console.log("HSM STAFF ADMIN: Siap.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
