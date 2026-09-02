CREATE TABLE IF NOT EXISTS state_lottery_reports (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  week_start DATE NOT NULL,
  file_name TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content TEXT NOT NULL,
  UNIQUE(store_id, report_type, week_start)
);