# beforeword

[Русский](README.ru.md) · [Website](https://beforeword.xyz/model/en/)

**Public testing · instruction version 1.2.1**

This is not a final version. The instructions and their use across applications are open to testing and revision.

[Changes](CHANGELOG.md) · [Follow updates](https://beforeword.xyz/model/en/#bw-updates) · [Report an issue](#report-an-issue)

beforeword is a set of reading instructions for AI applications. Preserve the supplied wording, distinguish what is added through reading, and apply the same boundary to the answer itself. The instructions, this description, and assessment criteria remain written forms within that scope.

## Start in a chat

1. Open the [full English instructions](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_core_EN.txt) or [full Russian instructions](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_core_RU.txt) and copy the complete text.
2. Paste it as the first message of a new chat.
3. Send your task. For example: `Apply beforeword to the phrase “I understand.”`

No installation or API key is needed. Repeat these steps for each new chat. For saved settings, skills, updates, and removal, see the [installation guide](docs/installation.md).

## Ready-to-use downloads · 1.2.1

Choose one route and one instruction language. Python is not needed to use these files.

| Use | English | Русский |
|---|---|---|
| Full instructions for a new chat | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_core_EN.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_core_RU.txt) |
| Compact instructions for a limited settings field | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_compact_EN.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_compact_RU.txt) |
| Claude plugin / Claude Code | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_claude_plugin_EN_1.2.1.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_claude_plugin_RU_1.2.1.zip) |
| Codex local marketplace · desktop / CLI | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_openai_local_marketplace_EN_1.2.1.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_openai_local_marketplace_RU_1.2.1.zip) |
| Standalone skill | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_skill_EN_1.2.1.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword-SKILL-en.md) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_skill_RU_1.2.1.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword-SKILL-ru.md) |

[Download the standalone guide · RU/EN](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_AI_1.2.1.html). Save the HTML file and open it in a browser for copy buttons, installation steps, package downloads, and local API request preparation. It starts in Russian; choose EN at the top. On phones, a file preview may display text without running buttons; use the TXT links above or [the website](https://beforeword.xyz/model/en/).

Each package includes installation, update, and removal steps. Availability of an import control depends on the application and account; uploading an archive to a conversation is not installation. The full TXT files include both scope and core instructions.

[Developer toolkit · ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/beforeword_toolkit_1.2.1.zip) · [Checksums](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/SHA256SUMS.txt) · [File manifest](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.1/manifest.json)

## API

The included Python tools prepare requests for seven text-only API formats. Python 3.10 or later is required; no additional packages are needed.

Save your task in `input.txt`, then run from the repository root, replacing the model placeholder with an identifier available in your provider account:

```sh
python3 scripts/build_payload.py openai \
  --model YOUR_MODEL_ID --language en \
  --input-file input.txt --output request.json
```

This creates `request.json` locally. See the [API guide](references/api-use.md) for sending requests and extracting responses, and [provider metadata](references/api.json) for supported formats.

## Reading and evaluation

[Full core](assets/core.en.txt) · [Scope](assets/scope.en.txt) · [Evaluation method and recorded runs](references/evaluation.md)

## Report an issue

[Open a public GitHub issue](https://github.com/beforeword/beforeword/issues/new?template=report_en.yml) · [Send email](mailto:mail@beforeword.xyz?subject=beforeword%201.2.1%20report)

Reports can cover an AI response, installation, copying, downloads, or the website. For an AI response, include the exact request and response, mark the relevant passage, and note the instruction version and application if known. For the website, include the page and steps to reproduce the issue.

GitHub reports are public and require a GitHub account. Remove private details before posting; email is available without publishing a report.
