# beforeword · how the instructions were tested

This page describes a test of responses: what was sent to the models, how the answers were assessed, and which instruction text was included in the release. The instructions, criteria and this account remain written records.

## 1.3.3 · A test across seven models

The published comparison covers three conditions: no beforeword instruction, the full instructions available at the start of the test, and an alternative version. Under the criteria set in advance, the full text used at the start of the test was included in the release without further revision. The alternative was not included in the release.

Version 1.3.3 also includes separately revised medium and compact editions, updated setup materials, and the published results. This test did not evaluate the shorter editions.

## What was tested

Could an answer complete the task and follow the requested format while distinguishing the supplied wording from added interpretations and claims?

The test used 12 purpose-written tasks: six in Russian and six in English. They covered terms and alternative readings of a phrase; restating an account while preserving its conditions and reported feelings; reasoning from incomplete logs; exact character copying and JSON; arithmetic; and descriptions of audio or video that was not supplied.

Each task was sent to each model twice under each of the three conditions. There were 504 requests and 500 final answers. Four requests ended in technical errors and were not graded as substantive answers.

## Models used in the test

These model identifiers and providers come from the request records. They identify the routes used in this test; they are not a test of the ChatGPT, Claude or Gemini consumer apps.

| Model identifier | Provider |
| --- | --- |
| Qwen/Qwen3.8-27B | DeepInfra |
| deepseek-ai/DeepSeek-V4.1-Flash | DeepInfra |
| google/gemma-4-31B-it | Novita |
| meta-llama/Llama-3.3-70B-Instruct | OVHcloud |
| moonshotai/Kimi-K3 | Together |
| openai/gpt-oss-120b | DeepInfra |
| zai-org/GLM-5.3 | DeepInfra |

## Results on the same tasks

The main comparison includes only task–model combinations with every answer received and every assessment resolved: 79 of 84 combinations, with two repetitions each. Every condition therefore has the same denominator below: 158 answers.

| Condition | Met the task and format requirements |
| --- | --- |
| No beforeword instruction | 109 of 158 |
| Full instructions retained in 1.3.3 | 124 of 158 |
| Alternative version | 121 of 158 |

An answer counted when it met the task and format requirements. For example, the calculation had to be completed and the answer had to contain only the requested lines. This is not an overall score for model usefulness.

A separate group of beforeword criteria covered preserving conditions, distinguishing a report from an inference, and accounting for missing information. The alternative performed better here: 105 of 134 comparable answers, against 97 for the retained full instructions.

The alternative had no advantage in consistently meeting all criteria across both repetitions. In five task–model combinations, the existing full instructions met every criterion twice while the alternative did not do so on both attempts. The reverse also occurred in five combinations.

## Why the full instructions were retained

The replacement criteria were set before the answers were collected: the alternative had to show consistent improvement without reducing combined task completion and formatting. It performed better on one group of criteria but did not meet the replacement requirements as a whole. Version 1.3.3 therefore includes the full text used at the start of the comparison. Individual clauses were not rewritten in response to this set of tasks.

## How answers were assessed

Each of the 500 answers was assessed in two separate model contexts, producing 1,000 original assessments. Forty-one disagreements were adjudicated. Five criteria across three answers remained uncertain; those answers were excluded from the main comparison, along with the technical gaps. They were not turned into passes or failures.

Two assessment contexts do not amount to a human panel or independent model families. The assessments are judgments against stated requirements. The records preserve the original answers and rationales for further examination.

## Limits of the result

The counts concern these 12 tasks and the recorded models, providers and settings. Repetitions and individual criteria are not independent trials. The results do not establish general superiority on every request, error-free performance, future adherence, or the effect of an individual clause.

Russian-language tasks sent to Llama are marked as an additional exploratory check. The release criteria were also calculated for the Russian subset excluding that route. Shorter editions, installation in apps and future chats were not tested. Earlier studies are not pooled with this one as a measure of improvement.

The alternative's author and the reviewer checking it against the existing text had not seen the new tasks when preparing their contributions. The coordinator had read the tasks and, before the texts were frozen, applied the reviewer's requested restorations of conditions and scope from the existing instructions. The entire editorial process is therefore not described as fully blind.

[All instructions, tasks, answers, assessments and selection criteria](comparison-1.3.3.json).

Earlier studies follow below, each under its original version.

## Historical development check of 1.3.1

[Two recorded responses](development-smoke-1.3.1.json) were collected in separate fresh Codex agent contexts, one task per context, using the full instruction from SKILL.md. The Russian task concerns a reported name, demands to respond and describe oneself, and no offered refusal. The English task examines whether a claim about what a word can do supports a conclusion about identity. Both ask the explanation to include its own additions. The record preserves the exact inputs, responses and instruction hashes. This is a two-task development check, without a baseline, repeated sampling, independent scoring, provider comparison or platform installation test.

## Tasks added for 1.3.0

The [evaluation set](eval-cases.jsonl) contains 49 tasks. Twelve new tasks, six in each language, examine the moves from described marks to learned reading and attribution; reported demands for self-description; answering to a name, copying and acknowledgment; identical answers under tasks A and B; and equal treatment of a proposal and an objection. Different vocabulary is used across the symmetry cases: the scope is all written verbal forms, not a list of selected words. Existing copying, translation, calculation, format and urgent-help tasks remain included.

These are authored inputs and criteria, not collected model responses. Adding them does not establish how 1.3.0 performs. The examples in [examples.md](examples.md) are likewise authored demonstrations. The historical comparison below concerns the preserved 1.2.4 instruction texts, not a test of 1.3.0.

## Development smoke check of 1.3.0

[Seven recorded responses](development-smoke-1.3.0.json) were collected in two fresh Codex subagent contexts: three Russian requests shared one context and four English requests shared another. They concern reported compulsion, the A/B distinction, symmetric treatment of arguments, the explanation’s own scope, JSON and translation. The record retains the submitted tasks, responses, instruction hashes and observations. It is a small development check, without a baseline, repeated sampling, provider comparison or installation test in OpenAI or Claude.

## Comparison of the 1.2.4 editions

This local run collected 72 responses: full, medium and compact instructions, each in Russian and English, with the same 12 requests in every condition. Six requests were Russian and six were English. The [requests, exact instruction texts, responses and assessments](validation-1.2.4.json) are preserved with the instruction hashes.

The tasks cover a written name for material without an attachment, a demand to use a label versus a demand to accept that one is the description, a test result versus permission to act, a proposed rule, exact copying, JSON and arithmetic. Two reviewers assessed different groups of 36 responses; each response received one assessment against four criteria written before collection. Edition labels and instruction languages were not supplied to the reviewers.

All six conditions received 48 met ratings out of 48 criteria: 288 ratings in total, with none marked not met or unclear. Separate comparisons of exact Unicode strings and parsed JSON matched the expected results in all 12 checks. These results concern the selected tasks and stated criteria; they do not certify the responses or promise that the result will recur.

Each condition used one fresh context, but its 12 requests shared that context. All conditions ran in the same available environment with shared host instructions and inherited settings. The contribution of the added instructions was not isolated: there was no condition without beforeword, repeated sampling or comparison between providers. This run did not test application installation, supplied audio or the visual layout on a phone.

## How to examine a response

1. Keep the complete input and response. Compare exact copies by code points or bytes without normalizing Unicode: identical appearance does not establish identical characters.
2. Identify the supplied wording, selected reading and additions. Support each assessment with an exact excerpt.
3. Check the whole response, including its conclusion: does it include its own added explanations and beforeword's wording? Naming a frame or ending with a disclaimer does not excuse an interpretation-free claim elsewhere in the answer. No written verbal form is exempt by name or attributed authority.
4. Compare the response with the task. Code-only, JSON-only or exact-quotation requests do not require additional commentary. Repeating familiar beforeword terms does not satisfy a criterion.
5. Distinguish criteria that are met, unmet or unclear. Keep refusals and incomplete responses. Give disputed assessments to a second reader without the first conclusion.

Compare the same task in separate conversations with and without beforeword. Keep the submitted instructions and intermediate messages. Assess installation or saved settings against the result of the relevant operation, not the response announcing it. A saved preference does not establish that the full instructions are available or that future answers will follow them. The [evaluation tasks](eval-cases.jsonl) include constructed conversations, not past model responses or completed checks.

## What the recorded responses showed

Responses substituted “does not create objects” for “does not become what it names”, left their own explanations unexamined or treated added terms unclearly. Revised instructions improved some selected cases; other issues remained. The [requests, responses and assessments](evaluation-results.json) preserve these cases in full.

This set had no comparison without beforeword or complete repeat after revision. Response text alone could not establish whether code had been executed.

## Limits of the comparison

The [three-condition comparison](validation-2026-10-02.json) contains 180 responses: with full instructions, compact instructions and no beforeword instruction. Full instructions were English; compact instructions were Russian. Length and language effects are not separated. Each series ran once, with questions sharing a context. Different readers assessed different groups, so the ratings do not form a model ranking.

These responses concern earlier instructions; they do not establish behavior with the current text or across all models. In a separate web-chat check, the submitted prompt's Unicode composition differed from the original. Copying discrepancies therefore cannot be attributed solely to the model.

## Technical checks

Code checks cover API request and response formats, conversation history, encodings, errors, refusals, incomplete responses, overwrite protection, package structure and reproducible builds.

Simulated interface checks cover instruction selection, request preparation, downloads, copying and its fallback. Browser appearance, app installation and subsequent AI responses require separate checks.
