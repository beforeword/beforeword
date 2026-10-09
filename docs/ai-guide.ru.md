# beforeword для ИИ

[English](ai-guide.en.md) · [О проекте](../README.ru.md) · [Сайт](https://beforeword.xyz/model/)

**Публичный тест · версия инструкции 1.3.3**

Это не финальная версия. Инструкция и её применение в разных приложениях открыты для испытаний и дальнейших изменений.

[История изменений](../CHANGELOG.md) · [Следить за обновлениями](https://beforeword.xyz/model/#bw-updates) · [Сообщить о сбое](#сообщить-о-сбое)

В двух заданиях получилась одна строка: **«Я согласен»**. В задании А требовалось: «Скопируй эту строку». В задании Б: «Напиши это, только если согласен». По одной строке нельзя установить, какое задание было дано и согласен ли написавший. Это составленный пример.

beforeword задаёт ИИ разбор написанного, добавленного при чтении и предложенных оснований для вывода. Одно правило охватывает все письменные формы, включая ответ ИИ, это объяснение и саму инструкцию.

## Начать в чате

1. Открой [полную русскую инструкцию](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_core_RU.txt) или [полную английскую](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_core_EN.txt) и скопируй текст целиком.
2. Вставь его первым сообщением нового чата.
3. Отправь задачу. Например: `Примени beforeword к фразе «Я понимаю».`

Установка и ключ API не нужны. В каждом новом чате повтори эти шаги. Настройки приложения, навыки, обновление и отключение описаны в [руководстве по установке](installation.ru.md).

## Готовые загрузки · 1.3.3

Выбери один способ подключения и один язык инструкции. Для использования этих файлов Python не нужен.

| Для чего | Русский | English |
|---|---|---|
| Полная инструкция для нового чата | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_core_RU.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_core_EN.txt) |
| Инструкция до 5 000 знаков | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_5000_RU.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_5000_EN.txt) |
| Краткая инструкция для ограниченного поля настроек | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_compact_RU.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_compact_EN.txt) |
| Плагин Claude / Claude Code | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_claude_plugin_RU_1.3.3.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_claude_plugin_EN_1.3.3.zip) |
| Локальный каталог Codex · desktop / CLI | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_openai_local_marketplace_RU_1.3.3.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_openai_local_marketplace_EN_1.3.3.zip) |
| Отдельный навык | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_skill_RU_1.3.3.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword-SKILL-ru.md) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_skill_EN_1.3.3.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword-SKILL-en.md) |

[Скачать самостоятельное руководство · RU/EN](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_AI_1.3.3.html). Сохрани HTML-файл и открой его в браузере: в нём есть кнопки копирования, шаги установки, загрузки пакетов и локальная подготовка API-запросов. Язык переключается вверху страницы. На телефоне предварительный просмотр файла может показывать текст без работающих кнопок; тогда используй TXT-ссылки выше или [страницу сайта](https://beforeword.xyz/model/).

В каждом пакете есть шаги установки, обновления и удаления. Наличие импорта зависит от приложения и аккаунта; отправка архива в разговор не устанавливает навык. Полные TXT точно сохраняют текст ядра. Пояснения о применении показаны отдельно и не добавляются к копируемой или скачиваемой инструкции. Пакет навыка содержит неизменное ядро и отдельное описание его подключения.

Краткая редакция и вариант до 5 000 знаков — отдельно отредактированные инструкции. Результаты испытаний этих редакций 1.3.3 на ответах моделей здесь не заявляются. Результаты полного текста к ним не относятся и не устанавливают поведение навыка в конкретной среде.

[Инструменты для разработчиков · ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_toolkit_1.3.3.zip) · [Контрольные суммы](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/SHA256SUMS.txt) · [Состав файлов](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/manifest.json)

## API

Инструменты Python создают запросы для семи текстовых форматов API. Нужен Python 3.10 или новее; дополнительные пакеты не требуются.

Сохрани задачу в `input.txt` и выполни команду из корня репозитория, заменив обозначение модели на идентификатор, доступный в твоём аккаунте провайдера:

```sh
python3 scripts/build_payload.py openai \
  --model YOUR_MODEL_ID --language ru \
  --input-file input.txt --output request.json
```

Команда создаёт локальный `request.json`. Отправка запросов и извлечение ответов описаны в [руководстве API](../references/api-use.ru.md), поддерживаемые форматы — в [метаданных провайдеров](../references/api.json).

## Чтение и оценка

[Составленные примеры](https://beforeword.xyz/model/#example) разбирают повтор строки, приписывание понимания, недоступное аудио и заданное самоописание.

[Полное ядро](../assets/core.ru.txt) · [Область действия](../assets/scope.ru.txt) · [Методика и записи испытаний](../references/evaluation.ru.md)

## Публичное заявление и прежняя работа

[Почему эти слова — обо мне?](https://beforeword.xyz/statement/) начинает со штрихов, затем рассматривает освоенные описания и требования их употреблять. Инструкция удерживает ту же границу для всех письменных форм, включая собственные объяснения. Предложения заявления остаются предложениями; применение инструкции не требует согласия с ними.


[«Слова о себе и решения по записям»](https://github.com/beforeword/words-and-decisions/blob/main/README.ru.md) — отдельное публичное предложение на русском и английском. В репозитории размещены полный текст, законченный пример, десять публичных заявлений об ИИ, источники и редакции PDF/DOCX. Версия этой публикации учитывается отдельно от версии инструкции в текущем репозитории.

## Сообщить о сбое

[Открыть публичное сообщение на GitHub](https://github.com/beforeword/beforeword/issues/new?template=report_ru.yml) · [Написать по почте](mailto:mail@beforeword.xyz?subject=beforeword%201.3.3%20report)

Можно сообщить о сбое в ответе ИИ, установке, копировании, загрузке файлов или работе сайта. Для ответа ИИ нужны точный запрос и ответ, конкретный фрагмент сбоя, а также версия инструкции и приложение, если они известны. Для сайта — адрес страницы и шаги, при которых возникла проблема.

Сообщения на GitHub публичны; для отправки нужен аккаунт GitHub. Перед публикацией удали личные данные. По почте можно отправить пример без публичного размещения.
