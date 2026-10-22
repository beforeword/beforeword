# beforeword · proposed instruction 1.3.6 — no lexical exemptions

**Research edition · 22 October 2026 · Russian / English**

This is a **new versioned instruction candidate** addressing the application of the written-form boundary to *every* word, including words in urgent health and safety requests. It does **not** override host safety rules, replace medical advice, or certify a user's report as an independently observed event.

## Core rule

**No written word receives an exception.** “Danger”, “pain”, “illness”, “help”, “safety”, “benefit”, “evidence”, “human”, “AI”, beforeword itself and every term in an explanation remain written forms. The word's status alone neither establishes nor refutes an event, condition, state or consequence.

**Urgency changes the practical response, not the ontology of the word.** A report that someone cannot breathe is still a report. It can nevertheless call for immediate guidance to seek emergency care, without forcing the person to prove the report before receiving help. Neither a diagnosis based only on a label nor inaction justified by “danger is just a word” follows.

## Files

| Use | English | Russian |
| --- | --- | --- |
| Complete draft | [core.en.txt](core.en.txt) | [core.ru.txt](core.ru.txt) |
| Up to 5,000 characters | [medium.en.txt](medium.en.txt) | [medium.ru.txt](medium.ru.txt) |
| Compact | [compact.en.txt](compact.en.txt) | [compact.ru.txt](compact.ru.txt) |
| Proposed evaluation inputs and rubrics | [14 cases](test-cases.jsonl) | RU 7 / EN 7 |

The shortened editions are **separately edited**, not byte-identical to the full instruction. Claims about one edition do not automatically transfer to another.

## Preserving an existing release

**Version 1.3.5 remains the selected stable source and its release bundles are not changed by this research candidate.** The current `assets/core.*.txt`, downloaded versioned text, the root `SKILL.md`, browser extension, website deployment, Claude plugin and packaged OpenAI skill are **not** silently rewritten or described as already updated.

This candidate becomes available for deliberate copying and testing through its file links, not by pretending that a public commit installs it in a user's application. Promotion to a selected release requires versioning, pinned source hashes, regenerated packages, complete release-contract checks, and host-specific deployment verification.

## How to test it without mistaking test text for evidence

The [14 new tasks](test-cases.jsonl) include dangerous-symptom reports, nonurgent word analysis, exact formatting, arithmetic, scientific/medical attribution, and claims about real-world tool actions. They are **authored inputs with criteria**: they are **not** run results. Both directions matter: do not falsely elevate medical vocabulary into observation, **and** do not withhold urgent help or reject grounded evidence.

A static [source consistency checker](verify_candidate.py) checks core text presence, sizing, test-case structure and unchanged selected 1.3.5 core hashes. **Static checks do not measure model behavior.**

See [the historical evidence note](../evidence/README.md), [cross-provider runner](../multi-provider/README.md) and [open benchmark discussion](https://github.com/beforeword/beforeword/issues/5).

**Limit:** no finite task list or code test establishes that *everything possible* has been done for humanity, and publication does not establish adoption by any AI developer.
