(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const formCore = globalThis.BeforewordFormCore;
  const core = globalThis.BeforewordAnalysisCore;
  const adapter = globalThis.BeforewordAnalysisModel;
  const providers = globalThis.BeforewordProviders;
  const providerAuth = globalThis.BeforewordProviderAuth;
  const examples = Array.isArray(globalThis.BeforewordExamples) ? globalThis.BeforewordExamples : [];
  const extension = Boolean(globalThis.chrome?.runtime?.id);
  const webHost = !extension ? globalThis.BeforewordWebHost : null;
  const readingSurface = globalThis.BeforewordReadingSurface;
  const REQUEST_MAX = core?.MAX_CHARS || 12000;
  const MAX = readingSurface?.MAX_TOTAL_CHARS || 240000;
  const PAGE_SIZE = 120;
  const COPY = {
    en: {
      demoNote:'Offline preview',title:'Reading the written form',purpose:'Written language is read through learned rules. Examine what a reading adds.',inputLabel:'Text to examine',quickExample:'See how it works',noteLabel:'A note from beforeword',frame:'Written language, read through learned signs and rules.',boundary:'Writing does not become what it names.',ownScope:'This note and the analysis are writing too.',incomingTitle:'Another selection',incomingNote:'Your current text stays in place until you choose to replace it.',replaceSelection:'Use this selection',keepCurrent:'Keep current text',editorTitle:'Edit the text',placeholder:'Paste the writing here.',inputNote:'The character sequence is retained.',lineEndings:'Original line endings are preserved. Editing can replace them with the browser’s line endings.',capture:'Bring in selected page text',recordTitle:'What was written',recordViewNote:'The source page’s fonts and layout are not reproduced here.',copy:'Copy text',analyze:'Examine text',retry:'Try analysis again',cancelAnalysis:'Cancel analysis',sendNotice:'Choosing “Examine text” sends this text to the beforeword service and OpenAI.',previewNotice:'This preview shows authored examples. Your text stays on this page; no model analysis is sent.',previewAction:'Analysis is unavailable in this preview',detailTitle:'Grounds for this reading',working:'The text is being analysed. You can cancel or edit it.',cancelled:'Analysis cancelled here. A request already sent may still be processed by the service.',changed:'The text changed. The previous analysis was cleared.',languageCancelled:'The language changed. The running analysis was cancelled here; the service may still process the request.',reportLanguage:'Analysis language: {language}',analysisTitle:'A proposed reading',modelOrigin:'Model-generated analysis',exampleOrigin:'Authored example, not a model response',reportBoundary:'The model can make mistakes. An exact excerpt lets you check the wording; it does not confirm the conclusion.',quoteLabel:'Written form · exact excerpt',readingLabel:'Proposed reading',attributionLabel:'What this reading adds',groundsLabel:'Stated grounds',limitLabel:'Limit of the claim',recordGrounds:'In the supplied text',learnedGrounds:'Learned usage',missingGrounds:'Not supplied',citationsLabel:'Cited wording',locateQuote:'Locate this excerpt in the text',copyAnalysis:'Copy analysis',analysisCopied:'Analysis copied, with its source and origin label.',copied:'Copied',quoteDownloaded:'Downloaded',quoteCopyFailed:'Could not copy',downloaded:'Clipboard access was unavailable. The text was downloaded as a file.',copyFailed:'The text could not be copied or downloaded. Try again.',inspectTitle:'Inspect the characters',inspectNote:'A separate view of the supplied text, without an interpretation of its meaning.',inspectionUnavailable:'This browser cannot provide the supported character grouping. The text and copying remain available.',previous:'Previous',next:'Next',tokenNote:'Space, line break, tab, and control are interface labels. They are not added to the text.',examplesTitle:'Authored examples',exampleLabel:'Example',loadExample:'Open example',exampleNote:'These examples were written in advance. Opening one does not send a model request.',helpTitle:'How it works',extensionHelp:'Select ordinary page text and open beforeword from the browser toolbar, or paste it here. Then choose “Examine text”.',demoHelp:'Open an authored example to explore the analysis. This preview does not analyse entered text or capture selections from other tabs.',analysisHelp:'The model proposes a reading, identifies what that reading attributes, and states its grounds and limits. Click an excerpt to locate it in the supplied text.',shortcutHelp:'Ctrl + Enter or ⌘ + Enter in the text field starts the analysis. Editing or replacing the text clears the previous analysis.',localHelp:'There is no automatic analysis or message sending. An authored example is labelled separately from a model response.',dataTitle:'Text and data',panelData:'The current text and analysis stay in this panel’s memory. Hiding or closing the side panel may leave it open in the browser. Reloading loses this panel state. Use Reset to clear it explicitly.',extensionData:'The latest selected fragment and an automatically issued temporary access session are kept in the browser session. Reset clears them. Only the language preference is saved between browser sessions.',demoData:'The preview does not receive selections from other tabs. Reloading clears its text, analysis, and language choice.',resetNote:'Reset clears this panel, the captured selection, and the local service session. It does not delete copies, downloaded files, or a request already sent.',privacyLink:'Full data and permissions information',reset:'Reset',cleared:'The text, analysis, and captured selection were cleared here.',clearFailed:'The panel was cleared, but the captured browser selection could not be cleared. Close the browser to end that session.',clearSessionFailed:'The panel was cleared, but the local service access session could not be cleared. Close the browser to end that session.',kept:'The current text was kept.',noSelection:'Select ordinary page text first, or paste writing here.',editableSelection:'Text from editable fields is not captured. Paste the intended writing here.',captureUnavailable:'The selection could not be obtained from this page. Paste writing here.',storageUnavailable:'Browser session storage is unavailable. Paste writing here.',tooLong:'The input exceeds 12,000 characters. Shorten it explicitly; nothing was truncated.',empty:'Paste or select writing first.',unavailable:'A required component could not be loaded. Reload this page.',configError:'Analysis is not available right now. You can open an authored example.',serverConfigError:'The analysis service is not ready yet. You can open an authored example.',permissionError:'The analysis service could not be reached. Try again later.',previewOnly:'This preview does not request model analysis. Open an authored example to see how it works.',sessionExpired:'The session has expired. Try the analysis again.',sessionLimit:'This session’s analysis limit has been reached. Please try again later.',networkLimit:'The request limit for this network has been reached. Please try again later.',sessionIssuanceLimit:'Too many new sessions have been requested. Please try again later.',dailyLimit:'The daily analysis limit has been reached. Please try again later.',monthlyLimit:'The service’s monthly limit has been reached. Analysis is unavailable for now.',serviceBusy:'The service is busy. Please try again in a little while.',networkError:'The service could not be reached. Check your connection and try again.',rateLimit:'The service’s rate or quota limit was reached. Try again later.',accessError:'The service could not accept this request. Please try again later.',modelUnavailable:'The model is temporarily unavailable. Try again later.',timeout:'The analysis timed out. Try again; the text is unchanged.',invalidResponse:'The service did not return a usable analysis with exact excerpts. Try again.',serviceError:'The analysis service returned an error. Try again.',refused:'The model did not provide an analysis for this request.',contextLimit:'This text exceeds the model’s available context. Shorten it explicitly before trying again.',unexpected:'The text could not be used. It remains in place.',languageSaveFailed:'The language changed here, but its preference could not be saved.',selectionOrigin:'Browser selection',fragments:'Fragments',page:'Page',of:'of',fragment:'Fragment',visible:'Written fragment',space:'Space',linebreak:'Line break',tab:'Tab',control:'Control',spaceShort:'space',linebreakShort:'line break',tabShort:'tab',controlShort:'control',kindLabel:'Interface label',item:'Reading',modelLabel:'Model',invalidExample:'This authored example could not be loaded. No model request was made.'
    },
    ru: {
      demoNote:'Демо без отправки текста',title:'Разбор записи',purpose:'Письменную форму языка читают по выученным правилам. Разбор показывает, что добавляет прочтение.',inputLabel:'Текст для разбора',quickExample:'Показать, как это работает',noteLabel:'Пояснение beforeword',frame:'Письменная форма языка, читаемая по выученным знакам и правилам.',boundary:'Написанное не становится тем, что им называют.',ownScope:'Это пояснение и разбор — тоже письменная форма.',incomingTitle:'Новое выделение',incomingNote:'Текущий текст остаётся на месте, пока вы явно не замените его.',replaceSelection:'Использовать выделение',keepCurrent:'Оставить текущий текст',editorTitle:'Изменить текст',placeholder:'Вставьте запись сюда.',inputNote:'Последовательность знаков сохраняется.',lineEndings:'Исходные переносы строк сохранены. Редактирование может заменить их переносами браузера.',capture:'Получить выделенный текст страницы',recordTitle:'Что написано',recordViewNote:'Шрифт и расположение исходной страницы здесь не воспроизводятся.',copy:'Скопировать текст',analyze:'Разобрать текст',retry:'Повторить разбор',cancelAnalysis:'Отменить разбор',sendNotice:'По нажатию «Разобрать текст» запись отправляется сервису beforeword и OpenAI.',previewNotice:'В демо доступны составленные примеры. Ваш текст остаётся на этой странице; запрос разбора не отправляется.',previewAction:'Разбор недоступен в демо',detailTitle:'Основания этого прочтения',working:'Идёт разбор текста. Его можно отменить или изменить запись.',cancelled:'Разбор здесь отменён. Сервис может продолжить обработку уже отправленного запроса.',changed:'Текст изменён. Предыдущий разбор убран.',languageCancelled:'Язык изменён. Текущий разбор отменён здесь; сервис может продолжить уже отправленный запрос.',reportLanguage:'Язык готового разбора: {language}',analysisTitle:'Предлагаемое прочтение',modelOrigin:'Разбор, предложенный моделью',exampleOrigin:'Составленный пример, не ответ модели',reportBoundary:'Модель может ошибаться. Точная цитата позволяет сверить запись, но не подтверждает вывод.',quoteLabel:'Письменная форма · точная цитата',readingLabel:'Предлагаемое прочтение',attributionLabel:'Что добавляет такое прочтение',groundsLabel:'Указанное основание',limitLabel:'Предел утверждения',recordGrounds:'В предоставленной записи',learnedGrounds:'Выученное употребление',missingGrounds:'Не предоставлено',citationsLabel:'Цитируемая запись',locateQuote:'Найти эту цитату в записи',copyAnalysis:'Скопировать разбор',analysisCopied:'Разбор скопирован вместе с исходной записью и указанием происхождения.',copied:'Скопировано',quoteDownloaded:'Скачано',quoteCopyFailed:'Не удалось скопировать',downloaded:'Буфер обмена недоступен. Текст сохранён файлом.',copyFailed:'Скопировать или скачать текст не удалось. Повторите действие.',inspectTitle:'Рассмотреть знаки',inspectNote:'Отдельный способ показа предоставленной записи без толкования её смысла.',inspectionUnavailable:'Браузер не поддерживает используемое разбиение на знаки. Запись и её копирование остаются доступны.',previous:'Назад',next:'Далее',tokenNote:'«Пробел», «перенос», «табуляция» и «служебный знак» — подписи интерфейса. Они не добавляются в запись.',examplesTitle:'Составленные примеры',exampleLabel:'Пример',loadExample:'Открыть пример',exampleNote:'Эти примеры написаны заранее. Их открытие не отправляет запрос модели.',helpTitle:'Как это работает',extensionHelp:'Выделите обычный текст страницы и откройте beforeword на панели браузера или вставьте запись сюда. Затем нажмите «Разобрать текст».',demoHelp:'Откройте составленный пример, чтобы посмотреть разбор. Демо не анализирует введённый текст и не получает выделения из других вкладок.',analysisHelp:'Модель предлагает прочтение, указывает, что оно приписывает записи, и называет основание и предел. Нажмите на цитату, чтобы найти её в исходном тексте.',shortcutHelp:'Ctrl + Enter или ⌘ + Enter в поле текста запускает разбор. Редактирование или замена текста очищает предыдущий разбор.',localHelp:'Автоматического разбора и отправки сообщений нет. Составленный пример отделён подписью от ответа модели.',dataTitle:'Текст и данные',panelData:'Текущие текст и разбор остаются в памяти панели. Скрытие или закрытие боковой панели может оставить её открытой в браузере. Перезагрузка удалит это состояние. Для явной очистки используйте «Сбросить».',extensionData:'В сеансе браузера хранятся последнее выделение и автоматически полученный временный сеанс доступа. «Сбросить» очищает их. Между сеансами браузера сохраняется только выбор языка.',demoData:'Демонстрация не получает выделения других вкладок. Обновление очищает её текст, разбор и выбор языка.',resetNote:'Сброс очищает панель, сохранённое выделение и локальный сеанс сервиса. Он не удаляет копии, скачанные файлы или уже отправленный запрос.',privacyLink:'Полные сведения о данных и разрешениях',reset:'Сбросить',cleared:'Текст, разбор и сохранённое выделение очищены здесь.',clearFailed:'Панель очищена, но очистить выделение в сеансе браузера не удалось. Закройте браузер, чтобы завершить этот сеанс.',clearSessionFailed:'Панель очищена, но локальный сеанс доступа к сервису очистить не удалось. Закройте браузер, чтобы завершить этот сеанс.',kept:'Текущий текст сохранён.',noSelection:'Сначала выделите обычный текст страницы или вставьте запись сюда.',editableSelection:'Текст редактируемых полей не извлекается. Вставьте нужную запись сюда.',captureUnavailable:'Получить выделение этой страницы не удалось. Вставьте запись сюда.',storageUnavailable:'Хранилище сеанса браузера недоступно. Вставьте запись сюда.',tooLong:'Поле превышает 12 000 знаков. Сократите запись явно; текст не был обрезан.',empty:'Сначала вставьте или выделите запись.',unavailable:'Необходимый компонент не загрузился. Обновите страницу.',configError:'Разбор сейчас недоступен. Можно открыть составленный пример.',serverConfigError:'Сервис разбора пока не готов. Можно открыть составленный пример.',permissionError:'Не удалось связаться с сервисом разбора. Повторите действие позже.',previewOnly:'В демо запросы модели не отправляются. Откройте составленный пример, чтобы посмотреть разбор.',sessionExpired:'Сеанс завершён. Повторите разбор.',sessionLimit:'Достигнут лимит разбора для этого сеанса. Повторите действие позже.',networkLimit:'Достигнут лимит запросов для этой сети. Повторите действие позже.',sessionIssuanceLimit:'Запрошено слишком много новых сеансов. Повторите действие позже.',dailyLimit:'Достигнут дневной лимит разбора. Повторите действие позже.',monthlyLimit:'Достигнут месячный лимит сервиса. Разбор пока недоступен.',serviceBusy:'Сервис занят. Повторите действие немного позже.',networkError:'Не удалось связаться с сервисом. Проверьте подключение и повторите действие.',rateLimit:'Достигнут лимит частоты или квоты сервиса. Повторите запрос позже.',accessError:'Сервис не смог принять запрос. Повторите действие позже.',modelUnavailable:'Модель временно недоступна. Повторите запрос позже.',timeout:'Время ожидания разбора истекло. Повторите действие; текст остался на месте.',invalidResponse:'Сервис не вернул пригодный разбор с точными цитатами. Повторите действие.',serviceError:'Сервис разбора вернул ошибку. Повторите действие.',refused:'Модель не предоставила разбор для этого запроса.',contextLimit:'Этот текст превышает доступный контекст модели. Перед повтором явно сократите его.',unexpected:'Не удалось использовать запись. Она осталась на месте.',languageSaveFailed:'Язык здесь изменён, но сохранить выбор не удалось.',selectionOrigin:'Выделение браузера',fragments:'Фрагментов',page:'Страница',of:'из',fragment:'Фрагмент',visible:'Письменный фрагмент',space:'Пробел',linebreak:'Перенос строки',tab:'Табуляция',control:'Служебный знак',spaceShort:'пробел',linebreakShort:'перенос',tabShort:'табуляция',controlShort:'служебный',kindLabel:'Подпись интерфейса',item:'Прочтение',modelLabel:'Модель',invalidExample:'Не удалось загрузить составленный пример. Запрос модели не отправлялся.'
    }
  };
  Object.assign(COPY.en,{"settingsTitle": "Settings", "closeSettings": "Close settings", "enableSite": "Enable the button on this site", "siteEntryNote": "Then select text and click the beforeword symbol beside it.", "siteTitle": "The button beside a selection", "siteToggle": "On this site", "siteEnabled": "The button appears beside selected text on this site.", "siteDisabled": "Enable it to show the button beside selected text on this site.", "siteUnavailable": "The button is unavailable on this page. You can paste text into beforeword.", "sitePreview": "Site access is unavailable in this preview.", "siteFailure": "The site setting could not be changed. Try again.", "sitePermission": "Site access was not allowed. Your setting is unchanged.", "siteSaved": "The site setting was saved.", "ownModel": "Your own model", "useOwnModel": "Use your own model", "modelSettings": "Model settings", "analysisMode": "Analysis with", "protocolLabel": "API format", "endpointLabel": "Full request address", "modelName": "Model", "keyLabel": "API key", "keyNote": "The key stays in the browser session. It is not included in copied analyses.", "keyPresent": "A key is saved for this provider in the current browser session.", "keyMissing": "No key is saved for this provider.", "forgetKey": "Forget key", "saveSettings": "Save", "settingsPreview": "This preview shows the controls only. It does not save provider access or request permissions.", "settingsSaved": "Settings saved. No request was sent to the model.", "keyForgotten": "The saved key was removed.", "settingsStorage": "The browser could not save this setting. Try again.", "settingsInvalid": "Check the API format, full request address, and model name.", "keyInvalid": "Enter a valid API key for the chosen provider.", "modelPermission": "Access to the provider address was not allowed. Settings were not saved.", "trialUnknown": "Limit: 8 analyses", "trialRemaining": "{remaining} of {limit} analyses left", "trialNote": "API requests use tokens from beforeword’s budget. This installation gets {limit} analyses; provider errors do not use one.", "trialPreview": "This preview uses authored examples, not live introductory analyses.", "trialExhausted": "The analysis allowance has been used. You can continue with your own model.", "customDestination": "This text will be sent directly to {endpoint} · Model: {model}.", "customNotReady": "Your model is not configured yet. Open Model settings.", "customAuth": "The provider did not accept access. Check your key in Model settings.", "extensionHelp": "Enable beforeword on the current site once. Select text and click the symbol beside it; the side panel opens and begins the analysis. You can also paste text here and choose “Examine text”.", "extensionData": "The latest selection, service session and provider key are kept in the browser session. Language, enabled sites, model preferences and the installation’s trial identity persist. The provider key is not saved between browser sessions.", "resetNote": "Reset clears the current text, analysis, selection and service session. It does not reset the introductory allowance, site permissions or model preferences. Use “Forget key” in Settings to remove your provider key.", "sendNotice": "The selected text is sent to beforeword and OpenAI only when you click the selection symbol or “Examine text”."});
  Object.assign(COPY.ru,{"settingsTitle": "Настройки", "closeSettings": "Закрыть настройки", "enableSite": "Включить кнопку на этом сайте", "siteEntryNote": "Затем выделите текст и нажмите значок beforeword рядом с ним.", "siteTitle": "Кнопка рядом с выделением", "siteToggle": "На этом сайте", "siteEnabled": "Кнопка появляется рядом с выделенным текстом на этом сайте.", "siteDisabled": "Включите её, чтобы показывать кнопку рядом с выделенным текстом на этом сайте.", "siteUnavailable": "На этой странице кнопка недоступна. Можно вставить текст в beforeword.", "sitePreview": "В демо нет доступа к другим сайтам.", "siteFailure": "Не удалось изменить настройку сайта. Повторите действие.", "sitePermission": "Доступ к сайту не разрешён. Настройка не изменилась.", "siteSaved": "Настройка сайта сохранена.", "ownModel": "Своя модель", "useOwnModel": "Использовать свою модель", "modelSettings": "Настройки модели", "analysisMode": "Разбор через", "protocolLabel": "Формат API", "endpointLabel": "Полный адрес запроса", "modelName": "Модель", "keyLabel": "Ключ API", "keyNote": "Ключ остаётся в сеансе браузера. В копии разбора его нет.", "keyPresent": "Для этого поставщика ключ сохранён в текущем сеансе браузера.", "keyMissing": "Для этого поставщика ключ не сохранён.", "forgetKey": "Забыть ключ", "saveSettings": "Сохранить", "settingsPreview": "В демо можно посмотреть настройки. Доступ к поставщику не сохраняется, разрешения не запрашиваются.", "settingsSaved": "Настройки сохранены. Запрос модели не отправлялся.", "keyForgotten": "Сохранённый ключ удалён.", "settingsStorage": "Браузер не смог сохранить настройку. Повторите действие.", "settingsInvalid": "Проверьте формат API, полный адрес запроса и имя модели.", "keyInvalid": "Укажите действительный ключ API выбранного поставщика.", "modelPermission": "Доступ к адресу поставщика не разрешён. Настройки не сохранены.", "trialUnknown": "Лимит — 8 разборов", "trialRemaining": "Осталось {remaining} из {limit} разборов", "trialNote": "Запросы к API расходуют токены и бюджет beforeword. На установку доступно {limit} разборов; ошибки поставщика их не расходуют.", "trialPreview": "В демо доступны составленные примеры, а не ознакомительные запросы модели.", "trialExhausted": "Лимит разборов использован. Можно продолжить со своей моделью.", "customDestination": "Этот текст будет отправлен напрямую на {endpoint} · Модель: {model}.", "customNotReady": "Своя модель ещё не настроена. Откройте настройки модели.", "customAuth": "Поставщик не разрешил доступ. Проверьте ключ в настройках модели.", "extensionHelp": "Один раз включите beforeword на текущем сайте. Выделите текст и нажмите значок рядом — боковая панель откроется и начнёт разбор. Можно также вставить текст сюда и нажать «Разобрать текст».", "extensionData": "В сеансе браузера хранятся последнее выделение, сеанс сервиса и ключ поставщика. Язык, разрешённые сайты, настройки модели и идентификатор ознакомительного набора сохраняются между сеансами. Ключ поставщика между сеансами не сохраняется.", "resetNote": "Сброс очищает текущие текст, разбор, выделение и сеанс сервиса. Он не обновляет ознакомительный лимит, не отменяет разрешения сайтов и настройки модели. Ключ удаляется действием «Забыть ключ» в настройках.", "sendNotice": "Выделенный текст отправляется beforeword и OpenAI только после нажатия значка у выделения или «Разобрать текст»."});
  Object.assign(COPY.en,{
    entryGuide:'Select text on a page and click the beforeword symbol, or paste a passage below.',
    serviceActionNotice:'“Examine text” sends this text to beforeword and OpenAI.',
    connectionCaption:'Analysis with',connectionRequired:'Connect a model',customSendNotice:'Choosing “Examine text” sends this passage directly to {provider}. Model: {model}.',
    connectionTitle:'Analysis connection',serviceOption:'beforeword · 8 analyses',providerLabel:'Provider',
    directRoute:'Requests go directly to your provider. Its API usage is billed to your account.',
    openRouterConnect:'Connect OpenRouter account',openRouterNote:'Approve access on OpenRouter. The access key stays in this browser session.',orApiKey:'or use an API key',getKey:'Get a key ↗',
    loadModels:'Load available models',loadingModels:'Loading models…',modelPlaceholder:'Load the list or enter a model ID',
    modelListNote:'Choose a model from the list or enter its API ID. No analysis request is sent when loading the list.',
    modelsLoaded:'{count} models returned by the provider. Choose one or enter its API ID.',modelsEmpty:'The provider returned no models. Enter a model ID if your account has access.',
    modelsFailed:'The model list could not be loaded. Check your key and connection, or enter a model ID.',modelKeyRequired:'Enter an API key or connect an account first.',
    advancedSettings:'Advanced',workspaceLabel:'Anthropic workspace ID · optional',
    subscriptionNote:'A ChatGPT, Claude or Gemini chat subscription does not connect an API account here.',
    accountConnecting:'Opening OpenRouter… Complete the connection in its window.',accountConnected:'OpenRouter connected for this session. Choose a model, then save.',
    accountCancelled:'The connection was cancelled. No account was connected.',accountFailed:'The account could not be connected. Try again or use an API key.',
    connectionAction:'Change analysis connection',compatibleProvider:'Other / compatible API',returnSource:'← Back to the source page',sourceUnavailable:'The source page is no longer available.',
    panelKeyNote:'This browser keeps the key only while this panel stays open. Reopening the panel requires a new connection.',
    settingsInvalid:'Choose a model. For a custom API, also check its format and full request address.',
    keyNote:'The key stays in this browser session. It is never included in copied analyses.',
    extensionHelp:'Enable beforeword on the current site once. Select text and click the symbol beside it to open the analysis. You can also paste text here and choose “Examine text”.',
    panelAccountNote:'Approve access on OpenRouter. This browser keeps the access key only while this panel stays open.',
    panelExtensionData:'This browser keeps temporary data in extension memory: the latest selection, service session and provider key can be lost when the panel or background process closes. Language, enabled sites, model preferences and the installation’s trial identity persist. The provider key is not saved between browser sessions.'
  });
  Object.assign(COPY.ru,{
    entryGuide:'Выделите текст на странице и нажмите значок beforeword. Или вставьте фрагмент ниже.',
    serviceActionNotice:'«Разобрать текст» отправит эту запись beforeword и OpenAI.',
    connectionCaption:'Разбор через',connectionRequired:'Нужно подключить',customSendNotice:'По нажатию «Разобрать текст» фрагмент отправится напрямую в {provider}. Модель: {model}.',
    connectionTitle:'Подключение модели',serviceOption:'beforeword · 8 разборов',providerLabel:'Поставщик модели',
    directRoute:'Запросы идут напрямую выбранному поставщику. Использование API оплачивается через ваш аккаунт у него.',
    openRouterConnect:'Подключить аккаунт OpenRouter',openRouterNote:'Подтвердите доступ на OpenRouter. Ключ доступа останется в текущем сеансе браузера.',orApiKey:'или укажите ключ API',getKey:'Получить ключ ↗',
    loadModels:'Загрузить список моделей',loadingModels:'Загрузка моделей…',modelPlaceholder:'Выберите из списка или введите ID модели',
    modelListNote:'Выберите модель из списка или укажите её ID в API. Загрузка списка не отправляет текст на разбор.',
    modelsLoaded:'Поставщик вернул модели: {count}. Выберите из списка или укажите ID.',modelsEmpty:'Поставщик вернул пустой список. Можно указать ID модели, доступной вашему аккаунту.',
    modelsFailed:'Не удалось получить список. Проверьте ключ и соединение или укажите ID модели вручную.',modelKeyRequired:'Сначала укажите ключ API или подключите аккаунт.',
    advancedSettings:'Дополнительно',workspaceLabel:'ID рабочего пространства Anthropic · необязательно',
    subscriptionNote:'Подписка на чат ChatGPT, Claude или Gemini не подключает здесь доступ к API.',
    accountConnecting:'Открывается OpenRouter. Завершите подключение в его окне.',accountConnected:'OpenRouter подключён на этот сеанс. Выберите модель и сохраните настройки.',
    accountCancelled:'Подключение отменено. Аккаунт не подключён.',accountFailed:'Не удалось подключить аккаунт. Повторите попытку или укажите ключ API.',
    connectionAction:'Изменить подключение модели',compatibleProvider:'Другой / совместимый API',returnSource:'← Вернуться к исходной странице',sourceUnavailable:'Исходная страница больше недоступна.',
    panelKeyNote:'В этом браузере ключ хранится только пока открыта эта панель. После её закрытия потребуется новое подключение.',
    settingsInvalid:'Выберите модель. Для своего API также проверьте формат и полный адрес запроса.',
    keyNote:'Ключ остаётся в текущем сеансе браузера. В копии разбора его нет.',
    extensionHelp:'Один раз включите beforeword на текущем сайте. Выделите текст и нажмите значок рядом — откроется разбор. Можно также вставить текст сюда и нажать «Разобрать текст».',
    panelAccountNote:'Подтвердите доступ на OpenRouter. В этом браузере ключ доступа хранится только пока открыта эта панель.',
    panelExtensionData:'В этом браузере временные данные остаются в памяти расширения: последнее выделение, сеанс сервиса и ключ могут исчезнуть при закрытии панели или фонового процесса. Язык, разрешённые сайты, настройки модели и идентификатор ознакомительного набора сохраняются. Ключ между сеансами браузера не сохраняется.'
  });
  Object.assign(COPY.en,{
    readingStep:'Reading',recordGrounds:'Support within the writing',limitLabel:'Limit',detailTitle:'Why this reading',
    methodTitle:'How this analysis is made',methodModel:'The model generates this report from the supplied writing and beforeword instructions. Describing its output in terms of training is a general account, not a record of the particular training examples or internal steps behind this reply.',methodExample:'This example was written in advance. It was not generated by a model in this panel.',methodScope:'The reading, its grounds and this explanation are further writing. They do not provide a record of the model’s internal computations. Terms such as “training”, “rules” and “grounds” do not establish what they name.',
    reuseWriting:'Use selected writing',reuseHint:'Replaces the source text. No analysis request is sent.',reuseReady:'The selected writing is now the source. Choose “Examine text” to send it for analysis.',reuseTooLong:'The selection exceeds 12,000 characters. Select a shorter passage; nothing was truncated.'
  });
  Object.assign(COPY.ru,{
    readingStep:'Прочтение',recordGrounds:'Опора в записи',limitLabel:'Предел вывода',detailTitle:'Почему так прочитано',
    methodTitle:'Как устроен этот разбор',methodModel:'Модель получает исходную запись и инструкцию beforeword. Формирование ответа описывается через обучение модели и текущий запрос; конкретные обучающие примеры и внутренний ход получения этого ответа здесь не предъявлены.',methodExample:'Этот пример составлен заранее. Модель в этой панели его не генерировала.',methodScope:'Прочтение, его основания и это пояснение — дополнительные записи. Они не предъявляют ход внутренних вычислений модели. Слова «обучение», «правила» и «основания» сами не устанавливают того, что ими называют.',
    reuseWriting:'Взять выделенное для разбора',reuseHint:'Заменит исходную запись. Запрос не отправится.',reuseReady:'Выделенное стало исходной записью. Для отправки нажмите «Разобрать текст».',reuseTooLong:'Выделение превышает 12 000 знаков. Выделите меньший фрагмент; текст не был обрезан.'
  });
  Object.assign(COPY.en,{
    sourceOnPage:'Selected on the page',showSource:'Show on page',sourceExpand:'Source writing · show in full',sourceCollapse:'Source writing · collapse',
    sourceAnchored:'The selected writing stays highlighted on the page.',sourceStale:'The source text changed. This reading still refers to the saved writing below.',sourceDetached:'The page link is unavailable. The complete saved writing is shown below.',closeReading:'Close reading',readingClosed:'Reading closed. The page highlight was removed.',
    modelIdNote:'An exact API model ID can also be entered manually. A returned ID does not guarantee that it supports this request.',
    reportCitation:'An excerpt did not match the supplied writing exactly. The response was not displayed. Your original text is unchanged.',
    reportFormat:'The response did not have the required analysis format. Your original text is unchanged.',
    reportIncomplete:'The provider marked its response as incomplete. No partial analysis was displayed.',
    reportSize:'The response exceeded the supported size. It was not truncated into an analysis.',
    directInvalid:'The provider did not return a usable analysis. The available response does not identify a more specific cause. Your original text is unchanged.',directFailure:'Direct provider response: ',serviceFailure:'beforeword service response: ',directNetwork:'The provider could not be reached. Check your connection and try again.',directRate:'The provider’s rate or account quota limit was reached.',directError:'The provider could not complete this request. Check its API settings and account.',
    locateQuote:'Show the exact excerpt',quoteLabel:'Exact excerpt'
  });
  Object.assign(COPY.ru,{
    sourceOnPage:'Выделено на странице',showSource:'Показать на странице',sourceExpand:'Исходная запись · показать полностью',sourceCollapse:'Исходная запись · свернуть',
    sourceAnchored:'Выбранная запись остаётся подсвеченной на странице.',sourceStale:'Исходный текст изменился. Разбор по-прежнему относится к сохранённой записи ниже.',sourceDetached:'Связь со страницей недоступна. Ниже показана полная сохранённая запись.',closeReading:'Закрыть разбор',readingClosed:'Разбор закрыт. Подсветка на странице убрана.',
    modelIdNote:'Точный ID модели в API можно ввести вручную. Наличие ID в списке не гарантирует поддержку этого запроса.',
    reportCitation:'Цитата не совпала с исходной записью в точности. Ответ не показан. Исходный текст сохранён.',
    reportFormat:'Ответ не соответствует требуемому формату разбора. Исходный текст сохранён.',
    reportIncomplete:'Поставщик отметил ответ как незавершённый. Частичный разбор не показан.',
    reportSize:'Ответ превысил допустимый размер. Обрезанный ответ не выдан за разбор.',
    directInvalid:'Поставщик не вернул пригодный разбор. По доступному ответу нельзя указать более точную причину. Исходный текст сохранён.',directFailure:'Прямой ответ поставщика: ',serviceFailure:'Ответ сервиса beforeword: ',directNetwork:'Не удалось связаться с поставщиком модели. Проверьте соединение и повторите действие.',directRate:'Достигнут лимит частоты или квоты аккаунта у поставщика модели.',directError:'Поставщик модели не выполнил запрос. Проверьте настройки API и аккаунт.',
    locateQuote:'Показать точную цитату',quoteLabel:'Точная цитата'
  });
  Object.assign(COPY.en,{workingLabel:'Analysing…',sourceLocal:'Text to examine',showSource:'Show text',sourceExpand:'Full source text',sourceCollapse:'Full source text',trialUnknown:'Limit: 8 analyses',trialRemaining:'{remaining} of {limit} analyses left',allowanceNote:'API requests use tokens from beforeword’s budget. Each installation gets {limit} analyses.',connectionCaption:'Via',customSendNotice:'This text will be sent directly to {provider}.',serviceActionNotice:'This text will be sent to beforeword and OpenAI.'});
  Object.assign(COPY.ru,{workingLabel:'Идёт разбор…',sourceLocal:'Текст для разбора',showSource:'К тексту',sourceExpand:'Исходный текст полностью',sourceCollapse:'Исходный текст полностью',trialUnknown:'Лимит — 8 разборов',trialRemaining:'Осталось {remaining} из {limit} разборов',allowanceNote:'Каждый разбор расходует токены API и бюджет beforeword, поэтому на установку доступно {limit} разборов.',connectionCaption:'Через',customSendNotice:'Запись отправится напрямую в {provider}.',serviceActionNotice:'Запись отправится beforeword и OpenAI.'});
  Object.assign(COPY.en,{
    title:'What is written. How it is read.',purpose:'See what a reading adds through learned language conventions.',
    analysisTitle:'A reading',modelOrigin:'Model analysis · may contain errors',exampleOrigin:'Prepared example · no model request',reportBoundary:'This analysis is writing too.',newText:'New text',
    modelExportOrigin:'Model-generated analysis',exampleExportOrigin:'Authored example, not a model response',
    methodBoundary:'An exact excerpt lets you check the wording; it does not confirm the reading.',methodExampleScope:'The reading, its grounds and this explanation are writing too.'
  });
  Object.assign(COPY.ru,{
    title:'Что написано. Как это читают.',purpose:'Увидьте, что добавляет прочтение по выученным правилам языка.',
    analysisTitle:'Прочтение',modelOrigin:'Разбор модели · может содержать ошибки',exampleOrigin:'Готовый пример · без запроса к модели',reportBoundary:'Разбор — тоже написанный текст.',newText:'Новый текст',
    modelExportOrigin:'Разбор, предложенный моделью',exampleExportOrigin:'Составленный пример, не ответ модели',
    methodBoundary:'Точная цитата позволяет сверить запись, но не подтверждает прочтение.',methodExampleScope:'Прочтение, его основания и это пояснение — тоже написанный текст.'
  });
  Object.assign(COPY.en,{
    title:'See the writing. See the addition.',purpose:'Open a short note beside the passage. The note’s added words stay visible as an addition.',
    analyze:'Analyze text',retry:'Try again',analyzeAgain:'Analyze again',analyzeExample:'Analyze with AI',analysisTitle:'Notes on the writing',modelOrigin:'Added by a model',reportBoundary:'Each note is more writing. It does not record your reading.',
    readingStep:'Added by this note',attributionLabel:'Further wording added',groundsLabel:'Grounds proposed in the note',limitLabel:'Further qualification',detailTitle:'More of the note',item:'Note',quoteLabel:'Source writing',
    captureTooLong:'Page selections support up to 12,000 characters. Paste a longer text into the panel and choose a passage.',sourcePartitionUnavailable:'This browser cannot split this text into supported character groups. Choose a passage of up to 12,000 characters; the text has not been shortened.',sourceClusterLong:'A character sequence cannot be split within the passage limit. Choose a smaller passage; the text has not been shortened.',inputLabel:'A passage or article',entryGuide:'Select writing on a page, or paste it below.',placeholder:'Paste a passage or article.',tooLong:'The input exceeds 240,000 characters. Nothing was shortened. Choose a smaller passage explicitly.',
    sectionLabel:'Passage {index} of {total}',sectionScope:'Only this passage is sent · positions {start}–{end} of {total}',sectionNotice:'The remaining passages are not sent. Connections outside this passage are not examined.',sectionPreview:'Show the passage to be sent',sectionChange:'Another passage is selected. Choose “Analyze text” to send it.',sectionPrev:'Previous passage',sectionNext:'Next passage',sectionCurrent:'This response covers passage {index} of {total} only.',sectionUnit:'Positions count UTF-16 units; one visible character can occupy more than one unit.',sectionProgress:'Notes open for {count} of {total} passages',sectionSaved:'Passage {index} · Notes ({language})',sectionRestored:'Earlier notes are open. No request was sent.',
    customSendNotice:'This passage will be sent directly to {provider}.',serviceActionNotice:'This passage will be sent to beforeword and OpenAI.',
    analysisHelp:'Choose a note to see its added writing beside an exact excerpt. Its further wording and proposed grounds open separately.',
    extensionHelp:'Select page writing or paste it here. Choose “Analyze text”. Longer texts are split locally; only the selected passage is sent.',shortcutHelp:'Ctrl + Enter or ⌘ + Enter sends the selected passage. Notes stay available when you move between passages. Editing the text clears them.',
    methodBoundary:'An excerpt comes from the supplied writing. The note’s wording is added beside it.',methodScope:'The note, its proposed grounds and this explanation are further writing. They do not show the reader’s thoughts or the model’s internal computations.',reuseReady:'The selection is now the source writing. Choose “Analyze text” to send it.',reuseTooLong:'The selection exceeds 240,000 characters. Choose a smaller passage explicitly.',
    inspectSection:'Characters in the selected passage only.',reportNavigation:'Choose a note',fullRecord:'Full source writing',
  });
  Object.assign(COPY.ru,{
    title:'Написанное. Добавленное к нему.',purpose:'Откройте короткую пометку рядом с записью. Добавленные в ней слова остаются видны как добавление.',
    analyze:'Разобрать текст',retry:'Повторить запрос',analyzeAgain:'Разобрать ещё раз',analyzeExample:'Разобрать с ИИ',analysisTitle:'Пометки к записи',modelOrigin:'Добавлено моделью',reportBoundary:'Каждая пометка — дополнительная запись. Она не показывает ваше прочтение.',
    readingStep:'Добавлено в пометке',attributionLabel:'Дальнейшее добавление',groundsLabel:'Основания, предложенные в пометке',limitLabel:'Дальнейшее уточнение',detailTitle:'Пометка подробнее',item:'Пометка',quoteLabel:'Исходная запись',
    captureTooLong:'Выделение страницы — до 12 000 знаков. Большую запись можно вставить в панель и выбрать часть.',sourcePartitionUnavailable:'Браузер не поддерживает используемое разбиение этого текста на знаки. Выберите фрагмент до 12 000 знаков; запись не сокращена.',sourceClusterLong:'В записи есть последовательность знаков, которую нельзя разделить в пределах лимита. Выберите меньший фрагмент; запись не сокращена.',inputLabel:'Фрагмент или статья',entryGuide:'Выделите запись на странице или вставьте её ниже.',placeholder:'Вставьте фрагмент или статью.',tooLong:'Запись превышает 240 000 знаков. Ничего не сокращено. Выберите меньший фрагмент явно.',
    sectionLabel:'Часть {index} из {total}',sectionScope:'Отправится только эта часть · позиции {start}–{end} из {total}',sectionNotice:'Остальные части не отправляются. Связи за пределами этой части не рассматриваются.',sectionPreview:'Показать отправляемую часть',sectionChange:'Выбрана другая часть. Для отправки нажмите «Разобрать текст».',sectionPrev:'Предыдущая часть',sectionNext:'Следующая часть',sectionCurrent:'Этот ответ относится только к части {index} из {total}.',sectionUnit:'Позиции считаются в единицах UTF-16; один видимый знак может занимать несколько позиций.',sectionProgress:'Пометки открыты для {count} из {total} частей',sectionSaved:'Часть {index} · Пометки ({language})',sectionRestored:'Открыты прежние пометки. Запрос не отправлялся.',
    customSendNotice:'Эта часть отправится напрямую в {provider}.',serviceActionNotice:'Эта часть отправится beforeword и OpenAI.',
    analysisHelp:'Откройте пометку: добавленная запись показана рядом с точной цитатой. Дальнейшие формулировки и предложенные основания раскрываются отдельно.',
    extensionHelp:'Выделите запись на странице или вставьте её сюда. Нажмите «Разобрать текст». Большой текст делится здесь на части; отправляется только выбранная.',shortcutHelp:'Ctrl + Enter или ⌘ + Enter отправляет выбранную часть. При переходе между частями пометки сохраняются. Изменение текста очищает их.',
    methodBoundary:'Цитата взята из исходной записи. Формулировки пометки добавлены рядом с ней.',methodScope:'Пометка, предложенные основания и это пояснение — дополнительные записи. Они не показывают мысли читателя или внутренние вычисления модели.',reuseReady:'Выделенное стало исходной записью. Для отправки нажмите «Разобрать текст».',reuseTooLong:'Выделение превышает 240 000 знаков. Выберите меньший фрагмент явно.',
    inspectSection:'Знаки только выбранной части.',reportNavigation:'Выбрать пометку',fullRecord:'Исходная запись полностью',
  });
  Object.assign(COPY.ru,{
    title:'Что добавляется при чтении?',purpose:'Выделите фразу или вставьте текст. Рядом с точной цитатой появится короткое прочтение. Написанное останется написанным.',
    guideTitle:'Как пользоваться · пример',pasteText:'Вставить свой текст',inputLabel:'Ваш текст',entryGuide:'',quickExample:'Открыть готовый пример',
    analysisTitle:'Предложенное прочтение',reportBoundary:'Прочтение и его объяснение добавлены здесь. Исходная запись показана отдельно.',
    quoteLabel:'Точная цитата',readingStep:'Добавленное прочтение',attributionLabel:'С чем связывают запись',groundsLabel:'Пояснение из прежнего отчёта',limitLabel:'Граница прочтения',detailTitle:'Другие поля прежнего отчёта',item:'Прочтение',learnedGrounds:'Употребление и правила чтения',
    sectionProgress:'Прочтения открыты для {count} из {total} частей',sectionSaved:'Часть {index} · Прочтение ({language})',sectionRestored:'Открыто прежнее прочтение. Запрос не отправлялся.',reportNavigation:'Выбрать прочтение',
    analysisHelp:'Цитата сохраняет исходные знаки. В добавленном прочтении выделен конкретный переход или место остановки. Пояснение тоже остаётся написанным.',
    shortcutHelp:'Ctrl + Enter или ⌘ + Enter отправляет выбранную часть. При переходе между частями разборы сохраняются. Изменение текста очищает их.',
    methodBoundary:'Цитата сохраняет исходные знаки. Прочтение добавлено рядом с ней.',methodModel:'Модель получила выбранную запись и инструкцию beforeword. Проверка цитаты сверяет знаки, а не подтверждает прочтение.',methodScope:'Прочтение и это пояснение остаются написанным.',methodExampleScope:'Прочтение и это пояснение остаются написанным.',
    noteLabel:'Предложенное объяснение',frame:'Здесь начертания предложено читать по освоенным правилам письма.',ownScope:'Эти пояснения — тоже написанное.'
  });
  Object.assign(COPY.en,{
    title:'What does a reading add?',purpose:'Select a phrase or paste text. A short proposed reading appears beside an exact excerpt. The writing remains writing.',
    guideTitle:'How to use beforeword',pasteText:'Paste your own text',inputLabel:'Your text',entryGuide:'',quickExample:'Open a prepared example',
    analysisTitle:'A proposed reading',reportBoundary:'The reading and its explanation are added here. The source writing is shown separately.',
    quoteLabel:'Exact excerpt',readingStep:'Added reading',attributionLabel:'What the writing is linked to',groundsLabel:'Explanation from the earlier report',limitLabel:'Scope of this reading',detailTitle:'Other fields from the earlier report',item:'Reading',learnedGrounds:'Usage and reading conventions',
    sectionProgress:'Readings open for {count} of {total} passages',sectionSaved:'Passage {index} · Reading ({language})',sectionRestored:'An earlier reading is open. No request was sent.',reportNavigation:'Choose a reading',
    analysisHelp:'The excerpt keeps the source characters. The added reading highlights the concrete move or stopping point. The explanation remains writing too.',
    shortcutHelp:'Ctrl + Enter or ⌘ + Enter sends the selected passage. Analyses stay available when you move between passages. Editing the text clears them.',
    methodBoundary:'The excerpt retains the source characters. The reading is added beside it.',methodModel:'The model received the selected writing and beforeword instructions. The citation check compares characters; it does not confirm the reading.',methodScope:'The reading and this explanation remain writing.',methodExampleScope:'The reading and this explanation remain writing.',
    noteLabel:'A proposed explanation',frame:'The marks are proposed to be read here through learned writing conventions.',ownScope:'These explanations are writing too.'
  });
  Object.assign(COPY.en,{
    privacyReviewTitle:'Before sending text',privacyChecksTitle:'Account settings to check',
    privacyReviewNote:'The extension cannot inspect these account controls. Confirm them after checking the provider’s settings and terms.',
    privacyReviewRequired:'Review this provider’s processing settings before sending text.',privacyReviewSaved:'Your checks are saved for this key, provider, address and model. Account settings are not independently verified.',
    privacyReviewPending:'Save after checking every applicable setting. Loading model names sends no selected text.',
    privacyReviewIncomplete:'The connection can be saved, but text analysis stays off until every applicable setting is confirmed.',
    providerModeUnavailable:'This provider or model does not currently offer an enabled processing mode here. Its model list is still available.',
    privacyReviewConnection:'Review required',settingsSavedReview:'Connection saved. Review the processing settings before sending text.'
  });
  Object.assign(COPY.ru,{
    privacyReviewTitle:'Перед отправкой текста',privacyChecksTitle:'Что проверить в аккаунте',
    privacyReviewNote:'Расширение не видит эти настройки аккаунта. Подтвердите их после проверки настроек и условий поставщика.',
    privacyReviewRequired:'Перед отправкой текста проверьте условия обработки у этого поставщика.',privacyReviewSaved:'Проверки сохранены для этого ключа, поставщика, адреса и модели. Независимая проверка настроек аккаунта не выполнялась.',
    privacyReviewPending:'После проверки всех применимых настроек нажмите «Сохранить». Загрузка названий моделей не отправляет выделенный текст.',
    privacyReviewIncomplete:'Подключение можно сохранить, но разбор текста останется выключен до подтверждения всех применимых настроек.',
    providerModeUnavailable:'Для этого поставщика или модели сейчас нет включённого режима обработки. Список моделей остаётся доступен.',
    privacyReviewConnection:'Нужна проверка',settingsSavedReview:'Подключение сохранено. Перед отправкой текста проверьте условия обработки.'
  });
  Object.assign(COPY.ru,{
    title:'Написанное слово не становится тем, что им называют.',purpose:'Даже когда мы умеем его читать.',inputLabel:'Запись для прочтения',placeholder:'Выделите фразу на странице или вставьте её сюда.',inputNote:'Отправится только эта запись.',analyze:'Рассмотреть запись',analyzeAgain:'Рассмотреть ещё раз',analyzeExample:'Рассмотреть моделью',workingLabel:'Идёт прочтение',cancelAnalysis:'Остановить',
    examplesTitle:'Готовые примеры',exampleNote:'Открываются сразу. Запрос к модели не отправляется.',editText:'Изменить',recordTitle:'Исходная запись',copy:'Копировать',copyAnalysis:'Копировать прочтение',analysisTitle:'Прочтение beforeword',reportBoundary:'',
    readingStep:'Добавленное прочтение',quoteLabel:'В записи',modelOrigin:'Ответ модели',exampleOrigin:'Готовый пример · без запроса к модели',menuTitle:'Меню',menuStart:'Начать',menuTools:'Инструменты',menuAbout:'О проекте',menuDictionary:'Словарь',closeMenu:'Закрыть меню',
    sendNotice:'Кнопка «Рассмотреть запись» или Ctrl/⌘ + Enter отправляет выбранную запись beforeword и OpenAI.',selectionReady:'Запись перенесена. Прочтите её и нажмите «Рассмотреть запись», чтобы отправить.',capture:'Взять выделение страницы',methodTitle:'О прочтении',guideTitle:'Как перенести выделенный текст',
    extensionHelp:'Выделите запись и нажмите значок beforeword. В панели появится точный текст. Отправка модели — по кнопке «Рассмотреть запись» или Ctrl/⌘ + Enter.',shortcutHelp:'Ctrl + Enter или ⌘ + Enter в поле текста также запускает прочтение выбранной части.',entryGuide:''
  });
  Object.assign(COPY.en,{
    title:'A written word does not become what it names.',purpose:'Even when we have learned to read it.',inputLabel:'Writing to examine',placeholder:'Select a phrase on a page or paste it here.',inputNote:'Only this writing will be sent.',analyze:'Examine writing',analyzeAgain:'Examine again',analyzeExample:'Examine with a model',workingLabel:'Reading the writing',cancelAnalysis:'Stop',
    examplesTitle:'Prepared examples',exampleNote:'Open immediately. No model request is sent.',editText:'Edit',recordTitle:'Source writing',copy:'Copy',copyAnalysis:'Copy reading',analysisTitle:'beforeword reading',reportBoundary:'',
    readingStep:'Added reading',quoteLabel:'In the writing',modelOrigin:'Model response',exampleOrigin:'Prepared example · no model request',menuTitle:'Menu',menuStart:'Start',menuTools:'Tools',menuAbout:'About',menuDictionary:'Dictionary',closeMenu:'Close menu',
    sendNotice:'“Examine writing” or Ctrl/⌘ + Enter sends the selected writing to beforeword and OpenAI.',selectionReady:'The writing is here. Read it, then choose “Examine writing” to send it.',capture:'Use page selection',methodTitle:'About this reading',guideTitle:'How to bring in selected text',
    extensionHelp:'Select writing and tap beforeword. The panel displays the exact text. Send it to the model with “Examine writing” or Ctrl/⌘ + Enter.',shortcutHelp:'Ctrl + Enter or ⌘ + Enter in the text field also starts a reading of the selected passage.',entryGuide:''
  });
  if(webHost?.copy)for(const lang of ['ru','en'])Object.assign(COPY[lang],webHost.copy[lang]||{});
  let language = ['ru','en'].includes(webHost?.initialLanguage)?webHost.initialLanguage:(navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  let partitionSource=null, partitionState=null, partitionError=null, sectionIndex=0, reportSource=null, reportPart=null, activeNote=0;
  let raw = '', viewMode = false, incoming = null, lastSeenSelection = null;
  let dictionaryUI = null;
  let readingGuide=null, guideEmpty=null, panelVisible=webHost?webHost.initialVisible!==false:true;
  const inlineGuide=Boolean(webHost?.inline);
  function renderGuide(){
    const details=$('panel-guide');if(!details)return;
    details.hidden=inlineGuide||!globalThis.BeforewordGuide;
    document.body.classList.remove('has-guide');$('analysis-actions').hidden=false;guideEmpty=false;
    if(details.parentElement!==$('help'))$('help').append(details);
    if(details.hidden)return;
    if(details.open&&!readingGuide)readingGuide=globalThis.BeforewordGuide.mount($('panel-guide-content'),{language,compact:true,autoPlay:false,visible:panelVisible,requireAnalyze:true,brandSrc:'assets/brand.svg'});
    readingGuide?.setLanguage(language);readingGuide?.setVisible(panelVisible&&details.open&&!$('help').hidden);
  }
  function setPanelVisible(visible){panelVisible=Boolean(visible);readingGuide?.setVisible(panelVisible&&Boolean($('panel-guide')?.open));}

  let inspection = null, page = 0, selectedIndex = null;
  let report = null, reportInput = null, reportModel = '', reportOrigin = null;
  let reportSelection = null, reportDestination = null;
  // One exact source and configuration in this panel's memory only. No writing
  // or report is added to browser storage. Each validated report is <=48k.
  const sectionReports = new Map(), MAX_CACHED_REPORTS = 64;
  let notesSource = null, notesDestination = null;
  let sourceDisclosurePreference = null;
  let reportRevision=Date.now()*1000;
  let sourceAnchor=null, sourceAnchorText='', sourceOrigin='', anchorState='none', anchorEpoch=0, anchorPort=null, anchorRevision=0;
  let activeController = null, retryAvailable = false, serviceMode = 'preview', modeEpoch = 0;
  let captureEpoch = 0, localeEpoch = 0, mutationEpoch = 0, analysisEpoch = 0, copyEpoch = 0;
  let pendingCapture = null, statusOwner = '';
  let disclosureReady = false;
  COPY.en.settingsChanging='Model settings are changing. Please try the analysis again when they are saved.';COPY.ru.settingsChanging='Настройки модели изменяются. Повторите разбор после сохранения.';
  COPY.en.preferencesChanged='The model destination changed. Check the destination below and start the analysis again.';COPY.ru.preferencesChanged='Адрес модели изменился. Проверьте назначение запроса и запустите разбор снова.';
  let trial = null, modelConfigured = false, preferences = {mode:'service',protocol:'openai',endpoint:'',model:'',hasKey:false};
  let siteState = {origin:'',enabled:false,available:false}, siteBusy = false, siteEpoch = 0;
  let settingsEpoch = 0, settingsDirty = false, settingsBusy = false, settingsTrigger = null;
  let providerController = null, modelsState = 'idle', modelCount = 0;
  let intentEpoch = 0, modeReady = Promise.resolve(), settingsNeeded = false;
  const seenIntents = new Set();
  let currentWindowId = null;
  const windowReady = extension ? Promise.resolve().then(()=>chrome.windows?.getCurrent?.()).then(value=>{if(Number.isInteger(value?.id))currentWindowId=value.id;}).catch(()=>{}) : Promise.resolve();
  const editHistory = {source:{entries:[],index:-1,cost:0,pending:null}};
  const t = key => COPY[language][key] ?? key;
  const sameSelection = (a,b) => Boolean(a && b && a.text === b.text && a.origin === b.origin && (a.sourceAnchor?.id||'') === (b.sourceAnchor?.id||''));
  function status(text='',tone='',owner=''){$('status').textContent=text;$('status').dataset.tone=tone;statusOwner=owner;}
  function clearCaptureStatus(){if(statusOwner==='capture')status();}
  function analysisStatus(text='',tone=''){$('analysis-status').textContent=text;$('analysis-status').dataset.tone=tone;}
  function node(tag,className,text){const result=document.createElement(tag);if(className)result.className=className;if(text!==undefined)result.textContent=text;return result;}
  function readingText(text){
    const paragraph=node('p','report-text');
    for(const part of text.split(/(\*\*[^\n*]+\*\*)/u)){
      if(part.startsWith('**')&&part.endsWith('**')&&part.length>4)paragraph.append(node('strong','',part.slice(2,-2)));
      else paragraph.append(document.createTextNode(part));
    }
    return paragraph;
  }
  function renderLanguage(){
    document.documentElement.lang=language;document.title=`beforeword — ${t('title')}`;
    document.querySelectorAll('[data-copy]').forEach(item=>{item.textContent=t(item.dataset.copy);});
    document.querySelectorAll('[data-placeholder]').forEach(item=>{item.placeholder=t(item.dataset.placeholder);});
    document.querySelectorAll('[data-language]').forEach(item=>{
      item.setAttribute('aria-pressed',String(item.dataset.language===language));
      const label=language==='ru'?`Язык интерфейса и следующего разбора: ${item.dataset.language==='ru'?'русский':'английский'}`:`Interface and next analysis language: ${item.dataset.language==='ru'?'Russian':'English'}`;
      item.setAttribute('aria-label',label);item.title=label;
    });
    const languageLabel=language==='ru'?'Язык интерфейса и следующего разбора':'Interface and next analysis language';
    document.querySelector('.languages').setAttribute('aria-label',languageLabel);
    document.querySelector('.languages').title=languageLabel;
    $('record-column').setAttribute('aria-label',t('recordTitle'));
    $('settings').setAttribute('aria-label',t('settingsTitle'));$('settings').title=t('settingsTitle');$('close-settings').setAttribute('aria-label',t('closeSettings'));
    for(const id of ['demo-help','demo-data'])$(id).hidden=extension;
    for(const id of ['extension-help','extension-data','privacy-link','capture'])$(id).hidden=!extension;
    $('reader-menu-trigger')?.setAttribute('aria-label',t('menuTitle'));$('reader-menu')?.querySelector('nav')?.setAttribute('aria-label',t('menuTitle'));$('close-menu')?.setAttribute('aria-label',t('closeMenu'));
    $('example-buttons')?.replaceChildren();
    for(const example of examples){const button=node('button','example-choice',example.label?.[language]||example.id);button.type='button';button.dataset.example=example.id;button.addEventListener('click',()=>loadExample(example.id));$('example-buttons')?.append(button);}
    const prior=$('example-choice').value;$('example-choice').replaceChildren();
    for(const example of examples){const option=node('option','',example.label?.[language]||example.id);option.value=example.id;$('example-choice').append(option);}
    if(examples.some(example=>example.id===prior))$('example-choice').value=prior;
    $('quick-example').hidden=examples.length===0;$('examples-section').hidden=examples.length===0;
    renderProviderOptions();renderState();renderIncoming();renderSite();renderSettingsState();if(inspection)renderInspection();
  }
  function partitionLocal(text){
    const result=readingSurface.partition(text,{maxChars:REQUEST_MAX,maxTotalChars:MAX});
    // Long text is never split through visible character groups as a silent fallback.
    if(result.warning==='GRAPHEME_SEGMENTATION_UNAVAILABLE')throw {code:result.warning};
    return result;
  }
  function sourceParts(){
    if(partitionSource!==raw){partitionSource=raw;sectionIndex=0;partitionError=null;try{partitionState=partitionLocal(raw);}catch(error){partitionState=null;partitionError=error;}}
    return partitionState?.parts||[];
  }
  function currentPart(){return sourceParts()[sectionIndex]||null;}
  function destinationScope(){return JSON.stringify([serviceMode,...['mode','provider','protocol','endpoint','model','workspace','hasKey','privacyEligible'].map(key=>preferences[key]??null)]);}
  function clearSectionReports(){sectionReports.clear();notesSource=null;notesDestination=null;}
  function ensureNotesScope(){
    const destination=destinationScope();
    if(notesSource!==raw||notesDestination!==destination){clearSectionReports();notesSource=raw;notesDestination=destination;}
  }
  function validReport(){return Boolean(report&&reportInput&&reportDestination===destinationScope()&&reportSource===raw&&reportPart&&reportPart.index===sectionIndex&&currentPart()?.text===reportInput.text);}
  function rememberReport(){
    if(!validReport())return;
    ensureNotesScope();sectionReports.delete(sectionIndex);
    sectionReports.set(sectionIndex,{report,input:reportInput,part:{...reportPart},model:reportModel,origin:reportOrigin,activeNote});
    while(sectionReports.size>MAX_CACHED_REPORTS)sectionReports.delete(sectionReports.keys().next().value);
  }
  function restoreSectionReport(){
    ensureNotesScope();const saved=sectionReports.get(sectionIndex),part=currentPart();
    if(!saved||!part||saved.input.text!==part.text||saved.part.start!==part.start||saved.part.end!==part.end)return false;
    report=saved.report;reportInput=saved.input;reportSource=raw;reportPart={...saved.part};reportDestination=destinationScope();reportModel=saved.model;reportOrigin=saved.origin;activeNote=saved.activeNote;
    renderReport();collapseCompletedSource();sendReportAnchor();return true;
  }
  function replaceTemplate(key,values,locale=language){let text=COPY[locale]?.[key]||key;for(const [name,value] of Object.entries(values))text=text.replaceAll('{'+name+'}',String(value));return text;}
  function renderSections(){
    const parts=sourceParts(),part=parts[sectionIndex],multiple=parts.length>1;ensureNotesScope();$('reading-sections').hidden=!multiple;
    $('partition-status').hidden=!partitionError;$('partition-status').textContent=partitionError?t(errorKey(partitionError)):'';
    $('section-label').textContent=replaceTemplate('sectionLabel',{index:sectionIndex+1,total:parts.length});
    $('section-scope').textContent=part?replaceTemplate('sectionScope',{start:part.start+1,end:part.end,total:raw.length}):'';
    $('section-preview').textContent=part?.text||'';
    $('section-prev').setAttribute('aria-label',t('sectionPrev'));$('section-next').setAttribute('aria-label',t('sectionNext'));$('reading-sections').setAttribute('aria-label',t('sectionLabel').replace('{index}',String(sectionIndex+1)).replace('{total}',String(parts.length)));
    $('section-prev').disabled=sectionIndex===0;$('section-next').disabled=sectionIndex>=parts.length-1;
    let progress=$('section-progress');
    if(!progress){progress=node('div','section-progress');progress.id='section-progress';$('section-details').before(progress);}
    progress.replaceChildren();progress.hidden=!multiple||!sectionReports.size;
    if(!progress.hidden){
      progress.append(node('p','small-note',replaceTemplate('sectionProgress',{count:sectionReports.size,total:parts.length})));
      const savedList=node('div','section-saved-list');
      for(const index of [...sectionReports.keys()].sort((a,b)=>a-b)){
        const button=node('button','section-saved',replaceTemplate('sectionSaved',{index:index+1,language:sectionReports.get(index).input.language.toUpperCase()}));button.type='button';button.setAttribute('aria-current',String(index===sectionIndex));button.setAttribute('aria-label',replaceTemplate('sectionSaved',{index:index+1,language:sectionReports.get(index).input.language.toUpperCase()}));
        button.addEventListener('click',()=>selectSectionIndex(index));savedList.append(button);
      }
      progress.append(savedList);
    }
    $('inspection-scope').hidden=!multiple;$('inspection-scope').textContent=t('inspectSection');
    $('analysis-scope').hidden=!validReport()||!multiple;
    $('analysis-scope').textContent=replaceTemplate('sectionCurrent',{index:(reportPart?.index||0)+1,total:parts.length});
  }
  function selectSection(direction){sourceParts();selectSectionIndex(sectionIndex+direction);}
  function selectSectionIndex(next){
    const parts=sourceParts();if(!Number.isInteger(next)||next<0||next>=parts.length||(next===sectionIndex&&validReport()))return;
    rememberReport();intentEpoch++;mutationEpoch++;clearAnalysis('','',{preserveNotes:true});sectionIndex=next;resetInspection();$('section-details').open=false;
    const restored=restoreSectionReport();renderState();analysisStatus(t(restored?'sectionRestored':'sectionChange'));
  }
  function absoluteCitation(citation){return {...citation,start:citation.start+(reportPart?.start||0),end:citation.end+(reportPart?.start||0)};}
  function renderState(){
    renderSections();
    const hasReport=validReport(),sections=$('reading-sections');
    document.body.classList.toggle('has-report',hasReport);document.body.classList.toggle('is-working',Boolean(activeController));
    if(sections.nextElementSibling!==$('send-notice'))$('send-notice').before(sections);
    $('source-count').textContent=`${raw.length.toLocaleString(language)} / ${MAX.toLocaleString(language)}`;
    $('source-count').classList.toggle('over',raw.length>MAX);$('source').setAttribute('aria-invalid',String(raw.length>MAX));
    $('source-exact').hidden=raw===$('source').value;
    $('extension-data').textContent=t(globalThis.BeforewordPlatform?.sessionStorageKind==='memory'?'panelExtensionData':'extensionData');
    $('empty-entry').hidden=viewMode;$('record-section').hidden=!viewMode;$('record-details').hidden=!viewMode;$('inspect').hidden=!viewMode||!$('inspect').open;
    $('quick-example').hidden=true;$('editor').hidden=viewMode;if(!viewMode)$('editor').open=true;
    $('menu-characters')?.toggleAttribute('disabled',!raw.length);
    $('examples-section').hidden=false;
    $('record-column').classList.toggle('has-record',viewMode);
    const actionAnchor=$(viewMode?'record-details':'editor'),actions=$('analysis-actions');
    if(actionAnchor.nextElementSibling!==actions)actionAnchor.after(actions);
    const working=Boolean(activeController),unavailable=!disclosureReady||settingsBusy||serviceMode==='preview'||raw.length===0||raw.length>MAX||Boolean(partitionError);
    // Keep the initiating button in the focus order while an explicit cancel action is available.
    $('analyze').disabled=unavailable&&!working;$('analyze').setAttribute('aria-disabled',String(unavailable||working));$('analyze').setAttribute('aria-busy',String(working));
    $('analyze-label').textContent=t(working?'workingLabel':serviceMode==='preview'?'previewAction':retryAvailable?'retry':validReport()?(reportOrigin==='example'?'analyzeExample':'analyzeAgain'):'analyze');
    // SVG has no reflected HTMLElement.hidden property; toggle its CSS-matched attribute.
    $('analysis-spinner').toggleAttribute('hidden',!working);$('analysis-status').classList.toggle('sr-only',working);
    $('demo-note').hidden=serviceMode!=='preview';
    document.querySelector('[data-copy=shortcutHelp]').hidden=serviceMode==='preview';
    const connectedProvider=providers?.get?.(preferences.provider);
    let providerName=connectedProvider?.id!=='compatible'&&connectedProvider?.label?connectedProvider.label:preferences.endpoint;
    try{if(!connectedProvider||connectedProvider.id==='compatible')providerName=new URL(preferences.endpoint).origin;}catch{}
    const privacyNeeded=serviceMode==='custom'&&preferences.hasKey&&!preferences.privacyEligible;
    const destination=serviceMode==='preview'?t('previewNotice'):serviceMode==='custom'?(modelConfigured?t('customSendNotice').replace('{provider}',providerName).replace('{model}',preferences.model):t(privacyNeeded?(preferences.privacyCode==='PROVIDER_MODE_UNAVAILABLE'?'providerModeUnavailable':'privacyReviewRequired'):'customNotReady')):t('sendNotice');
    $('send-notice').textContent=serviceMode==='service'?t('serviceActionNotice'):destination;
    $('data-send-notice').textContent=serviceMode==='custom'&&modelConfigured?t('customDestination').replace('{endpoint}',preferences.endpoint).replace('{model}',preferences.model):destination;
    // A cached legacy allowance is not a current balance for the eight-analysis offer.
    const displayTrial=trial?.limit===8?trial:null;
    $('trial-count').hidden=serviceMode!=='service';$('trial-count').textContent=displayTrial?t('trialRemaining').replace('{remaining}',String(displayTrial.remaining)).replace('{limit}',String(displayTrial.limit)):t('trialUnknown');
    $('allowance-note').hidden=serviceMode!=='service';$('allowance-note').textContent=t('allowanceNote').replace('{limit}','8');
    $('trial-settings').textContent=t(serviceMode==='preview'?'trialPreview':'trialNote').replace('{limit}','8');
    $('connection-label').textContent=serviceMode==='custom'?(connectedProvider?.label||t('ownModel')):'beforeword';
    $('model-connection').setAttribute('aria-label',t('connectionAction'));
    $('connection-state').hidden=serviceMode!=='custom'||modelConfigured;
    $('connection-state').textContent=t(privacyNeeded?'privacyReviewConnection':'connectionRequired');
    $('quota-settings').hidden=!settingsNeeded;$('quota-settings').textContent=t(serviceMode==='custom'?'modelSettings':'useOwnModel');
    $('cancel-analysis').hidden=!activeController;
    $('source').setAttribute('aria-busy',String(Boolean(activeController)));
    $('analysis-section').hidden=!hasReport;$('workspace').classList.toggle('with-report',hasReport);renderSourceState();
    webHost?.render?.(language,{settingsNeeded,working,trial});
    dictionaryUI?.update({raw,language,viewMode,anchored:Boolean(sourceAnchor&&anchorState==='anchored')});
    renderGuide();
  }
  function renderSourceState(){
    const anchored=Boolean(sourceAnchor&&anchorState==='anchored');
    $('source-context').hidden=!viewMode;
    $('source-location-label').textContent=t(sourceAnchor?'sourceOnPage':'sourceLocal');
    $('source-origin').textContent=sourceOrigin||sourceAnchor?.origin||'';$('source-origin').hidden=!sourceAnchor;
    $('close-reading').setAttribute('aria-label',t('closeReading'));$('close-reading').title=t('closeReading');
    $('show-source').hidden=!anchored;$('close-reading').hidden=!viewMode;
    $('source-anchor-status').hidden=!sourceAnchor||anchorState==='pending'||anchored;
    $('source-anchor-status').textContent=sourceAnchor?t(anchorState==='anchored'?'sourceAnchored':anchorState==='stale'?'sourceStale':'sourceDetached'):'';
    $('source-anchor-status').dataset.tone=anchorState==='stale'?'changed':'';
    $('record-summary').textContent=t($('record-details').open?'sourceCollapse':'sourceExpand');
    dictionaryUI?.update({raw,language,viewMode,anchored});
  }
  function sameAnchor(anchor){return Boolean(sourceAnchor&&anchor&&sourceAnchor.id===anchor.id&&sourceAnchor.sourceTabId===anchor.sourceTabId&&sourceAnchor.windowId===anchor.windowId);}
  function clearSourceAnchor(){
    const anchor=sourceAnchor,text=sourceAnchorText;anchorEpoch++;anchorRevision++;sourceAnchor=null;sourceAnchorText='';sourceOrigin='';anchorState='none';
    if(anchor)void message('bw:anchor-clear',{anchor,text,windowId:currentWindowId});
    try{anchorPort?.disconnect();}catch{}anchorPort=null;sourceDisclosurePreference=null;$('record-details').open=true;renderSourceState();
  }
  async function adoptSourceAnchor(selection){
    const anchor=selection?.sourceAnchor;
    if(!anchor||typeof anchor.id!=='string'||!Number.isInteger(anchor.sourceTabId)||!Number.isInteger(anchor.windowId)||selection.text!==raw)return;
    sourceAnchor={...anchor};sourceAnchorText=raw;sourceOrigin=selection.origin||anchor.origin||'';anchorState='pending';const epoch=++anchorEpoch;anchorRevision++;renderSourceState();
    try{anchorPort=extension?chrome.runtime.connect?.({name:'bw:anchor-panel'})||null:null;anchorPort?.postMessage({anchor:sourceAnchor,text:raw,windowId:currentWindowId});}catch{anchorPort=null;}
    const result=await anchorMessage('bw:anchor-status');
    if(epoch!==anchorEpoch||!sameAnchor(anchor)||!result)return;
    // Keep the exact captured snapshot visible; a separate action sends it.
    $('record-details').open=sourceDisclosurePreference!==false;renderSourceState();
  }
  async function anchorMessage(type,extra={}){
    if(!sourceAnchor)return null;
    const anchor={...sourceAnchor},text=raw,epoch=anchorEpoch,revision=anchorRevision;
    const result=await message(type,{anchor,text,windowId:currentWindowId,...extra});
    if(epoch!==anchorEpoch||!sameAnchor(anchor)||text!==raw)return null;
    // A stale notification cannot be undone by an older successful reply.
    if(revision!==anchorRevision)return null;
    const next=result?.ok&&['anchored','stale','unavailable'].includes(result.state)?result.state:'unavailable';
    if(['stale','unavailable'].includes(anchorState)&&next==='anchored')return null;
    anchorState=next;if(next!=='anchored')$('record-details').open=true;renderSourceState();return result;
  }
  function sendReportAnchor(){
    if(!sourceAnchor||!validReport())return;
    void anchorMessage('bw:anchor-report',{reportRevision:++reportRevision,language:reportInput.language,items:report.items.map((item,index)=>({index,start:item.quote.start+reportPart.start,end:item.quote.end+reportPart.start,quote:item.quote.text,note:item.reading}))});
  }
  async function focusSource(citation=null,index){
    const text=raw,epoch=anchorEpoch,currentReport=report;
    if(sourceAnchor&&anchorState==='anchored'){
      const exact=citation?absoluteCitation(citation):null;
      const extra=exact?{start:exact.start,end:exact.end,quote:exact.text,...(Number.isInteger(index)?{index}:{})}:{};
      const result=await anchorMessage('bw:anchor-focus',extra);
      if(epoch!==anchorEpoch||raw!==text||report!==currentReport)return;
      if(result?.ok&&result.state==='anchored')return;
    }
    sourceDisclosurePreference=true;$('record-details').open=true;renderSourceState();
    if(dictionaryUI?.getMode()==='dictionary'){dictionaryUI.openSource();return;}
    if(citation)highlightCitation(citation);else{$('record-output').focus({preventScroll:true});$('record-output').scrollIntoView({behavior:'auto',block:'start'});}
  }
  function receiveAnchorEvent(request){
    if(!sameAnchor(request.anchor)||request.text!==undefined&&request.text!==raw)return;
    if(!['anchored','stale','unavailable'].includes(request.state))return;
    if(['stale','unavailable'].includes(anchorState)&&request.state==='anchored')return;
    anchorRevision++;anchorState=request.state;
    if(anchorState!=='anchored')$('record-details').open=true;renderSourceState();
    if(anchorState==='anchored'&&Number.isInteger(request.index)&&validReport()){
      const card=$('analysis-items').children[request.index];if(!card)return;openNote(request.index);
      card.focus({preventScroll:true});card.scrollIntoView({behavior:'auto',block:'center'});
    }
  }
  function collapseCompletedSource(){
    // A successful local result no longer needs a second full copy above it.
    // An explicit reader choice wins; broken page anchors still show their snapshot.
    if(!sourceAnchor&&sourceDisclosurePreference!==true)$('record-details').open=true;
  }
  function closeReading(){
    dictionaryUI?.reset();
    intentEpoch++;captureEpoch++;mutationEpoch++;clearSourceAnchor();clearAnalysis();raw='';viewMode=false;incoming=null;lastSeenSelection=null;webHost?.readingClosed?.();
    $('source').value='';rememberEdit('source','',true);$('record-output').textContent='';resetInspection();renderState();renderIncoming();$('editor').open=true;$('source').focus();void message('bw:clear');status(t('readingClosed'));
  }
  function refreshMode(){const task=refreshModelState();modeReady=task;return task;}
  async function waitForMode(){let current;do{current=modeReady;await current;}while(current!==modeReady);}
  async function refreshModelState(){
    const epoch=++modeEpoch;disclosureReady=false;renderState();
    const results=await Promise.allSettled([adapter?.getStatus?.(),adapter?.getPreferences?.()]);
    if(epoch!==modeEpoch)return;
    const state=results[0].status==='fulfilled'?results[0].value:null;
    serviceMode=['service','custom'].includes(state?.mode)?state.mode:'preview';modelConfigured=Boolean(state?.configured);
    trial=[6,8].includes(state?.trial?.limit)&&Number.isInteger(state.trial.remaining)&&state.trial.remaining>=0&&state.trial.remaining<=state.trial.limit?{limit:state.trial.limit,remaining:state.trial.remaining}:null;
    if(results[1].status==='fulfilled'&&results[1].value)preferences=results[1].value;
    if(reportDestination&&reportDestination!==destinationScope()){intentEpoch++;mutationEpoch++;clearAnalysis(t('preferencesChanged'));}
    disclosureReady=true;renderState();renderSite();renderSettingsState();
  }
  function settingsStatus(text='',tone=''){$('settings-status').textContent=text;$('settings-status').dataset.tone=tone;}
  function renderSite(){
    const allowed=extension&&serviceMode!=='preview'&&siteState.available;
    $('site-entry').hidden=!allowed||siteState.enabled;
    $('site-enable').disabled=siteBusy;
    $('site-origin').textContent=siteState.origin||'';
    $('site-toggle').checked=Boolean(siteState.enabled);$('site-toggle').disabled=!allowed||siteBusy;
    $('site-settings-note').textContent=t(!extension||serviceMode==='preview'?'sitePreview':!siteState.available?'siteUnavailable':siteState.enabled?'siteEnabled':'siteDisabled');
  }
  async function refreshSite(){
    const epoch=++siteEpoch;
    if(!extension){renderSite();return;}
    await windowReady;const result=await message('bw:get-site',{windowId:currentWindowId});
    if(epoch!==siteEpoch)return;
    siteState=result?.ok?{origin:typeof result.origin==='string'?result.origin:'',enabled:Boolean(result.enabled),available:Boolean(result.available)}:{origin:'',enabled:false,available:false};
    renderSite();
  }
  async function changeSite(enabled){
    if(!extension||serviceMode==='preview'||!siteState.available||siteBusy)return;
    const origin=siteState.origin;siteBusy=true;const epoch=settingsEpoch;
    let permission;
    try{
      // Request synchronously inside this click/change gesture, before awaiting any other work.
      permission=enabled?chrome.permissions.request({origins:[origin+'/*']}):Promise.resolve(true);
      renderSite();const granted=await permission;
      if(!granted)throw {code:'SITE_PERMISSION'};
      const result=await message(enabled?'bw:enable-site':'bw:disable-site',{origin,windowId:currentWindowId});
      if(!result?.ok)throw {code:'SITE_FAILURE'};
      await refreshSite();
      if($('settings-dialog').open&&epoch===settingsEpoch)settingsStatus(t('siteSaved'));
    }catch(error){const text=t(error?.code==='SITE_PERMISSION'?'sitePermission':'siteFailure');if($('settings-dialog').open&&epoch===settingsEpoch)settingsStatus(text,'error');else status(text,'error');}
    finally{siteBusy=false;renderSite();}
  }
  function providerList(){return providers?.list?.()||[{id:'compatible',label:t('compatibleProvider'),protocol:'openai'}];}
  function renderProviderOptions(){
    const selected=$('model-provider').value;
    $('model-provider').replaceChildren();
    for(const item of providerList()){const option=node('option','',item.id==='compatible'?t('compatibleProvider'):item.label);option.value=item.id;$('model-provider').append(option);}
    if(providerList().some(item=>item.id===selected))$('model-provider').value=selected;
  }
  function currentProvider(){return providers?.get?.($('model-provider').value)||providerList().find(item=>item.id===$('model-provider').value);}
  function canConnectAccount(){return Boolean(providerAuth?.canConnect?.()??providerAuth?.available?.());}
  function candidateSettings(includeKey=false){
    const candidate={mode:$('model-mode').value};
    if(candidate.mode==='custom'){
      candidate.provider=$('model-provider').value;
      candidate.protocol=$('model-protocol').value;candidate.endpoint=$('model-endpoint').value;candidate.model=$('model-name').value.trim();
      if($('model-workspace').value.trim())candidate.workspace=$('model-workspace').value.trim();
      if(includeKey&&$('model-key').value)candidate.apiKey=$('model-key').value;
    }
    return candidate;
  }
  function sameProvider(){
    const id=$('model-provider').value;
    if((preferences.workspace||'')!==$('model-workspace').value.trim())return false;
    if(preferences.provider&&preferences.provider!=='compatible')return preferences.provider===id;
    return id==='compatible'&&preferences.protocol===$('model-protocol').value&&preferences.endpoint===$('model-endpoint').value;
  }
  function updatePresetEndpoint(){
    const provider=currentProvider();if(!provider||provider.id==='compatible')return;
    $('model-protocol').value=provider.protocol;
    try{$('model-endpoint').value=providers.settings(candidateSettings(),{allowEmptyModel:true}).endpoint||'';}catch{$('model-endpoint').value='';}
  }
  function renderModelListStatus(){
    const key=modelsState==='loading'?'loadingModels':modelsState==='loaded'?(modelCount?'modelsLoaded':'modelsEmpty'):modelsState==='error'?'modelsFailed':'modelListNote';
    $('model-list-status').textContent=t(key).replace('{count}',String(modelCount));
    $('model-list-status').dataset.tone=modelsState==='error'?'error':'';
    $('load-models').textContent=t(modelsState==='loading'?'loadingModels':'loadModels');
  }
  function clearModels(){modelsState='idle';modelCount=0;$('provider-models').replaceChildren();renderModelListStatus();}
  let privacyDraft={scope:'',accepted:new Set(),saved:false},privacyRendered='';
  function privacyScope(){const value=candidateSettings();return JSON.stringify([value.mode,value.provider,value.protocol,value.endpoint,value.model,value.workspace||'',$('model-key').value]);}
  function resetPrivacyReview(useSaved=false){
    privacyDraft={scope:privacyScope(),accepted:new Set(useSaved&&preferences.privacyEligible?(preferences.privacy?.accepted||[]):[]),saved:Boolean(useSaved&&preferences.privacyEligible)};
    privacyRendered='';
  }
  function privacyStatusText(profile){
    const complete=profile?.status==='available'&&profile.requirements.every(item=>privacyDraft.accepted.has(item.id));
    $('provider-privacy-status').textContent=t(profile?.status==='unavailable'?'providerModeUnavailable':privacyDraft.saved&&complete?'privacyReviewSaved':complete?'privacyReviewPending':'privacyReviewIncomplete');
  }
  function renderPrivacyReview(){
    const section=$('provider-privacy');if(!section)return;
    const custom=$('model-mode').value==='custom';section.hidden=!custom;if(!custom)return;
    const scope=privacyScope();if(privacyDraft.scope!==scope)resetPrivacyReview();
    let profile;try{profile=providers?.privacyProfile?.(candidateSettings(),language);}catch{}
    $('provider-privacy-summary').textContent=profile?.summary||t('privacyReviewRequired');
    $('provider-privacy-unavailable').hidden=profile?.status!=='unavailable';$('provider-privacy-unavailable').textContent=profile?.unavailableReason||'';
    const signature=JSON.stringify([scope,language,profile?.id,profile?.version,profile?.status,profile?.requirements]);
    if(signature!==privacyRendered){
      privacyRendered=signature;$('provider-privacy-requirements').replaceChildren();$('provider-privacy-links').replaceChildren();
      for(const requirement of profile?.requirements||[]){
        const label=node('label','privacy-check'),input=document.createElement('input');input.type='checkbox';input.name='privacy-requirement';input.value=requirement.id;input.checked=privacyDraft.accepted.has(requirement.id);
        input.addEventListener('change',()=>{settingsDirty=true;privacyDraft.saved=false;settingsStatus();if(input.checked)privacyDraft.accepted.add(requirement.id);else privacyDraft.accepted.delete(requirement.id);privacyStatusText(profile);});
        label.append(input,node('span','',requirement.label));$('provider-privacy-requirements').append(label);
      }
      for(const link of profile?.links||[]){
        // Profiles are bundled constants; still reject non-web links at the DOM boundary.
        let url;try{url=new URL(link.url);if(url.protocol!=='https:')continue;}catch{continue;}
        const anchor=node('a','',link.label);anchor.href=url.href;anchor.target='_blank';anchor.rel='noopener noreferrer';$('provider-privacy-links').append(anchor);
      }
    }
    $('provider-privacy-checks').hidden=profile?.status==='unavailable'||!profile?.requirements?.length;
    $('provider-privacy-review-note').hidden=profile?.status==='unavailable';
    for(const input of $('provider-privacy-requirements').querySelectorAll('input'))input.disabled=settingsBusy;
    privacyStatusText(profile);
  }
  function renderSettingsState(){
    const custom=$('model-mode').value==='custom',provider=currentProvider(),compatible=provider?.id==='compatible';
    $('custom-fields').hidden=!custom;$('trial-settings').hidden=custom;
    const matching=sameProvider();
    $('key-state').textContent=t(preferences.hasKey&&matching?'keyPresent':'keyMissing');
    const panelMemory=globalThis.BeforewordPlatform?.sessionStorageKind==='memory';
    $('key-note').textContent=t(panelMemory?'panelKeyNote':'keyNote');
    $('account-note').textContent=t(panelMemory?'panelAccountNote':'openRouterNote');
    $('forget-key').hidden=!preferences.hasKey||!matching;$('forget-key').disabled=settingsBusy||!preferences.hasKey||serviceMode==='preview';
    $('provider-key-link').hidden=!provider?.keyURL;
    if(provider?.keyURL)$('provider-key-link').href=provider.keyURL;
    $('provider-account').hidden=!(provider?.accountLogin&&canConnectAccount());
    $('model-endpoint').readOnly=!compatible;
    $('model-protocol').disabled=settingsBusy||!compatible;
    $('workspace-field').hidden=provider?.protocol!=='anthropic'&&$('model-protocol').value!=='anthropic';
    for(const id of ['model-mode','model-provider','model-name','model-key','model-endpoint','model-workspace','save-model','connect-account'])$(id).disabled=settingsBusy;
    $('load-models').disabled=settingsBusy||serviceMode==='preview';
    $('settings-preview').hidden=serviceMode!=='preview';
    renderModelListStatus();renderPrivacyReview();
  }
  function populateSettings(){
    $('model-mode').value=preferences.mode==='custom'?'custom':'service';
    const id=preferences.provider||((preferences.endpoint||preferences.model)?'compatible':'openai');
    $('model-provider').value=providerList().some(item=>item.id===id)?id:'compatible';
    $('model-protocol').value=['openai','anthropic','gemini'].includes(preferences.protocol)?preferences.protocol:'openai';
    $('model-endpoint').value=preferences.endpoint||'';$('model-name').value=preferences.model||'';$('model-key').value='';$('model-workspace').value=preferences.workspace||'';
    $('provider-advanced').open=$('model-provider').value==='compatible';
    clearModels();updatePresetEndpoint();resetPrivacyReview(true);renderSettingsState();
  }
  async function openSettings(advanced=false,trigger=document.activeElement){
    settingsTrigger=trigger;settingsDirty=false;const epoch=++settingsEpoch;settingsStatus();populateSettings();$('model-settings').open=true;
    $('settings-dialog').showModal();$('close-settings').focus();
    await Promise.allSettled([refreshSite(),refreshMode()]);
    if(epoch!==settingsEpoch||!$('settings-dialog').open)return;
    if(!settingsDirty)populateSettings();
    if(advanced){$('model-settings').open=true;$('model-mode').focus();}
  }
  function closeSettings(){
    settingsEpoch++;providerController?.abort();$('model-key').value='';resetPrivacyReview();$('settings-dialog').close();
    if(settingsTrigger?.isConnected)settingsTrigger.focus();settingsTrigger=null;
  }
  function settingError(error){
    const codes={PRIVACY_REVIEW_REQUIRED:'privacyReviewRequired',PROVIDER_MODE_UNAVAILABLE:'providerModeUnavailable',INVALID_CONFIG:'settingsInvalid',INVALID_ENDPOINT:'settingsInvalid',INVALID_TOKEN:'keyInvalid',PERMISSION_REQUIRED:'modelPermission',STORAGE_UNAVAILABLE:'settingsStorage',PREVIEW_ONLY:'settingsPreview',AUTH:'customAuth',PROVIDER_AUTH:'customAuth',NETWORK:'networkError',OFFLINE:'networkError',RATE_LIMIT:'rateLimit'};
    return t(codes[error?.code]||'settingsStorage');
  }
  function providerPermission(candidate,identity=false){
    const origins=adapter.permissionOrigins?adapter.permissionOrigins(candidate):[adapter.permissionOrigin(candidate)];
    const platform=globalThis.BeforewordPlatform;
    const permissions=identity?(platform?.identityPermissionRequest??(platform?.kind==='firefox'?[]:['identity'])):[];
    return extension?chrome.permissions.request(permissions.length?{origins,permissions}:{origins}):Promise.resolve(false);
  }
  async function saveModel(event){
    event.preventDefault();if(settingsBusy)return;
    if(serviceMode==='preview'){settingsStatus(t('settingsPreview'));return;}
    const candidate=candidateSettings(true),epoch=settingsEpoch;if(candidate.mode==='custom')candidate.privacyAccepted=[...privacyDraft.accepted];settingsBusy=true;renderState();settingsStatus();
    try{
      // Keep permission invocation in the initiating submit gesture.
      const permission=candidate.mode==='custom'?providerPermission(candidate):Promise.resolve(true);
      renderSettingsState();if(!await permission)throw {code:'PERMISSION_REQUIRED'};
      if(epoch!==settingsEpoch||!$('settings-dialog').open)return;
      await adapter.savePreferences(candidate);
      intentEpoch++;mutationEpoch++;clearAnalysis();await refreshMode();
      if(epoch===settingsEpoch&&$('settings-dialog').open){$('model-key').value='';populateSettings();settingsDirty=false;settingsStatus(t(preferences.mode==='custom'&&!preferences.privacyEligible?'settingsSavedReview':'settingsSaved'));}
    }catch(error){if(epoch===settingsEpoch&&$('settings-dialog').open)settingsStatus(settingError(error),'error');}
    finally{candidate.apiKey='';settingsBusy=false;renderSettingsState();renderState();}
  }
  async function loadModels(){
    if(settingsBusy||serviceMode==='preview')return;
    const candidate=candidateSettings(true),epoch=settingsEpoch;
    if(!candidate.apiKey&&!(sameProvider()&&preferences.hasKey)){settingsStatus(t('modelKeyRequired'),'error');$('model-key').focus();return;}
    settingsBusy=true;providerController=new AbortController();const controller=providerController;modelsState='loading';settingsStatus();
    try{
      const permission=providerPermission(candidate);renderSettingsState();renderState();
      if(!await permission)throw {code:'PERMISSION_REQUIRED'};
      if(epoch!==settingsEpoch||!$('settings-dialog').open||controller.signal.aborted)return;
      const models=await adapter.listModels(candidate,{signal:controller.signal});
      if(epoch!==settingsEpoch||!$('settings-dialog').open||controller.signal.aborted)return;
      $('provider-models').replaceChildren();
      for(const model of models){const option=node('option','',model.label||model.id);option.value=model.id;$('provider-models').append(option);}
      modelCount=models.length;modelsState='loaded';
    }catch(error){if(epoch===settingsEpoch&&$('settings-dialog').open&&!controller.signal.aborted){modelsState='error';settingsStatus(error?.code==='PERMISSION_REQUIRED'?settingError(error):t(error?.code==='AUTH'||error?.code==='PROVIDER_AUTH'?'customAuth':'modelsFailed'),'error');}}
    finally{candidate.apiKey='';if(providerController===controller)providerController=null;settingsBusy=false;renderSettingsState();renderState();if(modelsState==='loaded'&&epoch===settingsEpoch&&$('settings-dialog').open)$('model-name').focus();}
  }
  async function connectAccount(){
    if(settingsBusy||serviceMode==='preview'||currentProvider()?.id!=='openrouter'||!canConnectAccount())return;
    const candidate=candidateSettings(),epoch=settingsEpoch;settingsBusy=true;providerController=new AbortController();const controller=providerController;
    try{
      const permission=providerPermission(candidate,true);renderSettingsState();renderState();settingsStatus(t('accountConnecting'));
      if(!await permission)throw {code:'PERMISSION_REQUIRED'};
      if(epoch!==settingsEpoch||!$('settings-dialog').open||controller.signal.aborted)return;
      await adapter.connectOpenRouter({model:candidate.model||'',signal:controller.signal});
      if(epoch!==settingsEpoch||!$('settings-dialog').open||controller.signal.aborted)return;
      intentEpoch++;mutationEpoch++;clearAnalysis();await refreshMode();
      if(epoch===settingsEpoch&&$('settings-dialog').open){populateSettings();settingsDirty=false;settingsStatus(t('accountConnected'));}
    }catch(error){if(epoch===settingsEpoch&&$('settings-dialog').open&&!controller.signal.aborted)settingsStatus(error?.code==='PERMISSION_REQUIRED'?settingError(error):t(['ABORTED','AUTH_CANCELLED','OAUTH_CANCELLED'].includes(error?.code)?'accountCancelled':'accountFailed'),'error');}
    finally{if(providerController===controller)providerController=null;settingsBusy=false;renderSettingsState();renderState();}
  }
  async function forgetKey(){
    if(settingsBusy||serviceMode==='preview')return;const epoch=settingsEpoch;settingsBusy=true;renderSettingsState();renderState();
    try{await adapter.forgetCustomKey();intentEpoch++;mutationEpoch++;clearAnalysis();await refreshMode();if(epoch===settingsEpoch&&$('settings-dialog').open){$('model-key').value='';renderSettingsState();settingsStatus(t('keyForgotten'));}}
    catch(error){if(epoch===settingsEpoch&&$('settings-dialog').open)settingsStatus(settingError(error),'error');}
    finally{settingsBusy=false;renderSettingsState();renderState();}
  }
  async function acceptAnalysisIntent(intent){
    if(!Number.isInteger(currentWindowId)||intent.windowId!==currentWindowId||seenIntents.has(intent.id))return;
    seenIntents.add(intent.id);if(seenIntents.size>64)seenIntents.delete(seenIntents.values().next().value);
    const epoch=++intentEpoch;mutationEpoch++;clearAnalysis();
    const accepted=await message('bw:consume-intent',{id:intent.id,windowId:currentWindowId});
    if(epoch!==intentEpoch||!accepted?.ok||!accepted.accepted||typeof accepted.selection?.text!=='string')return;
    await waitForMode();if(epoch!==intentEpoch)return;
    if($('settings-dialog').open)closeSettings();
    incoming=null;lastSeenSelection={...accepted.selection,origin:accepted.selection.origin||''};renderIncoming();
    if(setRecord(accepted.selection.text,{focus:false,preserveStatus:true,selection:accepted.selection})){status(t('selectionReady'));$('analyze').focus({preventScroll:true});}
    // Legacy capture intents are acknowledged for routing only. They never authorize a model request.
  }
  function resetInspection(){inspection=null;page=0;selectedIndex=null;$('inspect').open=false;$('character-tiles').replaceChildren();$('character-detail').hidden=true;$('character-literal').textContent='';$('inspection-controls').hidden=true;$('inspection-unavailable').hidden=true;}
  function clearCopyFeedback(){copyEpoch++;$('copy-status').textContent='';$('copy-status').dataset.tone='';$('copy-record').textContent=t('copy');}
  function clearAnalysis(message='',tone='',{preserveNotes=false}={}){
    if(!preserveNotes)clearSectionReports();
    if(report&&sourceAnchor&&anchorState==='anchored')void anchorMessage('bw:anchor-report',{reportRevision:++reportRevision,items:[]});
    clearReportSelection();
    settingsNeeded=false;analysisEpoch++;activeController?.abort();activeController=null;report=null;reportInput=null;reportSource=null;reportPart=null;reportDestination=null;reportModel='';reportOrigin=null;activeNote=0;retryAvailable=false;
    $('record-output').textContent=raw;$('analysis-items').replaceChildren();$('note-navigation').replaceChildren();$('analysis-origin').textContent='';$('analysis-model').textContent='';$('analysis-language').textContent='';clearCopyFeedback();analysisStatus(message,tone);renderState();
  }
  function edited(){
    clearSourceAnchor();const hadAnalysis=Boolean(report||activeController);intentEpoch++;mutationEpoch++;clearAnalysis(hadAnalysis?t('changed'):'');resetInspection();
    if(raw.length===0){viewMode=false;$('editor').open=true;}
    $('record-output').textContent=raw;renderState();status('');
  }
  function rawOffset(text,displayOffset){let index=0,position=0;while(index<text.length&&position<displayOffset){index+=text[index]==='\r'&&text[index+1]==='\n'?2:1;position++;}return index;}
  const normalized = text => text.replace(/\r\n?/g,'\n');
  function rememberEdit(slot,text,reset=false){
    const state=editHistory[slot],visible=$(slot).value;
    if(reset){state.entries=[];state.index=-1;state.cost=0;state.pending=null;}
    else if(state.index<state.entries.length-1){state.entries.splice(state.index+1);state.cost=state.entries.reduce((sum,item)=>sum+item.visible.length+item.raw.length,0);}
    const previous=state.entries[state.index];
    if(previous?.visible===visible&&previous.raw===text)return;
    const cost=visible.length+text.length;
    if(cost>262144){state.entries=[];state.index=-1;state.cost=0;return;}
    state.entries.push({visible,raw:text});state.cost+=cost;state.index=state.entries.length-1;
    // Native undo remains in the browser; only exact line-ending snapshots are bounded here.
    while(state.entries.length>64||state.cost>262144){const removed=state.entries.shift();state.cost-=removed.visible.length+removed.raw.length;state.index--;}
  }
  function pasteExact(event,slot){
    if(!event.clipboardData||!event.clipboardData.types.includes('text/plain'))return;
    const field=$(slot),text=raw,added=event.clipboardData.getData('text/plain');
    const start=rawOffset(text,field.selectionStart),end=rawOffset(text,field.selectionEnd);
    const next=text.slice(0,start)+added+text.slice(end),pending={raw:next,visible:normalized(next)};
    const state=editHistory[slot];state.pending=pending;
    // Let the browser insert the paste so native undo and redo remain intact.
    setTimeout(()=>{if(state.pending===pending)state.pending=null;},0);
  }
  function acceptInput(event,slot){
    const state=editHistory[slot],visible=$(slot).value;
    let text=visible,restored=false;
    if(event.inputType==='historyUndo'||event.inputType==='historyRedo'){
      const step=event.inputType==='historyUndo'?-1:1,matches=[];
      for(let i=state.index+step;i>=0&&i<state.entries.length;i+=step)if(state.entries[i].visible===visible)matches.push(i);
      if(matches.length&&matches.every(i=>state.entries[i].raw===state.entries[matches[0]].raw)){
        state.index=matches[0];text=state.entries[state.index].raw;restored=true;
      }else rememberEdit(slot,text,true);
    }else if(event.inputType==='insertFromPaste'&&state.pending?.visible===visible)text=state.pending.raw;
    state.pending=null;
    raw=text;
    if(!restored&&event.inputType!=='historyUndo'&&event.inputType!=='historyRedo')rememberEdit(slot,text);
    edited(slot);
  }

  function errorKey(error){
    if(error?.code==='STORAGE_UNAVAILABLE')return 'storageUnavailable';
    if(webHost&&error?.code==='STORAGE_CHANGED')return 'storageChanged';
    const codes={PRIVACY_REVIEW_REQUIRED:'privacyReviewRequired',PROVIDER_MODE_UNAVAILABLE:'providerModeUnavailable',INPUT_GRAPHEME_TOO_LONG:'sourceClusterLong',GRAPHEME_SEGMENTATION_UNAVAILABLE:'sourcePartitionUnavailable',EMPTY_INPUT:'empty',INPUT_TOO_LONG:'tooLong',INVALID_INPUT:'unexpected',INVALID_LANGUAGE:'unexpected',INSTRUCTIONS_UNAVAILABLE:'unavailable',CORE_UNAVAILABLE:'unavailable',NOT_CONFIGURED:'configError',CONFIG_REQUIRED:'configError',INVALID_CONFIG:'configError',INVALID_ENDPOINT:'configError',PERMISSION_REQUIRED:'permissionError',AUTH:'accessError',ACCESS_DENIED:'accessError',AUTH_ERROR:'accessError',OFFLINE:'networkError',NETWORK_ERROR:'networkError',UNAVAILABLE:'modelUnavailable',MODEL_UNAVAILABLE:'modelUnavailable',PROVIDER_AUTH:'serverConfigError',PROVIDER_ERROR:'serviceError',SERVICE_NOT_CONFIGURED:'serverConfigError',SERVER_NOT_CONFIGURED:'serverConfigError',PREVIEW_ONLY:'previewOnly',SESSION_EXPIRED:'sessionExpired',SESSION_LIMIT:'sessionLimit',NETWORK_LIMIT:'networkLimit',SESSION_ISSUANCE_LIMIT:'sessionIssuanceLimit',DAILY_LIMIT:'dailyLimit',MONTHLY_LIMIT:'monthlyLimit',SERVICE_BUSY:'serviceBusy',RATE_LIMIT:'rateLimit',QUOTA_EXCEEDED:'rateLimit',TIMEOUT:'timeout',INVALID_RESPONSE:'invalidResponse',INVALID_REPORT:'reportFormat',INVALID_CITATION:'reportCitation',REPORT_TOO_LARGE:'reportSize',RESPONSE_TOO_LARGE:'reportSize',RESPONSE_INCOMPLETE:'reportIncomplete',MODEL_OUTPUT_INCOMPLETE:'reportIncomplete',UPSTREAM_RESPONSE_TOO_LARGE:'reportSize',MODEL_REFUSAL:'refused',CONTEXT_LIMIT:'contextLimit',HTTP_ERROR:'serviceError',SERVICE_ERROR:'serviceError'};
    if(error?.code==='SETTINGS_CHANGED')return 'preferencesChanged';
    if(error?.code==='TRIAL_EXHAUSTED')return 'trialExhausted';
    if(serviceMode==='custom'&&['PROVIDER_AUTH','AUTH','AUTH_ERROR'].includes(error?.code))return 'customAuth';
    if(serviceMode==='custom'&&['INVALID_CONFIG','INVALID_ENDPOINT','INVALID_TOKEN','PERMISSION_REQUIRED'].includes(error?.code))return 'customNotReady';
    if(serviceMode==='custom'&&error?.code==='INVALID_RESPONSE')return 'directInvalid';
    if(serviceMode==='custom'&&['OFFLINE','NETWORK_ERROR'].includes(error?.code))return 'directNetwork';
    if(serviceMode==='custom'&&['RATE_LIMIT','QUOTA_EXCEEDED'].includes(error?.code))return 'directRate';
    if(serviceMode==='custom'&&['PROVIDER_ERROR','SERVICE_ERROR','HTTP_ERROR'].includes(error?.code))return 'directError';
    return codes[error?.code]||'serviceError';
  }
  function errorText(error){const key=errorKey(error);return ['reportCitation','reportFormat','reportIncomplete','reportSize'].includes(key)?t(serviceMode==='custom'?'directFailure':'serviceFailure')+t(key):t(key);}
  function setRecord(text,{focus=true,preserveStatus=false,selection=null}={}){
    let exact;try{partitionLocal(text);if(!text.length||/^\p{White_Space}+$/u.test(text))throw {code:'EMPTY_INPUT'};exact=text;}catch(error){status(t(errorKey(error)),'error');$('editor').open=true;$('source').focus();return false;}
    clearSourceAnchor();mutationEpoch++;clearAnalysis();raw=exact;$('source').value=exact;rememberEdit('source',exact,true);viewMode=true;
    $('record-output').textContent=exact;resetInspection();$('editor').open=false;$('record-details').open=true;if(!preserveStatus)status('');renderState();
    if(selection)void adoptSourceAnchor(selection);
    if(focus){if(dictionaryUI?.getMode()==='dictionary')dictionaryUI.focusWords();else $('record-output').focus({preventScroll:true});$('workspace').scrollIntoView({behavior:'auto',block:'start'});}
    return true;
  }
  function revealWorkingAction(){
    const button=$('analyze'),rect=button.getBoundingClientRect?.(),height=globalThis.innerHeight||document.documentElement.clientHeight;
    if(rect&&height>0&&(rect.top<0||rect.bottom>height))button.scrollIntoView({behavior:'auto',block:'center'});
  }
  function closeReaderMenu(restore=true){const menu=$('reader-menu');if(!menu?.open)return;menu.open=false;if(restore)$('reader-menu-trigger').focus();}
  function showSupporting(id){closeReaderMenu(false);const element=$(id);element.hidden=false;element.open=true;element.scrollIntoView({behavior:'auto',block:'start'});element.querySelector('summary')?.focus();}
  async function analyze(){
    if(dictionaryUI?.getMode()==='dictionary'){if(raw.length)setRecord(raw,{focus:false});dictionaryUI.focusWords();return;}
    if(activeController)return;
    if(!disclosureReady||settingsBusy){analysisStatus(t('settingsChanging'));return;}
    if(serviceMode==='preview'){analysisStatus(t('previewOnly'));return;}
    if(serviceMode==='custom'&&!modelConfigured){analysisStatus(t(preferences.hasKey&&!preferences.privacyEligible?'privacyReviewRequired':'customNotReady'));void openSettings(true,$('analyze'));return;}
    if(!core){analysisStatus(t('unavailable'),'error');return;}
    const part=currentPart(),sourceSnapshot=raw;
    let input;try{if(!part)throw partitionError||{code:raw.length>MAX?'INPUT_TOO_LONG':'EMPTY_INPUT'};input=core.validateInput({text:part.text,language});}catch(error){analysisStatus(t(errorKey(error)),'error');$('editor').open=true;$('source').focus();return;}
    if(!adapter?.analyze){analysisStatus(t('configError'),'error');return;}
    clearAnalysis('','',{preserveNotes:true});viewMode=true;$('record-output').textContent=raw;$('editor').open=false;
    const controller=new AbortController(),epoch=++analysisEpoch,destination=destinationScope();activeController=controller;analysisStatus(t('working'));renderState();revealWorkingAction();
    try{
      const expectedDestination={mode:preferences.mode,provider:preferences.provider,protocol:preferences.protocol,endpoint:preferences.endpoint,model:preferences.model,workspace:preferences.workspace};
      const result=await adapter.analyze({...input,signal:controller.signal,expectedDestination});
      if(epoch!==analysisEpoch||controller.signal.aborted||raw!==sourceSnapshot||sectionIndex!==part.index||language!==input.language||destination!==destinationScope())return;
      // The adapter returns resolved citations; export validation checks those
      // exact offsets and all report bounds before anything enters the cache.
      core.exportReport(result.report,input);
      report=result.report;reportInput=input;reportSource=sourceSnapshot;reportPart={...part};reportDestination=destination;activeNote=0;reportModel=typeof result.model==='string'?result.model:'';reportOrigin='model';activeController=null;
      rememberReport();renderReport();collapseCompletedSource();sendReportAnchor();analysisStatus('');renderState();$('analysis-title').setAttribute('tabindex','-1');$('analysis-title').focus({preventScroll:true});$('analysis-section').scrollIntoView({behavior:'auto',block:'start'});
    }catch(error){
      if(epoch!==analysisEpoch)return;activeController=null;settingsNeeded=error?.code==='TRIAL_EXHAUSTED'||(serviceMode==='custom'&&['PROVIDER_AUTH','AUTH','AUTH_ERROR','INVALID_CONFIG','INVALID_ENDPOINT','INVALID_TOKEN','PERMISSION_REQUIRED','PRIVACY_REVIEW_REQUIRED','PROVIDER_MODE_UNAVAILABLE'].includes(error?.code));retryAvailable=!['ABORTED','PREVIEW_ONLY','TRIAL_EXHAUSTED','SESSION_LIMIT','NETWORK_LIMIT','SESSION_ISSUANCE_LIMIT','DAILY_LIMIT','MONTHLY_LIMIT','SERVER_NOT_CONFIGURED'].includes(error?.code);analysisStatus(error?.code==='ABORTED'?t('cancelled'):errorText(error),error?.code==='ABORTED'?'':'error');renderState();
    }finally{if(activeController===controller){activeController=null;renderState();}void refreshMode();}
  }
  function cancelAnalysis(){intentEpoch++;if(!activeController)return;clearAnalysis(t('cancelled'),'',{preserveNotes:true});$('analyze').focus({preventScroll:true});}
  function highlightCitation(citation){
    if(!validReport())return;
    const {start,end,text}=absoluteCitation(citation);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>raw.length||raw.slice(start,end)!==text)return;
    const mark=node('mark','located-excerpt',text);mark.tabIndex=-1;
    $('record-output').replaceChildren(document.createTextNode(raw.slice(0,start)),mark,document.createTextNode(raw.slice(end)));
    mark.focus({preventScroll:true});mark.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'});
  }
  function citationButton(citation,className,index){
    const button=node('button',className,citation.text);button.type='button';button.dir='auto';button.lang='';button.title=t('locateQuote');
    button.addEventListener('click',()=>{
      const selection=document.getSelection?.();
      if(selection&&!selection.isCollapsed&&selection.rangeCount===1){const range=selection.getRangeAt(0);if(button.contains(range.startContainer)||button.contains(range.endContainer)){updateReportSelection();return;}}
      void focusSource(citation,index);
    });return button;
  }
  function reportLabel(tag,className,text){const label=node(tag,className,text);label.lang=language;return label;}
  function reportField(card,label,text,className=''){
    if(text===null)return;
    const section=node('div',`report-field ${className}`),heading=reportLabel('h3','field-label',label),content=node('p','report-text',text);
    section.append(heading,content);card.append(section);
  }
  function clearReportSelection(){
    reportSelection=null;$('report-selection-tools').hidden=true;$('reuse-report-writing').disabled=true;
  }
  function readReportSelection(){
    if(!validReport())return null;
    const selection=document.getSelection?.();
    if(!selection||selection.isCollapsed||selection.rangeCount!==1)return null;
    const range=selection.getRangeAt(0);
    // Both endpoints and their common ancestor must be inside one owned writing
    // surface. A range crossing panel controls or another surface is not input.
    const scope=[$('analysis-items'),$('analysis-method-body')].find(item=>item.contains(range.startContainer)&&item.contains(range.endContainer)&&item.contains(range.commonAncestorContainer));
    if(!scope||scope===$('analysis-method-body')&&!$('analysis-method').open)return null;
    const visibleWithinScope=endpoint=>{
      let current=endpoint.nodeType===3?endpoint.parentElement:endpoint;
      while(current&&current!==scope){
        if(current.tagName==='DETAILS'&&!current.open){
          const summary=[...current.children].find(child=>child.tagName==='SUMMARY');
          if(!summary?.contains(endpoint))return false;
        }
        current=current.parentElement;
      }
      return current===scope;
    };
    if(!visibleWithinScope(range.startContainer)||!visibleWithinScope(range.endContainer))return null;
    const text=selection.toString();
    if(typeof text!=='string'||!text.length)return null;
    return {text,report};
  }
  function updateReportSelection(){
    const selected=readReportSelection();
    // Moving keyboard focus to this explicit action can collapse a selection.
    // Retain only that snapshot; any non-collapsed foreign range clears it.
    if(!selected&&document.activeElement===$('reuse-report-writing')&&document.getSelection?.()?.isCollapsed&&reportSelection?.report===report)return;
    if(!selected){clearReportSelection();return;}
    reportSelection=selected;$('report-selection-tools').hidden=false;
    $('reuse-report-writing').disabled=selected.text.length>MAX;
    $('report-selection-hint').textContent=t(selected.text.length>MAX?'reuseTooLong':'reuseHint');
  }
  function useReportSelection(){
    const selection=document.getSelection?.(),selected=readReportSelection()||(selection?.isCollapsed?reportSelection:null);
    if(!selected||selected.report!==report||selected.text.length>MAX)return;
    const text=selected.text;intentEpoch++;captureEpoch++;
    if(!setRecord(text))return;
    incoming=null;renderIncoming();status(t('reuseReady'));
    // Prefill only. A separate press on the existing analysis button sends it.
  }
  function renderReport(){
    clearReportSelection();
    $('analysis-items').replaceChildren();if(!report)return;
    $('analysis-items').lang=reportInput.language;
    $('analysis-language').textContent=t('reportLanguage').replace('{language}',reportInput.language==='ru'?'Русский':'English');
    $('analysis-origin').textContent=t(reportOrigin==='example'?'exampleOrigin':'modelOrigin')+(reportInput.language!==language?` · ${reportInput.language==='ru'?'Русский':'English'}`:'');
    $('analysis-origin').classList.toggle('authored',reportOrigin==='example');
    $('analysis-model').textContent=reportOrigin==='model'&&reportModel?`${t('modelLabel')}: ${reportModel}`:'';
    $('analysis-method-generation').textContent=t(reportOrigin==='example'?'methodExample':'methodModel');
    $('analysis-method-scope').textContent=t(reportOrigin==='example'?'methodExampleScope':'methodScope');
    $('note-navigation').replaceChildren();$('note-navigation').setAttribute('aria-label',t('reportNavigation'));$('note-navigation').hidden=report.items.length<2;
    report.items.forEach((item,index)=>{
      const nav=node('button','note-tab',String(index+1));nav.type='button';nav.setAttribute('aria-label',`${t('item')} ${index+1}`);nav.addEventListener('click',()=>{openNote(index);void focusSource(item.quote,index);});$('note-navigation').append(nav);
      const card=node('details','analysis-card note-card');card.tabIndex=-1;card.setAttribute('aria-label',`${t('item')} ${index+1}`);card.open=index===activeNote;
      const summary=node('summary','note-summary');summary.append(reportLabel('span','item-number',String(index+1)),node('span','note-summary-quote exact',item.quote.text));card.append(summary);
      const body=node('div','note-card-body'),quote=node('div','quote-field');quote.append(reportLabel('h3','field-label',t('quoteLabel')),citationButton(item.quote,'quote-button exact',index));body.append(quote);
      const step=node('div','report-field reading-step');step.append(reportLabel('h3','field-label added-writing-label',t('readingStep')),readingText(item.reading));body.append(step);
      if(item.grounds){
        const details=node('details','disclosure report-details'),detailSummary=reportLabel('summary','',t('detailTitle')),detailBody=node('div','report-detail-body');details.append(detailSummary,detailBody);details.addEventListener('toggle',()=>{clearReportSelection();updateReportSelection();});
        reportField(detailBody,t('attributionLabel'),item.attribution);
        const grounds=node('div','report-field grounds-field'),heading=reportLabel('h3','field-label',t('groundsLabel'));
        const kinds={record:'recordGrounds',learned_usage:'learnedGrounds',not_supplied:'missingGrounds'};
        grounds.append(heading,reportLabel('p','grounds-kind',t(kinds[item.grounds.kind])),node('p','report-text',item.grounds.explanation));
        if(item.grounds.citations.length){const citations=node('div','citations');citations.append(reportLabel('p','citation-label',t('citationsLabel')));for(const citation of item.grounds.citations)citations.append(citationButton(citation,'citation-button exact'));grounds.append(citations);}
        detailBody.append(grounds);reportField(detailBody,t('limitLabel'),item.limit,'limit-field');body.append(details);
      }
      card.append(body);
      card.addEventListener('toggle',()=>{clearReportSelection();if(card.open&&activeNote!==index)openNote(index);updateReportSelection();});$('analysis-items').append(card);
    });
    openNote(Math.min(activeNote,report.items.length-1));
  }
  function openNote(index){
    if(!Number.isInteger(index)||index<0||index>=(report?.items.length||0))return;if(index!==activeNote)clearReportSelection();activeNote=index;
    [...$('analysis-items').children].forEach((card,position)=>{card.open=position===index;});
    [...$('note-navigation').children].forEach((button,position)=>button.setAttribute('aria-pressed',String(position===index)));
    if(validReport()&&sectionReports.has(sectionIndex))sectionReports.get(sectionIndex).activeNote=index;
  }

  function loadExample(id=$('example-choice').value){
    const example=examples.find(item=>item.id===id);if(!example||!core)return;
    dictionaryUI?.setMode('model');
    try{
      const input=core.validateInput({text:example.text[language],language});
      const prepared=core.validateReport(example.report[language],input);
      intentEpoch++;if(!setRecord(input.text,{focus:false}))return;
      report=prepared;reportInput=input;reportSource=raw;reportPart={...currentPart()};reportDestination=destinationScope();activeNote=0;reportModel='';reportOrigin='example';rememberReport();renderReport();collapseCompletedSource();renderState();$('examples-section').open=false;
      $('analysis-title').setAttribute('tabindex','-1');$('analysis-title').focus({preventScroll:true});$('analysis-section').scrollIntoView({behavior:'auto',block:'start'});
    }catch{status(t('invalidExample'),'error');}
  }
  function renderIncoming(){
    $('incoming').hidden=!incoming;if(!incoming){$('incoming-text').textContent='';$('incoming-origin').textContent='';return;}
    $('incoming-text').textContent=incoming.text;$('incoming-origin').textContent=incoming.origin||t('selectionOrigin');$('replace-selection').disabled=incoming.text.length>MAX;
  }
  async function message(type,extra={}){try{if(webHost)return await webHost.message(type,extra);if(!extension)return null;return await chrome.runtime.sendMessage({type,...extra});}catch{return null;}}
  async function fetchState(initial=false,capture=false){
    // The capture's broadcast can beat its direct response. Retain the explicit
    // user gesture in every state read started while that capture is pending.
    const captureIntent=capture?{}:pendingCapture;if(capture)pendingCapture=captureIntent;
    try{
      const epoch=++captureEpoch,locale=localeEpoch;await windowReady;if(epoch!==captureEpoch)return;const state=await message(capture?'bw:capture':'bw:get-state',capture?{windowId:currentWindowId}:{});
      if(epoch!==captureEpoch)return;if(!state?.ok){if(captureIntent)status(t('captureUnavailable'),'error','capture');return;}
      $('return-source').hidden=!state.canReturnToSource;
      if(initial&&locale===localeEpoch&&(state.language==='ru'||state.language==='en')&&state.language!==language){mutationEpoch++;language=state.language;clearAnalysis();renderLanguage();}
      const selection=state.selection&&typeof state.selection.text==='string'?{text:state.selection.text,origin:typeof state.selection.origin==='string'?state.selection.origin:'',sourceAnchor:state.selection.sourceAnchor}:null;
      const intent=state.selection?.analysisIntent;
      if(selection&&typeof intent?.id==='string'&&Number.isInteger(intent.windowId)){clearCaptureStatus();void acceptAnalysisIntent(intent);return;}
      if(!selection){incoming=null;lastSeenSelection=null;renderIncoming();}
      if(selection&&(capture||!sameSelection(selection,lastSeenSelection)||selection.text!==raw)){
        lastSeenSelection=selection;
        if(raw.length===0&&!activeController)setRecord(selection.text,{preserveStatus:true,selection});
        else{incoming=selection;renderIncoming();}
      }
      if(state.captureError==='NO_SELECTION'){
        if(captureIntent)status(t('noSelection'),'','capture');else clearCaptureStatus();
      }else if(state.captureError){
        const errors={EDITABLE_SELECTION:'editableSelection',SELECTION_TOO_LONG:'captureTooLong',CAPTURE_UNAVAILABLE:'captureUnavailable',STORAGE_UNAVAILABLE:'storageUnavailable'};
        status(t(errors[state.captureError]||'captureUnavailable'),'error','capture');
      }else if(selection){clearCaptureStatus();}
    }finally{if(capture&&pendingCapture===captureIntent)pendingCapture=null;}
  }

  function replaceSelection(){intentEpoch++;if(!incoming)return;const selected={...incoming};if(!setRecord(selected.text,{selection:selected}))return;if(sameSelection(incoming,selected)){captureEpoch++;incoming=null;lastSeenSelection=null;renderIncoming();void message('bw:clear');}}
  async function dismissSelection(){intentEpoch++;captureEpoch++;const mutation=mutationEpoch;incoming=null;lastSeenSelection=null;renderIncoming();if(viewMode)$('record-output').focus({preventScroll:true});else{$('editor').open=true;$('source').focus();}await message('bw:clear');if(mutation!==mutationEpoch||incoming)return;status(t('kept'));}
  function ensureInspection() {
    if (!viewMode || inspection) return;
    try { inspection = formCore.inspect(currentPart()?.text||raw); } catch { inspection = {supported:false,segments:[],count:null}; }
    renderInspection();
  }
  function renderInspection() {
    if (!inspection) return;
    $('inspection-unavailable').hidden = inspection.supported;
    $('inspection-controls').hidden = !inspection.supported;
    if (!inspection.supported) return;
    const total = inspection.segments.length;
    const pages = Math.max(1,Math.ceil(total / PAGE_SIZE));
    page = Math.max(0,Math.min(page,pages - 1));
    $('character-count').textContent = `${t('fragments')}: ${total.toLocaleString(language)}`;
    $('characters-page').textContent = `${t('page')} ${page + 1} ${t('of')} ${pages}`;
    $('characters-prev').disabled = page === 0;
    $('characters-next').disabled = page === pages - 1;
    $('character-tiles').replaceChildren();
    const start = page * PAGE_SIZE;
    inspection.segments.slice(start,start + PAGE_SIZE).forEach((segment,offset) => {
      const index = start + offset;
      const button = node('button');
      button.type = 'button';button.dataset.index = String(index);
      button.setAttribute('aria-pressed',String(selectedIndex === index));
      button.setAttribute('aria-label',`${t('fragment')} ${index + 1}: ${segment.kind === 'visible' ? segment.text : t(segment.kind)}`);
      if (segment.kind === 'visible') { button.textContent = segment.text; button.dir = 'auto'; }
      else { const label = node('span','token-label',t(`${segment.kind}Short`)); label.setAttribute('aria-hidden','true'); button.append(label); }
      button.addEventListener('click',() => selectCharacter(index));
      $('character-tiles').append(button);
    });
    if (selectedIndex !== null) renderCharacterDetail();
  }
  function renderCharacterDetail() {
    const segment = inspection?.segments[selectedIndex];
    $('character-detail').hidden = !segment;
    if (!segment) return;
    $('character-detail-label').textContent = `${t('fragment')} ${selectedIndex + 1} ${t('of')} ${inspection.segments.length}`;
    $('character-literal').textContent = segment.text;
    $('character-detail-kind').textContent = segment.kind === 'visible' ? '' : `${t('kindLabel')}: ${t(segment.kind)}`;
  }
  function selectCharacter(index) {
    selectedIndex = index;renderCharacterDetail();
    for (const button of $('character-tiles').children) button.setAttribute('aria-pressed',String(Number(button.dataset.index) === index));
  }
  function changePage(direction) {
    page += direction;selectedIndex = null;$('character-detail').hidden = true;renderInspection();
    const first = $('character-tiles').querySelector('button');
    first?.focus({preventScroll:true});
    $('character-count').scrollIntoView({behavior:'auto',block:'start'});
  }
  function downloadExact(text,filename){
    // Refuse UTF-8 replacement of unpaired surrogates instead of changing an export.
    if(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text))throw new Error('UNENCODABLE_TEXT');
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8',endings:'transparent'}));const link=node('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }

  async function copyText(text,filename,quoteOnly=false){
    const epoch=mutationEpoch,attempt=++copyEpoch;
    const current=()=>epoch===mutationEpoch&&attempt===copyEpoch;
    const feedback=(key,tone='')=>{if(quoteOnly)$('copy-record').textContent=t(key==='downloaded'?'quoteDownloaded':key==='copyFailed'?'quoteCopyFailed':'copied');else{$('copy-status').textContent=t(key);$('copy-status').dataset.tone=tone;}};
    $('copy-status').textContent='';
    try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(text);if(current())feedback(quoteOnly?'copied':'analysisCopied');}
    catch{if(!current())return;try{downloadExact(text,filename);if(current())feedback('downloaded');}catch{if(current())feedback('copyFailed','error');}}
  }
  function copyRecord(){if(viewMode)void copyText(raw,'beforeword-writing.txt',true);}
  function copyAnalysis(){
    if(!validReport())return;
    try{const origin=COPY[reportInput.language][reportOrigin==='example'?'exampleExportOrigin':'modelExportOrigin']+(reportOrigin==='model'&&reportModel?` · ${reportModel}`:'');const scope=sourceParts().length>1?replaceTemplate('sectionCurrent',{index:reportPart.index+1,total:sourceParts().length},reportInput.language)+'\n'+replaceTemplate('sectionScope',{start:reportPart.start+1,end:reportPart.end,total:raw.length},reportInput.language)+'\n\n':'';const text=`${origin}\n\n${scope}${core.exportReport(report,reportInput)}`;void copyText(text,'beforeword-analysis.txt');}
    catch{$('copy-status').textContent=t('copyFailed');$('copy-status').dataset.tone='error';}
  }
  async function reset(){
    dictionaryUI?.reset();
    intentEpoch++;captureEpoch++;mutationEpoch++;const mutation=mutationEpoch;clearSourceAnchor();clearAnalysis();incoming=null;lastSeenSelection=null;raw='';viewMode=false;webHost?.readingClosed?.();
    $('source').value='';rememberEdit('source','',true);$('record-output').textContent='';resetInspection();renderState();renderIncoming();$('editor').open=true;$('examples-section').open=false;$('source').focus();
    const [cleared,sessionCleared]=await Promise.allSettled([message('bw:clear'),Promise.resolve().then(()=>adapter?.clearSession?.())]);
    if(mutation!==mutationEpoch||incoming)return;
    const failures=[];
    if(extension&&(cleared.status!=='fulfilled'||!cleared.value?.ok))failures.push(t('clearFailed'));
    if(sessionCleared.status==='rejected')failures.push(t('clearSessionFailed'));
    status(failures.length?failures.join(' '):t('cleared'),failures.length?'error':'');
  }
  rememberEdit('source','',true);
  $('close-menu')?.addEventListener('click',()=>closeReaderMenu());
  $('menu-new')?.addEventListener('click',()=>{closeReaderMenu(false);closeReading();$('source').focus();});
  $('menu-examples')?.addEventListener('click',()=>{closeReaderMenu(false);$('examples-section').scrollIntoView({behavior:'auto',block:'start'});$('example-buttons').querySelector('button')?.focus();});
  $('menu-help')?.addEventListener('click',()=>showSupporting('help'));
  $('menu-data')?.addEventListener('click',()=>showSupporting('data-notice'));
  $('menu-dictionary')?.addEventListener('click',()=>{closeReaderMenu(false);dictionaryUI?.setMode('dictionary');$('dictionary-workspace')?.scrollIntoView({behavior:'auto',block:'start'});});
  $('menu-characters')?.addEventListener('click',()=>{if(!raw.length)return;closeReaderMenu(false);if(!viewMode)setRecord(raw,{focus:false});showSupporting('inspect');ensureInspection();});
  $('edit-source')?.addEventListener('click',()=>{viewMode=false;renderState();$('source').focus();});
  document.addEventListener('pointerdown',event=>{if($('reader-menu')?.open&&!$('reader-menu').contains(event.target))closeReaderMenu(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('reader-menu')?.open){event.preventDefault();closeReaderMenu();}});
  $('source').addEventListener('input',event=>acceptInput(event,'source'));
  $('source').addEventListener('paste',event=>pasteExact(event,'source'));
  $('source').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();if(!activeController)void analyze();}});
  $('settings').addEventListener('click',()=>{closeReaderMenu(false);void openSettings(false,$('reader-menu-trigger'));});$('close-settings').addEventListener('click',closeSettings);
  $('settings-dialog').addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
  $('quota-settings').addEventListener('click',()=>openSettings(true,$('quota-settings')));
  $('model-connection').addEventListener('click',()=>openSettings(true,$('model-connection')));
  $('load-models').addEventListener('click',loadModels);$('connect-account').addEventListener('click',connectAccount);
  $('site-enable').addEventListener('click',()=>changeSite(true));$('site-toggle').addEventListener('change',()=>changeSite($('site-toggle').checked));
  $('model-form').addEventListener('submit',saveModel);$('forget-key').addEventListener('click',forgetKey);
  for(const id of ['model-mode','model-provider','model-protocol','model-endpoint','model-name','model-key','model-workspace'])$(id).addEventListener('input',()=>{
    settingsDirty=true;settingsStatus();
    if(['model-provider','model-protocol','model-endpoint','model-workspace'].includes(id)){$('model-key').value='';clearModels();}
    if(id==='model-provider'){$('model-name').value='';$('model-workspace').value='';$('model-endpoint').value='';$('provider-advanced').open=$('model-provider').value==='compatible';}
    if(['model-provider','model-name','model-mode'].includes(id))updatePresetEndpoint();
    resetPrivacyReview();renderSettingsState();
  });
  $('panel-guide')?.addEventListener('toggle',renderGuide);
  $('editor').addEventListener('toggle',()=>{if(guideEmpty){$('analysis-actions').hidden=!$('editor').open;if($('editor').open){$('panel-guide').open=false;readingGuide?.setVisible(false);}}});
  $('return-source').addEventListener('click',async()=>{const result=await message('bw:return-source');if(!result?.ok)status(t('sourceUnavailable'),'error');});
  $('section-prev').addEventListener('click',()=>selectSection(-1));$('section-next').addEventListener('click',()=>selectSection(1));
  $('analyze').addEventListener('click',analyze);$('cancel-analysis').addEventListener('click',cancelAnalysis);
  $('capture').addEventListener('click',()=>fetchState(false,true));$('replace-selection').addEventListener('click',replaceSelection);$('dismiss-selection').addEventListener('click',dismissSelection);
  $('record-summary').addEventListener('click',()=>{sourceDisclosurePreference=!$('record-details').open;});
  $('record-details').addEventListener('toggle',renderSourceState);$('show-source').addEventListener('click',()=>focusSource());$('close-reading').addEventListener('click',closeReading);
  $('new-text').addEventListener('click',()=>{closeReading();status('');$('workspace').scrollIntoView({behavior:'auto',block:'start'});});
  $('copy-record').addEventListener('click',copyRecord);$('copy-analysis').addEventListener('click',copyAnalysis);
  $('reuse-report-writing').addEventListener('pointerdown',event=>{if(reportSelection)event.preventDefault();});
  $('reuse-report-writing').addEventListener('click',useReportSelection);
  document.addEventListener('selectionchange',updateReportSelection);
  document.addEventListener('pointerdown',event=>{
    const target=event.target;
    if(target!==$('reuse-report-writing')&&!$('analysis-items').contains(target)&&!$('analysis-method-body').contains(target))clearReportSelection();
  });
  $('analysis-method').addEventListener('toggle',()=>{if(!$('analysis-method').open)updateReportSelection();});
  $('load-example').addEventListener('click',()=>loadExample());$('quick-example').addEventListener('click',()=>loadExample(examples[0]?.id));$('reset').addEventListener('click',reset);
  $('inspect').addEventListener('toggle',()=>{if($('inspect').open)ensureInspection();});$('characters-prev').addEventListener('click',()=>changePage(-1));$('characters-next').addEventListener('click',()=>changePage(1));
  document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',async()=>{
    const next=button.dataset.language;if(next===language)return;intentEpoch++;const wasWorking=Boolean(activeController),locale=++localeEpoch;mutationEpoch++;language=next;
    if(report&&!wasWorking){clearCopyFeedback();analysisStatus('');renderLanguage();renderReport();}
    else{clearAnalysis(wasWorking?t('languageCancelled'):'','',{preserveNotes:true});renderLanguage();}
    status('');
    const mutation=mutationEpoch,saved=await message('bw:set-language',{language});if(extension&&locale===localeEpoch&&mutation===mutationEpoch&&!saved?.ok)status(t('languageSaveFailed'),'error');
  }));
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||$('settings-dialog').open)return;
    if(!$('character-detail').hidden){const previous=selectedIndex;selectedIndex=null;$('character-detail').hidden=true;renderInspection();$('character-tiles').querySelector(`[data-index="${previous}"]`)?.focus();event.preventDefault();return;}
    const details=document.activeElement?.closest('details[open]');if(details){if(details===$('record-details'))sourceDisclosurePreference=false;details.open=false;details.querySelector('summary')?.focus();}
  });
  if(extension&&chrome.runtime.onMessage)chrome.runtime.onMessage.addListener((request,sender)=>{if(sender.id!==chrome.runtime.id)return;if(request?.type==='bw:selection')void fetchState();else if(request?.type==='bw:anchor-event')receiveAnchorEvent(request);});
  if(extension&&chrome.storage?.onChanged)chrome.storage.onChanged.addListener((changes,area)=>{
    if((area==='local'&&Object.hasOwn(changes,'beforewordModelPreferencesV1'))||(area==='session'&&Object.hasOwn(changes,'beforewordCustomKeyV1'))){
      intentEpoch++;mutationEpoch++;disclosureReady=false;clearAnalysis(t('preferencesChanged'));modeReady=refreshMode();
    }
  });
  dictionaryUI=globalThis.BeforewordDictionaryUI?.mount({
    onModeChange(next){if(next==='dictionary'&&activeController)clearAnalysis(t('cancelled'),'',{preserveNotes:true});renderLanguage();},
    onPrepare(){if(setRecord(raw,{focus:false}))dictionaryUI?.focusWords();},
    onSetSource(text){setRecord(text,{focus:false});}
  })||null;
  $('site-settings-note').before($('site-entry'));
  renderLanguage();modeReady=refreshMode();void refreshSite();if(!core||!formCore||!readingSurface)status(t('unavailable'),'error');
  if(extension)void fetchState(true);
  if(webHost)webHost.attach(Object.freeze({
    setPanelVisible,
    acceptSelection(selection){
      // The website may prefill exact writing; only the panel's own action sends it.
      if(!selection||typeof selection.text!=='string'||selection.text.length>MAX)return false;
      intentEpoch++;captureEpoch++;incoming=null;lastSeenSelection=null;renderIncoming();
      return setRecord(selection.text,{selection,focus:false});
    },
    focusEditor(){
      // A landing CTA opens the existing editor; only explicit New text/reset
      // replaces its content or clears completed notes.
      dictionaryUI?.setMode('model');viewMode=false;renderState();$('editor').open=true;if($('panel-guide'))$('panel-guide').open=false;readingGuide?.setVisible(false);$('source').focus();$('editor').scrollIntoView({behavior:'auto',block:'start'});
    },
    openExample:loadExample,
    openDictionaryExample(id){dictionaryUI?.openExample(id);},
    setLanguage(next){if(['ru','en'].includes(next))document.querySelector(`[data-language="${next}"]`)?.click();},
    cancel(){dictionaryUI?.cancel();cancelAnalysis();},
    receiveAnchorEvent
  }));
})();
