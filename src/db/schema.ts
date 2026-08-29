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
    sync_status TEXT DEFAULT 'synced',
    last_sync_attempt_at TEXT,
    synced_at TEXT
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
    register TEXT,
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
    deleted_at TEXT,
    sync_status TEXT DEFAULT 'synced',
    last_sync_attempt_at TEXT,
    synced_at TEXT
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
    deleted_at TEXT,
    sync_status TEXT DEFAULT 'synced',
    last_sync_attempt_at TEXT,
    synced_at TEXT,
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
  CREATE INDEX IF NOT EXISTS idx_words_deleted_at ON words(user_id, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_progress_word_id ON user_progress(word_id);
  CREATE INDEX IF NOT EXISTS idx_user_progress_updated_at ON user_progress(updated_at);
  CREATE INDEX IF NOT EXISTS idx_user_progress_sync_status ON user_progress(sync_status);
  CREATE INDEX IF NOT EXISTS idx_user_progress_deleted_at ON user_progress(user_id, deleted_at);
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

// Migration v4: Add register column for formality marking
export const MIGRATION_V4_ADD_REGISTER = `
  ALTER TABLE words ADD COLUMN register TEXT;
`

// Migration v5: Persist offline deletes and keep semantic uniqueness for active rows.
export const MIGRATION_V5_ADD_WORD_DELETED_AT = `
  ALTER TABLE words ADD COLUMN deleted_at TEXT;
`

export const MIGRATION_V5_ADD_PROGRESS_DELETED_AT = `
  ALTER TABLE user_progress ADD COLUMN deleted_at TEXT;
`

export const MIGRATION_V5_TOMBSTONE_INDEXES = `
  DROP INDEX IF EXISTS idx_words_semantic_key;

  CREATE UNIQUE INDEX idx_words_semantic_key
  ON words(
    user_id,
    LOWER(dutch_lemma),
    COALESCE(part_of_speech, 'unknown'),
    COALESCE(article, '')
  )
  WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_words_deleted_at
  ON words(user_id, deleted_at);

  CREATE INDEX IF NOT EXISTS idx_user_progress_deleted_at
  ON user_progress(user_id, deleted_at);
`

export const MIGRATION_V6_SYNC_TIMESTAMP_COLUMNS = [
  {
    migration: 'ALTER TABLE collections ADD COLUMN last_sync_attempt_at TEXT;',
    columnName: 'collections.last_sync_attempt_at',
  },
  {
    migration: 'ALTER TABLE collections ADD COLUMN synced_at TEXT;',
    columnName: 'collections.synced_at',
  },
  {
    migration: 'ALTER TABLE words ADD COLUMN last_sync_attempt_at TEXT;',
    columnName: 'words.last_sync_attempt_at',
  },
  {
    migration: 'ALTER TABLE words ADD COLUMN synced_at TEXT;',
    columnName: 'words.synced_at',
  },
  {
    migration:
      'ALTER TABLE user_progress ADD COLUMN last_sync_attempt_at TEXT;',
    columnName: 'user_progress.last_sync_attempt_at',
  },
  {
    migration: 'ALTER TABLE user_progress ADD COLUMN synced_at TEXT;',
    columnName: 'user_progress.synced_at',
  },
] as const

// Migration v7: Append-only review event history for learning analytics.
export const MIGRATION_V7_REVIEW_EVENTS = `
  CREATE TABLE IF NOT EXISTS review_events (
    event_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    assessment TEXT NOT NULL
      CHECK (assessment IN ('again', 'hard', 'good', 'easy')),
    review_mode TEXT NOT NULL
      CHECK (review_mode IN ('recognition', 'meaning-recall', 'dutch-production')),
    answered_correctly INTEGER
      CHECK (answered_correctly IS NULL OR answered_correctly IN (0, 1)),
    response_time_ms INTEGER
      CHECK (
        response_time_ms IS NULL OR
        (response_time_ms >= 0 AND response_time_ms <= 3600000)
      ),
    previous_interval_days INTEGER NOT NULL
      CHECK (previous_interval_days >= 0),
    next_interval_days INTEGER NOT NULL
      CHECK (next_interval_days >= 0),
    previous_easiness_factor REAL NOT NULL
      CHECK (previous_easiness_factor > 0),
    next_easiness_factor REAL NOT NULL
      CHECK (next_easiness_factor > 0),
    reviewed_at TEXT NOT NULL,
    created_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (sync_status IN ('synced', 'pending', 'error', 'conflict')),
    last_sync_attempt_at TEXT,
    synced_at TEXT,
    FOREIGN KEY (word_id) REFERENCES words(word_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_review_events_user_reviewed
  ON review_events(user_id, reviewed_at, event_id);

  CREATE INDEX IF NOT EXISTS idx_review_events_user_created
  ON review_events(user_id, created_at, event_id);

  CREATE INDEX IF NOT EXISTS idx_review_events_word_reviewed
  ON review_events(word_id, reviewed_at, event_id);

  CREATE INDEX IF NOT EXISTS idx_review_events_sync_status
  ON review_events(sync_status);

  DROP TRIGGER IF EXISTS delete_review_events_for_tombstoned_word;

  CREATE TRIGGER delete_review_events_for_tombstoned_word
  AFTER UPDATE OF deleted_at ON words
  WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
  BEGIN
    DELETE FROM review_events WHERE word_id = NEW.word_id;
  END;
`

export type SyncStatus = 'synced' | 'pending' | 'error' | 'conflict' | 'deleted'
