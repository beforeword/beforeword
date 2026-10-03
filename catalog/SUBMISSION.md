# Directory publication record

Prepared: 4 October 2026 (Asia/Bangkok). Instruction: 1.2.4.

This is a preparation record. It is not a receipt from either directory. No portal submission or publication has been performed.

## Claude

- Repository: `beforeword/beforeword`.
- Plugin path: `plugins/claude/beforeword`.
- Branch: `main`; select an agreed immutable commit or tag when submitting a release.
- Portal: [claude.ai/directory/manage](https://claude.ai/directory/manage).
- Type: Plugin bundle.
- Contents: one instruction skill, bilingual README, project icon.
- Pending: owner's license decision; actual Claude installation and task run; account eligibility and GitHub connection with push access; publisher contact; portal validation; acknowledgements and submission.

The plugin path becomes fixed for the listing. The contact email must be supplied by the publisher in the portal, not inferred from a Git commit. Paid-plan eligibility and organization permissions must be checked in the selected account.

## OpenAI

- Archive: `catalog/packages/beforeword_openai_directory_1.2.4.zip`.
- Format: root `plugin.json` with the Agent Plugins schema.
- Type: Skills only.
- Submission entry: follow the dashboard link in [OpenAI's submission guide](https://developers.openai.com/plugins/deploy/submission).
- English base metadata, Russian translation fields, three English starter prompts.
- Pending: actual plugin installation and task run; selected organization/project and publishing identity; portal import and skill scans; policy review, submission and publication.

The developer name shown in the directory follows the selected publishing identity. The package uses the public project label `beforeword`; that field does not establish an account or completed identity check.

Russian translations are included, but the documentation currently says imported translations do not yet change Directory display. The Russian README is included separately.

Skills-only uploads do not require an MCP server, MCP review cases or a demo recording. Screenshots are not included in this skills-only archive.

## GPT Store

The `gpt-store` folder supplies a name, descriptions, starter prompts and full instructions in both languages. No custom GPT has been created.

Check the current builder and public-sharing options in the publishing account. Use one complete instruction language edition. Do not concatenate the two editions or replace their full text with a summary. No extra actions, external API connection, or knowledge file is required for the prepared workflow.

The draft does not assume that creating a GPT, sharing a link and publishing to the Store are the same operation.

## Recorded checks

- Local package checks: see `catalog/check.py` and the build manifest.
- Task outputs, where present: see `catalog/validation/`.
- Claude host installation: not run.
- ChatGPT host installation: not run.
- Portal validation, scans and acceptance: not run.

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
