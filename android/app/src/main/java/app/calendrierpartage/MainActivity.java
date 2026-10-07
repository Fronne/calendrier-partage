package app.calendrierpartage;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.androidbrowserhelper.trusted.TwaLauncher;
import com.google.androidbrowserhelper.trusted.splashscreens.SplashScreenStrategy;

/**
 * Ouvre le site en plein écran. Le navigateur choisit les couleurs des barres du téléphone (claires ou
 * sombres, voir AndroidManifest.xml) d'après le mode du téléphone ; quand l'utilisateur a forcé un thème
 * dans les réglages du site, on lui impose celui-là pour que la barre du bas soit assortie à l'écran.
 */
public class MainActivity extends LauncherActivity {

    @Override
    protected TwaLauncher createTwaLauncher() {
        int scheme = ThemeActivity.colorScheme(this);
        return new TwaLauncher(this) {
            @Override
            public void launch(TrustedWebActivityIntentBuilder builder, CustomTabsCallback callback,
                    SplashScreenStrategy splash, Runnable done, FallbackStrategy fallback) {
                builder.setColorScheme(scheme);
                super.launch(builder, callback, splash, done, fallback);
            }
        };
    }
}
