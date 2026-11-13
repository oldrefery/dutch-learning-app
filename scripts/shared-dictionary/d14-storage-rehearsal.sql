-- LOCAL SYNTHETIC REHEARSAL ONLY. Not a deploy migration or production operator.
-- Invoker rights, administrator-only schema; no application role receives access.
BEGIN;
DO $$ BEGIN
  IF current_setting('dictionary_storage_rehearsal.install',true) IS DISTINCT FROM 'local-synthetic-only' THEN
    RAISE EXCEPTION 'local-fixture-install-required';
  END IF;
END $$;
CREATE SCHEMA dictionary_storage_rehearsal;
REVOKE ALL ON SCHEMA dictionary_storage_rehearsal FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION dictionary_storage_rehearsal.hash(p_value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex');
$$;
CREATE FUNCTION dictionary_storage_rehearsal.lexical(p_word public.words) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT jsonb_build_object('dutch_original',to_jsonb(p_word.dutch_original),
   'translations',to_jsonb(p_word.translations),
   'examples',to_jsonb(p_word.examples),
   'is_irregular',to_jsonb(p_word.is_irregular),
   'is_reflexive',to_jsonb(p_word.is_reflexive),
   'is_expression',to_jsonb(p_word.is_expression),
   'expression_type',to_jsonb(p_word.expression_type),
   'is_separable',to_jsonb(p_word.is_separable),
   'prefix_part',to_jsonb(p_word.prefix_part),
   'root_verb',to_jsonb(p_word.root_verb),
   'plural',to_jsonb(p_word.plural),
   'register',to_jsonb(p_word.register),
   'synonyms',to_jsonb(p_word.synonyms),
   'antonyms',to_jsonb(p_word.antonyms),
   'conjugation',to_jsonb(p_word.conjugation),
   'preposition',to_jsonb(p_word.preposition),
   'analysis_notes',to_jsonb(p_word.analysis_notes),
   'usage_notes',to_jsonb(p_word.usage_notes),
   'image_url',to_jsonb(p_word.image_url),
   'tts_url',to_jsonb(p_word.tts_url));
$$;
CREATE FUNCTION dictionary_storage_rehearsal.empty_lexical() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT '{"dutch_original":null,"translations":{"en":[],"ru":[]},"examples":[],"is_irregular":false,"is_reflexive":false,"is_expression":false,"expression_type":null,"is_separable":false,"prefix_part":null,"root_verb":null,"plural":null,"register":null,"synonyms":[],"antonyms":[],"conjugation":null,"preposition":null,"analysis_notes":null,"usage_notes":null,"image_url":null,"tts_url":""}'::jsonb;
$$;
CREATE FUNCTION dictionary_storage_rehearsal.capture(p_owner uuid,p_word uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE w public.words; s public.word_content_state; r public.dictionary_revisions; v_sequence bigint;
BEGIN
 SELECT * INTO w FROM public.words WHERE word_id=p_word AND user_id=p_owner AND deleted_at IS NULL;
 IF NOT FOUND OR w.dictionary_content_mode IS DISTINCT FROM 'follow' THEN RAISE EXCEPTION 'ineligible-word'; END IF;
 SELECT * INTO s FROM public.word_content_state WHERE word_id=p_word AND user_id=p_owner;
 IF NOT FOUND OR s.fallback_content IS NOT NULL OR s.overrides IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'private-or-missing-state'; END IF;
 SELECT r0.* INTO r FROM public.dictionary_entry_heads h
 JOIN public.dictionary_entries e USING(entry_id)
 JOIN public.dictionary_revisions r0 USING(entry_id,revision_id)
 WHERE h.entry_id=w.dictionary_entry_id AND e.state='published' AND r0.review_status='published';
 IF NOT FOUND OR NOT private.valid_dictionary_content(r.content) THEN RAISE EXCEPTION 'unavailable-head'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.dictionary_revisions WHERE entry_id=w.dictionary_entry_id AND revision_id=w.dictionary_revision_id AND review_status IN ('published','retired')) THEN RAISE EXCEPTION 'unavailable-adopted-revision'; END IF;
 SELECT max(committed_version) INTO v_sequence FROM private.dictionary_content_changes
 WHERE entry_id=r.entry_id AND revision_id=r.revision_id AND change_kind='revision-head';
 IF v_sequence IS NULL THEN RAISE EXCEPTION 'unavailable-head-sequence'; END IF;
 RETURN jsonb_build_object('word_id',w.word_id,'binding',jsonb_build_object(
   'owner_id',w.user_id,'mode',w.dictionary_content_mode,'entry_id',w.dictionary_entry_id,
   'adopted_revision_id',w.dictionary_revision_id,'content_version',s.content_version::text,
   'lemma_key',w.dutch_lemma,'pos_key',w.part_of_speech,'article_key',w.article,
   'head_id',r.revision_id,'head_sequence',v_sequence::text,'declared_digest',r.content_sha256,
   'content_digest',dictionary_storage_rehearsal.hash(r.content)),
   'lexical',dictionary_storage_rehearsal.lexical(w));
END $$;

CREATE FUNCTION dictionary_storage_rehearsal.validate_ids(p_owner uuid,p_ids uuid[]) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ BEGIN
 IF p_owner IS NULL OR p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 20
 OR array_position(p_ids,NULL) IS NOT NULL
 OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x) THEN RAISE EXCEPTION 'invalid-bounded-ids'; END IF;
END $$;
CREATE FUNCTION dictionary_storage_rehearsal.plan(p_owner uuid,p_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$ DECLARE v_result jsonb; BEGIN
 PERFORM dictionary_storage_rehearsal.validate_ids(p_owner,p_ids);
 SELECT jsonb_agg(jsonb_build_object('word_id',id,'expected_hash',dictionary_storage_rehearsal.hash(dictionary_storage_rehearsal.capture(p_owner,id))) ORDER BY id)
 INTO v_result FROM unnest(p_ids) id;
 RETURN v_result;
END $$;

CREATE FUNCTION dictionary_storage_rehearsal.lock_targets(p_owner uuid,p_ids uuid[]) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$ DECLARE v_entries uuid[]; v_locked integer; BEGIN
 PERFORM dictionary_storage_rehearsal.validate_ids(p_owner,p_ids);
 SELECT array_agg(DISTINCT dictionary_entry_id) INTO v_entries FROM public.words WHERE user_id=p_owner AND word_id=ANY(p_ids);
 -- Publication takes the parent entry lock; acquire it before word/state locks.
 PERFORM 1 FROM public.dictionary_entries WHERE entry_id=ANY(v_entries) ORDER BY entry_id FOR SHARE NOWAIT;
 PERFORM 1 FROM public.dictionary_entry_heads WHERE entry_id=ANY(v_entries) ORDER BY entry_id FOR SHARE NOWAIT;
 PERFORM 1 FROM public.dictionary_revisions
 WHERE revision_id IN (SELECT revision_id FROM public.dictionary_entry_heads WHERE entry_id=ANY(v_entries)
   UNION SELECT dictionary_revision_id FROM public.words WHERE user_id=p_owner AND word_id=ANY(p_ids))
 ORDER BY entry_id,revision_id FOR SHARE NOWAIT;
 PERFORM 1 FROM public.words WHERE user_id=p_owner AND word_id=ANY(p_ids) ORDER BY word_id FOR UPDATE NOWAIT;
 GET DIAGNOSTICS v_locked=ROW_COUNT;
 IF v_locked<>cardinality(p_ids) THEN RAISE EXCEPTION 'not-found-or-not-owned'; END IF;
 IF EXISTS(SELECT 1 FROM public.words WHERE word_id=ANY(p_ids) AND (dictionary_entry_id IS NULL OR NOT dictionary_entry_id=ANY(v_entries))) THEN RAISE EXCEPTION 'entry-lock-set-changed'; END IF;
 PERFORM 1 FROM public.word_content_state WHERE user_id=p_owner AND word_id=ANY(p_ids) ORDER BY word_id FOR UPDATE NOWAIT;
END $$;
CREATE FUNCTION dictionary_storage_rehearsal.write_lexical(p_owner uuid,p_word uuid,p_content jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 UPDATE public.words w SET dutch_original=v.dutch_original,
   translations=v.translations,
   examples=v.examples,
   is_irregular=v.is_irregular,
   is_reflexive=v.is_reflexive,
   is_expression=v.is_expression,
   expression_type=v.expression_type,
   is_separable=v.is_separable,
   prefix_part=v.prefix_part,
   root_verb=v.root_verb,
   plural=v.plural,
   register=v.register,
   synonyms=v.synonyms,
   antonyms=v.antonyms,
   conjugation=v.conjugation,
   preposition=v.preposition,
   analysis_notes=v.analysis_notes,
   usage_notes=v.usage_notes,
   image_url=v.image_url,
   tts_url=v.tts_url
 FROM jsonb_populate_record(NULL::public.words,p_content) v
 WHERE w.word_id=p_word AND w.user_id=p_owner;
 IF NOT FOUND THEN RAISE EXCEPTION 'not-found-or-not-owned'; END IF;
END $$;

CREATE TABLE dictionary_storage_rehearsal.operations(
 operation_id uuid PRIMARY KEY,owner_id uuid NOT NULL,plan jsonb NOT NULL,plan_hash text NOT NULL,
 before_rows jsonb NOT NULL,after_rows jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(jsonb_array_length(plan) BETWEEN 1 AND 20),
 CHECK(octet_length(before_rows::text)<=2097152));
CREATE TABLE dictionary_storage_rehearsal.restores(
 operation_id uuid PRIMARY KEY REFERENCES dictionary_storage_rehearsal.operations,
 result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE FUNCTION dictionary_storage_rehearsal.immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'immutable-rehearsal-receipt'; END $$;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON dictionary_storage_rehearsal.operations FOR EACH ROW EXECUTE FUNCTION dictionary_storage_rehearsal.immutable();
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON dictionary_storage_rehearsal.restores FOR EACH ROW EXECUTE FUNCTION dictionary_storage_rehearsal.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON dictionary_storage_rehearsal.operations FOR EACH STATEMENT EXECUTE FUNCTION dictionary_storage_rehearsal.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON dictionary_storage_rehearsal.restores FOR EACH STATEMENT EXECUTE FUNCTION dictionary_storage_rehearsal.immutable();

CREATE FUNCTION dictionary_storage_rehearsal.prune(p_operation uuid,p_owner uuid,p_plan jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' SET lock_timeout='1s' AS $$
DECLARE v_ids uuid[]; v_plan jsonb; o dictionary_storage_rehearsal.operations;
 i jsonb; v_before jsonb:='[]'; v_after jsonb:='[]'; v_snapshot jsonb; v_next jsonb;
BEGIN
 IF p_operation IS NULL OR p_plan IS NULL OR jsonb_typeof(p_plan)<>'array' THEN RAISE EXCEPTION 'invalid-prune-request'; END IF;
 IF jsonb_array_length(p_plan) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid-bounded-ids'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_plan) x WHERE jsonb_typeof(x)<>'object'
 OR NOT (x ?& ARRAY['word_id','expected_hash']) OR (x-ARRAY['word_id','expected_hash'])<>'{}'::jsonb
 OR coalesce(x->>'expected_hash','') !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'invalid-plan-shape'; END IF;
 SELECT array_agg((x->>'word_id')::uuid ORDER BY (x->>'word_id')::uuid),jsonb_agg(x ORDER BY (x->>'word_id')::uuid)
 INTO v_ids,v_plan FROM jsonb_array_elements(p_plan) x;
 PERFORM dictionary_storage_rehearsal.validate_ids(p_owner,v_ids);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,142));
 SELECT * INTO o FROM dictionary_storage_rehearsal.operations WHERE operation_id=p_operation;
 IF FOUND THEN
   IF o.owner_id<>p_owner OR o.plan<>v_plan THEN RAISE EXCEPTION 'operation-intent-mismatch'; END IF;
   RETURN jsonb_build_object('operation_id',p_operation,'count',cardinality(v_ids),'state',CASE WHEN EXISTS(SELECT 1 FROM dictionary_storage_rehearsal.restores WHERE operation_id=p_operation) THEN 'restored' ELSE 'pruned' END);
 END IF;
 PERFORM 1 FROM private.dictionary_content_runtime WHERE singleton AND reads_enabled AND following_reads_enabled AND legacy_guard_enabled FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'published-read-runtime-required'; END IF;
 PERFORM dictionary_storage_rehearsal.lock_targets(p_owner,v_ids);
 FOR i IN SELECT value FROM jsonb_array_elements(v_plan) LOOP
   v_snapshot:=dictionary_storage_rehearsal.capture(p_owner,(i->>'word_id')::uuid);
   IF dictionary_storage_rehearsal.hash(v_snapshot)<>i->>'expected_hash' THEN RAISE EXCEPTION 'stale-plan'; END IF;
   IF v_snapshot->'lexical'=dictionary_storage_rehearsal.empty_lexical() THEN RAISE EXCEPTION 'already-pruned-word'; END IF;
   v_before:=v_before||jsonb_build_array(v_snapshot);
 END LOOP;
 IF octet_length(v_before::text)>2097152 THEN RAISE EXCEPTION 'snapshot-byte-limit'; END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(v_before) LOOP
   PERFORM dictionary_storage_rehearsal.write_lexical(p_owner,(i->>'word_id')::uuid,dictionary_storage_rehearsal.empty_lexical());
   v_next:=dictionary_storage_rehearsal.capture(p_owner,(i->>'word_id')::uuid);
   IF v_next->'binding' IS DISTINCT FROM i->'binding' OR v_next->'lexical' IS DISTINCT FROM dictionary_storage_rehearsal.empty_lexical() THEN RAISE EXCEPTION 'unexpected-prune-result'; END IF;
   v_after:=v_after||jsonb_build_array(v_next);
 END LOOP;
 INSERT INTO dictionary_storage_rehearsal.operations VALUES(p_operation,p_owner,v_plan,dictionary_storage_rehearsal.hash(v_plan),v_before,v_after,clock_timestamp());
 RETURN jsonb_build_object('operation_id',p_operation,'count',cardinality(v_ids),'state','pruned');
END $$;

CREATE FUNCTION dictionary_storage_rehearsal.restore(p_operation uuid,p_owner uuid,p_plan_hash text) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' SET lock_timeout='1s' AS $$
DECLARE o dictionary_storage_rehearsal.operations; v_ids uuid[]; i jsonb; v_current jsonb; v_result jsonb; BEGIN
 IF p_operation IS NULL OR p_owner IS NULL OR p_plan_hash IS NULL THEN RAISE EXCEPTION 'invalid-restore-request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,142));
 SELECT * INTO o FROM dictionary_storage_rehearsal.operations WHERE operation_id=p_operation;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing-prune-receipt'; END IF;
 IF o.owner_id<>p_owner OR o.plan_hash<>p_plan_hash THEN RAISE EXCEPTION 'operation-intent-mismatch'; END IF;
 SELECT result INTO v_result FROM dictionary_storage_rehearsal.restores WHERE operation_id=p_operation;
 IF FOUND THEN RETURN v_result; END IF;
 SELECT array_agg((x->>'word_id')::uuid ORDER BY (x->>'word_id')::uuid) INTO v_ids FROM jsonb_array_elements(o.plan) x;
 PERFORM dictionary_storage_rehearsal.lock_targets(p_owner,v_ids);
 FOR i IN SELECT value FROM jsonb_array_elements(o.after_rows) LOOP
   v_current:=dictionary_storage_rehearsal.capture(p_owner,(i->>'word_id')::uuid);
   IF v_current IS DISTINCT FROM i THEN RAISE EXCEPTION 'stale-prune-result'; END IF;
 END LOOP;
 FOR i IN SELECT value FROM jsonb_array_elements(o.before_rows) LOOP
   PERFORM dictionary_storage_rehearsal.write_lexical(p_owner,(i->>'word_id')::uuid,i->'lexical');
   IF dictionary_storage_rehearsal.capture(p_owner,(i->>'word_id')::uuid) IS DISTINCT FROM i THEN RAISE EXCEPTION 'unexpected-restore-result'; END IF;
 END LOOP;
 v_result:=jsonb_build_object('operation_id',p_operation,'count',cardinality(v_ids),'state','restored');
 INSERT INTO dictionary_storage_rehearsal.restores(operation_id,result) VALUES(p_operation,v_result);
 RETURN v_result;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA dictionary_storage_rehearsal FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dictionary_storage_rehearsal FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
