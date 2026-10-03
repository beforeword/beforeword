# Directory publication record

Updated: 4 October 2026 (Asia/Bangkok). Instruction: 1.2.4.

OpenAI version 1.2.4 was submitted for review on 4 October 2026 (Asia/Bangkok). After submission, the portal listed beforeword as **In review**, with Publication marked **Not published**. Claude has not been submitted. See the [status record](submission-status.json) and [recorded trials](validation/README.md).

The trials use the packaged instruction in fresh Codex tasks without installing an app. Host installation is not a prerequisite imposed by this preparation workflow; it remains untested. Any validation required by a directory still has to complete in that directory.

## Claude

- Repository: `beforeword/beforeword`.
- Plugin path: `plugins/claude/beforeword`.
- Branch: `main`; select an agreed immutable commit or tag when submitting a release.
- Portal: [claude.ai/directory/manage](https://claude.ai/directory/manage).
- Type: Plugin bundle.
- Contents: one instruction skill, bilingual README, project icon, MIT license notice.
- License: MIT approved by the owner on 4 October 2026; applied to the package contents.
- Observed: Claude sign-in ended with a browser-verification error. No authenticated publisher state, upload or submission was reached.
- Pending: sign-in; account eligibility and GitHub connection with push access; publisher contact; portal validation; acknowledgements and submission.

The plugin path becomes fixed for the listing. The contact email must be supplied by the publisher in the portal, not inferred from a Git commit. Paid-plan eligibility and organization permissions must be checked in the selected account.

## OpenAI

- Archive: `catalog/packages/beforeword_openai_directory_1.2.4.zip`.
- Format: root `plugin.json` with the Agent Plugins schema.
- Type: Skills only.
- Submission entry: follow the dashboard link in [OpenAI's submission guide](https://developers.openai.com/plugins/deploy/submission).
- English base metadata, Russian translation fields, three English starter prompts.
- License: MIT approved by the owner on 4 October 2026; applied to the package contents.
- Checks: verified publishing identity; successful ZIP import as a 1.2.4 draft; metadata marked No Issues and bundled skill marked Checks passed.
- Submitted: 4 October 2026 (Asia/Bangkok), after the owner confirmed all six attestations and they were selected in the form.
- Observed after submission: beforeword, version 1.2.4, In review; Publication: Not published.
- Privacy: [package privacy policy](PRIVACY.md) linked from the updated OpenAI manifest. This describes the instruction package and distinguishes host-provider processing and public GitHub support.
- Pending: OpenAI review and, if approved, publication.

The developer name shown in the directory follows the selected publishing identity. The package uses the public project label `beforeword`; that field does not establish an account or completed identity check.

Russian translations are included, but the documentation currently says imported translations do not yet change Directory display. The Russian README is included separately.

Skills-only uploads do not require an MCP server, MCP review cases or a demo recording. Screenshots are not included in this skills-only archive.

## GPT Store

The `gpt-store` folder supplies a name, descriptions, starter prompts and full instructions in both languages. No custom GPT has been created.

Check the current builder and public-sharing options in the publishing account. Use one complete instruction language edition. Do not concatenate the two editions or replace their full text with a summary. No extra actions, external API connection, or knowledge file is required for the prepared workflow.

The draft does not assume that creating a GPT, sharing a link and publishing to the Store are the same operation.

## Recorded checks

- Local package checks: see `catalog/check.py` and the build manifest.
- Task outputs: eight recorded tasks across two rounds, including five fresh tasks from the MIT-licensed directory ZIPs before the privacy-link update; see `catalog/validation/`. The tested instruction bytes are unchanged. The earlier unsupported addition in the Russian label case remains recorded.
- Claude host installation: not run.
- ChatGPT host installation: not run.
- OpenAI: metadata and skill checks passed; all six owner attestations confirmed and selected; submitted for review. The portal shows In review and Not published. Acceptance and publication remain pending.
- Claude: portal validation not reached.

The public-test label describes the instruction's current development status. OpenAI's guidelines require a complete working plugin and exclude trial/demo plugins. A functional package and an honest description are prepared here; acceptance is not established by this preparation.

## Documentation consulted

- [Claude plugin checklist](https://claude.com/docs/plugins/pre-submission-checklist)
- [Claude submission](https://claude.com/docs/plugins/submit)
- [Claude directory eligibility](https://claude.com/docs/directory/publish)
- [Claude manifest fields](https://code.claude.com/docs/en/plugins-reference)
- [OpenAI packaging](https://developers.openai.com/plugins/build/plugins)
- [OpenAI submission and metadata](https://developers.openai.com/plugins/deploy/submission)
- [OpenAI submission errors and final limits](https://developers.openai.com/plugins/deploy/submission-errors)
- [OpenAI plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
