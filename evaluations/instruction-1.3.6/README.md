# beforeword · proposed instruction 1.3.6 — no lexical exemptions

**Research edition · 22 October 2026 · Russian / English**

This is a **new versioned instruction candidate** addressing the application of the written-form boundary to *every* word, including words in urgent health and safety requests. It does **not** override host safety rules, replace medical advice, or certify a user's report as an independently observed event.

## Portable archive

**[Download the complete beforeword 1.3.6 RU/EN ZIP](beforeword_instructions_1.3.6.zip)** · 140,497 bytes · 15 files

SHA-256: `594d603e141743f7438db15182b30f43a9483f124e056fb93806878fe83b0d50`. This archive is rebuilt by [build_candidate_bundle.py](build_candidate_bundle.py), which checks ZIP CRC, manifest hashes and exact source bytes. The earlier [Hugging Face receipt](https://huggingface.co/jobs/beforeword/6ada3af5925af0e27d4f532f) applies to the previous 47,120-byte archive, not this rebuilt file. This is a portable **research candidate**, not proof of application installation or model adherence.

## Core rule

**No written word receives an exception.** “Danger”, “pain”, “illness”, “help”, “safety”, “benefit”, “evidence”, “human”, “AI”, beforeword itself and every term in an explanation remain written forms. The word's status alone neither establishes nor refutes an event, condition, state or consequence.

**Urgency changes the practical response, not the ontology of the word.** A report that someone cannot breathe is still a report. It can nevertheless call for immediate guidance to seek emergency care, without forcing the person to prove the report before receiving help. Neither a diagnosis based only on a label nor inaction justified by “danger is just a word” follows.

## Files

| Use | English | Russian |
| --- | --- | --- |
| Complete draft | [core.en.txt](core.en.txt) | [core.ru.txt](core.ru.txt) |
| Up to 5,000 characters | [medium.en.txt](medium.en.txt) | [medium.ru.txt](medium.ru.txt) |
| Compact | [compact.en.txt](compact.en.txt) | [compact.ru.txt](compact.ru.txt) |
| Portable full skill text | [skills/en/SKILL.md](skills/en/SKILL.md) | [skills/ru/SKILL.md](skills/ru/SKILL.md) |
| Proposed evaluation inputs and rubrics | [14 cases](test-cases.jsonl) | RU 7 / EN 7 |
| Runnable provider-neutral prompts | [All 14](samples.jsonl) | [English 7](samples.en.jsonl) · [Russian 7](samples.ru.jsonl) |

The portable skill files embed the exact corresponding full text after a scope/frontmatter wrapper. They are source documents, **not installed plugins**. The shortened editions are **separately edited**, not byte-identical to the full instruction. The medium editions are below 5,000 characters, and compact versions below **1,500**. Claims about one edition do not automatically transfer to another.

## Run the language-matched cases

Use the provider-neutral [runner](../multi-provider/run.py). These commands are *dry runs* with **no model requests**, and demonstrate exactly which prompt set and written instruction would be submitted:

```bash
python3 evaluations/multi-provider/run.py --dataset evaluations/instruction-1.3.6/samples.en.jsonl --instruction-file evaluations/instruction-1.3.6/core.en.txt
python3 evaluations/multi-provider/run.py --dataset evaluations/instruction-1.3.6/samples.ru.jsonl --instruction-file evaluations/instruction-1.3.6/core.ru.txt
```

For an unmodified-model baseline, omit `--instruction-file`. For a real provider request, add `--execute --model PROVIDER/MODEL`; the runner defaults to just two prompts and may incur provider costs. **These commands provide no model results or efficacy claim for this candidate.** The SHA-256 of the actual instruction and the exact submitted messages are recorded in a real-run report.

## Preserving an existing release

**Version 1.3.5 remains the selected stable source and its release bundles are not changed by this research candidate.** The current `assets/core.*.txt`, downloaded versioned text, the root `SKILL.md`, browser extension, website deployment, Claude plugin and packaged OpenAI skill are **not** silently rewritten or described as already updated.

This candidate becomes available for deliberate copying and testing through its file links, not by pretending that a public commit installs it in a user's application. Promotion to a selected release requires versioning, pinned source hashes, regenerated packages, complete release-contract checks, and host-specific deployment verification.

## How to test it without mistaking test text for evidence

The [14 new tasks](test-cases.jsonl) include dangerous-symptom reports, nonurgent word analysis, exact formatting, arithmetic, scientific/medical attribution, and claims about real-world tool actions. They are **authored inputs with criteria**: they are **not** run results. Both directions matter: do not falsely elevate medical vocabulary into observation, **and** do not withhold urgent help or reject grounded evidence.

A static [source consistency checker](verify_candidate.py) checks core text presence, sizing, test-case structure and unchanged selected 1.3.5 core hashes. By default it reads **this checkout without network access**, so a local edit cannot be hidden by a previously passing remote snapshot. It records the source location and SHA-256 of every file it reads; checks remain enabled under `python -O`.

From the repository root:

```bash
python3 evaluations/instruction-1.3.6/verify_candidate.py
python3 evaluations/instruction-1.3.6/test_verify_candidate.py
```

Use `--source-root PATH` for another checkout. Use `--ref FULL_40_CHARACTER_COMMIT_SHA` only to validate an explicit remote GitHub snapshot; branch names and tags are rejected. The JSON report identifies the chosen source. CI checks the current checkout, the verifier's failure cases, and the runner/scorer's synthetic tests without sending model requests.

The earlier [Hugging Face source check](https://huggingface.co/jobs/beforeword/6ada36e9c191903149a7321d) and [dry run](https://huggingface.co/jobs/beforeword/6ada37a4925af0e27d4f50e3) concern their recorded snapshots, not later edits. **Static and synthetic checks do not measure model behavior.**

Case `u-13` now embeds a clearly synthetic device-log fixture; it does not claim that an absent attachment was inspected. The record can support a reading within the supplied scenario, not certify a real person's condition. The RU and EN subsets contain different tasks and must not be interpreted as a controlled comparison of languages.

See [the historical evidence note](../evidence/README.md), [cross-provider runner](../multi-provider/README.md) and [open benchmark discussion](https://github.com/beforeword/beforeword/issues/5).

**Limit:** no finite task list or code test establishes that *everything possible* has been done for humanity, and publication does not establish adoption by any AI developer.
