package app.calendrierpartage;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Fournit les lignes du widget : un titre par jour, puis ses rendez-vous et tâches. */
public class AgendaService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    private static final class Row {
        /** Titre de jour si non nul ; sinon c'est une ligne de rendez-vous ou de tâche */
        String heading;
        int headingColor;
        String title;
        String time;
        int color;
    }

    private static final class Factory implements RemoteViewsFactory {
        private static final DateTimeFormatter SHORT_DAY = DateTimeFormatter.ofPattern("d MMM", Locale.FRENCH);

        private final Context context;
        private List<Row> rows = new ArrayList<>();

        Factory(Context context) {
            this.context = context;
        }

        @Override
        public void onCreate() {
        }

        // Android appelle cette méthode hors du fil principal : on peut y attendre le serveur
        @Override
        public void onDataSetChanged() {
            String token = Api.token(context);
            if (token == null) {
                rows = new ArrayList<>();
                return;
            }
            Api.Reply reply = Api.call("GET", "/widget", token, null);
            if (reply.ok()) {
                Api.setData(context, reply.json.toString());
            } else if (reply.status == 401) {
                // Le code de couple a changé : le widget redemande à être connecté
                Api.setToken(context, null);
                rows = new ArrayList<>();
                AgendaWidget.updateAll(context);
                MonthWidget.updateAll(context);
                return;
            }
            // Sans réseau, on garde ce qu'on avait reçu la dernière fois
            rows = build(Api.data(context));
        }

        private List<Row> build(String json) {
            List<Row> out = new ArrayList<>();
            if (json == null) return out;
            try {
                JSONArray items = new JSONObject(json).getJSONArray("items");
                LocalDate today = LocalDate.now();
                String todayKey = today.toString();
                String lastHeading = null;
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.getJSONObject(i);
                    String day = item.getString("day");
                    boolean task = item.getBoolean("task");
                    boolean past = day.compareTo(todayKey) < 0;
                    // Données vieilles de plusieurs jours : les rendez-vous passés n'ont plus leur place
                    if (past && !task) continue;

                    LocalDate date = LocalDate.parse(day);
                    String heading = past ? context.getString(R.string.widget_late) : dayLabel(date, today);
                    if (!heading.equals(lastHeading)) {
                        Row head = new Row();
                        head.heading = heading;
                        head.headingColor = context.getColor(past ? R.color.danger : day.equals(todayKey) ? R.color.accent : R.color.muted);
                        out.add(head);
                        lastHeading = heading;
                    }
                    Row row = new Row();
                    row.title = item.getString("title");
                    row.time = !task ? item.getString("time") : past ? SHORT_DAY.format(date) : context.getString(R.string.widget_task);
                    row.color = Color.parseColor(item.getString("color"));
                    out.add(row);
                }
            } catch (Exception e) {
                // Données illisibles : mieux vaut un widget vide qu'un widget en erreur
                out.clear();
            }
            return out;
        }

        private String dayLabel(LocalDate day, LocalDate today) {
            if (day.equals(today)) return context.getString(R.string.widget_today);
            if (day.equals(today.plusDays(1))) return context.getString(R.string.widget_tomorrow);
            return AgendaWidget.longDay(day);
        }

        @Override
        public RemoteViews getViewAt(int position) {
            if (position >= rows.size()) return null;
            Row row = rows.get(position);
            if (row.heading != null) {
                RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_row_day);
                views.setTextViewText(R.id.day, row.heading);
                views.setTextColor(R.id.day, row.headingColor);
                return views;
            }
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_row_item);
            views.setTextViewText(R.id.title, row.title);
            views.setTextViewText(R.id.time, row.time);
            views.setInt(R.id.bar, "setColorFilter", row.color);
            views.setOnClickFillInIntent(R.id.row, new Intent());
            return views;
        }

        @Override
        public int getCount() {
            return rows.size();
        }

        @Override
        public int getViewTypeCount() {
            return 2;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }

        @Override
        public void onDestroy() {
        }
    }
}
