export const MIGRATION_V24_DICTIONARY_PERSONAL_STATE = `
  CREATE TABLE IF NOT EXISTS dictionary_personal_state (
    word_id TEXT PRIMARY KEY REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('legacy','follow')),
    entry_id TEXT,
    adopted_revision_id TEXT,
    content_version TEXT NOT NULL,
    observed_updated_at TEXT NOT NULL,
    content_pending INTEGER NOT NULL CHECK (content_pending IN (0,1)),
    sparse INTEGER NOT NULL CHECK (sparse IN (0,1))
  );
`

// Readiness is persisted even when the experimental reader is turned off.
export const WORD_CONTENT_READY = `NOT EXISTS (
  SELECT 1 FROM dictionary_personal_state s
  WHERE s.word_id = words.word_id AND s.user_id = words.user_id
    AND (s.content_pending = 1 OR (s.sparse = 1 AND NOT EXISTS (
      SELECT 1 FROM dictionary_effective_card_cache c
      WHERE c.word_id = s.word_id AND c.user_id = s.user_id AND c.mode = s.mode
        AND c.entry_id IS s.entry_id
    )))
)`
