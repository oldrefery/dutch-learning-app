-- Local administrator-only compensation, outside deploy migrations.
-- Install after rehearsal.sql, following-plan.sql and following-apply.sql.
BEGIN;
CREATE TABLE dictionary_following_rehearsal.rollback_batches (
  batch_id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES dictionary_following_rehearsal.runs,
  request JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE dictionary_following_rehearsal.rollback_receipts (
  run_id UUID NOT NULL,
  word_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES dictionary_following_rehearsal.rollback_batches DEFERRABLE INITIALLY DEFERRED,
  outcome TEXT NOT NULL CHECK(outcome IN ('restored','source-unavailable','stale-result','content-version-exhausted')),
  applied_sha256 TEXT NOT NULL,
  result_snapshot JSONB,
  result_sha256 TEXT,
  resulting_content_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(run_id,word_id),
  FOREIGN KEY(run_id,word_id) REFERENCES dictionary_following_rehearsal.apply_receipts,
  CHECK((outcome='restored') = (result_snapshot IS NOT NULL AND result_sha256 IS NOT NULL
    AND resulting_content_version IS NOT NULL))
);
DO $$ DECLARE name TEXT; BEGIN
  FOREACH name IN ARRAY ARRAY['rollback_batches','rollback_receipts'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON dictionary_following_rehearsal.%I FOR EACH ROW EXECUTE FUNCTION dictionary_rehearsal.immutable()',name);
    EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON dictionary_following_rehearsal.%I FOR EACH STATEMENT EXECUTE FUNCTION dictionary_rehearsal.immutable()',name);
  END LOOP;
END; $$;

CREATE FUNCTION dictionary_following_rehearsal.rollback(
  p_run UUID,p_plan_sha256 TEXT,p_batch UUID,p_limit INTEGER DEFAULT 50
) RETURNS JSONB LANGUAGE plpgsql SET search_path='' SET lock_timeout='1s' AS $$
DECLARE
  v_request JSONB;
  v_existing dictionary_following_rehearsal.rollback_batches%ROWTYPE;
  a dictionary_following_rehearsal.apply_receipts%ROWTYPE;
  i dictionary_following_rehearsal.items%ROWTYPE;
  w public.words%ROWTYPE;
  s public.word_content_state%ROWTYPE;
  v_head UUID;
  v_content JSONB;
  v_version BIGINT;
  v_snapshot JSONB;
  v_original JSONB;
  v_outcome TEXT;
  v_restored INTEGER:=0;
  v_skipped INTEGER:=0;
  v_busy INTEGER:=0;
  v_already INTEGER:=0;
  v_result JSONB;
BEGIN
  IF p_run IS NULL OR p_batch IS NULL OR p_plan_sha256 IS NULL
    OR p_plan_sha256 !~ '^[0-9a-f]{64}$' OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid-rollback-request';
  END IF;
  v_request:=jsonb_build_object('run_id',p_run,'plan_sha256',p_plan_sha256,'limit',p_limit);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_batch::TEXT,28));
  SELECT * INTO v_existing FROM dictionary_following_rehearsal.rollback_batches WHERE batch_id=p_batch;
  IF FOUND THEN
    IF v_existing.request IS DISTINCT FROM v_request THEN RAISE EXCEPTION 'rollback-intent-mismatch'; END IF;
    RETURN v_existing.result;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM dictionary_following_rehearsal.runs WHERE run_id=p_run)
    OR p_plan_sha256 IS DISTINCT FROM dictionary_following_rehearsal.plan_sha256(p_run) THEN
    RAISE EXCEPTION 'reviewed-plan-required';
  END IF;
  -- Compensation does not enable or depend on feature gates. Retained originals
  -- and the applied result are the authority; this function remains admin-only.
  FOR a IN SELECT receipts.* FROM dictionary_following_rehearsal.apply_receipts receipts
    WHERE receipts.run_id=p_run AND outcome='applied'
      AND NOT EXISTS(SELECT 1 FROM dictionary_following_rehearsal.rollback_receipts undo
        WHERE undo.run_id=receipts.run_id AND undo.word_id=receipts.word_id)
    ORDER BY word_id LIMIT p_limit FOR UPDATE OF receipts SKIP LOCKED
  LOOP
    BEGIN
      IF EXISTS(SELECT 1 FROM dictionary_following_rehearsal.rollback_receipts
        WHERE run_id=p_run AND word_id=a.word_id) THEN
        v_already:=v_already+1; CONTINUE;
      END IF;
      SELECT * INTO STRICT i FROM dictionary_following_rehearsal.items WHERE run_id=p_run AND word_id=a.word_id;
      v_snapshot:=NULL; v_version:=NULL; v_outcome:='restored'; v_head:=NULL; v_content:=NULL;
      SELECT * INTO w FROM public.words WHERE word_id=a.word_id FOR UPDATE NOWAIT;
      IF NOT FOUND OR w.deleted_at IS NOT NULL OR w.user_id IS DISTINCT FROM i.owner_id THEN
        v_outcome:='source-unavailable';
      ELSE
        SELECT * INTO s FROM public.word_content_state WHERE word_id=a.word_id FOR UPDATE NOWAIT;
        IF s.word_id IS NULL OR dictionary_rehearsal.hash(dictionary_rehearsal.source_snapshot(w))
          IS DISTINCT FROM a.result_sha256 THEN
          v_outcome:='stale-result';
        ELSE
          SELECT heads.revision_id,revisions.content INTO v_head,v_content FROM public.dictionary_entry_heads heads
            JOIN public.dictionary_revisions revisions ON revisions.entry_id=heads.entry_id AND revisions.revision_id=heads.revision_id
            JOIN public.dictionary_entries entries ON entries.entry_id=heads.entry_id
            WHERE heads.entry_id=i.target_entry_id AND entries.state='published' AND revisions.review_status='published'
            FOR SHARE OF heads,revisions,entries NOWAIT;
          IF v_head IS DISTINCT FROM i.target_revision_id
            OR dictionary_following_rehearsal.head_sequence(i.target_entry_id) IS DISTINCT FROM a.target_head_sequence
            OR dictionary_rehearsal.canonical_sha256(v_content) IS DISTINCT FROM i.target_content_sha256 THEN
            v_outcome:='stale-result';
          ELSIF s.content_version=9223372036854775807 THEN
            v_outcome:='content-version-exhausted';
          END IF;
        END IF;
      END IF;
      IF v_outcome='restored' THEN
        v_original:=i.original_snapshot->'word';
        v_version:=s.content_version+1;
        UPDATE public.words SET dictionary_entry_id=(v_original->>'dictionary_entry_id')::UUID,
          dictionary_revision_id=(v_original->>'dictionary_revision_id')::UUID,
          dictionary_content_mode=v_original->>'dictionary_content_mode' WHERE word_id=a.word_id;
        -- Keep the new monotonic version even when no state existed at inventory.
        -- The original effective private content becomes a valid legacy fallback.
        UPDATE public.word_content_state SET content_version=v_version,
          fallback_content=CASE WHEN (v_original->>'dictionary_entry_id') IS NULL
            THEN coalesce(nullif(i.original_snapshot->'state'->'fallback_content','null'::JSONB),i.original_content)
            ELSE NULL END,
          overrides=coalesce(i.original_snapshot->'state'->'overrides','{}'::JSONB),updated_at=NOW()
          WHERE word_id=a.word_id;
        SELECT dictionary_rehearsal.source_snapshot(words) INTO v_snapshot FROM public.words words WHERE word_id=a.word_id;
      END IF;
      INSERT INTO dictionary_following_rehearsal.rollback_receipts(run_id,word_id,batch_id,outcome,
        applied_sha256,result_snapshot,result_sha256,resulting_content_version)
        VALUES(p_run,a.word_id,p_batch,v_outcome,a.result_sha256,v_snapshot,
          dictionary_rehearsal.hash(v_snapshot),CASE WHEN v_outcome='restored' THEN v_version::TEXT END);
      IF v_outcome='restored' THEN v_restored:=v_restored+1; ELSE v_skipped:=v_skipped+1; END IF;
    EXCEPTION WHEN lock_not_available THEN
      v_busy:=v_busy+1;
    END;
  END LOOP;
  v_result:=jsonb_build_object('restored',v_restored,'skipped',v_skipped,'busy',v_busy,
    'already_receipted',v_already,'remaining',(SELECT count(*) FROM dictionary_following_rehearsal.apply_receipts receipts
      WHERE receipts.run_id=p_run AND outcome='applied' AND NOT EXISTS(SELECT 1 FROM dictionary_following_rehearsal.rollback_receipts undo
        WHERE undo.run_id=receipts.run_id AND undo.word_id=receipts.word_id)));
  INSERT INTO dictionary_following_rehearsal.rollback_batches(batch_id,run_id,request,result)
    VALUES(p_batch,p_run,v_request,v_result);
  RETURN v_result;
END;
$$;
REVOKE ALL ON dictionary_following_rehearsal.rollback_batches,dictionary_following_rehearsal.rollback_receipts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION dictionary_following_rehearsal.rollback(UUID,TEXT,UUID,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
