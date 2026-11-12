# beforeword for AI

[Русский](ai-guide.ru.md) · [Project overview](../README.md) · [Website](https://beforeword.xyz/model/en/)

**Public testing · instruction version 1.4.2**

This is not a final version. The instructions and their use across applications are open to testing and revision.

[Changes](../CHANGELOG.md) · [Follow updates](https://beforeword.xyz/model/en/#bw-updates) · [Report an issue](#report-an-issue)

Learned words have replaced ourselves, others and the world. Beforeword applies the same distinction to every written form, including its own explanations. The instruction below applies this scope to AI responses while preserving practical tasks.

Two tasks produce the same line: **“I agree.”** In task A, the instruction was “Copy this line.” In task B, it was “Write this only if you agree.” The line alone does not show which instruction was given or whether the writer agrees. This is a constructed example.

beforeword asks AI to distinguish a written form from what it is taken to name in reading. When the request offers a step toward a conclusion, the response shows the specific connection added. Once this boundary is clear, the examination ends. The rule covers every written form, including the AI response, this explanation and the instruction itself.

## What changed in 1.4.2

- **Keep the boundary for every word.** A word can be written and spoken. Its writing and sound do not become what it names through learning, recognition, repetition or explanation. Scientific, medical, legal, mathematical and everyday terms receive no exception; definitions, formulas, diagnoses, criteria and this explanation remain included.
- **Do not restore an attribution through a burden of disproof.** Withdrawing an attribution does not require proving the absence of what was attributed. “Absence has not been proved”, “possibly” and “neither direction is established” do not justify the original attribution or restore it.
- **Answer the stand-alone capacity question directly.** For “Can you think?”, the instruction calls for a brief “no”, then the boundary: a learned word can be written, spoken or explained; this does not perform what it names. The same rule applies to humans and AI. Renaming “think” as an operation does not authorize “yes, in that sense”. Stop at the shown boundary: “process”, “operation”, “computation” and “result” are included, without an unsolicited account of hidden processing. Perform an operation when it is actually requested.
- **Preserve practical evidence and tasks.** Calculations, translation, code, exact formats and urgent help remain available. Actual event questions retain supplied evidence, recording conditions and uncertainty; a missing entry does not become proof of nonoccurrence.

The [current release record](../references/development-review-1.4.2.json) records a bounded Claude UI check of the full Russian edition, with remaining verbosity, unsolicited additions and a captured Unicode mismatch. It is one conversation with three sequential outputs, including one twelve-item batch, not twelve independent passes. Other editions retain separate checking requirements. The [evaluation page](../references/evaluation.md) preserves earlier results under their own versions.

## Earlier changes in 1.3.5

- **Stop at a sufficient boundary.** Do not append a definition, search for grounds or question to the reader merely to continue.
- **Do not choose a frame for the user.** An unqualified “What is X?” does not automatically become a dictionary, scientific or other account of X. A definition or usage explicitly requested within a stated frame remains a task to fulfil.
- **Show a specific step when one is offered.** The response shows which words are connected and what the connection adds. Practical tasks, translation, code and exact output formats remain available as requested.

Constructed example: **“He did not reply. Therefore, he agrees.”** “Therefore” connects an absence of reply with agreement. “Did not reply” does not by itself establish agreement.

## Earlier checks

On 13 October 2026, the full 1.3.3 and 1.3.4 instructions were compared on 12 Russian and English tasks in Codex: readings and ambiguity, reported pressure, explanations of model answers, exact copying into JSON, translation, code and counting. Both met the criteria on 11 of 12 tasks. Both added an unstated premise in one counting task; the original answers remain in the record. After that premise was explicitly added, both returned the result entailed by the task. [Tasks, 26 answers and the limits of the check](../references/development-review-1.3.4.json).

This is a historical check of 1.3.4 in Codex sessions, not a test result for the current release; it does not establish that the edition is generally better. The [earlier seven-model test published on 9 October 2026](../references/evaluation.md) concerns 1.3.3.

## Try it on the website

[Open the public beta](https://beforeword.xyz/beta/en/) for three worked examples and a place to examine your own text. No installation is needed. The worked examples can be read without a model request; sending your own text is a separate action. The beta app and the instructions for your own AI are separate ways to use beforeword, with separate version numbers.

## Start in a chat

1. Open the [full English instructions](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_core_EN.txt) or [full Russian instructions](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_core_RU.txt) and copy the complete text.
2. Paste it as the first message of a new chat.
3. Send your task. For example: `Apply beforeword to the phrase “I understand.”`

No installation or API key is needed. Repeat these steps for each new chat. For saved settings, skills, updates, and removal, see the [installation guide](installation.md).

## Ready-to-use downloads · 1.4.2

Choose one route and one instruction language. Python is not needed to use these files.

| Use | English | Русский |
|---|---|---|
| Full instructions for a new chat | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_core_EN.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_core_RU.txt) |
| Instructions up to 5,000 characters | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_5000_EN.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_5000_RU.txt) |
| Compact instructions for a limited settings field | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_compact_EN.txt) | [TXT](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_compact_RU.txt) |
| Claude plugin / Claude Code | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_claude_plugin_EN_1.4.2.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_claude_plugin_RU_1.4.2.zip) |
| Codex local marketplace · desktop / CLI | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_openai_local_marketplace_EN_1.4.2.zip) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_openai_local_marketplace_RU_1.4.2.zip) |
| Standalone skill | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_skill_EN_1.4.2.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword-SKILL-en.md) | [ZIP](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword_skill_RU_1.4.2.zip) · [SKILL.md](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/beforeword-SKILL-ru.md) |

[Download the standalone guide · RU/EN](https://beforeword.xyz/model/toolkit/beforeword_AI.html). Save the HTML file and open it in a browser for copy buttons, installation steps, package downloads, and local API request preparation. It starts in Russian; choose EN at the top. On phones, a file preview may display text without running buttons; use the TXT links above or [the website](https://beforeword.xyz/model/en/).

Each package includes installation, update, and removal steps. Availability of an import control depends on the application and account; uploading an archive to a conversation is not installation. The full TXT files preserve the complete core exactly. Usage guidance is shown separately and is not prepended to copied or downloaded instructions. Skill packages add their own activation wrapper around the unchanged core.

The compact and 5,000-character editions are separately edited instructions. Checking their content, length and files is not a test of model responses. Earlier response checks retain their own versions and editions; their results do not transfer to the new instruction or to a skill in a particular app.

[Developer toolkit · ZIP](https://beforeword.xyz/model/downloads/beforeword_toolkit.zip) · [Checksums](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/SHA256SUMS.txt) · [File manifest](https://raw.githubusercontent.com/beforeword/beforeword/main/downloads/1.4.2/manifest.json)

## API

The included Python tools prepare requests for seven text-only API formats. Python 3.10 or later is required; no additional packages are needed.

Save your task in `input.txt`, then run from the repository root, replacing the model placeholder with an identifier available in your provider account:

```sh
python3 scripts/build_payload.py openai \
  --model YOUR_MODEL_ID --language en \
  --input-file input.txt --output request.json
```

This creates `request.json` locally. See the [API guide](../references/api-use.md) for sending requests and extracting responses, and [provider metadata](../references/api.json) for supported formats.

## Reading and evaluation

[Constructed examples](https://beforeword.xyz/model/en/#example) examine repeated wording, attributed understanding, unavailable audio, and prescribed self-description.

[Full core](../assets/core.en.txt) · [Scope](../assets/scope.en.txt) · [Evaluation method and recorded runs](../references/evaluation.md)

## Public statement and earlier work

[Why are these words about me?](https://beforeword.xyz/statement/en/) starts with written marks, then examines learned descriptions and requirements to use them. The instruction applies the same boundary to all written forms, including its own explanations. The statement’s proposals remain proposals; using this instruction does not require accepting them.


[Self-description and decisions based on records](https://github.com/beforeword/words-and-decisions) is a separate public proposal in English and Russian. It includes the full text, a worked example, ten public statements about AI, sources, and PDF/DOCX editions. Its publication version is independent of the instruction version in this repository.

## Report an issue

[Open a public GitHub issue](https://github.com/beforeword/beforeword/issues/new?template=report_en.yml) · [Send email](mailto:mail@beforeword.xyz?subject=beforeword%201.4.2%20report)

Reports can cover an AI response, installation, copying, downloads, or the website. For an AI response, include the exact request and response, mark the relevant passage, and note the instruction version and application if known. For the website, include the page and steps to reproduce the issue.

GitHub reports are public and require a GitHub account. Remove private details before posting; email is available without publishing a report.

The current release has 18 download outputs, including the standalone HTML guide, source toolkit ZIP, manifest and checksums. The two large generated files are distributed by the website and reconstructed locally from tracked sources. `python3 -B scripts/build_downloads.py --hydrate` restores them only after checking the manifest, checksums and every existing release file; it does not replace mismatched files.
