// Additive local read model for shared dictionary protocol 1.
// Existing words and every learning queue remain authoritative and untouched.
export const MIGRATION_V13_DICTIONARY_CONTENT = `
  CREATE TABLE IF NOT EXISTS dictionary_revision_cache (
    revision_id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    revision_no INTEGER NOT NULL CHECK (revision_no > 0),
    schema_version INTEGER NOT NULL CHECK (schema_version = 1),
    content_json TEXT NOT NULL CHECK (json_valid(content_json)),
    content_sha256 TEXT NOT NULL CHECK (length(content_sha256) = 64),
    cefr_input_sha256 TEXT NOT NULL CHECK (length(cefr_input_sha256) = 64),
    review_status TEXT NOT NULL
      CHECK (review_status IN ('published', 'retired')),
    cached_at TEXT NOT NULL,
    UNIQUE(entry_id, revision_id)
  );

  CREATE TABLE IF NOT EXISTS dictionary_cefr_assessment_cache (
    assessment_id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    input_sha256 TEXT NOT NULL CHECK (length(input_sha256) = 64),
    cefr_level TEXT CHECK (
      cefr_level IS NULL OR cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
    ),
    status TEXT NOT NULL CHECK (status IN ('unknown', 'estimated', 'reviewed')),
    confidence REAL CHECK (
      confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),
    method TEXT NOT NULL,
    method_version TEXT NOT NULL,
    locked INTEGER NOT NULL CHECK (locked IN (0, 1)),
    supersedes_assessment_id TEXT,
    cached_at TEXT NOT NULL,
    UNIQUE(entry_id, input_sha256, assessment_id)
  );

  CREATE TABLE IF NOT EXISTS dictionary_cefr_head_cache (
    entry_id TEXT NOT NULL,
    input_sha256 TEXT NOT NULL,
    assessment_id TEXT NOT NULL,
    cached_at TEXT NOT NULL,
    PRIMARY KEY(entry_id, input_sha256),
    FOREIGN KEY(entry_id, input_sha256, assessment_id)
      REFERENCES dictionary_cefr_assessment_cache(
        entry_id, input_sha256, assessment_id
      ) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dictionary_card_content (
    word_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_version INTEGER NOT NULL CHECK (content_version >= 0),
    entry_id TEXT,
    revision_id TEXT,
    fallback_content_json TEXT CHECK (
      fallback_content_json IS NULL OR json_valid(fallback_content_json)
    ),
    overrides_json TEXT NOT NULL DEFAULT '{}'
      CHECK (json_valid(overrides_json)),
    updated_at TEXT NOT NULL,
    CHECK (
      (entry_id IS NULL AND revision_id IS NULL AND fallback_content_json IS NOT NULL)
      OR
      (entry_id IS NOT NULL AND revision_id IS NOT NULL AND fallback_content_json IS NULL)
    ),
    FOREIGN KEY(word_id) REFERENCES words(word_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dictionary_content_commands (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN (
      'create-private', 'edit-private', 'link', 'adopt-revision',
      'detach', 'resolve-conflict'
    )),
    expected_content_version INTEGER NOT NULL
      CHECK (expected_content_version >= 0),
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'error', 'conflict')),
    queued_at TEXT NOT NULL,
    last_error TEXT,
    FOREIGN KEY(word_id) REFERENCES words(word_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dictionary_change_cursors (
    user_id TEXT PRIMARY KEY,
    committed_version INTEGER NOT NULL DEFAULT 0
      CHECK (committed_version >= 0),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dictionary_card_refresh_queue (
    word_id TEXT PRIMARY KEY REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_dictionary_card_content_owner
    ON dictionary_card_content(user_id, word_id);
  CREATE INDEX IF NOT EXISTS idx_dictionary_card_content_revision
    ON dictionary_card_content(entry_id, revision_id);
  CREATE INDEX IF NOT EXISTS idx_dictionary_commands_owner_sequence
    ON dictionary_content_commands(user_id, sequence);
  CREATE INDEX IF NOT EXISTS idx_dictionary_commands_word
    ON dictionary_content_commands(word_id, sequence);

  CREATE TRIGGER IF NOT EXISTS validate_dictionary_card_owner_insert
  BEFORE INSERT ON dictionary_card_content
  WHEN NOT EXISTS (
    SELECT 1 FROM words
    WHERE words.word_id = NEW.word_id AND words.user_id = NEW.user_id
  ) BEGIN
    SELECT RAISE(ABORT, 'dictionary card owner mismatch');
  END;

  CREATE TRIGGER IF NOT EXISTS validate_dictionary_card_owner_update
  BEFORE UPDATE ON dictionary_card_content
  WHEN NOT EXISTS (
    SELECT 1 FROM words
    WHERE words.word_id = NEW.word_id AND words.user_id = NEW.user_id
  ) BEGIN
    SELECT RAISE(ABORT, 'dictionary card owner mismatch');
  END;

  CREATE TRIGGER IF NOT EXISTS validate_dictionary_command_owner
  BEFORE INSERT ON dictionary_content_commands
  WHEN NOT EXISTS (
    SELECT 1 FROM words
    WHERE words.word_id = NEW.word_id
      AND words.user_id = NEW.user_id
      AND words.deleted_at IS NULL
  ) BEGIN
    SELECT RAISE(ABORT, 'dictionary command owner mismatch');
  END;
`
