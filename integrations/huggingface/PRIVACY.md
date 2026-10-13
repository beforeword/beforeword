# beforeword MCP connector · data handling

This notice covers the server in `integrations/huggingface`, not the separately distributed skills-only plugin packages or other beforeword websites.

Instruction retrieval returns a bundled, public instruction selected by `language: en` or `language: ru`. That tool and prompt accept only the language parameter; the instruction resource URI contains the same choice. A separate dictionary tool, `lookup_dictionary_entry`, accepts one selected word or short expression (at most 120 characters) and a dictionary language. The app has no file upload, conversation-history or credential field. Unsupported language values return errors.

The application does not call a model provider. Retrieving the bundled instruction needs no external dictionary request. Dictionary lookup sends the selected word/expression to `en.wiktionary.org` or `ru.wiktionary.org` through Wikimedia's public API. It does not need the complete source text or context. The request uses the server's network address and identifies beforeword as the requesting app. Wikimedia can process the queried word and request metadata under its [privacy policy](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy). Only submit a word or expression you want looked up publicly; do not include private text or secrets.

The app does not implement a conversation store, user database, persistent dictionary-query history, or request-content analytics. It processes the lookup and response in memory. Gradio usage analytics is disabled. Framework errors and requests may still appear in hosting or framework logs. The app cannot control those systems' retention.

A network request necessarily reaches the hosting provider. When hosted on Hugging Face, the provider may process the request and technical metadata such as network address, headers, time, endpoint, and operational logs under its [privacy policy](https://huggingface.co/privacy). Platform logging and retention are not controlled by this instruction provider. Hugging Face pages and authentication may process additional data under the platform's own settings and policies. The beforeword application does not request Hugging Face account access or a model API key to retrieve these public instructions.

The connected AI client determines whether to invoke the server, what context it stores, and whether it uses the returned instruction. Its handling of your conversation remains governed by that client's settings and provider policies. Connecting or retrieving an instruction does not delete earlier conversation data or change retention settings.

Do not put private text in the word or language parameter, request URL, or issue tracker. A connected client chooses what arguments to send; the tool description instructs it to send only a user-selected lookup, but this is not a guarantee about that client's behavior. [GitHub issues](https://github.com/beforeword/beforeword/issues) are public, voluntary submissions handled under GitHub's policies.

---

# beforeword · обработка данных коннектором MCP

Этот документ относится к серверу в `integrations/huggingface`, а не к отдельным пакетам инструкций для каталогов плагинов или другим сайтам beforeword.

Получение инструкции возвращает общедоступный текст из поставляемого файла по выбору `language: en` или `language: ru`. Этот инструмент и промпт принимают только язык; URI ресурса содержит тот же выбор. Отдельный словарный инструмент `lookup_dictionary_entry` принимает выбранное слово или короткое выражение (до 120 знаков) и язык словаря. Полей для загрузки файлов, истории переписки или учётных данных нет. Неподдерживаемый язык возвращает ошибку.

Приложение не обращается к модели. Для выдачи поставляемой инструкции внешние словарные запросы не нужны. При словарном поиске выбранное слово или выражение отправляется в публичный API `en.wiktionary.org` или `ru.wiktionary.org`. Исходный фрагмент целиком и его контекст не требуются. Запрос использует сетевой адрес сервера и указывает beforeword как приложение. Wikimedia может обрабатывать искомое слово и метаданные запроса по своей [политике конфиденциальности](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy). Передавай только выбранное для открытого словарного поиска слово; не включай закрытые данные или секреты.

Приложение не создаёт хранилище переписки, базу пользователей, постоянную историю словарных запросов или аналитику их содержания. Запрос и ответ обрабатываются в памяти. Аналитика Gradio отключена. Запросы и ошибки при этом могут попадать в журналы хостинга и фреймворка; сроки хранения в этих системах приложение не определяет.

Сетевой запрос поступает хостингу. При размещении на Hugging Face платформа может обрабатывать запрос и технические метаданные: сетевой адрес, заголовки, время, адрес запрашиваемого ресурса и служебные журналы — по своей [политике конфиденциальности](https://huggingface.co/privacy). Журналирование и сроки хранения на платформе не задаются этим коннектором. Страницы и вход Hugging Face могут обрабатывать дополнительные данные по правилам и настройкам платформы. Для получения общедоступной инструкции приложение beforeword не запрашивает доступ к аккаунту Hugging Face или API-ключ модели.

Подключённый клиент ИИ определяет, когда вызывать сервер, что сохранять в контексте и как использовать инструкцию. Обработка переписки регулируется настройками и правилами этого клиента. Подключение или получение инструкции не удаляет прежнюю переписку и не меняет сроки её хранения.

Не вставляй закрытые данные в параметр слова или языка, URL запроса или обсуждения ошибок. Аргументы выбирает подключённый клиент. Описание инструмента требует передавать только выбранный пользователем запрос, но это не гарантирует поведение клиента. [GitHub issues](https://github.com/beforeword/beforeword/issues) — добровольные публичные обращения, обработка которых регулируется правилами GitHub.
