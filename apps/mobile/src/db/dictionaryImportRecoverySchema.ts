// Exact origin and placement delivery debt outlive the original import outbox.
// NULL acknowledgement/provenance means unknown, never implicitly delivered.
export const MIGRATION_V16_DICTIONARY_IMPORT_RECOVERY = `
  CREATE TABLE IF NOT EXISTS dictionary_import_delivery (
    word_id TEXT PRIMARY KEY REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    original_intent_json TEXT CHECK (
      original_intent_json IS NULL OR json_valid(original_intent_json)
    ),
    local_placement_revision INTEGER NOT NULL DEFAULT 0
      CHECK (local_placement_revision BETWEEN 0 AND 2147483647),
    acknowledged_placement_revision INTEGER CHECK (
      acknowledged_placement_revision BETWEEN 0 AND local_placement_revision
    ),
    recovery_version INTEGER CHECK (recovery_version BETWEEN 0 AND 2147483647),
    cancelled INTEGER NOT NULL DEFAULT 0 CHECK (cancelled IN (0,1))
  );
  CREATE TABLE IF NOT EXISTS dictionary_import_recovery_outbox (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id TEXT NOT NULL UNIQUE REFERENCES words(word_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    operation_id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('recovery','cancel')),
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
    placement_revision INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
      status IN ('pending','error','identity-conflict','state-conflict','placement-conflict')
    ),
    server_state_json TEXT CHECK (
      server_state_json IS NULL OR json_valid(server_state_json)
    ),
    last_error TEXT,
    queued_at TEXT NOT NULL,
    CHECK ((kind = 'recovery' AND placement_revision IS NOT NULL)
      OR (kind = 'cancel' AND placement_revision IS NULL))
  );
  CREATE INDEX IF NOT EXISTS idx_dictionary_import_recovery_owner_sequence
    ON dictionary_import_recovery_outbox(user_id,sequence);
  CREATE TRIGGER IF NOT EXISTS validate_dictionary_import_delivery_owner
  BEFORE INSERT ON dictionary_import_delivery WHEN NOT EXISTS (
    SELECT 1 FROM words WHERE word_id = NEW.word_id AND user_id = NEW.user_id
  ) BEGIN SELECT RAISE(ABORT,'dictionary delivery owner mismatch'); END;
  CREATE TRIGGER IF NOT EXISTS validate_dictionary_import_recovery_owner
  BEFORE INSERT ON dictionary_import_recovery_outbox WHEN NOT EXISTS (
    SELECT 1 FROM words WHERE word_id = NEW.word_id AND user_id = NEW.user_id
  ) BEGIN SELECT RAISE(ABORT,'dictionary recovery owner mismatch'); END;
  CREATE TRIGGER IF NOT EXISTS protect_dictionary_import_recovery_input
  BEFORE UPDATE ON dictionary_import_recovery_outbox
  WHEN NEW.word_id <> OLD.word_id OR NEW.user_id <> OLD.user_id
    OR (NEW.operation_id = OLD.operation_id AND
      (NEW.payload_json <> OLD.payload_json OR NEW.kind <> OLD.kind
        OR NEW.placement_revision IS NOT OLD.placement_revision))
  BEGIN SELECT RAISE(ABORT,'dictionary recovery input is immutable'); END;
  CREATE TRIGGER IF NOT EXISTS protect_dictionary_import_delivery_progress
  BEFORE UPDATE ON dictionary_import_delivery
  WHEN NEW.word_id <> OLD.word_id OR NEW.user_id <> OLD.user_id
    OR NEW.local_placement_revision < OLD.local_placement_revision
    OR (OLD.cancelled = 1 AND NEW.cancelled <> 1)
    OR (OLD.recovery_version IS NOT NULL AND
      (NEW.recovery_version IS NULL OR NEW.recovery_version < OLD.recovery_version))
    OR (OLD.acknowledged_placement_revision IS NOT NULL AND
      (NEW.acknowledged_placement_revision IS NULL
        OR NEW.acknowledged_placement_revision < OLD.acknowledged_placement_revision))
  BEGIN SELECT RAISE(ABORT,'dictionary delivery cannot regress'); END;
  CREATE TRIGGER IF NOT EXISTS protect_dictionary_import_delivery_origin
  BEFORE UPDATE OF original_intent_json ON dictionary_import_delivery
  WHEN NEW.original_intent_json IS NOT OLD.original_intent_json AND NOT (
    OLD.original_intent_json IS NOT NULL AND NEW.original_intent_json IS NOT NULL
    AND json_extract(NEW.original_intent_json,'$.operation_id')
      <> json_extract(OLD.original_intent_json,'$.operation_id')
    AND json_remove(NEW.original_intent_json,'$.operation_id')
      = json_remove(OLD.original_intent_json,'$.operation_id')
    AND OLD.recovery_version = 0 AND OLD.cancelled = 0
    AND EXISTS (SELECT 1 FROM dictionary_import_intents i WHERE i.word_id = OLD.word_id
      AND i.user_id = OLD.user_id AND i.status = 'conflict'
      AND i.operation_id = json_extract(OLD.original_intent_json,'$.operation_id'))
    AND NOT EXISTS (SELECT 1 FROM dictionary_import_acknowledgements a WHERE a.word_id = OLD.word_id)
    AND NOT EXISTS (SELECT 1 FROM dictionary_import_recovery_outbox r WHERE r.word_id = OLD.word_id)
  ) BEGIN SELECT RAISE(ABORT,'dictionary import origin is immutable'); END;
  INSERT OR IGNORE INTO dictionary_import_delivery(
    word_id,user_id,original_intent_json,recovery_version
  ) SELECT word_id,user_id,payload_json,0 FROM dictionary_import_intents;
  INSERT OR IGNORE INTO dictionary_import_delivery(word_id,user_id)
    SELECT word_id,user_id FROM dictionary_import_acknowledgements;
`
