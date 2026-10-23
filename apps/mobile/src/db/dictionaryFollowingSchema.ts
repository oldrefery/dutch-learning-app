const decimalCheck = (column: string): string => `
  typeof(${column}) = 'text'
  AND length(${column}) BETWEEN 1 AND 19
  AND ${column} NOT GLOB '*[^0-9]*'
  AND (${column} = '0' OR substr(${column}, 1, 1) != '0')
  AND (length(${column}) < 19 OR ${column} <= '9223372036854775807')
`

// Protocol2 is a downloaded read model. Never backfill modes, private originals,
// protocol1 cursors or pending commands from assumptions about server state.
export const MIGRATION_V17_DICTIONARY_FOLLOWING = `
  CREATE TABLE IF NOT EXISTS dictionary_following_heads (
    user_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    revision_id TEXT NOT NULL,
    head_sequence TEXT NOT NULL CHECK (${decimalCheck('head_sequence')}),
    watermark TEXT NOT NULL CHECK (${decimalCheck('watermark')}),
    cached_at TEXT NOT NULL,
    PRIMARY KEY(user_id, entry_id),
    FOREIGN KEY(entry_id, revision_id)
      REFERENCES dictionary_revision_cache(entry_id, revision_id)
  );

  CREATE TABLE IF NOT EXISTS dictionary_effective_card_cache (
    word_id TEXT PRIMARY KEY REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('legacy', 'follow')),
    entry_id TEXT,
    revision_id TEXT,
    content_version TEXT NOT NULL CHECK (${decimalCheck('content_version')}),
    head_sequence TEXT CHECK (head_sequence IS NULL OR (${decimalCheck('head_sequence')})),
    watermark TEXT NOT NULL CHECK (${decimalCheck('watermark')}),
    card_json TEXT NOT NULL CHECK (json_valid(card_json)),
    cached_at TEXT NOT NULL,
    CHECK ((entry_id IS NULL) = (revision_id IS NULL)),
    CHECK ((mode = 'follow' AND entry_id IS NOT NULL AND head_sequence IS NOT NULL)
      OR (mode = 'legacy' AND head_sequence IS NULL)),
    FOREIGN KEY(entry_id, revision_id)
      REFERENCES dictionary_revision_cache(entry_id, revision_id)
  );

  CREATE INDEX IF NOT EXISTS idx_dictionary_effective_owner_entry
    ON dictionary_effective_card_cache(user_id, entry_id, word_id);

  CREATE TABLE IF NOT EXISTS dictionary_following_cursors (
    user_id TEXT PRIMARY KEY,
    committed_cursor TEXT NOT NULL CHECK (${decimalCheck('committed_cursor')}),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dictionary_following_refresh_queue (
    word_id TEXT PRIMARY KEY REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    refresh_version INTEGER NOT NULL CHECK (refresh_version > 0),
    completed_refresh_version INTEGER NOT NULL DEFAULT 0
      CHECK (completed_refresh_version >= 0 AND completed_refresh_version <= refresh_version)
  );

  CREATE INDEX IF NOT EXISTS idx_dictionary_following_refresh_owner
    ON dictionary_following_refresh_queue(user_id, word_id);

  CREATE TRIGGER IF NOT EXISTS validate_dictionary_effective_owner_insert
  BEFORE INSERT ON dictionary_effective_card_cache
  WHEN NOT EXISTS (SELECT 1 FROM words WHERE word_id = NEW.word_id
    AND user_id = NEW.user_id AND deleted_at IS NULL)
  BEGIN SELECT RAISE(ABORT, 'dictionary cache owner mismatch'); END;

  CREATE TRIGGER IF NOT EXISTS validate_dictionary_effective_owner_update
  BEFORE UPDATE ON dictionary_effective_card_cache
  WHEN NOT EXISTS (SELECT 1 FROM words WHERE word_id = NEW.word_id
    AND user_id = NEW.user_id AND deleted_at IS NULL)
  BEGIN SELECT RAISE(ABORT, 'dictionary cache owner mismatch'); END;

  CREATE TRIGGER IF NOT EXISTS validate_dictionary_following_refresh_owner
  BEFORE INSERT ON dictionary_following_refresh_queue
  WHEN NOT EXISTS (SELECT 1 FROM words WHERE word_id = NEW.word_id
    AND user_id = NEW.user_id AND deleted_at IS NULL)
  BEGIN SELECT RAISE(ABORT, 'dictionary refresh owner mismatch'); END;
`
