#!/usr/bin/env python3
"""Run beforeword cases across LiteLLM-supported models.

No network calls occur without --execute. No grading is claimed by this runner.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
from pathlib import Path
from typing import Any

DEFAULT_DATASET = (
    Path(__file__).resolve().parents[1]
    / "openai-evals/registry/data/beforeword_grounding_24/samples.jsonl"
)


def load_cases(path: Path) -> list[dict[str, Any]]:
    """Read and validate exact published JSONL without text normalization."""
    cases: list[dict[str, Any]] = []
    seen: set[str] = set()
    with path.open("r", encoding="utf-8", newline="") as handle:
        for number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                case = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"Invalid JSON on line {number}") from error
            identifier = case.get("case_id")
            if not isinstance(identifier, str) or not identifier or identifier in seen:
                raise ValueError(f"Missing/duplicate case_id at line {number}")
            if not isinstance(case.get("criteria"), str) or not case["criteria"].strip():
                raise ValueError(f"Missing criteria at line {number}")
            messages = case.get("input")
            if not isinstance(messages, list) or not messages:
                raise ValueError(f"Invalid messages at line {number}")
            for message in messages:
                if not isinstance(message, dict):
                    raise ValueError(f"Non-object message at line {number}")
                if message.get("role") not in ("user", "assistant", "system"):
                    raise ValueError(f"Invalid message role at line {number}")
                if not isinstance(message.get("content"), str):
                    raise ValueError(f"Non-text message at line {number}")
            seen.add(identifier)
            cases.append(case)
    if not cases:
        raise ValueError("No cases in dataset")
    return cases


def pair_summary(cases: list[dict[str, Any]]) -> dict[str, int]:
    """Count case groups; incomplete pairs cannot masquerade as passed pairs."""
    counts: dict[str, int] = {}
    for case in cases:
        pair = case.get("pair_id")
        if isinstance(pair, str):
            counts[pair] = counts.get(pair, 0) + 1
    return counts


def safe_usage(response: Any) -> dict[str, Any]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return {}
    if hasattr(usage, "model_dump"):
        data = usage.model_dump()
    elif isinstance(usage, dict):
        data = usage
    else:
        data = {
            key: getattr(usage, key, None)
            for key in ("prompt_tokens", "completion_tokens", "total_tokens")
        }
    return {
        k: data.get(k)
        for k in ("prompt_tokens", "completion_tokens", "total_tokens")
        if isinstance(data.get(k), (int, float))
    }


def ask_model(
    model: str,
    case: dict[str, Any],
    *,
    timeout: int = 90,
    max_tokens: int = 512,
    temperature: float | None = None,
    completion_func: Any = None,
) -> dict[str, Any]:
    """One real or injected request. Never claim delivery without a return."""
    if completion_func is None:
        try:
            from litellm import completion as completion_func
        except ImportError as exc:
            raise RuntimeError(
                "Install the optional dependency: python -m pip install litellm"
            ) from exc
    params: dict[str, Any] = {
        "model": model,
        "messages": case["input"],
        "timeout": timeout,
        "max_tokens": max_tokens,
    }
    if temperature is not None:
        params["temperature"] = temperature
    started = time.monotonic()
    response = completion_func(**params)
    elapsed = time.monotonic() - started
    choices = getattr(response, "choices", None)
    if not choices:
        raise ValueError("Provider returned no choices")
    message = getattr(choices[0], "message", None)
    answer = getattr(message, "content", None)
    if answer is not None and not isinstance(answer, str):
        answer = json.dumps(answer, ensure_ascii=False)
    return {
        "status": "response_received",
        "response_text": answer,
        "response_model": getattr(response, "model", None),
        "response_id": getattr(response, "id", None),
        "finish_reason": getattr(choices[0], "finish_reason", None),
        "usage": safe_usage(response),
        "elapsed_seconds": round(elapsed, 3),
    }


def run_case(
    case: dict[str, Any],
    model: str,
    *,
    completion_func: Any = None,
    timeout: int = 90,
    max_tokens: int = 512,
    temperature: float | None = None,
) -> dict[str, Any]:
    """One inspectable outcome record, including errors and original messages."""
    record: dict[str, Any] = {
        "timestamp_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "model_requested": model,
        "case_id": case["case_id"],
        "pair_id": case.get("pair_id"),
        "variant": case.get("variant"),
        "language": case.get("language"),
        "category": case.get("category"),
        "messages_submitted": case["input"],
        "criteria": case["criteria"],
        "grading": "not_performed",
    }
    try:
        record.update(
            ask_model(
                model,
                case,
                completion_func=completion_func,
                timeout=timeout,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        )
    except Exception as exc:
        record.update(
            {
                "status": "request_failed",
                "error_type": type(exc).__name__,
                # Error contents may include private provider metadata;
                # do not write full exception text to public reports.
                "response_text": None,
            }
        )
    return record


def self_test() -> None:
    """Offline structural and mock-response checks; no API keys or network."""
    from types import SimpleNamespace

    cases = load_cases(DEFAULT_DATASET)
    if len(cases) != 24:
        raise AssertionError(f"Expected 24 paired cases, found {len(cases)}")
    counts = pair_summary(cases)
    if len(counts) != 12 or any(count != 2 for count in counts.values()):
        raise AssertionError(f"Expected 12 complete pairs; got {counts}")
    for pair in counts:
        members = [case for case in cases if case["pair_id"] == pair]
        if {member.get("variant") for member in members} != {"a", "b"}:
            raise AssertionError(f"Invalid a/b pair: {pair}")

    def mock_completion(**kwargs: Any) -> Any:
        assert kwargs["messages"] == cases[0]["input"]
        return SimpleNamespace(
            id="synthetic-response",
            model="mock/not-a-real-model",
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=4, total_tokens=14),
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content="This is a synthetic output."),
                    finish_reason="stop",
                )
            ],
        )

    example = run_case(cases[0], "mock/test", completion_func=mock_completion)
    assert example["status"] == "response_received"
    assert example["response_text"] == "This is a synthetic output."
    assert example["usage"]["total_tokens"] == 14
    assert example["grading"] == "not_performed"

    def failing_completion(**kwargs: Any) -> Any:
        raise PermissionError("This fake failure is not a real provider response")

    failure = run_case(cases[0], "mock/fail", completion_func=failing_completion)
    assert failure["status"] == "request_failed"
    assert failure["error_type"] == "PermissionError"
    assert failure["response_text"] is None
    print("PASS: 24 prompts, 12 complete pairs, successful/failed synthetic calls.")
    print("No provider request, model score, or real-world delivery was performed.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="beforeword: reproducible cross-provider prompt collection."
    )
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--model", action="append", default=[], help="LiteLLM provider/model; repeat for several models.")
    parser.add_argument("--execute", action="store_true", help="Explicitly authorize real API calls (potentially billed).")
    parser.add_argument("--all", action="store_true", help="Run every case instead of the safe two-case default.")
    parser.add_argument("--limit", type=int, default=2, help="Maximum cases per model without --all.")
    parser.add_argument("--out", type=Path, help="Append JSONL results to a local file.")
    parser.add_argument("--timeout", type=int, default=90)
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument("--temperature", type=float, default=None)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return 0
    if args.limit < 1 or args.timeout < 1 or args.max_tokens < 1:
        parser.error("limit, timeout and max-tokens must be positive")
    cases = load_cases(args.dataset)
    groups = pair_summary(cases)
    chosen = cases if args.all else cases[: args.limit]
    print(f"Loaded {len(cases)} cases ({len(groups)} groups); selected {len(chosen)}.")
    print(f"Languages: RU={sum(c.get('language') == 'ru' for c in cases)}, EN={sum(c.get('language') == 'en' for c in cases)}.")
    if not args.execute:
        print("DRY RUN: no API requests, claims of model performance or paid actions.")
        print("Selected IDs: " + ", ".join(c["case_id"] for c in chosen))
        return 0
    if not args.model:
        parser.error("--execute requires at least one --model")
    out = args.out or Path("results") / (
        "beforeword-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".jsonl"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        parser.error(f"Output file already exists: {out}. Use a new path to avoid mixing runs.")
    count_ok, count_failed = 0, 0
    with out.open("x", encoding="utf-8", newline="\n") as handle:
        for model in args.model:
            for case in chosen:
                record = run_case(
                    case,
                    model,
                    timeout=args.timeout,
                    max_tokens=args.max_tokens,
                    temperature=args.temperature,
                )
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
                handle.flush()
                if record["status"] == "response_received":
                    count_ok += 1
                else:
                    count_failed += 1
                print(f"{model} {case['case_id']}: {record['status']}")
    print(f"Saved {count_ok} responses and {count_failed} failures to {out}.")
    print("No automatic validity scores were assigned. Review criteria and both pair variants.")
    return 0 if not count_failed else 1


if __name__ == "__main__":
    sys.exit(main())
