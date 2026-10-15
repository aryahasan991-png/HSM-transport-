package PACKAGE_NAME;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

import android.media.AudioAttributes;
import android.media.SoundPool;

import android.net.Uri;

import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;

import android.util.Log;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.util.Locale;

/*
============================================================
HSM TRANSPORT
PT HIDAYAH SARANA MULIA

MAIN ACTIVITY - HSM INTERNAL

FITUR:

01. Capacitor 8
02. Scanner QR Native Audio
03. WAV berhasil / gagal
04. Getaran scanner
05. GPS Live Tracking Bridge
06. Izin lokasi Android
07. Foreground GPS Service
08. Status GPS untuk JavaScript
09. Stop GPS dari dashboard
10. Tombol kembali Android
11. Perlindungan akses native bridge
12. Kompatibel Android 13, 14, 15+

PENTING:

GPS hanya dapat dimulai dari halaman
petugas.html yang berjalan secara lokal
di APK HSM Internal.

Pelacakan dijalankan oleh:
HSMGpsService.java
============================================================
*/

public class MainActivity extends BridgeActivity {

    /* ========================================================
       KONSTANTA
    ======================================================== */

    private static final String TAG =
        "HSM-INTERNAL";

    private static final int REQUEST_LOCATION =
        8220;

    private static final int REQUEST_NOTIFICATION =
        8221;

    private static final String LOCAL_HOST =
        "localhost";

    private static final String STAFF_PATH =
        "/petugas.html";

    private static final String HOME_URL =
        "https://localhost/index.html";

    /* ========================================================
       STATUS
    ======================================================== */

    private long lastBackPressed = 0L;

    private String pendingGpsToken = "";

    private String pendingGpsDate = "";

    /* ========================================================
       SCANNER AUDIO
    ======================================================== */

    private SoundPool soundPool;

    private int successSound = 0;

    private int errorSound = 0;

    private int successStream = 0;

    private int errorStream = 0;

    private boolean successReady = false;

    private boolean errorReady = false;

    /* ========================================================
       GET WEBVIEW
    ======================================================== */

    private WebView getHSMWebView() {

        try {

            if (getBridge() == null) {
                return null;
            }

            return getBridge().getWebView();

        } catch (Exception error) {

            Log.e(
                TAG,
                "Gagal mengakses WebView",
                error
            );

            return null;

        }

    }

    /* ========================================================
       CEK HALAMAN PETUGAS
    ======================================================== */

    private boolean isStaffPage() {

        WebView webView =
            getHSMWebView();

        if (
            webView == null ||
            webView.getUrl() == null
        ) {

            return false;

        }

        try {

            Uri uri = Uri.parse(
                webView.getUrl()
            );

            return (
                "https".equalsIgnoreCase(
                    uri.getScheme()
                ) &&

                LOCAL_HOST.equalsIgnoreCase(
                    uri.getHost()
                ) &&

                STAFF_PATH.equals(
                    uri.getPath()
                )
            );

        } catch (Exception error) {

            return false;

        }

    }

    /* ========================================================
       SCANNER BRIDGE
    ======================================================== */

    private final class HSMNativeBridge {

        @JavascriptInterface
        public void feedback(
            boolean success
        ) {

            runOnUiThread(() -> {

                if (!isStaffPage()) {
                    return;
                }

                playFeedback(success);

            });

        }

    }

    /* ========================================================
       GPS BRIDGE
    ======================================================== */

    private final class HSMGpsBridge {

        /*
          Dipanggil oleh:

          window.HSMGPS.start(
            token,
            todayWIT()
          );
        */

        @JavascriptInterface
        public void start(
            String token,
            String witDate
        ) {

            runOnUiThread(() -> {

                if (!isStaffPage()) {

                    Log.w(
                        TAG,
                        "GPS start ditolak: bukan halaman petugas."
                    );

                    return;

                }

                if (
                    token == null ||
                    !token.matches(
                        "(?i)[0-9a-f]{64}"
                    )
                ) {

                    setGpsError(
                        "Token sesi GPS tidak valid."
                    );

                    return;

                }

                if (
                    witDate == null ||
                    !witDate.equals(
                        HSMGpsService.witDate()
                    )
                ) {

                    setGpsError(
                        "Tanggal sesi WIT tidak valid."
                    );

                    return;

                }

                pendingGpsToken =
                    token;

                pendingGpsDate =
                    witDate;

                requestLocationPermission();

            });

        }

        /*
          Dipanggil oleh:

          window.HSMGPS.stop();
        */

        @JavascriptInterface
        public void stop() {

            runOnUiThread(() -> {

                if (!isStaffPage()) {
                    return;
                }

                stopGpsService();

            });

        }

        /*
          Dipanggil oleh:

          window.HSMGPS.status();
        */

        @JavascriptInterface
        public String status() {

            /*
              Penting:

              status() hanya membaca data
              status lokal, bukan token sesi.
            */

            try {

                SharedPreferences prefs =
                    getSharedPreferences(
                        HSMGpsService.PREF,
                        MODE_PRIVATE
                    );

                JSONObject result =
                    new JSONObject();

                result.put(
                    "active",
                    prefs.getBoolean(
                        "active",
                        false
                    )
                );

                long lastSent =
                    prefs.getLong(
                        "lastSent",
                        0L
                    );

                result.put(
                    "lastSent",
                    lastSent > 0
                        ? lastSent
                        : JSONObject.NULL
                );

                result.put(
                    "error",
                    prefs.getString(
                        "error",
                        ""
                    )
                );

                return result.toString();

            } catch (Exception error) {

                Log.e(
                    TAG,
                    "Gagal membaca status GPS",
                    error
                );

                return (
                    "{\"active\":false," +
                    "\"lastSent\":null," +
                    "\"error\":\"Status GPS tidak tersedia\"}"
                );

            }

        }

    }

    /* ========================================================
       SIMPAN STATUS ERROR GPS
    ======================================================== */

    private void setGpsError(
        String message
    ) {

        getSharedPreferences(
            HSMGpsService.PREF,
            MODE_PRIVATE
        )
            .edit()
            .putString(
                "error",
                message
            )
            .apply();

    }

    /* ========================================================
       CEK IZIN LOKASI
    ======================================================== */

    private boolean hasLocationPermission() {

        boolean fine =
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED;

        boolean coarse =
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED;

        return fine || coarse;

    }

    /* ========================================================
       PERMINTAAN IZIN LOKASI
    ======================================================== */

    private void requestLocationPermission() {

        if (!isStaffPage()) {
            return;
        }

        if (hasLocationPermission()) {

            requestNotificationPermission();

            return;

        }

        ActivityCompat.requestPermissions(
            this,
            new String[]{

                Manifest.permission.ACCESS_FINE_LOCATION,

                Manifest.permission.ACCESS_COARSE_LOCATION

            },
            REQUEST_LOCATION
        );

    }

    /* ========================================================
       PERMINTAAN IZIN NOTIFIKASI
    ======================================================== */

    private void requestNotificationPermission() {

        if (!isStaffPage()) {
            return;
        }

        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {

            ActivityCompat.requestPermissions(
                this,
                new String[]{
                    Manifest.permission.POST_NOTIFICATIONS
                },
                REQUEST_NOTIFICATION
            );

            return;

        }

        startGpsService();

    }

    /* ========================================================
       HASIL PERMINTAAN IZIN
    ======================================================== */

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {

        super.onRequestPermissionsResult(
            requestCode,
            permissions,
            grantResults
        );

        if (
            requestCode == REQUEST_LOCATION
        ) {

            if (
                hasLocationPermission() &&
                isStaffPage()
            ) {

                requestNotificationPermission();

            } else {

                setGpsError(
                    "Izin lokasi ditolak. Aktifkan izin lokasi untuk menggunakan Live Tracking."
                );

                clearPendingGps();

            }

            return;

        }

        if (
            requestCode == REQUEST_NOTIFICATION
        ) {

            /*
              Pada Android 13+, pemberitahuan GPS
              menggunakan izin notifikasi.

              Jika izin ditolak, jangan langsung
              mengaktifkan layanan agar petugas
              mendapatkan pengalaman yang jelas.
            */

            boolean allowed =
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED;

            if (
                allowed &&
                isStaffPage()
            ) {

                startGpsService();

            } else {

                setGpsError(
                    "Izin notifikasi diperlukan untuk menampilkan status Live Tracking."
                );

                clearPendingGps();

            }

        }

    }

    /* ========================================================
       HAPUS DATA GPS TERTUNDA
    ======================================================== */

    private void clearPendingGps() {

        pendingGpsToken = "";

        pendingGpsDate = "";

    }

    /* ========================================================
       START GPS SERVICE
    ======================================================== */

    private void startGpsService() {

        if (!isStaffPage()) {

            clearPendingGps();

            return;

        }

        if (
            !hasLocationPermission()
        ) {

            setGpsError(
                "Izin lokasi belum tersedia."
            );

            clearPendingGps();

            return;

        }

        if (
            pendingGpsToken == null ||
            !pendingGpsToken.matches(
                "(?i)[0-9a-f]{64}"
            )
        ) {

            setGpsError(
                "Token sesi lokasi tidak valid."
            );

            clearPendingGps();

            return;

        }

        if (
            !HSMGpsService.witDate().equals(
                pendingGpsDate
            )
        ) {

            setGpsError(
                "Sesi tanggal WIT sudah berakhir."
            );

            clearPendingGps();

            return;

        }

        SharedPreferences prefs =
            getSharedPreferences(
                HSMGpsService.PREF,
                MODE_PRIVATE
            );

        prefs.edit()

            .putString(
                "token",
                pendingGpsToken
            )

            .putString(
                "date",
                pendingGpsDate
            )

            .putString(
                "error",
                ""
            )

            .putLong(
                "lastSent",
                0L
            )

            .apply();

        Intent intent =
            new Intent(
                this,
                HSMGpsService.class
            );

        intent.setAction(
            HSMGpsService.ACTION_START
        );

        try {

            ContextCompat.startForegroundService(
                this,
                intent
            );

            Log.i(
                TAG,
                "Memulai GPS Foreground Service."
            );

        } catch (Exception error) {

            Log.e(
                TAG,
                "Gagal memulai GPS service",
                error
            );

            setGpsError(
                "Android gagal memulai Live Tracking."
            );

            prefs.edit()

                .remove("token")
                .remove("date")
                .putBoolean(
                    "active",
                    false
                )
                .apply();

        } finally {

            clearPendingGps();

        }

    }

    /* ========================================================
       STOP GPS SERVICE
    ======================================================== */

    private void stopGpsService() {

        clearPendingGps();

        SharedPreferences prefs =
            getSharedPreferences(
                HSMGpsService.PREF,
                MODE_PRIVATE
            );

        prefs.edit()

            .remove("token")

            .remove("date")

            .putBoolean(
                "active",
                false
            )

            .putString(
                "error",
                ""
            )

            .apply();

        /*
          stopService langsung meminta Android
          menghentikan layanan GPS.

          onDestroy pada layanan akan
          menghapus pembaruan lokasi.
        */

        Intent intent =
            new Intent(
                this,
                HSMGpsService.class
            );

        try {

            stopService(intent);

            Log.i(
                TAG,
                "GPS service dihentikan."
            );

        } catch (Exception error) {

            Log.e(
                TAG,
                "Gagal menghentikan GPS",
                error
            );

        }

    }

    /* ========================================================
       ON CREATE
    ======================================================== */

    @Override
    public void onCreate(
        Bundle savedInstanceState
    ) {

        super.onCreate(
            savedInstanceState
        );

        initializeSounds();

        WebView webView =
            getHSMWebView();

        if (webView != null) {

            webView.addJavascriptInterface(
                new HSMNativeBridge(),
                "HSMNative"
            );

            webView.addJavascriptInterface(
                new HSMGpsBridge(),
                "HSMGPS"
            );

        }

        configureBackButton();

        Log.i(
            TAG,
            "HSM Internal Native Android siap."
        );

    }

    /* ========================================================
       INITIALIZE SCANNER AUDIO
    ======================================================== */

    private void initializeSounds() {

        AudioAttributes attributes =
            new AudioAttributes.Builder()

                .setUsage(
                    AudioAttributes.USAGE_MEDIA
                )

                .setContentType(
                    AudioAttributes.CONTENT_TYPE_SONIFICATION
                )

                .build();

        soundPool =
            new SoundPool.Builder()

                .setMaxStreams(2)

                .setAudioAttributes(
                    attributes
                )

                .build();

        soundPool.setOnLoadCompleteListener(
            (pool, sampleId, status) -> {

                if (status != 0) {
                    return;
                }

                if (
                    sampleId ==
                    successSound
                ) {

                    successReady = true;

                }

                if (
                    sampleId ==
                    errorSound
                ) {

                    errorReady = true;

                }

            }
        );

        successSound =
            soundPool.load(
                this,
                R.raw.hsm_scan_success,
                1
            );

        errorSound =
            soundPool.load(
                this,
                R.raw.hsm_scan_error,
                1
            );

    }

    /* ========================================================
       SCANNER FEEDBACK
    ======================================================== */

    private void playFeedback(
        boolean success
    ) {

        playVibration(success);

        playSound(success);

    }

    /* ========================================================
       SCANNER SOUND
    ======================================================== */

    private void playSound(
        boolean success
    ) {

        if (
            soundPool == null
        ) {

            return;

        }

        try {

            if (success) {

                if (!successReady) {
                    return;
                }

                if (
                    successStream != 0
                ) {

                    soundPool.stop(
                        successStream
                    );

                }

                successStream =
                    soundPool.play(

                        successSound,

                        1.0f,

                        1.0f,

                        1,

                        0,

                        1.0f

                    );

            } else {

                if (!errorReady) {
                    return;
                }

                if (
                    errorStream != 0
                ) {

                    soundPool.stop(
                        errorStream
                    );

                }

                errorStream =
                    soundPool.play(

                        errorSound,

                        1.0f,

                        1.0f,

                        1,

                        0,

                        1.0f

                    );

            }

        } catch (Exception error) {

            Log.e(
                TAG,
                "Scanner audio error",
                error
            );

        }

    }

    /* ========================================================
       SCANNER VIBRATION
    ======================================================== */

    private void playVibration(
        boolean success
    ) {

        try {

            Vibrator vibrator =
                (Vibrator) getSystemService(
                    Context.VIBRATOR_SERVICE
                );

            if (
                vibrator == null ||
                !vibrator.hasVibrator()
            ) {

                return;

            }

            long[] pattern =
                success
                    ? new long[]{
                        0,
                        180
                    }
                    : new long[]{
                        0,
                        100,
                        70,
                        100,
                        70,
                        100
                    };

            if (
                Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.O
            ) {

                vibrator.vibrate(
                    VibrationEffect.createWaveform(
                        pattern,
                        -1
                    )
                );

            } else {

                vibrator.vibrate(
                    pattern,
                    -1
                );

            }

        } catch (Exception error) {

            Log.e(
                TAG,
                "Scanner vibration error",
                error
            );

        }

    }

    /* ========================================================
       ANDROID BACK BUTTON
    ======================================================== */

    private void configureBackButton() {

        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {

                    @Override
                    public void handleOnBackPressed() {

                        WebView webView =
                            getHSMWebView();

                        if (webView == null) {

                            finish();

                            return;

                        }

                        String url =
                            webView.getUrl();

                        String path = "";

                        try {

                            if (url != null) {

                                String parsedPath =
                                    Uri.parse(url)
                                        .getPath();

                                if (
                                    parsedPath != null
                                ) {

                                    path =
                                        parsedPath;

                                }

                            }

                        } catch (Exception error) {

                            Log.w(
                                TAG,
                                "Back path error",
                                error
                            );

                        }

                        path = path.toLowerCase(
                            Locale.ROOT
                        );

                        boolean isHome =
                            path.isEmpty() ||
                            path.equals("/") ||
                            path.endsWith(
                                "/index.html"
                            );

                        /*
                          Di halaman petugas atau admin,
                          kembali ke halaman utama
                          HSM Internal.

                          GPS tidak otomatis dihentikan
                          hanya karena navigasi halaman.

                          Pelacakan tetap mengikuti
                          sesi kerja dan tombol logout.
                        */

                        if (!isHome) {

                            webView.loadUrl(
                                HOME_URL
                            );

                            return;

                        }

                        long now =
                            System.currentTimeMillis();

                        if (
                            now -
                            lastBackPressed <
                            2000
                        ) {

                            finish();

                        } else {

                            lastBackPressed =
                                now;

                            Toast.makeText(

                                MainActivity.this,

                                "Tekan sekali lagi untuk keluar",

                                Toast.LENGTH_SHORT

                            ).show();

                        }

                    }

                }
            );

    }

    /* ========================================================
       CLEANUP
    ======================================================== */

    @Override
    public void onDestroy() {

        if (
            soundPool != null
        ) {

            soundPool.release();

            soundPool = null;

        }

        /*
          Jangan mematikan GPS di sini.

          Activity bisa dihancurkan Android
          ketika aplikasi berada di background.

          GPS harus dikelola oleh
          HSMGpsService, bukan Activity.
        */

        super.onDestroy();

    }

}
