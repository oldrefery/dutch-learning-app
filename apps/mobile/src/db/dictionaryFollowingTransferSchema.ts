// Protected original documents are owner-bound drafts, never personal analysis.
export const MIGRATION_V21_DICTIONARY_FOLLOWING_TRANSFERS = `
  CREATE TABLE IF NOT EXISTS dictionary_following_transfer_sessions (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
    UNIQUE(user_id, session_id)
  );
  CREATE INDEX IF NOT EXISTS idx_following_transfer_owner_sequence
    ON dictionary_following_transfer_sessions(user_id, sequence);
`
