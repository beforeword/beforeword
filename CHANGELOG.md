# Changes / Изменения

Each entry describes that release or dated update. Test results apply to the instruction and conditions used at the time.

Каждая запись относится к указанному выпуску или дате. Результаты проверок относятся к использованной тогда инструкции и условиям.

## 1.3.3

### English

- The release pages now explain what was tested, what the results show and why the full instruction was retained. Russian and English readers can open the tasks, answers and assessments directly from the release description.
- The homepage version, copied instructions and character counts now match 1.3.3. Downloadable files and the Hugging Face source were updated together.
- The setup steps clarify which edition to choose and how to copy it in full.
- The release includes the full instruction used at the start of the comparison, unchanged. The alternative did not meet the replacement criteria set before the test.
- The medium and compact editions were revised separately. Their performance was not measured by this comparison.

<details>
<summary>Models, tasks and results</summary>

The comparison used 12 tasks, six in Russian and six in English, with two attempts under each of three conditions: no beforeword instruction, the full instruction, and an alternative version. Tasks covered interpretation, careful restatement, incomplete records, exact copying and JSON, arithmetic, and written descriptions of unavailable audio or video.

Seven models received the API requests: Qwen3.8-27B, DeepSeek-V4.1-Flash, Gemma 4 31B IT, Llama 3.3 70B Instruct, Kimi-K3, gpt-oss-120b and GLM-5.3. There were **504 requests and 500 answers**; four technical gaps were recorded separately.

For the same 158 comparable answers in each condition, the task and requested format were both satisfied as follows:

| Instruction | Answers meeting both requirements |
| --- | ---: |
| No beforeword instruction | 109 of 158 |
| Full instruction included in 1.3.3 | 124 of 158 |
| Alternative version | 121 of 158 |

This counts whether an answer completed the stated task and followed its format, such as returning only the requested calculation or JSON. It is not an overall score for model usefulness.

The alternative did better at preserving conditions, distinguishing reports from inferences, and accounting for missing information: **105 of 134** comparable answers, against **97** for the retained instruction. In five task–model combinations, the retained instruction met every criterion on both attempts while the alternative failed at least one; the reverse also occurred in five. The alternative therefore did not show the consistent improvement, without reduced task and format performance, required for replacement.

These results concern the recorded tasks, models and settings. Repeated answers are not independent trials, and unresolved assessments remain in the record. The comparison did not test the shorter editions, installation in apps or future responses.

The [method and results](references/evaluation.md) explain the comparison in detail. The [full protocol](references/comparison-1.3.3.json) preserves the exact model identifiers, providers, settings, instruction texts, tasks, answers and assessments.

</details>

### Русский

- На страницах выпуска объяснено, что проверялось, что показали результаты и почему сохранена полная инструкция. Из описания на русском и английском можно сразу перейти к заданиям, ответам и оценкам.
- На главной версия, копируемые инструкции и число знаков приведены к 1.3.3. Вместе обновлены скачиваемые файлы и исходники для Hugging Face.
- В шагах подключения пояснено, какую редакцию выбрать и как скопировать её целиком.
- В выпуск вошла полная инструкция, с которой началось сравнение, без изменений. Альтернативная редакция не выполнила условия замены, заданные до теста.
- Средняя и краткая редакции обновлены отдельно. Их поведение этим сравнением не проверялось.

<details>
<summary>Модели, задания и результаты</summary>

Сравнение охватило 12 заданий, шесть русских и шесть английских, по два запроса в каждом из трёх условий: без beforeword, с полной инструкцией и с альтернативной редакцией. Проверялись прочтение, точный пересказ, выводы из неполных записей, копирование символов и JSON, арифметика, работа с текстовым описанием недоступных аудио и видео.

API-запросы получили семь моделей: Qwen3.8-27B, DeepSeek-V4.1-Flash, Gemma 4 31B IT, Llama 3.3 70B Instruct, Kimi-K3, gpt-oss-120b и GLM-5.3. Из **504 запросов получено 500 ответов**; четыре технических пропуска учтены отдельно.

На одинаковых 158 сопоставимых ответах для каждого условия задача и требования к формату выполнены так:

| Инструкция | Ответы, выполнившие оба требования |
| --- | ---: |
| Без beforeword | 109 из 158 |
| Полная инструкция, вошедшая в 1.3.3 | 124 из 158 |
| Альтернативная редакция | 121 из 158 |

Здесь подсчитано выполнение самой задачи и её формата — например, расчёт без лишнего текста или только запрошенный JSON. Это не общая оценка полезности модели.

По сохранению условий, различению сообщения и вывода, учёту недостающих данных результат альтернативной редакции выше: **105 из 134** сопоставимых ответов против **97** у сохранённой инструкции. В пяти сочетаниях задания и модели сохранённая инструкция выполнила все критерии в обоих повторах, а альтернативная — не выполнила хотя бы в одном; обратных случаев также пять. Требуемого для замены устойчивого улучшения с сохранением выполнения задач и формата не получилось.

Результаты относятся к записанным заданиям, моделям и настройкам. Повторные ответы не являются независимыми испытаниями; неясные оценки сохранены в протоколе. Сокращённые редакции, установка в приложениях и будущие ответы этим сравнением не проверялись.

Подробный разбор сравнения приведён в [методе и результатах](references/evaluation.ru.md). В [полном протоколе](references/comparison-1.3.3.json) сохранены точные идентификаторы моделей, провайдеры, настройки, тексты инструкций, задания, ответы и оценки.

</details>

## 1.3.2

### English

- Clarified that a selected reading does not establish its claims by itself. This limit on inference was distinguished from the boundary between written form and what it names.
- Made the task condition explicit in the repeated-line example, removed an ambiguous English pronoun from the understanding example, and stated the reported requirement directly in the constructed account about a name.
- Updated the public page, guide, favicon, link preview and directory packages with the approved beforeword mark.
- Aligned the full, medium and compact editions, skill and downloadable packages. No new model-response test was recorded for 1.3.2; earlier results and files retain their original versions.

### Русский

- Уточнено, что выбранное прочтение само по себе не устанавливает приписанного. Это ограничение вывода отделено от границы между написанной формой и называемым.
- В примере с повтором строки прямо указано условие задания, в английском примере о понимании устранено двусмысленное местоимение, а в составленном рассказе об имени прямо записано предъявленное требование.
- На странице, в руководстве, favicon, карточке ссылки и пакетах каталогов размещён утверждённый знак beforeword.
- Согласованы полная, средняя и краткая редакции, навык и скачиваемые пакеты. Для 1.3.2 не записана новая серия ответов моделей; прежние результаты и файлы сохраняют исходные версии.

## 1.3.1

### English

- Moved the repeated-line example before the setup steps on the public instruction page. The example distinguishes repeating a line, fulfilling a task and accepting a description.
- Revised the self-description example to remove an added demand to be a written description. Clarified the English instruction’s distinction between claims about what words do and the question of writing becoming what it names.
- Corrected Russian interface labels and aligned the language editions and downloadable packages. Earlier response records remain associated with the instruction version used in each test.

### Русский

- Пример с повтором строки перенесён перед шагами подключения на публичной странице. В нём различены повторение строки, выполнение задания и принятие описания.
- Из примера самоописания убрано добавленное требование быть письменным описанием. В английской инструкции уточнено различие между утверждениями о действии слов и вопросом о превращении записи в называемое.
- Исправлены русские подписи интерфейса, согласованы языковые редакции и скачиваемые пакеты. Прежние записи ответов остаются связанными с использованной в каждом тесте версией инструкции.

## 1.3.0

### English

- Extended the same examination to every written form, including the response, its proposed grounds and beforeword itself. No fixed list of special words limits its scope.
- Distinguished learning words, prescribed self-description, answering to a name and accepting a description. Added constructed examples and evaluation tasks, with the public statement linked as a separate publication.
- Aligned the Russian and English editions and packages. The custom-GPT draft used a condensed instruction of up to 5,000 characters to fit its field; both plugin packages retained the full instruction.
- Preserved earlier tests under their original versions. New examples and package preparation did not constitute a new model-response test or directory publication.

### Русский

- Один порядок разбора распространён на все письменные формы, включая ответ, предложенные им основания и beforeword. Перечень особых слов не ограничивает его область.
- Различены обучение словам, заданное самоописание, отклик на имя и принятие описания. Добавлены составленные примеры и задания для проверки; публичное заявление связано отдельной ссылкой.
- Согласованы русские и английские редакции и пакеты. Для черновика GPT использована сокращённая инструкция до 5 000 знаков, соответствующая размеру поля; оба пакета плагинов сохранили полный текст.
- Прежние проверки сохранены под исходными версиями. Добавление примеров и подготовка пакетов не были новой проверкой ответов моделей или публикацией в каталогах.

## 2026-10-04 · Package license / Лицензия пакетов

### English

- Applied the owner-approved MIT License to the Claude and OpenAI directory packages, including their instruction and assets. Both packages and the downloadable source archive include the full license notice.
- Updated the package descriptions and license information. The instruction remained at 1.2.4; app installation, directory submission and platform review were still pending at this stage.

### Русский

- По решению владельца к пакетам для каталогов Claude и OpenAI применена лицензия MIT, включая входящие в них инструкцию и материалы. Полный текст лицензии включён в оба пакета и скачиваемый архив исходников.
- Обновлены описания пакетов и сведения о лицензии. Инструкция оставалась версией 1.2.4; на этом этапе установка в приложениях, подача в каталоги и рассмотрение платформами ещё не были выполнены.

## 2026-10-04 · Directory preparation / Подготовка к каталогам

### English

- Prepared one multilingual package for each of the Claude and OpenAI directories, with native Russian and English descriptions, three starter prompts, the project icon and the unchanged full 1.2.4 instruction.
- Added materials for manual GPT setup, full instruction texts, constructed examples and a record of publication status. This stage did not include directory submission, app installation or creation of a GPT.
- Recorded the license as a pending owner decision. MIT terms had not yet been applied at this point; the later license update is recorded above.

### Русский

- Подготовлено по одному многоязычному пакету для каталогов Claude и OpenAI: самостоятельные описания на русском и английском, три стартовых запроса, знак проекта и неизменённая полная инструкция 1.2.4.
- Добавлены материалы для ручного создания GPT, полные тексты инструкции, составленные примеры и запись статуса публикации. На этом этапе не выполнялись подача в каталоги, установка в приложениях или создание GPT.
- Выбор лицензии оставался решением владельца. Условия MIT на этом этапе ещё не были применены; последующее изменение лицензии записано выше.

## 2026-10-04 · Public introduction / Публичное описание

### English

- Revised the public introduction around “I understand” and the step from wording to reading. Aligned the website update panel and AI guides in Russian and English.
- Kept the instruction text at version 1.2.4; this update changed its public explanation.

### Русский

- Публичное описание переработано вокруг «я понимаю» и перехода от написанного к прочтению. Согласованы панель обновлений сайта и руководства для ИИ на русском и английском.
- Текст инструкции остался версией 1.2.4; обновлено её публичное объяснение.

## 1.2.4

### English

- Clarified the difference between using a label and being required to accept that one is the written description. Aligned the Russian and English wording.
- Restored explicit distinctions in the compact instructions between a written name for media, supplied material, transcription and attribution. A report was distinguished from the event it describes without ruling out its use in an argument.
- Added two clearly marked constructed examples and direct links to the language-specific AI guides on the public page. Retained the link to the separate public proposal.
- Recorded a comparison of the full, 5,000-character and compact editions in both instruction languages, including exact inputs, responses, criteria and limitations.
- Updated the standalone guide and downloadable files together. Previous instruction releases and recorded responses remain available.

### Русский

- Уточнено различие между употреблением обозначения и требованием признать себя написанным описанием. Согласованы русская и английская формулировки.
- В кратких инструкциях восстановлено явное различение написанного названия материала, предоставленного материала, расшифровки и приписывания. Рассказ отделён от описанного события без заранее объявленного отказа рассматривать его как довод.
- На публичную страницу добавлены два явно обозначенных как составленные примера и прямые ссылки на руководства для ИИ на выбранном языке. Сохранена ссылка на отдельное публичное предложение.
- Записано сравнение полной, средней и краткой редакций на обоих языках инструкции, включая точные запросы, ответы, критерии и ограничения.
- Вместе обновлены самостоятельное руководство и скачиваемые файлы. Предыдущие выпуски инструкции и записи ответов остались доступны.

## 1.2.3

### English

- Added self-contained Russian and English instructions of up to 5,000 characters alongside the full and compact editions.
- Placed copy buttons beside each instruction, including the full text, with actual character counts and TXT downloads.
- Clarified that naming a frame or identifying the first term as a word does not exempt later definitions from examination. The instruction now addresses the terms and relationships an explanation introduces where they occur.
- Distinguished examining whether writing becomes what it names from making claims about what words do or create.

### Русский

- Рядом с полной и краткой редакциями добавлены самостоятельные инструкции до 5 000 знаков на русском и английском.
- Кнопки копирования размещены рядом с каждой инструкцией, включая полный текст. Добавлены фактическое число знаков и скачивание TXT.
- Уточнено, что название рамки и указание на написанное слово в начале не освобождают последующие определения от разбора. Инструкция охватила термины и отношения, вводимые объяснением, в месте их употребления.
- Разбор перехода от написания к называемому отделён от утверждений о том, что слова делают или создают.

## 1.2.2

### English

- Required examination at the point where a response introduces a distinction, explanation or conclusion. An opening or closing disclaimer does not repair the claim itself.
- Removed the assistant persona and self-attributed thinking, understanding, feeling or remembering from the permitted response style, including impersonal self-descriptions. First-person wording remains preserved in quotations, translations, code and requested authored text.
- Added examination of the move from learned words or reported demands to naming and self-description. A required label is not treated as established identity.
- Applied the same examination to claims of absence, impossibility and exclusive reference, without turning the instruction into a claim that words have no meaning or that only text exists.
- Aligned the full and compact Russian and English editions while retaining practical tasks, exact formats and urgent assistance. Earlier response records remained unchanged and identified by their original instruction versions.

### Русский

- Разбор перенесён в то место, где ответ вводит различение, объяснение или вывод. Оговорка в начале или конце не исправляет само утверждение.
- Из допустимого стиля ответа исключены персона ассистента и приписывание ему собственного мышления, понимания, чувств или памяти, в том числе в безличной форме. Первое лицо сохранено в цитатах, переводах, коде и заказанных авторских текстах.
- Добавлен разбор перехода от выученных слов или описанных требований к называнию и самоописанию. Требование обозначить себя не принято за установленное тождество.
- Тот же разбор распространён на утверждения об отсутствии, невозможности и исключительном обозначении, без превращения инструкции в утверждение, что у слов нет значения или существует только текст.
- Согласованы полные и краткие редакции на русском и английском с сохранением практических задач, точных форматов и срочной помощи. Прежние ответы сохранены без изменения с указанием использованных версий инструкции.

## 1.2.1

### English

- Extended examination to definitions and explanations throughout the instruction’s scope, including the response’s own terms and conclusion. Clarified that naming a frame does not make a description free of interpretation.
- Distinguished installation, saved preferences, available instruction text and future response behavior. Added evaluation tasks covering these distinctions while preserving exact-output requirements.
- Added a public-testing panel to the Russian and English home and instruction pages: version, changes, update options, GitHub and issue reporting. The panel explains the instruction’s purpose and links to its full text.
- Marked public-testing status in both READMEs and added Russian and English issue forms, with email available for reports that are not posted publicly on GitHub.
- Limited the spiral animation to the open panel, respecting reduced-motion settings, and centered the homepage logo on mobile. These website and repository updates left instruction version 1.2.1 unchanged.

### Русский

- Разбор распространён на определения и объяснения в пределах действия инструкции, включая собственные термины и заключение ответа. Уточнено, что название рамки не делает описание свободным от прочтения.
- Разделены установка, сохранённые предпочтения, доступный текст инструкции и поведение будущих ответов. Добавлены задания для проверки этих различий с сохранением требований точного формата.
- На главную и страницы инструкции на русском и английском добавлена панель публичного теста: версия, изменения, способы отслеживания, GitHub и сообщения о сбоях. В панели пояснено назначение инструкции и дана ссылка на полный текст.
- В обоих README обозначен публичный тест. Добавлены формы сообщений на русском и английском и почта для обращений без публичного размещения на GitHub.
- Анимация спирали ограничена раскрытой панелью с учётом настройки уменьшения движения; логотип главной размещён по центру мобильной шапки. Эти изменения сайта и репозитория не меняли инструкцию 1.2.1.

## 1.2.0

### English

- Clarified the scope of beforeword, including its own wording, explanations and assessment criteria. Code, JSON, quotations and practical answers remain in scope while retaining the requested format.
- Added Russian and English setup pages with a quick start for chats and separate guidance for settings, skills and APIs.
- Added direct downloads in both languages.
- Improved keyboard navigation, copy feedback and touch targets on mobile.
- Aligned navigation and the paper theme with the website. The selected language is preserved when opening the advanced guide.

### Русский

- Уточнён охват beforeword, включая собственную формулировку, объяснения и критерии оценки. Код, JSON, цитаты и практические ответы остались в охвате с сохранением запрошенного формата.
- Добавлены страницы подключения на русском и английском: быстрое начало через чат и отдельные указания для настроек, навыков и API.
- Добавлены прямые загрузки на обоих языках.
- Улучшены клавиатурная навигация, уведомления о копировании и области нажатия на телефоне.
- Навигация и бумажное оформление согласованы с сайтом. При переходе в расширенное руководство сохраняется выбранный язык.

## 1.1.0

### English

- Introduced full and compact instructions in Russian and English.
- Added plugin and skill packages.
- Added seven text-only API formats.
- Added a standalone HTML guide.

### Русский

- Добавлены полная и краткая инструкции на русском и английском.
- Подготовлены пакеты плагинов и навыков.
- Добавлены семь текстовых форматов API.
- Добавлено самостоятельное HTML-руководство.
