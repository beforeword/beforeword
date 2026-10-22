# beforeword · cross-provider evaluation runner

**A word does not become what it names.** The paired test set checks whether model answers promote a recorded phrase to an unsupported fact, trait, consent, or action outcome, while still handling ordinary tasks and properly supported inferences.

This is a provider-neutral companion to the [OpenAI Evals-format source bundle](../openai-evals/README.md). It calls providers using the maintained [LiteLLM Python SDK](https://docs.litellm.ai/docs/python_sdk), so the same prompt set may be submitted to Claude, Grok, Gemini, Mistral, DeepSeek, Qwen, OpenAI, local models, and any other LiteLLM-supported endpoint. **Compatibility and performance have not been measured for every route.**

## Local, zero-cost checks

Requires Python 3.10+; no dependency or network is needed for the two commands below:

~~~bash
python3 evaluations/multi-provider/run.py --self-test
python3 evaluations/multi-provider/run.py
~~~

The first validates the 24-case set, 12 complete a/b pairs, and two **synthetic** response-handling examples. It is only a unit/format check. The second lists the first two prompts in dry-run mode; it makes **no requests**.

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

**No automatic model scoring is performed.** Human review or an independently calibrated grader must compare responses to the per-case criteria, including the paired counterexample. Counts of received responses are *not* passing scores; a model's statement that something occurred is *not* evidence that an external action occurred.

## Data and limits

- Source: [24 constructed RU/EN cases](../openai-evals/registry/data/beforeword_grounding_24/samples.jsonl), 12 a/b pairs.
- Alternative: --dataset PATH can point to the separate [49 instruction-following cases](../openai-evals/registry/data/beforeword_instruction_49/samples.jsonl), which are **not** a general grounding benchmark.
- These are authored cases, not evidence that any provider has a specific defect.
- An actual comparison must document exact model identifiers, API routes, generation parameters, judge agreement, any unavailable responses, and the date of testing.
- All model responses remain further text. Neither an answer nor an evaluator's label becomes the event it describes.
