"""Verify the merged-source review bundle offline; never perform a release."""

import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SNAPSHOT = 'c626e6c85d9d12f0589d568a3dbd46fda5e587e2'
MAIN = '165501a0f547765011630fdab04ba0654ac75626'
NATIVE_HASHES = {
    'ios': '0b38868515c1cc9124e8609573e4de4e71f48316cfb495fcb9926a9ad2411bb6',
    'android': 'd3567c02c740a2db4992978ee7abbf9c30a9979ad734ea94bb24810ea44e465f',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def repo_file(name):
    path = Path(name)
    require(not path.is_absolute() and '..' not in path.parts, 'Unsafe input path')
    result = ROOT / path
    require(not result.is_symlink() and result.resolve().is_relative_to(ROOT),
            'Input leaves repository or is a symlink')
    require(result.is_file(), 'Missing input: ' + name)
    return result


def archive_files(data):
    files = {}
    seen = set()
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive:
            path = Path(member.name)
            require(not path.is_absolute() and '..' not in path.parts and
                    '\\' not in member.name, 'Unsafe archive path')
            require(member.name not in seen, 'Duplicate archive member')
            seen.add(member.name)
            require(member.isdir() or member.isfile(), 'Unsafe archive member')
            if not member.isfile():
                continue
            require(not any(p in path.parts for p in
                            ['.git', 'node_modules', 'reports', 'builds']),
                    'Private/generated archive member')
            require(not path.name.startswith('.env') or path.name == '.env.example',
                    'Environment values in archive')
            require(path.name != 'credentials.json', 'Credentials in archive')
            files[member.name] = archive.extractfile(member).read()
    return files


def verify(packet):
    require(packet['schema_version'] == 1 and packet['packet_type'] ==
            'D13A.8.4-review-only-merged-source', 'Wrong packet scope')
    require(packet['authority'] == {
        'id': 'AUTH-46', 'preparation_authorized': True,
        'publication_authorized': False, 'production_writes_authorized': False,
        'paid_requests': 0, 'real_link_ceiling': 0,
    }, 'Authority exceeds preparation scope')
    require(packet['ready_for_execution'] is False and
            packet['authorized_commands_to_execute'] == [], 'Execution is forbidden')
    require(packet['application_main_commit'] == MAIN and
            packet['source']['source_commit'] == SNAPSHOT, 'Source binding changed')
    source = packet['source']
    actual_tree = subprocess.check_output(
        ['git', 'rev-parse', SNAPSHOT + '^{tree}'], cwd=ROOT, text=True).strip()
    require(source['source_tree'] == actual_tree, 'Source tree changed')
    trusted = archive_files(subprocess.check_output(
        ['git', 'archive', '--format=tar', SNAPSHOT], cwd=ROOT))
    source_bytes = repo_file(source['source_archive']).read_bytes()
    require(digest(source_bytes) == source['source_archive_sha256'],
            'Source archive digest mismatch')
    archived = archive_files(source_bytes)
    require(archived == trusted, 'Source archive differs from frozen Git tree')
    expected_pins = {p: digest(b) for p, b in trusted.items() if not p.startswith('docs/')}
    require(source['non_document_pins'] == expected_pins, 'Source pin set changed')
    for path, expected in expected_pins.items():
        require(digest(repo_file(path).read_bytes()) == expected,
                'Current source differs from candidate: ' + path)
    require(set(packet['archives']) == {'analysis', 'creation', 'migrations',
                                        'operator_rehearsal'}, 'Archive set changed')
    for name, record in packet['archives'].items():
        data = repo_file(record['archive']).read_bytes()
        require(digest(data) == record['sha256'], 'Archive digest mismatch: ' + name)
        files = archive_files(data)
        require({p: digest(b) for p, b in files.items()} == record['files'],
                'Archive member manifest mismatch: ' + name)
        require(all(p in trusted and trusted[p] == b for p, b in files.items()),
                'Archive source differs from candidate: ' + name)
        if name in ['analysis', 'creation']:
            require(record['entrypoint'] in files and record['config'] in files,
                    'Function entrypoint/config missing')
            for path, body in files.items():
                if not path.endswith(('.ts', '.mjs', '.js')):
                    continue
                imports = re.findall(
                    r'''(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)['"]([^'"]+)''',
                    body.decode(), flags=re.MULTILINE)
                for specifier in imports:
                    if not specifier.startswith('.'):
                        require(specifier == '@supabase/supabase-js',
                                'Undeclared external function import')
                        continue
                    target = (ROOT / path).parent.joinpath(specifier).resolve()
                    require(target.is_relative_to(ROOT), 'Function import leaves source')
                    relative = target.relative_to(ROOT).as_posix()
                    require(relative in files or relative + '.ts' in files,
                            'Missing function dependency: ' + relative)
            checks = record['disabled_startup']
            require(checks['status'] == 'passed' and checks['archive_sha256'] == record['sha256'],
                    'Disabled-start receipt does not bind archive')
            require(checks['external_network_permitted'] is False and
                    checks['provider_credentials_read'] is False and
                    checks['gateway_jwt_verified'] is False and checks['process_stopped'] is True,
                    'Local function qualification scope changed')
    require(len(packet['migrations']) == 14, 'Migration set changed')
    migration_paths = {m['path'] for m in packet['migrations']}
    require(migration_paths == set(packet['archives']['migrations']['files']),
            'Migration archive differs from allowlist')
    for migration in packet['migrations']:
        require(digest(trusted[migration['path']]) == migration['sha256'],
                'Migration source digest mismatch')
    for platform, expected in NATIVE_HASHES.items():
        native = packet['native'][platform]
        accepted_native = json.loads(trusted[
            'docs/tasks/shared-dictionary-cefr/evidence/'
            'D13A.8.4-main-build-review-20261024.json'])['artifacts'][platform]
        require(native == accepted_native, 'Native qualification metadata changed')
        require(native['artifact_sha256'] == expected and
                digest(repo_file(native['artifact']).read_bytes()) == expected,
                'Native artifact digest mismatch')
        require(native['version'] == '2.5.0' and str(native['build']) == '86' and
                native['channel'] == 'production', 'Native configuration changed')
    targets = packet['targets']
    require(targets['expo_account'] == 'oldrefery' and targets['supabase_project_ref'] ==
            'josxavjbcjbcjgulwcyy' and targets['apple_team'] == '7FQ395U52U' and
            targets['expo_project_id'] == 'd968536e-1e9b-4224-9ed7-a1e9c6d821c8' and
            targets['asc_app_id'] == '6752469146' and targets['web_domain'] == 'woordenaar.app' and
            targets['ios_bundle'] == 'com.oldrefery.dutch-learning-app' and
            targets['android_package'] == 'com.oldrefery.dutchlearningapp', 'Wrong target')
    require(packet['budget'] == {
        'authorized_requests': 0, 'authorized_nanousd': 0,
        'historical_unknown_retained_nanousd': 560000000,
        'automatic_unknown_redispatch': False,
    }, 'Budget or unknown liability changed')
    holds = packet['execution_holds']
    require(len(holds) == 13 and {h['id'] for h in holds} ==
            {f'R{i:02}' for i in range(1, 14)}, 'Readiness conditions changed')
    for key in ['R03', 'R05', 'R06', 'R07', 'R09', 'R10', 'R12', 'R13']:
        require(next(h for h in holds if h['id'] == key)['status'] == 'open',
                'Unresolved gate falsely closed')
    require(packet['backup_delta_queues']['status'] == 'not_captured' and
            packet['backup_delta_queues']['personal_data_exported'] is False,
            'Unverified backup claim')
    require(packet['device_checks']['ios']['primary_app_touched'] is False and
            packet['device_checks']['android']['original_app_changed'] is False,
            'Unverified device/account claim')
    require(packet['device_checks']['android']['installed'] is True and
            packet['device_checks']['android']['store_delivery_qualified'] is False and
            packet['device_checks']['ios']['store_delivery_qualified'] is False,
            'Unverified store/device qualification claim')
    device_root = 'reports/shared-dictionary-cefr/d13a84-device-release-20261024/'
    require(packet['device_checks']['ios']['diagnostic'] == json.loads(
        repo_file(device_root + 'ios-diagnostic-review.json').read_text()) and
        packet['device_checks']['android']['derived_apk'] == json.loads(
        repo_file(device_root + 'android-isolated-review.json').read_text()),
        'Device receipt binding changed')
    diagnostic_apk = packet['device_checks']['android']['derived_apk']
    require(digest(repo_file(diagnostic_apk['artifact']).read_bytes()) ==
            diagnostic_apk['apk_sha256'], 'Diagnostic APK digest mismatch')
    rollback = packet['rollback']
    require(packet['web']['commit'] == MAIN and packet['web']['status'] == 'READY' and
            packet['web']['deployment'] == 'dpl_FRfe4t8nwMVw1qBNZ36zWwZLEvqj' and
            packet['web']['rollback_target'] == 'dpl_74ZRdMpdPQpbjQADbdRpFxniUKdr' and
            rollback['web_target'] == packet['web']['rollback_target'],
            'Web deployment/rollback binding changed')
    require(rollback['functions']['deployment_allowlist'] ==
            ['dictionary-analysis', 'dictionary-creation'] and
            rollback['functions']['deploy_all'] is False, 'Function rollout scope changed')
    require(rollback['native']['verified_compatible_artifact'] is None and
            rollback['database']['drop_or_reset_authorized'] is False and
            rollback['database']['full_personal_snapshot_restore_authorized'] is False and
            rollback['personal_links']['ceiling'] == 0, 'Unsafe rollback claim')
    symbols = packet['diagnostics']['ios_dsym']
    require(symbols['status'] == 'retained_and_uuid_matched' and
            digest(repo_file(symbols['archive']).read_bytes()) == symbols['sha256'],
            'Diagnostic symbols digest mismatch')
    for path, expected in packet['evidence_files_sha256'].items():
        require(digest(repo_file(path).read_bytes()) == expected, 'Evidence digest mismatch')
    return {'status': 'review_integrity_verified', 'source_files': len(expected_pins),
            'archives': len(packet['archives']), 'native_artifacts': 2,
            'device_qualification_complete': False, 'execution_authorized': False}


def main():
    require(len(sys.argv) in [2, 3], 'Use packet.json [--check-execution]')
    require(len(sys.argv) == 2 or sys.argv[2] == '--check-execution', 'Unknown mode')
    result = verify(json.loads(Path(sys.argv[1]).read_text()))
    if len(sys.argv) == 3:
        print(json.dumps({'status': 'execution_refused', 'authority': 'AUTH-46'}))
        return 2
    print(json.dumps(result))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError, TypeError, tarfile.TarError,
            subprocess.CalledProcessError) as error:
        print('Packet rejected: ' + str(error), file=sys.stderr)
        sys.exit(1)
