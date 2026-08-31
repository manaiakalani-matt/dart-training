CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 999
);

CREATE TABLE IF NOT EXISTS training_log (
  attempt_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  submitted_at_utc TEXT NOT NULL,
  training_date TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  routine_id TEXT NOT NULL,
  routine_version INTEGER NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  hits REAL,
  possible REAL,
  time_seconds REAL,
  progress_value REAL,
  rounds_played REAL,
  detail_1 REAL,
  detail_2 REAL,
  detail_3 REAL,
  detail_4 REAL,
  result_display TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  device_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'Darty Practice Web',
  client_version TEXT NOT NULL DEFAULT 'unknown',
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE INDEX IF NOT EXISTS idx_training_log_player_date
  ON training_log(player_id, submitted_at_utc);

CREATE INDEX IF NOT EXISTS idx_training_log_session
  ON training_log(session_id);

INSERT OR REPLACE INTO players (player_id, display_name, active, sort_order) VALUES
  ('640', 'Gabriel', 1, 1),
  ('641', 'Matt', 1, 2),
  ('642', 'Zac', 1, 3),
  ('643', 'Darren', 1, 4),
  ('612', 'Theo', 1, 5),
  ('644', 'Corey', 1, 6),
  ('645', 'James', 1, 7),
  ('646', 'Mike', 1, 8);
