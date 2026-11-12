# Current-version wording follow-up

Apply after the successfully applied boundary deployment. This release changes six HTML pages and the two corresponding entries in model/SHA256SUMS.txt. It does not change instruction, backend, service or historical-output bytes. The existing data-ecosystem attribute is retained because it is a CSS selector.

    python3 -I -B followup.py prepare
    python3 -I -B followup.py apply
    python3 -I -B followup.py verify
    python3 -I -B followup.py rollback

Preparation requires the exact post-deployment hashes and confirms every declared old-string count and resulting payload hash. All seven files are backed up privately; 151 other public files have read-only hash guards. Local prepare/apply/verify/rollback and all 112 model checksum entries passed.

The private state is /root/beforeword-boundary-20261112/wording-followup-state. Roll back this follow-up before rolling back the preceding deployment. The preceding deployment's frozen verification describes its earlier page bytes; use this follow-up verification for the final public state, with the unchanged backend health checks separately.
