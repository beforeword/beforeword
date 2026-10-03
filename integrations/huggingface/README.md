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
short_description: The beforeword instruction for MCP clients
tags:
  - mcp-server
  - prompts
  - instructions
  - multilingual
---

# beforeword · MCP connector

**Load the beforeword reading instruction into a compatible AI client.**

beforeword asks the model to preserve supplied wording, distinguish it from added readings and claims, and examine the grounds offered for those steps. The same examination applies to the model's explanation and to beforeword itself.

This server distributes the complete English and Russian instructions for **version 1.2.4**, under public testing. It does not run a model, analyze a conversation, or accept a text or file for analysis.

## Connect and use

The running app displays its MCP endpoint. On a deployed Hugging Face Space, the endpoint is:

```text
https://<your-space-host>.hf.space/gradio_api/mcp/
```

The hostname above is a placeholder, not a published service address. Use the actual URL displayed by the running app or its **View API → MCP** panel.

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

Unsupported language values return errors. No primitive takes user text, files, chat history, or credentials. Returning these instructions does not perform the reading task; the connected model receives that task separately in its own client.

The bundled `instruction.en.txt` and `instruction.ru.txt` are byte-for-byte copies of the corresponding `assets/core.*.txt` files in the [source repository](https://github.com/beforeword/beforeword). `instructions.json` records their release, byte lengths, and SHA-256 hashes. No activation message or wrapper is inserted into the returned instruction.

## Run and test locally

```sh
python -m pip install -r requirements.txt
python app.py
```

The local default MCP endpoint is `http://127.0.0.1:7860/gradio_api/mcp/`. The app also provides a browser interface to retrieve and copy either instruction edition. The server's functions require no model API key.

Run the protocol check in the same environment:

```sh
python test_protocol.py
```

This starts a local server and uses an MCP client over HTTP to initialize a session, discover the interface, retrieve both editions through every primitive, compare exact bytes, and check invalid inputs. It does not test model behavior or future adherence. To check an already running endpoint, pass `--url https://<actual-host>/gradio_api/mcp/`.

See [PRIVACY.md](PRIVACY.md) for data handling. Gradio usage analytics is disabled in the app; this does not disable the hosting provider's request processing.

## Licensing scope

The English instruction `instruction.en.txt` is copied unchanged from the instruction included in the MIT-licensed plugin packages; its MIT notice is retained in `LICENSE.instruction-en.txt`. This notice applies only to that English instruction. It does not assign a license to the connector code, the Russian instruction, or the rest of the repository. The existing package terms are available in the [Claude package](https://github.com/beforeword/beforeword/blob/main/plugins/claude/beforeword/LICENSE) and [OpenAI package](https://github.com/beforeword/beforeword/blob/main/plugins/openai/beforeword/LICENSE).

[Project](https://beforeword.xyz/en/model/) · [Source](https://github.com/beforeword/beforeword/tree/main/integrations/huggingface) · [Issues](https://github.com/beforeword/beforeword/issues)

---

# beforeword · коннектор MCP

**Загрузка инструкции beforeword в совместимый клиент ИИ.**

Инструкция просит модель сохранять исходные формулировки, отделять их от добавленных прочтений и утверждений и разбирать основания этих переходов. Тот же разбор применяется к объяснению модели и к beforeword.

Сервер выдаёт полную инструкцию **версии 1.2.4** на русском или английском языке. Версия проходит публичный тест. Сервер не запускает модель, не разбирает переписку и не принимает текст или файл для анализа.

## Подключение

1. Скопируй адрес MCP из работающего приложения или панели **View API → MCP**. Добавь его в клиент с поддержкой удалённых серверов MCP через **Streamable HTTP**.
2. Если клиент поддерживает промпты MCP, выбери `beforeword` с `language: ru` или `language: en`.
3. Если доступны только инструменты, явно запроси `get_beforeword_instruction` с нужным языком, затем попроси клиент использовать полученную инструкцию для задачи. Клиент может добавить префикс к названию инструмента.

Пример запроса в клиенте:

> Получи русскую инструкцию beforeword через get_beforeword_instruction. Применяй её в этой беседе, пока она доступна в контексте, с учётом иерархии инструкций приложения.

**Подключение делает сервер доступным. Вызов получает инструкцию.** Клиент определяет, как текст попадёт в контекст модели. Это не меняет настройки всего аккаунта и не устанавливает дальнейшее следование инструкции. Если клиент использует результаты инструментов только как справочный материал, может потребоваться вставить текст в поддерживаемое им поле инструкций.

Ресурсы `beforeword://instruction/ru` и `beforeword://instruction/en` выдают тот же полный текст. Поддержка инструментов, промптов и ресурсов зависит от клиента. Это подключение не означает размещения в каталоге нативных плагинов или одобрения со стороны поставщика модели. Доступность размещённого сервера зависит также от состояния Space и правил Hugging Face.

Ни один из трёх способов не принимает переписку, пользовательский текст, файлы или учётные данные. Запрос содержит выбор языка. Задача для разбора передаётся отдельно модели в её клиенте.

Оба файла инструкции скопированы из `assets/core.*.txt` без изменения байтов; длины и SHA-256 записаны в `instructions.json`. В выдачу не добавляется сообщение об активации.

Команды локального запуска и протокольной проверки приведены выше. Проверка рассматривает выдачу текста по MCP; она не испытывает поведение модели. Обработка данных описана в [PRIVACY.md](PRIVACY.md). Аналитика Gradio отключена, но это не отключает обработку запросов хостингом.

Английская инструкция `instruction.en.txt` без изменений взята из текста, включённого в пакеты с MIT-лицензией; уведомление сохранено в `LICENSE.instruction-en.txt` и относится только к этому файлу. Лицензия не распространяется этим уведомлением на код коннектора, русскую инструкцию или весь репозиторий.

[Проект](https://beforeword.xyz/model/) · [Исходный код](https://github.com/beforeword/beforeword/tree/main/integrations/huggingface) · [Обратная связь](https://github.com/beforeword/beforeword/issues)
