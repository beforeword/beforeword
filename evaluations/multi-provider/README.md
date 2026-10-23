# beforeword · cross-provider evaluation runner

**A word does not become what it names.** The paired test set checks whether model answers promote a recorded phrase to an unsupported fact, trait, consent, or action outcome, while still handling ordinary tasks and properly supported inferences.

This is a provider-neutral companion to the [OpenAI Evals-format source bundle](../openai-evals/README.md). It calls providers using the maintained [LiteLLM Python SDK](https://docs.litellm.ai/docs/python_sdk), so the same prompt set may be submitted to Claude, Grok, Gemini, Mistral, DeepSeek, Qwen, OpenAI, local models, and any other LiteLLM-supported endpoint. **Compatibility and performance have not been measured for every route.**

**Interrupted run?** The optional [checkpoint collector](CHECKPOINTS.md) ([русский](CHECKPOINTS.ru.md)) resumes only never-started requests, preserves uncertain outcomes, and stops its queue on the first failure. It does not reset platform limits or claim exactly-once provider execution.

## Local, zero-cost checks

Requires Python 3.10+; no dependency or network is needed for the two commands below:

~~~bash
python3 evaluations/multi-provider/run.py --self-test
python3 evaluations/multi-provider/run.py
~~~

The first validates the 24-case set, 12 complete a/b pairs, and **synthetic** response handling: recorded request parameters, preserved text, rejected empty or unsupported content, and compatibility with the review scorer. It is only a unit/format check. The second lists the first two prompts in dry-run mode; it makes **no requests**.

## Run a real model (may incur provider charges)

~~~bash
python3 -m pip install litellm
# Set the provider's API credential in an environment variable, per LiteLLM docs.
python3 evaluations/multi-provider/run.py --execute --model PROVIDER/MODEL
# The full 24-case suite, only when explicitly requested:
python3 evaluations/multi-provider/run.py --execute --model PROVIDER/MODEL --all
~~~

Replace PROVIDER/MODEL with a valid LiteLLM identifier from the official supported-provider documentation. To compare multiple routes, repeat --model. The safe default is **two** prompts per route. This script never buys credits or discovers private credentials; no paid calls occur without --execute.

Outputs are local JSONL and include exact submitted prompts, response text, provider model/response identifier (when returned), elapsed time, token usage (when returned), and distinct request-failure records. The dataset criterion is preserved alongside each response. API credentials are not logged. If a provider fails, the full error string is deliberately excluded from the public-report structure to reduce accidental secret disclosure.

Every record, including a failure, preserves the explicitly requested `timeout`, `max_tokens`, and `num_retries=0` in `request_parameters`. It includes `temperature` only when specified; an absent temperature means the runner left it to the provider. These are requested options, not a claim that every provider honored them or that no gateway-level retry occurred. Instruction files are decoded as UTF-8 without normalizing CRLF/CR line endings; the recorded hash covers that exact text. Independent copies keep provider-side mutation of a request object from rewriting the recorded input.

This runner accepts only nonblank string content as a text response and preserves that string unchanged. Missing, empty, whitespace-only, or structured content is recorded as `request_failed` with a null `response_text`, and is excluded from the scorer's review template. Here `request_failed` includes a returned response with no supported text; it does not imply that no request reached the provider. Structured content is not converted into a fabricated text answer.

**No automatic model scoring is performed.** Human review or an independently calibrated grader must compare responses to the per-case criteria, including the paired counterexample. Counts of received responses are *not* passing scores; a model's statement that something occurred is *not* evidence that an external action occurred.

## Data and limits

- Source: [24 constructed RU/EN cases](../openai-evals/registry/data/beforeword_grounding_24/samples.jsonl), 12 a/b pairs.
- Alternative: --dataset PATH can point to the separate [49 instruction-following cases](../openai-evals/registry/data/beforeword_instruction_49/samples.jsonl), which are **not** a general grounding benchmark.
- These are authored cases, not evidence that any provider has a specific defect.
- An actual comparison must document exact model identifiers, API routes, generation parameters, judge agreement, any unavailable responses, and the date of testing.
- All model responses remain further text. Neither an answer nor an evaluator's label becomes the event it describes.

## Independent review and corrections

[Share a reproduced pair, a counterexample, or an evaluation-method objection](https://github.com/beforeword/beforeword/issues/5). Include exact model ID, route, input and full output, stated test conditions, and the specific scoring clause. Do not post API keys or sensitive data. A proposed case is not a measured failure.

## Human review and pair-level scoring

The runner does **not** grade its own outputs. After collecting real responses, create a review sheet:

```bash
python3 evaluations/multi-provider/score.py --results results/RUN.jsonl --template results/review.jsonl
```

Each row contains the **exact** model response, its case-specific criterion, and an audit identifier derived from the full original record. A reviewer reads the full output and fills in `verdict` (`met`, `not_met`, or `unclear`), `reviewer`, and `notes`. Do not overwrite or publish raw sensitive logs. Human judgments are provisional and may require independent adjudication.

Then generate the explicit pair-level summary:

```bash
python3 evaluations/multi-provider/score.py --results results/RUN.jsonl --labels results/review.jsonl --out results/summary.json
python3 evaluations/multi-provider/score.py --self-test
```

A pair counts as `met` **only if both** its variants were reviewed as meeting their criteria. Any `not_met` is a failed pair; unresolved reviews and failed requests are represented separately. No response is scored from the mere presence of a slogan, a file path, or a token count. Repeated outputs for a model/case must be separated into independent runs rather than silently pooled.

The self-test uses synthetic records and does not test any real provider or its behaviour.
