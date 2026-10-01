#!/usr/bin/env python3
"""Extract visible text from a saved non-streaming response; no network or keys.

The result preserves text parts and provider status fields. It does not
certify completion, instruction adherence, or a valid native continuation.
"""

import argparse
import json
from pathlib import Path
import sys

from build_payload import PROVIDERS, guard_output, read_utf8, require_text, unique_object


def extract_response(provider, response, choice_index=0):
    if provider not in PROVIDERS:
        raise ValueError("unsupported provider")
    if not isinstance(response, dict):
        raise ValueError("response must be a JSON object, not an event stream")
    if type(choice_index) is not int or choice_index < 0:
        raise ValueError("choice_index must be a non-negative integer")
    result = {
        "provider": provider,
        "id": response.get("id"),
        "model": response.get("model"),
        "text": "",
        "text_parts": [],
        "status": response.get("status"),
        "finish_reason": None,
        "error": response.get("error"),
        "omitted_types": [],
        "refusals": [],
    }
    for key in ("usage", "incomplete_details", "stop_details"):
        if key in response:
            result[key] = response[key]
    if response.get("error") is not None:
        return result

    def omit(kind):
        kind = str(kind)
        if kind not in result["omitted_types"]:
            result["omitted_types"].append(kind)

    def blocks(content, text_type, location):
        if not isinstance(content, list):
            raise ValueError(location + " must be an array")
        for index, part in enumerate(content):
            if not isinstance(part, dict):
                raise ValueError(location + " contains a non-object block")
            kind = part.get("type")
            if kind == text_type:
                text = require_text(part.get("text"), location + ".text")
                result["text_parts"].append({"path": location + "[" + str(index) + "]", "text": text})
            elif kind == "refusal" and isinstance(part.get("refusal"), str):
                result["refusals"].append(part["refusal"])
                omit(kind)
            else:
                omit(kind or "untyped_content")

    if provider in ("openai", "grok"):
        output = response.get("output")
        if not isinstance(output, list):
            raise ValueError("Responses JSON must contain an output array")
        for index, item in enumerate(output):
            if not isinstance(item, dict):
                raise ValueError("output contains a non-object item")
            if item.get("type") == "message" and item.get("role") == "assistant":
                # Preserve all visible message parts. Phases remain attached to
                # parts so commentary is never silently called a final answer.
                start = len(result["text_parts"])
                blocks(item.get("content"), "output_text", "output[" + str(index) + "].content")
                for part in result["text_parts"][start:]:
                    part["phase"] = item.get("phase")
            else:
                omit(item.get("type") or "untyped_output")
        details = response.get("incomplete_details")
        if isinstance(details, dict):
            result["finish_reason"] = details.get("reason")
    elif provider == "anthropic":
        if response.get("type") != "message":
            raise ValueError("Anthropic JSON must be a complete message response")
        blocks(response.get("content"), "text", "content")
        result["finish_reason"] = response.get("stop_reason")
    elif provider == "gemini":
        steps = response.get("steps")
        if not isinstance(steps, list):
            raise ValueError("Gemini Interactions JSON must contain a steps array")
        for index, item in enumerate(steps):
            if not isinstance(item, dict):
                raise ValueError("steps contains a non-object item")
            if item.get("type") == "model_output":
                blocks(item.get("content"), "text", "steps[" + str(index) + "].content")
            else:
                omit(item.get("type") or "untyped_step")
    else:
        choices = response.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ValueError("Chat Completions JSON must contain non-empty choices")
        matches = [item for item in choices if isinstance(item, dict) and item.get("index") == choice_index]
        if len(matches) != 1:
            raise ValueError("response must contain exactly one requested choice index")
        choice = matches[0]
        message = choice.get("message")
        if not isinstance(message, dict):
            raise ValueError("choice has no message; streaming deltas are unsupported")
        content = message.get("content")
        if isinstance(content, str):
            result["text_parts"].append({"path": "choices[index=" + str(choice_index) + "].message.content", "text": require_text(content, "content")})
        elif isinstance(content, list) and provider == "mistral":
            blocks(content, "text", "choices[index=" + str(choice_index) + "].message.content")
        elif content is not None:
            raise ValueError("unsupported message content shape")
        for field in ("reasoning_content", "tool_calls", "refusal"):
            if message.get(field):
                omit(field)
        result["finish_reason"] = choice.get("finish_reason")
        result["choice_index"] = choice_index
        result["other_choice_count"] = len(choices) - 1
    result["text"] = "".join(part["text"] for part in result["text_parts"])
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("provider", choices=PROVIDERS)
    parser.add_argument("--response-file", type=Path, required=True)
    parser.add_argument("--choice-index", type=int, default=0, help="Chat Completions choice index only")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    try:
        guard_output(args.output, (args.response_file,))
        response = json.loads(read_utf8(args.response_file, "response file"), object_pairs_hook=unique_object)
        result = extract_response(args.provider, response, args.choice_index)
        encoded = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        if args.output is not None:
            args.output.write_bytes(encoded.encode("utf-8"))
        else:
            sys.stdout.write(encoded)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
