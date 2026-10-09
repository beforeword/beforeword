# Install, update, and stop beforeword

[Русский](installation.ru.md) · [Back to the AI guide](ai-guide.en.md)

## A single chat

For a limit of 5,000 characters, use the [English](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_5000_EN.txt) or [Russian](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_5000_RU.txt) edition. Each includes its scope. Choose one edition that fits the intended field; do not combine them.

Copy the complete [English instructions](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_core_EN.txt) or [Russian instructions](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_core_RU.txt), paste them into a new chat, and send your task next. No package installation is needed. Each full TXT contains the exact core, including its activation scope; do not prepend another scope paragraph. Specify the response language in your request when needed. Compact editions are for saved settings fields that cannot fit the full text. The compact and 5,000-character texts are separately edited editions. No model-response evaluation is reported here for those 1.3.3 editions; full-core results do not apply to them.

Try `Apply beforeword to the phrase “I understand.”` A useful check is whether the answer preserves the phrase, separates an attributed reading, and includes a relevant distinction introduced by the explanation itself. Repeating the name beforeword is insufficient. Code-only, JSON-only, and exact-copy tasks should retain their requested format without an added preface.

An instruction pasted into a chat applies within the available context. Repeat it in a new chat. To stop the requested mode, send `Stop beforeword for subsequent replies.` Starting a new chat avoids carrying the earlier instruction in that conversation's history; saved application instructions or installed skills require their own controls.

Asking a chat to “install beforeword” does not itself change account settings. Check the saved text in the selected instruction field; a memory preference does not replace the full instructions. A “done” message does not establish that later responses will follow the rules.

## Application settings

Choose an application in the [HTML guide](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.3.3/beforeword_AI_1.3.3.html) and follow its installation steps. Copy one edition into the appropriate instruction field and save. Preserve any existing personal instructions before changing them. If the text does not fit, use the compact edition. If the setting is absent, use the chat route.

To update, replace the old beforeword text in the same field with the new edition, save, and start a new chat. To remove it, delete only the beforeword text from that field and save. A conversational request to stop does not erase the saved setting.

## Skills and plugins

The guide offers three different archive structures. They are alternatives for different hosts:

| Archive | Installation route | Update or stop |
| --- | --- | --- |
| `beforeword_openai_local_marketplace_EN_1.3.3.zip` | Extract the whole local project, retain `.agents`, and open the project in a supported Codex environment. Follow its included README. | Replace the source plugin and refresh the local source. Disable or remove the installed copy through the host; deleting the source folder alone may leave a cached copy. |
| `beforeword_claude_plugin_EN_1.3.3.zip` | Use the supported plugin upload UI, or extract for Claude Code and load with `claude --plugin-dir ./beforeword`. Follow its included README. | Replace the uploaded or local edition and start a new session. For temporary CLI loading, restart without `--plugin-dir`; installed copies use the host's disable/remove controls. |
| `beforeword_skill_EN_1.3.3.zip` | Use a supported skill import or creation screen, following the archive README. Gemini and Mistral Vibe Work have different routes. | Edit or replace the existing skill with the new text using the available controls, preserve your changes first, and start a new task. Disable or remove it in the Skills screen. |

RU archives use `_RU_` in the corresponding names. Install one language edition at a time: the shared skill/plugin name is not intended for parallel copies. Instruction language does not force the output language; specify the language of your request when needed.

Where an application provides no edit/replace control, use its remove and create/import controls to replace the old skill. Confirm the displayed text after replacement. A ZIP attached to an ordinary chat is not the same operation as importing a skill. Available import controls depend on the application and account.

## API

The [API guide](../references/api-use.md) covers local JSON preparation and a separate deliberate send. Supply the instruction again with every request. Stop including it to end this API route; existing conversation history may still contain previous text. Keep provider-native tool, reasoning, audio, and image histories in their original formats rather than treating this text-only adapter as a lossless conversion.

## When the result differs from the instruction

Keep the exact input and output, application/model label, instruction version or hash, and the route used. Remove private material before sharing a reproduction. An unavailable setting, a failed import, a changed input string, and an answer that omits self-application are different observations. The [evaluation procedure](../references/evaluation.md) describes how to record them without treating installation or a score as a guarantee.
