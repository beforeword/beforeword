# beforeword · method and checks

A response is compared with the supplied text and task. Instruction delivery, exact preservation and response content are examined separately. The instructions, criteria and this account remain written records.

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
