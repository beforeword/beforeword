# Beforeword boundary deployment, 2026-11-12

Run only from the authorized root console after checking the archive SHA256. Source release: 1.4.2, GitHub b9631a157ce1c0ac825941f654418e12ca04d9d5. Other deployment tools must remain idle.

Commands, from the extracted directory:

    python3 -I -B deploy.py prepare
    python3 -I -B deploy.py apply
    python3 -I -B deploy.py verify
    python3 -I -B deploy.py rollback

Prepare checks all three fixed roots, current byte hashes, required absence, exact replacement counts, read-only guards and the two confirmed systemd units; it stores private originals and a frozen plan without changing public or service code. Apply repeats preflight, publishes listed changed files only, checks local prompt contracts, restarts beforeword-api.service and beforeword-mcp.service, and checks the services and files again. A handled failure restores changed targets and restarts the same services. An unexpected third version is preserved and recovery is reported. After a forced interruption use rollback, never repeat apply blindly.

The private journal/backups are /root/beforeword-boundary-20261112/deploy-state. Atomic replacement is per file, not one transaction across the website and services. The private lock coordinates this runner; it cannot coordinate unrelated writers.

Public scope: 116 exact text replacements in 37 files and 61 hash-gated overlays, for 98 changed files. The model checksum list has 112 checked entries and 56 read-only guards. Original historical pages and evaluation outputs remain preserved; the site checksum list is reconciled separately from the immutable source downloads.

API scope: canonical instruction wrapper, one require-target change in answer-modes.cjs, and one new hash-pinned profile adapter. Existing answer/config/transport/provider code is preserved. MCP scope: core.en.txt and core-provenance.json only. The MCP instruction becomes 1.4.2; implementation and UI remain 1.4.1, with no claim of a UI upgrade.

After successful file/service checks, exactly the three task-created public export ZIPs are hash-checked and moved into private export-backup. They are not deleted; subsequent rollback leaves these exports private.

Health checks cover local Node prompt contracts and systemd active/running plus the fixed working directories. They do not establish remote provider answers, browser behavior, HTTP/CDN caches or external hosted services. Perform the browser acceptance checks separately.

Optional standalone hosted-HF check (no model calls, no credentials, no installation):

    python3 -I -B check_hf_live.py

This HF check is separate from the VPS transaction.
