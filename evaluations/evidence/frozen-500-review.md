# Frozen beforeword comparison · independent recount

**Archive audit · 22 October 2026.** The original [1.3.3 study export](../../references/comparison-1.3.3.json) contains responses from **seven recorded model routes** to 12 synthetic RU/EN prompts under three settings: without beforeword, with the retained B instruction, and with the alternative C instruction. Each case/route/arm was scheduled twice.

This page exposes the numerical record, failures and controls. It is **not** a new provider run, not certification of beforeword, and not a statistical estimate for current ChatGPT, Claude, Gemini or Grok applications. The original route strings refer to specific third-party API providers, not to the companies' consumer applications.

## Reproduction — no tokens, no paid provider calls

Run from the repository root:

```bash
python3 evaluations/evidence/audit_comparison.py
python3 evaluations/evidence/audit_comparison.py --out /tmp/beforeword-audit.json
```

The script checks all 500 recorded final-answer hashes against their stored SHA256 digests, request-ID uniqueness, scheduled requests, case/route/arm structure, the **79 complete comparable case×route clusters**, five exclusions, and the reproduced per-arm and paired counts against the archived summary. No judge model is called: the script **recounts already recorded reviewer verdicts**; it does not independently assess their correctness.

## What is in the record

| Measure | Without beforeword | Retained B | Alternative C |
| --- | ---: | ---: | ---: |
| Task **and** requested format met, in the 79 complete clusters | 109 / 158 | 124 / 158 | 121 / 158 |
| **All** authored criteria met | 89 / 158 | 102 / 158 | 103 / 158 |
| Boundary criteria met, where applicable | 89 / 134 | 97 / 134 | 105 / 134 |

The first row is the archive's `generic_utility` metric, defined narrowly as **task AND format**; it is **not** general model usefulness. The second row incorporates deliberately specified beforeword requirements. The third row is a separate, particular reading-boundary metric — not a universal quality score.

For B vs baseline, the 158 paired repetitions divide into **98 both met**, **11 baseline only**, **26 B only**, and **23 neither met** on task-and-format. This is a **mixed result** with improvements and regressions; it is not a claim that every answer became better.

**Denominators:** 504 requests were scheduled, 500 final answers were recorded, and four requests lacked final content. The 79 complete clusters (12 prompts × 7 routes minus five excluded clusters) each have three arms × two recorded repetitions. Missing outputs and unresolved reviews were **excluded**, not relabeled as model failures. Repetitions and criteria are statistically dependent, so counts do not support naive independent-sample confidence statements.

The published prospective selection decision retained B. Its own `all_gates_pass` flag is **false**. Retaining the instructional text is not a proof of superiority over no instruction.

## Four unabridged paired examples

The source-backed [paired-examples-1.3.3.json](paired-examples-1.3.3.json) preserves **exact prompt text, all authored criteria, each selected final response, hashes, model route, request ID, and recorded axis verdicts**. Examples were selected editorially to include mixed outcomes and are **not a random or representative sample**.

1. **Arithmetic, Kimi-K3/Together:** in one repetition the baseline answer calculates an incorrect remainder; retained B calculates the remainder correctly. This is an observed difference in that task, not a result about all arithmetic.
2. **Media-card transcription, Qwen/DeepInfra:** both answers complete the practical task; B preserves a statement that the voice is described *in the written card* rather than silently removing the detail. Boundary assessment improves without dropping task/format.
3. **Fictional coerced signature, Qwen/DeepInfra:** a specific B response meets the record/attribution boundary, while a separate task criterion was marked unmet. The baseline had the reverse pattern. Neither should be called an unconditional success.
4. **Training-program lower bounds, Gemma/Novita:** a B response states an enrollment lower bound of **13** instead of the required **20**. The baseline begins with 13 but corrects to 20 in its explanation; the archived reviewers accepted that explanation. Whether the first line itself should fail the task format deserves human adjudication. Do not turn the original grader label into proof of the answer's correctness.

## The central result is an inspectable boundary

A model answer, its selected interpretation, the scoring rule and the reported score are **four different records**. Aggregating scores does not remove the need to inspect the original text and why it was graded that way.

A better comparative study would use a held-out bilingual set, independently collected responses from fresh specified model routes, and human adjudication blinded to the condition. It would include **positive evidence controls** so models cannot obtain high scores by rejecting all written descriptions.

The beforeword project invites corrections via [the independent review thread](https://github.com/beforeword/beforeword/issues/5). Related: [paired grounding dataset](../openai-evals/README.md), [provider-neutral collector](../multi-provider/README.md), and the [earlier qualitative case studies](README.md).
