# beforeword

[Русский](README.ru.md) · [Website](https://beforeword.xyz/model/en/)

beforeword is a set of reading instructions for AI applications. It asks for the supplied wording to be preserved, the reading added to it to be made visible, and the same boundary to include the answer itself. The instructions, this description, and the criteria used to assess an answer are also written forms within that scope.

## Start in a chat

1. Open the [full English instructions](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_EN.txt) or [full Russian instructions](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_RU.txt) and copy the complete file.
2. Paste it as the first message of a new chat in your AI application.
3. Send your task. For example: `Apply beforeword to the phrase “I understand.”`

No download, API key, or developer account is needed for this route. The instructions are supplied to that chat; repeat the first step in another chat and specify your preferred response language when needed. Application settings and skills offer more persistent routes where supported; their availability depends on the application and account. Use a compact edition only when a saved setting has a limited field. To stop using instructions sent only as a message, start a new conversation without them. Remove saved app or project instructions first, or disable an installed skill through the app’s skill or plugin controls. Messages already sent remain in the previous conversation.

Use one installation route. [The installation guide](docs/installation.md) explains settings, skills, updates, and removal. The downloadable guide below offers app-specific steps, copy buttons, and separate RU/EN downloads.

## Ready-to-use downloads · 1.2.0

Choose one route and one instruction language. Python is not needed to use these files.

| Use | English | Русский |
|---|---|---|
| Full instructions for a new chat | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_EN.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_core_RU.txt) |
| Compact instructions for a limited settings field | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_compact_EN.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_compact_RU.txt) |
| Claude plugin / Claude Code | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_claude_plugin_EN_1.2.0.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_claude_plugin_RU_1.2.0.zip) |
| Codex local marketplace · desktop / CLI | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_openai_local_marketplace_EN_1.2.0.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_openai_local_marketplace_RU_1.2.0.zip) |
| Standalone skill | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_skill_EN_1.2.0.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword-SKILL-en.md) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_skill_RU_1.2.0.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword-SKILL-ru.md) |

[Download the standalone guide · RU/EN](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_AI_1.2.0.html). Save the HTML file and open it in a browser for copy buttons, installation steps, package downloads, and local API request preparation. It starts in Russian; choose EN at the top. On phones, a file preview may display text without running buttons; use the TXT links above or [the website](https://beforeword.xyz/model/en/).

Each package includes installation, update, and removal steps. Availability of an import control depends on the application and account; uploading an archive to a conversation is not installation. The full TXT files include both scope and core instructions.

[Developer toolkit · ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/beforeword_toolkit_1.2.0.zip) · [Checksums](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/SHA256SUMS.txt) · [File sizes and build-input hashes](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.2.0/manifest.json)

## What is included

- One full core in [English](assets/core.en.txt) and [Russian](assets/core.ru.txt), with separate scope instructions; compact editions fit restricted settings fields.
- Optional local-marketplace and plugin exports for supported Codex and Claude environments, plus standalone skill exports.
- Local tools for seven text-only API request and response formats.
- Reproducible guide and website builds, offline checks, and historical evaluation records.

## For developers

Use Python 3.10 or later. Node.js 18 or later is needed only for the local JavaScript checks; CI uses Python 3.12 and Node.js 22. The Python tools use the standard library. Run these commands from the repository root:

```sh
python3 scripts/build_guide.py --output build/toolkit
python3 scripts/package_plugins.py --language en --output build/packages
python3 scripts/package_plugins.py --language ru --output build/packages
python3 scripts/build_public.py --output build/site --github-url https://github.com/beforeword/beforeword
```

The standalone guide is `build/toolkit/beforeword_AI.html`. The site files are under `build/site/public_html/`; packaging does not deploy them. Each plugin ZIP includes its own installation, invocation, update, and removal instructions. Install one language edition at a time.

To prepare a local API request, use Bash and replace the model placeholder with an identifier available in your provider account. Run from the repository root; a fresh work directory makes the example repeatable:

```bash
BEFOREWORD_DIR="$(pwd)"
BEFOREWORD_WORK="$(mktemp -d)"
BEFOREWORD_MODEL='REPLACE_WITH_YOUR_AVAILABLE_MODEL_ID'
cd "$BEFOREWORD_WORK"
printf '%s\n' 'Apply beforeword to the phrase “I understand.”' > input.txt
python3 "$BEFOREWORD_DIR/scripts/build_payload.py" openai \
  --model "$BEFOREWORD_MODEL" --language en \
  --input-file input.txt --output request.json
```

This command writes JSON locally. It does not send it, read an API key, or confirm that the selected model is available. [API usage](references/api-use.md) covers deliberate sending, saved responses, errors, and text history. [Provider metadata](references/api.json) contains endpoint and header placeholders. Keep credentials and private conversations out of the repository and shared output files.

## Checks and evidence

If you extracted the source toolkit ZIP, first run `python3 -B scripts/build_downloads.py`: that archive excludes generated downloads. A repository checkout already contains `downloads/`.

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

These checks need no provider accounts or API keys. They examine local formats, exact text, package contents, generated links, and simulated interface behavior. They do not exercise real app installation or replace browser visual testing.

The [evaluation notes](references/evaluation.md) separate runs by instruction revision. The saved 180-response comparison uses earlier instruction hashes; it is not a behavioral test of release 1.2.0 and is not a ranking of models. Full and compact conditions also differed in instruction language. Neither a test score nor the presence of the word beforeword in an answer establishes the scope or quality of future answers.

## Release and reuse

[Maintainer instructions](docs/maintaining.md) cover local release preparation and review. The owner's choice of licensing and distribution terms remains open; no license is assigned by this repository. Do not describe this package as licensed for unrestricted redistribution until that choice is recorded.

## Integrate with an existing website

Extract a current website archive into a separate directory. These commands prepare and verify an upload patch without editing that source. The output directory must be new and outside this repository:

```sh
python3 scripts/prepare_site_release.py --site /ABS/CURRENT_SITE --output /ABS/NEW_RELEASE
python3 scripts/verify_site_release.py --site /ABS/CURRENT_SITE --release /ABS/NEW_RELEASE
```

The output `public_html/` contains only files to add or replace. `site-patch.json` records source and output hashes. Upload its contents into the existing website root after backing it up; no existing files need deletion. Only the instruction block changes in either homepage, and the sitemap dates of the four changed pages are updated. The previous AI section remains available as a separate historical snapshot. Standalone `build_public.py` creates only the `/model/` section.
