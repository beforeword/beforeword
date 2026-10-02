# beforeword

[English](README.md) · [Сайт](https://beforeword.xyz/model/)

beforeword — инструкции чтения для ИИ-приложений. Они предлагают сохранять исходную формулировку, показывать добавленное к ней прочтением и включать в тот же разбор сам ответ. Инструкция, это описание и критерии оценки ответа также остаются написанными формами в этом охвате.

## Начать в чате

1. Открой [полную русскую инструкцию](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_RU.txt) или [полную английскую](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_EN.txt) и скопируй файл целиком.
2. Вставь его первым сообщением нового чата в своём ИИ-приложении.
3. Отправь задачу. Например: `Примени beforeword к фразе «Я понимаю».`

Для этого способа не нужны скачивание, ключ API или аккаунт разработчика. Инструкция передаётся в выбранный чат; в другом чате передай её заново и при необходимости укажи язык ответа. Настройки приложения и навыки позволяют подключить её на более длительный срок там, где это поддерживается; доступность зависит от приложения и аккаунта. Краткая редакция нужна для ограниченного поля сохранённых настроек. Если инструкция была отправлена только сообщением, для прекращения режима начни новый разговор без неё. Сохранённую инструкцию сначала удали из настроек приложения или проекта; установленный навык отключи через управление навыками или плагинами. Уже отправленные сообщения остаются в прежнем разговоре.

Выбери один способ подключения. [Руководство по установке](docs/installation.ru.md) описывает настройки, навыки, обновление и удаление. HTML-руководство ниже содержит шаги для разных приложений, кнопки копирования и отдельные загрузки RU/EN.

## Готовые загрузки · 1.2.0

Выбери один способ подключения и один язык инструкции. Для использования этих файлов Python не нужен.

| Для чего | Русский | English |
|---|---|---|
| Полная инструкция для нового чата | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_RU.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_EN.txt) |
| Краткая инструкция для ограниченного поля настроек | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_compact_RU.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_compact_EN.txt) |
| Плагин Claude / Claude Code | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_claude_plugin_RU_1.2.0.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_claude_plugin_EN_1.2.0.zip) |
| Локальный каталог Codex · desktop / CLI | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_openai_local_marketplace_RU_1.2.0.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_openai_local_marketplace_EN_1.2.0.zip) |
| Отдельный навык | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_skill_RU_1.2.0.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword-SKILL-ru.md) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_skill_EN_1.2.0.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword-SKILL-en.md) |

[Скачать самостоятельное руководство · RU/EN](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_AI_1.2.0.html). Сохрани HTML-файл и открой его в браузере: в нём есть кнопки копирования, шаги установки, загрузки пакетов и локальная подготовка API-запросов. Язык переключается вверху страницы. На телефоне предварительный просмотр файла может показывать текст без работающих кнопок; тогда используй TXT-ссылки выше или [страницу сайта](https://beforeword.xyz/model/).

В каждом пакете есть шаги установки, обновления и удаления. Наличие импорта зависит от приложения и аккаунта; отправка архива в разговор не устанавливает навык. Полные TXT содержат и область действия, и ядро инструкции.

[Инструменты для разработчиков · ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_toolkit_1.2.0.zip) · [Контрольные суммы](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/SHA256SUMS.txt) · [Размеры файлов и хеши исходных файлов сборки](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/manifest.json)

## Что входит в комплект

- Единое полное ядро на [русском](assets/core.ru.txt) и [английском](assets/core.en.txt) с отдельной инструкцией об области действия; краткие редакции предназначены для ограниченных полей настроек.
- Дополнительные пакеты локального каталога и плагина для поддерживаемых сред Codex и Claude, а также отдельные пакеты навыка.
- Локальные инструменты для семи текстовых форматов запросов и ответов API.
- Воспроизводимая сборка руководства и страниц сайта, локальные проверки и записи предыдущих испытаний.

## Для разработчиков

Нужен Python 3.10 или новее. Node.js 18 или новее требуется только для локальных проверок JavaScript; CI использует Python 3.12 и Node.js 22. Инструменты Python используют стандартную библиотеку. Выполни команды из корня репозитория:

```sh
python3 scripts/build_guide.py --output build/toolkit
python3 scripts/package_plugins.py --language ru --output build/packages
python3 scripts/package_plugins.py --language en --output build/packages
python3 scripts/build_public.py --output build/site --github-url https://github.com/beforeword/beforeword
```

Самостоятельное HTML-руководство: `build/toolkit/beforeword_AI.html`. Файлы сайта находятся в `build/site/public_html/`; сборка их не публикует. В каждом ZIP плагина есть собственные шаги установки, вызова, обновления и удаления. Устанавливай одну языковую редакцию за раз.

Для подготовки локального API-запроса используй Bash и замени обозначение модели на идентификатор, доступный в твоём аккаунте провайдера. Начни в корне репозитория; новая рабочая папка позволяет повторять пример:

```bash
BEFOREWORD_DIR="$(pwd)"
BEFOREWORD_WORK="$(mktemp -d)"
BEFOREWORD_MODEL='REPLACE_WITH_YOUR_AVAILABLE_MODEL_ID'
cd "$BEFOREWORD_WORK"
printf '%s\n' 'Примени beforeword к фразе «Я понимаю».' > input.txt
python3 "$BEFOREWORD_DIR/scripts/build_payload.py" openai \
  --model "$BEFOREWORD_MODEL" --language ru \
  --input-file input.txt --output request.json
```

Команда создаёт локальный JSON. Она не отправляет запрос, не читает ключ API и не подтверждает доступность выбранной модели. [Руководство API](references/api-use.ru.md) описывает отдельную отправку, сохранённые ответы, ошибки и текстовую историю. [Метаданные провайдеров](references/api.json) содержат адреса и обозначения переменных заголовков. Не добавляй ключи и личные разговоры в репозиторий или файлы для общего доступа.

## Проверки и записи испытаний

Если исходники распакованы из ZIP инструментов, сначала выполни `python3 -B scripts/build_downloads.py`: этот архив не включает созданные загрузки. В копии репозитория каталог `downloads/` уже присутствует.

```sh
python3 scripts/test_payload.py
python3 scripts/test_downloads.py
python3 -B scripts/build_downloads.py --check
python3 scripts/build_guide.py --output build/toolkit
node scripts/test_guide.cjs build/toolkit/beforeword_AI.html
python3 scripts/test_packages.py
python3 scripts/build_public.py --output build/site
node scripts/test_public.cjs build/site/public_html
```

Этим проверкам не нужны аккаунты провайдеров или ключи API. Они проверяют локальные форматы, точное сохранение текста, содержимое пакетов, созданные ссылки и имитацию поведения интерфейса. Они не выполняют установку в приложения и не заменяют визуальную проверку в браузере.

[Описание испытаний](references/evaluation.ru.md) разделяет прогоны по редакциям инструкции. Сохранённое сравнение на 180 ответах относится к прежним хешам инструкции: это не испытание поведения выпуска 1.2.0 и не рейтинг моделей. Полная и краткая инструкции в тех условиях также различались языком. Оценка испытания и появление названия beforeword в ответе не устанавливают область действия или качество следующих ответов.

## Выпуск и повторное использование

[Руководство сопровождения](docs/maintaining.ru.md) описывает подготовку и проверку локального выпуска. Выбор лицензии и условий распространения остаётся за владельцем; этот репозиторий не назначает лицензию. До фиксации выбора не следует описывать комплект как разрешённый к неограниченному распространению.

## Интеграция с существующим сайтом

После получения актуального архива распакуй его в отдельный каталог. Следующие команды создают проверяемый патч; исходный сайт не меняется. Каталог результата должен быть новым и находиться вне репозитория:

```sh
python3 scripts/prepare_site_release.py --site /ABS/CURRENT_SITE --output /ABS/NEW_RELEASE
python3 scripts/verify_site_release.py --site /ABS/CURRENT_SITE --release /ABS/NEW_RELEASE
```

В `public_html/` результата находятся только файлы для добавления или замены. `INSTALL_RU.txt` содержит шаги загрузки, `site-patch.json` — исходные и новые хеши. Обе главные страницы меняются только внутри блока инструкции; даты этих страниц и раздела для ИИ обновляются в sitemap. Историческая редакция раздела сохранена отдельно. Самостоятельная сборка `build_public.py` создаёт только раздел `/model/`.
