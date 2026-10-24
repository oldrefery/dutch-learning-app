"""Verify canonical evidence and formatted repository manifests without network access."""
import importlib.util
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[4]
EVIDENCE = Path(__file__).resolve().parent


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(name):
    spec = importlib.util.spec_from_file_location(name, EVIDENCE / name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify():
    session = EVIDENCE / 'D13A.8.4-session-reconciliation-packet-20261024.json'
    replacement = EVIDENCE / 'D13A.8.4-replacement-native-packet-20261024.json'
    canonical_session = session.with_suffix('.raw')
    canonical_replacement = replacement.with_suffix('.raw')
    assert sha(canonical_session) == '739df652de38b99950197fdac2fb614b608f9456592b1e54437c76e3b135ba00'
    assert sha(canonical_replacement) == '0b2aaa539b213880d26a67423bdbaf2b0db8b919f8f3af4b045d989e8d419787'
    assert json.loads(session.read_text()) == json.loads(canonical_session.read_text())
    old = json.loads(canonical_replacement.read_text())
    published = json.loads(replacement.read_text())
    expected = json.loads(canonical_replacement.read_text())
    previous_path = str(session.relative_to(ROOT))
    digest = expected['files_sha256'].pop(previous_path)
    expected['files_sha256'][str(canonical_session.relative_to(ROOT))] = digest
    expected['files_sha256'][str(canonical_replacement.relative_to(ROOT))] = sha(canonical_replacement)
    assert published == expected
    result = {'canonical_manifests_preserved': 2, 'session_json_semantics_identical': True,
              'replacement_changes': 'canonical input relocation and canonical self-copy pin',
              'original_input_pins': len(old['files_sha256']),
              'published_input_pins': len(published['files_sha256'])}
    if '--public-only' not in sys.argv:
        session_verifier = load('D13A.8.4-verify-session-reconciliation-20261024.py')
        result['canonical_session'] = session_verifier.verify(json.loads(canonical_session.read_text()))
        replacement_verifier = load('D13A.8.4-verify-replacement-native-20261024.py')
        result['published_replacement'] = replacement_verifier.verify(published)
        original_local = replacement_verifier.local
        replacement_verifier.local = lambda name: (
            canonical_session if name == previous_path else original_local(name))
        result['canonical_replacement'] = replacement_verifier.verify(old)
    return result


if __name__ == '__main__':
    print(json.dumps(verify(), sort_keys=True))
