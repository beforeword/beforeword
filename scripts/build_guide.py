#!/usr/bin/env python3
"""Build the standalone beforeword guide and text exports without network access."""
from __future__ import annotations
import argparse
import base64
import hashlib
import html
import io
import json
from pathlib import Path
import stat
import zipfile
from package_plugins import build_bundles, skill_text
from render_report import parse_report

ROOT = Path(__file__).resolve().parents[1]
VERSION = '1.2.4'
DATE = '2026-10-03'

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def evaluation_html(source, language):
    title, body = parse_report(source)
    body = body.replace('href="/model/reports/', 'href="https://beforeword.xyz/model/reports/')
    body = body.replace('report-section-', 'evaluation-'+language+'-section-')
    body = body.replace('<h2', '<h4').replace('</h2>', '</h4>')
    return '<h3>'+html.escape(title)+'</h3>\n'+body

def source_bundle():
    files = {}
    for folder in ('assets', 'references', 'scripts', 'docs', '.github'):
        for path in sorted((ROOT / folder).rglob('*')):
            if path.is_file() and path.suffix in ('.py', '.cjs', '.md', '.txt', '.json', '.jsonl', '.html', '.svg', '.css', '.js', '.yml', '.yaml', '.woff', '.woff2', '.png') and path.name != 'release.json':
                files[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    files['SKILL.md'] = (ROOT / 'SKILL.md').read_bytes()
    for name in ('README.md', 'README.ru.md', 'CHANGELOG.md', 'LICENSE', 'LICENSE.txt', 'LICENSE.md', '.gitignore'):
        path = ROOT / name
        if path.is_file():
            files[name] = path.read_bytes()
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path, content in sorted(files.items()):
            info = zipfile.ZipInfo('beforeword/' + path, (2026, 10, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, content)
    raw = out.getvalue()
    return {'name': 'beforeword_toolkit.zip', 'data': base64.b64encode(raw).decode(),
            'sha256': hashlib.sha256(raw).hexdigest(), 'files': sorted(files)}

def fallback(data):
    esc = html.escape
    sections = ['<div class="static-fallback"><p>JavaScript не выполняется. Ниже — все инструкции для ручного копирования. / JavaScript is unavailable. All instructions are below for manual copying.</p>']
    for lang in ('ru', 'en'):
        sections.append('<section lang="'+lang+'"><h2>'+('Инструкции · RU' if lang == 'ru' else 'Instructions · EN')+'</h2>')
        sections.append('<p>'+('Выбери один способ: настройка ответов, навык или API. Не требуется устанавливать всё. Полная инструкция раскрывает больше различий; краткая предназначена для ограниченного поля.' if lang == 'ru' else 'Choose one route: response settings, a skill, or API. These are alternatives. The full instruction covers more distinctions; the compact text is intended for limited fields.')+'</p>')
        sections.append('<h3>'+('Краткая инструкция' if lang == 'ru' else 'Compact instructions')+'</h3><pre>'+esc(data['compact'][lang])+'</pre>')
        sections.append('<h3>'+('Инструкция до 5 000 знаков' if lang == 'ru' else 'Instructions up to 5,000 characters')+'</h3><pre>'+esc(data['medium'][lang])+'</pre>')
        sections.append('<details><summary>'+('Полная инструкция' if lang == 'ru' else 'Full instructions')+'</summary><pre>'+esc(data['scope'][lang]+data['core'][lang])+'</pre></details>')
        for c in data['connectors']:
            v = c[lang]
            sections.append('<details><summary>'+esc(c['name'])+'</summary><p>'+esc(v['route'])+'</p><ol>'+''.join('<li>'+esc(step)+'</li>' for step in v['steps'])+'</ol><p>'+esc(v['scope'])+'</p><p>'+esc(v['limit'])+'</p></details>')
        report_body = data['evaluationHtmlRu' if lang == 'ru' else 'evaluationHtml'].replace('evaluation-'+lang+'-section-', 'fallback-evaluation-'+lang+'-section-')
        sections.append('<details><summary>'+('Методика и выполненные проверки' if lang == 'ru' else 'Method and completed checks')+'</summary><article class="evaluation-report">'+report_body+'</article><p class="small">'+('Методика доступна без интернета. Для открытия исходных файлов по ссылкам нужно подключение.' if lang == 'ru' else 'The method is available offline. Opening the linked source files requires an internet connection.')+'</p></details>')
        sections.append('<p>'+('Для загрузки пакетов навыков и работы с API открой этот HTML в браузере с JavaScript. Текст выше можно выделить и скопировать из предварительного просмотра.' if lang == 'ru' else 'For skill package downloads and the API builder, open this HTML in a browser with JavaScript. The text above can be selected and copied from a file preview.')+'</p></section>')
    sections.append('</div>')
    return '\n'.join(sections)

def build(output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    data = {'version':VERSION, 'date':DATE,
            'core':{lang:read(f'assets/core.{lang}.txt') for lang in ('ru','en')},
            'compact':{lang:read(f'assets/compact.{lang}.txt') for lang in ('ru','en')},
            'medium':{lang:read(f'assets/medium.{lang}.txt') for lang in ('ru','en')},
            'scope':{lang:read(f'assets/scope.{lang}.txt').rstrip('\n')+'\n\n' for lang in ('ru','en')},
            'connectors':json.loads(read('references/connectors.json')),
            'api':json.loads(read('references/api.json'))['providers'],
            'skill':{lang:skill_text(lang) for lang in ('ru','en')},
            'eval':read('references/eval-cases.jsonl'),
            'evaluation':read('references/evaluation.md'),
            'evaluationRu':read('references/evaluation.ru.md'),
            'bundles':{}}
    data['evaluationHtml'] = evaluation_html(data['evaluation'], 'en')
    data['evaluationHtmlRu'] = evaluation_html(data['evaluationRu'], 'ru')
    for lang in ('ru','en'):
        data['bundles'][lang] = {}
        for key, record in build_bundles(lang, version=VERSION).items():
            data['bundles'][lang][key] = {k:v for k,v in record.items() if k not in ('bytes','file_contents')}
            data['bundles'][lang][key]['data'] = base64.b64encode(record['bytes']).decode()
    sources = {}
    for c in data['connectors']:
        for s in c['sources']: sources[s['url']] = s
    for provider in data['api'].values():
        for url in provider['sources']: sources.setdefault(url, {'title':url, 'url':url})
    data['sources'] = list(sources.values())
    data['developer'] = source_bundle()
    serialized = json.dumps(data, ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    result = read('assets/guide.template.html').replace('__DATA__', serialized).replace('__STATIC_FALLBACK__', fallback(data)).replace('__EVALUATION_RU__', data['evaluationHtmlRu']).replace('__EVALUATION_EN__', data['evaluationHtml'])
    if any(token in result for token in ('__DATA__', '__STATIC_FALLBACK__', '__EVALUATION_RU__', '__EVALUATION_EN__')):
        raise ValueError('unresolved template placeholder')
    path = output / 'beforeword_AI.html'
    path.write_text(result, encoding='utf-8')
    for lang in ('ru','en'):
        (output / f'beforeword_compact_{lang.upper()}.txt').write_text(data['compact'][lang], encoding='utf-8')
        (output / f'beforeword_5000_{lang.upper()}.txt').write_text(data['medium'][lang], encoding='utf-8')
        (output / f'beforeword_core_{lang.upper()}.txt').write_text(data['scope'][lang]+data['core'][lang], encoding='utf-8')
    report = json.loads(read('references/evaluation-results.json'))
    followup = json.loads(read('references/validation-2026-10-02.json'))
    current = json.loads(read('references/validation-1.2.4.json'))
    manifest = {'version':VERSION, 'date_utc':DATE, 'families':[c['id'] for c in data['connectors']],
      'core_sha256':{k:sha(v) for k,v in data['core'].items()},
      'compact_characters':{k:len(v) for k,v in data['compact'].items()},
      'medium_characters':{k:len(v) for k,v in data['medium'].items()},
      'medium_sha256':{k:sha(v) for k,v in data['medium'].items()},
      'native_bundles':{lang:{key:{k:v for k,v in record.items() if k!='data'} for key,record in bundles.items()} for lang,bundles in data['bundles'].items()},
      'developer_bundle':{k:v for k,v in data['developer'].items() if k!='data'},
      'guide_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
      'evaluation_scope':'Current 1.2.4 development run: 72 responses in six shared batch contexts; earlier runs are retained separately. No provider comparison or promise of future behavior.',
      'evaluation':report['method'], 'evaluation_case_count':len(data['eval'].strip().splitlines()),
      'evaluation_runs':[
        {'report':'references/evaluation-results.json', 'condition':'authored fixtures and targeted follow-up', 'method':report['method']},
        {'report':'references/validation-2026-10-02.json', 'answers':180, 'method':followup['method']},
        {'report':'references/validation-1.2.4.json', 'answers':72, 'method':current['method']}
      ]}
    (output / 'beforeword_release.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return path

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args()
    print(build(args.output))
