# Beforeword boundary maintenance, 2026-11-12

Temporary task branch; no default-branch or site deployment is performed by publication of these files.

`create_public_export.py` exports only the explicit public paths in `public-export-allowlist.json` and CSS/JS/SVG under public `assets/` and `model/assets/`. It creates one random-named ZIP in the existing public downloads directory and prints its URL, SHA256, size and missing count. It never reads credentials, environment files, PHP, API/server/ma/private trees or generic JSON directories. Hardlinks and symlinks are rejected with explicit checks that remain active under Python optimization. Run downloaded code only after checking its separately supplied SHA256, using `python3 -I`.

Download the ZIP, check the console SHA256 and use `extract_public_export.py ARCHIVE NEW_DESTINATION --sha256 EXACT_SHA256 --allowlist public-export-allowlist.json`. The destination must be absent. The helper rejects paths outside the reviewed scope, unexpected entries, symlinks, excessive expansion and hash mismatches. `baseline.json` contains the current file hashes and sizes. This is a per-file snapshot, so other publishing tools must remain idle. Delete only the export ZIP after successful download and validation.

The authored-patch manifest is a candidate based on a historical snapshot, not a live overwrite source. Package ZIP downloads and media are excluded from export. The patch runner supports exact old-count replacements against current server bytes, private backups, per-file atomic replacement, verification and explicit recovery/rollback. Preparation and dry-run make no public content changes. Do not apply before live-source and text review. Its optional overlays require an explicit existing SHA256 or required absence.

# Publication runner: boundary revision

This package has no credentials or network calls. Run it with Python 3.9+ on the
server after access is restored. It does not copy the historical site over the
live site. Every authored replacement is applied to the bytes actually read on
the server, and only explicitly listed changed paths can be written.

## Inputs

`authored-page-patches.json` schema 1 has `patches[]` entries:

```json
{"path":"language/index.html","old":"exact original text","new":"replacement text","expected_count":1}
```

Every old fragment must occur exactly the stated number of times in the same
original file. Overlapping replacements are rejected. Replacements cannot
reprocess newly inserted text. UTF-8 characters, untouched bytes and CRLF/LF
line endings are preserved. Historical `files[].source_sha256` fields are
provenance only and are not used as live source or deployment permission.

An optional, separately reviewed `instruction-overlays.json` has this shape:

```json
{
  "schema_version": 1,
  "overlays": [
    {
      "path": "model/toolkit/beforeword_core_RU.txt",
      "source": "payload/model/toolkit/beforeword_core_RU.txt",
      "sha256": "EXACT_NEW_PAYLOAD_SHA256",
      "expected_sha256": "EXACT_EXISTING_LIVE_SHA256"
    }
  ]
}
```

`source` is relative to the overlay manifest. `expected_sha256: null` is allowed
only when the destination must not exist. There is no overwrite-without-a-hash
mode. A path cannot be both a text patch and an overlay. Generated downloads,
instruction pages and package assets must all be listed explicitly.

## Commands

Use the same reviewed inputs for dry-run and prepare:

```sh
python3 patch_site.py dry-run --manifest authored-page-patches.json
python3 patch_site.py prepare --manifest authored-page-patches.json
```

Add `--overlays instruction-overlays.json` to both commands only when that
manifest and its payload have been prepared and reviewed. `dry-run` writes
nothing. `prepare` creates private originals, frozen changed-file payloads and
a plan, but makes no public changes. Keep the exact returned release ID.

```sh
python3 patch_site.py apply --release EXACT_RETURNED_RELEASE_ID
python3 patch_site.py verify --release EXACT_RETURNED_RELEASE_ID
```

Default paths are `/home/befohuyc/public_html` and the private backup directory
`/home/befohuyc/beforeword-private/site-boundary-releases`. Explicit
`--webroot` and `--backup-root` options are available for local tests. The
backup directory must be outside the public webroot and mode 0700.

Apply repeats the byte and owner/group/mode comparison for **every changed
path** before any public change, and once more after the temporary file is
complete, immediately before replacing each file. Rollback repeats its checks
before each restore or unlink. These are precondition checks, not a filesystem
atomic compare-and-swap: POSIX rename cannot condition its write on file bytes.
Files are replaced atomically, one at a time. Permissions and ownership are
preserved for existing files; new assets use webroot ownership and mode 0644;
new directories have explicit mode 0755 even with a restrictive umask.
This is not a single atomic transaction across all pages: visitors can briefly
see mixed versions while publication runs. A private lock prevents this runner
from publishing concurrent releases. It cannot lock out unrelated deployment
tools. Another writer in the tiny interval between the final check and rename
can still be overwritten; no other site edits may run during application or
rollback. Do not represent this package as protection against uncoordinated
simultaneous server mutations.

Any handled application error triggers restoration of the original listed
files. If another writer has produced an unexpected third version, recovery
stops rather than overwriting it. Do not repeat `apply` after an interruption.
Inspect the private `state.json` and recover the same release:

```sh
python3 patch_site.py rollback --release EXACT_RETURNED_RELEASE_ID
python3 patch_site.py verify --release EXACT_RETURNED_RELEASE_ID
```

Rollback checks all listed paths first, restores originals, removes only
unchanged new payloads, and removes newly created directories only when empty.
A forced process kill/power failure may leave a partial apply; the frozen
originals and journal support this explicit recovery. Verification covers
listed changed paths, not the entire server, public HTTP caches, UI behavior,
provider model outputs, or service deployment.

## Local checks

```sh
python3 test_patch_site.py
```

The test suite uses temporary local directories. It covers exact counts,
UTF-8/line endings, paths, symlinks/hard links, frozen payload integrity,
concurrent edits, rollback, permissions, new and existing overlays, and a
simulated mid-publication write failure. No test contacts the deployed site.
