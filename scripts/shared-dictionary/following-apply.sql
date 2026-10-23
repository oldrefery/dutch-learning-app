-- Local administrator-only D13A.6 apply. Outside deploy migrations.
-- Install only after rehearsal.sql and following-plan.sql on a disposable database.
BEGIN;
CREATE TABLE dictionary_following_rehearsal.apply_batches (
  batch_id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES dictionary_following_rehearsal.runs,
  request JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE dictionary_following_rehearsal.apply_receipts (
  run_id UUID NOT NULL,
  word_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES dictionary_following_rehearsal.apply_batches DEFERRABLE INITIALLY DEFERRED,
  outcome TEXT NOT NULL CHECK (outcome IN ('applied','stale-source','source-unavailable',
    'stale-target','invalid-decision','content-version-exhausted','owner-placement-unavailable')),
  reason TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  decision_sha256 TEXT NOT NULL,
  target_head_sequence TEXT NOT NULL,
  result_snapshot JSONB,
  result_sha256 TEXT,
  resulting_content_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (run_id,word_id),
  FOREIGN KEY (run_id,word_id) REFERENCES dictionary_following_rehearsal.items,
  CHECK ((outcome = 'applied') = (result_snapshot IS NOT NULL AND result_sha256 IS NOT NULL
    AND resulting_content_version IS NOT NULL))
);
-- Neither table references a live word/owner; deletion preserves immutable receipts.
DO $$ DECLARE name TEXT; BEGIN
  FOREACH name IN ARRAY ARRAY['apply_batches','apply_receipts'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON dictionary_following_rehearsal.%I FOR EACH ROW EXECUTE FUNCTION dictionary_rehearsal.immutable()',name);
    EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON dictionary_following_rehearsal.%I FOR EACH STATEMENT EXECUTE FUNCTION dictionary_rehearsal.immutable()',name);
  END LOOP;
END; $$;

CREATE FUNCTION dictionary_following_rehearsal.apply(
  p_run UUID,p_plan_sha256 TEXT,p_batch UUID,p_limit INTEGER DEFAULT 50
) RETURNS JSONB LANGUAGE plpgsql SET search_path = '' SET lock_timeout = '1s' AS $$
DECLARE
  v_request JSONB;
  v_existing dictionary_following_rehearsal.apply_batches%ROWTYPE;
  i dictionary_following_rehearsal.items%ROWTYPE;
  w public.words%ROWTYPE;
  r public.dictionary_revisions%ROWTYPE;
  v_state public.word_content_state%ROWTYPE;
  v_version BIGINT;
  v_content JSONB;
  v_diff JSONB;
  v_snapshot JSONB;
  v_sequence TEXT;
  v_outcome TEXT;
  v_reason TEXT;
  v_applied INTEGER := 0;
  v_rejected INTEGER := 0;
  v_busy INTEGER := 0;
  v_already INTEGER := 0;
  v_result JSONB;
BEGIN
  IF p_run IS NULL OR p_batch IS NULL OR p_plan_sha256 IS NULL
    OR p_plan_sha256 !~ '^[0-9a-f]{64}$' OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid-apply-request';
  END IF;
  v_request := jsonb_build_object('run_id',p_run,'plan_sha256',p_plan_sha256,'limit',p_limit);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_batch::TEXT,27));
  SELECT * INTO v_existing FROM dictionary_following_rehearsal.apply_batches WHERE batch_id=p_batch;
  IF FOUND THEN
    IF v_existing.request IS DISTINCT FROM v_request THEN RAISE EXCEPTION 'batch-intent-mismatch'; END IF;
    RETURN v_existing.result;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM dictionary_following_rehearsal.runs WHERE run_id=p_run)
    OR p_plan_sha256 IS DISTINCT FROM dictionary_following_rehearsal.plan_sha256(p_run) THEN
    RAISE EXCEPTION 'reviewed-plan-required';
  END IF;
  -- Capabilities are verified/held, never enabled by the operator function.
  PERFORM 1 FROM private.dictionary_content_runtime WHERE singleton AND operations_enabled
    AND reads_enabled AND legacy_guard_enabled AND following_reads_enabled FOR SHARE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'cutover-capabilities-required'; END IF;
  FOR i IN SELECT items.* FROM dictionary_following_rehearsal.items items
    WHERE items.run_id=p_run AND disposition IN ('exact-link','approved-diff-link')
      AND NOT EXISTS (SELECT 1 FROM dictionary_following_rehearsal.apply_receipts receipts
        WHERE receipts.run_id=items.run_id AND receipts.word_id=items.word_id)
    ORDER BY word_id LIMIT p_limit FOR UPDATE OF items SKIP LOCKED
  LOOP
    BEGIN
      -- A previous worker can commit after the selector statement's snapshot.
      -- Recheck the terminal receipt after taking this item's exclusive lock.
      IF EXISTS (SELECT 1 FROM dictionary_following_rehearsal.apply_receipts
        WHERE run_id=p_run AND word_id=i.word_id) THEN
        v_already := v_already+1;
        CONTINUE;
      END IF;
      v_snapshot := NULL; v_version := NULL; v_state := NULL;
      v_outcome := 'applied'; v_reason := 'reviewed-reference-installed';
      IF dictionary_following_rehearsal.valid_decision(i.decision) IS NOT TRUE
        OR dictionary_rehearsal.canonical_sha256(i.decision) IS DISTINCT FROM i.decision_sha256
        OR i.decision->>'owner_id' IS DISTINCT FROM i.owner_id::TEXT
        OR i.decision->>'source_sha256' IS DISTINCT FROM i.source_sha256
        OR i.decision->>'source_content_sha256' IS DISTINCT FROM i.original_content_sha256
        OR i.decision->>'target_entry_id' IS DISTINCT FROM i.target_entry_id::TEXT
        OR i.decision->>'target_revision_id' IS DISTINCT FROM i.target_revision_id::TEXT
        OR i.decision->>'target_head_sequence' IS DISTINCT FROM i.target_head_sequence
        OR i.decision->>'target_content_sha256' IS DISTINCT FROM i.target_content_sha256
        OR i.decision->>'disposition' IS DISTINCT FROM i.disposition
        OR i.decision->'approved_diff' IS DISTINCT FROM i.approved_diff THEN
        v_outcome := 'invalid-decision'; v_reason := 'reviewed-packet-inconsistent';
      ELSE
        SELECT * INTO w FROM public.words WHERE word_id=i.word_id FOR UPDATE NOWAIT;
        IF NOT FOUND THEN
          v_outcome := 'source-unavailable'; v_reason := 'personal-row-missing';
        ELSE
          -- The word lock also fences concurrent state insertion through its FK.
          SELECT * INTO v_state FROM public.word_content_state WHERE word_id=i.word_id FOR UPDATE NOWAIT;
          v_version := coalesce(v_state.content_version,0);
          v_content := dictionary_following_rehearsal.content(w);
          IF w.user_id IS DISTINCT FROM i.owner_id OR w.deleted_at IS NOT NULL
            OR w.dictionary_content_mode <> 'legacy'
            OR dictionary_rehearsal.hash(dictionary_rehearsal.source_snapshot(w)) IS DISTINCT FROM i.source_sha256
            OR dictionary_rehearsal.canonical_sha256(v_content) IS DISTINCT FROM i.original_content_sha256 THEN
            v_outcome := 'stale-source'; v_reason := 'personal-fingerprint-changed';
          ELSIF w.collection_id IS NOT NULL THEN
            PERFORM 1 FROM public.collections WHERE collection_id=w.collection_id
              AND user_id=i.owner_id FOR SHARE NOWAIT;
            IF NOT FOUND THEN
              v_outcome := 'owner-placement-unavailable'; v_reason := 'owned-collection-unavailable';
            END IF;
          END IF;
        END IF;
      END IF;
      IF v_outcome='applied' THEN
        SELECT revisions.* INTO r FROM public.dictionary_entry_heads heads
          JOIN public.dictionary_entries entries USING(entry_id)
          JOIN public.dictionary_revisions revisions ON revisions.entry_id=heads.entry_id AND revisions.revision_id=heads.revision_id
          JOIN private.dictionary_sources sources USING(source_id)
          WHERE heads.entry_id=i.target_entry_id AND heads.revision_id=i.target_revision_id
            AND entries.language_code='nl' AND entries.state='published'
            AND revisions.review_status='published' AND sources.review_state='approved'
          FOR SHARE OF heads,entries,revisions,sources NOWAIT;
        v_sequence := dictionary_following_rehearsal.head_sequence(i.target_entry_id);
        IF r.revision_id IS NULL OR v_sequence IS DISTINCT FROM i.target_head_sequence
          OR dictionary_rehearsal.canonical_sha256(r.content) IS DISTINCT FROM i.target_content_sha256
          OR r.content_sha256 IS DISTINCT FROM i.target_content_sha256 THEN
          v_outcome := 'stale-target'; v_reason := 'published-head-content-or-source-changed';
        ELSE
          v_diff := dictionary_following_rehearsal.content_diff(v_content,r.content);
          IF v_diff IS DISTINCT FROM i.approved_diff
            OR (i.disposition='exact-link' AND v_diff<>'{}')
            OR (i.disposition='approved-diff-link' AND v_diff='{}') THEN
            v_outcome := 'invalid-decision'; v_reason := 'full-content-diff-changed';
          ELSIF v_version=9223372036854775807 THEN
            v_outcome := 'content-version-exhausted'; v_reason := 'content-version-cannot-increment';
          END IF;
        END IF;
      END IF;
      IF v_outcome='applied' THEN
        -- Only reference/mode and content-state columns are written. Raw private
        -- fields remain intact; approved shared content is not copied into them.
        UPDATE public.words SET dictionary_entry_id=i.target_entry_id,
          dictionary_revision_id=i.target_revision_id,dictionary_content_mode='follow' WHERE word_id=i.word_id;
        INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content,overrides)
          VALUES(i.word_id,i.owner_id,v_version+1,NULL,'{}')
          ON CONFLICT(word_id) DO UPDATE SET content_version=EXCLUDED.content_version,
            fallback_content=NULL,overrides='{}',updated_at=NOW();
        SELECT dictionary_rehearsal.source_snapshot(words) INTO v_snapshot
          FROM public.words words WHERE word_id=i.word_id;
      END IF;
      INSERT INTO dictionary_following_rehearsal.apply_receipts(run_id,word_id,batch_id,outcome,reason,
        source_sha256,decision_sha256,target_head_sequence,result_snapshot,result_sha256,resulting_content_version)
        VALUES(p_run,i.word_id,p_batch,v_outcome,v_reason,i.source_sha256,i.decision_sha256,
          i.target_head_sequence,v_snapshot,dictionary_rehearsal.hash(v_snapshot),
          CASE WHEN v_outcome='applied' THEN (v_version+1)::TEXT END);
      -- Variables survive an exception rollback; count only after receipt insertion.
      IF v_outcome='applied' THEN v_applied:=v_applied+1; ELSE v_rejected:=v_rejected+1; END IF;
    EXCEPTION WHEN lock_not_available THEN
      -- No receipt/write survives this row's subtransaction. A new batch can retry.
      v_busy:=v_busy+1;
    END;
  END LOOP;
  v_result:=jsonb_build_object('applied',v_applied,'rejected',v_rejected,'busy',v_busy,
    'already_receipted',v_already,'remaining',(SELECT count(*) FROM dictionary_following_rehearsal.items items
      WHERE items.run_id=p_run AND disposition IN ('exact-link','approved-diff-link')
        AND NOT EXISTS (SELECT 1 FROM dictionary_following_rehearsal.apply_receipts receipts
          WHERE receipts.run_id=items.run_id AND receipts.word_id=items.word_id)));
  INSERT INTO dictionary_following_rehearsal.apply_batches(batch_id,run_id,request,result)
    VALUES(p_batch,p_run,v_request,v_result);
  RETURN v_result;
END;
$$;
CREATE FUNCTION dictionary_following_rehearsal.apply_report(p_run UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dictionary_following_rehearsal.runs WHERE run_id=p_run) THEN RAISE EXCEPTION 'unknown-run'; END IF;
  RETURN jsonb_build_object('total_receipts',(SELECT count(*) FROM dictionary_following_rehearsal.apply_receipts WHERE run_id=p_run),
    'outcomes',(SELECT coalesce(jsonb_object_agg(outcome,n),'{}') FROM (
      SELECT outcome,count(*) n FROM dictionary_following_rehearsal.apply_receipts WHERE run_id=p_run GROUP BY outcome) counts),
    'held_dispositions',(SELECT coalesce(jsonb_object_agg(disposition,n),'{}') FROM (
      SELECT disposition,count(*) n FROM dictionary_following_rehearsal.items
      WHERE run_id=p_run AND disposition NOT IN ('exact-link','approved-diff-link') GROUP BY disposition) counts));
END;
$$;
REVOKE ALL ON dictionary_following_rehearsal.apply_batches,dictionary_following_rehearsal.apply_receipts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION dictionary_following_rehearsal.apply(UUID,TEXT,UUID,INTEGER),
  dictionary_following_rehearsal.apply_report(UUID) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
