-- Dormant new-meaning resolution and acceptance. No source, policy, role, provider,
-- publication or personal card is seeded. Dispatch/publication are not exposed.
BEGIN;
ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN creation_resolution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN creation_operations_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE private.dictionary_creation_identities (
  identity_id UUID PRIMARY KEY,
  entry_id UUID NOT NULL UNIQUE,
  language_code TEXT NOT NULL CHECK (language_code = 'nl'),
  lemma TEXT NOT NULL CHECK (LENGTH(BTRIM(lemma)) BETWEEN 1 AND 120),
  part_of_speech TEXT CHECK (part_of_speech IS NULL OR LENGTH(BTRIM(part_of_speech)) BETWEEN 1 AND 100),
  article TEXT CHECK (article IS NULL OR LENGTH(BTRIM(article)) BETWEEN 1 AND 20),
  sense_key TEXT NOT NULL CHECK (LENGTH(BTRIM(sense_key)) BETWEEN 1 AND 200),
  source_id UUID NOT NULL REFERENCES private.dictionary_sources(source_id) ON DELETE RESTRICT,
  source_approval_sha256 TEXT NOT NULL CHECK (source_approval_sha256 ~ '^[0-9a-f]{64}$'),
  gloss TEXT NOT NULL CHECK (LENGTH(BTRIM(gloss)) BETWEEN 1 AND 4000),
  examples JSONB NOT NULL CHECK (JSONB_TYPEOF(examples) = 'array' AND JSONB_ARRAY_LENGTH(examples) BETWEEN 1 AND 20),
  verified_by UUID NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  audit_reference TEXT NOT NULL CHECK (LENGTH(BTRIM(audit_reference)) BETWEEN 1 AND 500),
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX dictionary_creation_reviewed_identity_key ON private.dictionary_creation_identities
  (language_code,LOWER(BTRIM(lemma)),COALESCE(LOWER(BTRIM(part_of_speech)),''),COALESCE(LOWER(BTRIM(article)),''),sense_key);
CREATE TABLE private.dictionary_creation_identity_availability (
  identity_id UUID PRIMARY KEY REFERENCES private.dictionary_creation_identities(identity_id) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  audit_reference TEXT NOT NULL CHECK (LENGTH(BTRIM(audit_reference)) BETWEEN 1 AND 500)
);
CREATE TABLE private.dictionary_meaning_requests (
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resolution_id UUID NOT NULL,
  request JSONB NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  identity_id UUID REFERENCES private.dictionary_creation_identities(identity_id) ON DELETE RESTRICT,
  receipt JSONB,
  PRIMARY KEY (actor_id,resolution_id)
);
CREATE TABLE private.dictionary_creation_profile (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  validator_version TEXT NOT NULL,
  policy_sha256 TEXT NOT NULL,
  FOREIGN KEY (validator_version,policy_sha256) REFERENCES private.dictionary_analysis_validator_policies(validator_version,policy_sha256) ON DELETE RESTRICT
);
CREATE TABLE private.dictionary_creation_operations (
  actor_id UUID NOT NULL,
  operation_id UUID NOT NULL,
  resolution_id UUID NOT NULL,
  identity_id UUID NOT NULL REFERENCES private.dictionary_creation_identities(identity_id) ON DELETE RESTRICT,
  entry_id UUID NOT NULL REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  anchor_id UUID NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  planned_generation_model TEXT NOT NULL,
  planned_validator_version TEXT NOT NULL,
  planned_policy_sha256 TEXT NOT NULL,
  fence BIGINT NOT NULL CHECK (fence > 0),
  -- This checkpoint deliberately has no transition or dispatch capability.
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status = 'accepted'),
  PRIMARY KEY (actor_id,operation_id),
  FOREIGN KEY (actor_id,resolution_id) REFERENCES private.dictionary_meaning_requests(actor_id,resolution_id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id,anchor_id) REFERENCES private.dictionary_meaning_anchors(entry_id,anchor_id) ON DELETE RESTRICT,
  FOREIGN KEY (planned_validator_version,planned_policy_sha256) REFERENCES private.dictionary_analysis_validator_policies(validator_version,policy_sha256) ON DELETE RESTRICT
);
CREATE TABLE private.dictionary_creation_leases (
  entry_id UUID PRIMARY KEY REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  identity_id UUID NOT NULL UNIQUE REFERENCES private.dictionary_creation_identities(identity_id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL,
  operation_id UUID NOT NULL,
  fence BIGINT NOT NULL CHECK (fence > 0),
  FOREIGN KEY (actor_id,operation_id) REFERENCES private.dictionary_creation_operations(actor_id,operation_id) ON DELETE CASCADE
);
CREATE TABLE private.dictionary_creation_commands (
  actor_id UUID NOT NULL,
  operation_id UUID NOT NULL,
  resolution_id UUID NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  receipt JSONB NOT NULL,
  PRIMARY KEY (actor_id,operation_id),
  FOREIGN KEY (actor_id,resolution_id) REFERENCES private.dictionary_meaning_requests(actor_id,resolution_id) ON DELETE CASCADE
);

CREATE FUNCTION private.dictionary_creation_uuid(p_value JSONB)
RETURNS UUID LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF JSONB_TYPEOF(p_value) IS DISTINCT FROM 'string' OR (p_value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN RAISE EXCEPTION 'invalid-creation-uuid'; END IF;
  RETURN (p_value #>> '{}')::UUID;
END;
$$;
CREATE FUNCTION private.dictionary_creation_utf16_length(p_value TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(SUM(CASE WHEN ASCII(c)>65535 THEN 2 ELSE 1 END),0)::INTEGER
    FROM pg_catalog.regexp_split_to_table(p_value,'') AS c;
$$;
CREATE FUNCTION private.validate_dictionary_creation_identity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE v_source private.dictionary_sources%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_source FROM private.dictionary_sources WHERE source_id=NEW.source_id FOR SHARE;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.verified_by) OR v_source.review_state <> 'approved' OR v_source.reviewed_by IS DISTINCT FROM NEW.verified_by
    OR NEW.verified_at < v_source.reviewed_at OR EXISTS(SELECT 1 FROM JSONB_ARRAY_ELEMENTS(NEW.examples) e
      WHERE JSONB_TYPEOF(e) <> 'string' OR LENGTH(BTRIM(e #>> '{}')) NOT BETWEEN 1 AND 4000)
    THEN RAISE EXCEPTION 'unverified-creation-identity'; END IF;
  NEW.source_approval_sha256 := private.dictionary_canonical_sha256(TO_JSONB(v_source));
  NEW.evidence_sha256 := private.dictionary_canonical_sha256(TO_JSONB(NEW)-'evidence_sha256');
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_dictionary_creation_identity BEFORE INSERT ON private.dictionary_creation_identities
  FOR EACH ROW EXECUTE FUNCTION private.validate_dictionary_creation_identity();
CREATE TRIGGER protect_dictionary_creation_identity BEFORE UPDATE OR DELETE ON private.dictionary_creation_identities
  FOR EACH ROW EXECUTE FUNCTION private.reject_dictionary_history_mutation();
CREATE FUNCTION private.protect_dictionary_creation_source()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM private.dictionary_creation_identities WHERE source_id=OLD.source_id)
    THEN RAISE EXCEPTION 'Referenced dictionary provenance is immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;
CREATE TRIGGER protect_dictionary_creation_source BEFORE UPDATE OR DELETE ON private.dictionary_sources
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_creation_source();
CREATE FUNCTION private.protect_dictionary_meaning_request()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF ROW(NEW.actor_id,NEW.resolution_id,NEW.request,NEW.request_sha256) IS DISTINCT FROM ROW(OLD.actor_id,OLD.resolution_id,OLD.request,OLD.request_sha256)
    OR OLD.receipt IS NOT NULL THEN RAISE EXCEPTION 'immutable-meaning-request'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_dictionary_meaning_request BEFORE UPDATE ON private.dictionary_meaning_requests
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_meaning_request();
CREATE FUNCTION private.protect_dictionary_creation_owner_journal()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.actor_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'immutable-creation-owner-journal';
END;
$$;
CREATE TRIGGER protect_dictionary_creation_command BEFORE UPDATE OR DELETE ON private.dictionary_creation_commands
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_creation_owner_journal();
CREATE TRIGGER protect_dictionary_creation_operation BEFORE UPDATE OR DELETE ON private.dictionary_creation_operations
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_creation_owner_journal();

CREATE FUNCTION public.register_dictionary_creation_identity_v1(p_identity JSONB)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE v_id UUID; v_source UUID; v_reviewer UUID; v_entry UUID; v_existing private.dictionary_creation_identities%ROWTYPE;
BEGIN
  IF private.jsonb_has_exact_keys(p_identity,ARRAY['identity_id','entry_id','language_code','lemma','part_of_speech','article','sense_key','source_id','gloss','examples','verified_by','verified_at','audit_reference']) IS NOT TRUE
    OR p_identity->>'language_code' IS DISTINCT FROM 'nl' OR JSONB_TYPEOF(p_identity->'lemma') IS DISTINCT FROM 'string'
    OR JSONB_TYPEOF(p_identity->'sense_key') IS DISTINCT FROM 'string' OR JSONB_TYPEOF(p_identity->'gloss') IS DISTINCT FROM 'string'
    OR JSONB_TYPEOF(p_identity->'verified_at') IS DISTINCT FROM 'string' OR JSONB_TYPEOF(p_identity->'audit_reference') IS DISTINCT FROM 'string'
    OR JSONB_TYPEOF(p_identity->'part_of_speech') NOT IN ('string','null') OR JSONB_TYPEOF(p_identity->'article') NOT IN ('string','null')
    THEN RAISE EXCEPTION 'invalid-reviewed-identity'; END IF;
  v_id:=private.dictionary_creation_uuid(p_identity->'identity_id'); v_entry:=private.dictionary_creation_uuid(p_identity->'entry_id');
  v_source:=private.dictionary_creation_uuid(p_identity->'source_id'); v_reviewer:=private.dictionary_creation_uuid(p_identity->'verified_by');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-identity/'||v_id::TEXT,0));
  SELECT * INTO v_existing FROM private.dictionary_creation_identities WHERE identity_id=v_id;
  IF FOUND THEN
    IF (TO_JSONB(v_existing)-ARRAY['evidence_sha256','source_approval_sha256']) IS DISTINCT FROM
      (p_identity||JSONB_BUILD_OBJECT('identity_id',v_id,'entry_id',v_entry,'source_id',v_source,'verified_by',v_reviewer,'verified_at',(p_identity->>'verified_at')::TIMESTAMPTZ))
      THEN RAISE EXCEPTION 'reviewed-identity-conflict'; END IF; RETURN v_id;
  END IF;
  INSERT INTO private.dictionary_creation_identities(identity_id,entry_id,language_code,lemma,part_of_speech,article,sense_key,source_id,
    source_approval_sha256,gloss,examples,verified_by,verified_at,audit_reference,evidence_sha256)
    VALUES(v_id,v_entry,'nl',p_identity->>'lemma',p_identity->>'part_of_speech',p_identity->>'article',p_identity->>'sense_key',v_source,
      REPEAT('0',64),p_identity->>'gloss',p_identity->'examples',v_reviewer,(p_identity->>'verified_at')::TIMESTAMPTZ,p_identity->>'audit_reference',REPEAT('0',64));
  INSERT INTO private.dictionary_creation_identity_availability(identity_id,audit_reference) VALUES(v_id,p_identity->>'audit_reference');
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.get_dictionary_meaning_resolution_v2(p_resolution UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID:=auth.uid(); v_receipt JSONB;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  SELECT receipt INTO v_receipt FROM private.dictionary_meaning_requests WHERE actor_id=v_actor AND resolution_id=p_resolution;
  RETURN v_receipt;
END;
$$;
CREATE FUNCTION public.request_dictionary_meaning_resolution_v2(p_request JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID:=auth.uid(); v_id UUID; v_hash TEXT; v_saved private.dictionary_meaning_requests%ROWTYPE; v_query TEXT;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF private.jsonb_has_exact_keys(p_request,ARRAY['protocol_version','resolution_id','original_query','meaning_hint']) IS NOT TRUE
    OR p_request->'protocol_version' IS DISTINCT FROM '2'::JSONB OR JSONB_TYPEOF(p_request->'original_query') IS DISTINCT FROM 'string'
    OR JSONB_TYPEOF(p_request->'meaning_hint') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'invalid-meaning-request'; END IF;
  v_id:=private.dictionary_creation_uuid(p_request->'resolution_id');
  v_query:=BTRIM(REGEXP_REPLACE(pg_catalog.normalize(p_request->>'original_query','NFC'),'[[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+',' ','g'));
  IF private.dictionary_creation_utf16_length(p_request->>'original_query') NOT BETWEEN 1 AND 240
    OR private.dictionary_creation_utf16_length(v_query) NOT BETWEEN 1 AND 120 OR BTRIM(v_query)=''
    OR private.dictionary_creation_utf16_length(p_request->>'meaning_hint') NOT BETWEEN 1 AND 1000 OR BTRIM(REGEXP_REPLACE(p_request->>'meaning_hint','[[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+',' ','g'))=''
    OR (p_request->>'original_query') ~ '[[:cntrl:]]' OR (p_request->>'meaning_hint') ~ '[[:cntrl:]]'
    THEN RAISE EXCEPTION 'invalid-meaning-request'; END IF;
  -- Canonical UUID spelling, exact original intent. Hash is server JSONB UTF-8.
  p_request:=p_request||JSONB_BUILD_OBJECT('resolution_id',v_id);
  v_hash:=private.dictionary_canonical_sha256(p_request);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('meaning-request/'||v_actor::TEXT||'/'||v_id::TEXT,0));
  SELECT * INTO v_saved FROM private.dictionary_meaning_requests WHERE actor_id=v_actor AND resolution_id=v_id;
  IF FOUND THEN IF v_saved.request_sha256<>v_hash THEN RAISE EXCEPTION 'resolution-payload-conflict'; END IF; RETURN v_saved.receipt; END IF;
  IF NOT private.lock_dictionary_analysis_authority(v_actor) THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  PERFORM 1 FROM private.dictionary_content_runtime WHERE singleton AND creation_resolution_enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'meaning-resolution-disabled'; END IF;
  INSERT INTO private.dictionary_meaning_requests(actor_id,resolution_id,request,request_sha256) VALUES(v_actor,v_id,p_request,v_hash);
  RETURN NULL;
END;
$$;
CREATE FUNCTION private.dictionary_creation_identity_ready(p_identity private.dictionary_creation_identities)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE v_source private.dictionary_sources%ROWTYPE; v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled FROM private.dictionary_creation_identity_availability WHERE identity_id=p_identity.identity_id FOR SHARE;
  SELECT * INTO STRICT v_source FROM private.dictionary_sources WHERE source_id=p_identity.source_id FOR SHARE;
  RETURN COALESCE(v_enabled,FALSE) AND v_source.review_state='approved' AND v_source.reviewed_by=p_identity.verified_by
    AND private.dictionary_canonical_sha256(TO_JSONB(v_source))=p_identity.source_approval_sha256;
END;
$$;
CREATE FUNCTION private.dictionary_creation_published(p_identity private.dictionary_creation_identities)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_ref JSONB; v_entry public.dictionary_entries%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM public.dictionary_entries WHERE entry_id=p_identity.entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF ROW(v_entry.language_code,v_entry.lemma,v_entry.part_of_speech,v_entry.article,v_entry.sense_key)
    IS DISTINCT FROM ROW(p_identity.language_code,p_identity.lemma,p_identity.part_of_speech,p_identity.article,p_identity.sense_key)
    OR v_entry.state='retired' THEN RAISE EXCEPTION 'reviewed-entry-identity-conflict'; END IF;
  IF v_entry.state<>'published' THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.dictionary_meaning_anchor_heads h JOIN private.dictionary_meaning_anchors a USING(entry_id,anchor_id)
      WHERE h.entry_id=p_identity.entry_id AND ROW(a.source_id,a.gloss,a.examples,a.verified_by,a.verified_at)
        IS NOT DISTINCT FROM ROW(p_identity.source_id,p_identity.gloss,p_identity.examples,p_identity.verified_by,p_identity.verified_at))
    THEN RAISE EXCEPTION 'reviewed-entry-anchor-conflict'; END IF;
  SELECT JSONB_BUILD_OBJECT('reference',JSONB_BUILD_OBJECT('entry_id',r.entry_id,'revision_id',r.revision_id),'content_sha256',r.content_sha256)
    INTO v_ref FROM public.dictionary_entry_heads h JOIN public.dictionary_revisions r USING(entry_id,revision_id)
    WHERE h.entry_id=p_identity.entry_id AND r.review_status='published';
  IF v_ref IS NULL THEN RAISE EXCEPTION 'published-dependency-missing'; END IF;
  RETURN v_ref;
END;
$$;
CREATE FUNCTION public.resolve_dictionary_meaning_request_v1(p_actor UUID,p_resolution UUID,p_request_sha256 TEXT,p_identity UUID,p_decision TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_req private.dictionary_meaning_requests%ROWTYPE; v_identity private.dictionary_creation_identities%ROWTYPE; v_ref JSONB; v_receipt JSONB;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('meaning-request/'||p_actor::TEXT||'/'||p_resolution::TEXT,0));
  SELECT * INTO STRICT v_req FROM private.dictionary_meaning_requests WHERE actor_id=p_actor AND resolution_id=p_resolution FOR UPDATE;
  IF p_request_sha256 IS DISTINCT FROM v_req.request_sha256 THEN RAISE EXCEPTION 'resolution-payload-conflict'; END IF;
  IF v_req.receipt IS NOT NULL THEN
    IF v_req.identity_id IS DISTINCT FROM p_identity OR v_req.receipt->>'decision_code' IS DISTINCT FROM p_decision
      THEN RAISE EXCEPTION 'resolution-decision-conflict'; END IF; RETURN v_req.receipt;
  END IF;
  IF NOT private.lock_dictionary_analysis_authority(p_actor) THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  PERFORM 1 FROM private.dictionary_content_runtime WHERE singleton AND creation_resolution_enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'meaning-resolution-disabled'; END IF;
  v_receipt:=v_req.request||JSONB_BUILD_OBJECT('resolved_identity_id',NULL,'published',NULL,'decision_code',p_decision);
  IF p_identity IS NULL THEN
    IF p_decision NOT IN ('meaning-uncertain','source-unapproved','identity-conflict') OR p_decision IS NULL THEN RAISE EXCEPTION 'invalid-resolution-decision'; END IF;
    v_receipt:=v_receipt||JSONB_BUILD_OBJECT('outcome',CASE WHEN p_decision='meaning-uncertain' THEN 'review-required' ELSE 'rejected' END);
  ELSE
    IF p_decision IS NOT NULL THEN RAISE EXCEPTION 'invalid-resolution-decision'; END IF;
    SELECT * INTO STRICT v_identity FROM private.dictionary_creation_identities WHERE identity_id=p_identity FOR SHARE;
    IF private.dictionary_creation_identity_ready(v_identity) IS NOT TRUE THEN RAISE EXCEPTION 'reviewed-identity-unavailable'; END IF;
    v_ref:=private.dictionary_creation_published(v_identity);
    v_receipt:=v_receipt||CASE WHEN v_ref IS NULL THEN JSONB_BUILD_OBJECT('outcome','new-meaning','resolved_identity_id',p_identity)
      ELSE JSONB_BUILD_OBJECT('outcome','existing-meaning','published',v_ref) END;
  END IF;
  UPDATE private.dictionary_meaning_requests SET identity_id=p_identity,receipt=v_receipt WHERE actor_id=p_actor AND resolution_id=p_resolution;
  RETURN v_receipt;
END;
$$;
CREATE FUNCTION public.get_dictionary_creation_operation_v2(p_operation UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID:=auth.uid(); v_receipt JSONB;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  SELECT receipt INTO v_receipt FROM private.dictionary_creation_commands WHERE actor_id=v_actor AND operation_id=p_operation;
  RETURN v_receipt;
END;
$$;
CREATE FUNCTION public.accept_dictionary_creation_v2(p_command JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID:=auth.uid(); v_id UUID; v_resolution UUID; v_hash TEXT; v_receipt JSONB; v_ref JSONB;
  v_req private.dictionary_meaning_requests%ROWTYPE; v_identity private.dictionary_creation_identities%ROWTYPE;
  v_runtime private.dictionary_content_runtime%ROWTYPE; v_policy private.dictionary_analysis_validator_policies%ROWTYPE;
  v_anchor UUID; v_allowed BOOLEAN;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF private.jsonb_has_exact_keys(p_command,ARRAY['protocol_version','operation_id','resolution_id']) IS NOT TRUE
    OR p_command->'protocol_version' IS DISTINCT FROM '2'::JSONB THEN RAISE EXCEPTION 'invalid-creation-command'; END IF;
  v_id:=private.dictionary_creation_uuid(p_command->'operation_id'); v_resolution:=private.dictionary_creation_uuid(p_command->'resolution_id');
  IF v_id=v_resolution THEN RAISE EXCEPTION 'invalid-creation-command'; END IF;
  p_command:=p_command||JSONB_BUILD_OBJECT('operation_id',v_id,'resolution_id',v_resolution);
  v_hash:=private.dictionary_canonical_sha256(p_command);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-command/'||v_actor::TEXT||'/'||v_id::TEXT,0));
  SELECT receipt INTO v_receipt FROM private.dictionary_creation_commands WHERE actor_id=v_actor AND operation_id=v_id;
  IF FOUND THEN
    IF NOT EXISTS(SELECT 1 FROM private.dictionary_creation_commands WHERE actor_id=v_actor AND operation_id=v_id AND request_sha256=v_hash)
      THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF; RETURN v_receipt;
  END IF;
  IF NOT private.lock_dictionary_analysis_authority(v_actor) THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  SELECT * INTO STRICT v_runtime FROM private.dictionary_content_runtime WHERE singleton FOR SHARE;
  IF NOT(v_runtime.creation_resolution_enabled AND v_runtime.creation_operations_enabled) THEN RAISE EXCEPTION 'dictionary-creation-disabled'; END IF;
  SELECT q.* INTO v_policy FROM private.dictionary_creation_profile p JOIN private.dictionary_analysis_validator_policies q
    ON ROW(p.validator_version,p.policy_sha256)=ROW(q.validator_version,q.policy_sha256) WHERE p.singleton FOR SHARE OF p,q;
  IF NOT FOUND OR private.dictionary_analysis_profile_ready(v_policy.generation_model,v_policy.validator_version,v_policy.policy_sha256,
    v_policy.semantic_model,v_policy.semantic_prompt_sha256,v_policy.media_url_prefixes) IS NOT TRUE THEN RAISE EXCEPTION 'creation-profile-unavailable'; END IF;
  SELECT * INTO v_req FROM private.dictionary_meaning_requests WHERE actor_id=v_actor AND resolution_id=v_resolution FOR SHARE;
  IF NOT FOUND OR v_req.receipt->>'outcome' IS DISTINCT FROM 'new-meaning' OR v_req.identity_id IS NULL THEN RAISE EXCEPTION 'resolved-new-meaning-required'; END IF;
  SELECT * INTO STRICT v_identity FROM private.dictionary_creation_identities WHERE identity_id=v_req.identity_id FOR SHARE;
  -- All actors for this reviewed sense serialize here; unrelated senses remain separate.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-entry/'||v_identity.entry_id::TEXT,0));
  IF private.dictionary_creation_identity_ready(v_identity) IS NOT TRUE THEN RAISE EXCEPTION 'reviewed-identity-unavailable'; END IF;
  v_ref:=private.dictionary_creation_published(v_identity);
  IF v_ref IS NOT NULL THEN
    v_receipt:=p_command||JSONB_BUILD_OBJECT('outcome','existing-meaning','quota_charged',FALSE,'published',v_ref);
  ELSIF EXISTS(SELECT 1 FROM private.dictionary_creation_leases WHERE identity_id=v_identity.identity_id) THEN
    v_receipt:=p_command||JSONB_BUILD_OBJECT('outcome','creation-in-progress','quota_charged',FALSE);
  ELSE
    IF EXISTS(SELECT 1 FROM public.dictionary_entries WHERE entry_id=v_identity.entry_id) OR EXISTS(SELECT 1 FROM public.dictionary_entries
      WHERE language_code=v_identity.language_code AND LOWER(BTRIM(lemma))=LOWER(BTRIM(v_identity.lemma))
      AND COALESCE(LOWER(BTRIM(part_of_speech)),'')=COALESCE(LOWER(BTRIM(v_identity.part_of_speech)),'')
      AND COALESCE(LOWER(BTRIM(article)),'')=COALESCE(LOWER(BTRIM(v_identity.article)),'') AND sense_key=v_identity.sense_key)
      THEN RAISE EXCEPTION 'reviewed-entry-identity-conflict'; END IF;
    SELECT allowed INTO STRICT v_allowed FROM public.consume_edge_function_quota(v_actor,'gemini-analysis',v_runtime.analysis_quota_limit,v_runtime.analysis_quota_window_seconds);
    IF NOT v_allowed THEN RAISE EXCEPTION 'rate-limit-exceeded'; END IF;
    INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key)
      VALUES(v_identity.entry_id,v_identity.language_code,v_identity.lemma,v_identity.part_of_speech,v_identity.article,v_identity.sense_key);
    v_anchor:=pg_catalog.gen_random_uuid();
    INSERT INTO private.dictionary_meaning_anchors(anchor_id,entry_id,source_id,gloss,examples,verified_by,verified_at,audit_reference,anchor_sha256)
      VALUES(v_anchor,v_identity.entry_id,v_identity.source_id,v_identity.gloss,v_identity.examples,v_identity.verified_by,v_identity.verified_at,v_identity.audit_reference,REPEAT('0',64));
    INSERT INTO private.dictionary_meaning_anchor_heads(entry_id,anchor_id) VALUES(v_identity.entry_id,v_anchor);
    INSERT INTO private.dictionary_creation_operations(actor_id,operation_id,resolution_id,identity_id,entry_id,anchor_id,evidence_sha256,
      planned_generation_model,planned_validator_version,planned_policy_sha256,fence)
      VALUES(v_actor,v_id,v_resolution,v_identity.identity_id,v_identity.entry_id,v_anchor,v_identity.evidence_sha256,v_policy.generation_model,v_policy.validator_version,v_policy.policy_sha256,1);
    INSERT INTO private.dictionary_creation_leases(entry_id,identity_id,actor_id,operation_id,fence) VALUES(v_identity.entry_id,v_identity.identity_id,v_actor,v_id,1);
    v_receipt:=p_command||JSONB_BUILD_OBJECT('entry_id',v_identity.entry_id,'fence','1','status','accepted','quota_charged',TRUE,
      'result_sha256',NULL,'error_code',NULL,'published',NULL,'published_head_sequence',NULL);
  END IF;
  INSERT INTO private.dictionary_creation_commands(actor_id,operation_id,resolution_id,request_sha256,receipt) VALUES(v_actor,v_id,v_resolution,v_hash,v_receipt);
  RETURN v_receipt;
END;
$$;

ALTER TABLE private.dictionary_creation_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_creation_identity_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_meaning_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_creation_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_creation_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_creation_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_creation_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_creation_identities,private.dictionary_creation_identity_availability,private.dictionary_meaning_requests,
  private.dictionary_creation_profile,private.dictionary_creation_operations,private.dictionary_creation_leases,private.dictionary_creation_commands FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON private.dictionary_creation_identities,private.dictionary_meaning_requests,private.dictionary_creation_operations,private.dictionary_creation_commands TO service_role;
GRANT SELECT,INSERT,UPDATE ON private.dictionary_creation_identity_availability,private.dictionary_creation_profile TO service_role;
REVOKE ALL ON FUNCTION private.dictionary_creation_uuid(JSONB),private.dictionary_creation_utf16_length(TEXT),private.validate_dictionary_creation_identity(),
  private.protect_dictionary_creation_source(),private.protect_dictionary_meaning_request(),private.protect_dictionary_creation_owner_journal(),private.dictionary_creation_identity_ready(private.dictionary_creation_identities),
  private.dictionary_creation_published(private.dictionary_creation_identities) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.register_dictionary_creation_identity_v1(JSONB),public.resolve_dictionary_meaning_request_v1(UUID,UUID,TEXT,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_dictionary_creation_identity_v1(JSONB),public.resolve_dictionary_meaning_request_v1(UUID,UUID,TEXT,UUID,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.request_dictionary_meaning_resolution_v2(JSONB),public.get_dictionary_meaning_resolution_v2(UUID),public.accept_dictionary_creation_v2(JSONB),public.get_dictionary_creation_operation_v2(UUID) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.request_dictionary_meaning_resolution_v2(JSONB),public.get_dictionary_meaning_resolution_v2(UUID),public.accept_dictionary_creation_v2(JSONB),public.get_dictionary_creation_operation_v2(UUID) TO authenticated;
COMMIT;
