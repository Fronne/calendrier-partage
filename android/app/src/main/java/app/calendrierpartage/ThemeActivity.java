package app.calendrierpartage;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabsIntent;

/**
 * Reçoit le thème choisi dans les réglages du site (lien calendrier://theme/light, /dark ou /auto, voir
 * src/theme.ts), le retient, puis rouvre le site : les barres du téléphone ne se colorent qu'au lancement.
 */
public class ThemeActivity extends Activity {
    private static final String PREFS = "theme";
    private static final String KEY = "theme";

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Uri data = getIntent().getData();
        String theme = data == null ? null : data.getLastPathSegment();
        SharedPreferences.Editor prefs = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
        if ("light".equals(theme) || "dark".equals(theme)) prefs.putString(KEY, theme);
        else prefs.remove(KEY);
        prefs.apply();

        // On revient sur l'écran des réglages, d'où le thème vient d'être choisi
        Uri settings = Uri.parse(getString(R.string.launch_url) + "?reglages=1");
        startActivity(new Intent(Intent.ACTION_VIEW, settings, this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
        finish();
    }

    /** Thème à imposer au navigateur : clair, sombre, ou celui du téléphone si rien n'a été forcé. */
    static int colorScheme(Context context) {
        String theme = context.getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY, null);
        if ("light".equals(theme)) return CustomTabsIntent.COLOR_SCHEME_LIGHT;
        if ("dark".equals(theme)) return CustomTabsIntent.COLOR_SCHEME_DARK;
        return CustomTabsIntent.COLOR_SCHEME_SYSTEM;
    }
}
