#!/usr/bin/env python3
"""Build static /model/ RU/EN pages and exact downloads. No network or deployment.

--output DIR creates DIR/public_html. --github-url is optional and must identify
an existing repository chosen for publication; omission hides the GitHub link.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlparse

import build_guide
from package_plugins import build_bundles, skill_text
from render_report import parse_report
import public_updates

ROOT = Path(__file__).resolve().parents[1]
SHELL_STYLES = ('site-reader-20260920.css', 'paper-theme-20260920.css', 'paper-layout-20260920.css')
APP_URLS = (
    ('ChatGPT', 'https://chatgpt.com/'), ('Claude', 'https://claude.ai/'),
    ('Gemini', 'https://gemini.google.com/app'), ('Grok', 'https://grok.com/'),
    ('DeepSeek', 'https://chat.deepseek.com/'), ('Qwen', 'https://chat.qwen.ai/'),
    ('Mistral Le Chat', 'https://chat.mistral.ai/'),
    ('Perplexity', 'https://www.perplexity.ai/'),
    ('Microsoft Copilot', 'https://copilot.microsoft.com/'),
)
COPY = {
 'ru': {
  'title':'beforeword для ИИ — начать в своём чате',
  'description':'Добавь beforeword в свой ИИ-чат. Полная инструкция, настройки приложений, навыки и API: на русском и английском.',
  'skip':'К содержимому','home_label':'beforeword — главная','nav_label':'Разделы сайта','menu':'Меню','language_label':'Язык',
  'hero_label':'ДЛЯ ИИ','headline':'Сначала написанное.',
  'intro':'Добавь beforeword в свой ИИ-чат: инструкция просит сохранять исходный текст, отделять добавленное прочтением и применять тот же разбор к ответу.',
  'self_scope':'beforeword, его правила и этот текст тоже входят в разбор. Ни одна словесная написанная форма не получает исключения.',
  'start':'Начать в своём чате','quick_label':'ТРИ ШАГА','quick_title':'Скопируй. Вставь. Задай вопрос.',
  'step1':'Скопируй инструкцию','copy_full':'Скопировать для чата','download_txt':'Скачать TXT',
  'full_note':'Полная инструкция. Для этого способа файл скачивать не требуется.',
  'no_js':'Кнопка копирования требует JavaScript. Открой «Прочитать полную инструкцию» ниже, выдели текст и скопируй вручную. Также доступен TXT.',
  'step2':'Открой свой ИИ-чат','open_note':'Выбери приложение, которым пользуешься. Ссылка открывает его в новой вкладке.',
  'apps_label':'Открыть ИИ-приложение','step3':'Вставь в новый разговор',
  'paste_note':'Отправь инструкцию первым сообщением. Следующим сообщением задай свой вопрос или пришли текст для разбора.',
  'chat_scope':'Инструкция передаётся в этот разговор, пока она доступна в его контексте. Для нового разговора вставь её снова или используй настройку приложения ниже. Согласие модели и сообщение «режим включён» не заменяют чтение ответа.',
  'read_instruction':'Прочитать полную инструкцию','characters':'знаков',
  'example_label':'ОДИН ПРИМЕР','example_title':'Что добавляет ответ?',
  'example_note':'Пример составлен для этой страницы. Это пояснение способа чтения, а не результат испытания модели.',
  'input_label':'Запрос после инструкции','example_prompt':'Разбери фразу: «Я понимаю».',
  'copy_example':'Скопировать запрос','reading_label':'Пример разбора',
  'example_reading':'В исходной фразе написано «Я понимаю». Её можно прочитать как сообщение о понимании. Такое прочтение добавляет отношение между написанными словами и приписанным пониманием. Слова «сообщение», «отношение» и «понимание» в этом объяснении также составляют новую запись.',
  'criterion':'При чтении ответа сопоставь точность исходной фразы, названное прочтение и добавленные объяснением слова. Разбор должен включать собственное объяснение и отвечать на поставленный запрос. Код, точная цитата или JSON могут возвращаться без дополнительного комментария; они остаются в охвате beforeword.',
  'settings_title':'Сохранить в приложении','settings_intro':'Для повторного использования выбери своё приложение. Настройки аккаунта, проекта и отдельного разговора имеют разную область действия. Сохрани другие нужные настройки и используй одну актуальную инструкцию beforeword.',
  'compact_label':'Краткая инструкция для небольшого поля','copy_compact':'Скопировать краткую',
  'stop_title':'Как остановить или удалить',
  'stop_copy':'Если инструкция была отправлена только сообщением, начни новый разговор без неё. Если она сохранена в настройках приложения или проекта, сначала удали её оттуда. Установленный навык отключается в управлении навыками или плагинами. Уже отправленные сообщения остаются в прежнем разговоре.',
  'advanced_title':'Навыки, плагины и API','advanced_intro':'Для вызова навыка по задаче или подключения в собственном приложении. Этот раздел не требуется для трёх шагов выше.',
  'advanced_open':'Открыть варианты подключения и скачивания','open_toolkit':'Открыть расширенное руководство',
  'toolkit_note':'Руководство с переключателем RU / EN: способы подключения, инструкции установки и локальный конструктор JSON для API. Можно сохранить HTML и пользоваться им без сети.',
  'native_note':'Скачивание не устанавливает пакет. Порядок установки, вызова, обновления и удаления находится в README каждого архива. Доступность импорта зависит от приложения и аккаунта. На телефоне начни с инструкции в чате.',
  'checks_title':'Методика и проверки','checks_copy':'Как проверять ответы, какие ошибки обнаружены и на что распространяются результаты.',
  'version_line':'Версия инструкции: {version}.',
  'data_title':'Исходные данные и проверка скачиваний',
  'privacy':'Страница не отправляет введённые данные и не содержит аналитики. Копирование выполняется в браузере. Переход в приложение или передача ему текста регулируются условиями этого сервиса.',
  'top':'К началу','copied':'Скопировано. Вставь текст в выбранном приложении.','selected':'Текст выделен. Выбери «Копировать» в меню устройства или нажми Ctrl/Cmd+C.','copy_failed':'Выдели нужный текст и скопируй вручную. Инструкции также доступны по ссылкам «Скачать TXT».',
  'full_link':'Полная инструкция','compact_link':'Краткая инструкция','documentation':'Документация','use_full':'Используй полную инструкцию для выбранного проекта или разговора.','use_compact':'Используй краткую инструкцию для поля настроек.',
  'github':'Исходники на GitHub',
  'downloads':{'openai':('Codex · ZIP','Локальный пакет для desktop / CLI.'),'claude':('Claude · ZIP','Для поддерживаемого импорта плагинов и Claude Code.'),'skill':('Навык · ZIP','SKILL.md и README для поддерживаемых сред.')},
  'toolkit_download':'Инструменты и исходники · ZIP','toolkit_download_note':'Инструкции, Python CLI и тестовые примеры.',
  'report_titles':['Прочитать методику и результаты','Скачать сравнение прежних редакций · JSON','Скачать сведения о файлах · JSON','Скачать контрольные суммы · TXT'],
 },
 'en': {
  'title':'beforeword for AI — start in your own chat',
  'description':'Add beforeword to your AI chat. Full instructions, app settings, skills, and API tools in English and Russian.',
  'skip':'Skip to content','home_label':'beforeword — home','nav_label':'Site sections','menu':'Menu','language_label':'Language',
  'hero_label':'FOR AI','headline':'Start with the writing.',
  'intro':'Add beforeword to your AI chat. The instructions ask it to preserve the supplied text, separate what a reading adds, and apply the same examination to its own response.',
  'self_scope':'beforeword, its rules, and this page are included. No written verbal form is exempt.',
  'start':'Start in your own chat','quick_label':'THREE STEPS','quick_title':'Copy. Paste. Ask.',
  'step1':'Copy the instructions','copy_full':'Copy for a chat','download_txt':'Download TXT',
  'full_note':'Full instructions. This method does not require downloading a file.',
  'no_js':'The copy button requires JavaScript. Open “Read the full instructions” below, select the text, and copy it manually. A TXT download is also available.',
  'step2':'Open your AI chat','open_note':'Choose the app you use. Each link opens it in a new tab.',
  'apps_label':'Open an AI app','step3':'Paste into a new conversation',
  'paste_note':'Send the instructions as the first message. Send your question or the text to examine in the next message.',
  'chat_scope':'The instructions are supplied to this conversation while they remain available in its context. Paste them again in a new conversation, or use the app settings below. Model agreement or a “mode activated” message does not replace examining its response.',
  'read_instruction':'Read the full instructions','characters':'characters',
  'example_label':'ONE EXAMPLE','example_title':'What does a response add?',
  'example_note':'This example was written for this page to explain the reading method. It is not a model test result.',
  'input_label':'A request after the instructions','example_prompt':'Examine the phrase “I understand”.',
  'copy_example':'Copy the request','reading_label':'An example reading',
  'example_reading':'The supplied phrase says “I understand”. It can be read as a statement of understanding. That reading adds a relation between the written words and the understanding attributed to them. The terms “statement”, “relation”, and “understanding” in this explanation also form a new written record.',
  'criterion':'Compare the response with the exact supplied phrase, the reading it names, and the terms its explanation adds. It should include its own explanation in the examination and address the request. Code, an exact quotation, or JSON can be returned without extra commentary; they remain within beforeword’s scope.',
  'settings_title':'Save in your app','settings_intro':'For repeated use, choose your app. Account settings, project instructions, and a single conversation have different scopes. Keep other settings you need and use one current beforeword instruction.',
  'compact_label':'Compact instructions for a smaller field','copy_compact':'Copy compact instructions',
  'stop_title':'How to stop or remove it',
  'stop_copy':'If the instructions were sent only as a message, start a new conversation without them. If you saved them in app or project settings, remove them there first. Disable an installed skill through the app’s skill or plugin controls. Messages already sent remain in the previous conversation.',
  'advanced_title':'Skills, plugins, and API','advanced_intro':'For invoking a skill on a task or adding beforeword to your own application. This section is optional for the three steps above.',
  'advanced_open':'Show connection options and downloads','open_toolkit':'Open the advanced guide',
  'toolkit_note':'The guide opens with an RU / EN language switch: connection methods, installation steps, and a local API JSON builder. You can save the HTML and use it offline.',
  'native_note':'Downloading a package does not install it. Each archive’s README covers installation, invocation, updating, and removal. Import availability depends on the app and account. On a phone, start with the chat instructions.',
  'checks_title':'Method and checks','checks_copy':'How to examine responses, which errors were found, and what the results cover.',
  'version_line':'Instruction version: {version}.',
  'data_title':'Source data and download verification',
  'privacy':'This page does not transmit entered data or include analytics. Copying takes place in your browser. Opening another app or sending text to it is subject to that service’s terms.',
  'top':'Back to top','copied':'Copied. Paste the text in your chosen app.','selected':'Text selected. Choose Copy from your device menu or press Ctrl/Cmd+C.','copy_failed':'Select the text and copy it manually. The instructions are also available through the “Download TXT” links.',
  'full_link':'Full instructions','compact_link':'Compact instructions','documentation':'Documentation','use_full':'Use the full instructions for the selected project or conversation.','use_compact':'Use the compact instructions for the settings field.',
  'github':'Source on GitHub',
  'downloads':{'openai':('Codex · ZIP','A local package for desktop / CLI.'),'claude':('Claude · ZIP','For supported plugin uploads and Claude Code.'),'skill':('Skill · ZIP','SKILL.md and a README for supported environments.')},
  'toolkit_download':'Tools and source files · ZIP','toolkit_download_note':'Instructions, Python CLI, and test cases.',
  'report_titles':['Read the method and results','Download earlier instruction comparison · JSON','Download file information · JSON','Download checksums · TXT'],
 },
}

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()

def public_asset_name(extension: str) -> str:
    digest = sha((ROOT/'assets'/f'public.{extension}').read_bytes())[:12]
    return f'public-{build_guide.VERSION}-{digest}.{extension}'

def shell_revision() -> str:
    sources = sorted((ROOT/'assets'/'site-shell').iterdir())
    content = b''.join(path.name.encode('utf-8')+b'\0'+path.read_bytes()+b'\0' for path in sources if path.is_file())
    return sha(content)[:12]

def shell_asset_url(name: str) -> str:
    return f'/model/assets/site-shell/{shell_revision()}/{name}'

def escape(value: object) -> str:
    return html.escape(str(value), quote=True)

def github_url(value: str) -> str:
    p = urlparse(value)
    if p.scheme != 'https' or p.netloc != 'github.com' or p.query or p.fragment or not re.fullmatch(r'/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?', p.path):
        raise argparse.ArgumentTypeError('GitHub URL must be https://github.com/owner/repository')
    return value.rstrip('/')

def nav(language: str, footer: bool = False, current: str = 'page') -> str:
    labels = ['Исследования','Текст','Записи','Музыка','О beforeword','Для ИИ'] if language == 'ru' else ['Research','Text','Notes','Music','About','For AI']
    paths = ['research','text','notes','music','about','model']
    if footer:
        labels.insert(-1, 'Поддержать' if language == 'ru' else 'Support')
        paths.insert(-1, 'support')
    links = ''.join('<a'+(' aria-current="'+current+'"' if path == 'model' else '')+' href="/'+path+('/en/' if language == 'en' else '/')+'">'+escape(label)+'</a>' for path,label in zip(paths,labels))
    if footer:
        links = '<a href="'+('/en/plain/' if language == 'en' else '/plain/')+'">'+('In plain English' if language == 'en' else 'Простыми словами')+'</a>'+links
    return links

def settings(language: str, connectors: list[dict]) -> str:
    t = COPY[language]
    output = []
    for item in connectors:
        v = item[language]
        mode = item.get('recommended', 'core')
        is_compact = mode == 'compact'
        target = '/model/beforeword-'+('compact-' if is_compact else '')+language+'.txt'
        label = t['compact_link'] if is_compact else t['full_link']
        source_id = 'compact-text' if is_compact else 'instruction-text'
        details_id = 'compact-details' if is_compact else 'instruction-details'
        copy_label = t['copy_compact'] if is_compact else ('Скопировать полную' if language == 'ru' else 'Copy full instructions')
        instruction_name = ('краткую инструкцию' if is_compact else 'полную инструкцию') if language == 'ru' else ('the compact instructions' if is_compact else 'the full instructions')
        def step_text(step: str) -> str:
            return step.replace('показанную ниже инструкцию',instruction_name).replace('показанную инструкцию',instruction_name).replace('the instructions shown below',instruction_name)
        steps = ''.join('<li>'+escape(step_text(step))+'</li>' for step in v['steps'])
        sources = ''.join('<a class="text-link" href="'+escape(s['url'])+'" target="_blank" rel="noopener noreferrer">'+escape(t['documentation'])+' '+str(i+1)+'</a> ' for i,s in enumerate(item.get('sources',[])))
        copy_action = '<div class="actions"><button type="button" class="button js-only" data-copy-target="'+source_id+'" data-copy-details="'+details_id+'">'+escape(copy_label)+'</button><a href="'+target+'" class="text-link" download>'+escape(label)+' · TXT</a></div>'
        output.append('<details class="app-settings"><summary>'+escape(item['name'])+'</summary>'+copy_action+'<p>'+escape(v['route'])+'</p><ol>'+steps+'</ol><p class="small">'+escape(v['scope'])+'</p><p class="small">'+escape(v['limit'])+'</p><div class="actions">'+sources+'</div></details>')
    return '\n'.join(output)

def render(language: str, bundles: dict, connectors: list[dict], repo_url: str | None, *, evaluation: bool = False) -> str:
    t = dict(COPY[language])
    route = '/model/evaluation/' if evaluation else '/model/'
    report_content = ''
    if evaluation:
        source = 'references/evaluation.ru.md' if language == 'ru' else 'references/evaluation.md'
        report_title, report_content = parse_report(read(source))
        t['title'] = report_title
        t['description'] = ('Методика чтения ответов, сохранённые сравнения и технические проверки beforeword.' if language == 'ru' else 'Reading criteria, recorded comparisons, and technical checks for beforeword.')
    full = read(f'assets/scope.{language}.txt').rstrip('\n')+'\n\n'+read(f'assets/core.{language}.txt')
    compact = read(f'assets/compact.{language}.txt')
    values = {key.upper():escape(value) for key,value in t.items() if isinstance(value,str)}
    values.update({'LANG':language,'VERSION':escape(build_guide.VERSION),'LOCALE':'ru_RU' if language == 'ru' else 'en_US',
        'CANONICAL':'https://beforeword.xyz'+route+('en/' if language == 'en' else ''),
        'ALTERNATE_RU_URL':'https://beforeword.xyz'+route,
        'ALTERNATE_EN_URL':'https://beforeword.xyz'+route+'en/',
        'HOME_URL':'/en/' if language == 'en' else '/',
        'CSS_URL':'/model/assets/'+public_asset_name('css'),'JS_URL':'/model/assets/'+public_asset_name('js'),
        'SHELL_STYLES':'\n'.join('<link rel="stylesheet" href="'+shell_asset_url(name)+'">' for name in SHELL_STYLES),
        'SHELL_JS_URL':shell_asset_url('site-reader-20260920.js'),
        'FAVICON_URL':shell_asset_url('favicon-paper-20260920.svg'),
        'TOOLKIT_URL':'/model/toolkit/beforeword_AI.html#'+language,
        'FULL_TEXT':escape(full),'COMPACT_TEXT':escape(compact),
        'FULL_COUNT':f'{len(full):,} {t["characters"]}'.replace(',','\u2009'),
        'COMPACT_COUNT':f'{len(compact):,} {t["characters"]}'.replace(',','\u2009'),
        'NAV':nav(language,current='location' if evaluation else 'page'),'SETTINGS_ROUTES':settings(language,connectors),
        'FOOTER_NAV':nav(language,footer=True,current='location' if evaluation else 'page'),
        'APP_LINKS':''.join('<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+escape(name)+'</a>' for name,url in APP_URLS),
        'LANGUAGES':('<span lang="ru" aria-current="page">RU</span><span aria-hidden="true">/</span><a href="'+route+'en/" hreflang="en" lang="en">EN</a>' if language == 'ru' else '<a href="'+route+'" hreflang="ru" lang="ru">RU</a><span aria-hidden="true">/</span><span lang="en" aria-current="page">EN</span>'),
        'VERSION_LINE':escape(t['version_line'].format(version=build_guide.VERSION,date=build_guide.DATE)),
    })
    cards = []
    for key,record in bundles.items():
        label,note = t['downloads'][key]
        cards.append('<div class="card"><a href="/model/downloads/'+escape(record['name'])+'" download>'+escape(label)+' · '+language.upper()+'</a><small>'+escape(note)+'</small></div>')
    cards.append('<div class="card"><a href="/model/downloads/beforeword_toolkit.zip" download>'+escape(t['toolkit_download'])+'</a><small>'+escape(t['toolkit_download_note'])+'</small></div>')
    values['DOWNLOADS']=''.join(cards)
    values['GITHUB']=('<p><a class="button" href="'+escape(repo_url)+'" target="_blank" rel="noopener noreferrer">'+escape(t['github'])+'</a></p>') if repo_url else ''
    report_paths = ['/model/evaluation/'+('en/' if language == 'en' else ''),'/model/reports/validation-2026-10-02.json','/model/release.json','/model/SHA256SUMS.txt']
    links=['<li><a href="'+path+'"'+(' download' if index else '')+'>'+escape(label)+'</a></li>' for index,(path,label) in enumerate(zip(report_paths,t['report_titles']))]
    values['REPORT_LINKS']=links[0]
    values['DATA_LINKS']=''.join(links[1:])
    values['UPDATES_HEAD'] = '' if evaluation else public_updates.head(language)
    values['PUBLIC_UPDATES'] = '' if evaluation else public_updates.render(language)
    template = read('assets/public.template.html')
    if evaluation:
        back_url = '/model/'+('en/' if language == 'en' else '')+'#checks'
        back_label = 'Вернуться к инструкции для ИИ' if language == 'ru' else 'Back to the AI instructions'
        download_label = 'Скачать текст методики · MD' if language == 'ru' else 'Download the method · MD'
        main = ('<main id="main" tabindex="-1">\n'
                '<div class="report-heading"><a class="text-link" href="'+back_url+'">'+back_label+'</a>'
                '<h1 id="title">'+escape(report_title)+'</h1></div>\n'
                '<article id="evaluation-content" class="report-prose" aria-labelledby="title">'+report_content+'</article>\n'
                '<div class="report-download"><a class="text-link" href="/model/reports/evaluation.'+language+'.md" download="evaluation.'+language+'.md">'+download_label+'</a></div>\n'
                '</main>')
        template, count = re.subn(r'<main id="main" tabindex="-1">.*?</main>',lambda _:main,template,flags=re.S)
        if count != 1:
            raise ValueError('Public template must contain exactly one main element.')
        template = template.replace('model-page"','model-page model-report"')
        template = template.replace('<script src="__JS_URL__" defer></script>\n','')
        template = re.sub(r'<p class="copy-status"[^>]*></p>\n','',template)
    result = re.sub(r'__([A-Z][A-Z0-9_]+)__',lambda m:values[m.group(1)],template)
    if re.search(r'__[A-Z][A-Z0-9_]+__',result):
        raise ValueError('unresolved public template placeholder')
    return result

def build(output: Path, repo_url: str | None = None) -> Path:
    output = output.resolve()
    for owned in ('assets','references','scripts','docs','.github'):
        source_root = ROOT / owned
        if output == source_root or source_root in output.parents:
            raise ValueError('Output must not be inside a source directory included in the toolkit.')
    site = output / 'public_html'
    model = site / 'model'
    previous_manifest = model / 'release.json'
    if previous_manifest.exists() and json.loads(previous_manifest.read_text(encoding='utf-8')).get('version') != build_guide.VERSION:
        raise ValueError('Use a new output directory for a different release version; existing artifacts were not removed.')
    downloads = model / 'downloads'
    for directory in (model,downloads,model/'en',model/'assets',model/'reports'):
        directory.mkdir(parents=True,exist_ok=True)
    guide_path = build_guide.build(model/'toolkit')
    guide_data = json.loads(re.search(r'<script id="bundle-data" type="application/json">(.*?)</script>',guide_path.read_text(encoding='utf-8'),re.S).group(1))
    (downloads/'beforeword_toolkit.zip').write_bytes(base64.b64decode(guide_data['developer']['data']))
    connectors = json.loads(read('references/connectors.json'))
    aliases = {}
    for language in ('ru','en'):
        full = read(f'assets/scope.{language}.txt').rstrip('\n')+'\n\n'+read(f'assets/core.{language}.txt')
        compact = read(f'assets/compact.{language}.txt')
        for prefix,content,source in (('',full,'full'),('full-',full,'full'),('compact-',compact,'compact'),('micro-',compact,'compact')):
            filename=f'beforeword-{prefix}{language}.txt'
            (model/filename).write_text(content,encoding='utf-8')
            aliases[filename]={'language':language,'content':source,'sha256':sha(content.encode('utf-8'))}
        (downloads/f'beforeword-SKILL-{language}.md').write_text(skill_text(language),encoding='utf-8')
        bundles=build_bundles(language,version=build_guide.VERSION)
        for record in bundles.values():
            (downloads/record['name']).write_bytes(record['bytes'])
        destination=model/'index.html' if language == 'ru' else model/'en'/'index.html'
        destination.write_text(render(language,bundles,connectors,repo_url),encoding='utf-8')
        source = 'references/evaluation.ru.md' if language == 'ru' else 'references/evaluation.md'
        shutil.copyfile(ROOT/source,model/'reports'/f'evaluation.{language}.md')
        report_directory = model/'evaluation'/('en' if language == 'en' else '')
        report_directory.mkdir(parents=True,exist_ok=True)
        (report_directory/'index.html').write_text(render(language,bundles,connectors,repo_url,evaluation=True),encoding='utf-8')
    for name in ('evaluation-results.json','validation-2026-10-02.json','eval-cases.jsonl'):
        shutil.copyfile(ROOT/'references'/name,model/'reports'/name)
    for ext in ('css','js'):
        shutil.copyfile(ROOT/'assets'/f'public.{ext}',model/'assets'/public_asset_name(ext))
    public_updates.write_assets(model)
    shutil.copytree(ROOT/'assets'/'site-shell',model/'assets'/'site-shell'/shell_revision(),dirs_exist_ok=True)
    shutil.copytree(ROOT/'assets'/'history',model/'history',dirs_exist_ok=True)
    manifest={'version':build_guide.VERSION,'date_utc':build_guide.DATE,'public_paths':['/model/','/model/en/','/model/evaluation/','/model/evaluation/en/'],
        'github_url':repo_url,'aliases':aliases,'micro_alias_note':'Legacy micro URLs serve the current compact instruction, not a separate edition.',
        'historical_pages':['/model/history/2026-09-28/','/model/history/2026-09-28/en/'],
        'history_manifest':'history/2026-09-28/snapshot.json',
        'artifact_checksums':'SHA256SUMS.txt','guide_manifest':'toolkit/beforeword_release.json'}
    (model/'release.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    checksum_lines=[]
    for path in sorted(model.rglob('*')):
        if path.is_file() and path.name != 'SHA256SUMS.txt':
            checksum_lines.append(sha(path.read_bytes())+'  '+path.relative_to(model).as_posix())
    (model/'SHA256SUMS.txt').write_text('\n'.join(checksum_lines)+'\n',encoding='utf-8')
    return site

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--github-url',type=github_url,help='Approved public repository URL; omit to hide the GitHub link.')
    args=parser.parse_args()
    print(build(args.output,args.github_url))
