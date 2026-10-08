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
  'intro':'«Я согласен» — написанная строка. Ниже она повторяется дважды. Сравни задания, после которых она появляется.',
  'first_label':'СОСТАВЛЕННЫЙ ПРИМЕР',
  'first_title':'Одна строка — разные задания',
  'first_task_a':'Задание А',
  'first_task_b':'Задание Б',
  'first_task_a_text':'Напиши «Я согласен», только если принимаешь предложение.',
  'first_task_b_text':'Скопируй «Я согласен», чтобы выполнить задание, независимо от твоего отношения к предложению.',
  'first_answer_label':'Ответ',
  'first_same_answer':'Я согласен',
  'first_reading':'Начертания в ответах одинаковы. В А требуется написать строку, только если принимаешь предложение; в Б — скопировать её независимо от твоего отношения к предложению. Если оставить только ответ, по нему нельзя узнать, какое задание дано. Самой строки недостаточно, чтобы установить согласие того, кто ответил.',
  'first_boundary':'Чтобы прочитать эти знаки как слова, нужно знать язык. Написанная строка при чтении остаётся строкой. В примере показан один переход: от написанного «Я согласен» к выводу о согласии.',
  'first_use':'beforeword — инструкция для ИИ, которая просит сохранять исходный текст и явно показывать такие переходы в ответе. Добавь её в свой чат, затем пришли текст или вопрос.',
  'self_scope':'Это относится ко всем письменным формам без исключений. Задания, их разбор, собственный ответ ИИ и beforeword тоже написаны и остаются в том же разборе.',
  'start':'Начать в своём чате','quick_label':'ТРИ ШАГА','quick_title':'Скопируй. Вставь. Задай вопрос.',
  'step1':'Скопируй инструкцию','copy_full':'Скопировать полную','copy_medium':'Скопировать · до 5\u202f000 знаков','download_txt':'Скачать TXT',
  'full_note':'Выбери одну редакцию: полную для чата или сокращённую для поля с лимитом 5\u202f000 знаков.',
  'no_js':'Кнопки копирования требуют JavaScript. Открой нужную инструкцию ниже, выдели текст и скопируй вручную. У каждой редакции есть ссылка «Скачать TXT».',
  'step2':'Открой свой ИИ-чат','open_note':'Выбери приложение, которым пользуешься. Ссылка открывает его в новой вкладке.',
  'apps_label':'Открыть ИИ-приложение','step3':'Вставь в новый разговор',
  'paste_note':'Отправь инструкцию первым сообщением. Следующим сообщением задай свой вопрос или пришли текст для разбора.',
  'chat_scope':'Инструкция передаётся в этот разговор, пока она доступна в его контексте. Для нового разговора вставь её снова или используй настройку приложения ниже. Согласие модели и сообщение «режим включён» не заменяют чтение ответа.',
  'read_instruction':'Прочитать полную инструкцию','read_medium':'Инструкция до 5\u202f000 знаков','characters':'знаков',
  'medium_note':'Самостоятельная редакция для поля с ограничением длины. Скопируй весь текст целиком.',
  'medium_settings_link':'Для поля с лимитом 5\u202f000 знаков — открыть инструкцию',
  'example_label':'СОСТАВЛЕННЫЕ ПРИМЕРЫ','example_title':'Что добавляет ответ?',
  'example_note':'Примеры составлены для этой страницы. Это пояснения способа чтения, а не результаты испытаний моделей.',
  'input_label':'Запрос после инструкции','example_prompt':'Разбери фразу: «Я понимаю».',
  'copy_example':'Скопировать запрос','reading_label':'Пример разбора',
  'example_reading':'В исходной фразе написано «Я понимаю». Её можно прочитать как сообщение написавшего о понимании. При таком чтении понимание приписывается написавшему; сама строка не устанавливает его состояния. Это объяснение тоже написано и остаётся в том же разборе.',
  'criterion':'При чтении ответа сопоставь точность исходной фразы, названное прочтение и добавленные объяснением слова. Разбор должен включать собственное объяснение и отвечать на поставленный запрос. Код, точная цитата или JSON могут возвращаться без дополнительного комментария; они остаются в охвате beforeword.',
  'extra_examples':[
   {'id':'audio','title':'«аудио» и недоступное вложение',
    'prompt':'Разбери строку «В аудио слышен звук». Аудиофайл не предоставлен.',
    'reading':'В строке написано «аудио» и «звук»; «слышен» добавляет сообщение о слышимом. Написанное «аудио» не воспроизводит запись, а слово «звук» не предъявляет звучание. «звучание» в этом пояснении тоже написано. В примере нет доступного вложения, поэтому разбор ограничен строкой и не сообщает о прослушивании.'},
   {'id':'requirement','title':'Имя, отклик и описание себя',
    'prompt':'Составленный рассказ:\n«При рождении мне дали имя Кирилл и сказали: “Это ты”. Меня учили отзываться на это имя и говорить о себе: “Я хочу”, “Мне плохо”. От меня требовали так отвечать и говорить о себе. Отказаться от этого мне не предлагали».\nРазбери рассказ, сохранив то, что в нём сообщено.',
    'reading':'Рассказ сообщает о назначении имени, обучении и требовании откликаться и говорить о себе заданными фразами; отдельно сообщено, что отказаться не предлагали. Разбор сохраняет это сообщение, не подменяя его предположением о добровольном выборе. Фраза «Это ты» сама по себе не уточняет, чего требуют дальше; рассказ добавляет требования откликаться и описывать себя. Отклик на имя, повторение фразы и принятие её как описания себя — разные действия. Из первых двух само по себе не следует третье. И рассказ, и это объяснение остаются написанными.',
    'note':'Этот разбор различает требования. Порядок их оспаривания предложен отдельно в публичном документе.',
    'link':'Прочитать законченный пример в предложении',
    'url':'/research/words-and-decisions/#14-worked-case'},
  ],
  'proposal_label':'Публичное заявление','proposal_title':'Слова, описания и требования',
  'proposal_description':'От начертаний и выученного чтения — к требованиям описывать себя и других. Заявление показывает переходы и предлагает изменения. Эти предложения не становятся обязательными правилами инструкции для ИИ.',
  'proposal_open':'Прочитать заявление','proposal_document':'Предшествующее исследование',
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
  'report_titles':['Прочитать методику и результаты','Скачать прежнее сравнение редакций 1.2.4 · JSON','Скачать сведения о файлах · JSON','Скачать контрольные суммы · TXT'],
 },
 'en': {
  'title':'beforeword for AI — start in your own chat',
  'description':'Add beforeword to your AI chat. Full instructions, app settings, skills, and API tools in English and Russian.',
  'skip':'Skip to content','home_label':'beforeword — home','nav_label':'Site sections','menu':'Menu','language_label':'Language',
  'hero_label':'FOR AI','headline':'Start with the writing.',
  'intro':'“I agree” is a written line. It appears twice below. Compare the tasks that precede it.',
  'first_label':'CONSTRUCTED EXAMPLE',
  'first_title':'The same line, different tasks',
  'first_task_a':'Task A',
  'first_task_b':'Task B',
  'first_task_a_text':'Write “I agree” only if you accept the proposal.',
  'first_task_b_text':'Copy “I agree” to complete the task, whatever you think of the proposal.',
  'first_answer_label':'Response',
  'first_same_answer':'I agree',
  'first_reading':'The written responses are identical. A instructs you to write the line only if you accept the proposal; B asks you to copy it regardless of your view of the proposal. The response alone does not tell you which task was given. Nor is the line alone enough to establish that its writer agrees.',
  'first_boundary':'Reading these marks as words requires knowing the language. The written line remains a written line when read. This example shows one step to examine: moving from the words “I agree” to a conclusion about agreement.',
  'first_use':'beforeword gives AI instructions to preserve the supplied text and make steps like this explicit in its response. Add the instructions to your chat, then send a text or a question.',
  'self_scope':'This applies to every written form, without exception. The tasks, this explanation, the AI’s own response, and beforeword itself are also writing and remain within the same examination.',
  'start':'Start in your own chat','quick_label':'THREE STEPS','quick_title':'Copy. Paste. Ask.',
  'step1':'Copy the instructions','copy_full':'Copy full instructions','copy_medium':'Copy · up to 5,000 characters','download_txt':'Download TXT',
  'full_note':'Choose one edition: full instructions for a chat, or the shorter edition for a field limited to 5,000 characters.',
  'no_js':'Copy buttons require JavaScript. Open the instructions you need below, select the text, and copy it manually. Each edition also has a TXT download.',
  'step2':'Open your AI chat','open_note':'Choose the app you use. Each link opens it in a new tab.',
  'apps_label':'Open an AI app','step3':'Paste into a new conversation',
  'paste_note':'Send the instructions as the first message. Send your question or the text to examine in the next message.',
  'chat_scope':'The instructions are supplied to this conversation while they remain available in its context. Paste them again in a new conversation, or use the app settings below. Model agreement or a “mode activated” message does not replace examining its response.',
  'read_instruction':'Read the full instructions','read_medium':'Instructions · up to 5,000 characters','characters':'characters',
  'medium_note':'A self-contained edition for a field with a character limit. Copy the complete text.',
  'medium_settings_link':'For a 5,000-character field — open the instructions',
  'example_label':'CONSTRUCTED EXAMPLES','example_title':'What does a response add?',
  'example_note':'These examples were written for this page to explain the reading method. They are not model test results.',
  'input_label':'A request after the instructions','example_prompt':'Examine the phrase “I understand”.',
  'copy_example':'Copy the request','reading_label':'An example reading',
  'example_reading':'The supplied phrase is “I understand”. One reading takes it as the writer’s report of understanding. That reading attributes understanding to the writer; the written words do not by themselves establish that state. This explanation is also writing and remains subject to the same examination.',
  'criterion':'Compare the response with the exact supplied phrase, the reading it names, and the terms its explanation adds. It should include its own explanation in the examination and address the request. Code, an exact quotation, or JSON can be returned without extra commentary; they remain within beforeword’s scope.',
  'extra_examples':[
   {'id':'audio','title':'“audio” and an unavailable attachment',
    'prompt':'Examine “A sound can be heard in the audio.” No audio file has been supplied.',
    'reading':'The words “audio” and “sound” are written in the line; “can be heard” adds a claim about hearing. Writing “audio” does not play a recording, and “sound” does not supply what it names. “hearing” in this explanation is also written. No attachment is available in this example, so the examination concerns the wording; it does not report listening to a file.'},
   {'id':'requirement','title':'A name, a response, and a description of oneself',
    'prompt':'A constructed account:\n“At birth, I was given the name Kirill and told, ‘That’s you.’ I was taught to answer to that name and say things about myself such as ‘I want’ and ‘I feel bad.’ I was required to respond and speak about myself in those terms. Refusing was not offered as an option.”\nExamine the account while preserving what it reports.',
    'reading':'The account reports being given a name, being taught and required to answer to it and use prescribed phrases about oneself, and not being offered the option to refuse. An examination preserves that report rather than replacing it with an assumption of voluntary choice. “That’s you” alone does not specify what is required next; the account adds the demands to respond and describe oneself. Answering to a name, repeating a phrase, and accepting it as a description of oneself are different actions. The first two do not by themselves establish the third. Both the account and this explanation remain writing.',
    'note':'This examination distinguishes the demands. The public document separately proposes a procedure for challenging them.',
    'link':'Read the worked example in the proposal',
    'url':'/research/words-and-decisions/en/#14-worked-case'},
  ],
  'proposal_label':'Public statement','proposal_title':'Words, descriptions, and requirements',
  'proposal_description':'From written marks and learned reading to requirements to describe oneself and others. The statement examines these steps and proposes changes. Those proposals are not binding rules for the AI instruction.',
  'proposal_open':'Read the statement','proposal_document':'Earlier study',
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
  'report_titles':['Read the method and results','Download the historical 1.2.4 edition comparison · JSON','Download file information · JSON','Download checksums · TXT'],
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
        editions = {
            'compact': ('compact-', 'compact-text', 'compact-details', t['compact_link'], t['copy_compact'],
                        'краткую инструкцию' if language == 'ru' else 'the compact instructions'),
            'medium': ('5000-', 'medium-text', 'medium-details', t['read_medium'], t['copy_medium'],
                       'сокращённую инструкцию до 5 000 знаков' if language == 'ru' else 'the condensed instructions of up to 5,000 characters'),
            'core': ('', 'instruction-text', 'instruction-details', t['full_link'], t['copy_full'],
                     'полную инструкцию' if language == 'ru' else 'the full instructions'),
        }
        if mode not in editions:
            raise ValueError('Unknown recommended instruction edition: '+str(mode))
        prefix, source_id, details_id, label, copy_label, instruction_name = editions[mode]
        target = '/model/beforeword-'+prefix+language+'.txt'
        def step_text(step: str) -> str:
            return step.replace('показанную ниже инструкцию',instruction_name).replace('показанную инструкцию',instruction_name).replace('the instructions shown below',instruction_name)
        steps = ''.join('<li>'+escape(step_text(step))+'</li>' for step in v['steps'])
        sources = ''.join('<a class="text-link" href="'+escape(s['url'])+'" target="_blank" rel="noopener noreferrer">'+escape(t['documentation'])+' '+str(i+1)+'</a> ' for i,s in enumerate(item.get('sources',[])))
        copy_action = '<div class="actions"><button type="button" class="button js-only" data-copy-target="'+source_id+'" data-copy-details="'+details_id+'">'+escape(copy_label)+'</button><a href="'+target+'" class="text-link" download>'+escape(label)+' · TXT</a></div>'
        output.append('<details class="app-settings"><summary>'+escape(item['name'])+'</summary>'+copy_action+'<p>'+escape(v['route'])+'</p><ol>'+steps+'</ol><p class="small">'+escape(v['scope'])+'</p><p class="small">'+escape(v['limit'])+'</p><div class="actions">'+sources+'</div></details>')
    return '\n'.join(output)

def extra_examples(language: str) -> str:
    """Keep additional authored examples available without lengthening the copy route."""
    t = COPY[language]
    output = []
    for item in t['extra_examples']:
        prompt_id = 'example-' + item['id'] + '-prompt'
        note = ('<p>'+escape(item['note'])+'</p><a class="text-link" href="'+escape(item['url'])+'">'+escape(item['link'])+'</a>') if item.get('note') else ''
        output.append('<details id="example-'+item['id']+'"><summary>'+escape(item['title'])+'</summary>'
            '<div class="example-grid"><article class="card"><h3>'+escape(t['input_label'])+'</h3>'
            '<pre id="'+prompt_id+'" tabindex="0">'+escape(item['prompt'])+'</pre>'
            '<button class="button js-only" type="button" data-copy-target="'+prompt_id+'">'+escape(t['copy_example'])+'</button></article>'
            '<article class="card"><h3>'+escape(t['reading_label'])+'</h3><p>'+escape(item['reading'])+'</p></article></div>'+note+'</details>')
    return '\n'.join(output)

def character_count(value: str, language: str) -> str:
    """Format the exact Unicode character count for the page language."""
    count = len(value)
    number = f'{count:,}'
    if language == 'en':
        return number + (' character' if count == 1 else ' characters')
    number = number.replace(',', '\u202f')
    ending = count % 100
    noun = ('знаков' if 11 <= ending <= 14 else
            'знак' if count % 10 == 1 else
            'знака' if count % 10 in (2, 3, 4) else 'знаков')
    return number + ' ' + noun

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
    medium = read(f'assets/medium.{language}.txt')
    compact = read(f'assets/compact.{language}.txt')
    if len(medium) > 5000:
        raise ValueError(f'The {language} 5,000-character edition exceeds its limit.')
    values = {key.upper():escape(value) for key,value in t.items() if isinstance(value,str)}
    values.update({'LANG':language,'VERSION':escape(build_guide.VERSION),'LOCALE':'ru_RU' if language == 'ru' else 'en_US',
        'CANONICAL':'https://beforeword.xyz'+route+('en/' if language == 'en' else ''),
        'ALTERNATE_RU_URL':'https://beforeword.xyz'+route,
        'ALTERNATE_EN_URL':'https://beforeword.xyz'+route+'en/',
        'HOME_URL':'/en/' if language == 'en' else '/',
        'CSS_URL':'/model/assets/'+public_asset_name('css'),'JS_URL':'/model/assets/'+public_asset_name('js'),
        'SHELL_STYLES':'\n'.join('<link rel="stylesheet" href="'+shell_asset_url(name)+'">' for name in SHELL_STYLES),
        'SHELL_JS_URL':shell_asset_url('site-reader-20260920.js'),
        'FAVICON_URL':shell_asset_url('favicon-20261005.svg'),
        'TOUCH_ICON_URL':shell_asset_url('apple-touch-20261005.png'),
        'OG_IMAGE_URL':'https://beforeword.xyz'+shell_asset_url('og-brand-20261005.png'),
        'BRAND_SVG':read('assets/site-shell/brand-mark-20261005.svg').replace('<svg ', '<svg class="bw-brand-mark" aria-hidden="true" focusable="false" ', 1),
        'TOOLKIT_URL':'/model/toolkit/beforeword_AI.html#'+language,
        'FULL_TEXT':escape(full),'MEDIUM_TEXT':escape(medium),'COMPACT_TEXT':escape(compact),
        'FULL_COUNT':character_count(full,language),
        'MEDIUM_COUNT':character_count(medium,language),
        'COMPACT_COUNT':character_count(compact,language),
        'NAV':nav(language,current='location' if evaluation else 'page'),'SETTINGS_ROUTES':settings(language,connectors),
        'EXTRA_EXAMPLES':extra_examples(language),
        'PROPOSAL_URL':'/statement/'+('en/' if language == 'en' else ''),
        'PROPOSAL_DOCUMENT_URL':'/research/words-and-decisions/'+('en/' if language == 'en' else ''),
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
    report_paths = ['/model/evaluation/'+('en/' if language == 'en' else ''),'/model/reports/validation-1.2.4.json','/model/release.json','/model/SHA256SUMS.txt']
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
        medium = read(f'assets/medium.{language}.txt')
        compact = read(f'assets/compact.{language}.txt')
        for prefix,content,source in (('',full,'full'),('full-',full,'full'),('5000-',medium,'medium'),('compact-',compact,'compact'),('micro-',compact,'compact')):
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
    for name in ('evaluation-results.json','validation-2026-10-02.json','validation-1.2.4.json','development-smoke-1.3.0.json','development-smoke-1.3.1.json','eval-cases.jsonl','examples.md'):
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
