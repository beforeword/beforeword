#!/usr/bin/env python3
"""Offline checkpoint tests with synthetic responses and process interruption."""
from __future__ import annotations

import copy
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import checkpoint as cp


class CheckpointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = self.root / "run.sqlite3"
        self.cases = [{
            "case_id": f"synthetic-{i}", "criteria": "Preserve the exact response.",
            "input": [{"role": "user", "content": f"Synthetic case {i}."}],
            "language": "en",
        } for i in range(3)]
        self.plan = cp.make_plan(self.cases, ["mock/test"])
        self.calls = []

    def provider(self, **kwargs):
        self.calls.append(copy.deepcopy(kwargs))
        return SimpleNamespace(
            id="synthetic", model="mock/test", usage=None,
            choices=[SimpleNamespace(
                message=SimpleNamespace(content="  Я\r\ne\u0301 👩\u200d💻\t"), finish_reason="stop")],
        )

    def run_plan(self, plan=None, resume=False, provider=None):
        return cp.execute_plan(self.state, plan or self.plan, resume=resume,
                               completion_func=provider or self.provider)

    def test_success_and_resume_do_not_repeat(self):
        first = self.run_plan()
        second = self.run_plan(resume=True)
        self.assertEqual(first["response_received"], 3)
        self.assertEqual(first, second)
        self.assertEqual(len(self.calls), 3)
        self.assertTrue(all(call["num_retries"] == 0 for call in self.calls))

    def test_existing_state_requires_explicit_resume(self):
        self.run_plan()
        with self.assertRaisesRegex(ValueError, "--resume"):
            self.run_plan()
        self.assertEqual(len(self.calls), 3)

    def test_missing_resume_does_not_dispatch(self):
        with self.assertRaisesRegex(ValueError, "missing"):
            self.run_plan(resume=True)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.state.exists())

    def test_marker_is_committed_before_dispatch(self):
        observed = []
        def provider(**kwargs):
            observed.append(cp.summary(cp.read_checkpoint(self.state)[1])["started"])
            return self.provider(**kwargs)
        self.run_plan(provider=provider)
        self.assertEqual(observed, [1, 1, 1])

    def test_interrupt_keeps_unknown_outcome_and_skips_it(self):
        def provider(**kwargs):
            if len(self.calls) == 1:
                raise KeyboardInterrupt()
            return self.provider(**kwargs)
        with self.assertRaises(KeyboardInterrupt):
            self.run_plan(provider=provider)
        before = cp.summary(cp.read_checkpoint(self.state)[1])
        self.assertEqual(before, {"planned": 3, "pending": 1, "started": 1,
                                  "response_received": 1, "request_failed": 0})
        after = self.run_plan(resume=True)
        self.assertEqual(after["started"], 1)
        self.assertEqual(after["response_received"], 2)
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(self.calls[-1]["messages"][0]["content"], "Synthetic case 2.")

    def test_process_death_releases_lock_without_retry(self):
        plan_file = self.root / "plan.json"
        plan_file.write_text(cp.encoded(self.plan), encoding="utf-8")
        code = (
            "import json, os, sys; from pathlib import Path; import checkpoint as cp; "
            "plan=json.loads(Path(sys.argv[2]).read_text(encoding='utf-8')); "
            "cp.execute_plan(Path(sys.argv[1]), plan, completion_func=lambda **kw: os._exit(73))"
        )
        result = subprocess.run([sys.executable, "-B", "-c", code, str(self.state), str(plan_file)],
                                cwd=Path(cp.__file__).parent, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 73, result.stderr)
        self.assertEqual(cp.summary(cp.read_checkpoint(self.state)[1])["started"], 1)
        counts = self.run_plan(resume=True)
        self.assertEqual(counts["response_received"], 2)
        self.assertEqual(counts["started"], 1)
        self.assertEqual(len(self.calls), 2)

    def test_failure_stops_queue_and_is_not_retried(self):
        def failing(**kwargs):
            self.calls.append(kwargs)
            raise PermissionError("SYNTHETIC_PRIVATE_TOKEN")
        first = self.run_plan(provider=failing)
        self.assertEqual(first["request_failed"], 1)
        self.assertEqual(first["pending"], 2)
        second = self.run_plan(resume=True)
        self.assertEqual(second["request_failed"], 1)
        self.assertEqual(second["response_received"], 2)
        self.assertEqual(len(self.calls), 3)
        self.assertNotIn("SYNTHETIC_PRIVATE_TOKEN", str(cp.read_checkpoint(self.state)))

    def test_changed_plan_fails_before_calls(self):
        self.run_plan()
        for key, value in (("instruction", "changed"), ("models", ["mock/other"]),
                           ("runner_sha256", "changed"), ("checkpoint_sha256", "changed"),
                           ("dataset_sha256", "changed")):
            with self.subTest(key=key):
                changed = copy.deepcopy(self.plan)
                changed[key] = value
                with self.assertRaisesRegex(ValueError, "plan changed"):
                    self.run_plan(plan=changed, resume=True)
        self.assertEqual(len(self.calls), 3)

    def test_changed_criteria_or_parameters_fail_before_calls(self):
        self.run_plan()
        for section in ("criteria", "parameters", "input"):
            with self.subTest(section=section):
                changed = copy.deepcopy(self.plan)
                if section == "criteria":
                    changed["cases"][0]["criteria"] = "different criterion"
                elif section == "parameters":
                    changed["parameters"]["max_tokens"] = 999
                else:
                    changed["cases"][0]["input"][0]["content"] = "different input"
                with self.assertRaisesRegex(ValueError, "plan changed"):
                    self.run_plan(plan=changed, resume=True)
        self.assertEqual(len(self.calls), 3)

    def test_second_connection_cannot_dispatch_while_locked(self):
        with cp.exclusive_lock(self.state):
            with self.assertRaisesRegex(RuntimeError, "locked"):
                self.run_plan()
        self.assertEqual(self.calls, [])
        self.assertFalse(self.state.exists())

    def test_missing_checkpoint_rows_are_not_recreated(self):
        self.run_plan()
        with sqlite3.connect(self.state) as db:
            db.execute("DELETE FROM requests WHERE seq=0")
        with self.assertRaisesRegex(ValueError, "request rows"):
            self.run_plan(resume=True)
        self.assertEqual(len(self.calls), 3)

    def test_corrupted_result_is_rejected(self):
        self.run_plan()
        with sqlite3.connect(self.state) as db:
            db.execute("UPDATE requests SET result='{}' WHERE seq=0")
        with self.assertRaisesRegex(ValueError, "checksum"):
            self.run_plan(resume=True)
        self.assertEqual(len(self.calls), 3)

    def test_result_bound_to_the_exact_planned_request(self):
        self.run_plan()
        with sqlite3.connect(self.state) as db:
            record = json.loads(db.execute("SELECT result FROM requests WHERE seq=0").fetchone()[0])
            record["messages_submitted"][0]["content"] = "rewritten"
            text = cp.encoded(record)
            db.execute("UPDATE requests SET result=?, sha256=? WHERE seq=0", (text, cp.digest(text)))
        with self.assertRaisesRegex(ValueError, "differs"):
            self.run_plan(resume=True)
        self.assertEqual(len(self.calls), 3)

    def test_invalid_result_serialization_stays_unresolved(self):
        def invalid(**kwargs):
            response = self.provider(**kwargs)
            response.usage = {"total_tokens": float("nan")}
            return response
        with self.assertRaises(ValueError):
            self.run_plan(provider=invalid)
        self.assertEqual(cp.summary(cp.read_checkpoint(self.state)[1])["started"], 1)
        self.run_plan(resume=True)
        self.assertEqual(len(self.calls), 3)

    def test_export_preserves_text_and_does_not_create_verdicts(self):
        self.run_plan()
        out = self.root / "out.jsonl"
        counts = cp.export_checkpoint(self.state, out)
        records = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines()]
        self.assertEqual(len(records), 3)
        self.assertTrue(all(r["grading"] == "not_performed" for r in records))
        self.assertEqual(records[0]["response_text"], "  Я\r\ne\u0301 👩\u200d💻\t")
        manifest = json.loads(Path(str(out) + ".manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["coverage"], counts)
        self.assertTrue(manifest["not_a_model_score"])

    def test_export_does_not_overwrite(self):
        self.run_plan()
        out = self.root / "out.jsonl"
        out.write_text("original", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "already exists"):
            cp.export_checkpoint(self.state, out)
        self.assertEqual(out.read_text(), "original")

    def test_partial_export_declares_unresolved_and_pending(self):
        with self.assertRaises(KeyboardInterrupt):
            self.run_plan(provider=lambda **k: (_ for _ in ()).throw(KeyboardInterrupt()))
        out = self.root / "partial.jsonl"
        counts = cp.export_checkpoint(self.state, out)
        self.assertEqual(counts["started"], 1)
        self.assertEqual(counts["pending"], 2)
        self.assertEqual(out.read_text(), "")
        manifest = json.loads(Path(str(out) + ".manifest.json").read_text())
        self.assertEqual(manifest["unresolved_request_indices"], [0])
        self.assertEqual(manifest["pending_request_indices"], [1, 2])

    def test_duplicate_models_and_invalid_options_are_rejected(self):
        for options in ({"models": ["mock/test", "mock/test"]}, {"models": [" "]},
                        {"models": ["mock/test"], "temperature": float("inf")},
                        {"models": ["mock/test"], "max_tokens": 0}):
            with self.subTest(options=options), self.assertRaises(ValueError):
                cp.make_plan(self.cases, **options)

    def test_instruction_and_plan_copy_preserve_exact_text(self):
        instruction = "Я\r\ne\u0301\r👩\u200d💻"
        plan = cp.make_plan(self.cases, ["mock/test"], instruction=instruction)
        self.cases[0]["input"][0]["content"] = "modified after planning"
        self.run_plan(plan=plan)
        self.assertEqual(self.calls[0]["messages"][0]["content"], instruction)
        self.assertEqual(self.calls[0]["messages"][1]["content"], "Synthetic case 0.")

    def test_dry_run_does_not_create_state_or_import_provider(self):
        dataset = self.root / "cases.jsonl"
        dataset.write_text("\n".join(cp.encoded(c) for c in self.cases), encoding="utf-8")
        instruction = self.root / "instruction.txt"
        instruction.write_bytes(b"a\r\nb\r")
        absent_state = self.root / "not_created" / "run.sqlite3"
        result = subprocess.run([sys.executable, "-B", cp.__file__, "--dataset", str(dataset),
                                 "--state", str(absent_state), "--instruction-file", str(instruction)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("DRY RUN", result.stdout)
        self.assertFalse(absent_state.parent.exists())

    def test_status_and_export_cli_do_not_dispatch(self):
        self.run_plan()
        for args in (["--status"], ["--export-jsonl", str(self.root / "cli.jsonl")]):
            result = subprocess.run([sys.executable, "-B", cp.__file__, "--state", str(self.state), *args],
                                    capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('"planned":3', result.stdout)
        self.assertEqual(len(self.calls), 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
