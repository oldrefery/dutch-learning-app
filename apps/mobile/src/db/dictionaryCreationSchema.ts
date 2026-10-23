// Owner-bound intent/receipts survive personal card deletion. No word/Auth FK.
export const MIGRATION_V22_DICTIONARY_CREATION = `
  CREATE TABLE IF NOT EXISTS dictionary_creation_client_journal (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    resolution_id TEXT NOT NULL,
    operation_id TEXT,
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
    UNIQUE(user_id, resolution_id),
    UNIQUE(user_id, operation_id)
  );
  CREATE INDEX IF NOT EXISTS idx_creation_journal_owner_sequence
    ON dictionary_creation_client_journal(user_id, sequence);
`
