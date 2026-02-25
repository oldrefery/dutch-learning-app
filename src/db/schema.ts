// SQLite schema for offline-first sync
// All tables mirror Supabase structure with sync metadata

export const SQL_SCHEMA = `
  -- Collections table (local copy of Supabase collections)
  CREATE TABLE IF NOT EXISTS collections (
    collection_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_shared BOOLEAN DEFAULT 0,
    shared_with TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT DEFAULT 'synced'
  );

  -- Words table (local copy of Supabase words)
  CREATE TABLE IF NOT EXISTS words (
    word_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    collection_id TEXT,
    dutch_lemma TEXT NOT NULL,
    dutch_original TEXT,
    part_of_speech TEXT,
    is_irregular BOOLEAN DEFAULT 0,
    is_reflexive BOOLEAN DEFAULT 0,
    is_expression BOOLEAN DEFAULT 0,
    expression_type TEXT,
    is_separable BOOLEAN DEFAULT 0,
    prefix_part TEXT,
    root_verb TEXT,
    article TEXT,
    plural TEXT,
    translations TEXT NOT NULL,
    examples TEXT,
    synonyms TEXT,
    antonyms TEXT,
    conjugation TEXT,
    preposition TEXT,
    image_url TEXT,
    tts_url TEXT,
    interval_days INTEGER DEFAULT 1,
    repetition_count INTEGER DEFAULT 0,
    easiness_factor REAL DEFAULT 2.5,
    next_review_date TEXT NOT NULL,
    last_reviewed_at TEXT,
    analysis_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT DEFAULT 'synced'
  );

  -- User progress table (local cache of user_progress from Supabase)
  CREATE TABLE IF NOT EXISTS user_progress (
    progress_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    status TEXT NOT NULL,
    reviewed_count INTEGER DEFAULT 0,
    last_reviewed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_status TEXT DEFAULT 'synced',
    FOREIGN KEY (word_id) REFERENCES words(word_id)
  );

  -- Sync metadata table
  CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
  CREATE INDEX IF NOT EXISTS idx_collections_sync_status ON collections(sync_status);
  CREATE INDEX IF NOT EXISTS idx_words_user_id ON words(user_id);
  CREATE INDEX IF NOT EXISTS idx_words_collection_id ON words(collection_id);
  CREATE INDEX IF NOT EXISTS idx_words_updated_at ON words(updated_at);
  CREATE INDEX IF NOT EXISTS idx_words_sync_status ON words(sync_status);
  CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_progress_word_id ON user_progress(word_id);
  CREATE INDEX IF NOT EXISTS idx_user_progress_updated_at ON user_progress(updated_at);
  CREATE INDEX IF NOT EXISTS idx_user_progress_sync_status ON user_progress(sync_status);
`

// Migration v3: Unique semantic index to prevent duplicate words
// Semantic key = (user_id, dutch_lemma_normalized, part_of_speech_normalized, article_normalized)
export const MIGRATION_V3_UNIQUE_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_words_semantic_key
  ON words(
    user_id,
    LOWER(dutch_lemma),
    COALESCE(part_of_speech, 'unknown'),
    COALESCE(article, '')
  );
`

export type SyncStatus = 'synced' | 'pending' | 'error' | 'conflict'
