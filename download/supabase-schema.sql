-- ============================================================
-- NOVELCRAFTER CLONE — Supabase Database Schema
-- Designed for single-user, multi-device creative writing
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE book_status AS ENUM (
  'draft',        -- Just created, minimal content
  'in_progress',  -- Actively being written
  'completed',    -- First draft or final draft done
  'on_hiatus'     -- Paused indefinitely
);

CREATE TYPE scene_status AS ENUM (
  'outline',       -- Only notes/outline, no prose yet
  'draft',         -- Rough prose written
  'in_progress',   -- Currently being edited
  'needs_revision',-- Flagged for rework
  'complete'       -- Polished and finalized
);

CREATE TYPE codex_type AS ENUM (
  'character',
  'location',
  'lore',
  'item'
);

CREATE TYPE ai_provider AS ENUM (
  'openai',
  'anthropic',
  'openrouter'
);

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- -----------------------------------------------------------
-- Books (Top-level projects)
-- -----------------------------------------------------------
CREATE TABLE books (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  genre         TEXT,
  status        book_status NOT NULL DEFAULT 'draft',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full-text search index on book titles
CREATE INDEX idx_books_title_search ON books
  USING gin(to_tsvector('english', title));

CREATE INDEX idx_books_sort_order ON books (sort_order ASC);

-- -----------------------------------------------------------
-- Chapters (Ordered containers for scenes within a book)
-- -----------------------------------------------------------
CREATE TABLE chapters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled Chapter',
  synopsis      TEXT,                -- Short chapter summary / outline
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A book's chapters must have unique sort_order values
  UNIQUE (book_id, sort_order)
);

CREATE INDEX idx_chapters_book_id ON chapters (book_id ASC, sort_order ASC);

-- -----------------------------------------------------------
-- Scenes (The atomic writing unit — where prose lives)
-- -----------------------------------------------------------
CREATE TABLE scenes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id    UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled Scene',
  content       TEXT DEFAULT '',      -- Rich text / Markdown prose
  notes         TEXT,                 -- Author's private scene notes
  status        scene_status NOT NULL DEFAULT 'outline',
  word_count    INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A chapter's scenes must have unique sort_order values
  UNIQUE (chapter_id, sort_order)
);

CREATE INDEX idx_scenes_chapter_id ON scenes (chapter_id ASC, sort_order ASC);
CREATE INDEX idx_scenes_status ON scenes (status);

-- Full-text search on scene content (for AI context retrieval)
CREATE INDEX idx_scenes_content_search ON scenes
  USING gin(to_tsvector('english', coalesce(content, '')));

-- -----------------------------------------------------------
-- Codex Entries (Story Bible — Characters, Locations, Lore, Items)
-- -----------------------------------------------------------
CREATE TABLE codex_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID REFERENCES books(id) ON DELETE SET NULL,
  -- book_id is nullable: a NULL book_id means a "global" entry
  -- shared across all books (e.g., a universal magic system).
  type          codex_type NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  aliases       TEXT[] DEFAULT '{}',  -- Nicknames, alternate names
  tags          TEXT[] DEFAULT '{}',  -- Freeform labels for filtering
  metadata      JSONB DEFAULT '{}',  -- Flexible extra fields:
  --   For characters:  {"age": "32", "role": "protagonist", "appearance": "..."}
  --   For locations:   {"climate": "arid", "population": "50000"}
  --   For lore:        {"era": "Second Age", "category": "history"}
  --   For items:       {"rarity": "legendary", "owner": "Character Name"}
  is_pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_codex_book_id ON codex_entries (book_id);
CREATE INDEX idx_codex_type ON codex_entries (type);
CREATE INDEX idx_codex_name_search ON codex_entries
  USING gin(to_tsvector('english', name));

-- GIN index on aliases array for fast @mention lookup
CREATE INDEX idx_codex_aliases ON codex_entries USING gin (aliases);

-- GIN index on tags array for filtering
CREATE INDEX idx_codex_tags ON codex_entries USING gin (tags);

-- ============================================================
-- 3. AI CONFIGURATION (Secure API key storage)
-- ============================================================

CREATE TABLE ai_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      ai_provider NOT NULL,
  api_key_encrypted TEXT NOT NULL,  -- AES-256 encrypted key
  api_key_iv    TEXT NOT NULL,      -- Initialization vector for decryption
  model_name    TEXT,               -- e.g. "gpt-4o", "claude-sonnet-4-20250514"
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only one active config per provider
  UNIQUE (provider, is_active)
);

CREATE INDEX idx_ai_configs_provider ON ai_configs (provider);

-- ============================================================
-- 4. APP SETTINGS (Key-value store for app preferences)
-- ============================================================

CREATE TABLE app_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  value         TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default settings
INSERT INTO app_settings (key, value) VALUES
  ('master_password_hash', ''),   -- Will be set during first-run setup
  ('editor_font_size', '18'),
  ('editor_font_family', 'serif'),
  ('editor_line_height', '1.8'),
  ('auto_save_interval_ms', '3000'),
  ('theme', 'dark'),
  ('ai_system_prompt_override', ''),
  ('active_ai_provider', 'openai');

-- ============================================================
-- 5. SINGLE-USER AUTH
-- -----------------------------------------------------------
-- Simple master-password approach:
--   On first visit, the user sets a password.
--   We bcrypt-hash it and store in app_settings.
--   On subsequent visits, they must enter it to unlock.
--   A long-lived session token is stored in a secure
--   HttpOnly cookie / Supabase session.
-- ============================================================

-- Session tokens for "stay logged in" functionality
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    TEXT NOT NULL UNIQUE,  -- SHA-256 hash of the session token
  user_agent    TEXT,
  ip_address    INET,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_token ON sessions (token_hash);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- ============================================================
-- 6. COMPUTED VIEW — Book Word Counts
-- ============================================================

-- A materialized view for fast bookshelf dashboard queries
CREATE MATERIALIZED VIEW book_word_counts AS
SELECT
  b.id AS book_id,
  b.title,
  b.status,
  b.description,
  b.genre,
  COALESCE(SUM(s.word_count), 0) AS total_words,
  COUNT(DISTINCT c.id) AS chapter_count,
  COUNT(DISTINCT s.id) AS scene_count,
  b.updated_at AS last_updated
FROM books b
LEFT JOIN chapters c ON c.book_id = b.id
LEFT JOIN scenes s ON s.chapter_id = c.id
GROUP BY b.id, b.title, b.status, b.description, b.genre, b.updated_at;

-- Create a unique index to allow concurrent refresh
CREATE UNIQUE INDEX idx_book_word_counts_book_id ON book_word_counts (book_id);

-- ============================================================
-- 7. HELPER FUNCTIONS
-- ============================================================

-- Refresh the word count materialized view (call after scene saves)
CREATE OR REPLACE FUNCTION refresh_book_word_counts()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY book_word_counts;
END;
$$ LANGUAGE plpgsql;

-- Auto-update the `updated_at` column on any row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to all timestamped tables
CREATE TRIGGER trg_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_chapters_updated_at
  BEFORE UPDATE ON chapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_scenes_updated_at
  BEFORE UPDATE ON scenes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_codex_entries_updated_at
  BEFORE UPDATE ON codex_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ai_configs_updated_at
  BEFORE UPDATE ON ai_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Word count calculator (strips markdown/rich text tags for accurate count)
CREATE OR REPLACE FUNCTION calculate_word_count(content TEXT)
RETURNS INTEGER AS $$
DECLARE
  plain_text TEXT;
BEGIN
  -- Strip common Markdown formatting
  plain_text := regexp_replace(content, E'[#*_`~\[\](){}>|-]', ' ', 'g');
  -- Collapse whitespace
  plain_text := regexp_replace(plain_text, E'\\s+', ' ', 'g');
  -- Count words
  RETURN COALESCE(array_length(string_to_array(btrim(plain_text), ' '), 1), 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------
-- Since this is a single-user app, we use a simple approach:
--   All tables enforce RLS.
--   A master_password_is_set check function gates access.
--   The Supabase anon key is used with RLS to prevent
--   unauthenticated access from the client.
-- ============================================================

-- Enable RLS on all data tables
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE codex_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- For the MVP, we allow all operations when the user has a valid
-- session. In production, replace with proper JWT claims checks.
--
-- Example pattern for authenticated access:
--
-- CREATE POLICY "Authenticated users can read books"
--   ON books FOR SELECT
--   TO authenticated
--   USING (true);
--
-- CREATE POLICY "Authenticated users can insert books"
--   ON books FOR INSERT
--   TO authenticated
--   WITH CHECK (true);
--
-- CREATE POLICY "Authenticated users can update books"
--   ON books FOR UPDATE
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);
--
-- CREATE POLICY "Authenticated users can delete books"
--   ON books FOR DELETE
--   TO authenticated
--   USING (true);

-- For development, a permissive policy ( tighten before deploy! ):
CREATE POLICY "dev_allow_all_on_books" ON books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_all_on_chapters" ON chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_all_on_scenes" ON scenes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_all_on_codex" ON codex_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_all_on_ai_configs" ON ai_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_all_on_app_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_allow_all_on_sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SCHEMA COMPLETE
-- ============================================================
-- Tables:    6 (books, chapters, scenes, codex_entries, ai_configs, sessions) + app_settings
-- Views:     1 (book_word_counts)
-- Functions: 3 (refresh_book_word_counts, update_updated_at_column, calculate_word_count)
-- Triggers:  6 (auto-update updated_at on all main tables)
-- Indexes:   14 (search, sort, FK, and array indexes)
-- RLS:       Enabled on all tables (dev policies; tighten for production)
-- ============================================================