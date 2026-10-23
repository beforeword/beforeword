#!/usr/bin/env python3
"""Offline regressions for the request record; no provider calls."""
from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import run as runner


class RunnerContractTests(unittest.TestCase):
    def setUp(self):
        self.case = {
            "case_id": "synthetic-a", "criteria": "Preserve the supplied text.",
            "input": [{"role": "user", "content": "  Я\r\nе\u0301 👩\u200d💻\t"}],
        }

    @staticmethod
    def response(text=" synthetic answer "):
        return SimpleNamespace(
            id="synthetic", model="mock/unit-test", usage=None,
            choices=[SimpleNamespace(message=SimpleNamespace(content=text), finish_reason="stop")],
        )

    def test_instruction_file_is_not_newline_normalized(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            data = folder / "cases.jsonl"
            data.write_text(json.dumps(self.case) + "\n", encoding="utf-8")
            instruction = folder / "instruction.txt"
            payload = "Я\r\ne\u0301\r👩\u200d💻\n".encode("utf-8")
            instruction.write_bytes(payload)
            result = subprocess.run(
                [sys.executable, str(Path(runner.__file__)), "--dataset", str(data),
                 "--instruction-file", str(instruction)],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(hashlib.sha256(payload).hexdigest(), result.stdout)
            self.assertIn("DRY RUN", result.stdout)

    def test_provider_cannot_rewrite_the_recorded_request(self):
        original = copy.deepcopy(self.case)
        def mutating_provider(**kwargs):
            kwargs["messages"][0]["content"] = "changed by synthetic provider"
            kwargs["messages"].append({"role": "assistant", "content": "added"})
            return self.response()
        record = runner.run_case(self.case, "mock/test", completion_func=mutating_provider)
        self.assertEqual(self.case, original)
        self.assertEqual(record["messages_submitted"], original["input"])

    def test_message_copies_do_not_share_nested_fields(self):
        self.case["input"][0]["metadata"] = {"tags": ["original"]}
        copied = runner.messages_for_case(self.case)
        copied[0]["metadata"]["tags"].append("mutated")
        self.assertEqual(self.case["input"][0]["metadata"]["tags"], ["original"])

    def test_zero_sdk_retries_are_explicit_and_recorded(self):
        seen = []
        def provider(**kwargs):
            seen.append(kwargs)
            return self.response()
        record = runner.run_case(self.case, "mock/test", completion_func=provider)
        self.assertEqual(seen[0].get("num_retries"), 0)
        self.assertEqual(record["request_parameters"].get("num_retries"), 0)

    def test_nonobject_dataset_rows_are_validation_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "input.jsonl"
            for value in (None, [], 4, "not an object"):
                with self.subTest(value=value):
                    path.write_text(json.dumps(value) + "\n", encoding="utf-8")
                    with self.assertRaisesRegex(ValueError, "line 1"):
                        runner.load_cases(path)

    def test_error_details_do_not_enter_result(self):
        def provider(**kwargs):
            raise RuntimeError("SYNTHETIC_PRIVATE_VALUE")
        record = runner.run_case(self.case, "mock/test", completion_func=provider)
        self.assertEqual(record["status"], "request_failed")
        self.assertNotIn("SYNTHETIC_PRIVATE_VALUE", json.dumps(record))

    def test_unicode_response_is_preserved(self):
        exact = " \r\nЯ e\u0301 👩\u200d💻\t"
        record = runner.run_case(self.case, "mock/test", completion_func=lambda **k: self.response(exact))
        self.assertEqual(record["response_text"], exact)
        self.assertEqual(record["grading"], "not_performed")

    def test_system_instruction_is_not_mutable_through_provider(self):
        instruction = "Я\r\ne\u0301"
        def provider(**kwargs):
            kwargs["messages"][0]["content"] = "modified"
            kwargs["messages"][1]["content"] = "also modified"
            return self.response()
        record = runner.run_case(self.case, "mock/test", instruction=instruction, completion_func=provider)
        self.assertEqual(record["messages_submitted"][0]["content"], instruction)
        self.assertEqual(record["messages_submitted"][1]["content"], "  Я\r\nе\u0301 👩\u200d💻\t")


if __name__ == "__main__":
    unittest.main(verbosity=2)
