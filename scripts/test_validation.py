"""Check the preserved 1.2.4 development run against its versioned downloads."""
import hashlib
import json
from pathlib import Path
import unittest

HISTORICAL_VERSION = "1.2.4"

ROOT = Path(__file__).resolve().parents[1]


class RecordedRun(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = json.loads((ROOT / 'references' / f'validation-{HISTORICAL_VERSION}.json').read_text(encoding='utf-8'))

    def test_recorded_instructions_match_their_historical_release(self):
        self.assertEqual(self.report['instruction_version'], HISTORICAL_VERSION)
        conditions = set()
        for run in self.report['runs']:
            language = run['instruction_language']
            edition = run['edition']
            prefix = {'full': 'core', 'medium': '5000', 'compact': 'compact'}[edition]
            text = (ROOT / 'downloads' / HISTORICAL_VERSION /
                    f'beforeword_{prefix}_{language.upper()}.txt').read_text(encoding='utf-8')
            self.assertEqual(run['instruction_text'], text)
            self.assertEqual(run['sha256'], hashlib.sha256(text.encode('utf-8')).hexdigest())
            self.assertEqual(run['characters'], len(text))
            conditions.add((edition, language))
        self.assertEqual(conditions, {(edition, language) for edition in ('full', 'medium', 'compact') for language in ('ru', 'en')})

    def test_requests_responses_and_review_excerpts_are_preserved(self):
        cases = {case['id']: case for case in self.report['cases']}
        total = 0
        for run in self.report['runs']:
            self.assertEqual([row['case_id'] for row in run['responses']], list(cases))
            for row in run['responses']:
                total += 1
                case = cases[row['case_id']]
                self.assertEqual(row['request'], case['message'])
                self.assertIsInstance(row['response'], str)
                self.assertEqual(len(row['review']['criteria']), len(case['rubric']))
                for criterion in row['review']['criteria']:
                    self.assertIn(criterion['rating'], ('met', 'not_met', 'unclear'))
                    self.assertIn(criterion.get('excerpt', ''), row['response'])
                if 'expected_exact' in case:
                    self.assertEqual(row['response'], case['expected_exact'])
                if 'expected_json' in case:
                    self.assertEqual(json.loads(row['response']), case['expected_json'])
        self.assertEqual(total, self.report['method']['response_count'])
        self.assertEqual(total, 72)


if __name__ == '__main__':
    unittest.main()
