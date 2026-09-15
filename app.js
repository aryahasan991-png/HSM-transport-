const scheduleEl = document.getElementById("schedule");

scheduleEl.innerHTML = `
  <div style="
    padding:20px;
    background:#fff3cd;
    border:1px solid #ffe69c;
    border-radius:10px;
    color:#664d03;
  ">
    <b>APP.JS TERBACA ✅</b><br>
    Sedang mengecek database...
  </div>
`;

async function testDatabase() {
  try {
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .limit(20);

    if (error) {
      scheduleEl.innerHTML = `
        <div style="padding:20px;color:red">
          <b>SUPABASE ERROR ❌</b><br><br>
          ${error.message}
        </div>
      `;
      return;
    }

    if (!data || data.length === 0) {
      scheduleEl.innerHTML = `
        <div style="padding:20px;color:red">
          <b>DATABASE KOSONG ❌</b><br><br>
          Tabel schedules tidak mengembalikan data.
        </div>
      `;
      return;
    }

    scheduleEl.innerHTML = `
      <div style="
        padding:20px;
        background:#d1e7dd;
        border:1px solid #a3cfbb;
        border-radius:10px;
      ">
        <b>DATABASE TERBACA ✅</b><br><br>
        Jumlah data terbaca: <b>${data.length}</b>
      </div>

      <div style="margin-top:15px">
        ${data.map(row => `
          <div style="
            padding:12px;
            margin-bottom:8px;
            border:1px solid #ddd;
            border-radius:8px;
          ">
            <b>${row.route || "-"}</b><br>
            Tanggal: ${row.travel_date || "-"}<br>
            Jam: ${row.departure_time || "-"}<br>
            Harga: ${row.price || "-"}<br>
            Vehicle: ${row.vehicle || "-"}<br>
            Active: ${row.active}
          </div>
        `).join("")}
      </div>
    `;

  } catch (err) {
    scheduleEl.innerHTML = `
      <div style="padding:20px;color:red">
        <b>JAVASCRIPT ERROR ❌</b><br><br>
        ${err.message}
      </div>
    `;
  }
}

testDatabase();
