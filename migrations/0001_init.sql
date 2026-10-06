CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

-- start_local / end_local : heure locale sans fuseau ('2026-10-06T14:00'), ou date seule si all_day
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_local TEXT NOT NULL,
  end_local TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL,
  rec_freq TEXT NOT NULL DEFAULT 'none',
  rec_interval INTEGER NOT NULL DEFAULT 1,
  rec_until TEXT,
  exdates TEXT NOT NULL DEFAULT '[]',
  reminder_minutes INTEGER,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  due_date TEXT,
  owner TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  member_id TEXT NOT NULL
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
