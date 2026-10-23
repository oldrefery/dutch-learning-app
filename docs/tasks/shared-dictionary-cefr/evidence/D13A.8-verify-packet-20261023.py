"""Verify a preparation-only release packet offline; never execute its proposal."""

import hashlib
import json
import subprocess
import sys
import tarfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
BASE = '0e706eead0c2e7c3a8aecc31883cc3d27061fd3b'
EXPECTED_HOLDS = {f'R{i:02}' for i in range(1, 11)}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def repo_file(name):
    path = Path(name)
    require(not path.is_absolute() and '..' not in path.parts, 'Invalid packet path')
    require(not path.name.startswith('.env') or path.name == '.env.example',
            'Environment file is forbidden')
    file = ROOT / path
    require(not file.is_symlink(), 'Symlink input is forbidden')
    require(file.resolve().is_relative_to(ROOT), 'Path leaves repository')
    return file


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def verify(packet):
    require(packet['schema_version'] == 1, 'Unknown packet version')
    require(packet['packet_type'] == 'D13A.8-preparation-only', 'Wrong packet scope')
    require(packet['status'] == 'prepared_for_review_not_execution', 'Wrong packet state')
    authority = packet['authority']
    require(authority['id'] == 'AUTH-39' and authority['preparation_authorized'] is True,
            'Wrong preparation authority')
    require(authority['production_operations_authorized'] is False,
            'Production authority is absent')
    require(authority['paid_requests_authorized'] == 0 and authority['real_link_ceiling'] == 0,
            'Paid or linking scope exceeds authority')
    require(authority['commit_or_push_authorized'] is False, 'Git scope exceeds authority')
    require(packet['ready_for_execution'] is False, 'Preparation cannot be execution-ready')
    require(packet['authorized_commands_to_execute'] == [], 'Execution commands are forbidden')
    require({item['id'] for item in packet['execution_holds']} == EXPECTED_HOLDS,
            'Execution holds were removed or changed')
    require(len(packet['execution_holds']) == len(EXPECTED_HOLDS), 'Duplicate execution hold')
    targets = packet['targets']
    require(targets['expo_account'] == 'oldrefery', 'Wrong Expo account')
    require(targets['expo_project'] == '@oldrefery/dutch-learning-app', 'Wrong Expo project')
    require(targets['expo_project_id'] == 'd968536e-1e9b-4224-9ed7-a1e9c6d821c8',
            'Wrong Expo project ID')
    require(targets['supabase_project_ref'] == 'josxavjbcjbcjgulwcyy', 'Wrong backend')
    require(targets['web_domain'] == 'woordenaar.app', 'Wrong web domain')
    require(targets['web_project'] == 'woordenaar-web', 'Wrong web project')
    require(targets['apple_team'] == '7FQ395U52U', 'Wrong Apple team')
    require(targets['asc_app_id'] == '6752469146', 'Wrong App Store application')
    require(targets['ios_bundle'] == 'com.oldrefery.dutch-learning-app', 'Wrong iOS bundle')
    require(targets['android_package'] == 'com.oldrefery.dutchlearningapp', 'Wrong Android package')
    source = packet['source']
    require(source['branch'] == 'feature/shared-dictionary-schema', 'Wrong candidate branch')
    require(source['commit'] == BASE, 'Source candidate changed')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    require(head == BASE, 'Current HEAD requires a newly prepared packet')
    tree = subprocess.check_output(['git', 'rev-parse', BASE + '^{tree}'], cwd=ROOT, text=True).strip()
    require(tree == source['tree'], 'Source tree mismatch')
    archive = repo_file(source['archive'])
    require(digest(archive) == source['archive_sha256'], 'Source archive digest mismatch')
    count = 0
    with tarfile.open(archive) as tar:
        for item in tar:
            path = Path(item.name)
            require(not path.is_absolute() and '..' not in path.parts, 'Unsafe archive path')
            require(item.isfile() or item.isdir(), 'Unsafe archive member type')
            if not item.isfile():
                continue
            count += 1
            require(not any(part in path.parts for part in
                            ['reports', 'builds', '.playwright-cli', '.git', 'node_modules']),
                    'Private/generated archive path')
            require(not path.name.startswith('.env') or path.name == '.env.example',
                    'Environment values in archive')
            require(path.suffix not in ['.ipa', '.apk', '.aab', '.p12', '.p8',
                                       '.mobileprovision', '.jks', '.sqlite', '.db'],
                    'Private/binary artifact in source archive')
    require(count == source['archive_files'], 'Archive inventory mismatch')
    pins = source['production_test_tool_files_sha256']
    require(len(pins) == 1506, 'Source footprint changed')
    for name, expected in pins.items():
        require(digest(repo_file(name)) == expected, 'Source digest mismatch: ' + name)
    migrations = packet['migrations']
    actual = subprocess.check_output(
        ['git', 'diff', '--name-only', 'f97a733..' + BASE, '--', 'supabase/migrations'],
        cwd=ROOT, text=True).splitlines()
    require([row['path'] for row in migrations] == sorted(actual) and len(actual) == 14,
            'Migration inventory mismatch')
    for row in migrations:
        require(digest(repo_file(row['path'])) == row['sha256'], 'Migration digest mismatch')
    strategy = packet['migration_strategy']
    require(strategy['preserve_existing_v1_runtime_values'] is True, 'Existing v1 must remain')
    require(strategy['new_gates_off_on_install'] and strategy['no_down_migrations'] is True,
            'Unsafe migration proposal')
    require(strategy['no_migration_repair_as_rollback'] is True, 'Unsafe history repair')
    native = packet['artifacts']['native']
    for field in ['release_version', 'ios_build_number', 'android_version_code',
                  'ipa_sha256', 'aab_sha256', 'production_runtime_versions']:
        require(native[field] is None, 'Unverified production artifact claim')
    require(native['qa_artifacts_eligible'] is False, 'QA artifact cannot become production')
    require(not repo_file('supabase/functions/dictionary-creation/index.ts').exists(),
            'Creation runtime changed; prepare a new packet')
    require(packet['artifacts']['edge']['deploy_all_functions'] is False,
            'All-functions deployment is forbidden')
    require(packet['artifacts']['edge']['deployable_disabled_function_candidates'] ==
            ['dictionary-analysis'], 'Wrong function allowlist')
    require(packet['artifacts']['edge']['incomplete_function_hold'] ==
            ['dictionary-creation'], 'Missing creation runtime hold')
    require(packet['artifacts']['web']['alias_promotion_authorized'] is False,
            'Web promotion is not authorized')
    budget = packet['quota_and_budget']
    require(budget['authorized_paid_requests'] == 0 and
            budget['authorized_production_budget_usd'] == '0', 'Paid scope is forbidden')
    require(budget['automatic_unknown_redispatch'] is False, 'Unknown outcomes cannot redispatch')
    require(budget['historical_unknown_retained_nanousd'] == 560000000,
            'Historical unknown liabilities changed')
    require(packet['cohort']['proposed_live_link_ceiling'] == 0 and
            packet['cohort']['approved_real_links'] == 0, 'No real links are approved')
    require(packet['cohort']['reviewed_mapping_sha256'] is None, 'Unverified mapping claim')
    require(packet['cohort']['apply_default_batch'] == 50 and
            packet['cohort']['apply_max_batch'] == 100, 'Batch bounds changed')
    require(packet['qualification']['parser_compatibility']['status'] == 'passed',
            'Parser carry review missing')
    for name, expected in packet['preparation_files_sha256'].items():
        require(digest(repo_file(name)) == expected, 'Preparation evidence mismatch: ' + name)
    return {'status': 'preparation_verified', 'source_files': len(pins),
            'archive_files': count, 'migrations': len(migrations),
            'execution_holds': len(EXPECTED_HOLDS), 'execution_authorized': False}


def main():
    require(len(sys.argv) in [2, 3], 'Use packet.json [--check-execution]')
    require(len(sys.argv) == 2 or sys.argv[2] == '--check-execution', 'Unknown verification mode')
    packet = json.loads(Path(sys.argv[1]).read_text())
    result = verify(packet)
    if len(sys.argv) == 3:
        print(json.dumps({'status': 'execution_refused', 'reason': 'AUTH-39 permits preparation only',
                          'open_holds': sorted(EXPECTED_HOLDS)}))
        return 2
    print(json.dumps(result))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print('Packet rejected: ' + str(error), file=sys.stderr)
        sys.exit(1)
