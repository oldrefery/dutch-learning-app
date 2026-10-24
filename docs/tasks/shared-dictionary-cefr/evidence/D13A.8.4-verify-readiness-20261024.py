"""Verify local release-readiness evidence offline; never execute production work."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BASE = '665722a50bd0d1be91db1c9d3e7131653cf097042762cee997450530dcf73c6e'
DIAGNOSTICS = 'ef3c187d3ed1d0ed00cab8120c6dfce58dea8110e83b83c37eef91650c6ccc6d'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file(name):
    path = Path(name)
    require(not path.is_absolute() and '..' not in path.parts, 'Unsafe input path')
    result = ROOT / path
    require(not result.is_symlink() and result.is_file() and
            str(result.resolve()).startswith(str(ROOT) + '/'), 'Unsafe/missing input')
    return result


def verify(packet, execute=False):
    require(packet['schema_version'] == 1 and packet['packet_type'] ==
            'D13A.8.4-local-readiness-review', 'Wrong packet scope')
    require(packet['authority'] == {
        'local_preparation': True, 'publication': False, 'production_writes': False,
        'personal_rows_read': False, 'paid_requests': 0, 'real_links': 0,
    }, 'Authority exceeds preparation')
    require(packet['ready_for_execution'] is False and
            packet['authorized_commands'] == [], 'Execution is forbidden')
    require(packet['base_packet']['sha256'] == BASE and
            packet['diagnostics_packet']['sha256'] == DIAGNOSTICS, 'Prior packet replaced')
    for label in ['base_packet', 'diagnostics_packet']:
        record = packet[label]
        require(digest(file(record['path']).read_bytes()) == record['sha256'],
                'Prior packet hash mismatch')
    for name, expected in packet['files_sha256'].items():
        require(digest(file(name).read_bytes()) == expected, 'Evidence changed: ' + name)
    check = subprocess.run([
        '/Users/devrush/.nvm/versions/node/v24.20.0/bin/node',
        str(ROOT / 'docs/tasks/shared-dictionary-cefr/evidence/D13A.8.4-verify-diagnostics-20261024.cjs'),
        str(file(packet['diagnostics_packet']['path'])),
    ], cwd=ROOT, capture_output=True, text=True)
    require(check.returncode == 0, 'Base/native/map integrity gate failed')
    base = json.loads(file(packet['base_packet']['path']).read_text())
    rehearsal = json.loads(file(packet['rehearsal_receipt']).read_text())
    require(rehearsal['status'] == 'passed' and rehearsal['synthetic_only'] is True and
            rehearsal['production_writes'] is False and rehearsal['provider_calls'] == 0
            and rehearsal['real_link_ceiling'] == 0 and rehearsal['owned_container_stopped']
            is True and rehearsal['server_version'] == '17.6', 'Wrong rehearsal boundary')
    require(len(rehearsal['checks']) == 12 and all(c['status'] == 'passed' for c in
            rehearsal['checks']), 'Incomplete rehearsal')
    require([(m['path'], m['sha256']) for m in rehearsal['migrations']] ==
            [(m['path'], m['sha256']) for m in base['migrations']], 'Wrong rehearsal migration set')
    require(rehearsal['synthetic_backup']['production_backup'] is False,
            'Synthetic backup relabeled')
    require(digest(file(packet['synthetic_dump']).read_bytes()) ==
            rehearsal['synthetic_backup']['sha256'], 'Synthetic backup changed')
    log = file(packet['database_test_log']).read_text()
    require('tests 126' in log and 'pass 126' in log and 'fail 0' in log and
            'skipped 0' in log, 'Focused database gate did not pass')
    require(packet['production_backup'] == {'status': 'not_captured',
            'restore_verified': False, 'live_delta_verified': False,
            'cohort_queues_verified': False}, 'False live backup claim')
    require(packet['native_full_qualification'] is False and
            packet['native_compatible_rollback'] is False, 'False native qualification')
    require(packet['next_approval']['id'] == 'B01' and
            packet['next_approval']['authorized'] is False and
            packet['next_approval']['production_writes'] is False,
            'Next proposal became an authority')
    require(packet['budget'] == {'new_provider_requests': 0, 'unknown_held_usd': '0.56'},
            'Budget/unknown reserve changed')
    require(packet['remaining'] == {'stage_complete': 3, 'stage_total': 6,
            'stage_steps_remaining': 3, 'other_major_milestones': 6}, 'Stage overstated')
    require(not execute, 'Execution is forbidden')
    return {'status': 'local_readiness_integrity_verified', 'database_tests': 126,
            'synthetic_rehearsal_checks': 12, 'production_backup_verified': False,
            'execution_authorized': False}


if __name__ == '__main__':
    try:
        print(json.dumps(verify(json.loads(Path(sys.argv[1]).read_text()),
                                '--check-execution' in sys.argv), indent=2))
    except (ValueError, KeyError, OSError) as error:
        print('Verification refused: ' + str(error), file=sys.stderr)
        sys.exit(2)
