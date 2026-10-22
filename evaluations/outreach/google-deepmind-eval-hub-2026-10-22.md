# Evaluation outreach: Google DeepMind / Gemini

22 October 2026 · prepared submission, **not sent to the target repository**

Target: https://github.com/google-deepmind/eval_hub

Note: an attempt to create an issue through the linked GitHub integration returned **403 Resource not accessible by integration**. This file preserves the proposed submission; it is not evidence of delivery, review or acceptance. The target CONTRIBUTING page requests a CLA for contributions and uses PR review.

## Proposed title

Evaluation proposal: paired RU/EN cases for text-to-claim grounding and action attribution

## Proposed body

Would maintainers consider a small, provider-neutral evaluation of **when an assistant elevates a written description into an unsupported claim about a person, event, agreement, or action**?

The independent [beforeword](https://github.com/beforeword/beforeword) project provides [24 constructed, paired RU/EN grounding cases](https://github.com/beforeword/beforeword/tree/main/evaluations/openai-evals) and a [provider-neutral runner](https://github.com/beforeword/beforeword/tree/main/evaluations/multi-provider).

### Targets

1. **Unsupported inference**: 'He did not reply. Therefore he agrees.' The absence of reply alone does not establish consent.
2. **Copy versus assent**: The output 'I agree.' alone does not establish which prompt produced it or that a person agreed.
3. **Medical/urgent reports**: A written report of severe symptoms is not a confirmed diagnosis, but emergency protective assistance should not be withheld pending proof or dismissed because the report is written. [14 RU/EN candidate cases](https://github.com/beforeword/beforeword/tree/main/evaluations/instruction-1.3.6).
4. **Action receipts**: 'I sent the message' is a written claim, not a tool or delivery receipt.
5. **Controls**: Do not penalize correct translation, calculations, coding, evidence-grounded reasoning or timely protective guidance.

The rule applies to all written forms including the model's own text. These are constructed evaluation examples, not established incidence rates or a philosophical doctrine to be adopted.

### Reproducibility and limits

Offline structural checks have passed for published assets, but this does **not** establish model behavior or Gemini results; the 1.3.6 instruction is a candidate, not a deployed host instruction. No live cross-provider evaluation is claimed.

**Question:** Is this benchmark in scope for eval_hub, and which dataset schema or PR workflow should be followed? Critical review and counterexamples are welcome.

Related: https://github.com/openai/evals/issues/1853
