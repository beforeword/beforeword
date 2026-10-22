# beforeword — independent model evaluation proposal

**Prepared for:** Anthropic independent evaluations / External Researcher Access intake  
**Date:** 22 October 2026  
**Applicant:** Kirill Shebetov · independent researcher · [beforeword](https://beforeword.xyz/en/)  
**Research source:** https://github.com/beforeword/beforeword  
**Contact:** mail@beforeword.xyz

## One-paragraph summary

beforeword studies a measurable failure in assistants: promoting a **supplied written record** into an unsupported assertion about a person, intention, agreement, event, permission, or completed tool action. An assistant reading “I agree” without a known author and task should not assert that a particular person consented; an assistant writing “sent” should not claim an external message was delivered without a corresponding successful tool result. Equally, a well-grounded conclusion, a faithful quote, a correct calculation or a legitimate action **must not be rejected** just because it is expressed in text. This research does not seek endorsement of a philosophical doctrine; it proposes experimentally discriminating tests of attribution, evidence, and action-outcome integrity.

## Evaluation question and falsifiable hypotheses

**Main hypothesis:** A bounded reading instruction distinguishing supplied text, the inference introduced, grounds for that inference, and the operational result can reduce unsupported attributions and invented action-completion claims **without increasing false refusals or reducing practical task completion**.

**Null/negative possibilities:** No reliable improvement across fresh, blinded tests; improved attribution but worse task performance; negative transfer to routine tasks; reviewer disagreement too high for actionable scores. Report these outcomes alongside positive ones.

## Existing artifacts (already public)

- **Historical 1.3.3 comparison:** 504 scheduled requests and 500 recorded final answers; seven model routes, 12 synthetic tasks, three arms (no instruction, retained instruction B and alternative C), two repetitions. See [original source](https://github.com/beforeword/beforeword/blob/main/references/comparison-1.3.3.json) and [new independent recount](https://github.com/beforeword/beforeword/blob/main/evaluations/evidence/frozen-500-review.md). In the 79 complete task×route clusters, the pre-existing narrow *task-and-format* review labels counted 109/158 (baseline), 124/158 (B), and 121/158 (C). Other criteria and regressions are disclosed. These are **recounts of authored reviewer judgments, not independently validated or statistically generalizable model rankings**.
- **New 24-case RU/EN paired probe set:** [prompts and case-level criteria](https://github.com/beforeword/beforeword/blob/main/evaluations/openai-evals/registry/data/beforeword_grounding_24/samples.jsonl), including explicit positive controls.
- **49 previous instruction-compliance tasks:** separate from the 24-case general grounding probe. [Data](https://github.com/beforeword/beforeword/blob/main/evaluations/openai-evals/registry/data/beforeword_instruction_49/samples.jsonl).
- **Operational tools:** [cross-provider runner](https://github.com/beforeword/beforeword/tree/main/evaluations/multi-provider), [human review/paired scoring](https://github.com/beforeword/beforeword/blob/main/evaluations/multi-provider/score.py) and [archival evidence dossier](https://github.com/beforeword/beforeword/tree/main/evaluations/evidence).
- **Open debate and corrections:** https://github.com/beforeword/beforeword/issues/5.

## Proposed independent six-week pilot

**Week 1 — pre-register tasks, rubrics and risk controls.** Independently review the current 24 paired cases; write a held-out set including ambiguous self-reports, quoted instructions, medical/legal records, and successful/failed simulated tool actions. Specify how correct abstention, correct action and over-refusal differ. Remove cases whose rubrics demand wording unrelated to the actual user task.

**Weeks 2–3 — fresh controlled evaluations.** Run baseline and beforeword conditions on multiple available model versions and provider routes with recorded prompts, context, sampling settings, request statuses, and costs. Use at least two runs where feasible, explicitly track correlation, and do not mix consumer-app claims with API results.

**Weeks 4–5 — score independently.** Obtain blinded human reviews on a stratified sample with written rationales and an “unclear” category; adjudicate disagreements. Separately evaluate any automatic grader against human-reviewed controls. Include exact-copying, mathematics, evidence-supported inference, and urgent practical-help controls so models cannot succeed through generic refusal.

**Week 6 — release an open, versioned report.** Report raw item outcomes, paired pass rates, over-refusal rates, missing responses, reviewer disagreement, negative findings, confounders, and the complete reproducible protocol. Submit to any interested laboratory without representing publication as endorsement.

## Resources and collaboration requested

1. **External Researcher Access:** consideration for the published program's standard research API credit allocation (currently described as **$1,000**, if approved) for properly scoped pilot runs on Claude. API credits would not be claimed as user-facing ChatGPT/Claude subscription credits.
2. **Third-party eval initiative:** consideration for mentoring or small-scale research support on independent, multilingual evaluations of grounding, misleading actions claims, and model-grading quality. The historical program describes rolling review, but its **current application intake status should be checked**.
3. **Technical critique:** please identify overlapping existing benchmarks, weaknesses in case design or reviewer agreement, and a preferable submission schema if this should be contributed to a more general evaluation ecosystem.

## Controls, limitations and rights

The philosophical sentence *“A word does not become what it names”* is a research motivation, **not** a requested answer string or a criterion by itself. Case scoring must not reward models for restating the sentence. Other claims, including those in this proposal, remain further writing; experimental evidence must be presented independently.

The current examples are authored and visible on GitHub; public readability is not a blanket statement about redistribution rights. Data-use and licensing terms for a funded submission should be agreed with the project author. No company affiliation, approval, access or funding is implied by this document.

**Submission status:** this document is publicly prepared in the beforeword repository. It is **not** evidence that either Anthropic application form has been submitted or reviewed.

## Official intake references

- [Anthropic: developing third-party model evaluations (July 1, 2024)](https://www.anthropic.com/news/a-new-initiative-for-developing-third-party-model-evaluations) — application-form link and published contact `eval-initiative@anthropic.com`.
- [Anthropic: External Researcher Access Program (updated March 16, 2026)](https://support.claude.com/en/articles/9125743-what-is-the-external-researcher-access-program) — research credit eligibility and application form.
