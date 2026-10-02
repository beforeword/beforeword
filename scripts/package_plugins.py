#!/usr/bin/env python3
"""Build explicit portable exports of the existing beforeword skill.

No network, installation, environment mutation, or output files on import.
build_bundles(language) returns in-memory archives and their text files.
Writing archives requires an explicit --output directory on the command line.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_VERSION = "1.2.3"
LANGUAGES = ("ru", "en")
PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
OPENAI_DOCS = "https://developers.openai.com/plugins/build/plugins"
CLAUDE_DOCS = "https://claude.com/docs/plugins/build"
GEMINI_DOCS = "https://support.google.com/gemini/answer/17094296?hl=en"
MISTRAL_DOCS = "https://docs.mistral.ai/vibe/work/skills"

DESCRIPTIONS = {
    "ru": "Сохранять исходную запись и отличать её письменную форму от добавленных прочтений и утверждений. Применять по явному запросу beforeword или для разбора этой границы в тексте либо ответе.",
    "en": "Preserve supplied wording and distinguish its written form from added readings and claims. Use for explicit beforeword requests or requests to inspect this boundary in a text or response.",
}
SCOPES = {
    "ru": "Применяй beforeword к запрошенной задаче. Установка делает навык доступным; это не настройка всего аккаунта. Продолжай режим между сообщениями только по запросу и пока эти инструкции доступны. Соблюдай иерархию инструкций среды, явно заданные пользователем область действия, язык и формат ответа.",
    "en": "Apply beforeword to the requested task. Installation makes this skill available; it is not an account-wide setting. Continue the mode across turns only when requested and while these instructions remain available. Follow the host's instruction hierarchy and the user's explicit scope, language, and output format.",
}


def skill_text(language: str, name: str = "beforeword") -> str:
    """Return SKILL.md containing the selected language's exact core."""
    if language not in LANGUAGES:
        raise ValueError("language must be 'ru' or 'en'")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
        raise ValueError("skill name must use lowercase letters, digits and hyphens")
    core = (ROOT / "assets" / f"core.{language}.txt").read_text(encoding="utf-8")
    description = json.dumps(DESCRIPTIONS[language], ensure_ascii=False)
    return (
        f"---\nname: {name}\ndescription: {description}\n---\n\n"
        f"# beforeword\n\n{SCOPES[language]}\n\n{core.rstrip()}\n"
    )


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def _zip(files: dict[str, str]) -> bytes:
    """Produce deterministic UTF-8 ZIP contents without extraction."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path, content in sorted(files.items()):
            info = zipfile.ZipInfo(path, (2026, 10, 2, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, content.encode("utf-8"))
    return buffer.getvalue()


def _common_readme(language: str, version: str) -> str:
    return f"""# beforeword · {version}

RU

Язык инструкции в этом архиве: {language.upper()}. Установи одну языковую редакцию; одинаковое имя не предназначено для двух параллельных установок. Язык ответа можно задать в запросе.

Навык сохраняет исходный текст, отделяет добавленное прочтением и применяет ту же границу к собственному ответу. Он вызывается для задачи и не меняет все разговоры аккаунта. Для более широкого действия задавай область явно: «Применяй beforeword в этом разговоре». Для разового разбора: «Примени beforeword к фразе „Я понимаю“». Просьба «Отключи режим beforeword для следующих ответов» меняет запрос; доступность установленного навыка регулируется настройками приложения.

После подключения начни новый разговор и выполни пример. Сохрани ввод и ответ: наличие названия beforeword само по себе не показывает качество разбора. При проблеме запиши приложение, его версию, способ установки и полный текст ошибки. Пакет содержит только инструкции и файлы настройки, без сервера, ключей, фоновых действий и телеметрии.

EN

Instruction language in this archive: {language.upper()}. Install one language edition; the shared name is not intended for two parallel installations. Request any response language explicitly.

The skill preserves the supplied text, separates added readings, and applies the same boundary to its own response. It is invoked for a task and does not change every conversation in an account. To request broader scope, say “Apply beforeword in this conversation.” For one task: “Apply beforeword to the phrase ‘I understand.’” The request “Turn off beforeword mode for subsequent replies” changes the requested scope; application settings control whether the installed skill remains available.

After setup, start a new conversation and try the example. Keep the input and output: the name beforeword appearing in a response does not establish the quality of its analysis. For troubleshooting, record the app, version, installation method, and complete error. The package contains only instructions and configuration files, with no server, keys, background actions, or telemetry.
"""


def _openai_readme(language: str, version: str) -> str:
    return _common_readme(language, version) + f"""
## ChatGPT desktop / Codex: локальный каталог / local marketplace

RU

Это ZIP локального проекта, а не ZIP для загрузки в публичный каталог. Распакуй всё содержимое в отдельную рабочую папку. В её корне должны находиться `.agents/plugins/marketplace.json` и `plugins/beforeword/plugin.json`; сохраняй скрытую папку `.agents`. `source.path` в каталоге задан относительно этой рабочей папки.

Открой эту папку как локальный проект в поддерживающей локальные каталоги среде ChatGPT desktop / Codex. Обнови или повторно открой список Plugins; найди beforeword в источнике `beforeword-local` и установи/включи его доступными в приложении элементами управления. Если источник не появился, используй приведённую ниже процедуру для своего desktop/CLI, а не загрузку ZIP в обычное сообщение. Web/mobile этот локальный путь установки не предоставляет; для них используй текстовую инструкцию в настройках или чате.

Для обновления замени `plugins/beforeword/` новой редакцией и обнови локальный источник средствами среды. Для отключения используй переключатель плагина. Удаление исходной папки не означает удаления установленной копии: приложение может хранить её в своём кэше. Управляй установленной копией через Plugins. Этот архив не изменяет личный каталог или конфигурацию пользователя автоматически.

EN

This ZIP is a local project, not a public-directory upload. Extract its entire contents into a separate working folder. Keep `.agents/plugins/marketplace.json` and `plugins/beforeword/plugin.json` at the shown locations, including the hidden `.agents` folder. The catalog's `source.path` is relative to that working folder.

Open the folder as a local project in a ChatGPT desktop / Codex environment supporting local marketplaces. Refresh or reopen Plugins, find beforeword under `beforeword-local`, and install/enable it using the available controls. If the source is missing, follow the linked procedure for your desktop/CLI instead of uploading the ZIP in an ordinary message. Web/mobile does not provide this local installation route; use the text instructions in settings or a chat there.

To update, replace `plugins/beforeword/` with the new edition and refresh the local source through the host. Use the plugin's toggle to disable it. Removing the source folder does not remove an installed cached copy; manage that copy through Plugins. This archive does not automatically modify your personal marketplace or configuration.

Package and local-marketplace documentation: {OPENAI_DOCS}
"""


def _claude_readme(language: str, version: str) -> str:
    return _common_readme(language, version) + f"""
## Claude / Cowork / Claude Code

RU

Claude и Cowork: `Customize → Plugins → Add → Upload plugin`, затем выбери этот ZIP. Манифест находится в `.claude-plugin/plugin.json` у корня архива. Не загружай вместо него ZIP локального каталога OpenAI. Доступность загрузки может зависеть от аккаунта и настроек организации.

Claude Code: распакуй архив в папку `beforeword`; из её родительской папки проверь структуру командой `claude plugin validate ./beforeword` и запусти новую сессию: `claude --plugin-dir ./beforeword`. Явный вызов в Code: `/beforeword:read`. В чате можно попросить применить beforeword по имени.

Для окончания временной сессии Code выйди из неё и начни следующую без `--plugin-dir`. Для установленного через интерфейс плагина используй его элементы отключения/удаления в Customize → Plugins. Перед обновлением сохрани свои изменения, замени архив или локальную папку новой редакцией и используй новую сессию; не держи две языковые копии с одинаковым именем.

EN

Claude and Cowork: choose `Customize → Plugins → Add → Upload plugin` and select this ZIP. Its manifest is at `.claude-plugin/plugin.json` from the archive root. Do not upload the OpenAI local-marketplace ZIP in its place. Account or organization settings may affect upload availability.

Claude Code: extract the archive into `beforeword`; from its parent folder, check the structure with `claude plugin validate ./beforeword`, then start a new session with `claude --plugin-dir ./beforeword`. Explicit Code invocation: `/beforeword:read`. In chat, request beforeword by name.

To end temporary Code loading, exit that session and start the next one without `--plugin-dir`. For an interface-installed plugin, use its disable/remove controls in Customize → Plugins. Before updating, retain your edits, replace the archive or local folder with the new edition, and use a new session; do not maintain two language copies under the same name.

Plugin packaging and loading: {CLAUDE_DOCS}
"""


def _skill_readme(language: str, version: str) -> str:
    return _common_readme(language, version) + f"""
## Gemini / Mistral Vibe Work

RU

Gemini: если раздел доступен, открой Settings → Skills → Upload, выбери этот ZIP или извлечённый `SKILL.md`, просмотри поля и нажми Create. В архиве `SKILL.md` находится в корне. Для обновления в веб-версии открой Settings → Skills, выбери beforeword, затем More → Replace skill, загрузи новый пакет и сохрани. Для ручного изменения отредактируй Description и Instructions. Включение и удаление навыка выполняются на странице Skills; сообщение в разговоре не заменяет управление установленным навыком.

Mistral Vibe Work: Context → Skills → New Skill. Перенеси `name` из верхнего блока SKILL.md в Title, `description` — в Description, а текст после закрывающего `---` — в поле SKILL.md. Сохрани и включи навык. Этот путь использует форму создания, а не обещает ZIP-импорт. Начни новую задачу и попроси применить beforeword; для отключения используй переключатель на странице Skills. Для обновления открой beforeword в Context → Skills, замени Description и текст SKILL.md, сохрани и начни новый чат; действующие чаты сохраняют прежнюю инструкцию.

EN

Gemini: where Skills is available, open Settings → Skills → Upload, select this ZIP or the extracted `SKILL.md`, review the fields, and choose Create. `SKILL.md` is at the archive root. To update on the web, open Settings → Skills, select beforeword, choose More → Replace skill, upload the new package and save. For manual changes, edit Description and Instructions. Enablement and deletion are managed on the Skills page; a conversational request does not replace installed-skill controls.

Mistral Vibe Work: Context → Skills → New Skill. Transfer `name` from the SKILL.md header to Title, `description` to Description, and the text after the closing `---` to the SKILL.md field. Save and enable the skill. This uses the creation form and does not promise ZIP import. Start a new task and request beforeword; use the Skills-page toggle to disable it. To update, open beforeword under Context → Skills, replace Description and SKILL.md, save and start a new chat; active chats retain the previous instructions.

Gemini: {GEMINI_DOCS}
Mistral Vibe Work: {MISTRAL_DOCS}
"""


def build_bundles(language: str, *, version: str = DEFAULT_VERSION) -> dict[str, dict]:
    """Return openai, claude, skill bundles with bytes and file metadata.

    Each entry has name, language, version, bytes, sha256, files (list),
    and file_contents (mapping of archive paths to their UTF-8 text).
    The OpenAI archive is a complete local-marketplace project.
    """
    if language not in LANGUAGES:
        raise ValueError("language must be 'ru' or 'en'")
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("version must be a numeric MAJOR.MINOR.PATCH value")
    identity = {
        "name": "beforeword",
        "version": version,
        "description": DESCRIPTIONS[language],
    }
    marketplace = {
        "name": "beforeword-local",
        "plugins": [{
            "name": "beforeword",
            "source": {"source": "local", "path": "./plugins/beforeword"},
            "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
            "category": "Productivity",
        }],
    }
    contents = {
        "openai": {
            ".agents/plugins/marketplace.json": _json(marketplace),
            "plugins/beforeword/plugin.json": _json({"$schema": PLUGIN_SCHEMA, **identity}),
            "plugins/beforeword/skills/read/SKILL.md": skill_text(language, "read"),
            "README.md": _openai_readme(language, version),
        },
        "claude": {
            ".claude-plugin/plugin.json": _json(identity),
            "skills/read/SKILL.md": skill_text(language, "read"),
            "README.md": _claude_readme(language, version),
        },
        "skill": {
            "SKILL.md": skill_text(language),
            "README.md": _skill_readme(language, version),
        },
    }
    result = {}
    for provider, files in contents.items():
        raw = _zip(files)
        kind = "openai_local_marketplace" if provider == "openai" else f"{provider}_plugin" if provider == "claude" else "skill"
        result[provider] = {
            "name": f"beforeword_{kind}_{language.upper()}_{version}.zip",
            "language": language,
            "version": version,
            "bytes": raw,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "files": sorted(files),
            "file_contents": files,
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--language", choices=LANGUAGES, default="en")
    parser.add_argument("--version", default=DEFAULT_VERSION)
    parser.add_argument("--output", type=Path, required=True, help="Explicit directory for exported ZIP files")
    args = parser.parse_args()
    bundles = build_bundles(args.language, version=args.version)
    args.output.mkdir(parents=True, exist_ok=True)
    for bundle in bundles.values():
        target = args.output / bundle["name"]
        target.write_bytes(bundle["bytes"])
        print(f"{target}\t{bundle['sha256']}")


if __name__ == "__main__":
    main()
