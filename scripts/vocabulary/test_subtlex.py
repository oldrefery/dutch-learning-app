"""Synthetic frequency evidence tests; no application accounts or real corpus."""

import io
import math
import unittest
import zipfile

from subtlex import HEADERS, match, normalize, private_path, rows, source_record


def fixture(count=10):
    return ["voorbeeld", str(count), "2", "8", "2", "40", "0.2",
            str(math.log10((count + 1) / 44.106) + 3), "0.1", "0.3",
            "N", str(count), "voorbeeld", "40", ".N.", f".{count}.", ".40."]


class FrequencyTests(unittest.TestCase):
    def test_source_values_are_not_aggregated(self):
        record = source_record(fixture(), 42)
        self.assertEqual(record["FREQcount"], 10)
        self.assertEqual(record["FREQlemma"], 40)
        self.assertEqual(record["posSurfaceCounts"], {"N": 10})
        self.assertEqual(record["sourceRow"], 42)

    def test_zero_is_distinct_from_missing(self):
        card = dict(wordId="synthetic", inputHash="hash", lemma="voorbeeld", partOfSpeech="noun")
        record = source_record(fixture(0), 2)
        self.assertEqual(match(card, {"voorbeeld": [record]})["matchType"], "surface-and-pos")
        missing = match(card, {})
        self.assertEqual(missing["matchType"], "missing")
        self.assertEqual(missing["records"], [])
        self.assertIsNone(missing["rankingScore"])

    def test_pos_mismatch_is_not_verified(self):
        card = dict(wordId="synthetic", inputHash="hash", lemma="voorbeeld", partOfSpeech="verb")
        result = match(card, {"voorbeeld": [source_record(fixture(), 2)]})
        self.assertEqual(result["matchType"], "surface-only-review-required")
        self.assertFalse(result["senseVerified"])

    def test_does_not_strip_reflexive_or_stem(self):
        index = {"voorbeeld": [source_record(fixture(), 2)]}
        for lemma in ("voorbeelden", "zich voorbeeld"):
            card = dict(wordId="synthetic", inputHash="hash", lemma=lemma, partOfSpeech="noun")
            self.assertEqual(match(card, index)["matchType"], "missing")
        self.assertEqual(normalize("  VOORBEELD "), "voorbeeld")
        self.assertNotEqual(normalize("café"), normalize("cafe"))

    def test_invalid_counts_and_cached_formula_fail(self):
        for field, value in ((1, "-1"), (1, "NaN"), (7, "3"), (7, "#VALUE!"),
                             (14, ".N.N."), (15, ".9.")):
            with self.subTest(field=field, value=value):
                values = fixture()
                values[field] = value
                with self.assertRaises(ValueError):
                    source_record(values, 2)

    def test_duplicate_surface_rows_are_preserved_not_summed(self):
        records = [source_record(fixture(), 2), source_record(fixture(), 3)]
        card = dict(wordId="synthetic", inputHash="hash", lemma="voorbeeld", partOfSpeech="noun")
        result = match(card, {"voorbeeld": records})
        self.assertEqual(len(result["records"]), 2)
        self.assertIsNone(result["rankingScore"])

    def test_private_output_guard(self):
        with self.assertRaises(ValueError):
            private_path("/tmp/public-frequency.json", output=True)

    def test_stream_preserves_missing_columns_and_cached_values(self):
        buffer = io.BytesIO()
        namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("xl/sharedStrings.xml", f'<sst xmlns="{namespace}"><si><t>Word</t></si></sst>')
            archive.writestr("xl/worksheets/sheet1.xml", f'''<worksheet xmlns="{namespace}"><sheetData>
              <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><f>1+1</f><v>2</v></c></row>
              </sheetData></worksheet>''')
        buffer.seek(0)
        with zipfile.ZipFile(buffer) as archive:
            result = list(rows(archive))
        self.assertEqual(result[0][1][:3], ["Word", None, "2"])
        self.assertEqual(len(result[0][1]), len(HEADERS))


if __name__ == "__main__":
    unittest.main()
