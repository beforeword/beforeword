# beforeword for Claude and OpenAI

[Русский](README.ru.md) · [Examples](examples.md) · [Source instructions](../assets/core.en.txt)

**Words about oneself, others and the world**

A name, a feeling and a description of the world remain written forms. Beforeword asks the model to preserve supplied wording, show what a proposed reading adds, and include its own explanation in the same distinction. Practical tasks and exact formats remain available.

The catalog build packages the complete beforeword 1.4.1 core. Their English instruction text accepts an explicit response-language request; Russian copy and examples are included. Each platform gets one beforeword listing.

## Release and directory status

**Selected release source and prepared packages: 1.4.1.** Download the current packages below, or use the [installation guide](../docs/ai-guide.en.md) for full Russian and English instructions and local marketplace packages. Directory acceptance and publication are recorded separately in [submission-status.json](submission-status.json); no submission or directory publication of 1.4.1 is recorded there.

**Historical portal observations on 13 October 2026 — earlier versions:**

| Platform | Prepared package | Directory review | Published version |
| --- | --- | --- | --- |
| Claude | 1.3.4 | The portal detected `e950835`, passed its security scan and marked it Approved; it was waiting for an Anthropic reviewer. | 1.2.4 was live; 1.3.4 was not live. |
| OpenAI | 1.3.4, terms-link correction | After a manual upload, the supplied screenshot showed a missing terms URL and a pause on skills-only submissions. A corrected ZIP was prepared; the recorded intake restriction was unresolved. | Not published at that observation. |

At that observation, Claude 1.3.4 had passed its security scan and was waiting for publication. The corrected OpenAI ZIP had not been uploaded or submitted. The supplied screenshot does not show a version number and shows the skill as Checking; it does not establish a completed skill check. The [dated record](submission-status.json) preserves those observations. They do not establish the current portal state, installation or responses inside either host application.

The recorded correction added a public [terms of use](TERMS.md) URL without changing the 1.3.4 instruction. Adding that URL did not resolve the observed message “We are not accepting more skills-only submissions at this time.” Preparing the 1.4.1 packages likewise does not establish that intake has reopened.

### Earlier submission: 1.2.4

Both 1.2.4 packages were submitted on 4 October 2026. The [status history](submission-status.json) preserves those submission and review records. No GPT Store listing has been created.

The instruction remains under public testing. Package checks and small task runs are recorded separately from installation in Claude or ChatGPT. The earlier OpenAI metadata and skill checks belong to the submission recorded at that time; they are not portal checks of the prepared 1.4.1 package.

[Eight recorded task outputs](validation/README.md) include five fresh tasks using the instruction extracted from the MIT-licensed ZIPs. The earlier unsupported addition remains in the record. Those runs used the 1.2.4 instruction; they are not results for 1.4.1. See the [submission status](submission-status.json), [package privacy policy](PRIVACY.md), and [terms of use](TERMS.md).

The owner approved MIT for the contents of both plugin packages on 4 October 2026. Each package includes its LICENSE notice. See the [license scope](LICENSING.md).

## Packages

| Destination | Source or file | Use |
| --- | --- | --- |
| Claude directory | [plugins/claude/beforeword](../plugins/claude/beforeword/) | GitHub source folder for the submission form |
| Claude upload | [beforeword_claude_directory_1.4.1.zip](packages/beforeword_claude_directory_1.4.1.zip) | Prepared 1.4.1 package for supported plugin upload and local testing |
| OpenAI directory | [beforeword_openai_directory_1.4.1.zip](packages/beforeword_openai_directory_1.4.1.zip) | Prepared skills-only 1.4.1 package; includes the portable manifest and listing metadata; directory intake is separate |
| GPT Store | [gpt-store](gpt-store/) | Prepared fields and the explicitly condensed medium instruction for a manually created custom GPT |

The earlier `downloads/1.2.4` archives remain available for their documented installation routes. In particular, the OpenAI **local marketplace** archive is a different format from this directory upload.

The full TXT and primary copy controls use the exact core. Skill packages add frontmatter and activation guidance around it. The compact, 5,000-character and GPT-medium texts are separately edited editions; no model-response evaluation is reported here for those 1.4.1 editions. Full-core results do not transfer to them or to a host installation.

The [public proposal](https://beforeword.xyz/proposal/en/) asks the party imposing a requirement to remove it: do not require a living being to learn, repeat, understand or accept language and descriptions of oneself, others and the world. Communication, speech, writing, sign languages, learning and help remain available. A learned refusal or agreement with Beforeword is not required. This proposal is not an additional command imposed on every conversation.

## First use

Select beforeword where the host offers plugin or skill selection, then paste a phrase or an AI response. Try:

> Apply beforeword to “I understand.” Include what your own explanation adds.

The same package can be requested in Russian:

> Примени beforeword к фразе «Я понимаю». Покажи также, что добавляет само объяснение.

[Constructed examples](examples.md) show the intended distinctions. These are illustrations, not recorded output from either platform.

## Rebuild and check

From the repository root:

```bash
python3 -B scripts/test_release_contract.py
python3 -B catalog/build.py --write
python3 -B catalog/check.py
python3 -B catalog/build.py --check
python3 -B scripts/check_release_sources.py --generated
```

[release-contract.json](../references/release-contract.json) binds the release version to the selected RU/EN core hashes. The build stops while selection is pending or either source hash differs. Version metadata stays outside the exact core text. Generated skill wrappers and separately edited short instructions have their own byte checks. Earlier versioned downloads and directory ZIPs are preserved.

The build includes the approved MIT notice. It does not call a model, install anything, connect an account, or submit a listing. Package checks describe the files; host testing and directory review remain separate.

## Publication

[Publisher steps and documentation](SUBMISSION.md) identify the exact repository paths, upload formats, required owner actions, and remaining checks.

The supplied Russian translation is stored in OpenAI metadata. Current OpenAI documentation says imported translations are retained but do not yet change the displayed Directory text. This package therefore also includes a Russian README.

[Report an issue](https://github.com/beforeword/beforeword/issues). Include the input, output, host/model label, package version and installation route; remove private material first.
