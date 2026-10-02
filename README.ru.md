# beforeword

[English](README.md) · [Сайт](https://beforeword.xyz/model/)

beforeword — инструкции чтения для ИИ-приложений: сохранять исходную формулировку, отделять добавленное прочтением и применять ту же границу к самому ответу. Инструкция, это описание и критерии оценки также остаются написанными формами в этом охвате.

## Начать в чате

1. Открой [полную русскую инструкцию](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_RU.txt) или [полную английскую](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_EN.txt) и скопируй текст целиком.
2. Вставь его первым сообщением нового чата.
3. Отправь задачу. Например: `Примени beforeword к фразе «Я понимаю».`

Установка и ключ API не нужны. В каждом новом чате повтори эти шаги. Настройки приложения, навыки, обновление и отключение описаны в [руководстве по установке](docs/installation.ru.md).

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

[Инструменты для разработчиков · ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_toolkit_1.2.0.zip) · [Контрольные суммы](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/SHA256SUMS.txt) · [Состав файлов](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/manifest.json)

## API

Инструменты Python создают запросы для семи текстовых форматов API. Нужен Python 3.10 или новее; дополнительные пакеты не требуются.

Сохрани задачу в `input.txt` и выполни команду из корня репозитория, заменив обозначение модели на идентификатор, доступный в твоём аккаунте провайдера:

```sh
python3 scripts/build_payload.py openai \
  --model YOUR_MODEL_ID --language ru \
  --input-file input.txt --output request.json
```

Команда создаёт локальный `request.json`. Отправка запросов и извлечение ответов описаны в [руководстве API](references/api-use.ru.md), поддерживаемые форматы — в [метаданных провайдеров](references/api.json).

## Чтение и оценка

[Полное ядро](assets/core.ru.txt) · [Область действия](assets/scope.ru.txt) · [Методика и записи испытаний](references/evaluation.ru.md)
