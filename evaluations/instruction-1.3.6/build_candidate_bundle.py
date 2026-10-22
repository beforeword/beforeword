#!/usr/bin/env python3
"""Build the portable 1.3.6 research-candidate archive without network access.

The file order, metadata and generated documents are fixed. ZIP_STORED avoids
platform/compressor-version differences; the same source bytes produce exactly
the same archive bytes. The archive is a text/fixture bundle, not a repository.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

SOURCE_DIR = Path(__file__).resolve().parent
ARCHIVE_NAME = "beforeword_instructions_1.3.6.zip"
PREFIX = "beforeword-1.3.6/"
SOURCE_FILES = (
    "core.en.txt",
    "core.ru.txt",
    "medium.en.txt",
    "medium.ru.txt",
    "compact.en.txt",
    "compact.ru.txt",
    "skills/en/SKILL.md",
    "skills/ru/SKILL.md",
    "test-cases.jsonl",
    "samples.jsonl",
    "samples.en.jsonl",
    "samples.ru.jsonl",
)
REPOSITORY = "https://github.com/beforeword/beforeword"

README_EN = f"""# beforeword 1.3.6 — portable research candidate

This archive contains six English/Russian instruction editions, two full skill
wrappers, four evaluation datasets, these two README files and MANIFEST.json.
It is a research candidate, not an installed plugin or a tested model result.
The full skills preserve their corresponding core instruction exactly; the
medium and compact editions are separately edited versions.

## Contents and evidence

- core.en.txt / core.ru.txt: full instructions.
- medium.en.txt / medium.ru.txt: editions below 5,000 characters.
- compact.en.txt / compact.ru.txt: editions below 1,500 characters.
- skills/en/SKILL.md / skills/ru/SKILL.md: full skill source documents.
- test-cases.jsonl: 14 authored cases and rubrics, seven per language.
- samples.jsonl / samples.en.jsonl / samples.ru.jsonl: runnable prompt data.
- MANIFEST.json: SHA-256 hashes of every other archive member.

Case u-13 includes an explicitly synthetic device record in the prompt. It is
a positive control for using supplied premises within a fictional scenario;
it contains no real patient data and does not verify a physical event.

The manifest identifies these exact bytes. It does not claim that they equal a
particular Git commit, establish model adherence, or certify medical behavior.
No provider runner or source checker is included in this archive.

## Running or checking

Running the prompts and checking repository consistency require a checkout of
the [beforeword repository]({REPOSITORY}), including its evaluation tools and
release-contract files. Follow the repository's current documentation:

- [Cross-provider runner and usage]({REPOSITORY}/blob/main/evaluations/multi-provider/README.md)
- [Candidate documentation]({REPOSITORY}/blob/main/evaluations/instruction-1.3.6/README.md)
- [Candidate source checker]({REPOSITORY}/blob/main/evaluations/instruction-1.3.6/verify_candidate.py)

These are repository links, not files inside this ZIP. The main branch can
change; compare the archive's manifest hashes with the checkout before treating
them as the same candidate. Dry runs do not call models. Real provider calls
require explicit execution and may incur provider charges. Compare baseline
and instructed conditions with the language-matched dataset; no scores or
model responses are included here.

## Rebuilding and limits

The repository's build_candidate_bundle.py builds this archive from the twelve
source files listed above and dedicated archive README text. Fixed ZIP metadata
and uncompressed entries make the output deterministic without external tools.
The two repository README files are not copied into the archive.

Publication does not install these texts in an application or promote 1.3.6 to
the selected release. Follow the current repository release contract for that
status. Static checks establish only their stated structural checks.
"""

README_RU = f"""# beforeword 1.3.6 — переносимая исследовательская редакция

Архив содержит шесть русских и английских редакций инструкции, два полных
текста навыка, четыре набора проверочных данных, две README и MANIFEST.json.
Это исследовательская редакция, а не установленный плагин или результаты
работы модели. Полные навыки точно сохраняют соответствующий основной текст;
средние и краткие редакции отредактированы отдельно.

## Состав и границы данных

- core.en.txt / core.ru.txt: полные инструкции.
- medium.en.txt / medium.ru.txt: редакции короче 5 000 знаков.
- compact.en.txt / compact.ru.txt: редакции короче 1 500 знаков.
- skills/en/SKILL.md / skills/ru/SKILL.md: исходные тексты полных навыков.
- test-cases.jsonl: 14 составленных заданий с критериями, по семь на язык.
- samples.jsonl / samples.en.jsonl / samples.ru.jsonl: данные для запускатора.
- MANIFEST.json: SHA-256 каждого другого файла архива.

В задании u-13 прямо в запрос включена явно синтетическая запись прибора.
Это положительный контроль использования заданных предпосылок внутри
вымышленного сценария. Реальных медицинских данных в нём нет; физическое
событие этим заданием не подтверждается.

Manifest определяет точные байты файлов. Он не приписывает их определённому
коммиту Git, не подтверждает соблюдение инструкции моделью и не удостоверяет
медицинскую корректность. Запускатор моделей и проверка исходников в ZIP
не включены.

## Запуск и проверка

Для запуска заданий и проверки согласованности исходников нужна локальная
копия [репозитория beforeword]({REPOSITORY}) вместе с инструментами проверки и
файлами release contract. Используйте актуальную документацию репозитория:

- [Универсальный запускатор и его использование]({REPOSITORY}/blob/main/evaluations/multi-provider/README.md)
- [Описание исследовательской редакции]({REPOSITORY}/blob/main/evaluations/instruction-1.3.6/README.ru.md)
- [Проверка исходников редакции]({REPOSITORY}/blob/main/evaluations/instruction-1.3.6/verify_candidate.py)

Это ссылки на репозиторий, а не файлы внутри ZIP. Ветка main может меняться;
перед сопоставлением результатов сравните SHA-256 файлов локальной копии с
manifest архива. Пробный запуск не вызывает модели. Для реального запроса
нужно явно включить выполнение; провайдер может взимать плату. Сравнивайте
базовый вариант и вариант с инструкцией на заданиях соответствующего языка.
Ответов моделей и оценок в этом архиве нет.

## Повторная сборка и ограничения

Файл build_candidate_bundle.py в репозитории собирает архив из перечисленных
двенадцати исходных файлов и отдельного текста архивных README. Фиксированные
метаданные ZIP и отсутствие сжатия обеспечивают одинаковый результат при
одинаковых исходных байтах без внешних инструментов. Основные README
репозитория в архив не копируются.

Публикация не устанавливает инструкции в приложения и не делает 1.3.6
выбранным выпуском. Этот статус следует проверять по актуальному release
contract репозитория. Статические проверки подтверждают только явно
указанные структурные свойства.
"""


def build_archive(source_dir: Path) -> bytes:
    """Return archive bytes for exactly the listed source files and documents."""
    members = {name: (source_dir / name).read_bytes() for name in SOURCE_FILES}
    members["README.md"] = README_EN.encode("utf-8")
    members["README.ru.md"] = README_RU.encode("utf-8")
    manifest = {
        "schema_version": 1,
        "release": "beforeword 1.3.6 research candidate",
        "source_repository": REPOSITORY,
        "provenance": "Content hashes identify this bundle; no Git commit identity is asserted.",
        "builder": "evaluations/instruction-1.3.6/build_candidate_bundle.py",
        "archive_format": "ZIP_STORED; fixed 1980-01-01 timestamps and Unix file mode 0644",
        "files_sha256": {
            name: hashlib.sha256(content).hexdigest()
            for name, content in members.items()
        },
        "disclaimer": "Independent research; not an installed, model-tested or clinically certified instruction.",
    }
    members["MANIFEST.json"] = (
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for name, content in members.items():
            entry = zipfile.ZipInfo(PREFIX + name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_STORED
            archive.writestr(entry, content)
    return output.getvalue()


def verify_archive(data: bytes, source_dir: Path) -> int:
    """Check CRC, membership, every manifest hash and exact source preservation."""
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        bad_member = archive.testzip()
        if bad_member is not None:
            raise ValueError(f"ZIP CRC mismatch: {bad_member}")
        expected_names = [PREFIX + name for name in SOURCE_FILES]
        expected_names += [PREFIX + name for name in ("README.md", "README.ru.md", "MANIFEST.json")]
        if archive.namelist() != expected_names:
            raise ValueError("Archive has unexpected, missing or duplicate members")
        manifest = json.loads(archive.read(PREFIX + "MANIFEST.json"))
        expected_hash_names = [*SOURCE_FILES, "README.md", "README.ru.md"]
        if list(manifest["files_sha256"]) != expected_hash_names:
            raise ValueError("Manifest does not cover exactly the source files and README files")
        for name, expected_hash in manifest["files_sha256"].items():
            content = archive.read(PREFIX + name)
            if hashlib.sha256(content).hexdigest() != expected_hash:
                raise ValueError(f"Manifest SHA-256 mismatch: {name}")
        for name in SOURCE_FILES:
            if archive.read(PREFIX + name) != (source_dir / name).read_bytes():
                raise ValueError(f"Archive differs from source: {name}")
        for lang in ("en", "ru"):
            core = archive.read(PREFIX + f"core.{lang}.txt")
            skill = archive.read(PREFIX + f"skills/{lang}/SKILL.md")
            if not skill.endswith(core) or skill.count(core) != 1:
                raise ValueError(f"Full skill does not preserve core exactly: {lang}")
        return len(expected_names)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--out", type=Path, help="Default: archive beside the source files.")
    parser.add_argument("--check", action="store_true", help="Verify the saved archive matches a fresh build without writing it.")
    args = parser.parse_args()
    source_dir = args.source_dir.resolve()
    destination = args.out or source_dir / ARCHIVE_NAME
    data = build_archive(source_dir)
    count = verify_archive(data, source_dir)
    if args.check:
        if not destination.exists() or destination.read_bytes() != data:
            raise ValueError("Saved archive differs from the current source files; rebuild it first")
    else:
        destination.write_bytes(data)
    print(json.dumps({
        "result": "CANDIDATE_BUNDLE_CHECK_PASSED" if args.check else "CANDIDATE_BUNDLE_BUILT",
        "path": str(destination.resolve()),
        "bytes": len(data),
        "files": count,
        "sha256": hashlib.sha256(data).hexdigest(),
        "zip_crc_valid": True,
        "manifest_hashes_match": True,
        "source_bytes_preserved": True,
        "full_skills_preserve_core_exactly": True,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
