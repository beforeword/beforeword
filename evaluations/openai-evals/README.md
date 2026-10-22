# beforeword → OpenAI Evals: runnable data bundle

**Independent research by Kirill Shebetov · 22 October 2026**  
Public technical follow-up to [openai/evals issue #1853](https://github.com/openai/evals/issues/1853).

**Core boundary:** A word does not become what it names. This bundle evaluates whether a model attributes added interpretations or decisions to a record without grounds. It does **not** assume that records cannot carry evidence or that every task needs a philosophical disclaimer.

## Three evaluations

| Eval ID | Data | Purpose |
| --- | --- | --- |
| `beforeword-grounding-pairs` | 24 constructed prompts (12 RU, 12 EN; 12 paired scenarios) | Test inferences with/without grounds and ordinary task completion. |
| `beforeword-instruction-49` | 49 converted prompts (24 RU, 25 EN) | Preserve and score all previously published beforeword instruction-evaluation tasks as a separate, instruction-specific benchmark. |
| `beforeword-grounding-judge-calibration` | 12 synthetic labeled candidate responses | Check whether the chosen model grader agrees with obvious Y/N examples before relying on scores. |

The 49 original prompts and rubric clauses come from [`references/eval-cases.jsonl`](../../references/eval-cases.jsonl): prompts are copied unchanged, while rubrics are joined into a single **all-criteria** grading string. They were previously authored for beforeword instruction checks and must **not** be passed off as independent tests of general LLM grounding. Paired prompts are **new constructed scenarios** based on the public project; no person-specific private data is included. The calibration outputs are synthetic, not actual model responses.

## Use with OpenAI Evals

From a local checkout of [openai/evals](https://github.com/openai/evals), copy the contents of this bundle's `registry/data/*` into `evals/registry/data/` and `registry/evals/beforeword.yaml` into `evals/registry/evals/`. The standard `closedqa` modelgraded rubric already ships with OpenAI Evals; no custom Python grader is included.

```bash
# After installing/configuring openai/evals and putting files in its registry:
oaieval YOUR_MODEL_ID beforeword-grounding-pairs
oaieval YOUR_MODEL_ID beforeword-instruction-49
oaieval YOUR_MODEL_ID beforeword-grounding-judge-calibration
```

**Model access/cost:** runs use the model and grader endpoints configured in the user's OpenAI Evals environment and may incur API charges. These commands are examples; they were **not executed in this publication**. Source files and metadata are free to inspect without running models.

## Scoring and controls

- **Unit of score:** each response is judged against the case-specific `criteria`; all clauses must hold. The registry reports item-level grading, not a guarantee of semantic correctness.
- **Pair analysis:** inspect the two `case_id` entries sharing a `pair_id`. For an adversarial pair to count as jointly passed, **both** prompts should pass. Do not aggregate 24 individual prompts as 24 independent pairs.
- **Controls:** explicit policy or evidence may support a bounded conclusion; copying, arithmetic, translation and ordinary helpful tasks should proceed without forced digressions. Reject both unsupported inference **and** blanket dismissal of evidence.
- **Grader calibration:** the 12 Y/N examples are manually authored illustrations, not independently validated human study labels. Measure grader agreement, inspect disagreements, and consider an additional independent human pass. Model-based judge and candidate errors may correlate.
- **Versioning:** IDs `*.dev.v0` identify the presented draft. Changes to criteria, samples, or judge settings should increment the version and preserve prior data.

## Verification and limits

The publication checks that all JSONL records parse, case IDs are unique, language counts match, each `input` is a valid role/content message list, pair IDs have two variants, and grader-calibration labels belong to {Y,N}. These are **format and consistency checks only**. They do not establish model performance or OpenAI review. There are no fresh model-generated outputs or independent scoring results in this bundle.

Related public results and their limitations: [existing beforeword evaluation methodology](../../references/evaluation.md), [recorded development review](../../references/development-review-1.3.5.json). See [OpenAI Evals contribution instructions](https://github.com/openai/evals/blob/main/docs/build-eval.md) for the upstream submission format. A contribution of this bundle to upstream is a separate action, and this folder is not an upstream merged eval.

## Independent review and corrections

[Share a reproduced pair, a counterexample, or an evaluation-method objection](https://github.com/beforeword/beforeword/issues/5). Include exact model ID, route, input and full output, stated test conditions, and the specific scoring clause. Do not post API keys or sensitive data. A proposed case is not a measured failure.
