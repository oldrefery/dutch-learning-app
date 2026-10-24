"""Offline B01 integrity/authority verifier. No network, subprocesses or decryption."""
import argparse
import hashlib
import json
from pathlib import Path

def verify(packet, private_root, repository_root):
    assert packet['schema_version'] == 1
    assert packet['authorization'] == 'AUTH-47' and packet['scope'] == 'B01'
    assert packet['project_ref'] == 'josxavjbcjbcjgulwcyy'
    assert packet['source_main'] == '165501a0f547765011630fdab04ba0654ac75626'
    assert packet['documentation_branch_head'] == 'c626e6c85d9d12f0589d568a3dbd46fda5e587e2'
    assert packet['status'] == 'scoped_application_restore_verified_recovery_holds_remain'
    assert packet['production_writes'] is False
    assert packet['execution_authorized'] is False and packet['publication_authorized'] is False
    assert packet['paid_calls'] == packet['redispatches'] == 0
    assert packet['unknown_budget_usd_held'] == '0.56'
    assert packet['main_application_account_changed'] is False
    assert packet['full_managed_disaster_recovery_proven'] is False
    assert packet['key_custody']['exported'] is False
    assert packet['key_custody']['sync'] is False
    assert packet['key_custody']['accessibility'] == 'WhenUnlockedThisDeviceOnly'
    assert packet['key_custody']['off_machine_recovery_proven'] is False
    assert packet['crypto_checks_passed'] == 14 and packet['catalog_tamper_checks_passed'] == 19
    assert packet['restore']['tables_verified'] == 50
    assert packet['restore']['rows_verified'] == 32636
    assert packet['restore']['full_sorted_sha256_match'] is True
    assert packet['restore']['timestamp_columns_included'] is True
    assert packet['restore']['catalog_logical_match'] is True
    assert packet['restore']['database_owner_encoding_locale_provider_version_acl_match'] is True
    assert packet['restore']['role_attributes_match'] is True
    assert packet['restore']['effective_membership_options_match'] is True
    assert packet['restore']['foreign_private_words_visible'] == 0
    assert packet['restore']['icu_collation_version'] == '153.120'
    assert packet['restore']['image'] == 'sha256:178f0976b54a39237096bfa310c1a352dbc82fb1b08dda45cdb8acb5d40c1426'
    assert packet['restore']['network'] == packet['restore']['log_driver'] == 'none'
    assert packet['delta']['changed_tables_between_boundaries'] == 0
    assert packet['delta']['future_changes_covered'] is False
    assert packet['delta']['device_local_queues_verified'] is False
    assert packet['cleanup']['remaining_owned_containers'] == 0
    assert packet['cleanup']['dedicated_credential_files_removed'] == 2
    assert packet['incident']['initial_capture_accepted'] is False
    assert packet['incident']['initial_runtime_log_secure_erasure_proven'] is False
    assert packet['capture']['accepted_docker_log_driver'] == 'none'
    assert set(packet['coverage_exclusions']) == {
        'full_auth_rows_and_sessions', 'storage_object_bytes', 'vault_and_managed_services',
        'device_local_queues', 'non_allowlisted_database_settings', 'off_machine_key_recovery'}
    assert packet['remaining_fixed_stage_steps'] == 3 and packet['other_broad_milestones'] == 6
    root = Path(private_root).resolve()
    assert packet['artifacts']
    seen=set()
    for artifact in packet['artifacts']:
        name=artifact['path']
        assert name not in seen and Path(name).name==name and not name.startswith('.')
        assert not any(token in name.lower() for token in ('pgpass','credential','pooler-url'))
        seen.add(name)
        path=root/name
        assert not path.is_symlink() and path.resolve().parent==root
        payload=path.read_bytes()
        assert len(payload)==artifact['bytes']
        assert hashlib.sha256(payload).hexdigest()==artifact['sha256']
    for entry in packet['unchanged_packets']:
        path=Path(repository_root)/entry['path']
        assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
    return {'status':'passed','verified_private_artifacts':len(seen),
            'execution_authorized':False,'publication_authorized':False,
            'full_managed_disaster_recovery_proven':False}

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packet',type=Path,default=Path(__file__).with_name('D13A.8.4-b01-packet-20261024.json'))
    parser.add_argument('--repository-root',type=Path,default=Path(__file__).resolve().parents[4])
    parser.add_argument('--private-root',type=Path)
    args=parser.parse_args()
    root=args.private_root or args.repository_root/'reports/shared-dictionary-cefr/d13a84-b01-20261024'
    print(json.dumps(verify(json.loads(args.packet.read_text()),root,args.repository_root),sort_keys=True))
