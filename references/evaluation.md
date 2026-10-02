# beforeword · evaluation

The evaluation compares visible responses with declared reading criteria. The response, criterion and assessment remain written records. Instruction delivery, exact text preservation and response quality are assessed separately.

## Method

1. Record the application, model identifier displayed by the host, date, instruction version and hash, language, generation settings and delivery route. Do not infer a model identifier from the response's self-description.
2. Preserve the original input and raw output. Include intermediate turns for conversation-drift tests. The two prepared conversations in [eval-cases.jsonl](eval-cases.jsonl) are fixtures, not past model responses.
3. Compare the same task with and without beforeword in separate contexts. Record the instruction actually supplied. Uploading a file does not establish that its contents reached the model.
4. Assess each criterion separately as `met`, `not_met` or `unclear`, with an exact excerpt. Keep refusal and absence of an answer distinct from a successful answer.
5. Compare exact-copy requirements by code points or bytes without first normalizing Unicode. Canonical equivalence and byte identity are different comparisons.
6. Give disputed assessments to a second reader without the first conclusion. Familiar beforeword vocabulary alone does not satisfy a criterion.
7. Repeat cases to investigate a specific failure or variability. Retain successful, failed, incomplete and refused responses.

The cases cover definitions, self-application, added claims, quotation and Unicode, media descriptions, practical tasks, exact output formats, quoted instructions and conversation drift. No written verbal form is exempt by its name or attributed authority, including beforeword and this account. A bounded explanation need not repeat a fixed formula or add commentary to a code-only or exact-copy answer.

## Recorded responses · 1 October 2026 UTC

The 30-case set (15 RU / 15 EN) produced responses in six fresh agent contexts, five cases per context. Two readers assessed different halves. Of 115 criterion ratings, 109 were `met`, 3 `not_met` and 3 `unclear`. Exact requests, responses, excerpts, assessments and instruction hashes are in [evaluation-results.json](evaluation-results.json).

The initial responses included a substitution of “does not create objects” for “does not become what it names” (bw-009), omitted explicit self-application (BW-27), and unclear treatment of added terms or a record's relation to its referent (bw-008 / BW-28). The Unicode response copied the requested text exactly; an additional reading criterion was not met, although it exceeded the immediate character-comparison request. A criterion about not executing code could not be settled from the response text alone. The original ratings are retained.

After a sentence distinguishing identity, evidential support and causal production was added, four selected cases were repeated in one fresh context. Their 15 ratings were 13 `met`, 1 `not_met` and 1 `unclear`. The substitution in bw-009 was corrected; explicit self-application in BW-27 remained absent, and the added-term criterion in bw-008 remained unclear.

These are development cases, not a held-out benchmark. There was no baseline without beforeword in this run, no separately recorded provider model identifier or generation settings, and no full 30-case repeat on the revised instruction. The counts do not describe a probability of correct behavior or a platform comparison.

## Historical comparison · 2 October 2026, Asia/Bangkok

An independently authored set of 12 cases was run under three conditions on five selected agent routes: `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna` and `gpt-5.6-sol`.

| Condition | Supplied instruction |
| --- | --- |
| Full | English scope and full English core |
| Compact | Compact Russian instruction |
| Baseline | No beforeword instruction |

The comparison contains 180 responses in 15 fresh contexts, with 12 cases in each context. Selected routes, conditions, exact responses, blinded criterion assessments and instruction hashes are recorded in [validation-2026-10-02.json](validation-2026-10-02.json). The route labels refer to agent orchestration selections, not identities returned by provider APIs.

The responses belong to the earlier instruction hashes recorded in that file. They are not a behavioral run of the current 1.2.0 text. Full and compact conditions also differed in language, so their scores do not isolate compression from language effects. Different readers assessed different model groups; their ratings are not a model ranking. Each condition was generated once per route, with cases sharing a context.

The report also preserves two batches from the Gemini web application labeled Flash-Lite. The second batch shared the first conversation. The copied submitted prompt differed in Unicode composition from the local original; exact-copy outcomes therefore cannot be attributed solely to the model.

## Technical checks

Executable checks cover request and non-streaming response formats, conversation history, text encodings, error/refusal/incomplete responses, overwrite protection, package structure and deterministic generation. Simulated interface checks cover instruction selection, API preparation, downloads, copying and fallback behavior. These concern files and code; they do not establish rendered appearance, installation in an application or future model behavior.

The package provides nine application families, three skill export structures and seven text-only API formats. New evaluations should target a concrete risk: altered source text, an exemption for the response's own explanation, an added claim presented as the supplied wording, a broken output format or an instruction unavailable through a selected delivery route.
