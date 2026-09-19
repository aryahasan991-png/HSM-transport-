<!DOCTYPE html>
<html lang="id">

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="theme-color"
    content="#0754a6"
  >

  <title>Verifikasi Tiket | HSM Transport</title>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: #f3f6fa;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
    }

    .page {
      width: min(520px, 100%);
      margin: 0 auto;
      padding: 25px 15px 50px;
    }

    .brand {
      text-align: center;
      margin-bottom: 20px;
    }

    .logo {
      font-size: 35px;
      font-weight: 900;
      letter-spacing: -2px;
    }

    .transport {
      margin-top: -3px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 5px;
    }

    .company {
      margin-top: 8px;
      color: #6b7280;
      font-size: 11px;
      font-weight: 700;
    }

    .card {
      overflow: hidden;
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      background: #ffffff;
      box-shadow:
        0 10px 30px
        rgba(15, 23, 42, .08);
    }

    .status-area {
      padding: 25px 18px;
      text-align: center;
    }

    .status-icon {
      display: flex;
      align-items: center;
      justify-content: center;

      width: 70px;
      height: 70px;

      margin: 0 auto 13px;

      border-radius: 50%;

      font-size: 35px;
      font-weight: 900;
    }

    .status-title {
      margin: 0;
      font-size: 23px;
      font-weight: 900;
    }

    .status-description {
      margin: 7px auto 0;
      max-width: 360px;
      color: #6b7280;
      font-size: 12px;
      line-height: 1.5;
    }

    /* VALID */

    .valid .status-icon {
      background: #dcfce7;
      color: #166534;
    }

    .valid .status-title {
      color: #166534;
    }

    /* WARNING */

    .pending .status-icon,
    .future .status-icon {
      background: #fef3c7;
      color: #92400e;
    }

    .pending .status-title,
    .future .status-title {
      color: #92400e;
    }

    /* CANCEL / EXPIRED */

    .cancelled .status-icon,
    .expired .status-icon {
      background: #fee2e2;
      color: #991b1b;
    }

    .cancelled .status-title,
    .expired .status-title {
      color: #991b1b;
    }

    /* COMPLETED */

    .completed .status-icon {
      background: #dbeafe;
      color: #1e40af;
    }

    .completed .status-title {
      color: #1e40af;
    }

    /* INVALID */

    .invalid .status-icon {
      background: #f3f4f6;
      color: #374151;
    }

    .invalid .status-title {
      color: #374151;
    }

    /* LOADING */

    .loading .status-icon {
      background: #e5e7eb;
      color: #374151;
    }

    .ticket-data {
      display: none;
      border-top: 1px solid #e5e7eb;
      padding: 5px 18px 18px;
    }

    .row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 15px;

      padding: 12px 0;

      border-bottom: 1px solid #f0f1f3;
    }

    .row:last-child {
      border-bottom: 0;
    }

    .label {
      color: #6b7280;
      font-size: 11px;
    }

    .value {
      max-width: 65%;
      text-align: right;
      font-size: 12px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .booking-code {
      font-size: 14px;
      font-weight: 900;
    }

    .manual {
      margin-top: 16px;
      padding: 15px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #ffffff;
    }

    .manual-title {
      margin-bottom: 8px;
      font-size: 11px;
      font-weight: 900;
    }

    .manual-box {
      display: flex;
      gap: 7px;
    }

    .manual input {
      width: 100%;
      min-width: 0;
      height: 42px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 0 10px;
      outline: none;
      text-transform: uppercase;
    }

    .manual input:focus {
      border-color: #0754a6;
    }

    .manual button {
      flex: 0 0 auto;
      min-height: 42px;
      border: 0;
      border-radius: 8px;
      padding: 0 14px;
      background: #0754a6;
      color: #ffffff;
      font-weight: 900;
      cursor: pointer;
    }

    .footer {
      margin-top: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 10px;
      line-height: 1.7;
    }

    .footer strong {
      color: #111827;
    }
  </style>

</head>

<body>

  <main class="page">

    <div class="brand">

      <div class="logo">
        HSM
      </div>

      <div class="transport">
        TRANSPORT
      </div>

      <div class="company">
        PT HIDAYAH SARANA MULIA
      </div>

    </div>


    <section class="card">

      <div
        id="statusArea"
        class="status-area loading"
      >

        <div
          id="statusIcon"
          class="status-icon"
        >
          •
        </div>

        <h1
          id="statusTitle"
          class="status-title"
        >
          Memeriksa Tiket
        </h1>

        <p
          id="statusDescription"
          class="status-description"
        >
          Mohon tunggu. Sistem sedang memeriksa tiket HSM Transport.
        </p>

      </div>


      <div
        id="ticketData"
        class="ticket-data"
      >

        <div class="row">
          <span class="label">
            Kode Booking
          </span>

          <strong
            id="bookingCode"
            class="value booking-code"
          >
            -
          </strong>
        </div>


        <div class="row">
          <span class="label">
            Nama Penumpang
          </span>

          <strong
            id="passengerName"
            class="value"
          >
            -
          </strong>
        </div>


        <div class="row">
          <span class="label">
            Rute
          </span>

          <strong
            id="route"
            class="value"
          >
            -
          </strong>
        </div>


        <div class="row">
          <span class="label">
            Tanggal
          </span>

          <strong
            id="travelDate"
            class="value"
          >
            -
          </strong>
        </div>


        <div class="row">
          <span class="label">
            Jam
          </span>

          <strong
            id="departureTime"
            class="value"
          >
            -
          </strong>
        </div>


        <div class="row">
          <span class="label">
            Armada
          </span>

          <strong
            id="vehicle"
            class="value"
          >
            -
          </strong>
        </div>


        <div class="row">
          <span class="label">
            Nomor Kursi
          </span>

          <strong
            id="seatNumber"
            class="value"
          >
            -
          </strong>
        </div>

      </div>

    </section>


    <section class="manual">

      <div class="manual-title">
        Verifikasi kode booking
      </div>

      <div class="manual-box">

        <input
          id="manualCode"
          type="text"
          placeholder="Contoh: HSM-B80E4E"
          autocomplete="off"
        >

        <button
          id="verifyButton"
          type="button"
        >
          Cek
        </button>

      </div>

    </section>


    <div class="footer">

      <strong>
        HSM Transport
      </strong>

      <br>

      PT Hidayah Sarana Mulia

      <br>

      081356902006

      <br>

      hsm-transport.vercel.app

      <br><br>

      <strong>
        Satu Perjalanan, Banyak Cerita
      </strong>

    </div>

  </main>


  <script src="config.js"></script>


  <script>

    // ======================================================
    // CONFIG
    // ======================================================

    const HSM_CONFIG =
      window.HSM_CONFIG;


    if (
      !HSM_CONFIG ||
      !window.supabase
    ) {

      throw new Error(
        "Konfigurasi HSM tidak ditemukan."
      );
    }


    const db =
      window.supabase.createClient(
        HSM_CONFIG.SUPABASE_URL,
        HSM_CONFIG.SUPABASE_PUBLISHABLE_KEY
      );


    // ======================================================
    // ELEMENT
    // ======================================================

    const statusArea =
      document.getElementById(
        "statusArea"
      );

    const statusIcon =
      document.getElementById(
        "statusIcon"
      );

    const statusTitle =
      document.getElementById(
        "statusTitle"
      );

    const statusDescription =
      document.getElementById(
        "statusDescription"
      );

    const ticketData =
      document.getElementById(
        "ticketData"
      );

    const bookingCode =
      document.getElementById(
        "bookingCode"
      );

    const passengerName =
      document.getElementById(
        "passengerName"
      );

    const route =
      document.getElementById(
        "route"
      );

    const travelDate =
      document.getElementById(
        "travelDate"
      );

    const departureTime =
      document.getElementById(
        "departureTime"
      );

    const vehicle =
      document.getElementById(
        "vehicle"
      );

    const seatNumber =
      document.getElementById(
        "seatNumber"
      );

    const manualCode =
      document.getElementById(
        "manualCode"
      );

    const verifyButton =
      document.getElementById(
        "verifyButton"
      );


    // ======================================================
    // STATUS
    // ======================================================

    function normalizeStatus(value) {

      const status =
        String(value || "")
          .trim()
          .toLowerCase();


      if (
        status === "paid" ||
        status === "success" ||
        status === "settled" ||
        status === "lunas"
      ) {
        return "paid";
      }


      if (
        status === "completed" ||
        status === "selesai"
      ) {
        return "completed";
      }


      if (
        status === "cancelled" ||
        status === "canceled" ||
        status === "dibatalkan" ||
        status === "failed" ||
        status === "gagal"
      ) {
        return "cancelled";
      }


      return "pending";
    }


    // ======================================================
    // WIT DATE
    // ======================================================

    function getTodayWIT() {

      const parts =
        new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone:
              "Asia/Jayapura",

            year:
              "numeric",

            month:
              "2-digit",

            day:
              "2-digit"
          }
        )
        .formatToParts(
          new Date()
        );


      const values = {};


      parts.forEach(
        part => {

          if (
            part.type !==
            "literal"
          ) {

            values[
              part.type
            ] =
              part.value;

          }

        }
      );


      return (
        values.year +
        "-" +
        values.month +
        "-" +
        values.day
      );
    }


    // ======================================================
    // DATE
    // ======================================================

    function formatDate(value) {

      if (!value) {
        return "-";
      }


      const parts =
        String(value)
          .split("-");


      if (
        parts.length !== 3
      ) {
        return value;
      }


      const months = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember"
      ];


      const year =
        parts[0];

      const month =
        Number(
          parts[1]
        );

      const day =
        Number(
          parts[2]
        );


      if (
        !month ||
        month < 1 ||
        month > 12
      ) {
        return value;
      }


      return (
        day +
        " " +
        months[
          month - 1
        ] +
        " " +
        year
      );
    }


    function formatTime(value) {

      if (!value) {
        return "-";
      }


      return (
        String(value)
          .substring(
            0,
            5
          ) +
        " WIT"
      );
    }


    // ======================================================
    // VEHICLE
    // ======================================================

    function getVehicle(ticket) {

      if (
        ticket.vehicle &&
        String(
          ticket.vehicle
        ).trim()
      ) {

        return String(
          ticket.vehicle
        ).trim();
      }


      const origin =
        String(
          ticket.origin || ""
        )
          .trim()
          .toLowerCase();


      const time =
        String(
          ticket.departure_time || ""
        )
          .substring(
            0,
            5
          );


      if (
        origin === "sofifi" &&
        time === "09:00"
      ) {
        return "HSM-01";
      }


      if (
        origin === "lelilef" &&
        time === "09:00"
      ) {
        return "HSM-02";
      }


      if (
        origin === "lelilef" &&
        time === "13:00"
      ) {
        return "HSM-01";
      }


      if (
        origin === "sofifi" &&
        time === "13:00"
      ) {
        return "HSM-02";
      }


      return "-";
    }


    // ======================================================
    // UI
    // ======================================================

    function setStatus(
      type,
      icon,
      title,
      description
    ) {

      statusArea.className =
        "status-area " +
        type;


      statusIcon.textContent =
        icon;


      statusTitle.textContent =
        title;


      statusDescription.textContent =
        description;
    }


    function clearTicket() {

      ticketData.style.display =
        "none";


      bookingCode.textContent =
        "-";

      passengerName.textContent =
        "-";

      route.textContent =
        "-";

      travelDate.textContent =
        "-";

      departureTime.textContent =
        "-";

      vehicle.textContent =
        "-";

      seatNumber.textContent =
        "-";
    }


    function showTicket(ticket) {

      bookingCode.textContent =
        ticket.booking_code ||
        "-";


      passengerName.textContent =
        ticket.passenger_name ||
        "-";


      route.textContent =
        (
          ticket.origin ||
          "-"
        ) +
        " → " +
        (
          ticket.destination ||
          "-"
        );


      travelDate.textContent =
        formatDate(
          ticket.travel_date
        );


      departureTime.textContent =
        formatTime(
          ticket.departure_time
        );


      vehicle.textContent =
        getVehicle(
          ticket
        );


      seatNumber.textContent =
        ticket.seat_number ||
        "-";


      ticketData.style.display =
        "block";
    }


    // ======================================================
    // VERIFY
    // ======================================================

    async function verifyTicket(
      rawCode
    ) {

      const code =
        String(
          rawCode || ""
        )
          .trim()
          .toUpperCase();


      clearTicket();


      if (!code) {

        setStatus(
          "invalid",
          "!",
          "Kode Tidak Ada",
          "Masukkan kode booking HSM Transport."
        );

        return;
      }


      setStatus(
        "loading",
        "•",
        "Memeriksa Tiket",
        "Sistem sedang memeriksa kode " +
        code +
        "."
      );


      try {

        // ====================================================
        // VERIFIKASI MELALUI RPC
        // ====================================================

        const {
          data,
          error
        } =
          await db.rpc(
            "verify_hsm_ticket",
            {
              p_booking_code:
                code
            }
          );


        if (error) {
          throw error;
        }


        const ticket =
          Array.isArray(
            data
          )
            ? data[0]
            : data;


        if (!ticket) {

          setStatus(
            "invalid",
            "×",
            "TIKET TIDAK DITEMUKAN",
            "Kode booking tidak terdaftar pada sistem HSM Transport."
          );

          return;
        }


        showTicket(
          ticket
        );


        const status =
          normalizeStatus(
            ticket.payment_status
          );


        const todayWIT =
          getTodayWIT();


        const ticketDate =
          String(
            ticket.travel_date ||
            ""
          ).trim();


        // ====================================================
        // 1. CANCELLED
        // PRIORITAS PALING TINGGI
        // ====================================================

        if (
          status ===
          "cancelled"
        ) {

          setStatus(
            "cancelled",
            "×",
            "TIKET DIBATALKAN",
            "Tiket ini telah dibatalkan dan tidak berlaku untuk perjalanan."
          );

          return;
        }


        // ====================================================
        // 2. BELUM LUNAS
        // ====================================================

        if (
          status ===
          "pending"
        ) {

          setStatus(
            "pending",
            "!",
            "BELUM LUNAS",
            "Booking terdaftar tetapi pembayaran belum dikonfirmasi."
          );

          return;
        }


        // ====================================================
        // VALIDASI TANGGAL
        // ====================================================

        if (!ticketDate) {

          setStatus(
            "invalid",
            "!",
            "TANGGAL TIDAK VALID",
            "Tanggal perjalanan tiket tidak ditemukan."
          );

          return;
        }


        // ====================================================
        // 3. TANGGAL SUDAH LEWAT
        // ====================================================

        if (
          ticketDate <
          todayWIT
        ) {

          setStatus(
            "expired",
            "×",
            "TIKET KEDALUWARSA",
            "Tanggal perjalanan tiket ini telah lewat. Tiket tidak berlaku untuk perjalanan hari ini."
          );

          return;
        }


        // ====================================================
        // 4. TANGGAL MASIH AKAN DATANG
        // ====================================================

        if (
          ticketDate >
          todayWIT
        ) {

          setStatus(
            "future",
            "!",
            "TIKET BELUM BERLAKU",
            "Tiket ini terdaftar, tetapi hanya berlaku pada " +
            formatDate(
              ticketDate
            ) +
            "."
          );

          return;
        }


        // ====================================================
        // 5. COMPLETED HARI INI
        // ====================================================

        if (
          status ===
          "completed"
        ) {

          setStatus(
            "completed",
            "✓",
            "PERJALANAN SELESAI",
            "Tiket terdaftar dan perjalanan ini telah ditandai selesai."
          );

          return;
        }


        // ====================================================
        // 6. PAID + HARI INI
        // ====================================================

        if (
          status ===
          "paid"
        ) {

          setStatus(
            "valid",
            "✓",
            "TIKET VALID • LUNAS",
            "Tiket berlaku untuk perjalanan hari ini dan pembayaran telah dikonfirmasi."
          );

          return;
        }


        // ====================================================
        // FALLBACK
        // ====================================================

        setStatus(
          "invalid",
          "!",
          "STATUS TIDAK VALID",
          "Status tiket tidak dapat diverifikasi."
        );

      }

      catch (error) {

        console.error(
          "VERIFY ERROR:",
          error
        );


        setStatus(
          "invalid",
          "!",
          "VERIFIKASI GAGAL",
          "Sistem tidak dapat memeriksa tiket saat ini."
        );
      }
    }


    // ======================================================
    // MANUAL VERIFY
    // ======================================================

    verifyButton.addEventListener(
      "click",
      function () {

        const code =
          manualCode.value;


        if (
          !code.trim()
        ) {
          return;
        }


        const cleanCode =
          code
            .trim()
            .toUpperCase();


        const url =
          new URL(
            window.location.href
          );


        url.searchParams.set(
          "kode",
          cleanCode
        );


        window.history.replaceState(
          {},
          "",
          url
        );


        verifyTicket(
          cleanCode
        );
      }
    );


    manualCode.addEventListener(
      "keydown",
      function (event) {

        if (
          event.key ===
          "Enter"
        ) {

          verifyButton.click();
        }
      }
    );


    // ======================================================
    // INITIAL
    // ======================================================

    const params =
      new URLSearchParams(
        window.location.search
      );


    const initialCode =
      params.get(
        "kode"
      );


    if (initialCode) {

      manualCode.value =
        initialCode
          .trim()
          .toUpperCase();


      verifyTicket(
        initialCode
      );

    }

    else {

      clearTicket();


      setStatus(
        "invalid",
        "?",
        "Verifikasi Tiket",
        "Scan QR pada tiket atau masukkan kode booking untuk melakukan verifikasi."
      );
    }

  </script>

</body>

</html>
