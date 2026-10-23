-- Dormant shared history/diff and audited administrator head rollback. No live
-- membership, policy, publication, linking, conversion or provider work is seeded.
BEGIN;
ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN analysis_history_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN administrator_rollback_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE private.dictionary_head_rollbacks (
  audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation_id UUID NOT NULL,
  entry_id UUID NOT NULL REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  reason TEXT NOT NULL CHECK (private.dictionary_utf16_length(reason) BETWEEN 1 AND 1000 AND LENGTH(BTRIM(reason)) > 0),
  receipt JSONB NOT NULL CHECK (JSONB_TYPEOF(receipt) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CLOCK_TIMESTAMP(),
  UNIQUE(actor_id, operation_id)
);
CREATE INDEX dictionary_head_rollback_history ON private.dictionary_head_rollbacks(entry_id, created_at DESC, audit_id DESC);
CREATE INDEX dictionary_head_rollback_event ON private.dictionary_head_rollbacks((receipt->>'applied_head_sequence'))
  WHERE receipt->>'outcome' = 'reverted';
CREATE FUNCTION private.protect_dictionary_head_rollback() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.actor_id)
    AND (TO_JSONB(NEW) - 'actor_id') = (TO_JSONB(OLD) - 'actor_id') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'dictionary rollback audit is immutable';
END;
$$;
CREATE TRIGGER protect_dictionary_head_rollback BEFORE UPDATE OR DELETE ON private.dictionary_head_rollbacks
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_head_rollback();

CREATE FUNCTION private.require_dictionary_administrator() RETURNS VOID
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  PERFORM private.require_dictionary_import_actor_v2();
  PERFORM 1 FROM private.dictionary_administrators WHERE user_id = auth.uid() AND enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'administrator-required' USING ERRCODE = '42501'; END IF;
END;
$$;
CREATE FUNCTION public.rollback_dictionary_entry_v2(p_command JSONB) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid(); v_id UUID; v_entry UUID; v_expected UUID; v_target UUID;
  v_expected_sequence BIGINT; v_current UUID; v_sequence BIGINT; v_enabled BOOLEAN;
  v_hash TEXT; v_saved private.dictionary_head_rollbacks; v_receipt JSONB; v_outcome TEXT;
BEGIN
  PERFORM private.require_dictionary_import_actor_v2();
  IF private.jsonb_has_exact_keys(p_command, ARRAY['protocol_version','operation_id','entry_id','expected_revision_id','expected_head_sequence','target_revision_id','reason']) IS NOT TRUE
    OR p_command->'protocol_version' IS DISTINCT FROM '2'::JSONB
    OR private.dictionary_import_uuid_v1(p_command->'operation_id') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(p_command->'entry_id') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(p_command->'expected_revision_id') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(p_command->'target_revision_id') IS NOT TRUE
    OR JSONB_TYPEOF(p_command->'expected_head_sequence') IS DISTINCT FROM 'string'
    OR (p_command->>'expected_head_sequence') !~ '^(0|[1-9][0-9]{0,18})$'
    OR (p_command->>'expected_head_sequence')::NUMERIC > 9223372036854775807
    OR private.dictionary_bounded_text(p_command->'reason',1000) IS NOT TRUE THEN RAISE EXCEPTION 'invalid-rollback-command'; END IF;
  v_id := (p_command->>'operation_id')::UUID; v_entry := (p_command->>'entry_id')::UUID;
  v_expected := (p_command->>'expected_revision_id')::UUID; v_target := (p_command->>'target_revision_id')::UUID;
  v_expected_sequence := (p_command->>'expected_head_sequence')::BIGINT;
  v_hash := private.dictionary_canonical_sha256(p_command);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dictionary-rollback:' || v_actor::TEXT || '/' || v_id::TEXT,0));
  SELECT * INTO v_saved FROM private.dictionary_head_rollbacks WHERE actor_id = v_actor AND operation_id = v_id;
  IF FOUND THEN
    IF v_saved.request_sha256 IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'rollback-operation-payload-conflict'; END IF;
    RETURN v_saved.receipt || '{"idempotent":true}'::JSONB;
  END IF;
  -- Lock current membership independently of ordinary full_access. Emergency
  -- rollback does not depend on provider/analysis-publication enablement or quota.
  PERFORM private.require_dictionary_administrator();
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = v_entry FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dictionary-entry-unavailable'; END IF;
  SELECT reads_enabled AND administrator_rollback_enabled INTO STRICT v_enabled
    FROM private.dictionary_content_runtime WHERE singleton FOR SHARE;
  IF NOT v_enabled THEN RAISE EXCEPTION 'administrator-rollback-disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dictionary_entries WHERE entry_id = v_entry AND state = 'published') THEN
    v_outcome := 'entry-unavailable';
  ELSE
    SELECT revision_id INTO STRICT v_current FROM public.dictionary_entry_heads WHERE entry_id = v_entry;
    SELECT MAX(committed_version) INTO v_sequence FROM private.dictionary_content_changes WHERE entry_id = v_entry AND change_kind = 'revision-head';
    IF v_sequence IS NULL THEN RAISE EXCEPTION 'missing-dictionary-head'; END IF;
    IF ROW(v_current,v_sequence) IS DISTINCT FROM ROW(v_expected,v_expected_sequence) THEN
      v_outcome := 'head-conflict';
    ELSE
      -- Explicitly retired/draft revisions cannot be promoted around their review
      -- hold. Prior published revisions retain their original provenance/status.
      PERFORM 1 FROM public.dictionary_revisions WHERE entry_id = v_entry AND revision_id = v_target
        AND review_status = 'published' AND published_at IS NOT NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'invalid-rollback-target'; END IF;
      IF v_target = v_current THEN
        v_outcome := 'no-change';
      ELSE
        UPDATE public.dictionary_entry_heads SET revision_id = v_target WHERE entry_id = v_entry;
        v_current := v_target; v_outcome := 'reverted';
        SELECT MAX(committed_version) INTO STRICT v_sequence FROM private.dictionary_content_changes WHERE entry_id = v_entry AND change_kind = 'revision-head';
        IF v_sequence <= v_expected_sequence THEN RAISE EXCEPTION 'missing-rollback-event'; END IF;
      END IF;
    END IF;
  END IF;
  v_receipt := p_command || JSONB_BUILD_OBJECT('outcome',v_outcome,'applied_revision_id',v_current,
    'applied_head_sequence',v_sequence::TEXT,'idempotent',FALSE);
  INSERT INTO private.dictionary_head_rollbacks(actor_id,operation_id,entry_id,request_sha256,reason,receipt)
    VALUES(v_actor,v_id,v_entry,v_hash,p_command->>'reason',v_receipt);
  RETURN v_receipt;
END;
$$;

CREATE FUNCTION private.require_dictionary_history_entry(p_entry UUID) RETURNS VOID
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND reads_enabled AND analysis_history_enabled) THEN
    RAISE EXCEPTION 'dictionary-history-disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dictionary_entries WHERE entry_id = p_entry AND state = 'published') THEN
    RAISE EXCEPTION 'dictionary-entry-unavailable'; END IF;
END;
$$;
CREATE FUNCTION public.get_dictionary_entry_history_v2(p_entry UUID,p_before TEXT DEFAULT NULL,p_limit INTEGER DEFAULT 50) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_events JSONB; v_next TEXT; v_current UUID; v_sequence BIGINT;
BEGIN
  PERFORM private.require_dictionary_history_entry(p_entry);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR (p_before IS NOT NULL AND
    (p_before !~ '^(0|[1-9][0-9]{0,18})$' OR p_before::NUMERIC > 9223372036854775807)) THEN RAISE EXCEPTION 'invalid-history-page'; END IF;
  SELECT revision_id INTO STRICT v_current FROM public.dictionary_entry_heads WHERE entry_id = p_entry;
  SELECT MAX(committed_version) INTO v_sequence FROM private.dictionary_content_changes WHERE entry_id = p_entry AND change_kind = 'revision-head';
  IF v_sequence IS NULL THEN RAISE EXCEPTION 'missing-dictionary-head'; END IF;
  WITH page AS (SELECT c.committed_version,c.revision_id,c.created_at,r.revision_no,r.content_sha256,
      CASE WHEN EXISTS (SELECT 1 FROM private.dictionary_head_rollbacks a WHERE a.entry_id=p_entry
        AND a.receipt->>'outcome'='reverted' AND a.receipt->>'applied_head_sequence'=c.committed_version::TEXT) THEN 'rollback' ELSE 'head' END AS kind
    FROM private.dictionary_content_changes c JOIN public.dictionary_revisions r USING(entry_id,revision_id)
    WHERE c.entry_id=p_entry AND c.change_kind='revision-head' AND r.review_status='published'
      AND (p_before IS NULL OR c.committed_version<p_before::BIGINT)
    ORDER BY c.committed_version DESC LIMIT p_limit+1), visible AS (
      SELECT * FROM page ORDER BY committed_version DESC LIMIT p_limit)
  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('head_sequence',committed_version::TEXT,'revision_id',revision_id,
    'revision_no',revision_no,'content_sha256',content_sha256,'changed_at',created_at,'kind',kind) ORDER BY committed_version DESC),'[]'),
    CASE WHEN (SELECT COUNT(*) FROM page)>p_limit THEN MIN(committed_version)::TEXT ELSE NULL END
    INTO v_events,v_next FROM visible;
  RETURN JSONB_BUILD_OBJECT('protocol_version',2,'entry_id',p_entry,'current_revision_id',v_current,
    'current_head_sequence',v_sequence::TEXT,'events',v_events,'next_before',v_next);
END;
$$;
CREATE FUNCTION public.get_dictionary_revision_diff_v2(p_entry UUID,p_from UUID,p_to UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_from public.dictionary_revisions; v_to public.dictionary_revisions; v_changes JSONB;
BEGIN
  PERFORM private.require_dictionary_history_entry(p_entry);
  SELECT * INTO v_from FROM public.dictionary_revisions WHERE entry_id=p_entry AND revision_id=p_from AND review_status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'dictionary-revision-unavailable'; END IF;
  SELECT * INTO v_to FROM public.dictionary_revisions WHERE entry_id=p_entry AND revision_id=p_to AND review_status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'dictionary-revision-unavailable'; END IF;
  -- Full top-level field values preserve nested arrays/objects/nulls and media;
  -- no word/SRS/private original or provider/actor evidence is joined here.
  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('field',key,'before',v_from.content->key,'after',v_to.content->key) ORDER BY key),'[]')
    INTO v_changes FROM (SELECT JSONB_OBJECT_KEYS(v_from.content) AS key UNION SELECT JSONB_OBJECT_KEYS(v_to.content) AS key) keys
    WHERE v_from.content->key IS DISTINCT FROM v_to.content->key;
  RETURN JSONB_BUILD_OBJECT('protocol_version',2,'entry_id',p_entry,'from_revision_id',p_from,'to_revision_id',p_to,
    'from_content',v_from.content,'to_content',v_to.content,'from_content_sha256',v_from.content_sha256,
    'to_content_sha256',v_to.content_sha256,'changes',v_changes);
END;
$$;
CREATE FUNCTION public.list_dictionary_rollbacks_v2(p_entry UUID,p_limit INTEGER DEFAULT 50,
  p_before_created_at TIMESTAMPTZ DEFAULT NULL,p_before_audit UUID DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.require_dictionary_administrator();
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND analysis_history_enabled) THEN RAISE EXCEPTION 'dictionary-history-disabled'; END IF;
  IF p_entry IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR (p_before_created_at IS NULL) <> (p_before_audit IS NULL) THEN RAISE EXCEPTION 'invalid-rollback-audit-page'; END IF;
  RETURN (SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('audit_id',a.audit_id,'actor_id',a.actor_id,'created_at',a.created_at,'receipt',a.receipt)
    ORDER BY a.created_at DESC,a.audit_id DESC),'[]') FROM (SELECT * FROM private.dictionary_head_rollbacks WHERE entry_id=p_entry
      AND (p_before_created_at IS NULL OR (created_at,audit_id)<(p_before_created_at,p_before_audit))
      ORDER BY created_at DESC,audit_id DESC LIMIT p_limit) a);
END;
$$;
ALTER TABLE private.dictionary_head_rollbacks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_head_rollbacks FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.protect_dictionary_head_rollback(),private.require_dictionary_administrator(),private.require_dictionary_history_entry(UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rollback_dictionary_entry_v2(JSONB),public.get_dictionary_entry_history_v2(UUID,TEXT,INTEGER),
  public.get_dictionary_revision_diff_v2(UUID,UUID,UUID),public.list_dictionary_rollbacks_v2(UUID,INTEGER,TIMESTAMPTZ,UUID) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rollback_dictionary_entry_v2(JSONB),public.get_dictionary_entry_history_v2(UUID,TEXT,INTEGER),
  public.get_dictionary_revision_diff_v2(UUID,UUID,UUID),public.list_dictionary_rollbacks_v2(UUID,INTEGER,TIMESTAMPTZ,UUID) TO authenticated;
COMMENT ON TABLE private.dictionary_head_rollbacks IS 'Immutable administrator-only rollback audit. Auth deletion redacts actor; content history and head events remain.';
COMMIT;
