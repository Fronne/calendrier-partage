package app.calendrierpartage;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Appels au serveur du calendrier et mémoire du widget (jeton, dernières données reçues). */
final class Api {
    private static final String PREFS = "widget";
    private static final String TOKEN = "token";
    private static final String DATA = "data";
    private static final int TIMEOUT_MS = 8000;

    static final class Reply {
        /** 0 : le serveur n'a pas pu être joint */
        final int status;
        final JSONObject json;

        Reply(int status, JSONObject json) {
            this.status = status;
            this.json = json;
        }

        boolean ok() {
            return status >= 200 && status < 300;
        }
    }

    private Api() {
    }

    static Reply call(String method, String path, String token, JSONObject body) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(BuildConfig.API_URL + path).openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            if (token != null) conn.setRequestProperty("Authorization", "Bearer " + token);
            if (body != null) {
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = conn.getOutputStream()) {
                    out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = conn.getResponseCode();
            InputStream in = status < 400 ? conn.getInputStream() : conn.getErrorStream();
            JSONObject json;
            try {
                json = new JSONObject(read(in));
            } catch (Exception e) {
                json = new JSONObject();
            }
            return new Reply(status, json);
        } catch (IOException e) {
            return new Reply(0, new JSONObject());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String read(InputStream in) throws IOException {
        if (in == null) return "";
        try (InputStream stream = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = stream.read(buf)) > 0; ) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String token(Context context) {
        return prefs(context).getString(TOKEN, null);
    }

    /** Un nouveau jeton (ou sa perte) rend les données gardées caduques. */
    static void setToken(Context context, String token) {
        prefs(context).edit().putString(TOKEN, token).remove(DATA).apply();
    }

    static String data(Context context) {
        return prefs(context).getString(DATA, null);
    }

    static void setData(Context context, String json) {
        prefs(context).edit().putString(DATA, json).apply();
    }
}
