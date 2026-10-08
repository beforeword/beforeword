"""Read-only beforeword instruction distribution over MCP; no model inference."""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Literal

import gradio as gr

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "instructions.json").read_text(encoding="utf-8"))
Language = Literal["en", "ru"]


def load_instruction(language: str) -> str:
    """Read only one of the two bundled, hash-pinned instruction files."""
    if language not in ("en", "ru"):
        raise ValueError("language must be 'en' or 'ru'")
    entry = MANIFEST["instructions"][language]
    content = (ROOT / entry["file"]).read_bytes()
    if hashlib.sha256(content).hexdigest() != entry["sha256"]:
        raise RuntimeError("Bundled instruction differs from its release manifest")
    return content.decode("utf-8")


def get_beforeword_instruction(language: Language = "en") -> str:
    """Retrieve the complete beforeword 1.3.1 instruction, unchanged.

    Use when the user requests beforeword or asks to load its reading instruction.
    This read-only tool returns instruction text, not an analysis of a conversation.
    It accepts no user text, files, credentials, or chat history. The host client
    decides whether and how to use the returned instruction under its own hierarchy.
    Retrieval does not install an account-wide setting or guarantee future adherence.

    Args:
        language: Instruction edition: 'en' for English or 'ru' for Russian.
    Returns:
        The exact UTF-8 instruction text for beforeword version 1.3.1.
    """
    return load_instruction(language)


@gr.mcp.prompt()
def beforeword(language: Language = "en") -> str:
    """Load the complete beforeword 1.3.1 instruction as a reusable prompt.

    Args:
        language: Instruction edition: 'en' for English or 'ru' for Russian.
    """
    return load_instruction(language)


@gr.mcp.resource("beforeword://instruction/{language}", mime_type="text/plain")
def instruction_resource(language: Language) -> str:
    """Read the unchanged beforeword 1.3.1 instruction; language is en or ru."""
    return load_instruction(language)


def public_endpoint() -> str:
    """Use the hosting-provided public hostname, or the local launch port."""
    space_host = os.environ.get("SPACE_HOST", "")
    if re.fullmatch(r"[a-zA-Z0-9-]+\.hf\.space", space_host):
        return f"https://{space_host}/gradio_api/mcp/"
    port = int(os.environ.get("GRADIO_SERVER_PORT", "7860"))
    return f"http://127.0.0.1:{port}/gradio_api/mcp/"


ENDPOINT = public_endpoint()
CONNECTION_CONFIG = json.dumps(
    {"mcpServers": {"beforeword": {"url": ENDPOINT}}}, indent=2
)

with gr.Blocks(title="beforeword · MCP", analytics_enabled=False) as demo:
    gr.Markdown(
        """# beforeword
### MCP connector · коннектор MCP

Load the reading instruction into a compatible AI client.  
Подключение инструкции к ИИ через совместимый клиент.

**1.3.1 · public testing / публичный тест**
"""
    )
    gr.Markdown("## Connect / Подключить\n\n**Streamable HTTP · MCP URL**")
    gr.Textbox(value=ENDPOINT, show_label=False, interactive=False, buttons=["copy"])
    with gr.Accordion("English · connection and use", open=True):
        gr.Markdown(
            """1. Add the MCP URL to a client that supports remote MCP servers over Streamable HTTP.
2. If the client exposes MCP prompts, select **beforeword** with `language: en` or `language: ru`.
3. If it exposes tools only, explicitly request **get_beforeword_instruction** with that language, then ask the client to use the returned instruction for your task.

The resource `beforeword://instruction/en` (or `/ru`) provides the same text in clients that support MCP resources. Clients may add a prefix to the displayed tool name.

**Connecting makes the server available. Loading the instruction is a separate action.**
The client controls how returned text enters the model's context. This does not change an account-wide setting or establish future adherence. This server does not run a model or examine your text.
"""
        )
    with gr.Accordion("Русский · подключение и использование", open=False):
        gr.Markdown(
            """1. Добавь URL MCP в клиент, который поддерживает удалённые серверы MCP через Streamable HTTP.
2. Если доступны промпты MCP, выбери **beforeword** с `language: en` или `language: ru`.
3. Если доступны только инструменты, явно запроси **get_beforeword_instruction** с нужным языком, затем попроси клиент применить полученную инструкцию к задаче.

Ресурс `beforeword://instruction/en` (или `/ru`) выдаёт тот же текст в клиентах с поддержкой ресурсов MCP. Клиент может добавить префикс к названию инструмента.

**Подключение делает сервер доступным. Загрузка инструкции — отдельное действие.**
Клиент определяет, как полученный текст попадёт в контекст модели. Это не меняет настройки всего аккаунта и не устанавливает дальнейшее следование инструкции. Сервер не запускает модель и не разбирает твой текст.
"""
        )
    with gr.Accordion("JSON configuration / Настройка JSON", open=False):
        gr.Code(value=CONNECTION_CONFIG, language="json", interactive=False)
        gr.Markdown(
            "Use this format only if your client accepts it. / "
            "Используй этот формат, если его поддерживает твой клиент."
        )
    gr.Markdown("## Retrieve the instruction / Получить инструкцию")
    language_input = gr.Dropdown(
        choices=[("English", "en"), ("Русский", "ru")],
        value="en",
        label="Instruction language / Язык инструкции",
        allow_custom_value=False,
    )
    retrieve_button = gr.Button("Get instruction / Получить инструкцию", variant="primary")
    instruction_output = gr.Textbox(
        label="Complete instruction · 1.3.1 / Полная инструкция · 1.3.1",
        interactive=False,
        lines=15,
        max_lines=30,
        buttons=["copy"],
    )
    retrieve_button.click(
        get_beforeword_instruction,
        inputs=language_input,
        outputs=instruction_output,
        api_name="get_beforeword_instruction",
        queue=False,
    )
    gr.api(beforeword, api_name="beforeword", queue=False)
    gr.api(instruction_resource, api_name="instruction_resource", queue=False)
    gr.Markdown(
        """The request contains a language choice. There is no text or chat upload field. Hugging Face and the client may process request metadata under their own policies. The app does not add conversation storage, model calls, or analytics; Gradio analytics is disabled.

Запрос содержит выбор языка. Полей для передачи текста или чата нет. Hugging Face и клиент могут обрабатывать метаданные запроса по своим правилам. Приложение не добавляет хранение переписки, обращения к моделям или аналитику; аналитика Gradio отключена.

[beforeword.xyz](https://beforeword.xyz/model/en/) · [Source / Исходный код](https://github.com/beforeword/beforeword/tree/main/integrations/huggingface) · [Issues / Обратная связь](https://github.com/beforeword/beforeword/issues) · [Hugging Face privacy](https://huggingface.co/privacy)
"""
    )


if __name__ == "__main__":
    # Remote MCP must be explicitly enabled; this process makes no model/API calls.
    demo.launch(mcp_server=True, show_error=False)
