# beforeword for Claude and OpenAI

[Русский](README.ru.md) · [Examples](examples.md) · [Source instructions](../assets/core.en.txt)

**What a reading adds**

AI writes “I understand.” These words are read as understanding. On what grounds?

The catalog packages carry the complete beforeword 1.3.0 instruction. Their English instruction text accepts an explicit response-language request; Russian copy and examples are included. Each platform gets one beforeword listing.

## Release and directory status

**The source and packages in this repository are version 1.3.0.** Directory acceptance and publication are recorded separately in [submission-status.json](submission-status.json); rebuilding the source does not update a submission.

On 8 October 2026, the Claude portal showed **Published**, with 1.2.4 live. Its newer 1.2.4 commit had passed its checks and was waiting for an Anthropic reviewer. The 1.3.0 update had not yet been scanned at this observation. OpenAI required sign-in, so its current review status was not rechecked.

### Earlier submission: 1.2.4

**OpenAI version 1.2.4 was submitted for review on 4 October 2026.** The recorded portal observation was **In review** and **Not published**. Claude version 1.2.4 was also submitted on 4 October 2026. Its security scan passed, and publication was requested. The request is waiting for an Anthropic reviewer; the same record lists Claude as **Nothing published yet**. Automatic publication in Claude is disabled. No GPT Store listing has been created.

The instruction remains under public testing. Package checks and small task runs are recorded separately from installation in Claude or ChatGPT. OpenAI's metadata and skill checks passed before submission; review and publication remain pending.

[Eight recorded task outputs](validation/README.md) include five fresh tasks using the instruction extracted from the MIT-licensed ZIPs. The earlier unsupported addition remains in the record. Those runs used the 1.2.4 instruction; they are not results for 1.3.0. See the [submission status](submission-status.json) and [package privacy policy](PRIVACY.md).

The owner approved MIT for the contents of both plugin packages on 4 October 2026. Each package includes its LICENSE notice. See the [license scope](LICENSING.md).

## Packages

| Destination | Source or file | Use |
| --- | --- | --- |
| Claude directory | [plugins/claude/beforeword](../plugins/claude/beforeword/) | GitHub source folder for the submission form |
| Claude upload | [beforeword_claude_directory_1.3.0.zip](packages/beforeword_claude_directory_1.3.0.zip) | 1.3.0 package for supported plugin upload and local testing |
| OpenAI directory | [beforeword_openai_directory_1.3.0.zip](packages/beforeword_openai_directory_1.3.0.zip) | Skills-only 1.3.0 package for upload; includes the portable manifest and listing metadata |
| GPT Store | [gpt-store](gpt-store/) | Prepared fields and the explicitly condensed medium instruction for a manually created custom GPT |

The earlier `downloads/1.2.4` archives remain available for their documented installation routes. In particular, the OpenAI **local marketplace** archive is a different format from this directory upload.

The [public statement](https://beforeword.xyz/statement/en/) is a separate publication. Its proposed changes are not additional binding rules for the plugin.

## First use

Select beforeword where the host offers plugin or skill selection, then paste a phrase or an AI response. Try:

> Apply beforeword to “I understand.” Include what your own explanation adds.

The same package can be requested in Russian:

> Примени beforeword к фразе «Я понимаю». Покажи также, что добавляет само объяснение.

[Constructed examples](examples.md) show the intended distinctions. These are illustrations, not recorded output from either platform.

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
