/* ============================================================
   HSM TRANSPORT - MANIFEST PERJALANAN
   ============================================================ */

(() => {
  "use strict";

  const db = adminDb;

  const esc = value =>
    escapeHtml(value == null ? "" : String(value));

  const safeDate = value =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || "");

  const cleanVehicle = value =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

  const tripVehicle = row => {
    const code = String(row.trip_code || "").toUpperCase();

    if (/HSM0?1/.test(code)) return "HSM-01";
    if (/HSM0?2/.test(code)) return "HSM-02";

    return getVehicle(row);
  };

  const $ = id => document.getElementById(id);

  // ==========================================================
  // TAMPILAN
  // ==========================================================

  const style = document.createElement("style");

  style.textContent = `
    .hsm-board-btn {
      background: #0f766e !important;
      color: #ffffff !important;
    }

    .hsm-board-badge {
      padding: 8px 14px;
      color: #0f766e;
      font-size: 12px;
      font-weight: 800;
    }

    .hsm-manifest-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin-bottom: 15px;
      align-items: end;
    }

    .hsm-manifest-toolbar label {
      font-size: 12px;
      font-weight: 700;
      display: grid;
      gap: 5px;
    }

    .hsm-manifest-toolbar input {
      height: 41px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0 10px;
    }

    .hsm-manifest-group {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 15px;
      margin: 12px 0;
    }

    .hsm-manifest-group h3 {
      margin: 0 0 9px;
    }

    .hsm-manifest-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .hsm-manifest-table th,
    .hsm-manifest-table td {
      border: 1px solid #e5e7eb;
      padding: 8px;
      text-align: left;
      overflow-wrap: anywhere;
    }

    .hsm-manifest-scroll {
      overflow-x: auto;
    }

    .hsm-manifest-button {
      background: #0754a6;
      color: #ffffff;
      border: 0;
      border-radius: 8px;
      padding: 10px 13px;
      font-weight: 800;
      margin: 5px 6px 5px 0;
    }
  `;

  document.head.appendChild(style);

  // ==========================================================
  // HALAMAN MANIFEST
  // ==========================================================

  const manifestPanel = $("hsmManifestSection");

  if (!manifestPanel) {
    console.error(
      "HSM MANIFEST: Menu Manifest belum tersedia."
    );
    return;
  }

  manifestPanel.innerHTML = `
    <div class="hsm-extra-card">

      <h2 class="hsm-extra-title">
        🚐 Manifest Perjalanan
      </h2>

      <p class="hsm-extra-desc">
        Hanya penumpang yang dikonfirmasi
        <b>Sudah Naik</b> yang tercatat.

        Manifest menggabungkan seluruh pool
        berdasarkan kode perjalanan.
      </p>

      <div class="hsm-manifest-toolbar">

        <label>
          Tanggal perjalanan

          <input
            type="date"
            id="hsmManifestDate"
          >
        </label>

        <button
          type="button"
          class="hsm-manifest-button"
          id="hsmManifestRefresh"
        >
          Tampilkan Manifest
        </button>

      </div>

      <div
        id="hsmManifestResult"
        class="empty"
      >
        Pilih tanggal lalu tekan Tampilkan Manifest.
      </div>

    </div>
  `;

  // ==========================================================
  // TANGGAL WIT
  // ==========================================================

  const todayWIT = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jayapura",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

  $("hsmManifestDate").value = todayWIT();

  $("hsmManifestRefresh").addEventListener(
    "click",
    loadManifest
  );

  const menuButton = document.querySelector(
    '[data-hsm-menu="manifest"]'
  );

  if (menuButton) {
    menuButton.addEventListener(
      "click",
      () => loadManifest()
    );
  }

  // ==========================================================
  // TOMBOL KONFIRMASI PENUMPANG NAIK
  // ==========================================================

  const list = $("bookingList");

  function decorateBookings() {

    if (!list || !Array.isArray(bookings)) {
      return;
    }

    list.querySelectorAll(".booking-card").forEach(
      card => {

        const existing = card.querySelector(
          "[data-action][data-id]"
        );

        const id = existing?.dataset.id;

        if (
          !id ||
          card.dataset.hsmBoardingReady === "1"
        ) {
          return;
        }

        card.dataset.hsmBoardingReady = "1";

        const row = bookings.find(
          b => String(b.id) === String(id)
        );

        if (!row) {
          return;
        }

        const actions = card.querySelector(".actions");

        if (!actions) {
          return;
        }

        const boarding = String(
          row.boarding_status || "not_boarded"
        );

        const payment = normalizeStatus(
          row.payment_status
        );

        if (boarding === "boarded") {

          const badge = document.createElement("span");

          badge.className = "hsm-board-badge";

          badge.textContent = "✓ Sudah Naik";

          actions.prepend(badge);

        } else if (boarding === "no_show") {

          const badge = document.createElement("span");

          badge.className = "hsm-board-badge";

          badge.style.color = "#b91c1c";

          badge.textContent = "Tidak Hadir (No Show)";

          actions.prepend(badge);

        } else if (
          payment === "paid" ||
          payment === "completed"
        ) {

          const button = document.createElement("button");

          button.type = "button";

          button.className = "hsm-board-btn";

          button.textContent =
            "✓ Konfirmasi Sudah Naik";

          button.dataset.hsmBoardId = id;

          actions.prepend(button);
        }
      }
    );
  }

  // ==========================================================
  // AMATI PERUBAHAN BOOKING
  // ==========================================================

  if (list) {

    new MutationObserver(
      decorateBookings
    ).observe(list, {
      childList: true
    });

    decorateBookings();

    // ========================================================
    // SIMPAN STATUS SUDAH NAIK
    // ========================================================

    list.addEventListener(
      "click",
      async event => {

        const button = event.target.closest(
          "[data-hsm-board-id]"
        );

        if (!button) {
          return;
        }

        const id = button.dataset.hsmBoardId;

        const row = bookings.find(
          b => String(b.id) === String(id)
        );

        if (
          !row ||
          row.origin !== selectedPool
        ) {
          alert(
            "Booking bukan dari pool aktif."
          );
          return;
        }

        const confirmed = confirm(
          `Konfirmasi ${
            row.passenger_name || row.booking_code
          } sudah naik di ${row.origin}?`
        );

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {

          const { data: auth } =
            await db.auth.getUser();

          if (
            !auth?.user ||
            !(await verifyAdmin())
          ) {
            throw new Error(
              "Sesi admin tidak valid."
            );
          }

          const { data, error } = await db
            .from("bookings")
            .update({
              boarding_status: "boarded",
              boarded_at: new Date().toISOString(),
              boarded_by: auth.user.id
            })
            .eq("id", id)
            .eq("origin", selectedPool)
            .eq("boarding_status", "not_boarded")
            .in(
              "payment_status",
              ["paid", "completed"]
            )
            .select("id");

          if (error) {
            throw error;
          }

          if (!data?.length) {
            throw new Error(
              "Booking sudah berubah, belum lunas, " +
              "atau tidak bisa dikonfirmasi. Refresh data."
            );
          }

          await loadBookings();

          if (
            document.querySelector(
              '[data-hsm-menu="manifest"].active'
            )
          ) {
            await loadManifest();
          }

        } catch (error) {

          alert(
            "Gagal konfirmasi naik: " +
            (error.message || error)
          );

          button.disabled = false;
        }
      }
    );
  }

  // ==========================================================
  // DATA MANIFEST
  // ==========================================================

  let manifestRows = [];

  let manifestCrew = [];

  async function loadManifest() {

    const result = $("hsmManifestResult");

    const date = $("hsmManifestDate").value;

    if (!safeDate(date)) {
      alert(
        "Pilih tanggal perjalanan yang benar."
      );
      return;
    }

    result.className = "empty";

    result.textContent =
      "Memuat manifest semua pool...";

    try {

      if (!(await verifyAdmin())) {
        throw new Error(
          "Akses admin tidak valid."
        );
      }

      const rows = [];

      // Ambil data secara bertahap agar tidak
      // terpotong batas jumlah baris Supabase.

      for (
        let from = 0;
        from < 10000;
        from += 500
      ) {

        const { data, error } = await db
          .from("bookings")
          .select(`
            id,
            booking_code,
            passenger_name,
            phone,
            origin,
            destination,
            seat_number,
            vehicle,
            trip_code,
            travel_date,
            departure_time,
            boarding_status,
            boarded_at,
            payment_status
          `)
          .eq("travel_date", date)
          .eq("boarding_status", "boarded")
          .order("created_at", {
            ascending: true
          })
          .range(from, from + 499);

        if (error) {
          throw error;
        }

        rows.push(...(data || []));

        if (
          !data ||
          data.length < 500
        ) {
          break;
        }
      }

      // ======================================================
      // AMBIL DATA SOPIR DAN KERNET
      // ======================================================

      const crewResult = await db
        .from("hsm_crew")
        .select(
          "vehicle,role,name,phone"
        );

      if (crewResult.error) {
        throw crewResult.error;
      }

      manifestRows = rows;

      manifestCrew = crewResult.data || [];

      renderManifest(date);

    } catch (error) {

      result.className = "empty";

      result.textContent =
        "Gagal memuat manifest: " +
        (error.message || error);
    }
  }

  // ==========================================================
  // KELOMPOKKAN BERDASARKAN TRIP CODE
  // ==========================================================

  function groupManifest() {

    const groups = new Map();

    for (const row of manifestRows) {

      const code = String(
        row.trip_code || ""
      ).trim();

      // Jangan menggabungkan berdasarkan armada saja.
      // Satu armada bisa punya beberapa perjalanan.

      const key = code ||
        `TANPA-TRIP-CODE:${row.id}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(row);
    }

    return groups;
  }

  // ==========================================================
  // CARI SOPIR DAN KERNET ARMADA
  // ==========================================================

  function crewFor(vehicle) {

    return manifestCrew.filter(
      person =>
        cleanVehicle(person.vehicle) ===
        cleanVehicle(vehicle)
    );
  }

  // ==========================================================
  // CETAK MANIFEST
  // ==========================================================

  function printManifest(key, date) {

    const group = groupManifest().get(key);

    if (!group?.length) {
      return;
    }

    const vehicle = tripVehicle(group[0]);

    const crew = crewFor(vehicle);

    const driver = crew.find(
      c => c.role === "driver"
    );

    const assistant = crew.find(
      c => c.role !== "driver"
    );

    const details = p =>
      p
        ? `${esc(p.name)} — ${esc(p.phone)}`
        : "-";

    const tableRows = group.map(
      (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(r.passenger_name)}</td>
          <td>${esc(r.phone)}</td>
          <td>
            ${esc(r.origin)}
            →
            ${esc(r.destination)}
          </td>
          <td>${esc(r.seat_number)}</td>
          <td>${esc(r.booking_code)}</td>
        </tr>
      `
    ).join("");

    const popup = window.open(
      "",
      "_blank",
      "width=950,height=750"
    );

    if (!popup) {
      alert(
        "Izinkan pop-up untuk mencetak manifest."
      );
      return;
    }

    popup.document.write(`
      <!doctype html>
      <html lang="id">

      <head>

        <meta charset="utf-8">

        <title>
          Manifest ${esc(key)}
        </title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #111111;
          }

          h1 {
            margin-bottom: 4px;
          }

          p {
            margin: 5px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 12px;
          }

          th,
          td {
            border: 1px solid #555555;
            padding: 7px;
            text-align: left;
          }

          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          @media print {
            button {
              display: none;
            }
          }
        </style>

      </head>

      <body>

        <h1>
          HSM TRANSPORT — MANIFEST
        </h1>

        <p>
          PT Hidayah Sarana Mulia
        </p>

        <p>
          <b>Tanggal:</b>
          ${esc(formatDate(date))}

          |

          <b>Armada:</b>
          ${esc(vehicle)}

          |

          <b>Trip:</b>
          ${esc(key)}
        </p>

        <p>
          <b>Sopir:</b>
          ${details(driver)}
        </p>

        <p>
          <b>Kernet:</b>
          ${details(assistant)}
        </p>

        <p>
          <b>Penumpang sudah naik:</b>
          ${group.length}
        </p>

        <table>

          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>WhatsApp</th>
              <th>Rute</th>
              <th>Kursi</th>
              <th>Kode Booking</th>
            </tr>
          </thead>

          <tbody>
            ${tableRows}
          </tbody>

        </table>

        <p style="margin-top:24px">
          Tanda tangan petugas:
          _____________________
        </p>

        <button onclick="window.print()">
          Cetak
        </button>

      </body>

      </html>
    `);

    popup.document.close();
  }

  // ==========================================================
  // TAMPILKAN MANIFEST
  // ==========================================================

  function renderManifest(date) {

    const result = $("hsmManifestResult");

    const groups = groupManifest();

    if (!groups.size) {

      result.className = "empty";

      result.textContent =
        "Belum ada penumpang berstatus " +
        "Sudah Naik pada tanggal ini.";

      return;
    }

    result.className = "";

    result.replaceChildren();

    for (const [key, group] of groups) {

      const vehicle = tripVehicle(group[0]);

      const crew = crewFor(vehicle);

      const driver = crew.find(
        c => c.role === "driver"
      );

      const assistant = crew.find(
        c => c.role !== "driver"
      );

      const section = document.createElement(
        "section"
      );

      section.className =
        "hsm-manifest-group";

      const warning = key.startsWith(
        "TANPA-TRIP-CODE:"
      )
        ? `
          <p style="color:#b91c1c">
            Booking ini tidak memiliki trip_code,
            sehingga tidak digabung dengan
            perjalanan lain.
          </p>
        `
        : "";

      section.innerHTML = `
        <h3>
          ${esc(vehicle)}
          —
          ${esc(key)}
        </h3>

        <p>
          <b>${esc(formatDate(date))}</b>

          ·

          ${group.length}
          penumpang sudah naik
        </p>

        <p>
          Sopir:
          ${esc(driver?.name || "-")}
          (${esc(driver?.phone || "-")})
        </p>

        <p>
          Kernet:
          ${esc(assistant?.name || "-")}
          (${esc(assistant?.phone || "-")})
        </p>

        ${warning}

        <div class="hsm-manifest-scroll">

          <table class="hsm-manifest-table">

            <thead>
              <tr>
                <th>No</th>
                <th>Nama</th>
                <th>WhatsApp</th>
                <th>Naik → Turun</th>
                <th>Kursi</th>
                <th>Booking</th>
              </tr>
            </thead>

            <tbody>

              ${group.map(
                (r, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${esc(r.passenger_name)}</td>
                    <td>${esc(r.phone)}</td>
                    <td>
                      ${esc(r.origin)}
                      →
                      ${esc(r.destination)}
                    </td>
                    <td>${esc(r.seat_number)}</td>
                    <td>${esc(r.booking_code)}</td>
                  </tr>
                `
              ).join("")}

            </tbody>

          </table>

        </div>
      `;

      const printButton =
        document.createElement("button");

      printButton.type = "button";

      printButton.className =
        "hsm-manifest-button";

      printButton.textContent =
        "🖨 Cetak Manifest";

      printButton.addEventListener(
        "click",
        () => printManifest(key, date)
      );

      section.appendChild(printButton);

      result.appendChild(section);
    }
  }

  console.log(
    "HSM MANIFEST: siap. " +
    "No-show otomatis belum diaktifkan."
  );

})();
