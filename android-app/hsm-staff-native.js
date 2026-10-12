// ============================================================
// HSM TRANSPORT
// PT HIDAYAH SARANA MULIA
//
// KONEKSI PETUGAS KHUSUS APK ANDROID
//
// Menggunakan Capacitor Native HTTP.
//
// FITUR:
// - Mengirim request ke Supabase Edge Function.
// - Menghindari pembatasan CORS WebView.
// - Menampilkan pesan error server.
// - Tidak menyimpan PIN atau token tambahan.
// - Tidak mengubah autentikasi server.
// ============================================================

(function () {
  "use strict";

  const ENDPOINT =
    "https://lbykbgtxxlnbdixkkcsw.supabase.co/functions/v1/hsm-staff-auth";

  const TIMEOUT = 20000;

  // ==========================================================
  // DETEKSI APK ANDROID
  // ==========================================================

  function isNativeApp() {
    return (
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform()
    );
  }

  // ==========================================================
  // AMBIL NATIVE HTTP
  // ==========================================================

  function getNativeHTTP() {
    if (!isNativeApp()) {
      return null;
    }

    return (
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.CapacitorHttp
    ) || null;
  }

  // ==========================================================
  // NORMALISASI RESPONS
  // ==========================================================

  function parseResponse(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        throw new Error(
          "Respons server HSM Transport bukan JSON yang valid."
        );
      }
    }

    if (
      value &&
      typeof value === "object"
    ) {
      return value;
    }

    throw new Error(
      "Server HSM Transport tidak mengembalikan data yang valid."
    );
  }

  // ==========================================================
  // REQUEST API PETUGAS
  // ==========================================================

  async function request(action, data = {}) {
    const http = getNativeHTTP();

    if (!http) {
      throw new Error(
        "Koneksi Native HTTP Android belum tersedia."
      );
    }

    let response;

    try {
      response = await http.post({
        url: ENDPOINT,

        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },

        data: {
          action,
          ...data
        },

        connectTimeout: TIMEOUT,
        readTimeout: TIMEOUT
      });

    } catch (error) {
      console.error(
        "HSM Native HTTP:",
        error?.message || error
      );

      throw new Error(
        "Gagal menghubungi server HSM Transport: " +
        (error?.message || "Kesalahan jaringan")
      );
    }

    // ========================================================
    // PERIKSA STATUS HTTP
    // ========================================================

    const status = Number(
      response?.status || 0
    );

    const result = parseResponse(
      response?.data
    );

    if (
      status < 200 ||
      status >= 300 ||
      result.success !== true
    ) {
      throw new Error(
        result.error ||
        result.message ||
        "Permintaan ditolak server. HTTP " + status
      );
    }

    return result;
  }

  // ==========================================================
  // API GLOBAL KHUSUS APK
  // ==========================================================

  window.HSMStaffNative = {
    available: isNativeApp,
    request
  };

  console.log(
    "HSM Staff Native HTTP siap."
  );

})();
