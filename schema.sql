-- 仅在新数据库没有 user_data 表时执行；旧数据库无需运行。
CREATE TABLE IF NOT EXISTS user_data (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
