"""Deterministic dictionary tests; recorded Wikimedia responses, no live requests."""

import json
import hashlib
from pathlib import Path
import unittest
from unittest.mock import patch

from dictionary import NoRedirects, lookup_dictionary, parse_response, validate_query

ROOT = Path(__file__).resolve().parent


def fixture(name):
    return json.loads((ROOT / "fixtures" / f"{name}.json").read_text(encoding="utf-8"))


def record(html, title="word", revision=42):
    return {"parse": {"text": '<div class="mw-parser-output">' + html + '</div>', "title": title, "revid": revision}}


class DictionaryTests(unittest.TestCase):
    def test_shared_browser_mcp_golden_contract(self):
        contract = json.loads((ROOT / "dictionary-fixture-contract.json").read_text())
        for name, expected in contract["cases"].items():
            with self.subTest(name=name):
                data = (ROOT / "fixtures" / name).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), expected["fixture_sha256"])
                language, word = Path(name).stem.split("-", 1)
                result = parse_response(json.loads(data), word, language)
                canonical = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
                self.assertEqual(hashlib.sha256(canonical).hexdigest(), expected["result_sha256"])

    def test_native_language_sections_and_senses(self):
        for name, entry_count, sense_count in [
            ("en-if", 2, 11), ("en-I", 5, 9), ("en-bank", 7, 42),
            ("en-dogs", 3, 6), ("ru-я", 2, 7), ("ru-если", 2, 5),
            ("ru-условие", 1, 7), ("ru-словами", 1, 1), ("ru-жизни", 2, 2),
        ]:
            with self.subTest(name=name):
                language, word = name.split("-", 1)
                payload = fixture(name)
                result = parse_response(payload, word, language)
                self.assertEqual(result["status"], "found")
                self.assertEqual(len(result["entries"]), entry_count)
                senses = [s for e in result["entries"] for s in e["senses"]]
                self.assertEqual(len(senses), sense_count)
                self.assertEqual(len({s["id"] for s in senses}), sense_count)
                self.assertEqual(result["query"], word)
                self.assertEqual(result["source"]["revision"], payload["parse"]["revid"])
                self.assertEqual(result["source"]["license"], "CC BY-SA 4.0")

    def test_closed_class_words_have_definitions(self):
        result = parse_response(fixture("ru-я"), "я", "ru")
        pronoun = next(e for e in result["entries"] if "местоимение" in e["pos"])
        self.assertTrue(pronoun["senses"])
        result = parse_response(fixture("en-if"), "if", "en")
        first = result["entries"][0]["senses"][0]
        self.assertEqual(first["glosses"], ["Supposing that, assuming that, in the circumstances that; suppositive used to introduce a condition that may be (or prove to be) either true or false."])
        self.assertEqual(result["entries"][0]["senses"][1]["glosses"][0], first["glosses"][0])

    def test_source_inflection_links_without_stemming(self):
        en = parse_response(fixture("en-dogs"), "dogs", "en")
        self.assertEqual(en["entries"][0]["senses"][0]["formOf"], ["dog"])
        ru = parse_response(fixture("ru-словами"), "словами", "ru")
        self.assertEqual(ru["entries"][0]["senses"][0]["formOf"], ["слово"])
        self.assertEqual(ru["lookup"], "словами")
        self.assertEqual(ru["transformations"], [])

    def test_keeps_unicode_and_written_content_removes_examples(self):
        html = '<h2 id="English">English</h2><h3 id="Noun">Noun</h3><ol><li>A&nbsp;B “C” é\nD.<dl><dd>EXAMPLE</dd></dl><script>INJECTION</script><sup class="reference">7</sup></li></ol><h2>French</h2><h3>Noun</h3><ol><li>OTHER LANGUAGE</li></ol>'
        result = parse_response(record(html), "word", "en")
        senses = result["entries"][0]["senses"]
        self.assertEqual(senses[0]["glosses"], ["A\u00a0B “C” é D."])
        self.assertEqual(len(senses), 1)

    def test_missing_is_not_unsupported_layout(self):
        missing = parse_response({"error": {"code": "missingtitle"}}, "word", "en")
        self.assertEqual(missing["status"], "missing")
        no_language = parse_response(record('<h2>French</h2><h3>Noun</h3><ol><li>definition</li></ol>'), "word", "en")
        self.assertEqual(no_language["status"], "missing")
        with self.assertRaisesRegex(RuntimeError, "UNSUPPORTED"):
            parse_response(record('<h2>English</h2><p>New unhandled layout</p>'), "word", "en")

    def test_invalid_input_never_reaches_network(self):
        with patch("dictionary.fetch_response") as fetch:
            for bad in ["", " ", "a" * 121, "../word", "https://example.org", "Special:Random", "a\nb", "<script>", "a\u202eb", "one two three four five six seven eight nine"]:
                with self.subTest(word=bad), self.assertRaises(ValueError):
                    lookup_dictionary(bad, "en")
            with self.assertRaises(ValueError):
                lookup_dictionary("if", "fr")
            fetch.assert_not_called()

    def test_lowercase_retry_is_reported_and_original_kept(self):
        missing = {"error": {"code": "missingtitle"}}
        with patch("dictionary.fetch_response", side_effect=[missing, fixture("en-if")]) as fetch:
            result = lookup_dictionary(" IF ", "en")
            self.assertEqual(result["query"], " IF ")
            self.assertEqual(result["lookup"], "if")
            self.assertEqual(result["transformations"], ["trim", "lowercase"])
            self.assertEqual([c.args for c in fetch.call_args_list], [("IF", "en"), ("if", "en")])
        with patch("dictionary.fetch_response", return_value=fixture("en-I")) as fetch:
            result = lookup_dictionary("I", "en")
            self.assertEqual(result["lookup"], "I")
            self.assertEqual(result["transformations"], [])
            fetch.assert_called_once()

    def test_no_unicode_normalization_or_http_redirect(self):
        self.assertEqual(validate_query("é", "en"), "é")
        self.assertIsNone(NoRedirects().redirect_request(None, None, 302, "Found", {}, "https://other.example/"))

    def test_namespace_or_unpinned_response_rejected(self):
        for payload in [record("", title="Template:word"), record("", revision=0), {"parse": {"text": "<p>word</p>", "title": "word"}}]:
            with self.assertRaisesRegex(RuntimeError, "UNSUPPORTED"):
                parse_response(payload, "word", "en")


if __name__ == "__main__":
    unittest.main()
