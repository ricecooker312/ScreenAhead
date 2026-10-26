"""Tests for clinical_review.py. Run: python3 -m unittest discover tools"""
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import clinical_review as cr  # noqa: E402

SAMPLE = {
    "exportedAt": "2026-10-26T00:00:00Z",
    "rulesetVersion": "test.1",
    "questionnaireVersion": "1.0.0",
    "rules": [
        {"id": "E-1", "level": "emergency", "timeframe": "now", "title": "Breathing", "message": "Call 911", "explanation": "Hard to breathe"},
        {"id": "P-1", "level": "prompt", "timeframe": "soon", "title": "Bleeding", "message": "See a doctor", "explanation": "Blood", "specialty": "gastroenterology"},
    ],
    "disclaimers": ["Not a diagnosis."],
    "safetyChecks": {"medication": ["No doses."]},
    "questionnaire": {
        "version": "1.0.0",
        "sections": [
            {
                "id": "s1",
                "title": "Safety",
                "intro": "",
                "questions": [
                    {"id": "q1", "type": "single", "label": "Breathing?", "safetyCritical": True, "required": True, "options": [{"value": "a", "label": "Normal"}]},
                    {"id": "q2", "type": "text", "label": "More?", "showIf": {"all": [{"q": "q1", "eq": "a"}, {"not": {"q": "q3", "answered": True}}]}},
                ],
            }
        ],
    },
    "resources": [{"slug": "r1", "title": "Screening", "summary": "", "source": {"name": "CDC", "url": "https://www.cdc.gov/"}}],
}


class ClinicalReviewTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.export = self.tmp / "export.json"
        self.export.write_text(json.dumps(SAMPLE))

    def test_writes_all_outputs(self):
        out = self.tmp / "out"
        self.assertEqual(cr.main([str(self.export), "--out", str(out)]), 0)
        for name in ("review-packet.md", "rules.csv", "questions.csv", "resources.csv"):
            self.assertTrue((out / name).exists(), name)
        with (out / "rules.csv").open() as f:
            rows = list(csv.DictReader(f))
        self.assertEqual([r["rule_id"] for r in rows], ["E-1", "P-1"])
        self.assertIn("reviewer_name", rows[0])
        md = (out / "review-packet.md").read_text()
        self.assertIn("E-1 — Breathing", md)
        self.assertIn("test.1", md)

    def test_condition_text(self):
        text = cr.condition_text(SAMPLE["questionnaire"]["sections"][0]["questions"][1]["showIf"])
        self.assertEqual(text, "(q1 is a) AND (NOT (q3 is answered))")
        self.assertEqual(cr.condition_text(None), "always")

    def test_rejects_incomplete_export(self):
        bad = self.tmp / "bad.json"
        bad.write_text(json.dumps({"rules": []}))
        self.assertEqual(cr.main([str(bad), "--out", str(self.tmp / "x")]), 1)


if __name__ == "__main__":
    unittest.main()
