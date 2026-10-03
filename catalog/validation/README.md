# Task runs of the packaged instruction

Instruction: 1.2.4. Raw inputs and final answers: [task-runs.json](task-runs.json).

Three fresh Codex subagent tasks loaded the packaged skill. The tasks received the skill path and a user request, without the expected answer or the review below. These runs used the instruction text; they did not install or invoke a plugin in Claude or ChatGPT.

| Task | Observed result | Limit |
| --- | --- | --- |
| English definition of “trust” | Proposed reading and added definitional terms are distinguished | One output; other definitions were not tested |
| Russian report of a demand to adopt a label | Separates label use and demanded self-identification | The ending adds “already use the label”, which the input did not establish |
| Exact JSON / Unicode copy | The parsed string matches the supplied string, including spaces, accents and the spelling | One string and one requested format |

The Russian output is retained as returned. It is not corrected in the record or replaced with a successful retry. This finding remains open for later instruction work and host testing.

The trials do not establish installation, automatic selection, future adherence, platform acceptance, or comparative performance. No overall score is assigned.

## Русский

Три отдельных задания выполнены с текстом упакованного навыка в Codex. Установка и запуск плагина внутри Claude или ChatGPT не проверялись.

В одном ответе выявлено добавление: «вы уже используете подпись». Во вводе сообщается требование использовать подпись и признать себя описанием; уже состоявшееся использование не установлено. Исходный ответ сохранён без исправления. Проверка JSON сопоставляет конкретную строку посимвольно; результат не переносится на другие запросы.
