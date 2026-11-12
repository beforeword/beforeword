#!/usr/bin/env python3
"""Exact, fail-closed patches for an existing static site; no credentials/network."""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import uuid

VERSION = 1
MAX_FILE_BYTES = 64 * 1024 * 1024
PROTECTED = {"ma", "api", "server", "private", "beforeword-api", "beforeword-private"}
SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".txt", ".svg", ".zip", ".pdf", ".woff", ".woff2", ".ttf", ".png", ".jpg"}


class Stop(RuntimeError):
    pass


def need(condition, message):
    if not condition:
        raise Stop(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def read_json(path):
    raw = Path(path).read_bytes()
    need(len(raw) <= MAX_FILE_BYTES, "JSON input exceeds size limit")
    return json.loads(raw)


def relative_name(value):
    need(isinstance(value, str) and bool(value), "Empty/non-string path")
    p = PurePosixPath(value)
    need(not p.is_absolute() and str(p) == value, "Noncanonical path: " + value)
    need(bool(re.fullmatch(r"[A-Za-z0-9_./+\-]+", value)), "Unsupported path characters: " + value)
    need(all(s not in {".", ".."} and not s.startswith(".") and s.lower() not in PROTECTED for s in p.parts), "Protected path: " + value)
    need(p.suffix.lower() in SUFFIXES, "Unsupported static suffix: " + value)
    return value


def within(root, name):
    root = Path(root)
    relative_name(name)
    p = root
    for component in PurePosixPath(name).parts:
        p = p / component
        need(not p.is_symlink(), "Symlink refused: " + name)
        if p.exists() and p != root / name:
            need(p.is_dir(), "Parent is not a directory: " + name)
    return p


def get_file(root, name):
    p = within(root, name)
    if not p.exists():
        return {"exists": False}, None
    st = p.lstat()
    need(stat.S_ISREG(st.st_mode) and st.st_nlink == 1, "Nonregular or hard-linked file: " + name)
    need(st.st_size <= MAX_FILE_BYTES, "File exceeds size limit: " + name)
    raw = p.read_bytes()
    end = p.lstat()
    need((st.st_ino, st.st_dev, st.st_size, st.st_mtime_ns) == (end.st_ino, end.st_dev, end.st_size, end.st_mtime_ns), "File changed while reading: " + name)
    return {"exists": True, "sha256": sha(raw), "size": len(raw), "mode": stat.S_IMODE(st.st_mode), "uid": st.st_uid, "gid": st.st_gid}, raw


def replace_text(raw, patches, name):
    # Count every old fragment in the original bytes. Apply nonoverlapping spans
    # once, so inserted text can never become input to another replacement.
    raw.decode("utf-8", errors="strict")
    spans = []
    for item in patches:
        old, new, count = item.get("old"), item.get("new"), item.get("expected_count")
        need(isinstance(old, str) and old and isinstance(new, str) and old != new, "Invalid replacement: " + name)
        need(type(count) is int and count > 0, "Invalid expected_count: " + name)
        old, new = old.encode("utf-8"), new.encode("utf-8")
        actual = raw.count(old)
        need(actual == count, f"Exact count mismatch: {name}: expected {count}, found {actual}")
        offset = 0
        while True:
            index = raw.find(old, offset)
            if index < 0:
                break
            spans.append((index, index + len(old), new))
            offset = index + len(old)
    spans.sort(key=lambda row: (row[0], row[1]))
    for previous, current in zip(spans, spans[1:]):
        need(previous[1] <= current[0], "Overlapping replacements: " + name)
    parts, offset = [], 0
    for start, end, new in spans:
        parts.extend((raw[offset:start], new))
        offset = end
    return b"".join(parts + [raw[offset:]])


def roots(webroot, backup_root):
    webroot = Path(webroot).resolve(strict=True)
    backup_root = Path(backup_root).resolve(strict=False)
    need(webroot.is_dir(), "Webroot is not a directory")
    need(backup_root != webroot and webroot not in backup_root.parents, "Backup must be outside webroot")
    need(webroot != backup_root and backup_root not in webroot.parents, "Backup must not contain webroot")
    return webroot, backup_root


def build_plan(webroot, manifest_path, overlay_path=None):
    manifest_path = Path(manifest_path).resolve(strict=True)
    manifest_raw = manifest_path.read_bytes()
    need(len(manifest_raw) <= MAX_FILE_BYTES, "Patch manifest exceeds size limit")
    manifest = json.loads(manifest_raw)
    need(manifest.get("schema_version") == VERSION and isinstance(manifest.get("patches"), list), "Unsupported patch manifest")
    grouped = {}
    for patch in manifest["patches"]:
        name = relative_name(patch.get("path"))
        grouped.setdefault(name, []).append(patch)
    entries = []
    for name, patches in sorted(grouped.items()):
        before, raw = get_file(webroot, name)
        need(before["exists"], "Authored page is missing: " + name)
        after = replace_text(raw, patches, name)
        need(len(after) <= MAX_FILE_BYTES and after != raw, "Empty change or oversized output: " + name)
        entries.append({"path": name, "kind": "exact_text_replacements", "replacement_count": len(patches), "before": before, "after": {**before, "sha256": sha(after), "size": len(after)}, "before_bytes": raw, "after_bytes": after})
    overlays = None
    overlay_raw = None
    if overlay_path:
        overlay_path = Path(overlay_path).resolve(strict=True)
        overlay_raw = overlay_path.read_bytes()
        need(len(overlay_raw) <= MAX_FILE_BYTES, "Overlay manifest exceeds size limit")
        overlays = json.loads(overlay_raw)
        need(overlays.get("schema_version") == VERSION and isinstance(overlays.get("overlays"), list), "Unsupported overlay manifest")
        names = set(grouped)
        for item in overlays["overlays"]:
            name = relative_name(item.get("path"))
            need(name not in names, "Duplicate or patch/overlay conflict: " + name)
            names.add(name)
            need("expected_sha256" in item, "Overlay requires explicit expected_sha256: " + name)
            before, raw = get_file(webroot, name)
            expected = item["expected_sha256"]
            if expected is None:
                need(not before["exists"], "New overlay path already exists: " + name)
            else:
                need(isinstance(expected, str) and re.fullmatch(r"[a-f0-9]{64}", expected), "Invalid overlay old hash: " + name)
                need(before.get("sha256") == expected, "Overlay old hash mismatch: " + name)
            source_name = relative_name(item.get("source"))
            source = within(overlay_path.parent, source_name)
            need(source.is_file(), "Overlay source missing: " + source_name)
            need(source.stat().st_size <= MAX_FILE_BYTES, "Overlay source exceeds size limit: " + name)
            after = source.read_bytes()
            need(sha(after) == item.get("sha256"), "Overlay payload hash mismatch: " + name)
            need(after != raw, "Overlay makes no change: " + name)
            metadata = {k: before[k] for k in ("mode", "uid", "gid")} if before["exists"] else {"mode": 0o644, "uid": webroot.stat().st_uid, "gid": webroot.stat().st_gid}
            entries.append({"path": name, "kind": "hash_gated_overlay", "before": before, "after": {"exists": True, "sha256": sha(after), "size": len(after), **metadata}, "before_bytes": raw, "after_bytes": after})
    need(entries, "No changes requested")
    need(sum(e["after"]["size"] for e in entries) <= 256 * 1024 * 1024, "Total release exceeds size limit")
    new_directories = set()
    for entry in entries:
        for parent in PurePosixPath(entry["path"]).parents:
            if str(parent) != "." and not (webroot / str(parent)).exists():
                new_directories.add(str(parent))
    return {"schema_version": VERSION, "created_utc": now(), "webroot": str(webroot), "patch_manifest_sha256": sha(manifest_raw), "overlay_manifest_sha256": sha(overlay_raw) if overlay_raw is not None else None, "new_directories": sorted(new_directories, key=lambda name: (name.count("/"), name)), "entries": entries}


def summary(plan):
    return {k: v for k, v in plan.items() if k != "entries"} | {"scope": "listed changed paths only", "files": [{k: v for k, v in e.items() if k not in {"before_bytes", "after_bytes"}} for e in plan["entries"]]}


def syncdir(path):
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_private(path, raw):
    path = Path(path)
    with path.open("xb") as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    syncdir(path.parent)


def write_state(release, state):
    target = release / "state.json"
    temporary = release / ("state-" + uuid.uuid4().hex + ".json")
    write_private(temporary, (json.dumps(state, ensure_ascii=False, indent=2) + "\n").encode())
    os.replace(temporary, target)
    syncdir(release)


@contextlib.contextmanager
def lock(backup_root):
    backup_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    need(not backup_root.is_symlink() and stat.S_IMODE(backup_root.stat().st_mode) & 0o077 == 0, "Backup root must be private (mode 0700)")
    lockpath = backup_root / ".patch-site.lock"
    need(not lockpath.is_symlink(), "Lock symlink refused")
    fd = os.open(lockpath, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    finally:
        os.close(fd)


def prepare(webroot, backup_root, manifest, overlays=None):
    with lock(backup_root):
        plan = build_plan(webroot, manifest, overlays)
        release_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-boundary-" + uuid.uuid4().hex[:10]
        release = backup_root / release_id
        release.mkdir(mode=0o700)
        saved = summary(plan)
        saved["release"] = release_id
        for index, entry in enumerate(plan["entries"]):
            for side in ("before", "after"):
                raw = entry[side + "_bytes"]
                if raw is not None:
                    write_private(release / f"{index:04d}-{side}.bin", raw)
        raw = (json.dumps(saved, ensure_ascii=False, indent=2) + "\n").encode()
        write_private(release / "plan.json", raw)
        write_private(release / "plan.sha256", (sha(raw) + "\n").encode())
        write_state(release, {"status": "prepared", "created_utc": now(), "completed_paths": [], "created_directories": []})
        return {"status": "prepared", "release": release_id, "backup_directory": str(release), **saved}


def load_release(webroot, backup_root, release_id):
    need(isinstance(release_id, str) and re.fullmatch(r"[0-9]{8}T[0-9]{6}Z-boundary-[a-f0-9]{10}", release_id), "Invalid release ID")
    release = backup_root / release_id
    need(release.is_dir() and not release.is_symlink(), "Release missing or symlink")
    for path in release.iterdir():
        need(not path.is_symlink() and path.is_file(), "Nonregular private release entry")
    raw = (release / "plan.json").read_bytes()
    need(sha(raw) == (release / "plan.sha256").read_text().strip(), "Frozen plan hash mismatch")
    plan = json.loads(raw)
    need(plan.get("schema_version") == VERSION and plan.get("webroot") == str(webroot) and plan.get("release") == release_id, "Release identity mismatch")
    need(isinstance(plan.get("files"), list) and plan["files"], "Invalid frozen file list")
    need(len({e["path"] for e in plan["files"]}) == len(plan["files"]), "Duplicate frozen paths")
    for index, entry in enumerate(plan["files"]):
        relative_name(entry["path"])
        for side in ("before", "after"):
            if entry[side]["exists"]:
                payload = (release / f"{index:04d}-{side}.bin").read_bytes()
                need(sha(payload) == entry[side]["sha256"] and len(payload) == entry[side]["size"], "Frozen payload hash mismatch: " + entry["path"])
    allowed_parents = {str(parent) for entry in plan["files"] for parent in PurePosixPath(entry["path"]).parents if str(parent) != "."}
    new_directories = plan.get("new_directories", [])
    need(isinstance(new_directories, list) and len(set(new_directories)) == len(new_directories) and set(new_directories) <= allowed_parents, "Invalid frozen directory list")
    state = read_json(release / "state.json")
    created_directories = state.get("created_directories", [])
    need(isinstance(created_directories, list) and set(created_directories) <= set(new_directories), "Invalid journal directory list")
    return release, plan, state


def check_state(webroot, plan, side):
    for entry in plan["files"]:
        actual, _ = get_file(webroot, entry["path"])
        need(actual == entry[side], "Live bytes or metadata changed: " + entry["path"])


def check_new_directories_absent(webroot, plan):
    for name in plan.get("new_directories", []):
        path = webroot / name
        need(not path.exists() and not path.is_symlink(), "New directory appeared after preparation: " + name)


def replace_bytes(webroot, name, raw, metadata, created, expected):
    path = within(webroot, name)
    parent = webroot
    for component in PurePosixPath(name).parts[:-1]:
        parent = parent / component
        if not parent.exists():
            parent.mkdir(mode=0o755)
            os.chown(parent, metadata["uid"], metadata["gid"])
            os.chmod(parent, 0o755)
            created.append(str(parent.relative_to(webroot)))
            syncdir(parent.parent)
    temporary = path.with_name(".boundary-" + uuid.uuid4().hex)
    try:
        with temporary.open("xb") as stream:
            os.fchown(stream.fileno(), metadata["uid"], metadata["gid"])
            os.fchmod(stream.fileno(), metadata["mode"])
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        actual, _ = get_file(webroot, name)
        need(actual == expected, "Concurrent edit at final replacement check: " + name)
        # POSIX has no byte-conditional rename. The lock coordinates this
        # runner; unrelated writers must remain stopped during publication.
        os.replace(temporary, path)
        syncdir(path.parent)
    finally:
        if temporary.exists():
            temporary.unlink()


def restore(webroot, release, plan, state):
    # Permit recovery of interrupted applies: every path must still be exactly
    # before OR after. A concurrent third version blocks the entire rollback.
    for entry in plan["files"]:
        actual, _ = get_file(webroot, entry["path"])
        need(actual in (entry["before"], entry["after"]), "Rollback conflict: " + entry["path"])
    state["status"] = "rolling_back"
    write_state(release, state)
    for index in reversed(range(len(plan["files"]))):
        entry = plan["files"][index]
        current, _ = get_file(webroot, entry["path"])
        need(current in (entry["before"], entry["after"]), "Rollback conflict before restore: " + entry["path"])
        if current == entry["before"]:
            continue
        if entry["before"]["exists"]:
            raw = (release / f"{index:04d}-before.bin").read_bytes()
            replace_bytes(webroot, entry["path"], raw, entry["before"], [], current)
        else:
            path = within(webroot, entry["path"])
            actual, _ = get_file(webroot, entry["path"])
            need(actual == entry["after"], "Rollback conflict before unlink: " + entry["path"])
            path.unlink()
            syncdir(path.parent)
    for name in reversed(state.get("created_directories", [])):
        path = webroot / name
        need(not path.is_symlink(), "Rollback directory symlink refused")
        if path.is_dir() and not any(path.iterdir()):
            path.rmdir()
            syncdir(path.parent)
    check_state(webroot, plan, "before")
    state.update(status="rolled_back", rolled_back_utc=now())
    write_state(release, state)
    return {"status": "rolled_back", "release": plan["release"], "files": len(plan["files"]), "scope": "listed changed paths only"}


def apply(webroot, backup_root, release_id):
    with lock(backup_root):
        release, plan, state = load_release(webroot, backup_root, release_id)
        need(state["status"] == "prepared", "Release is not prepared; inspect/verify/recover it instead of repeating apply")
        check_state(webroot, plan, "before")
        check_new_directories_absent(webroot, plan)
        # Persist the complete directory set before creating any directory; it
        # remains recoverable even after SIGKILL between mkdir and file replace.
        state.update(status="applying", started_utc=now(), created_directories=list(plan.get("new_directories", [])))
        write_state(release, state)
        try:
            for index, entry in enumerate(plan["files"]):
                current, _ = get_file(webroot, entry["path"])
                need(current == entry["before"], "Concurrent edit before replace: " + entry["path"])
                raw = (release / f"{index:04d}-after.bin").read_bytes()
                replace_bytes(webroot, entry["path"], raw, entry["after"], [], entry["before"])
                state["completed_paths"].append(entry["path"])
                write_state(release, state)
            check_state(webroot, plan, "after")
            state.update(status="applied", applied_utc=now())
            write_state(release, state)
        except BaseException as error:
            try:
                restore(webroot, release, plan, state)
            except BaseException as rollback_error:
                state.update(status="recovery_required", error_type=type(error).__name__, rollback_error_type=type(rollback_error).__name__)
                write_state(release, state)
                raise Stop("Apply interrupted; rollback conflict/error. Preserve release and recover: " + release_id) from error
            raise Stop("Apply interrupted; original listed files restored: " + release_id) from error
        return {"status": "applied", "release": release_id, "files": len(plan["files"]), "scope": "listed changed paths only", "backup_directory": str(release)}


def verify(webroot, backup_root, release_id):
    with lock(backup_root):
        release, plan, state = load_release(webroot, backup_root, release_id)
        need(state["status"] in {"prepared", "applied", "rolled_back"}, "Interrupted release; inspect and recover first")
        side = "after" if state["status"] == "applied" else "before"
        check_state(webroot, plan, side)
        if state["status"] == "prepared":
            check_new_directories_absent(webroot, plan)
        return {"status": "verified", "state": state["status"], "release": release_id, "files": len(plan["files"]), "scope": "listed changed paths only"}


def rollback(webroot, backup_root, release_id):
    with lock(backup_root):
        release, plan, state = load_release(webroot, backup_root, release_id)
        need(state["status"] in {"applying", "applied", "rolling_back", "recovery_required"}, "Release has no published state to roll back")
        return restore(webroot, release, plan, state)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["dry-run", "prepare", "apply", "verify", "rollback"])
    parser.add_argument("--webroot", default="/home/befohuyc/public_html")
    parser.add_argument("--backup-root", default="/home/befohuyc/beforeword-private/site-boundary-releases")
    parser.add_argument("--manifest")
    parser.add_argument("--overlays")
    parser.add_argument("--release")
    args = parser.parse_args()
    webroot, backup_root = roots(args.webroot, args.backup_root)
    if args.command in {"dry-run", "prepare"}:
        need(args.manifest and not args.release, "This command requires --manifest, without --release")
        result = ({"status": "ready", "writes": False, **summary(build_plan(webroot, args.manifest, args.overlays))} if args.command == "dry-run" else prepare(webroot, backup_root, args.manifest, args.overlays))
    else:
        need(args.release and not args.manifest and not args.overlays, "This command requires only --release")
        result = globals()[args.command](webroot, backup_root, args.release)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (Stop, OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"status": "stopped", "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
