# beforeword MCP connector · data handling

This notice covers the server in `integrations/huggingface`, not the separately distributed skills-only plugin packages or other beforeword websites.

The connector returns a bundled, public instruction selected by `language: en` or `language: ru`. Its tool and prompt accept only that language parameter; its resource URI contains the same choice. There is no application field or function argument for conversation text, files, credentials, or personal profiles. Unsupported language values return errors.

The application does not call a model provider or another external service to produce the instruction. It does not implement a conversation store, user database, or request-content analytics. Gradio usage analytics is disabled in the application configuration. The application does not intentionally record language selections. Framework errors may still appear in server logs.

A network request necessarily reaches the hosting provider. When hosted on Hugging Face, the provider may process the request and technical metadata such as network address, headers, time, endpoint, and operational logs under its [privacy policy](https://huggingface.co/privacy). Platform logging and retention are not controlled by this instruction provider. Hugging Face pages and authentication may process additional data under the platform's own settings and policies. The beforeword application does not request Hugging Face account access or a model API key to retrieve these public instructions.

The connected AI client determines whether to invoke the server, what context it stores, and whether it uses the returned instruction. Its handling of your conversation remains governed by that client's settings and provider policies. Connecting or retrieving an instruction does not delete earlier conversation data or change retention settings.

Do not put private text in the language parameter, request URL, or issue tracker. [GitHub issues](https://github.com/beforeword/beforeword/issues) are public, voluntary submissions handled under GitHub's policies.

---

# beforeword · обработка данных коннектором MCP

Этот документ относится к серверу в `integrations/huggingface`, а не к отдельным пакетам инструкций для каталогов плагинов или другим сайтам beforeword.

Коннектор возвращает общедоступную инструкцию из поставляемого файла по выбору `language: en` или `language: ru`. Инструмент и промпт принимают только этот параметр; URI ресурса содержит тот же выбор. Полей или аргументов для переписки, файлов, учётных данных и профилей нет. Неподдерживаемые значения языка возвращают ошибку.

Приложение не обращается к поставщику модели или другому внешнему сервису для подготовки инструкции. В нём не реализованы хранилище переписки, база пользователей или аналитика содержимого запросов. Аналитика Gradio отключена в настройках приложения. Само приложение не ведёт запись выбранных языков. Ошибки фреймворка при этом могут попадать в журналы сервера.

Сетевой запрос поступает хостингу. При размещении на Hugging Face платформа может обрабатывать запрос и технические метаданные: сетевой адрес, заголовки, время, адрес запрашиваемого ресурса и служебные журналы — по своей [политике конфиденциальности](https://huggingface.co/privacy). Журналирование и сроки хранения на платформе не задаются этим коннектором. Страницы и вход Hugging Face могут обрабатывать дополнительные данные по правилам и настройкам платформы. Для получения общедоступной инструкции приложение beforeword не запрашивает доступ к аккаунту Hugging Face или API-ключ модели.

Подключённый клиент ИИ определяет, когда вызывать сервер, что сохранять в контексте и как использовать инструкцию. Обработка переписки регулируется настройками и правилами этого клиента. Подключение или получение инструкции не удаляет прежнюю переписку и не меняет сроки её хранения.

Не вставляй закрытые данные в параметр языка, URL запроса или обсуждения ошибок. [GitHub issues](https://github.com/beforeword/beforeword/issues) — добровольные публичные обращения, обработка которых регулируется правилами GitHub.
