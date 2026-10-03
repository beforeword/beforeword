# beforeword for Claude and OpenAI

[Русский](README.ru.md) · [Examples](examples.md) · [Source instructions](../assets/core.en.txt)

**What a reading adds**

AI writes “I understand.” These words are read as understanding. On what grounds?

The catalog packages carry the complete beforeword 1.2.4 instruction. Their English instruction text accepts an explicit response-language request; Russian copy and examples are included. Each platform gets one beforeword listing.

## Current status

**Packages checked and task trials recorded; directory submission awaits publisher sign-in.** Neither directory has received a submission. No GPT Store listing has been created.

The instruction remains under public testing. Package checks and small task runs are recorded separately from installation in Claude or ChatGPT. Account eligibility, portal validation, platform review, and publication remain separate steps.

[Eight recorded task outputs](validation/README.md) include five fresh tasks using the instruction extracted from the final ZIPs. The earlier unsupported addition remains in the record. The [submission status](submission-status.json) records the sign-in gates encountered at both publishing routes.

The owner approved MIT for the contents of both plugin packages on 4 October 2026. Each package includes its LICENSE notice. See the [license scope](LICENSING.md).

## Packages

| Destination | Source or file | Use |
| --- | --- | --- |
| Claude directory | [plugins/claude/beforeword](../plugins/claude/beforeword/) | GitHub source folder for the submission form |
| Claude upload | [beforeword_claude_directory_1.2.4.zip](packages/beforeword_claude_directory_1.2.4.zip) | Draft package for supported plugin upload and local testing |
| OpenAI directory | [beforeword_openai_directory_1.2.4.zip](packages/beforeword_openai_directory_1.2.4.zip) | Skills-only draft upload; includes the portable manifest and listing metadata |
| GPT Store | [gpt-store](gpt-store/) | Prepared fields and full instructions for a manually created custom GPT, if publication is available |

The earlier `downloads/1.2.4` archives remain available for their documented installation routes. In particular, the OpenAI **local marketplace** archive is a different format from this directory upload.

## First use

Select beforeword where the host offers plugin or skill selection, then paste a phrase or an AI response. Try:

> Apply beforeword to “I understand.” Include what your own explanation adds.

The same package can be requested in Russian:

> Примени beforeword к фразе «Я понимаю». Покажи также, что добавляет само объяснение.

[Three constructed examples](examples.md) show the intended distinctions. These are illustrations, not recorded output from either platform.

## Rebuild and check

From the repository root:

```bash
python3 -B catalog/build.py --write
python3 -B catalog/check.py
python3 -B catalog/build.py --check
```

The build uses the existing core and scope files and includes the approved MIT notice. It does not call a model, install anything, connect an account, or submit a listing. Package checks describe the files; host testing and directory review remain separate.

## Publication

[Publisher steps and documentation](SUBMISSION.md) identify the exact repository paths, upload formats, required owner actions, and remaining checks.

The supplied Russian translation is stored in OpenAI metadata. Current OpenAI documentation says imported translations are retained but do not yet change the displayed Directory text. This package therefore also includes a Russian README.

[Report an issue](https://github.com/beforeword/beforeword/issues). Include the input, output, host/model label, package version and installation route; remove private material first.
