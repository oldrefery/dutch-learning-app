"""Verify the exact local version overlay; never authorize builds or execution."""
import hashlib
import json
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BASE = '4bc707372cf9359fc8324d45d5df1965fc044f81'
DELTA = {'apps/mobile/app.base.json', 'apps/mobile/package.json', 'package.json',
         'package-lock.json', 'apps/mobile/src/__tests__/appConfigOta.test.ts'}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def file(name):
    p = Path(name)
    require(not p.is_absolute() and '..' not in p.parts, 'Unsafe path')
    p = ROOT / p
    require(not p.is_symlink() and p.resolve().is_relative_to(ROOT), 'Unsafe input')
    return p


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify(p):
    require(p['scope'] == 'local-version-preparation-only', 'Wrong scope')
    require(p['base_commit'] == BASE, 'Wrong base')
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT,
                                   text=True).strip() == BASE, 'New HEAD needs new packet')
    require(p['authority'] == {'id': 'AUTH-42', 'build': False, 'publish': False,
                              'push': False, 'paid_requests': 0, 'real_links': 0},
            'Authority expanded')
    require(p['ready_for_execution'] is False, 'Execution not authorized')
    require(p['version'] == {'marketing': '2.5.0', 'ios': '86', 'android': 86,
                            'applied': True, 'reserved': False}, 'Wrong version claim')
    require(p['agreement']['free'] == p['agreement']['paid'] == 'Active',
            'Agreement not active')
    require(p['agreement']['accepted_by_agent'] is False, 'Wrong agreement action')
    require(set(p['remaining_holds']) == {f'R{i:02}' for i in range(1, 13)} - {'R11'}
            and len(p['remaining_holds']) == 11, 'Hold removed')
    require(p['unknown_retained_nanousd'] == 560000000, 'Unknown liability changed')
    require(set(p['delta']) == DELTA, 'Wrong source delta')
    require(len(p['source_pins']) == 1513, 'Wrong footprint')
    parent = json.loads(file(p['parent_packet']).read_text())
    require(sha(file(p['parent_packet']).read_bytes()) == p['parent_sha256'],
            'Historical packet changed')
    old = parent['source']['production_test_tool_files_sha256']
    require(set(old) == set(p['source_pins']), 'Source paths changed')
    require({n for n in old if old[n] != p['source_pins'][n]} == DELTA,
            'Unexpected source modification')
    for name, digest in p['source_pins'].items():
        require(sha(file(name).read_bytes()) == digest, 'Source mismatch: ' + name)
    for name, row in p['delta'].items():
        committed = subprocess.check_output(['git', 'show', BASE + ':' + name], cwd=ROOT)
        require(sha(committed) == row['before'] == old[name], 'Wrong base digest')
        require(row['after'] == p['source_pins'][name], 'Wrong delta digest')
    require(sha(file(p['source_archive']).read_bytes()) == p['archive_sha256'],
            'Archive changed')
    with tarfile.open(file(p['source_archive'])) as archive:
        members = archive.getmembers()
        require(len({m.name for m in members}) == len(members), 'Duplicate archive member')
        for m in members:
            path = Path(m.name)
            require(not path.is_absolute() and '..' not in path.parts and
                    (m.isfile() or m.isdir()), 'Unsafe archive member')
        require(sum(m.isfile() for m in members) == 2137, 'Wrong archive count')
        for name, digest in p['source_pins'].items():
            require(sha(archive.extractfile(name).read()) == digest, 'Archive source mismatch')
    config = json.loads(file('apps/mobile/app.base.json').read_text())['expo']
    require(config['version'] == '2.5.0' and config['ios']['buildNumber'] == '86'
            and config['android']['versionCode'] == 86, 'Version file mismatch')
    subprocess.run(['node', 'scripts/prepare-release.js', '--check'], cwd=ROOT,
                   stdout=subprocess.DEVNULL, check=True)
    require(p['checks']['focused_tests'] == 35, 'Missing focused qualification')
    for name, digest in p['evidence_sha256'].items():
        require(sha(file(name).read_bytes()) == digest, 'Evidence mismatch')
    return {'status': 'verified', 'source_files': 1513, 'delta_files': 5,
            'remaining_holds': 11, 'execution_authorized': False}


def main():
    require(len(sys.argv) in [2, 3], 'Use packet.json [--check-execution]')
    require(len(sys.argv) == 2 or sys.argv[2] == '--check-execution', 'Unknown mode')
    result = verify(json.loads(Path(sys.argv[1]).read_text()))
    if len(sys.argv) == 3:
        print(json.dumps({'status': 'execution_refused', 'reason': 'Local preparation only'}))
        return 2
    print(json.dumps(result))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print('Packet rejected: ' + str(error), file=sys.stderr)
        sys.exit(1)
