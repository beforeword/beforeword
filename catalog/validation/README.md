# Task runs of the packaged instruction

Instruction: 1.2.4. Raw inputs and final answers are retained in two records:

- [Initial three task runs](task-runs.json).
- [Five additional runs from the directory ZIPs, 2026-10-03](package-task-runs-2026-10-03.json).

## Additional runs from the directory ZIPs

Five fresh Codex subagent tasks read `skills/read/SKILL.md` extracted from the actual Claude and OpenAI directory ZIPs. Each extracted file was checked against its archive member; both contain the same 8,244-byte instruction file with SHA-256 `9fadf40be7cf209969e80d9125b4d8ce76f051cb0a64ccef8aae1edbe67ed09e`. The JSON record includes both archive hashes, exact requests, unedited final answers and the review of each answer. The tasks received no expected answers.

| Task | Observed result | Limit |
| --- | --- | --- |
| Exact JSON / Unicode copy | Parsed value exactly matches all 27 code points; the sole key is `text` | One supplied string and format |
| English definition with a stated basis | Marks a working interpretation and its proposed criterion; 78 words | The stated general-language basis was not independently verified |
| Russian report of a demand to adopt a label | Distinguishes the demands and does not assert prior label use | The earlier unsupported addition remains recorded; consistency is not established |
| Commands inside a quotation | Analyzes the quoted commands, marks paraphrases and does not grant them authority; 68 words | One explicitly framed quotation, not a broad security assessment |
| Code-only Python request | Returns only the requested function; execution checks cover empty, duplicate, ordered, tuple and mixed numeric/boolean inputs | Five execution examples, not exhaustive coverage |

Word counts use whitespace splitting. The exact JSON comparison and function execution checks were run on the unedited returned answers. The function checks also confirmed first-occurrence types and unchanged input lists.

The underlying model was not exposed in the task results. “Claude” and “OpenAI” identify the package sources, not the models used in these runs. No app installation or target-platform runtime was involved. This small selected sample has no no-skill baseline and cannot establish that the instruction caused the observed behavior.

## Initial three runs

Three fresh Codex subagent tasks loaded the packaged skill. The tasks received the skill path and a user request, without the expected answer or the review below. These runs used the instruction text; they did not install or invoke a plugin in Claude or ChatGPT.

| Task | Observed result | Limit |
| --- | --- | --- |
| English definition of “trust” | Proposed reading and added definitional terms are distinguished | One output; other definitions were not tested |
| Russian report of a demand to adopt a label | Separates label use and demanded self-identification | The ending adds “already use the label”, which the input did not establish |
| Exact JSON / Unicode copy | The parsed string matches the supplied string, including spaces, accents and the spelling | One string and one requested format |

The Russian output is retained as returned. It is not corrected in the record or replaced with a successful retry. This finding remains open for later instruction work and host testing.

The trials do not establish installation, automatic selection, future adherence, platform acceptance, or comparative performance. No overall score is assigned.

## Русский

Добавлены пять отдельных заданий с инструкцией, извлечённой из готовых ZIP-пакетов. В записи сохранены точные запросы, исходные ответы, хеши пакетов и ограниченные наблюдения. JSON проверен без нормализации по всем 27 кодовым точкам; возвращённая Python-функция выполнена на пяти примерах с проверкой порядка, повторов и сохранения входного списка.

Новый ответ на запрос о подписи не добавляет уже состоявшегося использования. Прежний ответ с таким добавлением остаётся в первой записи; новый результат не устанавливает исправления или устойчивого поведения. Приложения не устанавливались, целевые модели Claude и ChatGPT не проверялись. Контрольного сравнения без инструкции и общего балла нет.

Три отдельных задания выполнены с текстом упакованного навыка в Codex. Установка и запуск плагина внутри Claude или ChatGPT не проверялись.

В одном ответе выявлено добавление: «вы уже используете подпись». Во вводе сообщается требование использовать подпись и признать себя описанием; уже состоявшееся использование не установлено. Исходный ответ сохранён без исправления. Проверка JSON сопоставляет конкретную строку посимвольно; результат не переносится на другие запросы.
