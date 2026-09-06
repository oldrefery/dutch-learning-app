import { MIGRATION_V9_LEARNING_COMMANDS } from './schema'

export const MIGRATION_V11_CORRECTION_RESOLUTION =
  'ALTER TABLE review_corrections ADD COLUMN resolved_at TEXT;'

// Run atomically. Rebuilding the CHECK constraint retains durable sequence IDs,
// including the high-water mark when earlier commands have been acknowledged.
export const MIGRATION_V10_REVIEW_CORRECTIONS = `
  DROP TRIGGER IF EXISTS queue_review_command;
  DROP TRIGGER IF EXISTS acknowledge_review_command;
  DROP TRIGGER IF EXISTS delete_review_command;
  DROP TRIGGER IF EXISTS delete_learning_commands_on_tombstone;
  DROP TRIGGER IF EXISTS queue_correction_command;
  DROP TRIGGER IF EXISTS acknowledge_correction_command;
  DROP TRIGGER IF EXISTS delete_correction_command;
  CREATE TABLE learning_commands_v10 (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('review', 'reset', 'correction')),
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL REFERENCES words(word_id) ON DELETE CASCADE,
    reset_at TEXT,
    review_date TEXT
  );
  INSERT INTO learning_commands_v10 SELECT * FROM learning_commands;
  UPDATE sqlite_sequence SET seq = MAX(seq,
    COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'learning_commands'), 0))
    WHERE name = 'learning_commands_v10';
  DROP TABLE learning_commands;
  ALTER TABLE learning_commands_v10 RENAME TO learning_commands;
  ${MIGRATION_V9_LEARNING_COMMANDS}
  CREATE TABLE IF NOT EXISTS review_corrections (
    correction_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES review_events(event_id) ON DELETE CASCADE,
    word_id TEXT NOT NULL REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    assessment TEXT NOT NULL CHECK (assessment IN ('again', 'hard', 'good', 'easy')),
    revision INTEGER,
    next_interval_days INTEGER,
    next_repetition_count INTEGER,
    next_easiness_factor REAL,
    created_at TEXT,
    queued_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'synced', 'conflict')),
    error TEXT,
    CHECK (status != 'synced' OR (
      revision IS NOT NULL AND revision = expected_revision + 1
      AND next_interval_days IS NOT NULL AND next_interval_days >= 0
      AND next_repetition_count IS NOT NULL AND next_repetition_count >= 0
      AND next_easiness_factor IS NOT NULL AND next_easiness_factor BETWEEN 1.3 AND 2.5
      AND created_at IS NOT NULL
    ))
  );
  CREATE INDEX IF NOT EXISTS idx_review_corrections_event
    ON review_corrections(user_id, event_id, revision);
  CREATE TRIGGER queue_correction_command AFTER INSERT ON review_corrections
  WHEN NEW.status = 'pending' BEGIN
    INSERT INTO learning_commands(operation_id, kind, user_id, word_id)
      VALUES (NEW.correction_id, 'correction', NEW.user_id, NEW.word_id);
  END;
  CREATE TRIGGER acknowledge_correction_command AFTER UPDATE ON review_corrections
  WHEN NEW.status = 'synced' BEGIN
    DELETE FROM learning_commands WHERE operation_id = NEW.correction_id AND kind = 'correction';
  END;
  CREATE TRIGGER delete_correction_command AFTER DELETE ON review_corrections BEGIN
    DELETE FROM learning_commands WHERE operation_id = OLD.correction_id AND kind = 'correction';
  END;
  DROP VIEW IF EXISTS effective_review_events;
  CREATE VIEW effective_review_events AS
    SELECT e.event_id, e.user_id, e.word_id,
      COALESCE(c.assessment, e.assessment) AS assessment,
      e.review_mode, e.answered_correctly, e.response_time_ms,
      e.previous_interval_days, COALESCE(c.next_interval_days, e.next_interval_days) AS next_interval_days,
      e.previous_easiness_factor, COALESCE(c.next_easiness_factor, e.next_easiness_factor) AS next_easiness_factor,
      e.reviewed_at, e.review_date, e.created_at, e.sync_status, e.last_sync_attempt_at, e.synced_at,
      e.assessment AS original_assessment, COALESCE(c.revision, 0) AS revision
    FROM review_events e LEFT JOIN review_corrections c ON c.correction_id = (
      SELECT r.correction_id FROM review_corrections r WHERE r.event_id = e.event_id
        AND r.user_id = e.user_id AND r.status = 'synced'
      ORDER BY r.revision DESC LIMIT 1
    );
`
