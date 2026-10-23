// Separate protocol2 metadata survives local word deletion and never rewrites v1.
export const MIGRATION_V20_DICTIONARY_FOLLOWING_IMPORTS = `
  CREATE TABLE IF NOT EXISTS dictionary_following_import_journal (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
    UNIQUE(user_id, operation_id)
  );
  CREATE INDEX IF NOT EXISTS idx_following_import_owner_sequence
    ON dictionary_following_import_journal(user_id, sequence);
`
