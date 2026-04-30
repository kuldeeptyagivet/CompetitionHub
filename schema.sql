-- CompetitionHub D1 Schema
-- Database: competitionhub-db
-- Run this in the D1 dashboard → competitionhub-db → Console

-- ============================================================
-- TABLE: plans
-- ============================================================
CREATE TABLE IF NOT EXISTS plans (
  id              TEXT    PRIMARY KEY,
  name            TEXT    NOT NULL,
  max_questions   INTEGER NOT NULL DEFAULT 25,
  max_books       INTEGER NOT NULL DEFAULT 1,
  allow_extracted INTEGER NOT NULL DEFAULT 0,
  filter_types    TEXT    NOT NULL DEFAULT 'all',
  created_at      TEXT    NOT NULL
);

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  email      TEXT PRIMARY KEY,
  role       TEXT    NOT NULL DEFAULT 'user',   -- superadmin | admin | user
  plan_id    TEXT    NOT NULL DEFAULT 'free' REFERENCES plans(id),
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL
);

-- ============================================================
-- TABLE: question_overrides
-- ============================================================
CREATE TABLE IF NOT EXISTS question_overrides (
  question_id   TEXT PRIMARY KEY,
  override_data TEXT NOT NULL,   -- full JSON of corrected fields
  edited_by     TEXT NOT NULL,   -- admin email
  edited_at     TEXT NOT NULL,
  note          TEXT
);

-- ============================================================
-- SEED: plans
-- ============================================================
INSERT OR IGNORE INTO plans (id, name, max_questions, max_books, allow_extracted, filter_types, created_at)
VALUES
  ('free', 'Free', 25,  1,   0, 'all', datetime('now')),
  ('pro',  'Pro',  100, 999, 0, 'all', datetime('now'));

-- ============================================================
-- SEED: users
-- ============================================================
INSERT OR IGNORE INTO users (email, role, plan_id, is_active, created_at)
VALUES
  ('drtyagivet@gmail.com', 'superadmin', 'pro', 1, datetime('now'));
-- MIGRATION: add plan_expires_at to users
ALTER TABLE users ADD COLUMN plan_expires_at TEXT;

-- TABLE: announcements
CREATE TABLE IF NOT EXISTS announcements (
  id          TEXT PRIMARY KEY,
  message     TEXT NOT NULL,
  target_plan TEXT NOT NULL DEFAULT 'all',
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT
);

-- TABLE: user_notes
CREATE TABLE IF NOT EXISTS user_notes (
  id         TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  note       TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- TABLE: messages
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  from_email  TEXT NOT NULL,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  thread_id   TEXT
);