package PACKAGE_NAME;

import android.Manifest;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;

import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;

import java.net.HttpURLConnection;
import java.net.URL;

import java.nio.charset.StandardCharsets;

import java.text.SimpleDateFormat;

import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/*
============================================================
HSM TRANSPORT
PT HIDAYAH SARANA MULIA

HSM INTERNAL - GPS FOREGROUND SERVICE

FITUR:

01. GPS Sopir dan Kernet
02. Android Foreground Service
03. Notifikasi pelacakan aktif
04. GPS saat aplikasi diminimalkan
05. GPS saat layar terkunci
06. Pengiriman lokasi ke Supabase
07. Target interval 30 detik
08. Validasi sesi melalui server
09. Berhenti setelah logout
10. Berhenti setelah pergantian hari WIT
11. Status GPS untuk dashboard
12. Tombol berhenti pada notifikasi
13. Penanganan gangguan jaringan
14. Tidak mengubah scanner QR
15. Tidak mengubah manifest

PENTING:

Pelacakan hanya diaktifkan melalui
persetujuan petugas di HSM Internal.

Server wajib memvalidasi sesi setiap
kali menerima koordinat GPS.

============================================================
*/

public class HSMGpsService
    extends Service
    implements LocationListener {

    /* ========================================================
       1. KONSTANTA
    ======================================================== */

    private static final String TAG =
        "HSM-GPS";

    public static final String PREF =
        "hsm_gps_tracking";

    public static final String ACTION_START =
        "com.hsmtransport.internal.GPS_START";

    public static final String ACTION_STOP =
        "com.hsmtransport.internal.GPS_STOP";

    private static final String ENDPOINT =
        "https://lbykbgtxxlnbdixkkcsw.supabase.co/functions/v1/hsm-staff-auth";

    private static final String CHANNEL_ID =
        "hsm_internal_gps_channel";

    private static final int NOTIFICATION_ID =
        8301;

    private static final long GPS_INTERVAL_MS =
        30000L;

    private static final long SESSION_CHECK_MS =
        30000L;

    /* ========================================================
       2. STATE
    ======================================================== */

    private LocationManager locationManager;

    private final Handler mainHandler =
        new Handler(
            Looper.getMainLooper()
        );

    private final ExecutorService networkExecutor =
        Executors.newSingleThreadExecutor();

    private String sessionToken = "";

    private String sessionDate = "";

    private boolean trackingActive = false;

    private long lastSendAttempt = 0L;

    /* ========================================================
       3. TANGGAL WIT

       Tidak menggunakan timezone HP.
       Selalu Asia/Jayapura.
    ======================================================== */

    public static String witDate() {

        SimpleDateFormat formatter =
            new SimpleDateFormat(
                "yyyy-MM-dd",
                Locale.US
            );

        formatter.setTimeZone(
            TimeZone.getTimeZone(
                "Asia/Jayapura"
            )
        );

        return formatter.format(
            new Date()
        );

    }

    /* ========================================================
       4. SHARED PREFERENCES
    ======================================================== */

    private SharedPreferences prefs() {

        return getSharedPreferences(
            PREF,
            Context.MODE_PRIVATE
        );

    }

    /* ========================================================
       5. SIMPAN STATUS
    ======================================================== */

    private void updateStatus(
        boolean active,
        String error
    ) {

        prefs()
            .edit()

            .putBoolean(
                "active",
                active
            )

            .putString(
                "error",
                error == null
                    ? ""
                    : error
            )

            .apply();

    }

    /* ========================================================
       6. ON CREATE
    ======================================================== */

    @Override
    public void onCreate() {

        super.onCreate();

        locationManager =
            (LocationManager) getSystemService(
                Context.LOCATION_SERVICE
            );

        createNotificationChannel();

        Log.i(
            TAG,
            "HSM GPS Service created."
        );

    }

    /* ========================================================
       7. NOTIFICATION CHANNEL
    ======================================================== */

    private void createNotificationChannel() {

        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.O
        ) {
            return;
        }

        NotificationChannel channel =
            new NotificationChannel(

                CHANNEL_ID,

                "HSM Live Tracking",

                NotificationManager.IMPORTANCE_LOW

            );

        channel.setDescription(
            "Berbagi lokasi selama bertugas bersama HSM Transport."
        );

        NotificationManager manager =
            (NotificationManager) getSystemService(
                Context.NOTIFICATION_SERVICE
            );

        if (manager != null) {

            manager.createNotificationChannel(
                channel
            );

        }

    }

    /* ========================================================
       8. NOTIFIKASI GPS
    ======================================================== */

    private Notification buildNotification() {

        Intent openIntent =
            new Intent(
                this,
                MainActivity.class
            );

        openIntent.setFlags(
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_CLEAR_TOP
        );

        int pendingFlags =
            PendingIntent.FLAG_UPDATE_CURRENT |
            PendingIntent.FLAG_IMMUTABLE;

        PendingIntent openPendingIntent =
            PendingIntent.getActivity(

                this,

                0,

                openIntent,

                pendingFlags

            );

        Intent stopIntent =
            new Intent(
                this,
                HSMGpsService.class
            );

        stopIntent.setAction(
            ACTION_STOP
        );

        PendingIntent stopPendingIntent =
            PendingIntent.getService(

                this,

                1,

                stopIntent,

                pendingFlags

            );

        return new NotificationCompat.Builder(
            this,
            CHANNEL_ID
        )

            .setSmallIcon(
                android.R.drawable.ic_menu_mylocation
            )

            .setContentTitle(
                "HSM Internal • GPS Aktif"
            )

            .setContentText(
                "Lokasi dibagikan selama bertugas."
            )

            .setContentIntent(
                openPendingIntent
            )

            .setOngoing(
                true
            )

            .setOnlyAlertOnce(
                true
            )

            .setCategory(
                NotificationCompat.CATEGORY_SERVICE
            )

            .addAction(

                android.R.drawable.ic_delete,

                "Hentikan GPS",

                stopPendingIntent

            )

            .build();

    }

    /* ========================================================
       9. CEK IZIN LOKASI
    ======================================================== */

    private boolean hasFineLocation() {

        return ContextCompat.checkSelfPermission(

            this,

            Manifest.permission.ACCESS_FINE_LOCATION

        ) == PackageManager.PERMISSION_GRANTED;

    }

    private boolean hasCoarseLocation() {

        return ContextCompat.checkSelfPermission(

            this,

            Manifest.permission.ACCESS_COARSE_LOCATION

        ) == PackageManager.PERMISSION_GRANTED;

    }

    /* ========================================================
       10. CEK SESI LOKAL
    ======================================================== */

    private boolean hasValidLocalSession() {

        String savedToken =
            prefs().getString(
                "token",
                ""
            );

        String savedDate =
            prefs().getString(
                "date",
                ""
            );

        if (
            savedToken == null ||
            savedDate == null
        ) {
            return false;
        }

        if (
            !savedToken.matches(
                "(?i)[0-9a-f]{64}"
            )
        ) {
            return false;
        }

        if (
            !savedDate.equals(
                witDate()
            )
        ) {
            return false;
        }

        return true;

    }

    /* ========================================================
       11. START COMMAND
    ======================================================== */

    @Override
    public int onStartCommand(

        Intent intent,

        int flags,

        int startId

    ) {

        String action =
            intent == null
                ? ""
                : intent.getAction();

        if (
            ACTION_STOP.equals(action)
        ) {

            stopTracking();

            return START_NOT_STICKY;

        }

        if (
            !ACTION_START.equals(action)
        ) {

            stopTracking();

            return START_NOT_STICKY;

        }

        if (
            !hasValidLocalSession()
        ) {

            updateStatus(
                false,
                "Sesi petugas tidak aktif."
            );

            stopTracking();

            return START_NOT_STICKY;

        }

        sessionToken =
            prefs().getString(
                "token",
                ""
            );

        sessionDate =
            prefs().getString(
                "date",
                ""
            );

        if (
            !hasFineLocation() &&
            !hasCoarseLocation()
        ) {

            updateStatus(
                false,
                "Izin lokasi Android belum diberikan."
            );

            stopTracking();

            return START_NOT_STICKY;

        }

        try {

            /*
              Foreground Service harus diaktifkan
              segera setelah Android memulai service.
            */

            startForeground(

                NOTIFICATION_ID,

                buildNotification()

            );

            trackingActive = true;

            lastSendAttempt = 0L;

            updateStatus(
                true,
                ""
            );

            startLocationUpdates();

            mainHandler.removeCallbacks(
                sessionChecker
            );

            mainHandler.postDelayed(

                sessionChecker,

                SESSION_CHECK_MS

            );

            Log.i(
                TAG,
                "Live Tracking started."
            );

        } catch (Exception error) {

            Log.e(
                TAG,
                "Failed starting GPS",
                error
            );

            updateStatus(
                false,
                "Android gagal memulai layanan GPS."
            );

            stopTracking();

        }

        return START_NOT_STICKY;

    }

    /* ========================================================
       12. REQUEST LOCATION UPDATES
    ======================================================== */

    private void startLocationUpdates() {

        if (
            locationManager == null
        ) {

            updateStatus(
                false,
                "Layanan lokasi Android tidak tersedia."
            );

            stopTracking();

            return;

        }

        boolean fine =
            hasFineLocation();

        boolean coarse =
            hasCoarseLocation();

        boolean requested = false;

        try {

            /*
              GPS_PROVIDER menghasilkan koordinat
              dari satelit jika tersedia.
            */

            if (
                fine &&
                locationManager.isProviderEnabled(
                    LocationManager.GPS_PROVIDER
                )
            ) {

                locationManager.requestLocationUpdates(

                    LocationManager.GPS_PROVIDER,

                    GPS_INTERVAL_MS,

                    0f,

                    this,

                    Looper.getMainLooper()

                );

                requested = true;

            }

            /*
              NETWORK_PROVIDER sebagai alternatif
              saat GPS satelit kurang stabil.
            */

            if (
                (fine || coarse) &&
                locationManager.isProviderEnabled(
                    LocationManager.NETWORK_PROVIDER
                )
            ) {

                locationManager.requestLocationUpdates(

                    LocationManager.NETWORK_PROVIDER,

                    GPS_INTERVAL_MS,

                    0f,

                    this,

                    Looper.getMainLooper()

                );

                requested = true;

            }

        } catch (SecurityException error) {

            Log.e(
                TAG,
                "Location permission error",
                error
            );

            updateStatus(
                false,
                "Izin akses lokasi bermasalah."
            );

            stopTracking();

            return;

        } catch (Exception error) {

            Log.e(
                TAG,
                "Location provider error",
                error
            );

        }

        if (!requested) {

            updateStatus(
                false,
                "Aktifkan layanan lokasi pada pengaturan HP."
            );

            stopTracking();

        }

    }

    /* ========================================================
       13. CEK SESI SETIAP 30 DETIK
    ======================================================== */

    private final Runnable sessionChecker =
        new Runnable() {

            @Override
            public void run() {

                if (
                    !trackingActive
                ) {
                    return;
                }

                if (
                    !hasValidLocalSession() ||
                    !witDate().equals(
                        sessionDate
                    )
                ) {

                    Log.i(
                        TAG,
                        "GPS stopped: session expired."
                    );

                    stopTracking();

                    return;

                }

                mainHandler.postDelayed(

                    this,

                    SESSION_CHECK_MS

                );

            }

        };

    /* ========================================================
       14. LOCATION CHANGED
    ======================================================== */

    @Override
    public void onLocationChanged(
        Location location
    ) {

        if (
            !trackingActive ||
            location == null
        ) {
            return;
        }

        if (
            !hasValidLocalSession()
        ) {

            stopTracking();

            return;

        }

        long now =
            System.currentTimeMillis();

        /*
          Batasi frekuensi permintaan.

          Android dapat memberikan update
          lebih sering dari interval target.
        */

        if (
            now - lastSendAttempt <
            GPS_INTERVAL_MS
        ) {
            return;
        }

        lastSendAttempt =
            now;

        final double latitude =
            location.getLatitude();

        final double longitude =
            location.getLongitude();

        final double accuracy =
            Math.max(
                0d,
                location.getAccuracy()
            );

        final String tokenSnapshot =
            sessionToken;

        final String dateSnapshot =
            sessionDate;

        networkExecutor.execute(
            () -> sendLocation(

                latitude,

                longitude,

                accuracy,

                tokenSnapshot,

                dateSnapshot

            )
        );

    }

    /* ========================================================
       15. SEND LOCATION TO SUPABASE
    ======================================================== */

    private void sendLocation(

        double latitude,

        double longitude,

        double accuracy,

        String tokenSnapshot,

        String dateSnapshot

    ) {

        HttpURLConnection connection =
            null;

        try {

            /*
              Jangan mulai permintaan baru
              setelah sesi lokal berakhir.
            */

            if (
                !trackingActive ||
                !hasValidLocalSession() ||
                !witDate().equals(
                    dateSnapshot
                ) ||
                !tokenSnapshot.equals(
                    prefs().getString(
                        "token",
                        ""
                    )
                )
            ) {

                return;

            }

            JSONObject body =
                new JSONObject();

            body.put(
                "action",
                "gps_update"
            );

            body.put(
                "token",
                tokenSnapshot
            );

            body.put(
                "latitude",
                latitude
            );

            body.put(
                "longitude",
                longitude
            );

            body.put(
                "accuracy_m",
                accuracy
            );

            byte[] payload =
                body.toString().getBytes(
                    StandardCharsets.UTF_8
                );

            URL url =
                new URL(
                    ENDPOINT
                );

            connection =
                (HttpURLConnection)
                    url.openConnection();

            connection.setRequestMethod(
                "POST"
            );

            connection.setConnectTimeout(
                12000
            );

            connection.setReadTimeout(
                12000
            );

            connection.setDoOutput(
                true
            );

            connection.setUseCaches(
                false
            );

            connection.setRequestProperty(

                "Content-Type",

                "application/json; charset=utf-8"

            );

            /*
              Origin sesuai daftar yang
              diizinkan Edge Function HSM.
            */

            connection.setRequestProperty(

                "Origin",

                "https://localhost"

            );

            try (
                OutputStream output =
                    connection.getOutputStream()
            ) {

                output.write(
                    payload
                );

                output.flush();

            }

            int httpStatus =
                connection.getResponseCode();

            if (
                httpStatus >= 200 &&
                httpStatus < 300
            ) {

                /*
                  HTTP 200 saja belum cukup.

                  Pastikan server mengembalikan:
                  { "success": true }
                */

                String rawResponse;

                try (
                    InputStream input =
                        connection.getInputStream()
                ) {

                    byte[] responseBytes =
                        input.readAllBytes();

                    rawResponse =
                        new String(
                            responseBytes,
                            StandardCharsets.UTF_8
                        );

                }

                JSONObject result =
                    new JSONObject(
                        rawResponse
                    );

                if (
                    result.optBoolean(
                        "success",
                        false
                    )
                ) {

                    /*
                      Jangan menandai sukses
                      kalau petugas sudah logout
                      selama request berlangsung.
                    */

                    if (
                        trackingActive &&
                        hasValidLocalSession() &&
                        tokenSnapshot.equals(
                            prefs().getString(
                                "token",
                                ""
                            )
                        )
                    ) {

                        prefs().edit()

                            .putLong(
                                "lastSent",
                                System.currentTimeMillis()
                            )

                            .putString(
                                "error",
                                ""
                            )

                            .apply();

                        Log.i(
                            TAG,
                            "Location accepted by server."
                        );

                    }

                } else {

                    setNetworkError(
                        "Server belum menerima lokasi GPS."
                    );

                }

            } else if (
                httpStatus == 401 ||
                httpStatus == 403
            ) {

                /*
                  Server menolak sesi.

                  Hentikan tracking.
                */

                mainHandler.post(
                    () -> {

                        if (
                            trackingActive
                        ) {

                            updateStatus(
                                false,
                                "Sesi GPS ditolak server."
                            );

                            stopTracking();

                        }

                    }
                );

            } else {

                Log.w(
                    TAG,
                    "GPS HTTP status: " +
                    httpStatus
                );

                setNetworkError(
                    "Server GPS HTTP " +
                    httpStatus
                );

            }

        } catch (Exception error) {

            Log.w(
                TAG,
                "Location delivery failed",
                error
            );

            setNetworkError(
                "Koneksi lokasi belum berhasil."
            );

        } finally {

            if (
                connection != null
            ) {

                connection.disconnect();

            }

        }

    }

    /* ========================================================
       16. NETWORK ERROR
    ======================================================== */

    private void setNetworkError(
        String message
    ) {

        if (
            !trackingActive
        ) {
            return;
        }

        prefs().edit()

            .putString(
                "error",
                message
            )

            .apply();

    }

    /* ========================================================
       17. STOP TRACKING
    ======================================================== */

    private void stopTracking() {

        trackingActive =
            false;

        mainHandler.removeCallbacks(
            sessionChecker
        );

        try {

            if (
                locationManager != null
            ) {

                locationManager.removeUpdates(
                    this
                );

            }

        } catch (Exception error) {

            Log.w(
                TAG,
                "Error removing location updates",
                error
            );

        }

        sessionToken =
            "";

        sessionDate =
            "";

        /*
          Token dibersihkan sehingga
          lokasi tidak bisa dikirim lagi
          menggunakan sesi lama.
        */

        prefs().edit()

            .remove(
                "token"
            )

            .remove(
                "date"
            )

            .putBoolean(
                "active",
                false
            )

            .apply();

        try {

            if (
                Build.VERSION.SDK_INT >= 24
            ) {

                stopForeground(
                    STOP_FOREGROUND_REMOVE
                );

            } else {

                stopForeground(
                    true
                );

            }

        } catch (Exception error) {

            Log.w(
                TAG,
                "Stop foreground error",
                error
            );

        }

        stopSelf();

        Log.i(
            TAG,
            "HSM GPS stopped."
        );

    }

    /* ========================================================
       18. DESTROY
    ======================================================== */

    @Override
    public void onDestroy() {

        trackingActive =
            false;

        mainHandler.removeCallbacks(
            sessionChecker
        );

        try {

            if (
                locationManager != null
            ) {

                locationManager.removeUpdates(
                    this
                );

            }

        } catch (Exception error) {

            Log.w(
                TAG,
                "Cleanup location error",
                error
            );

        }

        /*
          Permintaan jaringan yang sudah
          terlanjur dimulai mungkin belum
          bisa dibatalkan secara langsung.

          Server tetap wajib memvalidasi
          token dan status sesi.
        */

        networkExecutor.shutdownNow();

        prefs().edit()

            .putBoolean(
                "active",
                false
            )

            .apply();

        super.onDestroy();

    }

    /* ========================================================
       19. BIND
    ======================================================== */

    @Override
    public IBinder onBind(
        Intent intent
    ) {

        return null;

    }

}
