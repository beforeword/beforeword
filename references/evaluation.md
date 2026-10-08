# beforeword · method and checks

A response is compared with the supplied text and task. Instruction delivery, exact preservation and response content are examined separately. The instructions, criteria and this account remain written records.

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
