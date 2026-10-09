#!/usr/bin/env python3
"""Format a beforeword text request as local JSON; never call a provider.

The portable history format contains only user/assistant text. It is not
a replacement for provider-native tool, reasoning, or multimodal histories.
"""

import argparse
import json
from pathlib import Path
import sys


PROVIDERS = ("openai", "anthropic", "gemini", "grok", "deepseek", "qwen", "mistral")
LANGUAGES = ("en", "ru")
ASSETS = Path(__file__).resolve().parent.parent / "assets"



def require_text(value, label):
    """Accept any UTF-8-encodable string without changing its written form."""
    if not isinstance(value, str):
        raise ValueError(label + " must be a string")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise ValueError(label + " contains invalid Unicode") from None
    return value


def read_utf8(path, label):
    # read_text() can normalize CRLF/CR; bytes.decode() preserves them.
    try:
        return Path(path).read_bytes().decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError(label + " must contain valid UTF-8") from None


def validate_history(history):
    if history is None:
        return []
    if not isinstance(history, list):
        raise ValueError("history must be a JSON array")
    result = []
    for index, message in enumerate(history):
        label = "history[" + str(index) + "]"
        if not isinstance(message, dict) or set(message) != {"role", "content"}:
            raise ValueError(label + " must contain exactly role and content")
        if message["role"] not in ("user", "assistant"):
            raise ValueError(label + ".role must be user or assistant")
        result.append({
            "role": message["role"],
            "content": require_text(message["content"], label + ".content"),
        })
    return result


def build_payload(provider, model, input_text, language="en", history=None, max_tokens=2048):
    """Return a request body. Text and history content are preserved exactly.

    Model availability and remote acceptance are not tested. max_tokens is
    emitted only for Anthropic. All instructions must be resent each request.
    """
    if provider not in PROVIDERS:
        raise ValueError("unsupported provider")
    require_text(model, "model")
    if not model.strip():
        raise ValueError("model must not be blank")
    require_text(input_text, "input_text")
    if language not in LANGUAGES:
        raise ValueError("language must be en or ru")
    if type(max_tokens) is not int or max_tokens <= 0:
        raise ValueError("max_tokens must be a positive integer")
    messages = validate_history(history)
    instruction = read_utf8(ASSETS / ("core." + language + ".txt"), "core instruction")
    messages.append({"role": "user", "content": input_text})
    body = {"model": model}
    if provider == "openai":
        body.update(instructions=instruction, input=messages, store=False)
    elif provider == "anthropic":
        body.update(system=instruction, messages=messages, max_tokens=max_tokens)
    elif provider == "gemini":
        # Interactions accepts a string or Step[]. Preserve the existing
        # single-turn form; map portable text history to documented steps.
        gemini_input = input_text if len(messages) == 1 else [
            {
                "type": "user_input" if item["role"] == "user" else "model_output",
                "content": [{"type": "text", "text": item["content"]}],
            }
            for item in messages
        ]
        body.update(system_instruction=instruction, input=gemini_input, store=False)
    elif provider == "grok":
        body.update(input=[{"role": "system", "content": instruction}] + messages, store=False)
    else:
        body["messages"] = [{"role": "system", "content": instruction}] + messages
    return body


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("JSON contains a duplicate object key")
        result[key] = value
    return result


def positive_integer(value):
    try:
        number = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError("must be a positive integer") from None
    if number <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def guard_output(output, inputs=()):
    """Reject aliases of source inputs and files belonging to this package."""
    if output is None:
        return
    target = Path(output)
    package = Path(__file__).resolve().parent.parent
    if target.resolve().is_relative_to(package):
        raise ValueError("output must be outside the beforeword package")
    for source in inputs:
        if source is None:
            continue
        source = Path(source)
        if target.resolve() == source.resolve() or (
            target.exists() and source.exists() and target.samefile(source)
        ):
            raise ValueError("output must not overwrite an input or history file")
    # Catch hardlinks outside the package as well as symlinks resolving into it.
    if target.exists():
        for source in package.rglob("*"):
            if source.is_file() and target.samefile(source):
                raise ValueError("output must not overwrite a beforeword package file")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("provider", choices=PROVIDERS)
    parser.add_argument("--model", required=True, help="Provider model ID; not checked remotely")
    parser.add_argument("--input-file", required=True, type=Path, help="UTF-8 text file; whitespace is preserved")
    parser.add_argument("--language", choices=LANGUAGES, default="en")
    parser.add_argument("--history", type=Path, help="UTF-8 JSON file: array of {role: user|assistant, content: string}; text-only history")
    parser.add_argument("--output", type=Path, help="Write JSON to this path; otherwise use stdout")
    parser.add_argument("--max-tokens", type=positive_integer, default=2048, help="Anthropic output-token limit only (default: 2048)")
    args = parser.parse_args(argv)
    try:
        guard_output(args.output, (args.input_file, args.history))
        text = read_utf8(args.input_file, "input file")
        history = None
        if args.history is not None:
            try:
                history = json.loads(read_utf8(args.history, "history file"), object_pairs_hook=unique_object)
            except json.JSONDecodeError as exc:
                raise ValueError("history file is invalid JSON at line " + str(exc.lineno)) from None
            if not isinstance(history, list):
                raise ValueError("history file must contain a JSON array")
        body = build_payload(args.provider, args.model, text, args.language, history, args.max_tokens)
        serialized = json.dumps(body, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        if args.output is not None:
            args.output.write_bytes(serialized.encode("utf-8"))
        else:
            sys.stdout.write(serialized)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
