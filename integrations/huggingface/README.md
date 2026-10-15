---
title: beforeword
emoji: 🌀
colorFrom: gray
colorTo: gray
sdk: gradio
sdk_version: 6.29.1
python_version: "3.12"
app_file: app.py
pinned: false
short_description: Cited dictionary lookup and beforeword instruction
tags:
  - mcp-server
  - prompts
  - instructions
  - multilingual
---

# beforeword · MCP connector

**Look up dictionary writing with its source, or load the beforeword reading instruction.**

beforeword asks the model to preserve supplied wording and show a concrete transition added by a reading. A learned form remains writing. When that distinction completes the task, the answer can stop without another definition, a demand for grounds or a follow-up question. The model's explanation and beforeword receive no exemption; requested practical tasks and exact formats remain available.

The source in this directory bundles the complete English and Russian instructions for **version 1.3.5**, under public testing. A deployment from these files serves that version. Updating this repository does not establish that the hosted Space has been updated; its returned instruction must be checked separately. The server does not run a model or analyze a conversation. Its dictionary tool accepts one selected word or short expression, not an entire passage.

## Connect and use

The public connector is available in the [beforeword Space](https://huggingface.co/spaces/beforeword/beforeword). Its MCP endpoint is:

```text
https://beforeword-beforeword.hf.space/gradio_api/mcp/
```

The running app and its **Use via API or MCP** panel also display this URL. A copy deployed to another Space will have its own hostname.

The hosted server advertises the tool as `beforeword_get_beforeword_instruction` and the prompt as `beforeword_beforeword`. Use the names discovered by your client; the resource URI remains `beforeword://instruction/{language}`.

1. Add that URL to a client supporting remote MCP servers over **Streamable HTTP**.
2. If the client exposes **MCP prompts**, select `beforeword` with `language: en` or `language: ru`.
3. If it exposes **tools only**, explicitly request `get_beforeword_instruction` with the desired language, then ask the client to use the returned instruction for your task. A client may prefix the displayed tool name.

Example request in the client:

> Get the English beforeword instruction using get_beforeword_instruction. Use the returned instruction for this conversation, while it remains available in context and subject to the host's instruction hierarchy.

**Connecting makes the server available. Invoking it retrieves the instruction.** The client decides how returned text enters the model's context. This does not install an account-wide setting or establish future adherence. A client that treats tool output only as reference data may require the user to copy the instruction into an instruction field it supports.

Support for tools, prompts, and resources varies by client. This connector does not imply a native plugin listing or endorsement by a model provider. Public hosting availability also depends on the Space's runtime state and Hugging Face's policies.

## MCP interface

| Primitive | Name or URI | Input | Output |
| --- | --- | --- | --- |
| Prompt | `beforeword` | `language`: `en` or `ru`; default `en` | Full instruction |
| Resource template | `beforeword://instruction/{language}` | URI language: `en` or `ru` | Same full instruction |
| Tool | `get_beforeword_instruction` | `language`: `en` or `ru`; default `en` | Same full instruction |
| Tool | `lookup_dictionary_entry` | `word`: selected word/expression, max 120 characters; `language`: `en` or `ru` | Definitions grouped by source entry and sense, source revision, license, and explicit lookup changes |

Unsupported language values return errors. Dictionary lookup sends the selected word and dictionary language to Wikimedia. It needs no entire passage, files, chat history, account or model key. Returning the instruction does not perform the reading task; the connected model receives that task separately in its own client.

### Dictionary lookup

Request `lookup_dictionary_entry(word="if", language="en")` or `lookup_dictionary_entry(word="я", language="ru")`. To continue a chain, select a word in a returned definition and request that word separately. No recursive crawl or automatic sense choice occurs. Definitions are also written words; the result does not establish how a particular person reads.

The English edition is restricted to its English entry section; the Russian edition to its Russian section. The tool preserves the original `query`. It trims outer whitespace only for lookup, then tries the exact spelling. Only a missing result permits a lowercase retry. These changes appear in `transformations`; no Unicode normalization, translation, stemming or inferred lemma is applied. `formOf` contains an explicit source form-of link, where available. It is not a machine-inferred relation.

Definitions are extracted from rendered Wiktionary HTML without paraphrase. Examples, quotations, nested lists, tables and reference markers are omitted from each gloss; nested definition senses retain their parent glosses. ASCII layout whitespace is collapsed; nonbreaking spaces, letters and punctuation remain. Source-provided labels remain part of the extracted writing. Each result links the article, its revision and edit history. A revision pins the article source; template rendering may change separately. No source HTML is executed or returned.

`missing` means no entry for that lookup in the selected language section. Existing but unsupported layouts, network failures and oversized records raise distinct errors; none are presented as absence of a word or meaning. Lookup is limited to 120 characters and eight space-separated words, a two-megabyte response and 120 senses (further senses are counted in `truncation`). HTTP redirects, URLs, namespaces and arbitrary endpoints are rejected. Requests go only to the fixed English or Russian Wiktionary API. There is no promise of a complete dictionary or all possible language relations.

The bundled `instruction.en.txt` and `instruction.ru.txt` are byte-for-byte copies of the corresponding `assets/core.*.txt` files in the [source repository](https://github.com/beforeword/beforeword). `instructions.json` records their release, byte lengths, and SHA-256 hashes. No activation message or wrapper is inserted into the returned instruction.

## Run and test locally

```sh
python -m pip install -r requirements.txt
python app.py
```

The local default MCP endpoint is `http://127.0.0.1:7860/gradio_api/mcp/`. The app also provides a browser interface to retrieve and copy either instruction edition. The server's functions require no model API key.

Run the protocol check in the same environment:

```sh
python -m unittest -v test_dictionary.py
python test_protocol.py
```

The unit tests use recorded Wikimedia fixtures, including function words, inflections and multiple senses. The protocol check starts a local server and uses an MCP client over HTTP to initialize a session, discover both tools, retrieve both instruction editions through every primitive, compare exact bytes, reject invalid inputs, and exercise dictionary output against recorded fixtures. The production app has no fixture mode. Add `--live-dictionary` to make one explicit live lookup of `if`. It does not test model behavior or future adherence. To check an already running endpoint, pass `--url https://<actual-host>/gradio_api/mcp/`.

The historical 1.2.4 [hosted protocol run](validation.hosted.json) recorded seven byte-exact instruction retrievals, rejected six invalid language requests, and rejected an extra text argument. It did not test model behavior or installation in a model provider's client, and does not establish deployment of 1.3.4.

See [PRIVACY.md](PRIVACY.md) for data handling. Gradio usage analytics is disabled in the app; this does not disable the hosting provider's request processing.

## Licensing scope

Dictionary writing and recorded fixtures are attributed to Wiktionary contributors under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); each record supplies source, revision and history links. See [fixtures/README.md](fixtures/README.md) for fixture provenance and extraction changes. This is a separate license from the instruction package.

The English instruction `instruction.en.txt` is copied unchanged from the instruction included in the MIT-licensed plugin packages; its MIT notice is retained in `LICENSE.instruction-en.txt`. This notice applies only to that English instruction. It does not assign a license to the connector code, the Russian instruction, or the rest of the repository. The existing package terms are available in the [Claude package](https://github.com/beforeword/beforeword/blob/main/plugins/claude/beforeword/LICENSE) and [OpenAI package](https://github.com/beforeword/beforeword/blob/main/plugins/openai/beforeword/LICENSE).

[Project](https://beforeword.xyz/model/en/) · [Source](https://github.com/beforeword/beforeword/tree/main/integrations/huggingface) · [Issues](https://github.com/beforeword/beforeword/issues)

---

# beforeword · коннектор MCP

**Словарные определения с источником и подключение инструкции beforeword.**

Инструкция просит сохранять исходные формулировки и показывать конкретный переход, добавленный прочтением. Выученная форма остаётся записью. Если это различие завершает задачу, ответ может остановиться без следующего определения, запроса оснований или вопроса к читателю. Пояснение модели и beforeword не получают исключения; практические задачи и точные форматы сохраняются.

В этой папке подготовлены полные инструкции **версии 1.3.5** на русском и английском языке. Версия проходит публичный тест. Сервер, развёрнутый из этих файлов, выдаёт эту версию. Обновление репозитория не подтверждает обновление публичного Space: выданную им инструкцию нужно проверить отдельно. Сервер не запускает модель и не разбирает переписку. Словарный инструмент принимает выбранное слово или короткое выражение; весь фрагмент ему не нужен.

## Подключение

Публичный коннектор размещён в [Space beforeword](https://huggingface.co/spaces/beforeword/beforeword). Его MCP-адрес приведён выше. Сервер объявляет инструмент как `beforeword_get_beforeword_instruction`, а промпт — `beforeword_beforeword`; используй имена, которые обнаружил твой клиент.

1. Скопируй адрес MCP из работающего приложения или панели **View API → MCP**. Добавь его в клиент с поддержкой удалённых серверов MCP через **Streamable HTTP**.
2. Если клиент поддерживает промпты MCP, выбери `beforeword` с `language: ru` или `language: en`.
3. Если доступны только инструменты, явно запроси `get_beforeword_instruction` с нужным языком, затем попроси клиент использовать полученную инструкцию для задачи. Клиент может добавить префикс к названию инструмента.

Пример запроса в клиенте:

> Получи русскую инструкцию beforeword через get_beforeword_instruction. Применяй её в этой беседе, пока она доступна в контексте, с учётом иерархии инструкций приложения.

**Подключение делает сервер доступным. Вызов получает инструкцию.** Клиент определяет, как текст попадёт в контекст модели. Это не меняет настройки всего аккаунта и не устанавливает дальнейшее следование инструкции. Если клиент использует результаты инструментов только как справочный материал, может потребоваться вставить текст в поддерживаемое им поле инструкций.

Ресурсы `beforeword://instruction/ru` и `beforeword://instruction/en` выдают тот же полный текст. Поддержка инструментов, промптов и ресурсов зависит от клиента. Это подключение не означает размещения в каталоге нативных плагинов или одобрения со стороны поставщика модели. Доступность размещённого сервера зависит также от состояния Space и правил Hugging Face.

Получение инструкции передаёт выбор языка. Отдельный инструмент `lookup_dictionary_entry` передаёт выбранное слово и язык Викисловарю. Он не запрашивает переписку, файлы, API-ключи или весь исходный фрагмент.

## Словарный поиск

Пример: `lookup_dictionary_entry(word="я", language="ru")`. Возвращаются варианты словарной записи с источником, редакцией и лицензией. Для следующего шага выбери слово в определении и запроси его отдельно. Определение тоже написано словами; это не наблюдение за тем, как читает человек.

Исходный `query` сохраняется. Поиск убирает только внешние пробелы; при отсутствии точного написания пробует строчные буквы. Изменения явно указаны в `transformations`. Нормализация Unicode, перевод, стемминг и автоматический выбор значения не применяются. `formOf` содержит только ссылку словаря на исходную форму, если такая связь явно оформлена в записи.

Разбирается раздел English английского Wiktionary либо раздел «Русский» русского Викисловаря. Определения извлекаются из отображаемого HTML без пересказа. Примеры, цитаты, таблицы и маркеры сносок исключаются; для вложенного значения сохраняется родительское определение. Пробелы разметки ASCII сворачиваются; неразрывные пробелы, знаки и буквы сохраняются. Пометы словаря остаются частью записи. Ссылка указывает редакцию статьи; оформление через шаблоны может изменяться отдельно.

`missing` обозначает отсутствие записи в выбранном разделе. Неизвестная разметка, сбой сети или слишком большой ответ выдаются отдельно и не означают отсутствие слова или значения. Пределы: 120 знаков, восемь слов, ответ до двух мегабайт, до 120 значений (остальные учитываются в `truncation`). URL, пространства имён и HTTP-перенаправления не допускаются. Запрос отправляется только в API выбранной редакции Викисловаря. Полнота словаря и всех связей языка не заявляется.

Словарные записи и тестовые образцы принадлежат участникам Викисловаря и используются по CC BY-SA 4.0. В выдаче есть ссылки на источник, редакцию, историю и лицензию. Сведения об образцах — в [fixtures/README.md](fixtures/README.md).

Оба файла инструкции скопированы из `assets/core.*.txt` без изменения байтов; длины и SHA-256 записаны в `instructions.json`. В выдачу не добавляется сообщение об активации.

Команды локального запуска и протокольной проверки приведены выше. Проверка рассматривает выдачу текста по MCP; она не испытывает поведение модели. Обработка данных описана в [PRIVACY.md](PRIVACY.md). Аналитика Gradio отключена, но это не отключает обработку запросов хостингом.

[Протокольная проверка публичного сервера версии 1.2.4](validation.hosted.json): семь выдач инструкции совпали побайтно, шесть запросов с неподдерживаемым языком и дополнительный аргумент с текстом отклонены. Поведение модели и установка в клиенте поставщика модели не испытывались; эта запись не подтверждает развёртывание версии 1.3.5.

Английская инструкция `instruction.en.txt` без изменений взята из текста, включённого в пакеты с MIT-лицензией; уведомление сохранено в `LICENSE.instruction-en.txt` и относится только к этому файлу. Лицензия не распространяется этим уведомлением на код коннектора, русскую инструкцию или весь репозиторий.

[Проект](https://beforeword.xyz/model/) · [Исходный код](https://github.com/beforeword/beforeword/tree/main/integrations/huggingface) · [Обратная связь](https://github.com/beforeword/beforeword/issues)
