const scheduleEl = document.getElementById("schedule");

try {
  // Cek config
  if (!window.HSM_CONFIG) {
    throw new Error("config.js tidak terbaca");
  }

  // Cek library Supabase
  if (!window.supabase) {
    throw new Error("Library Supabase tidak terbaca");
  }

  // Buat koneksi Supabase
  const db = window.supabase.createClient(
    window.HSM_CONFIG.SUPABASE_URL,
    window.HSM_CONFIG.SUPABASE_PUBLISHABLE_KEY
  );

  scheduleEl.innerHTML = `
    <div style="padding:20px">
      Menghubungkan ke database...
    </div>
  `;

  async function testDatabase() {

    const { data, error } = await db
      .from("schedules")
      .select("*")
      .limit(20);

    if (error) {
      scheduleEl.innerHTML = `
        <div style="
          padding:20px;
          color:red;
          background:#ffe5e5;
          border-radius:10px;
        ">
          <b>SUPABASE ERROR ❌</b>
          <br><br>
          ${error.message}
        </div>
      `;

      return;
    }

    if (!data || data.length === 0) {
      scheduleEl.innerHTML = `
        <div style="
          padding:20px;
          color:red;
          background:#ffe5e5;
          border-radius:10px;
        ">
          <b>DATABASE TIDAK ADA DATA ❌</b>
        </div>
      `;

      return;
    }

    scheduleEl.innerHTML = `
      <div style="
        padding:20px;
        background:#d1e7dd;
        border-radius:10px;
        margin-bottom:15px;
      ">
        <b>DATABASE TERBACA ✅</b>
        <br><br>
        Ditemukan ${data.length} jadwal.
      </div>

      ${data.map(row => `
        <div style="
          padding:15px;
          margin-bottom:10px;
          border:1px solid #ddd;
          border-radius:10px;
        ">
          <b>${row.route || "-"}</b><br>
          Tanggal: ${row.travel_date || "-"}<br>
          Jam: ${row.departure_time || "-"}<br>
          Harga: Rp${Number(row.price || 0).toLocaleString("id-ID")}<br>
          Kendaraan: ${row.vehicle || "-"}<br>
          Aktif: ${row.active ? "YA" : "TIDAK"}
        </div>
      `).join("")}
    `;
  }

  testDatabase();

} catch (error) {

  scheduleEl.innerHTML = `
    <div style="
      padding:20px;
      color:red;
      background:#ffe5e5;
      border-radius:10px;
    ">
      <b>JAVASCRIPT ERROR ❌</b>
      <br><br>
      ${error.message}
    </div>
  `;

  console.error(error);
}
