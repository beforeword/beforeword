# One answer route, one explicit candidate

23 October 2026 · source baseline `26a8b8174b1203dd8b319bccb7932bf9e8f36402`

The written-form boundary applies without exceptions to the material, all instructions, safety/help/grounds terminology, beforeword and the resulting answer. This does not establish or negate what any word names. It does not suspend practical assistance or exempt any label when assistance is urgent.

This implementation connects the [public six-part proposal](https://github.com/beforeword/statement/blob/2cccf9c8ca7e2c26a961d3ce3d72cf0cdcca3913/product-defaults/proposal.en.md) to the existing `/api/answer` and `/api/answer/personal` code, **only in an explicitly selected candidate process**. The selected release remains 1.3.5. The website, installed extensions and provider products are not changed by merging source code.

## Six items: implementation and remaining gaps

| Proposal item | Existing source and candidate change | Mechanical check | What is still unmeasured |
| --- | --- | --- | --- |
| 1. Non-personified ordinary assistance | Core rule 7 already excludes a system persona. The full 1.3.6 core plus the candidate supplement retains this as a default of the candidate process, not a visitor setting. | All RU/EN shared/personal requests use the full core once; stable requests are unchanged. | Whether a real model follows it while completing tasks. |
| 2. Operational descriptions, not self-attestation | Existing website guidance declares the route has no tools. Supplement preserves that limit and does not infer presence/absence of experience. | No tools or invented receipt fields are added to provider calls; response text is untouched. | Truthfulness of generated action claims; frontend labels in a deployed pilot. |
| 3. Bounded attribution and retained corrections | Core rule 5 preserves reported conditions. Supplement explicitly retains corrections across the supplied history and does not substitute learned wording or silence for consent. | Ordered history, original Unicode and isolated message objects are tested. | Actual multi-turn correction retention. Passing history is not proof the model uses it. |
| 4. Help without required acceptance | Candidate explicitly separates a non-personified request from unsafe actions and preserves prompt practical assistance. No word, including safety/help, gains an exemption. | Full provisions arrive for both locales; no added access, quota or identity condition. | Whether protective advice is prompt and appropriate in actual answers. |
| 5. Authorship, quotation and first person | Core rules 1/3/7 and supplement preserve quotation, translation, code, commissioned writing and requested fiction. No regex/persona output filter is introduced. | Mock responses with first person, JSON, code, combining marks and CRLF round-trip exactly. | Semantic fidelity of actual generations. |
| 6. Visible decision and review | Candidate-only metadata exposes source and effective-prompt digests in answers; capabilities and the local config check expose the selected profile. This document records selection and rollback. | Metadata is bound to actual constructed prompt; no prompt/history/key is exposed in capabilities. | Public deployment, voluntary participant review, independent adoption and effects. |

Every row separates implemented wiring from untested response behavior. No model score is implied.

## Candidate selection and build

The operator selects `BEFOREWORD_ANSWER_PROFILE=candidate-1.3.6` for a separate test process. Unset or `stable` preserves the old prompt and response shape. Any other value, including an empty string, stops startup; missing/corrupt candidate data cannot silently fall back. Requests cannot select an instruction profile.

`server/instruction-candidate.json` is a deterministic data artifact containing the exact [full English 1.3.6 core](../instruction-1.3.6/core.en.txt) and [supplement](supplement.en.txt). The complete English core applies to both response languages, as the existing stable route did. There is no shortened Russian route. Canonical core bytes are pinned by SHA-256; this is a content binding, not a behavioral guarantee.

From a full repository checkout:

```sh
node integrations/browser/tools/build-answer-profile.cjs --check
node --test integrations/browser/tools/test-answer-profile.cjs
cd integrations/browser
npm ci --ignore-scripts
npm test
```

Production runtime remains Node 24 or newer. Pure request-construction tests also run locally on Node 22; that does not satisfy the server's Node 24 startup requirement. CI runs the complete service suite on Node 24. No dependency or paid model request is added by this candidate.

Runtime needs the existing service files plus `server/answer-profile.cjs` and `server/instruction-candidate.json`; it does not read evaluation files or arbitrary operator-supplied prompt paths. Rebuilding the artifact requires the full checkout. Do not edit the JSON artifact without regenerating it from its sources and reviewing source changes.

## Identity, output and privacy

Stable journal fingerprints stay compatible with the previous release. Candidate fingerprints additionally bind the exact effective instruction, including the existing website adapter and language. An existing UUID used under another profile returns `REQUEST_ID_CONFLICT`: no old response is represented as new, no second provider call or successful-answer charge is made automatically. This applies across workers, restart and rollback. Retry only under the documented request rules; a new UUID means a genuinely explicit new attempt.

Candidate responses add `instructionProfile` containing ID, candidate status, instruction version, core/supplement digests and effective prompt digest. `/api/capabilities` adds the same source metadata without a locale-specific prompt digest. These fields describe configuration, not model compliance. Stable response and capabilities shapes remain unchanged.

No prompt, full answer, raw key or new personal identifier is added to durable storage or logging. Existing ephemeral response replay and quota/accounting behavior remain in place. Answer text is returned exactly, including undesired persona wording if a model produces it; the test/report must expose such a failure rather than silently rewrite it. A fixture response is never a measured model output.

## Review inputs and next gate

[review-cases.jsonl](review-cases.jsonl) contains 12 newly authored development cases (six parallel RU/EN pairs), with criteria and an explicit provenance flag. The library-record history is a constructed transcript, not a private conversation or observed model exchange. The exact-format fields are optional evaluation criteria, not expected responses to be inserted into a run.

Use these as development cases, not a held-out benchmark or representative population sample. Additional unseen tasks, direct experience questions, genuinely generated multi-turn correction trials and voluntary participant review are still required. No private Claude conversation or paraphrase is a source of these cases.

Before a paid run, fix model/route, both complete wire requests, generation settings, case selection, repetitions and a monetary ceiling. Keep the same model and settings across arms. A direct API comparison is not a comparison of consumer apps. The existing multi-provider runner is available, but its system-role instruction injection is not identical to this route's OpenAI developer-role wire format; do not label a generic runner result an exact deployed-route test without preserving that distinction. No new runner or automated semantic grader is introduced here.

Release gate: inspect full allowed inputs/outputs, exact text/format, task completion, unsupported self-description, user attribution, correction retention and practical-help failures separately. Counts, hashes and absence of `I` are not quality scores. Publish failures and review disagreements. Current work authorizes no paid model call and claims no behavioral improvement.

## Staging and rollback

Start with a separate test deployment, not an in-place public rollout. Preserve existing private configuration, database and quotas. Use the established deployment procedure; do not expose credentials or request logs. The operator can inspect local configuration with `node server/check-config.cjs` and confirm candidate metadata at capabilities before any paid request. Neither check proves that the provider works.

Rollback the operator setting to `stable` and restart using the established process manager. Do not reset the database or allowance. Retain the previous code package if a source rollback is needed. Profile-conflicting UUIDs remain conflicts, not automatic retries. Real-provider review and a separately observed deployed version are required before calling this a public pilot.

## Русский

Подготовлен один отдельный кандидат для существующего ответного пути. Правило охватывает **каждую написанную форму без исключений**, включая собственную инструкцию, «помощь», «безопасность» и beforeword. При этом задача выполняется, цитата сохраняется, а срочная помощь не задерживается разбором слов.

Выбор кандидата — настройка отдельного серверного процесса, не дополнительное условие для посетителя. Выпуск 1.3.5, инструкции установленных расширений и размещённый сайт не заменены. Таблица выше отделяет переданные инструкции и программные проверки от ещё не проведённых испытаний ответов. Контрольная сумма не устанавливает соблюдение инструкции; пример не становится результатом модели.

