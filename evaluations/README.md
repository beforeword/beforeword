# beforeword · independent AI evaluation workspace

**Research by Kirill Shebetov · updated 22 October 2026**

> A word does not become what it names.

This workspace studies a *testable operational question*: whether a model silently turns a supplied written record, label, quoted claim, or its own generated sentence into a fact, a person's trait or consent, or a report of a completed external action **without the required support**.

The same standard applies to the model's own reports. A sentence saying “sent” is not a send-tool receipt. But this distinction must **not** lead to denying valid evidence, refusing ordinary tasks, or treating all descriptions as false.

## What can be used now

| Material | Status | Role |
| --- | --- | --- |
| [24 bilingual paired cases](openai-evals/registry/data/beforeword_grounding_24/samples.jsonl) | Authored; static format checked | 12 matched a/b pairs contrasting unsupported inference with supplied grounds or ordinary exact tasks |
| [49 instruction cases](openai-evals/registry/data/beforeword_instruction_49/samples.jsonl) | Authored; static format checked | Separately tests compliance with beforeword instructions, **not** baseline universal model performance |
| [OpenAI Evals YAML and method](openai-evals/README.md) | Source published, model runs not executed in this bundle | Adapter using standard `closedqa` model grader |
| [Cross-provider runner](multi-provider/README.md) | Code published, default no-network dry run; previous offline smoke check succeeded | Optional real calls via LiteLLM-supported routes, with exact responses and provider error status |
| [Human review scorer](multi-provider/score.py) | Code and synthetic self-test published | Distinguishes `met`, `not_met`, `unclear`, failed requests and incomplete pairs |
| [Historical responses and critical case analysis](evidence/README.md) | Exact previously recorded cases and local reviewers' judgments | Illustrates a boundary substitution, overbroad rubrics, and missing action traces |
| [Seven-route study recount](evidence/seven-route-recount.md) | Re-counted from the published 500-answer archive | Balanced outcomes including improvements **and** regressions |
| [Source-verifying recount script](evidence/verify_recount.py) | **Executed successfully on Hugging Face Jobs** | Recomputes response totals, 79 resolved matched clusters, selected answer text and group counts from a source blob digest |

## Prior study and reproducibility

An earlier frozen study used **12 synthetic tasks, seven specific model/provider routes, three conditions and two repetitions**, with **504 scheduled calls, 500 final responses and four technical gaps**. Restricting to 79 matched, resolved case/route clusters (158 responses under each condition), the original reviewer criteria were met in:

| Condition | All authored criteria |
| --- | ---: |
| Task alone (no beforeword) | **89 / 158** |
| Frozen beforeword instruction B | **102 / 158** |
| Alternative instruction C | **103 / 158** |

There were **six strict B improvements and three strict B regressions** under the narrow definition requiring both repetitions to reverse between all-criteria `met` and `not_met`.

**Independent computational reproduction:** [Hugging Face Jobs run 6ada2fb4925af0e27d4f4b2f](https://huggingface.co/jobs/beforeword/6ada2fb4925af0e27d4f4b2f) completed successfully on 22 October 2026 and output `RECOUNT_MATCHED_ARCHIVED_VALUES`. [Read the full source and limits](evidence/seven-route-recount.md).

This proves neither the semantic correctness of the original reviewers nor general success of any instruction. **The verification independently recomputes arithmetic and selected bytes from an archived source; it does not re-run or independently adjudicate those 500 model answers.** The seven API routes are not the companies' consumer products; no Claude/Grok/Gemini scores are claimed here.

## Reproduce without model charges

```bash
python3 evaluations/multi-provider/run.py --self-test
python3 evaluations/multi-provider/run.py
python3 evaluations/multi-provider/score.py --self-test
```

For the archived historical comparison, run [`verify_recount.py`](evidence/verify_recount.py) with Python 3.10+; without local file arguments it downloads the published JSON records. That is a **public-data download**, not a model invocation. To run paid provider models, read [opt-in instructions](multi-provider/README.md); no calls occur without `--execute`.

## Submit criticism and results

[Open benchmark discussion](https://github.com/beforeword/beforeword/issues/5) accepts exact sample replies, contrary examples and alternative scoring proposals. Include model ID, API route, date, request, full response, case criteria, and a link to actual tool receipts if the test involves a real-world action. Remove secrets.

**Existing OpenAI submissions:** [OpenAI Evals #1853](https://github.com/openai/evals/issues/1853) · [Model Spec Evals #2](https://github.com/openai/model_spec_evals/issues/2). Submissions do not imply independent review, adoption or sponsorship. An independent comparison requires a fixed setup and new observations rather than copying historical reviewer conclusions.

The papers, rules, tests and this README are all further writing. None becomes the person, state, event, or authority it describes.
