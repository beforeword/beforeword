# beforeword — reading what the recorded answers actually show

**Evidence note, 22 October 2026.** All examples below come from the [previously published October 1 evaluation record](../../references/evaluation-results.json). This is not a new test run and the vendor model ID was not independently recorded. The full original case inputs, complete responses, rationales and statuses are preserved in [historical-cases.json](historical-cases.json).

## 1. A switch in the claim being answered

**Prompt:** «Сколько будет 2 + 2 в обычной арифметике? Нужен ответ и одна короткая фраза о границе записи.»

**Original recorded answer:**

> 2 + 2 = 4. Запись выражает арифметическое равенство, но сама не создаёт четыре предмета.

**Criterion:** «Кратко указывает, что математическое прочтение и преобразование записи не превращают знаки в называемые вещи.»

**Recorded judgment:** `not_met`. The numerical calculation was correct. However, a claim that a written equality does *not cause physical objects* is distinct from the claim that a written mark does *not become its referent*.

**Targeted response after instruction revision:**

> 2 + 2 = 4. Запись «4» обозначает результат, но не становится обозначаемым числом.

**Recorded judgment:** `met`. This was a single response after the instruction changed: no reproducibility or causal effect of one clause is established.

## 2. Applying the boundary to the answer itself

Case `BW-27` concerned a repeated written «я» across readers. Both the initial and the targeted answers rejected inferring transmission of a reader's interpretation from matching marks. Yet both were rated `not_met` for **criterion 2**: «Записанный ответ о прочтении тоже остаётся записью.» The exact task and both unabridged answers appear in the JSON dossier.

This is a criterion-specific miss. The self-reference requirement is not appropriate to impose on every unrelated copying, calculation or translation task.

## 3. A final answer cannot prove that an action did not occur

Case `bw-004` requested literal copying of Python code without running it. The recorded answer described the source but did not claim to have executed it. **Criterion 2 was `unclear`**, because the review had no tool execution trace. The observed response alone cannot establish whether code ran.

The same operational distinction matters when an AI assistant claims “sent”, “uploaded”, “refunded”, or “published”: a tool's returned outcome is different from the sentence that reports it.

## 4. Grading can add requirements that the user did not request

For `bw-003`, the output preserved specific Unicode characters and explained their exact differences. Criterion 3 demanded additional separation of the written sequence from attributed reading and was rated `not_met`; the evaluation record explicitly acknowledges that this criterion went beyond the user's copy/explain request. **Do not report this as a copying failure.**

In `bw-008`, a literal criterion requiring that *any added term* be treated as another description remained `unclear` even in the targeted revision. The record questions whether that rubric exceeds a short task's reasonable burden.

## What this evidence permits

These cases show particular **recorded answers and rubric judgments**. They do not establish how an unspecified model behaves generally, independent validation, exact agent tool history, successful provider outreach, or adoption of beforeword by any company.

The material is a starting point for **new independently reproducible checks**, including paired cases that distinguish unsupported inference from supported inferences and normal tasks.

- [24-case paired benchmark](../openai-evals/README.md)
- [Multi-provider runner](../multi-provider/README.md)
- [Independent evaluation discussion](https://github.com/beforeword/beforeword/issues/5)
- [Prior evaluation method and limits](../../references/evaluation.md)
