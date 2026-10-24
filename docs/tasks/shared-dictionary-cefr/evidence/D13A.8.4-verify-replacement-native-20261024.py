"""Offline replacement-candidate review; no network, credentials or device commands."""
import copy
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[4]
PACKET = Path(__file__).with_name('D13A.8.4-replacement-native-packet-20261024.json')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def local(name):
    path = Path(name)
    require(not path.is_absolute() and '..' not in path.parts, 'Unsafe path')
    result = (ROOT / path).resolve()
    require(result.is_relative_to(ROOT), 'Path outside repository')
    return result


def sha(data):
    return hashlib.sha256(data).hexdigest()


def database(path):
    db = sqlite3.connect('file:' + str(path) + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    return db


def rows(db, table):
    return [dict(row) for row in db.execute('SELECT * FROM "' + table + '" ORDER BY rowid')]


def verify(packet):
    require(packet['status'] == 'LOCAL_QA_PASSED_RELEASE_HELD', 'Release status changed')
    for key in ['publication_authorized', 'publication_performed', 'main_accounts_operated',
                'certificates_changed', 'commits_created', 'paired_performance_accepted']:
        require(packet[key] is False, 'Authority or qualification overstated')
    require(packet['source_uncommitted'] is True and
            packet['authorized_release_commands'] == [], 'Source/release boundary changed')
    require(packet['paid_requests'] == 0 and packet['unknown_reserve_usd'] == '0.56',
            'Budget boundary changed')
    require(packet['counts'] == {'fixed_steps_remaining': 3, 'later_broad_milestones': 6},
            'Stage acceptance overstated')
    require(packet['regression_tests'] == 127 and packet['ios_passed_cases'] == 8 and
            packet['android_scroll_windows'] == 12, 'Test counts changed')
    for name, digest in packet['files_sha256'].items():
        require(sha(local(name).read_bytes()) == digest, 'Digest mismatch: ' + name)
    base = local(packet['private_root'])
    freeze = json.loads((base / 'source-freeze.json').read_text())
    for name, digest in freeze['source_pins'].items():
        require(sha(local(name).read_bytes()) == digest, 'Source drift: ' + name)
    before = database(base / 'storage-pre-recovery/dutch_learning.db')
    after = database(base / 'storage-post-recovery/dutch_learning.db')
    try:
        tables = [row[0] for row in before.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
        for table in tables:
            if table not in {'words', 'collections'}:
                require(rows(before, table) == rows(after, table), 'Unrelated table changed')
        original = {row['word_id']: row for row in rows(before, 'words')}
        recovered = {row['word_id']: row for row in rows(after, 'words')}
        require(original.keys() == recovered.keys(), 'Recovery changed word identities')
        changed = 0
        for identity, old in original.items():
            new = recovered[identity]
            diff = {key for key in old if old[key] != new[key]}
            require(diff <= {'deleted_at', 'updated_at', 'sync_status'},
                    'Recovery changed learning/content fields')
            if diff:
                changed += 1
                require(old['sync_status'] == 'deleted' and new['sync_status'] == 'synced'
                        and new['deleted_at'] is None, 'Unexpected recovery transition')
        require(changed == 5012, 'Recovery count mismatch')
        require(len(rows(after, 'collections')) - len(rows(before, 'collections')) == 3,
                'Collection recovery count mismatch')
        collections = {row['collection_id']: row for row in rows(after, 'collections')}
        require(all(collections.get(row['collection_id']) == row
                    for row in rows(before, 'collections')), 'Existing collection changed')
    finally:
        before.close()
        after.close()
    original_files = json.loads((base / 'storage-pre-recovery-review.json').read_text())['files']
    recovered_files = json.loads((base / 'storage-post-recovery-review.json').read_text())['files']
    require(all(recovered_files.get(name) == value for name, value in original_files.items()
                if '/mmkv/' in name or name.startswith('shared_prefs/')),
            'Recovery changed encrypted auth storage')
    for label, pending in [('android-offline-pending', 1), ('android-final', 0)]:
        db = database(base / ('storage-' + label) / 'dutch_learning.db')
        try:
            require(db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok',
                    'SQLite integrity failed')
            require(db.execute("SELECT count(*) FROM review_events WHERE sync_status<>'synced'")
                    .fetchone()[0] == pending, 'Review queue mismatch')
            require(db.execute("SELECT count(*) FROM words WHERE sync_status='deleted'")
                    .fetchone()[0] == 0, 'Deletion queue is not empty')
            require(db.execute('SELECT count(*) FROM words WHERE deleted_at IS NULL')
                    .fetchone()[0] == 5024, 'Active word count mismatch')
        finally:
            db.close()
    boundaries = [('before-offline', 8), ('ios-offline', 8), ('ios-final', 9),
                  ('android-offline-restart', 9), ('android-reconnected', 10),
                  ('android-repeat-sync', 10), ('final', 10)]
    for name, total in boundaries:
        data = json.loads((base / ('server-' + name + '-review.json')).read_text())
        require(data['total_events'] == total and data['original_events_preserved'] == 8
                and data['active_words'] == 5028 and data['deleted_words'] == 2,
                'Server boundary mismatch')
    cleanup = json.loads((base / 'cleanup.json').read_text())
    require(cleanup['android_qa_stopped'] and cleanup['relay_ports_closed'] and
            cleanup['android_reverse_removed'] and len(cleanup['qa_containers']) == 4 and
            all(value == 'exited' for value in cleanup['qa_containers'].values()) and
            cleanup['containers_or_volumes_removed'] is False, 'QA cleanup incomplete')
    supplement = packet['supplement']
    require(sha(local(supplement['path']).read_bytes()) == supplement['sha256'],
            'Supplement changed')
    seen = set()
    with tarfile.open(local(supplement['path']), 'r:gz') as archive:
        for member in archive:
            name = member.name
            require(member.isfile() and name not in seen and not Path(name).is_absolute()
                    and '..' not in Path(name).parts and '\\' not in name, 'Unsafe archive')
            require(name in supplement['members_sha256'] and
                    sha(archive.extractfile(member).read()) ==
                    supplement['members_sha256'][name], 'Archive member changed')
            seen.add(name)
    require(seen == set(supplement['members_sha256']), 'Missing archive member')
    return {'status': 'passed', 'pins': len(packet['files_sha256']),
            'source_files': len(freeze['source_pins']), 'members': len(seen),
            'reviewed_recovery_rows': 5012, 'publication_authorized': False}


if __name__ == '__main__':
    packet = json.loads(PACKET.read_text())
    result = verify(packet)
    if '--self-test' in sys.argv:
        mutations = [('status', 'GO'), ('publication_authorized', True),
                     ('publication_performed', True), ('main_accounts_operated', True),
                     ('certificates_changed', True), ('commits_created', True),
                     ('paired_performance_accepted', True), ('source_uncommitted', False),
                     ('authorized_release_commands', ['submit']), ('paid_requests', 1),
                     ('unknown_reserve_usd', '0'), ('regression_tests', 128),
                     ('ios_passed_cases', 9), ('android_scroll_windows', 13)]
        for key, value in mutations:
            altered = copy.deepcopy(packet)
            altered[key] = value
            try:
                verify(altered)
            except ValueError:
                continue
            raise AssertionError('Tamper accepted: ' + key)
        result['tamper_checks'] = len(mutations)
    print(json.dumps(result, sort_keys=True))
