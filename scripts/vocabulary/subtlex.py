"""Read-only SUBTLEX extraction using the Python standard library."""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
HEADERS = [
    "Word", "FREQcount", "CDcount", "FREQlow", "CDlow", "FREQlemma",
    "SUBTLEXWF", "Zipf", "SUBTLEXCD", "Lg10CD", "dominant.pos",
    "dominant.pos.freq", "dominant.pos.lemma", "dominant.pos.lemma.freq",
    "all.pos", "all.pos.freq", "all.pos.lemma.freq",
]
POS = dict(noun="N", verb="WW", adjective="ADJ", adverb="BW",
           pronoun="VNW", preposition="VZ", conjunction="VG",
           interjection="TSW", numeral="TW", article="LID")


def normalize(value):
    return " ".join(unicodedata.normalize("NFC", value).lower().split())


def rows(archive):
    """Stream worksheet rows; retain shared strings, not the full worksheet."""
    strings = []
    with archive.open("xl/sharedStrings.xml") as stream:
        for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag == NS + "si":
                strings.append("".join(t.text or "" for t in element.iter(NS + "t")))
                element.clear()
    with archive.open("xl/worksheets/sheet1.xml") as stream:
        for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != NS + "row":
                continue
            values = {}
            for cell in element:
                column = "".join(c for c in cell.attrib["r"] if c.isalpha())
                value = cell.findtext(NS + "v")
                if cell.attrib.get("t") == "s":
                    value = strings[int(value)]
                # Preserve Excel error tokens; selected numeric rows reject them.
                values[column] = value
            yield int(element.attrib["r"]), [values.get(chr(65 + i)) for i in range(17)]
            element.clear()


def number(value):
    result = float(value)
    if not math.isfinite(result) or result < 0:
        raise ValueError("Invalid nonnegative frequency")
    return result


def source_record(values, row_number):
    record = dict(zip(HEADERS, values, strict=True))
    for field in HEADERS[1:10] + ["dominant.pos.freq", "dominant.pos.lemma.freq"]:
        record[field] = number(record[field])
    expected = math.log10((record["FREQcount"] + 1) / 44.106) + 3
    if not math.isclose(expected, record["Zipf"], abs_tol=1e-8):
        raise ValueError("Cached Zipf does not match the source formula")
    tags = record["all.pos"].strip(".").split(".")
    counts = [number(v) for v in record["all.pos.freq"].strip(".").split(".")]
    if len(tags) != len(counts) or len(set(tags)) != len(tags):
        raise ValueError("Misaligned or duplicate POS frequencies")
    if sum(counts) != record["FREQcount"]:
        raise ValueError("POS counts do not reconcile to the surface frequency")
    record["posSurfaceCounts"] = dict(zip(tags, counts, strict=True))
    record["sourceRow"] = row_number
    return record


def match(card, index):
    records = index.get(normalize(card["lemma"]), [])
    tag = POS.get(normalize(card["partOfSpeech"]))
    compatible = [r for r in records if tag in r["posSurfaceCounts"]]
    return {
        "wordId": card["wordId"], "inputHash": card["inputHash"],
        "matchType": ("surface-and-pos" if compatible else
                      "surface-only-review-required" if records else "missing"),
        "senseVerified": False,
        "posTag": tag,
        "records": records,
        "rankingScore": None,
    }


def private_path(value, output=False):
    root = Path(__file__).resolve().parents[2] / "reports/vocabulary-organization"
    path = Path(value).absolute()
    resolved = path.parent.resolve() / path.name if output else path.resolve()
    if root.resolve() != root or not resolved.is_relative_to(root) or resolved == root:
        raise ValueError("Use paths inside the private analysis directory")
    return resolved


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source", "evidence", "output"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    source = private_path(args.source)
    evidence_path = private_path(args.evidence)
    output = private_path(args.output, output=True)
    evidence_bytes = evidence_path.read_bytes()
    evidence = json.loads(evidence_bytes)
    cards = [c for c in evidence["cards"] if c["disposition"] != "protected-collection"]
    wanted = {normalize(c["lemma"]) for c in cards}
    index = {}
    scanned = 0
    with zipfile.ZipFile(source) as archive:
        iterator = rows(archive)
        if next(iterator)[1] != HEADERS:
            raise ValueError("Unexpected SUBTLEX headers")
        for row_number, values in iterator:
            scanned += 1
            key = normalize(values[0])
            if key in wanted:
                index.setdefault(key, []).append(source_record(values, row_number))
    results = [match(card, index) for card in cards]
    counts = {}
    for result in results:
        counts[result["matchType"]] = counts.get(result["matchType"], 0) + 1
    with source.open("rb") as stream:
        source_hash = hashlib.file_digest(stream, "sha256").hexdigest()
    report = {
        "schemaVersion": 1, "methodVersion": "subtlex-surface-evidence-v1",
        "source": {"sha256": source_hash, "url": "https://osf.io/3d8cx/files/2dcvs",
                   "attribution": "Keuleers, Brysbaert and New (2010), SUBTLEX-NL",
                   "license": "CC BY-NC-SA 4.0; private analysis only"},
        "inputEvidenceSha256": hashlib.sha256(evidence_bytes).hexdigest(),
        "snapshotSha256": evidence["snapshotSha256"],
        "summary": {"scannedSourceRows": scanned, "cards": len(cards),
                    "matches": counts, "productionWrites": 0},
        "cards": results,
    }
    # Exclusive creation prevents replacing prior decisions or following symlinks.
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
