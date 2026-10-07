package app.calendrierpartage;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Connecte le widget au calendrier. L'application s'affiche dans le navigateur du téléphone, dont le
 * widget ne peut pas lire la session : il demande donc une fois le code de couple, puis qui on est.
 */
public class WidgetSetupActivity extends Activity {
    private final ExecutorService background = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private EditText code;
    private Button go;
    private TextView error;
    private LinearLayout members;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        // Si on quitte l'écran sans finir, le widget n'est pas ajouté
        setResult(RESULT_CANCELED, result());
        if (Api.token(this) != null) {
            done();
            return;
        }

        setContentView(R.layout.activity_setup);
        code = findViewById(R.id.code);
        go = findViewById(R.id.go);
        error = findViewById(R.id.error);
        members = findViewById(R.id.members);
        go.setOnClickListener(v -> checkCode());
        code.setOnEditorActionListener((v, action, event) -> {
            checkCode();
            return true;
        });
    }

    @Override
    protected void onDestroy() {
        background.shutdownNow();
        super.onDestroy();
    }

    private Intent result() {
        int id = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        return new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
    }

    private void done() {
        AgendaWidget.updateAll(this);
        setResult(RESULT_OK, result());
        finish();
    }

    private void login(String name, java.util.function.Consumer<JSONObject> onOk) {
        String entered = code.getText().toString().trim();
        if (entered.isEmpty()) return;
        error.setText("");
        setBusy(true);
        background.execute(() -> {
            Api.Reply reply;
            try {
                JSONObject body = new JSONObject().put("code", entered);
                if (name != null) body.put("name", name);
                reply = Api.call("POST", "/login", null, body);
            } catch (Exception e) {
                reply = new Api.Reply(0, new JSONObject());
            }
            Api.Reply r = reply;
            main.post(() -> {
                if (isFinishing() || isDestroyed()) return;
                setBusy(false);
                if (r.ok()) onOk.accept(r.json);
                else error.setText(r.status == 0 ? getString(R.string.error_offline) : r.json.optString("error", getString(R.string.error_generic)));
            });
        });
    }

    private void setBusy(boolean busy) {
        go.setEnabled(!busy);
        go.setAlpha(busy ? 0.5f : 1f);
        for (int i = 0; i < members.getChildCount(); i++) members.getChildAt(i).setEnabled(!busy);
    }

    private void checkCode() {
        login(null, json -> showMembers(json.optJSONArray("members")));
    }

    private void showMembers(JSONArray list) {
        if (list == null || list.length() == 0) {
            error.setText(R.string.setup_nobody);
            return;
        }
        findViewById(R.id.code_step).setVisibility(View.GONE);
        ((TextView) findViewById(R.id.intro)).setText(R.string.setup_who);
        members.setVisibility(View.VISIBLE);
        members.removeAllViews();
        float dp = getResources().getDisplayMetrics().density;
        for (int i = 0; i < list.length(); i++) {
            String name = list.optJSONObject(i).optString("name");
            Button button = new Button(this, null, android.R.attr.borderlessButtonStyle);
            button.setText(name);
            button.setAllCaps(false);
            button.setTextSize(16);
            button.setTextColor(getColor(R.color.on_accent));
            button.setBackgroundResource(R.drawable.button_bg);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Math.round(52 * dp));
            params.topMargin = Math.round((i == 0 ? 24 : 12) * dp);
            button.setOnClickListener(v -> login(name, json -> {
                Api.setToken(this, json.optString("token"));
                done();
            }));
            members.addView(button, params);
        }
    }
}
