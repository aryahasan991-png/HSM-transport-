/*
  ==========================================================
  HSM TRANSPORT
  PT HIDAYAH SARANA MULIA

  CUSTOM SCANNER AUDIO - WEB / IOS PWA

  Berhasil:
  hsm_scan_success.wav

  Gagal:
  hsm_scan_error.wav

  Android APK tetap menggunakan HSMNative.
  ==========================================================
*/

(function () {
  "use strict";

  /*
    Jangan mengubah pemutar native
    yang sudah berfungsi di APK Android.
  */

  if (
    window.HSMNative &&
    typeof window.HSMNative.feedback === "function"
  ) {
    return;
  }

  const SOUND_URLS = {
    success: "/hsm_scan_success.wav",
    error: "/hsm_scan_error.wav"
  };

  let audioContext = null;

  const buffers = {
    success: null,
    error: null
  };

  const loading = {
    success: null,
    error: null
  };

  function getAudioContext() {
    const AudioClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioClass) {
      return null;
    }

    if (!audioContext) {
      audioContext = new AudioClass();
    }

    return audioContext;
  }

  /*
    Unduh dan siapkan audio.
    Tidak memutar suara saat loading.
  */

  async function loadSound(type) {
    if (buffers[type]) {
      return buffers[type];
    }

    if (loading[type]) {
      return loading[type];
    }

    loading[type] = (async () => {
      const context = getAudioContext();

      if (!context) {
        throw new Error(
          "Web Audio tidak didukung."
        );
      }

      const response = await fetch(
        SOUND_URLS[type],
        { cache: "force-cache" }
      );

      if (!response.ok) {
        throw new Error(
          "File suara tidak ditemukan: " + type
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      buffers[type] =
        await context.decodeAudioData(
          arrayBuffer
        );

      return buffers[type];
    })();

    try {
      return await loading[type];
    } finally {
      loading[type] = null;
    }
  }

  /*
    Siapkan AudioContext saat petugas
    berinteraksi dengan tombol scanner.

    Penting untuk Safari iPhone.
  */

  function unlockAudio() {
    try {
      const context = getAudioContext();

      if (!context) {
        return Promise.resolve(false);
      }

      if (context.state === "suspended") {
        return context.resume()
          .then(() => true)
          .catch(() => false);
      }

      return Promise.resolve(
        context.state === "running"
      );

    } catch (error) {
      console.warn(
        "HSM Audio Unlock:",
        error
      );

      return Promise.resolve(false);
    }
  }

  /*
    Pemutar WAV menggunakan Web Audio.
  */

  async function playSound(success = true) {
    const type = success
      ? "success"
      : "error";

    try {
      const context = getAudioContext();

      if (!context) {
        return false;
      }

      const buffer = await loadSound(type);

      if (context.state !== "running") {
        await context.resume();
      }

      if (context.state !== "running") {
        return false;
      }

      const source =
        context.createBufferSource();

      const gain =
        context.createGain();

      source.buffer = buffer;

      gain.gain.value = 1;

      source.connect(gain);
      gain.connect(context.destination);

      source.start(0);

      return true;

    } catch (error) {
      console.warn(
        "HSM Scanner Audio:",
        error
      );

      return false;
    }
  }

  /*
    Getaran hanya jika browser mendukung.

    Safari iPhone umumnya tidak mendukung
    navigator.vibrate().
  */

  function vibrate(success) {
    try {
      if (
        typeof navigator.vibrate === "function"
      ) {
        navigator.vibrate(
          success
            ? [180]
            : [100, 70, 100, 70, 100]
        );
      }
    } catch (error) {
      console.warn(error);
    }
  }

  /*
    Siapkan suara tanpa memutarnya.
  */

  Promise.allSettled([
    loadSound("success"),
    loadSound("error")
  ]).then(results => {
    console.log(
      "HSM scanner audio prepared:",
      results.map(result => result.status)
    );
  });

  /*
    Integrasi dengan petugas.html.

    Fungsi lama tetap memiliki nama sama
    sehingga sistem check-in tidak berubah.
  */

  window.unlockQRBeep = unlockAudio;

  window.playQRBeep = async function (
    success = true
  ) {
    /*
      Jika ternyata berjalan dalam APK,
      tetap gunakan audio native.
    */

    if (
      window.HSMNative &&
      typeof window.HSMNative.feedback === "function"
    ) {
      window.HSMNative.feedback(
        success === true
      );

      return true;
    }

    vibrate(success);

    return playSound(success);
  };

  /*
    Unlock saat petugas menyentuh tombol.
  */

  [
    "startScanBtn",
    "testFeedbackBtn",
    "qrManualBtn",
    "confirmQRBtn"
  ].forEach(id => {
    const element =
      document.getElementById(id);

    if (!element) return;

    element.addEventListener(
      "touchstart",
      unlockAudio,
      { passive: true }
    );

    element.addEventListener(
      "click",
      unlockAudio
    );
  });

  console.log(
    "HSM custom scanner audio enabled."
  );

})();
