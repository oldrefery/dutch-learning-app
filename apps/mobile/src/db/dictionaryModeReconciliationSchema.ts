// Protected decisions deliberately survive personal card deletion and cache pruning.
export const MIGRATION_V23_DICTIONARY_MODE_RECONCILIATION = `
  CREATE TABLE IF NOT EXISTS dictionary_mode_reconciliations (
    operation_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    decision_json TEXT NOT NULL CHECK(json_valid(decision_json)),
    applied_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_mode_reconciliations_owner_word
    ON dictionary_mode_reconciliations(user_id, word_id);
  CREATE TRIGGER IF NOT EXISTS dictionary_mode_reconciliations_immutable
    BEFORE UPDATE ON dictionary_mode_reconciliations
    BEGIN SELECT RAISE(ABORT, 'Protected dictionary decision is immutable'); END;
  CREATE TABLE IF NOT EXISTS dictionary_mode_reconciliation_requests (
    word_id TEXT PRIMARY KEY REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL
  );
`
