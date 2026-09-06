// Receipt acknowledgement and canonical SRS application are separate durable steps.
export const MIGRATION_V12_CORRECTION_RECOVERY = `
  CREATE TABLE IF NOT EXISTS review_correction_recovery (
    correction_id TEXT PRIMARY KEY REFERENCES review_corrections(correction_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    word_id TEXT NOT NULL REFERENCES words(word_id) ON DELETE CASCADE
  );
  INSERT OR IGNORE INTO review_correction_recovery
    SELECT correction_id, user_id, word_id FROM review_corrections
    WHERE status != 'synced' AND resolved_at IS NULL;
  CREATE TRIGGER IF NOT EXISTS retain_correction_recovery AFTER INSERT ON review_corrections
  WHEN NEW.status = 'pending' BEGIN
    INSERT INTO review_correction_recovery VALUES (NEW.correction_id, NEW.user_id, NEW.word_id);
  END;
  CREATE TRIGGER IF NOT EXISTS guard_learning_during_correction BEFORE INSERT ON learning_commands
  WHEN NEW.kind IN ('review', 'reset') AND EXISTS (
    SELECT 1 FROM review_correction_recovery WHERE user_id = NEW.user_id
  ) BEGIN
    SELECT RAISE(ABORT, 'Finish synchronizing the pending review correction before another assessment or reset');
  END;
  CREATE TRIGGER IF NOT EXISTS release_correction_on_tombstone AFTER UPDATE OF deleted_at ON words
  WHEN NEW.deleted_at IS NOT NULL BEGIN
    DELETE FROM review_correction_recovery WHERE user_id = NEW.user_id AND word_id = NEW.word_id;
  END;
`
