package app.calendrierpartage;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Widget « À venir » : la date du jour, puis la liste fournie par AgendaService. */
public class AgendaWidget extends AppWidgetProvider {
    private static final String ACTION_REFRESH = "app.calendrierpartage.REFRESH";
    private static final DateTimeFormatter LONG_DAY = DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.FRENCH);

    /** « Mercredi 7 octobre » */
    static String longDay(LocalDate day) {
        String s = LONG_DAY.format(day);
        return s.substring(0, 1).toUpperCase(Locale.FRENCH) + s.substring(1);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context, id));
        // Fait relire les données par AgendaService, qui interroge le serveur
        manager.notifyAppWidgetViewDataChanged(ids, R.id.list);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_REFRESH.equals(intent.getAction())) updateAll(context);
        else super.onReceive(context, intent);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, AgendaWidget.class));
        if (ids.length > 0) new AgendaWidget().onUpdate(context, manager, ids);
    }

    private static RemoteViews views(Context context, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_agenda);
        boolean connected = Api.token(context) != null;
        views.setTextViewText(R.id.date, longDay(LocalDate.now()));
        views.setTextViewText(R.id.empty, context.getString(connected ? R.string.widget_empty : R.string.widget_connect));

        // Une adresse propre à chaque widget, sinon Android réutilise la même liste pour tous
        Intent service = new Intent(context, AgendaService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        service.setData(Uri.parse(service.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.list, service);
        views.setEmptyView(R.id.list, R.id.empty);

        int immutable = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent app = new Intent(context, LauncherActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent setup = new Intent(context, WidgetSetupActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent open = PendingIntent.getActivity(context, 0, connected ? app : setup, immutable);
        views.setOnClickPendingIntent(R.id.header, open);
        views.setOnClickPendingIntent(R.id.empty, open);
        // Les lignes de la liste complètent ce modèle, qui doit donc rester modifiable
        views.setPendingIntentTemplate(R.id.list,
                PendingIntent.getActivity(context, 1, app, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));

        Intent add = new Intent(Intent.ACTION_VIEW, Uri.parse(context.getString(R.string.launch_url) + "?new=1"),
                context, LauncherActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        views.setOnClickPendingIntent(R.id.add, PendingIntent.getActivity(context, 2, add, immutable));

        Intent refresh = new Intent(context, AgendaWidget.class).setAction(ACTION_REFRESH);
        views.setOnClickPendingIntent(R.id.refresh, PendingIntent.getBroadcast(context, 0, refresh, immutable));
        return views;
    }
}
