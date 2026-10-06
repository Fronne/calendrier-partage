-- Heure choisie pour un rappel « le jour même / la veille / N jours avant » ('HH:mm').
-- NULL = rappel relatif à l'heure du rendez-vous (ou à 9 h pour une journée entière), comme avant.
ALTER TABLE events ADD COLUMN reminder_time TEXT;
ALTER TABLE tasks ADD COLUMN reminder_time TEXT;
