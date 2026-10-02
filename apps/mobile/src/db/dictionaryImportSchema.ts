// Durable import identity is independent of mutable content and learning queues.
export const MIGRATION_V14_DICTIONARY_IMPORTS = `
  CREATE TABLE IF NOT EXISTS dictionary_import_intents (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL UNIQUE REFERENCES words(word_id) ON DELETE CASCADE,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'error', 'conflict')),
    existing_word_id TEXT,
    last_error TEXT,
    queued_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_dictionary_import_owner_sequence
    ON dictionary_import_intents(user_id, sequence);
  CREATE TABLE IF NOT EXISTS dictionary_personal_refresh_queue (
    word_id TEXT PRIMARY KEY REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL
  );
  CREATE TRIGGER IF NOT EXISTS validate_dictionary_import_owner
  BEFORE INSERT ON dictionary_import_intents
  WHEN NOT EXISTS (
    SELECT 1 FROM words WHERE word_id = NEW.word_id AND user_id = NEW.user_id
      AND deleted_at IS NULL
  ) BEGIN
    SELECT RAISE(ABORT, 'dictionary import owner mismatch');
  END;
`

// Acknowledged imports must never fall back to legacy INSERT after remote deletion.
export const MIGRATION_V15_DICTIONARY_IMPORT_RECEIPTS = `
  CREATE TABLE IF NOT EXISTS dictionary_import_acknowledgements (
    word_id TEXT PRIMARY KEY REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_dictionary_import_ack_owner
    ON dictionary_import_acknowledgements(user_id);
  CREATE TRIGGER IF NOT EXISTS validate_dictionary_import_ack_owner
  BEFORE INSERT ON dictionary_import_acknowledgements
  WHEN NOT EXISTS (
    SELECT 1 FROM words WHERE word_id = NEW.word_id AND user_id = NEW.user_id
  ) BEGIN
    SELECT RAISE(ABORT, 'dictionary import acknowledgement owner mismatch');
  END;
`
