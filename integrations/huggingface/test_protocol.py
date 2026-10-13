"""Exercise the real MCP wire protocol; no model calls or user conversations."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.shared.exceptions import McpError

ROOT = Path(__file__).resolve().parent


def expected_instructions() -> tuple[str, dict[str, bytes]]:
    manifest = json.loads((ROOT / "instructions.json").read_text(encoding="utf-8"))
    contract_path = ROOT.parent.parent / "references/release-contract.json"
    if contract_path.is_file():
        contract = json.loads(contract_path.read_bytes())
        assert contract["status"] == "selected", "Release selection is pending"
        assert manifest["version"] == contract["version"], "Changed release version"
        assert {language: entry["sha256"] for language, entry in manifest["instructions"].items()} == contract["core_sha256"], "Changed selected-core hashes"
    expected = {}
    for language, entry in manifest["instructions"].items():
        data = (ROOT / entry["file"]).read_bytes()
        assert len(data) == entry["bytes"], language
        assert hashlib.sha256(data).hexdigest() == entry["sha256"], language
        source = ROOT.parent.parent / entry["source"]
        if source.exists():
            assert data == source.read_bytes(), f"Changed canonical {language} source"
        expected[language] = data
    assert set(expected) == {"en", "ru"}
    return manifest["version"], expected


def content_text(content: list) -> str:
    assert len(content) == 1, f"Expected one text block, got {len(content)}"
    assert content[0].type == "text", "Instruction must be text, not a file or URL"
    return content[0].text


async def check(url: str, fixture_dictionary: bool = False, live_dictionary: bool = False) -> dict:
    instruction_version, expected = expected_instructions()
    counts = {"exact_retrievals": 0, "invalid_language_checks": 0, "dictionary_lookups": 0, "invalid_dictionary_checks": 0}
    local = urlsplit(url).hostname in {"127.0.0.1", "localhost", "::1"}
    # Ignore proxy configuration only for loopback, where no network service is used.
    async with httpx.AsyncClient(trust_env=not local, timeout=20.0) as client:
        async with streamable_http_client(url, http_client=client) as (read, write, _):
            async with ClientSession(read, write) as session:
                initialized = await session.initialize()
                tools = (await session.list_tools()).tools
                assert len(tools) == 2, [tool.name for tool in tools]
                tool = next(t for t in tools if t.name.endswith("get_beforeword_instruction"))
                dictionary_tool = next(t for t in tools if t.name.endswith("lookup_dictionary_entry"))
                assert set(tool.inputSchema["properties"]) == {"language"}, tool.inputSchema
                assert set(tool.inputSchema["properties"]["language"]["enum"]) == {"en", "ru"}
                assert set(dictionary_tool.inputSchema["properties"]) == {"word", "language"}
                assert set(dictionary_tool.inputSchema["properties"]["language"]["enum"]) == {"en", "ru"}
                prompts = (await session.list_prompts()).prompts
                assert len(prompts) == 1, prompts
                prompt_name = prompts[0].name
                assert prompt_name == "beforeword" or prompt_name.endswith("_beforeword"), prompts
                assert [arg.name for arg in prompts[0].arguments] == ["language"]
                resources = (await session.list_resources()).resources
                assert resources == [], resources
                templates = (await session.list_resource_templates()).resourceTemplates
                assert len(templates) == 1, templates
                assert templates[0].uriTemplate == "beforeword://instruction/{language}"
                for language, exact in expected.items():
                    result = await session.call_tool(tool.name, {"language": language})
                    assert not result.isError, result
                    assert content_text(result.content).encode("utf-8") == exact
                    counts["exact_retrievals"] += 1
                    prompt = await session.get_prompt(prompt_name, {"language": language})
                    assert len(prompt.messages) == 1
                    assert prompt.messages[0].content.type == "text"
                    assert prompt.messages[0].content.text.encode("utf-8") == exact
                    counts["exact_retrievals"] += 1
                    resource = await session.read_resource(f"beforeword://instruction/{language}")
                    assert len(resource.contents) == 1
                    assert resource.contents[0].text.encode("utf-8") == exact
                    assert resource.contents[0].mimeType == "text/plain"
                    counts["exact_retrievals"] += 1
                default = await session.call_tool(tool.name, {})
                assert not default.isError
                assert content_text(default.content).encode("utf-8") == expected["en"]
                counts["exact_retrievals"] += 1
                for invalid in ["fr", "../../app.py", "EN", ""]:
                    result = await session.call_tool(tool.name, {"language": invalid})
                    assert result.isError, f"Tool accepted invalid language: {invalid!r}"
                    counts["invalid_language_checks"] += 1
                for action in [
                    lambda: session.get_prompt(prompt_name, {"language": "fr"}),
                    lambda: session.read_resource("beforeword://instruction/fr"),
                ]:
                    try:
                        await action()
                    except McpError:
                        counts["invalid_language_checks"] += 1
                    else:
                        raise AssertionError("Invalid prompt/resource language was accepted")
                # No hidden conversation parameter is advertised. The framework may
                # ignore extra JSON keys; if so, they must not change the output.
                extra = await session.call_tool(
                    tool.name, {"language": "en", "text": "protocol test sentinel"}
                )
                if extra.isError:
                    extra_behavior = "rejected"
                else:
                    assert content_text(extra.content).encode("utf-8") == expected["en"]
                    extra_behavior = "ignored by framework; unchanged instruction returned"
                for arguments in [
                    {"word": "", "language": "en"}, {"word": "if", "language": "fr"},
                    {"word": "https://example.com", "language": "en"},
                    {"word": "Special:Random", "language": "en"},
                    {"word": "a" * 121, "language": "en"},
                    {"word": "one\ntwo", "language": "en"},
                ]:
                    result = await session.call_tool(dictionary_tool.name, arguments)
                    assert result.isError, "Invalid dictionary input accepted"
                    counts["invalid_dictionary_checks"] += 1
                if fixture_dictionary or live_dictionary:
                    selections = [("if", "en"), ("я", "ru")] if fixture_dictionary else [("if", "en")]
                    for word, language in selections:
                        result = await session.call_tool(dictionary_tool.name, {"word": word, "language": language})
                        assert not result.isError, result
                        record = json.loads(content_text(result.content))
                        assert record["query"] == word and record["status"] == "found", record
                        assert record["entries"] and record["source"]["revision"] > 0
                        assert record["source"]["url"].startswith(f"https://{language}.wiktionary.org/w/index.php?title=")
                        assert "&oldid=" in record["source"]["url"]
                        counts["dictionary_lookups"] += 1
                return {
                    "ok": True,
                    "scope": "MCP HTTP protocol, exact instruction delivery and dictionary contract; no model behavior tested",
                    "dictionary_source": "local recorded Wikimedia responses" if fixture_dictionary else "live Wiktionary" if live_dictionary else "not requested; schema and invalid inputs only",
                    "instruction_version": instruction_version,
                    "client_environment": {
                        "python": sys.version.split()[0],
                        "gradio": importlib.metadata.version("gradio"),
                        "mcp": importlib.metadata.version("mcp"),
                    },
                    "server_reported": initialized.serverInfo.model_dump(exclude_none=True),
                    "protocol_version": initialized.protocolVersion,
                    "tools": [t.name for t in tools],
                    "prompt": prompts[0].name,
                    "resource_template": templates[0].uriTemplate,
                    **counts,
                    "extra_argument_behavior": extra_behavior,
                    "sha256": {key: hashlib.sha256(value).hexdigest() for key, value in expected.items()},
                }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="Existing MCP Streamable HTTP endpoint; otherwise starts localhost")
    parser.add_argument("--live-dictionary", action="store_true", help="Send one explicit 'if' lookup to Wiktionary; local default uses recorded fixtures")
    args = parser.parse_args()
    if args.url:
        print(json.dumps(asyncio.run(check(args.url, live_dictionary=args.live_dictionary)), ensure_ascii=False, indent=2))
        return
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    env = os.environ.copy()
    env.update({"GRADIO_SERVER_NAME": "127.0.0.1", "GRADIO_SERVER_PORT": str(port), "GRADIO_ANALYTICS_ENABLED": "False"})
    env.pop("SPACE_HOST", None)
    for key in ("NO_PROXY", "no_proxy"):
        env[key] = ",".join(filter(None, [env.get(key, ""), "127.0.0.1", "localhost"]))
    with tempfile.TemporaryFile(mode="w+") as log:
        # Override transport only inside this test child process. Production app
        # has no fixture mode, no fixture parameter and no alternate host setting.
        fixture_launcher = (
            "import dictionary,json,runpy; from pathlib import Path; "
            "dictionary.fetch_response=lambda word,language: json.loads((Path('fixtures')/(language+'-'+word+'.json')).read_text()); "
            "runpy.run_path('app.py',run_name='__main__')"
        )
        command = [sys.executable, "app.py"] if args.live_dictionary else [sys.executable, "-c", fixture_launcher]
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=log)
        try:
            deadline = time.monotonic() + 25
            with httpx.Client(trust_env=False, timeout=1) as probe:
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise RuntimeError("Local server exited during startup")
                    try:
                        if probe.get(f"http://127.0.0.1:{port}/config").status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    time.sleep(0.15)
                else:
                    raise TimeoutError("Local server did not become ready within 25 seconds")
            result = asyncio.run(check(f"http://127.0.0.1:{port}/gradio_api/mcp/", fixture_dictionary=not args.live_dictionary, live_dictionary=args.live_dictionary))
            print(json.dumps(result, ensure_ascii=False, indent=2))
        except BaseException:
            log.seek(0)
            sys.stderr.write(log.read())
            raise
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


if __name__ == "__main__":
    main()
