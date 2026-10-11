/* ============================================================
   HSM TRANSPORT
   MANIFEST + BOARDING + NO SHOW
   PT HIDAYAH SARANA MULIA

   FITUR:
   - Manifest berdasarkan trip_code
   - Gabungan penumpang seluruh pool
   - Mendukung schedule_id lama dan baru
   - Rute utama Sofifi - Lelilef (PP)
   - Waktu aktual boarding WIT
   - Cetak manifest A4 landscape
   - Hanya penumpang Boarded yang dicetak
   - Perpanjangan waktu tunggu
   - Pemulihan No Show
   ============================================================ */

(() => {
  "use strict";

  const db = adminDb;

  // ==========================================================
  // KONFIGURASI
  // ==========================================================

  const LOGO_FILE = "hsm-logo.png";

  const LOGO_URL = new URL(
    LOGO_FILE,
    window.location.href
  ).href;

  const TIME_ZONE = "Asia/Jayapura";

  const $ = id => document.getElementById(id);

  const esc = value =>
    escapeHtml(
      value == null ? "" : String(value)
    );

  const safeDate = value =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || "");

  const cleanVehicle = value =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

  const paidStatus = value => {
    const status = normalizeStatus(value);

    return (
      status === "paid" ||
      status === "completed"
    );
  };

  // ==========================================================
  // IDENTITAS ARMADA
  // ==========================================================

  function tripVehicle(row) {

    const code = String(
      row.trip_code || ""
    ).toUpperCase();

    if (/HSM0?1/.test(code)) {
      return "HSM-01";
    }

    if (/HSM0?2/.test(code)) {
      return "HSM-02";
    }

    return getVehicle(row);
  }

  // ==========================================================
  // TANGGAL WIT
  // ==========================================================

  function todayWIT() {

    const parts = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(new Date());

    const get = type =>
      parts.find(
        part => part.type === type
      )?.value;

    return (
      `${get("year")}-` +
      `${get("month")}-` +
      `${get("day")}`
    );
  }

  // ==========================================================
  // FORMAT WAKTU WIT
  // ==========================================================

  function formatTimeWIT(value) {

    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (
      Number.isNaN(date.getTime())
    ) {
      return "-";
    }

    const parts = new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }
    ).formatToParts(date);

    const hour = parts.find(
      part => part.type === "hour"
    )?.value;

    const minute = parts.find(
      part => part.type === "minute"
    )?.value;

    return `${hour}.${minute}`;
  }

  function formatDeadlineWIT(value) {

    if (!value) {
      return "Belum tersedia";
    }

    const date = new Date(value);

    if (
      Number.isNaN(date.getTime())
    ) {
      return "Waktu tidak valid";
    }

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }
    ).format(date) + " WIT";
  }

  // ==========================================================
  // IDENTITAS PERJALANAN
  // ==========================================================

  function tripDepartureTime(code, group) {

    const value = String(
      code || ""
    ).toUpperCase();

    if (/-AM-/.test(value)) {
      return "09.00 WIT";
    }

    if (/-PM-/.test(value)) {
      return "13.00 WIT";
    }

    // Untuk kode perjalanan lama yang tidak mengikuti
    // format AM/PM, jangan mengarang jam keberangkatan.

    return "Tidak tersedia";
  }

  function tripDirection(code, group) {

    const vehicle = tripVehicle(group[0]);

    const value = String(
      code || ""
    ).toUpperCase();

    const isMorning = /-AM-/.test(value);

    const isAfternoon = /-PM-/.test(value);

    // Pola armada berdasarkan jadwal HSM Transport:
    //
    // HSM-01 pagi  : Sofifi -> Lelilef
    // HSM-02 pagi  : Lelilef -> Sofifi
    // HSM-01 siang : Lelilef -> Sofifi
    // HSM-02 siang : Sofifi -> Lelilef

    if (
      (vehicle === "HSM-01" && isMorning) ||
      (vehicle === "HSM-02" && isAfternoon)
    ) {
      return {
        start: "Sofifi",
        end: "Lelilef",
        label: "Sofifi → Loleo → Weda → Lelilef"
      };
    }

    if (
      (vehicle === "HSM-02" && isMorning) ||
      (vehicle === "HSM-01" && isAfternoon)
    ) {
      return {
        start: "Lelilef",
        end: "Sofifi",
        label: "Lelilef → Weda → Loleo → Sofifi"
      };
    }

    // Fallback untuk data lama.

    const first = group[0];

    return {
      start: first.origin || "-",
      end: first.destination || "-",
      label:
        `${first.origin || "-"} → ` +
        `${first.destination || "-"}`
    };
  }

  // ==========================================================
  // URUTAN TITIK PERJALANAN
  // ==========================================================

  function stopOrder(direction) {

    if (direction.start === "Sofifi") {
      return [
        "Sofifi",
        "Loleo",
        "Weda",
        "Lelilef"
      ];
    }

    if (direction.start === "Lelilef") {
      return [
        "Lelilef",
        "Weda",
        "Loleo",
        "Sofifi"
      ];
    }

    return [];
  }

  function sortManifestRows(rows, direction) {

    const stops = stopOrder(direction);

    const stopIndex = name => {

      const index = stops.findIndex(
        stop =>
          stop.toLowerCase() ===
          String(name || "").toLowerCase()
      );

      return index === -1 ? 999 : index;
    };

    return [...rows].sort((a, b) => {

      const originDiff =
        stopIndex(a.origin) -
        stopIndex(b.origin);

      if (originDiff !== 0) {
        return originDiff;
      }

      const seatDiff =
        Number(a.seat_number || 0) -
        Number(b.seat_number || 0);

      if (seatDiff !== 0) {
        return seatDiff;
      }

      return String(
        a.passenger_name || ""
      ).localeCompare(
        String(b.passenger_name || ""),
        "id"
      );
    });
  }

  // ==========================================================
  // CSS DASHBOARD
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
      cursor: pointer;
    }

    .hsm-manifest-meta {
      color: #475569;
      font-size: 13px;
      line-height: 1.7;
      margin: 10px 0;
    }

    .hsm-manifest-count {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 800;
      margin: 6px 0;
    }

    .hsm-wait-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 8px;
      align-items: center;
    }

    .hsm-wait-deadline {
      display: block;
      width: 100%;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 4px;
    }

    .hsm-wait-btn {
      border: 0;
      border-radius: 8px;
      padding: 9px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      background: #0754a6;
      color: white;
    }

    .hsm-wait-restore {
      background: #b45309;
    }

    .hsm-wait-btn:disabled {
      opacity: 0.5;
      cursor: wait;
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
        Manifest menampilkan seluruh penumpang
        yang sudah dikonfirmasi naik.

        Data digabungkan dari semua pool
        berdasarkan kode perjalanan.

        Manifest dapat dicetak ulang kapan saja
        mengikuti data boarding terbaru.
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
          🔄 Perbarui Manifest
        </button>

      </div>

      <div
        id="hsmManifestResult"
        class="empty"
      >
        Pilih tanggal lalu tekan Perbarui Manifest.
      </div>

    </div>

  `;

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
  // DATA BOARDING TERBARU
  // ==========================================================

  async function getBoardingDetails(bookingId) {

    const { data, error } = await db
      .from("bookings")
      .select(`
        id,
        origin,
        payment_status,
        boarding_status,
        boarding_deadline
      `)
      .eq("id", bookingId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // ==========================================================
  // TOMBOL BOARDING
  // ==========================================================

  const list = $("bookingList");

  function decorateBookings() {

    if (
      !list ||
      !Array.isArray(bookings)
    ) {
      return;
    }

    list.querySelectorAll(
      ".booking-card"
    ).forEach(card => {

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

      const row = bookings.find(
        b => String(b.id) === String(id)
      );

      if (!row) {
        return;
      }

      const actions = card.querySelector(
        ".actions"
      );

      if (!actions) {
        return;
      }

      card.dataset.hsmBoardingReady = "1";

      const boarding = String(
        row.boarding_status || "not_boarded"
      );

      const payment = normalizeStatus(
        row.payment_status
      );

      // ======================================================
      // KONTROL WAKTU TUNGGU
      // ======================================================

      if (
        boarding === "not_boarded" ||
        boarding === "no_show"
      ) {

        const controls =
          document.createElement("div");

        controls.className =
          "hsm-wait-controls";

        const deadlineLabel =
          document.createElement("span");

        deadlineLabel.className =
          "hsm-wait-deadline";

        deadlineLabel.textContent =
          "Memuat batas waktu...";

        controls.appendChild(
          deadlineLabel
        );

        if (
          boarding === "not_boarded" &&
          paidStatus(payment)
        ) {

          [15, 30].forEach(minutes => {

            const button =
              document.createElement("button");

            button.type = "button";

            button.className =
              "hsm-wait-btn";

            button.textContent =
              `⏳ +${minutes} Menit`;

            button.dataset.hsmExtendId = id;

            button.dataset.hsmExtendMinutes =
              minutes;

            controls.appendChild(button);
          });

        } else if (
          boarding === "no_show"
        ) {

          const button =
            document.createElement("button");

          button.type = "button";

          button.className =
            "hsm-wait-btn hsm-wait-restore";

          button.textContent =
            "🔄 Batalkan No Show";

          button.dataset.hsmRestoreId = id;

          controls.appendChild(button);
        }

        actions.appendChild(controls);

        getBoardingDetails(id)
          .then(data => {

            if (!controls.isConnected) {
              return;
            }

            deadlineLabel.textContent =
              "🕒 Batas waktu: " +
              formatDeadlineWIT(
                data.boarding_deadline
              );

          })
          .catch(error => {

            if (!controls.isConnected) {
              return;
            }

            deadlineLabel.textContent =
              "Gagal memuat batas waktu: " +
              error.message;
          });
      }

      // ======================================================
      // STATUS PENUMPANG
      // ======================================================

      if (
        boarding === "boarded"
      ) {

        const badge =
          document.createElement("span");

        badge.className =
          "hsm-board-badge";

        badge.textContent =
          "✓ Sudah Naik";

        actions.prepend(badge);

      } else if (
        boarding === "no_show"
      ) {

        const badge =
          document.createElement("span");

        badge.className =
          "hsm-board-badge";

        badge.style.color =
          "#b91c1c";

        badge.textContent =
          "Tidak Hadir (No Show)";

        actions.prepend(badge);

      } else if (
        paidStatus(payment)
      ) {

        const button =
          document.createElement("button");

        button.type = "button";

        button.className =
          "hsm-board-btn";

        button.textContent =
          "✓ Konfirmasi Sudah Naik";

        button.dataset.hsmBoardId = id;

        actions.prepend(button);
      }
    });
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
    // KONFIRMASI SUDAH NAIK
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

        const id =
          button.dataset.hsmBoardId;

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
            row.passenger_name ||
            row.booking_code
          } sudah naik di ${row.origin}?`
        );

        if (!confirmed) {
          return;
        }

        button.disabled = true;

        try {

          const {
            data: auth,
            error: authError
          } = await db.auth.getUser();

          if (authError) {
            throw authError;
          }

          if (
            !auth?.user ||
            !(await verifyAdmin())
          ) {

            throw new Error(
              "Sesi admin tidak valid."
            );
          }

          const {
            data,
            error
          } = await db
            .from("bookings")
            .update({
              boarding_status: "boarded",
              boarded_at:
                new Date().toISOString(),
              boarded_by: auth.user.id
            })
            .eq("id", id)
            .eq("origin", selectedPool)
            .eq(
              "boarding_status",
              "not_boarded"
            )
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
              "Booking sudah berubah, " +
              "belum lunas, atau tidak " +
              "bisa dikonfirmasi."
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

    // ========================================================
    // PERPANJANG WAKTU / BATALKAN NO SHOW
    // ========================================================

    list.addEventListener(
      "click",
      async event => {

        const extendButton =
          event.target.closest(
            "[data-hsm-extend-id]"
          );

        const restoreButton =
          event.target.closest(
            "[data-hsm-restore-id]"
          );

        if (
          !extendButton &&
          !restoreButton
        ) {
          return;
        }

        const button =
          extendButton || restoreButton;

        if (button.disabled) {
          return;
        }

        const bookingId =
          extendButton?.dataset.hsmExtendId ||
          restoreButton?.dataset.hsmRestoreId;

        const minutes = extendButton
          ? Number(
              extendButton.dataset.hsmExtendMinutes
            )
          : 0;

        button.disabled = true;

        try {

          const {
            data: auth,
            error: authError
          } = await db.auth.getUser();

          if (authError) {
            throw authError;
          }

          if (
            !auth?.user ||
            !(await verifyAdmin())
          ) {

            throw new Error(
              "Sesi admin tidak valid."
            );
          }

          const current =
            await getBoardingDetails(
              bookingId
            );

          if (
            current.origin !== selectedPool
          ) {

            throw new Error(
              "Booking bukan dari pool aktif."
            );
          }

          if (extendButton) {

            if (
              current.boarding_status !==
              "not_boarded"
            ) {

              throw new Error(
                "Penumpang tidak berstatus Belum Naik."
              );
            }

            if (
              !paidStatus(
                current.payment_status
              )
            ) {

              throw new Error(
                "Booking harus lunas."
              );
            }

            const confirmed = confirm(
              `Perpanjang waktu tunggu ${minutes} menit?\n\n` +
              `Batas waktu sekarang:\n` +
              formatDeadlineWIT(
                current.boarding_deadline
              )
            );

            if (!confirmed) {
              return;
            }

            const {
              data,
              error
            } = await db.rpc(
              "hsm_extend_boarding",
              {
                p_booking_id: bookingId,
                p_minutes: minutes
              }
            );

            if (error) {
              throw error;
            }

            alert(
              "✅ Waktu berhasil diperpanjang.\n\n" +
              "Batas waktu baru:\n" +
              formatDeadlineWIT(data)
            );

          } else {

            if (
              current.boarding_status !==
              "no_show"
            ) {

              throw new Error(
                "Booking tidak berstatus No Show."
              );
            }

            const confirmed = confirm(
              "Batalkan No Show?\n\n" +
              "Penumpang kembali menjadi Belum Naik.\n" +
              "Batas waktu baru 30 menit dari sekarang."
            );

            if (!confirmed) {
              return;
            }

            const { error } = await db.rpc(
              "hsm_restore_no_show",
              {
                p_booking_id: bookingId
              }
            );

            if (error) {
              throw error;
            }

            alert(
              "✅ No Show berhasil dibatalkan."
            );
          }

          await loadBookings();

        } catch (error) {

          console.error(
            "HSM Boarding Control:",
            error
          );

          alert(
            "Gagal memproses: " +
            (error.message || error)
          );

        } finally {

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

  // ==========================================================
  // AMBIL DATA MANIFEST SEMUA POOL
  // ==========================================================

  async function loadManifest() {

    const result =
      $("hsmManifestResult");

    const date =
      $("hsmManifestDate").value;

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

      for (
        let from = 0;
        from < 10000;
        from += 500
      ) {

        const {
          data,
          error
        } = await db
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
            schedule_id,
            travel_date,
            departure_time,
            boarding_status,
            boarded_at,
            payment_status,
            created_at
          `)
          .eq(
            "travel_date",
            date
          )
          .eq(
            "boarding_status",
            "boarded"
          )
          .in(
            "payment_status",
            ["paid", "completed"]
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          )
          .order(
            "id",
            {
              ascending: true
            }
          )
          .range(
            from,
            from + 499
          );

        if (error) {
          throw error;
        }

        rows.push(
          ...(data || [])
        );

        if (
          !data ||
          data.length < 500
        ) {
          break;
        }
      }

      const crewResult = await db
        .from("hsm_crew")
        .select(
          "vehicle,role,name,phone"
        );

      if (crewResult.error) {
        throw crewResult.error;
      }

      manifestRows = rows;

      manifestCrew =
        crewResult.data || [];

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
  // DATA SOPIR DAN KERNET
  // ==========================================================

  function crewFor(vehicle) {

    return manifestCrew.filter(
      person =>
        cleanVehicle(person.vehicle) ===
        cleanVehicle(vehicle)
    );
  }

  function getCrewDetails(vehicle) {

    const crew =
      crewFor(vehicle);

    const driver = crew.find(
      person =>
        String(person.role || "")
          .toLowerCase() === "driver"
    );

    const assistant = crew.find(
      person =>
        String(person.role || "")
          .toLowerCase() !== "driver"
    );

    return {
      driver,
      assistant
    };
  }

  // ==========================================================
  // CETAK MANIFEST
  // ==========================================================

  function printManifest(key, date) {

    const group =
      groupManifest().get(key);

    if (!group?.length) {
      return;
    }

    const vehicle =
      tripVehicle(group[0]);

    const direction =
      tripDirection(key, group);

    const departure =
      tripDepartureTime(key, group);

    const sortedRows =
      sortManifestRows(
        group,
        direction
      );

    const {
      driver,
      assistant
    } = getCrewDetails(vehicle);

    const details = person =>
      person
        ? `${esc(person.name)} — ${esc(person.phone)}`
        : "-";

    const tableRows =
      sortedRows.map(
        (row, index) => `

          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${esc(row.passenger_name)}
            </td>

            <td>
              ${esc(row.phone)}
            </td>

            <td>
              ${esc(row.seat_number)}
            </td>

            <td>
              ${esc(row.origin)}
            </td>

            <td>
              ${esc(row.destination)}
            </td>

            <td>
              ${esc(
                formatTimeWIT(
                  row.boarded_at
                )
              )}
            </td>

            <td>
              ${esc(row.booking_code)}
            </td>

          </tr>

        `
      ).join("");

    const popup = window.open(
      "",
      "_blank",
      "width=1100,height=800"
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

          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #111111;
          }

          .manifest-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            text-align: center;
            border-bottom: 3px solid #0754a6;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }

          .manifest-logo {
            width: 260px;
            height: 150px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
          }

          .manifest-company {
            text-align: center;
            width: 100%;
          }

          .manifest-company h1 {
            font-size: 22px;
            margin: 0 0 5px;
            color: #0754a6;
          }

          .manifest-company h2 {
            font-size: 17px;
            margin: 0 0 5px;
          }

          .manifest-company p {
            font-size: 13px;
            margin: 0;
          }

          .manifest-info {
            margin-bottom: 15px;
            line-height: 1.6;
          }

          .manifest-info p {
            margin: 4px 0;
          }

          .manifest-route {
            background: #eaf2fc;
            border-left: 4px solid #0754a6;
            padding: 10px 12px;
            margin: 12px 0;
            font-weight: bold;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 11px;
          }

          th,
          td {
            border: 1px solid #555555;
            padding: 7px;
            text-align: left;
            vertical-align: top;
            overflow-wrap: anywhere;
          }

          th {
            background: #eaf2fc;
          }

          .manifest-footer {
            margin-top: 30px;
            text-align: right;
          }

          .manifest-footer p {
            margin-bottom: 50px;
          }

          .print-button {
            margin-top: 20px;
            background: #0754a6;
            color: white;
            padding: 10px 18px;
            border: 0;
            border-radius: 7px;
            cursor: pointer;
          }

          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          @media print {

            body {
              padding: 0;
            }

            .print-button {
              display: none;
            }

            .manifest-header,
            th,
            .manifest-route {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

          }

        </style>

      </head>

      <body>

        <div class="manifest-header">

          <img
            src="${esc(LOGO_URL)}"
            class="manifest-logo"
            alt="Logo HSM Transport"
          >

          <div class="manifest-company">

            <h1>
              PT HIDAYAH SARANA MULIA
            </h1>

            <h2>
              MANIFEST PENUMPANG
            </h2>

            <p>
              HSM TRANSPORT
            </p>

          </div>

        </div>

        <div class="manifest-info">

          <p>
            <b>Tanggal:</b>
            ${esc(formatDate(date))}
          </p>

          <p>
            <b>Armada:</b>
            ${esc(vehicle)}
          </p>

          <p>
            <b>Kode Perjalanan:</b>
            ${esc(key)}
          </p>

          <p>
            <b>Keberangkatan:</b>
            ${esc(departure)}
          </p>

          <div class="manifest-route">

            RUTE PERJALANAN:
            ${esc(direction.label)}

          </div>

          <p>
            <b>Sopir:</b>
            ${details(driver)}
          </p>

          <p>
            <b>Kernet:</b>
            ${details(assistant)}
          </p>

          <p>
            <b>Jumlah Penumpang Sudah Naik:</b>
            ${sortedRows.length} orang
          </p>

        </div>

        <table>

          <thead>

            <tr>
              <th>No</th>
              <th>Nama Penumpang</th>
              <th>WhatsApp</th>
              <th>Kursi</th>
              <th>Naik Dari</th>
              <th>Turun Di</th>
              <th>Waktu Naik (WIT)</th>
              <th>Kode Booking</th>
            </tr>

          </thead>

          <tbody>
            ${tableRows}
          </tbody>

        </table>

        <div class="manifest-footer">

          <p>
            Petugas HSM Transport
          </p>

          <strong>
            _______________________
          </strong>

        </div>

        <button
          class="print-button"
          onclick="window.print()"
        >
          🖨 Cetak Manifest
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

    const result =
      $("hsmManifestResult");

    const groups =
      groupManifest();

    if (!groups.size) {

      result.className = "empty";

      result.textContent =
        "Belum ada penumpang berstatus " +
        "Sudah Naik pada tanggal ini.";

      return;
    }

    result.className = "";

    result.replaceChildren();

    for (
      const [key, group] of groups
    ) {

      const vehicle =
        tripVehicle(group[0]);

      const direction =
        tripDirection(key, group);

      const departure =
        tripDepartureTime(key, group);

      const sortedRows =
        sortManifestRows(
          group,
          direction
        );

      const {
        driver,
        assistant
      } = getCrewDetails(vehicle);

      const section =
        document.createElement("section");

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

        <div class="hsm-manifest-meta">

          <div>
            <b>Tanggal:</b>
            ${esc(formatDate(date))}
          </div>

          <div>
            <b>Keberangkatan:</b>
            ${esc(departure)}
          </div>

          <div>
            <b>Rute:</b>
            ${esc(direction.label)}
          </div>

          <div>
            <b>Sopir:</b>
            ${esc(driver?.name || "-")}
            (${esc(driver?.phone || "-")})
          </div>

          <div>
            <b>Kernet:</b>
            ${esc(assistant?.name || "-")}
            (${esc(assistant?.phone || "-")})
          </div>

        </div>

        <div class="hsm-manifest-count">

          ✓ ${sortedRows.length}
          Penumpang Sudah Naik

        </div>

        ${warning}

        <div class="hsm-manifest-scroll">

          <table class="hsm-manifest-table">

            <thead>

              <tr>
                <th>No</th>
                <th>Nama</th>
                <th>WhatsApp</th>
                <th>Kursi</th>
                <th>Naik Dari</th>
                <th>Turun Di</th>
                <th>Waktu Naik (WIT)</th>
                <th>Booking</th>
              </tr>

            </thead>

            <tbody>

              ${sortedRows.map(
                (row, index) => `

                  <tr>

                    <td>
                      ${index + 1}
                    </td>

                    <td>
                      ${esc(row.passenger_name)}
                    </td>

                    <td>
                      ${esc(row.phone)}
                    </td>

                    <td>
                      ${esc(row.seat_number)}
                    </td>

                    <td>
                      ${esc(row.origin)}
                    </td>

                    <td>
                      ${esc(row.destination)}
                    </td>

                    <td>
                      ${esc(
                        formatTimeWIT(
                          row.boarded_at
                        )
                      )}
                    </td>

                    <td>
                      ${esc(row.booking_code)}
                    </td>

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

      section.appendChild(
        printButton
      );

      result.appendChild(
        section
      );
    }
  }

  console.log(
    "HSM MANIFEST: Sistem manifest, boarding, " +
    "No Show, dan waktu naik WIT siap."
  );

})();
