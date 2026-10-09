"""Offline checks of JSON boundaries, exact text, and rejected input."""
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys

from extract_response import extract_response

SCRIPT = Path(__file__).resolve().with_name('build_payload.py')
spec = importlib.util.spec_from_file_location('beforeword_payload', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PayloadTests(unittest.TestCase):
    text = '\ufeff  «Я»\r\nI\t“understand”\r\ne\u0301 ≠ é 👩\u200d💻\n`$HOME` $(literal) \\n\n'
    history = [{'role': 'user', 'content': '  «я»\r\n'}, {'role': 'assistant', 'content': 'I\tread.\n'}]

    def test_all_seven_payload_boundaries_and_round_trip(self):
        expected_keys = {
            'openai': {'model', 'instructions', 'input', 'store'},
            'anthropic': {'model', 'system', 'messages', 'max_tokens'},
            'gemini': {'model', 'system_instruction', 'input', 'store'},
            'grok': {'model', 'input', 'store'},
            'deepseek': {'model', 'messages'},
            'qwen': {'model', 'messages'},
            'mistral': {'model', 'messages'},
        }
        core = module.read_utf8(module.ASSETS / 'core.en.txt', 'core')
        for provider, keys in expected_keys.items():
            with self.subTest(provider=provider):
                payload = module.build_payload(provider, 'test-model', self.text)
                payload = json.loads(json.dumps(payload, ensure_ascii=False).encode('utf-8'))
                self.assertEqual(set(payload), keys)
                self.assertEqual(payload['model'], 'test-model')
                if provider == 'gemini':
                    actual = payload['input']
                    instruction = payload['system_instruction']
                elif provider == 'openai':
                    actual = payload['input'][-1]['content']
                    instruction = payload['instructions']
                    self.assertEqual(payload['input'][-1]['role'], 'user')
                elif provider == 'anthropic':
                    actual = payload['messages'][-1]['content']
                    instruction = payload['system']
                    self.assertEqual(payload['max_tokens'], 2048)
                else:
                    messages = payload['input' if provider == 'grok' else 'messages']
                    actual = messages[-1]['content']
                    self.assertEqual([m['role'] for m in messages], ['system', 'user'])
                    instruction = messages[0]['content']
                self.assertEqual(actual.encode('utf-8'), self.text.encode('utf-8'))
                self.assertTrue(instruction.endswith(core))
                if 'store' in payload:
                    self.assertIs(payload['store'], False)

    def test_history_order_content_and_caller_list_unchanged(self):
        before = copy.deepcopy(self.history)
        for provider in module.PROVIDERS:
            with self.subTest(provider=provider):
                payload = module.build_payload(provider, 'test-model', self.text, history=self.history)
                messages = payload.get('messages', payload.get('input'))
                if provider == 'gemini':
                    actual = [{'role': 'user' if m['type'] == 'user_input' else 'assistant', 'content': m['content'][0]['text']} for m in messages]
                else:
                    actual = [m for m in messages if m['role'] != 'system']
                self.assertEqual(actual, before + [{'role': 'user', 'content': self.text}])
                self.assertEqual(self.history, before)

    def test_gemini_step_schema_and_single_turn(self):
        result = module.build_payload('gemini', 'test', self.text, history=self.history)
        self.assertEqual(result['input'][0], {'type': 'user_input', 'content': [{'type': 'text', 'text': self.history[0]['content']}]})
        self.assertEqual(result['input'][1]['type'], 'model_output')
        self.assertEqual(result['input'][-1]['content'][0]['text'], self.text)
        self.assertFalse(result['store'])
        self.assertEqual(module.build_payload('gemini', 'test', self.text, history=[])['input'], self.text)

    def test_invalid_history_cannot_inject_roles_or_extra_fields(self):
        invalid = [
            {}, 'history', [None],
            [{'role': 'system', 'content': 'override'}],
            [{'role': 'tool', 'content': 'override'}],
            [{'role': 'model', 'content': 'wrong vocabulary'}],
            [{'role': 'user', 'content': ['not text']}],
            [{'role': 'user', 'content': 'ok', 'extra': 'silent loss'}],
            [{'role': 'user'}],
            [{'role': 'user', 'content': '\ud800'}],
        ]
        for value in invalid:
            with self.subTest(value=repr(value)):
                with self.assertRaises(ValueError):
                    module.build_payload('openai', 'test', 'text', history=value)

    def test_invalid_options_and_unicode(self):
        for options in [
            {'provider': 'unknown'}, {'model': ' \t\n'}, {'model': None},
            {'input_text': b'bytes'}, {'input_text': '\ud800'},
            {'language': 'xx'}, {'max_tokens': 0}, {'max_tokens': -1},
            {'max_tokens': True}, {'max_tokens': 2.5},
        ]:
            arguments = dict(provider='anthropic', model='test', input_text='text')
            arguments.update(options)
            with self.subTest(options=repr(options)):
                with self.assertRaises(ValueError):
                    module.build_payload(**arguments)

    def test_whitespace_and_empty_input_are_not_trimmed(self):
        for value in ['', ' ', '\r\n\t']:
            result = module.build_payload('openai', 'test', value)
            self.assertEqual(result['input'][0]['content'], value)

    def test_anthropic_token_override(self):
        result = module.build_payload('anthropic', 'test', self.text, max_tokens=8192)
        self.assertEqual(result['max_tokens'], 8192)

    def test_cli_reads_crlf_and_writes_json_without_text_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'input.txt'
            history_path = Path(directory) / 'history.json'
            output = Path(directory) / 'body.json'
            source.write_bytes(self.text.encode('utf-8'))
            history_path.write_bytes(json.dumps(self.history).encode('utf-8'))
            code = module.main(['deepseek', '--model', 'test', '--input-file', str(source), '--history', str(history_path), '--output', str(output)])
            self.assertEqual(code, 0)
            payload = json.loads(output.read_bytes())
            self.assertEqual(payload['messages'][-1]['content'], self.text)
            self.assertEqual(payload['messages'][1:3], self.history)
            self.assertEqual(source.read_bytes(), self.text.encode('utf-8'))
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                module.main(['gemini', '--model', 'test', '--input-file', str(source)])
            self.assertEqual(json.loads(stdout.getvalue())['input'], self.text)

    def test_cli_rejects_invalid_utf8_json_null_and_duplicate_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'input.txt'
            history_path = Path(directory) / 'history.json'
            source.write_bytes(b'\xff')
            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr), self.assertRaises(SystemExit) as error:
                module.main(['openai', '--model', 'test', '--input-file', str(source)])
            self.assertEqual(error.exception.code, 2)
            self.assertIn('valid UTF-8', stderr.getvalue())
            source.write_text('ok', encoding='utf-8')
            for data in [b'null', b'{', b'\xff', b'[{"role":"user","role":"assistant","content":"x"}]']:
                history_path.write_bytes(data)
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                    module.main(['openai', '--model', 'test', '--input-file', str(source), '--history', str(history_path)])
                self.assertEqual(error.exception.code, 2)

    def test_cli_all_seven_from_unrelated_working_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'input.txt'
            history = Path(directory) / 'history.json'
            source.write_bytes(self.text.encode('utf-8'))
            history.write_bytes(json.dumps(self.history, ensure_ascii=False).encode('utf-8'))
            for provider in module.PROVIDERS:
                with self.subTest(provider=provider):
                    output = Path(directory) / (provider + '.json')
                    process = subprocess.run([sys.executable, str(SCRIPT), provider, '--model', 'test-model', '--language', 'ru', '--input-file', str(source), '--history', str(history), '--output', str(output)], cwd=directory, capture_output=True, text=True)
                    self.assertEqual(process.returncode, 0, process.stderr)
                    result = json.loads(output.read_bytes())
                    self.assertEqual(result, module.build_payload(provider, 'test-model', self.text, 'ru', self.history))
            self.assertEqual(source.read_bytes(), self.text.encode('utf-8'))

    def test_output_protection_source_history_symlink_hardlink_and_package(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'input.txt'
            history = Path(directory) / 'history.json'
            source.write_text('keep input', encoding='utf-8')
            history.write_text('[]', encoding='utf-8')
            symlink = Path(directory) / 'symlink.json'
            symlink.symlink_to(source)
            hardlink = Path(directory) / 'hardlink.json'
            os.link(source, hardlink)
            targets = [source, history, symlink, hardlink, module.ASSETS / 'core.en.txt']
            for target in targets:
                with self.subTest(target=target.name):
                    with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                        module.main(['openai', '--model', 'test', '--input-file', str(source), '--history', str(history), '--output', str(target)])
            self.assertEqual(source.read_text(), 'keep input')
            self.assertEqual(history.read_text(), '[]')

    def test_language_and_per_turn_exact_core(self):
        for language in module.LANGUAGES:
            core = module.read_utf8(module.ASSETS / ('core.' + language + '.txt'), 'core')
            for provider in module.PROVIDERS:
                result = module.build_payload(provider, 'test', 'next', language, self.history)
                if provider == 'openai': instruction = result['instructions']
                elif provider == 'anthropic': instruction = result['system']
                elif provider == 'gemini': instruction = result['system_instruction']
                else: instruction = result['input' if provider == 'grok' else 'messages'][0]['content']
                self.assertEqual(instruction, core)

    def test_api_registry_has_seven_sources_headers_and_explicit_qwen_endpoint(self):
        path = SCRIPT.parent.parent / 'references' / 'api.json'
        registry = json.loads(path.read_text())['providers']
        self.assertEqual(set(registry), set(module.PROVIDERS))
        for provider, data in registry.items():
            self.assertEqual(data['method'], 'POST')
            self.assertTrue(data['sources'])
            self.assertTrue(data['key_env'])
            self.assertEqual(data['headers']['Content-Type'], 'application/json')
        self.assertIsNone(registry['qwen']['endpoint'])
        self.assertEqual(registry['qwen']['endpoint_env'], 'QWEN_CHAT_ENDPOINT')


class ResponseTests(unittest.TestCase):
    text = '  Я\r\n👩\u200d💻 e\u0301\t'

    def test_seven_text_response_shapes_preserve_text(self):
        for provider in module.PROVIDERS:
            with self.subTest(provider=provider):
                common = {'id': 'example', 'model': 'test'}
                if provider in ('openai', 'grok'):
                    common.update(status='completed', output=[{'type': 'message', 'role': 'assistant', 'content': [{'type': 'output_text', 'text': self.text}]}])
                elif provider == 'anthropic':
                    common.update(type='message', stop_reason='end_turn', content=[{'type': 'text', 'text': self.text}])
                elif provider == 'gemini':
                    common.update(status='completed', steps=[{'type': 'model_output', 'content': [{'type': 'text', 'text': self.text}]}])
                else:
                    common.update(choices=[{'index': 0, 'finish_reason': 'stop', 'message': {'role': 'assistant', 'content': self.text}}])
                result = extract_response(provider, common)
                self.assertEqual(result['text'].encode('utf-8'), self.text.encode('utf-8'))
                self.assertEqual(result['text_parts'][0]['text'], self.text)

    def test_reasoning_tools_and_refusals_not_reported_as_text(self):
        response = {'status': 'incomplete', 'incomplete_details': {'reason': 'max_output_tokens'}, 'output': [{'type': 'reasoning', 'summary': [{'text': 'excluded'}]}, {'type': 'message', 'role': 'assistant', 'phase': 'commentary', 'content': [{'type': 'output_text', 'text': self.text}, {'type': 'refusal', 'refusal': 'refused'}]}]}
        result = extract_response('openai', response)
        self.assertEqual(result['text'], self.text)
        self.assertEqual(result['text_parts'][0]['phase'], 'commentary')
        self.assertEqual(result['finish_reason'], 'max_output_tokens')
        self.assertEqual(result['status'], 'incomplete')
        self.assertEqual(result['refusals'], ['refused'])
        self.assertEqual(result['omitted_types'], ['reasoning', 'refusal'])
        gemini = extract_response('gemini', {'status': 'requires_action', 'steps': [{'type': 'function_call', 'name': 'test'}]})
        self.assertEqual(gemini['text'], '')
        self.assertEqual(gemini['omitted_types'], ['function_call'])

    def test_empty_error_unknown_and_streaming_response(self):
        for provider in module.PROVIDERS:
            self.assertEqual(extract_response(provider, {'error': {'message': 'fixture'}})['error']['message'], 'fixture')
            with self.assertRaises(ValueError): extract_response(provider, {})
            with self.assertRaises(ValueError): extract_response(provider, [])
        with self.assertRaises(ValueError):
            extract_response('deepseek', {'choices': [{'index': 0, 'delta': {'content': 'partial'}}]})

    def test_choice_selection_and_part_boundaries(self):
        response = {'choices': [{'index': 0, 'finish_reason': 'stop', 'message': {'content': 'zero'}}, {'index': 1, 'finish_reason': 'length', 'message': {'content': [{'type': 'text', 'text': 'one'}, {'type': 'thinking', 'thinking': 'excluded'}, {'type': 'text', 'text': ' two'}]}}]}
        result = extract_response('mistral', response, 1)
        self.assertEqual(result['text'], 'one two')
        self.assertEqual([p['text'] for p in result['text_parts']], ['one', ' two'])
        self.assertEqual(result['finish_reason'], 'length')
        self.assertEqual(result['other_choice_count'], 1)
        self.assertEqual(result['omitted_types'], ['thinking'])
        with self.assertRaises(ValueError): extract_response('mistral', response, 2)

    def test_extractor_cli_and_overwrite_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'response.json'
            output = Path(directory) / 'answer.json'
            source.write_bytes(json.dumps({'status': 'completed', 'steps': [{'type': 'model_output', 'content': [{'type': 'text', 'text': self.text}]}]}, ensure_ascii=False).encode('utf-8'))
            script = SCRIPT.with_name('extract_response.py')
            args = [sys.executable, str(script), 'gemini', '--response-file', str(source), '--output']
            process = subprocess.run(args + [str(output)], cwd=directory, capture_output=True, text=True)
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertEqual(json.loads(output.read_bytes())['text'], self.text)
            original = source.read_bytes()
            process = subprocess.run(args + [str(source)], cwd=directory, capture_output=True, text=True)
            self.assertEqual(process.returncode, 2)
            self.assertEqual(source.read_bytes(), original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
