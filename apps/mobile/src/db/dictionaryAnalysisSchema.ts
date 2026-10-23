// Durable client operation metadata, separate from private content and SRS.
// No word foreign key: deletion must not erase an uncertain paid-operation ID.
export const MIGRATION_V18_DICTIONARY_ANALYSIS = `
  CREATE TABLE IF NOT EXISTS dictionary_analysis_client_operations (
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    operation_json TEXT NOT NULL,
    PRIMARY KEY (user_id, word_id),
    UNIQUE (user_id, operation_id)
  );
`

export const MIGRATION_V19_DICTIONARY_ANALYSIS_HISTORY = `
  CREATE TABLE IF NOT EXISTS dictionary_analysis_client_history (
    archive_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    operation_json TEXT NOT NULL,
    UNIQUE (user_id, operation_id)
  );
  CREATE INDEX IF NOT EXISTS dictionary_analysis_history_word
    ON dictionary_analysis_client_history(user_id, word_id, archive_sequence);
  CREATE TRIGGER IF NOT EXISTS dictionary_analysis_reserved_insert
    BEFORE INSERT ON dictionary_analysis_client_operations
    WHEN EXISTS (SELECT 1 FROM dictionary_analysis_client_history
      WHERE user_id = NEW.user_id AND operation_id = NEW.operation_id)
    BEGIN SELECT RAISE(ABORT, 'Shared analysis operation ID is already reserved'); END;
  CREATE TRIGGER IF NOT EXISTS dictionary_analysis_reserved_update
    BEFORE UPDATE OF operation_id ON dictionary_analysis_client_operations
    WHEN EXISTS (SELECT 1 FROM dictionary_analysis_client_history
      WHERE user_id = NEW.user_id AND operation_id = NEW.operation_id)
    BEGIN SELECT RAISE(ABORT, 'Shared analysis operation ID is already reserved'); END;
`
