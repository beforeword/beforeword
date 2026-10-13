# beforeword for Claude and OpenAI

[Русский](README.ru.md) · [Examples](examples.md) · [Source instructions](../assets/core.en.txt)

**What a reading adds**

AI writes “I understand.” These words are read as understanding. On what grounds?

The catalog build packages the complete beforeword 1.3.4 core. Their English instruction text accepts an explicit response-language request; Russian copy and examples are included. Each platform gets one beforeword listing.

## Release and directory status

**Release source: 1.3.4.** Directory acceptance and publication are recorded separately in [submission-status.json](submission-status.json); rebuilding the source does not update a submission.

**Portal observations on 13 October 2026:**

| Platform | Prepared package | Directory review | Published version |
| --- | --- | --- | --- |
| Claude | 1.3.4 | The portal detected `e950835`, passed its security scan and marked it Approved. It is waiting for an Anthropic reviewer. | 1.2.4 remains live; 1.3.4 is not live. |
| OpenAI | 1.3.4 | The previous 1.3.3 review was cancelled to replace the package. The portal shows Changes required. The 1.3.4 upload did not transfer a file and has not been submitted. | Not published. |

Claude 1.3.4 passed its security scan and is waiting for publication. OpenAI 1.3.4 is prepared; its upload was not completed. Installation and responses inside either host application have not been tested. The [dated record](submission-status.json) preserves earlier states and the limits of this update.

### Earlier submission: 1.2.4

Both 1.2.4 packages were submitted on 4 October 2026. The [status history](submission-status.json) preserves those submission and review records. No GPT Store listing has been created.

The instruction remains under public testing. Package checks and small task runs are recorded separately from installation in Claude or ChatGPT. The earlier OpenAI metadata and skill checks belong to the submission recorded at that time; they are not checks of the prepared 1.3.4 package in the portal.

[Eight recorded task outputs](validation/README.md) include five fresh tasks using the instruction extracted from the MIT-licensed ZIPs. The earlier unsupported addition remains in the record. Those runs used the 1.2.4 instruction; they are not results for 1.3.4. See the [submission status](submission-status.json) and [package privacy policy](PRIVACY.md).

The owner approved MIT for the contents of both plugin packages on 4 October 2026. Each package includes its LICENSE notice. See the [license scope](LICENSING.md).

## Packages

| Destination | Source or file | Use |
| --- | --- | --- |
| Claude directory | [plugins/claude/beforeword](../plugins/claude/beforeword/) | GitHub source folder for the submission form |
| Claude upload | [beforeword_claude_directory_1.3.4.zip](packages/beforeword_claude_directory_1.3.4.zip) | 1.3.4 package for supported plugin upload and local testing |
| OpenAI directory | [beforeword_openai_directory_1.3.4.zip](packages/beforeword_openai_directory_1.3.4.zip) | Skills-only 1.3.4 package for upload; includes the portable manifest and listing metadata |
| GPT Store | [gpt-store](gpt-store/) | Prepared fields and the explicitly condensed medium instruction for a manually created custom GPT |

The earlier `downloads/1.2.4` archives remain available for their documented installation routes. In particular, the OpenAI **local marketplace** archive is a different format from this directory upload.

The full TXT and primary copy controls use the exact core. Skill packages add frontmatter and activation guidance around it. The compact, 5,000-character and GPT-medium texts are separately edited editions; no model-response evaluation is reported here for those 1.3.4 editions. Full-core results do not transfer to them or to a host installation.

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
