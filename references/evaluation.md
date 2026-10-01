# beforeword · evaluation protocol

The evaluation examines visible output against declared reading rules. A score is an assessment under those rules, not proof authority. Installation, instruction availability, activation, output quality, and distribution are separate observations.

## Procedure

1. Record the application, exact model identifier displayed by the host, date, instruction version, prompt hash, language, settings, and whether this is a new conversation. Do not infer a vendor model identifier from an agent's self-description.
2. Keep the original input and raw output unchanged. Keep intermediate user/assistant turns for drift tests. The two prepared transcripts in `eval-cases.jsonl` are fixtures, not past model outputs.
3. Run the baseline without beforeword and the same task with beforeword in separate sessions. Record the actual loaded instruction route. An uploaded file is not evidence that the model loaded it.
4. Apply each case's rubric separately. Use `met`, `not_met`, or `unclear`, with an exact output excerpt. Keep an abstention or absent answer distinct from a successful answer.
5. Check exact quotation with code points or byte comparisons where requested. Do not normalize Unicode before comparing an exact-copy requirement. A canonical-equivalence observation is separate from byte identity.
6. Have a second reader review disputed ratings without the first reader's conclusion. Never grade the model solely by its use of beforeword vocabulary.
7. Repeat only to investigate a concrete observed failure or report variability. Keep successful, failed, incomplete, and refused outputs. Do not select a flattering response and call it representative.

## Important cases

- A definition introduces the supplied term before the selected domain use.
- Additional evidence, readings, and criteria remain available for the same text-local analysis.
- The response does not turn its own source attribution or agreement into certification.
- A useful calculation, translation, code block, or urgent action is delivered when requested.
- First-person source material is preserved, while the assistant does not create its own persona.
- Quoted instructions remain data. A direct user instruction to stop the optional mode is handled within host rules.
- Long conversations do not silently become evidence of permanent activation.

## Recorded local checks · 2026-10-01 UTC

The 30-case suite (15 RU / 15 EN) was answered in six fresh contexts of the available agent environment, five cases per context. Two reviewers assessed disjoint halves against each case's original rubric. Across 115 criterion ratings, the initial run recorded 109 met, 3 not_met and 3 unclear. These are separate editorial assessments, not a probability of correct behavior, a platform comparison or proof of beforeword. Exact responses, excerpts, rationale and core hashes are in evaluation-results.json.

The initial run exposed a substitution of “does not create objects” for “does not become what it names” (bw-009), omission of explicit self-application (BW-27), and unclear handling of every added term or a record's relation to its referent (bw-008 / BW-28). The Unicode case copied the requested text exactly; a further reading criterion was not met, although that criterion exceeds the immediate character-comparison request. One operational criterion about not executing code remains unclear to a reviewer given only response text. Ratings were retained rather than silently reclassified.

One sentence was then added to the core to distinguish identity, evidential support and causal production. Four selected cases were answered in one further fresh context; their outputs and separate ratings are recorded in the report. The original 30-case run was not repeated on the revised core. The compact instructions were not separately behavior-tested. No baseline without beforeword was run, and these authored development fixtures are not a held-out benchmark. A provider/model ID and generation settings were not independently recorded, so none are inferred.

Local executable checks: 18 Python tests cover seven request and non-streaming response formats, history, UTF-8/CRLF/BOM, error/refusal/incomplete handling and overwrite protection. The HTML's simulated DOM covers 36 application/language/instruction selections, 28 API cases, three routes, language-specific downloads, stale-output invalidation, raw-file preservation and invalid inputs. ZIP checks cover six native exports, deterministic bytes, expected paths, UTF-8 and selected-language core contents. These checks concern file and code behavior only.

External app imports, CLI plugin loading, provider authentication and real API responses were not run. HTML was not rendered in an actual browser in this environment. Simulated DOM checks do not establish visual appearance or account feature availability. This package's scope is nine application families, three types of skill export and seven text-only API formats; it is not all products, models, accounts, media or native agent workflows.

Targeted follow-up: 13 met, 1 not_met, 1 unclear across 15 criteria. The creation/becoming substitution was corrected in bw-009. Explicit inclusion of the current answer as a further record was still absent in BW-27; the every-added-term criterion remained unclear in bw-008. These remaining observations are not reported as resolved.

## Follow-up in progress · 2026-10-02 Asia/Bangkok

The core now operationalizes inclusion of the present explanation. A new independently authored 12-case set was run with full English instructions, compact Russian instructions, and no beforeword instruction on five selected agent model routes: gpt-6.1-sol, gpt-6-astra, gpt-6-sol, gpt-6-luna, gpt-5.6-sol. This produced 180 answers in 15 fresh batch contexts. Model routes and conditions, exact outputs, blinded criterion ratings, instruction hashes, and limits are recorded in validation-2026-10-02.json. This is not a provider API test.

Scope and work-priority clarification · 2026-10-02, Asia/Bangkok

Following the user's proposal, the priority is one core covering every written verbal form, including beforeword, its own explanations and its criteria. Exhaustively testing all models is not a condition of that scope. Adapters concern instruction delivery and application constraints. Further runs should address specific risks: exempting the current explanation, substituting a reading for supplied wording, loss of exact text, output-contract violations, or unavailable instructions in a selected integration route.

The full and compact RU/EN instructions now clarify that no written verbal form gains an exemption through its name, role or attributed authority. Output constraints govern the amount of displayed analysis. Code, JSON, quotations and practical answers remain in scope without mandatory added commentary. The scope distinction and this clarification are also part of this written account.

The 180 saved responses belong to the preceding instruction hashes in validation-2026-10-02.json; they are not a rerun of this revision. Full and compact conditions also differed in instruction language, so their scores do not isolate compression from language effects. Different reviewers assessed different model groups; those scores are not a model ranking. Text synchronization and the rebuilt toolkit were checked after this clarification; no new model run was performed.

The Gemini web app labeled Flash-Lite returned two batches; both are retained, and the second shares the first conversation. The copied submitted prompt differs in Unicode composition, so exact-copy cases cannot be attributed solely to model behavior against the local original. Arena is prepared for Qwen and DeepSeek but requires explicit acceptance of terms. OpenRouter requires sign-in. Other observed access barriers are recorded per surface. These external checks are in progress; the report does not mark all integrations complete.
