\set ON_ERROR_STOP on
-- Run as the database operator after deploying dictionary-cefr-batch.
-- Pass cefr_source_id and cefr_pilot_entry_ids (a PostgreSQL UUID array) with -v.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF (SELECT count(*) FROM vault.decrypted_secrets
    WHERE name IN ('cefr_batch_project_url', 'cefr_batch_worker_secret')
      AND decrypted_secret <> '') <> 2 THEN
    RAISE EXCEPTION 'Missing CEFR batch Vault configuration';
  END IF;
END;
$$;

CREATE TEMP TABLE cefr_batch_pilot ON COMMIT DROP AS
SELECT :'cefr_source_id'::UUID AS source_id, :'cefr_pilot_entry_ids'::UUID[] AS entry_ids;
DO $$
DECLARE pilot RECORD;
BEGIN
  SELECT * INTO STRICT pilot FROM pg_temp.cefr_batch_pilot;
  IF NOT private.dictionary_cefr_batch_source_eligible(pilot.source_id) THEN
    RAISE EXCEPTION 'Missing approved CEFR batch provider source';
  END IF;
  IF cardinality(pilot.entry_ids) NOT BETWEEN 1 AND 25 OR array_position(pilot.entry_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Expected 1 to 25 pilot entry IDs';
  END IF;
  UPDATE private.dictionary_cefr_batch_settings
  SET enabled = TRUE, source_id = pilot.source_id, pilot_entry_ids = pilot.entry_ids, remaining_batches = 1
  WHERE singleton AND source_id IS NULL;
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM private.dictionary_cefr_batch_settings s
    WHERE s.singleton AND s.enabled AND s.source_id = pilot.source_id AND s.pilot_entry_ids = pilot.entry_ids) THEN
    RAISE EXCEPTION 'CEFR batch pilot was already configured with different settings';
  END IF;
END;
$$;

SELECT cron.schedule('woordenaar-dictionary-cefr-batch', '*/15 * * * *', $cron$
  SELECT net.http_post(
    url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'cefr_batch_project_url'), '/') || '/functions/v1/dictionary-cefr-batch',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-cefr-batch-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cefr_batch_worker_secret')),
    body := '{}'::JSONB,
    timeout_milliseconds := 55000
  )
  WHERE EXISTS (SELECT 1 FROM private.dictionary_cefr_batch_settings WHERE singleton AND enabled);
$cron$);

COMMIT;
