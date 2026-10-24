"""Offline AUTH-48 receipt verifier. Never performs network, deployment or decryption."""
import argparse,hashlib,json
from pathlib import Path

def verify(packet,private_root,repo):
    assert packet['schema_version']==1 and packet['scope']=='B02' and packet['authorization']=='AUTH-48'
    assert packet['project_ref']=='josxavjbcjbcjgulwcyy'
    assert packet['operation_id']=='eafe96ea-c331-4617-b201-dd4ed954a838'
    assert packet['status']=='dormant_backend_verified'
    assert packet['authorization_consumed'] is True
    assert packet['further_execution_authorized'] is False and packet['activation_authorized'] is False
    assert packet['store_or_ota_publication_authorized'] is False
    assert packet['provider_requests_by_operation']==packet['real_links']==packet['main_account_operations']==0
    assert packet['unknown_budget_usd_held']=='0.56' and packet['unknown_outcomes']==[]
    assert packet['source_main']=='165501a0f547765011630fdab04ba0654ac75626'
    base_path=Path(repo)/'docs/tasks/shared-dictionary-cefr/evidence/D13A.8.4-review-packet-20261024.json'
    assert hashlib.sha256(base_path.read_bytes()).hexdigest()=='665722a50bd0d1be91db1c9d3e7131653cf097042762cee997450530dcf73c6e'
    base=json.loads(base_path.read_text())
    assert len(packet['migrations'])==14 and packet['ledger_versions']==66
    for original,actual in zip(base['migrations'],packet['migrations']):
        assert actual['path']==original['path'] and actual['source_sha256']==original['sha256']
        assert actual['version']==Path(original['path']).name.split('_')[0]
        assert actual['original_source_recorded_exactly'] is True
        assert actual['preservation_guards_in_same_atomic_statement']==50
    assert len(packet['database_flags'])==17
    for name,value in packet['database_flags'].items():
        assert value is (True if name in ('operations_enabled','reads_enabled','legacy_guard_enabled') else False)
    assert packet['endpoint_flags_set']=={'DICTIONARY_ANALYSIS_ENDPOINT_ENABLED':False,'DICTIONARY_CREATION_ENDPOINT_ENABLED':False}
    preservation=packet['preservation']
    assert preservation['full_original_projections_unchanged']==50 and preservation['timestamp_columns_included'] is True
    assert preservation['catalog_matches_exact_rehearsal'] is True
    assert preservation['new_tables_empty']==25 and preservation['new_routines_deny_anon_public']==118
    assert preservation['nonlegacy_words']==0
    assert packet['transport_interruption_reconciled_readonly'] is True
    assert packet['automatic_write_retries']==0
    assert packet['qa']['gateway401']==4 and packet['qa']['disabled503_no_store']==4
    assert packet['qa']['user_or_service_token_used'] is False
    assert packet['qa']['enabled_provider_behavior_qualified'] is False
    assert packet['qa']['transitive_dependency_identity_fully_verified'] is False
    expected_hashes={'dictionary-analysis':'ca1ebe2f34d1f1fc30d90ef9e37b2ab133a856c90261a4b17a9960cd9838e09a',
                     'dictionary-creation':'f932cb991400b34200bea5e4eae14ff94adb897760de9fb4f9871932b8a24fad'}
    assert {f['slug'] for f in packet['functions']}==set(expected_hashes)
    for function in packet['functions']:
        assert function['version']==1 and function['status']=='ACTIVE' and function['verify_jwt'] is True
        assert function['endpoint_enabled'] is False
        assert function['ezbr_sha256']==expected_hashes[function['slug']]
        key='analysis' if function['slug']=='dictionary-analysis' else 'creation'
        assert function['source_archive_sha256']==base['archives'][key]['sha256']
        assert function['original_files']==(24 if key=='analysis' else 40)
        assert len(function['derived_import_map_sha256'])==64
    assert packet['existing_function_source_uploads']==0
    assert len(packet['legacy_version_only_effect'])==4
    assert {f['slug'] for f in packet['legacy_version_only_effect']}=={'gemini-handler','data-migration','get-multiple-images','delete-account'}
    assert sum(bool(f['bundle_hash_available']) for f in packet['legacy_version_only_effect'])==2
    for function in packet['legacy_version_only_effect']:
        assert function['metadata_changes']==['version'] and function['version_after']==function['version_before']+1
        assert function['jwt_preserved'] is True and function['updated_at_preserved'] is True
        if function['bundle_hash_available']:assert function['available_bundle_hash_unchanged'] is True
    assert packet['cleanup']['remaining_owned_containers']==0
    assert packet['full_managed_recovery_proven'] is False and packet['future_delta_covered'] is False
    assert packet['remaining_fixed_stage_steps']==3 and packet['other_broad_milestones']==6
    b01_path=Path(repo)/'docs/tasks/shared-dictionary-cefr/evidence/D13A.8.4-b01-packet-20261024.json'
    assert hashlib.sha256(b01_path.read_bytes()).hexdigest()=='868f8711ac7e87cc811b2f7fc139f04875f2773854d6e50a406ceb5a205dbe31'
    root=Path(private_root).resolve();seen=set();assert packet['artifacts']
    for artifact in packet['artifacts']:
        name=artifact['path'];assert Path(name).name==name and name not in seen
        assert not any(token in name.lower() for token in ('pgpass','.env','access-token','private-key'))
        seen.add(name);path=root/name
        assert not path.is_symlink() and path.resolve().parent==root
        data=path.read_bytes();assert len(data)==artifact['bytes']
        assert hashlib.sha256(data).hexdigest()==artifact['sha256']
    return {'status':'passed','private_artifacts':len(seen),'further_execution_authorized':False,'activation_authorized':False}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packet',type=Path,default=Path(__file__).with_name('D13A.8.4-b02-packet-20261024.json'))
    parser.add_argument('--repository-root',type=Path,default=Path(__file__).resolve().parents[4])
    parser.add_argument('--private-root',type=Path)
    args=parser.parse_args();private=args.private_root or args.repository_root/'reports/shared-dictionary-cefr/d13a84-b02-20261024'
    print(json.dumps(verify(json.loads(args.packet.read_text()),private,args.repository_root),sort_keys=True))
