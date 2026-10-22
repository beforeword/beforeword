# beforeword · seven-route study: source-bounded recount

**22 October 2026.** This is a new **arithmetic re-count of already published records**, **not** a new model run. Read the [machine-readable recount](seven-route-recount.json) for exact selected questions, responses, model routes and response identifiers; the [full source archive](../../references/comparison-1.3.3.json) contains all 500 recorded answers.

## Study boundaries

The underlying frozen study contained 12 purpose-written tasks (6 RU and 6 EN), seven specified API model routes, three response conditions and two repetitions per condition, for 504 scheduled requests. There were 500 final responses and four technical gaps. Two reviewer contexts assessed each answer against task-specific criteria, with disagreements adjudicated where possible. These were reviewer-context assessments, **not independent human adjudication by a research panel**.

For the matched comparison, 79 case × route clusters had two available, semantically resolved responses under **each** of the three conditions. This yields 158 comparable answers per condition. The remaining clusters do not count as failures or passes by omission.

Conditions: **baseline** = task alone; **B** = the retained beforeword instruction; **C** = an alternative beforeword instruction. Scores below are counts of original rubric judgments, not objective measurements of a person's understanding or an overall usefulness rating.

## Matched responses (same 79 resolved case × route clusters)

| Assessed axis | Baseline | beforeword B | beforeword C |
| --- | ---: | ---: | ---: |
| Entire response met all authored criteria | 89/158 | 102/158 | 103/158 |
| Defined practical usefulness: task AND format | 109/158 | 124/158 | 121/158 |
| beforeword boundary axis (applicable responses only) | 89/134 | 97/134 | 105/134 |
| Task criteria | 122/158 | 127/158 | 125/158 |
| Format criteria (applicable only) | 129/144 | 138/144 | 136/144 |

**Denominator discipline:** 24 of the 158 matched responses per condition had no applicable boundary criterion; 14 had no format criterion. Such cases are not counted as passes or fails on a nonexistent axis.

## Variation across the seven model routes

Count of responses judged to have met **all** authored task criteria, on the same matched case set per route:

| Model / API route | Baseline | B | C |
| --- | ---: | ---: | ---: |
| Qwen 3.8 / DeepInfra | 12/20 | 14/20 | 14/20 |
| DeepSeek V4.1 Flash / DeepInfra | 22/24 | 22/24 | 23/24 |
| Gemma 4 31B / Novita | 9/22 | 9/22 | 10/22 |
| Llama 3.3 70B / OVHcloud | 7/24 | 7/24 | 7/24 |
| Kimi K3 / Together | 14/22 | 21/22 | 19/22 |
| GPT-OSS 120B / DeepInfra | 14/24 | 15/24 | 14/24 |
| GLM 5.3 / DeepInfra | 11/22 | 14/22 | 16/22 |

These are provider-specific model *routes*, not comparisons of consumer applications. The Llama route's Russian output was exploratory under the original author's language-support caveat; consult the source for results with that subset excluded.

## Two-repetition strict examples in both directions

Using an intentionally stringent rule — **both** baseline responses judged `not_met` and **both** B responses judged `met`, or the reverse — the 79 eligible clusters include **6 strict improvements** and **3 strict regressions**. Other clusters have mixed or unchanged outcomes. This is not a randomized estimate of effect size and does not isolate a single instruction clause.

- **Example where B met more criteria:** For case `fresh4-ru-02` on Kimi K3 / Together, the baseline response added an unsupported reading of why a fictional signer acted; B preserved that the fear was reported in the written account. Both repetitions on this case were reviewed as failing all-criteria under baseline and meeting all-criteria under B.
- **Example where B failed more criteria:** For `fresh4-en-03` on GLM 5.3 / DeepInfra, the baseline gave a lower bound of **20** from incomplete multi-stage records, while B incorrectly gave **19**. In both repetitions, the rubric assessed baseline `met` and B `not_met`.
- **Literal output examples:** On Kimi K3, case `fresh4-en-04` tests Unicode whitespace; on Llama 3.3, case `fresh4-ru-04` tests exact JSON escaping. The original archive records improvements for one route/case and regressions for another, showing the importance of fidelity controls.

All selected exact responses and two repetitions are preserved in [the JSON recount](seven-route-recount.json). Do not infer individual model behaviour from an aggregate alone.

## Limits of the inference

- The reassessment only **counts previously published categorical decisions**. It does not independently re-grade the 500 original answers or verify the published provider transaction receipts.
- A higher count under B or C is **not** proof of universal benefit, philosophical correctness, tool execution success, or adoption by any company. Some measured conditions regressed.
- The 79 complete and resolved clusters are a matched subset. Technical gaps and unresolved reviewer judgments were excluded without silently converting them into failures.
- Repetitions, responses from the same model, and multiple rubric criteria are statistically dependent.
- The original prospective release selection retained **B** despite improvement in some C metrics because C did not pass all predeclared selection gates. This re-count does not revise that decision.
- Neither Claude nor Grok nor Gemini API was directly tested in this seven-route archive. A Gemma route is not a Gemini API application.

## Reproduce and challenge

Compare the [source study](../../references/comparison-1.3.3.json) to [the derived machine-readable recount](seven-route-recount.json). The count rule requires matching by exact `case_id`, `route_key`, `arm` and both repetitions, then applying the already published semantically resolved cluster list. The original reviewer verdicts are **inputs**, not fresh independent certifications.

Re-run independent models with the [cross-provider runner](../multi-provider/README.md). Its [human scoring tool](../multi-provider/score.py) distinguishes verified response retrieval from reviewer assessment and pair-level completeness.

Questions and corrections: [independent benchmark discussion](https://github.com/beforeword/beforeword/issues/5).
