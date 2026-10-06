-- Catégories, anniversaires, tâches répétées et rappels de tâches, notifications de changement
ALTER TABLE events ADD COLUMN category TEXT NOT NULL DEFAULT '';
-- 'event' ou 'birthday' (title = prénom de la personne, birth_year facultatif pour calculer l'âge)
ALTER TABLE events ADD COLUMN kind TEXT NOT NULL DEFAULT 'event';
ALTER TABLE events ADD COLUMN birth_year INTEGER;

ALTER TABLE tasks ADD COLUMN rec_freq TEXT NOT NULL DEFAULT 'none';
ALTER TABLE tasks ADD COLUMN rec_interval INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD COLUMN reminder_minutes INTEGER;

-- 1 = prévenu quand l'autre ajoute, modifie ou supprime quelque chose
ALTER TABLE members ADD COLUMN notify_changes INTEGER NOT NULL DEFAULT 1;
