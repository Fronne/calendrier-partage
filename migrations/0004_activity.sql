-- Journal des derniers changements (« Léa a ajouté un rendez-vous ») : ce que les notifications annoncent,
-- gardé pour qui a manqué ou effacé la sienne. event_id : le rendez-vous concerné, s'il existe encore.
CREATE TABLE activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  action TEXT NOT NULL,
  body TEXT NOT NULL,
  event_id TEXT,
  created_at TEXT NOT NULL
);
