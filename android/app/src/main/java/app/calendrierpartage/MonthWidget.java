package app.calendrierpartage;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Widget « Mois » : la grille du mois, avec une pastille par rendez-vous ou tâche sous chaque jour. */
public class MonthWidget extends AppWidgetProvider {
    private static final String ACTION_MOVE = "app.calendrierpartage.MONTH_MOVE";
    /** -1 ou +1 pour changer de mois, 0 pour revenir au mois en cours */
    private static final String EXTRA_STEP = "step";
    private static final int[] DOTS = {R.id.dot1, R.id.dot2, R.id.dot3};
    private static final DateTimeFormatter TITLE = DateTimeFormatter.ofPattern("LLLL yyyy", Locale.FRENCH);

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        // D'abord ce qu'on connaît déjà, puis les données fraîches dès que le serveur a répondu
        for (int id : ids) render(context, manager, id);
        load(context, manager, ids);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_MOVE.equals(intent.getAction())) {
            super.onReceive(context, intent);
            return;
        }
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        int step = intent.getIntExtra(EXTRA_STEP, 0);
        YearMonth month = step == 0 ? YearMonth.now() : shown(context, id).plusMonths(step);
        // Rien de mémorisé pour le mois en cours : le widget suit alors le calendrier tout seul
        Api.put(context, shownKey(id), month.equals(YearMonth.now()) ? null : month.toString());
        onUpdate(context, AppWidgetManager.getInstance(context), new int[]{id});
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) Api.put(context, shownKey(id), null);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MonthWidget.class));
        if (ids.length > 0) new MonthWidget().onUpdate(context, manager, ids);
    }

    private static String shownKey(int id) {
        return "shown:" + id;
    }

    private static String dataKey(YearMonth month) {
        return "month:" + month;
    }

    private static YearMonth shown(Context context, int id) {
        try {
            return YearMonth.parse(Api.get(context, shownKey(id)));
        } catch (Exception e) {
            return YearMonth.now();
        }
    }

    private void load(Context context, AppWidgetManager manager, int[] ids) {
        String token = Api.token(context);
        if (token == null) return;
        // Garde le widget en vie le temps de la réponse ; absent quand on n'est pas appelé par Android
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                for (int id : ids) {
                    YearMonth month = shown(context, id);
                    Api.Reply reply = Api.call("GET", "/widget/month?month=" + month, token, null);
                    if (reply.status == 401) {
                        // Le code de couple a changé : les widgets redemandent à être connectés
                        Api.setToken(context, null);
                        AgendaWidget.updateAll(context);
                        for (int other : ids) render(context, manager, other);
                        return;
                    }
                    String json = reply.json.toString();
                    if (reply.ok() && !json.equals(Api.get(context, dataKey(month)))) {
                        Api.put(context, dataKey(month), json);
                        render(context, manager, id);
                    }
                }
            } finally {
                if (pending != null) pending.finish();
            }
        }).start();
    }

    private static JSONObject days(Context context, YearMonth month) {
        try {
            return new JSONObject(Api.get(context, dataKey(month))).getJSONObject("days");
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static void render(Context context, AppWidgetManager manager, int id) {
        String pkg = context.getPackageName();
        RemoteViews views = new RemoteViews(pkg, R.layout.widget_month);
        YearMonth month = shown(context, id);
        LocalDate today = LocalDate.now();
        String title = TITLE.format(month);
        views.setTextViewText(R.id.title, title.substring(0, 1).toUpperCase(Locale.FRENCH) + title.substring(1));

        JSONObject days = Api.token(context) == null ? new JSONObject() : days(context, month);
        LocalDate day = month.atDay(1);
        day = day.minusDays(day.getDayOfWeek().getValue() - 1);
        views.removeAllViews(R.id.grid);
        // Semaines entières du lundi au dimanche, sans ligne vide en fin de mois
        while (!day.isAfter(month.atEndOfMonth())) {
            RemoteViews row = new RemoteViews(pkg, R.layout.widget_month_row);
            for (int i = 0; i < 7; i++, day = day.plusDays(1)) {
                RemoteViews cell = new RemoteViews(pkg, R.layout.widget_month_cell);
                cell.setTextViewText(R.id.num, String.valueOf(day.getDayOfMonth()));
                if (day.equals(today)) {
                    cell.setInt(R.id.num, "setBackgroundResource", R.drawable.widget_today_bg);
                    cell.setTextColor(R.id.num, context.getColor(R.color.on_accent));
                } else if (!YearMonth.from(day).equals(month)) {
                    cell.setTextColor(R.id.num, context.getColor(R.color.faint));
                }
                JSONArray colors = days.optJSONArray(day.toString());
                for (int d = 0; colors != null && d < DOTS.length && d < colors.length(); d++) {
                    try {
                        cell.setInt(DOTS[d], "setColorFilter", Color.parseColor(colors.optString(d)));
                        cell.setViewVisibility(DOTS[d], View.VISIBLE);
                    } catch (IllegalArgumentException e) {
                        // Couleur illisible : pas de pastille
                    }
                }
                row.addView(R.id.row, cell);
            }
            views.addView(R.id.grid, row);
        }

        views.setOnClickPendingIntent(R.id.grid, AgendaWidget.open(context));
        views.setOnClickPendingIntent(R.id.add, AgendaWidget.add(context));
        views.setOnClickPendingIntent(R.id.title, move(context, id, 0));
        views.setOnClickPendingIntent(R.id.prev, move(context, id, -1));
        views.setOnClickPendingIntent(R.id.next, move(context, id, 1));
        manager.updateAppWidget(id, views);
    }

    private static PendingIntent move(Context context, int id, int step) {
        Intent intent = new Intent(context, MonthWidget.class).setAction(ACTION_MOVE)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                .putExtra(EXTRA_STEP, step)
                // Une adresse par bouton, sinon Android confond leurs intentions
                .setData(Uri.parse("widget://month/" + id + "/" + step));
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
