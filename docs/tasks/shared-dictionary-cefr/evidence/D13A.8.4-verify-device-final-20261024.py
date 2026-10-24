"""Verify the NO-GO device review offline; never execute a release or device action."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[4]
PACKET = Path(__file__).with_name('D13A.8.4-device-final-packet-20261024.json')


def require(value, message):
    if not value:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def local(name):
    p = Path(name)
    require(not p.is_absolute() and '..' not in p.parts and '\\' not in name,
            'Unsafe path')
    p = ROOT / p
    require(not p.is_symlink() and p.resolve().is_relative_to(ROOT) and p.is_file(),
            'Missing or unsafe input')
    return p


def verify(p):
    require(p['schema_version'] == 1 and p['status'] == 'NO_GO', 'Release hold lost')
    require(p['execution_authorized'] is False and p['authorized_commands_to_execute'] == [],
            'Execution is forbidden')
    require(p['source_fix_in_original_signed_artifacts'] is False,
            'Source fix was not shipped')
    require(p['findings_open'] == ['NDS-1', 'ARS-1'], 'Findings hidden')
    require(p['counts'] == {'fixed_stage_steps_remaining': 3, 'later_broad_milestones': 6},
            'Stage count changed')
    require(p['paid_requests'] == 0 and p['main_accounts_operated'] is False,
            'Scope changed')
    require(p['unknown_reserve_usd'] == '0.56', 'Unknown liability lost')
    for name, expected in p['files_sha256'].items():
        require(sha(local(name).read_bytes()) == expected, 'Input digest changed: ' + name)
    require(p['artifacts']['ios']['sha256'] ==
            '0b38868515c1cc9124e8609573e4de4e71f48316cfb495fcb9926a9ad2411bb6',
            'Original IPA changed')
    require(p['artifacts']['android']['sha256'] ==
            'd3567c02c740a2db4992978ee7abbf9c30a9979ad734ea94bb24810ea44e465f',
            'Original AAB changed')
    for item in p['artifacts'].values():
        require(sha(local(item['path']).read_bytes()) == item['sha256'], 'Native digest mismatch')
    ios = json.loads(local(p['ios_results']).read_text())
    require(sum(x['passed'] for x in ios) == 8 and sum(x['failed'] for x in ios) == 3,
            'Physical attempts misrepresented')
    android = json.loads(local(p['android_results']).read_text())
    require(android['scroll_steps_passed'] == 12 and android['last_word_search_passed'] is True,
            '5000-word evidence missing')
    require(android['offline_queue_and_once_only_sync'] ==
            'blocked_by_restart_session_precondition', 'Android acceptance fabricated')
    cleanup = json.loads(local(p['cleanup']).read_text())
    require(cleanup['owned_qa_containers_stopped'] == 4 and cleanup['qa_ports_closed'] and
            cleanup['data_logs_preserved'] and not cleanup['containers_or_volumes_removed'],
            'Cleanup or data preservation mismatch')
    require(p['regression_tests_passed'] == 123 and p['performance_matrix_accepted'] is False,
            'Qualification overstated')
    bundle = p['supplement']
    archive = local(bundle['path'])
    require(sha(archive.read_bytes()) == bundle['sha256'], 'Supplement digest mismatch')
    seen = set()
    with tarfile.open(archive, 'r:gz') as f:
        for m in f:
            require(m.isfile() and m.name not in seen and not m.name.startswith('/') and
                    '..' not in Path(m.name).parts and '\\' not in m.name, 'Unsafe archive')
            require(m.name in bundle['members_sha256'], 'Unlisted archive member')
            require(sha(f.extractfile(m).read()) == bundle['members_sha256'][m.name],
                    'Archive member digest mismatch')
            seen.add(m.name)
    require(seen == set(bundle['members_sha256']), 'Missing archive member')
    return {'status': 'passed', 'files': len(p['files_sha256']),
            'archive_members': len(seen), 'release_authorized': False}


if __name__ == '__main__':
    packet = json.loads(PACKET.read_text())
    result = verify(packet)
    if '--self-test' in sys.argv:
        mutations = [
            ('status', 'GO'), ('execution_authorized', True),
            ('source_fix_in_original_signed_artifacts', True), ('findings_open', []),
            ('paid_requests', 1), ('unknown_reserve_usd', '0'),
            ('main_accounts_operated', True), ('performance_matrix_accepted', True),
            ('regression_tests_passed', 124), ('authorized_commands_to_execute', ['deploy']),
        ]
        for key, value in mutations:
            changed = copy.deepcopy(packet)
            changed[key] = value
            try:
                verify(changed)
            except ValueError:
                continue
            raise AssertionError('Tamper accepted: ' + key)
        result['tamper_checks_passed'] = len(mutations)
    print(json.dumps(result, sort_keys=True))
