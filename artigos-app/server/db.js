const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'artigos.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  title TEXT,
  authors TEXT,
  year TEXT,
  disease TEXT,
  topics TEXT,
  summary TEXT,
  full_text TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title, disease, topics, summary, full_text, content='articles', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, title, disease, topics, summary, full_text)
  VALUES (new.id, new.title, new.disease, new.topics, new.summary, new.full_text);
END;

CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, disease, topics, summary, full_text)
  VALUES ('delete', old.id, old.title, old.disease, old.topics, old.summary, old.full_text);
END;

CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, disease, topics, summary, full_text)
  VALUES ('delete', old.id, old.title, old.disease, old.topics, old.summary, old.full_text);
  INSERT INTO articles_fts(rowid, title, disease, topics, summary, full_text)
  VALUES (new.id, new.title, new.disease, new.topics, new.summary, new.full_text);
END;
`);

module.exports = db;
