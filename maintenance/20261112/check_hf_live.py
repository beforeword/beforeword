#!/usr/bin/env python3
"""Bounded, unauthenticated public HF checks; standard library; no model calls."""
import hashlib
import json
import sys
import time
import urllib.request
from urllib.parse import urlsplit

COMMIT = '062a3ada5fdc0ff3373bbc18ce3a51438383a6c5'
VERSION = '1.4.2'
HOST = 'https://beforeword-beforeword.hf.space'
ENDPOINT = HOST + '/gradio_api/mcp/'
FILES = {
    'README.md': '0a235ac7f405953dfd0132d5e3f193134e3c9da061e55436d0b301687c2f8e0d',
    'instructions.json': '465e7781dc0464788cf4418f87d0a242f0a4c46bb80613f557a428d381967d75',
    'instruction.en.txt': 'a4d09af033be6f272b1c05a09fdb29fc412ebf59433466518c2cc2409e818249',
    'instruction.ru.txt': 'a1f13e5ffaeb31c4d4218d8c9cf7d0f6691cff2bdf944634d737816c6ca0fe82',
}
LIMIT = 1024 * 1024


def require(value, code):
    if not value:
        raise RuntimeError(code)


class SameHostRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        old, new = urlsplit(req.full_url), urlsplit(newurl)
        require(new.scheme == 'https' and new.hostname == old.hostname and
                not new.username and not new.password, 'redirect_refused')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def response_json(response, wanted_id):
    """Read one JSON-RPC response, closing SSE after the matching complete event."""
    if 'text/event-stream' not in response.headers.get('Content-Type', ''):
        raw = response.read(LIMIT + 1)
        require(len(raw) <= LIMIT, 'response_too_large')
        message = json.loads(raw)
    else:
        total, data, message = 0, [], None
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            line = response.readline(LIMIT + 1)
            total += len(line)
            require(total <= LIMIT, 'response_too_large')
            require(bool(line), 'sse_ended_without_response')
            line = line.decode('utf-8').rstrip('\r\n')
            if line.startswith('data:'):
                data.append(line[5:].lstrip(' '))
            elif not line and data:
                event = json.loads('\n'.join(data))
                data = []
                if isinstance(event, dict) and event.get('id') == wanted_id:
                    message = event
                    break
        require(message is not None, 'sse_response_timeout')
    require(isinstance(message, dict) and message.get('jsonrpc') == '2.0' and
            message.get('id') == wanted_id, 'rpc_response_mismatch')
    require('error' not in message and isinstance(message.get('result'), dict), 'rpc_error')
    return message['result']


def check(opener=None):
    opener = opener or urllib.request.build_opener(urllib.request.ProxyHandler({}), SameHostRedirect())
    report = {'ok': False, 'commit': COMMIT, 'instruction_version': VERSION,
              'scope': 'public file hashes and live MCP instruction delivery; no model behavior tested',
              'public_files': 0, 'exact_mcp_retrievals': 0, 'model_calls': 0}
    session, protocol, counter = None, '2025-11-25', 0

    def get(url):
        with opener.open(urllib.request.Request(url, headers={'Accept': '*/*'}), timeout=20) as response:
            raw = response.read(LIMIT + 1)
            require(len(raw) <= LIMIT, 'response_too_large')
            return raw

    def rpc(method, params=None, notification=False):
        nonlocal session, protocol, counter
        counter += 1
        message = {'jsonrpc': '2.0', 'method': method}
        if not notification:
            message['id'] = counter
        if params is not None:
            message['params'] = params
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
        if method != 'initialize':
            headers['MCP-Protocol-Version'] = protocol
        if session:
            headers['Mcp-Session-Id'] = session
        request = urllib.request.Request(ENDPOINT, data=json.dumps(message).encode(), headers=headers, method='POST')
        with opener.open(request, timeout=20) as response:
            if method == 'initialize':
                session = response.headers.get('Mcp-Session-Id')
            if notification:
                require(response.status in (200, 202, 204), 'notification_rejected')
                return None
            return response_json(response, counter)

    try:
        base = 'https://huggingface.co/spaces/beforeword/beforeword/raw/' + COMMIT + '/'
        for name, digest in FILES.items():
            raw = get(base + name)
            require(hashlib.sha256(raw).hexdigest() == digest, 'public_file_hash_mismatch')
            report['public_files'] += 1
            if name == 'instructions.json':
                manifest = json.loads(raw)
                require(manifest.get('version') == VERSION, 'manifest_version_mismatch')
        initialized = rpc('initialize', {'protocolVersion': protocol, 'capabilities': {},
                          'clientInfo': {'name': 'beforeword-release-check', 'version': VERSION}})
        protocol = initialized.get('protocolVersion')
        require(isinstance(protocol, str) and len(protocol) < 32, 'invalid_protocol_version')
        rpc('notifications/initialized', notification=True)
        listed = rpc('tools/list')
        candidates = [t['name'] for t in listed.get('tools', []) if
                      isinstance(t.get('name'), str) and t['name'].endswith('get_beforeword_instruction')]
        require(len(candidates) == 1, 'instruction_tool_not_unique')
        for language in ('en', 'ru'):
            result = rpc('tools/call', {'name': candidates[0], 'arguments': {'language': language}})
            blocks = result.get('content', [])
            require(not result.get('isError') and len(blocks) == 1 and
                    blocks[0].get('type') == 'text', 'instruction_result_invalid')
            raw = blocks[0]['text'].encode('utf-8')
            require(hashlib.sha256(raw).hexdigest() == FILES['instruction.' + language + '.txt'],
                    'live_instruction_hash_mismatch')
            report['exact_mcp_retrievals'] += 1
        config = json.loads(get(HOST + '/config'))
        expected_label = 'Complete instruction · ' + VERSION + ' / Полная инструкция · ' + VERSION
        require(any(c.get('props', {}).get('label') == expected_label
                    for c in config.get('components', [])), 'live_ui_version_mismatch')
        report.update(ok=True, protocol_version=protocol, ui_instruction_version=VERSION)
    except Exception as error:
        report['error'] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    return report


if __name__ == '__main__':
    require(len(sys.argv) == 1, 'arguments_refused')
    result = check()
    print(json.dumps(result, ensure_ascii=True, separators=(',', ':')))
    raise SystemExit(0 if result['ok'] else 1)
