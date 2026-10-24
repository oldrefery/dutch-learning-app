"""Offline integrity and release-boundary verification; never prints private values."""
import copy
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[4]
PACKET = Path(__file__).with_name('D13A.8.4-session-reconciliation-packet-20261024.json')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def local(name):
    p = Path(name)
    require(not p.is_absolute() and '..' not in p.parts, 'Unsafe file path')
    target = (ROOT / p).resolve()
    require(target.is_relative_to(ROOT), 'File outside repository')
    return target


def sha(data):
    return hashlib.sha256(data).hexdigest()


def check_archive(bundle):
    archive = local(bundle['path'])
    require(sha(archive.read_bytes()) == bundle['sha256'], 'Archive digest mismatch')
    seen = set()
    with tarfile.open(archive, 'r:gz') as stream:
        for member in stream:
            name = member.name
            require(member.isfile() and name not in seen and
                    not Path(name).is_absolute() and '..' not in Path(name).parts and
                    '\\' not in name, 'Unsafe archive member')
            require(name in bundle['members_sha256'], 'Unlisted archive member')
            require(sha(stream.extractfile(member).read()) ==
                    bundle['members_sha256'][name], 'Member digest mismatch')
            seen.add(name)
    require(seen == set(bundle['members_sha256']), 'Missing archive members')
    return len(seen)


def verify(packet):
    require(packet['status'] == 'NO_GO', 'Release hold removed')
    for field in ['execution_authorized', 'main_accounts_operated',
                  'source_fix_in_signed_artifacts', 'native_application_compiled']:
        require(packet[field] is False, 'Authority or qualification overstated')
    require(packet['authorized_commands_to_execute'] == [], 'Execution commands added')
    require(packet['paid_requests'] == 0 and packet['unknown_reserve_usd'] == '0.56',
            'Budget boundary changed')
    require(packet['regression_tests_passed'] == 127, 'Regression count changed')
    require(packet['findings_open'] == ['NDS-1', 'NDS-2'], 'Source holds changed')
    require(packet['pending_word_deletions'] == 5012 and
            packet['android_offline_reconnect_accepted'] is False,
            'Device queue or acceptance misstated')
    for name, digest in packet['files_sha256'].items():
        require(sha(local(name).read_bytes()) == digest, 'Input digest mismatch: ' + name)
    prior = json.loads(local(packet['prior_packet']['path']).read_text())
    require(sha(local(packet['prior_packet']['path']).read_bytes()) ==
            packet['prior_packet']['sha256'], 'Prior packet changed')
    expected = {'apps/mobile/src/services/syncManager.ts',
                'apps/mobile/src/services/__tests__/syncManager.test.ts'}
    drift = set()
    for name, digest in prior['files_sha256'].items():
        if sha(local(name).read_bytes()) != digest:
            drift.add(name)
    require(drift == expected, 'Unexpected prior input drift')
    prior_members = check_archive(prior['supplement'])
    base = local(packet['private_root'])
    queue = json.loads((base / 'queue-boundary.json').read_text())
    require(queue['pending_word_deletions'] == 5012 and queue['dispatch_prohibited']
            and queue['restore_or_replay_performed'] is False, 'Unsafe queue state')
    with tempfile.TemporaryDirectory(prefix='qa-queue-verify-') as directory:
        with tarfile.open(base / 'storage-diagnostic-final/qa-data.tar') as backup:
            for member in backup:
                if member.isfile() and Path(member.name).name in {
                    'dutch_learning.db', 'dutch_learning.db-wal', 'dutch_learning.db-shm'
                }:
                    (Path(directory) / Path(member.name).name).write_bytes(
                        backup.extractfile(member).read())
        db = sqlite3.connect('file:' + str(Path(directory) / 'dutch_learning.db') +
                             '?mode=ro', uri=True)
        try:
            require(db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok',
                    'QA SQLite integrity failed')
            require(db.execute("SELECT count(*) FROM words WHERE sync_status='deleted'")
                    .fetchone()[0] == 5012, 'QA SQLite queue count mismatch')
            require(db.execute('SELECT count(*) FROM words').fetchone()[0] == 5014,
                    'QA SQLite word count mismatch')
        finally:
            db.close()
    cleanup = json.loads((base / 'resource-final-state.json').read_text())
    require(cleanup['ports_55341_55342_closed'] and cleanup['relay_stopped'] and
            len(cleanup['containers']) == 4 and
            all(value == 'exited' for value in cleanup['containers'].values()) and
            cleanup['containers_or_volumes_removed'] is False, 'QA cleanup incomplete')
    restored = json.loads((base / 'android-restoration.json').read_text())
    require(restored['qa_stopped'] and restored['plain_qa_apk_restored'] and
            restored['android_reverse_55342_absent'] and
            restored['data_clear_or_uninstall_performed'] is False, 'QA restore incomplete')
    return {'status': 'passed', 'input_pins': len(packet['files_sha256']),
            'supplement_members': check_archive(packet['supplement']),
            'prior_archive_members': prior_members, 'expected_prior_source_drift': 2,
            'release_authorized': False}


if __name__ == '__main__':
    p = json.loads(PACKET.read_text())
    result = verify(p)
    if '--self-test' in sys.argv:
        changes = [('status', 'GO'), ('execution_authorized', True),
                   ('main_accounts_operated', True), ('source_fix_in_signed_artifacts', True),
                   ('pending_word_deletions', 0), ('findings_open', []),
                   ('android_offline_reconnect_accepted', True), ('paid_requests', 1),
                   ('unknown_reserve_usd', '0'), ('regression_tests_passed', 128),
                   ('authorized_commands_to_execute', ['deploy'])]
        for field, value in changes:
            altered = copy.deepcopy(p)
            altered[field] = value
            try:
                verify(altered)
            except ValueError:
                continue
            raise AssertionError('Tamper accepted: ' + field)
        result['tamper_checks_passed'] = len(changes)
    print(json.dumps(result, sort_keys=True))
