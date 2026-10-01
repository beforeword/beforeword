# Prepare a release

[Русский](maintaining.ru.md) · [Back](../README.md)

This procedure prepares local files for review. It does not create a repository, publish a Release, modify the website, accept marketplace terms, or change an account.

1. Review changes to the full and compact RU/EN instructions together. Keep quoted material and Unicode distinctions exact. Update the release version and date in the source configuration, package metadata, user-facing instructions, and changelog together. Preserve earlier evaluation records and their instruction hashes.
2. Run the commands under “Checks and evidence” in the README. The CI workflow runs the same local checks without API credentials. Read failures before rebuilding. Package checks cover six particular ZIP structures, selected-language text, safe member paths, and repeated-build equality within the test environment; they are not universal installation certification.
3. Inspect `build/toolkit/` and `build/site/public_html/`. Review both languages, navigation, downloads, copy success and fallback, narrow screens, keyboard navigation, and no-JavaScript content in an available browser before marking visual review complete. A simulated DOM test does not establish rendered layout.
4. Confirm the complete list of public files. Keep keys, personal conversations, local environment files, and account-specific records out of the release. Use a declared public copy when redacting historical metadata; record what was removed and preserve answer text and ratings. Keep local test outputs out of commits unless they are intentionally published fixtures.
5. Record unresolved checks precisely. Earlier model outputs do not apply automatically after an instruction changes. Test an additional model only to address a specific remaining risk; no exhaustive list of models is required to state the instruction's scope.
6. Resolve the owner's licensing/distribution choice before claiming redistribution rights or submitting to a catalog that requires a license. Do not insert a license or vendor endorsement on the owner's behalf.
7. Prepare versioned downloadable files and a checksum manifest. Review package names, hashes, and instructions against the same source revision. A later correction receives a new version rather than replacing a published file under its old name.
8. Before website deployment, compare the prepared files with the current website project. The generated tree is limited to `/model/`; preserve unrelated pages and settings. Any navigation patch needs the actual current source. Mark publication complete only after the approved destination contains the reviewed files and its links work.

The existing homepages may contain an earlier instruction in `pre#bwk-instruction`. After obtaining the current website archive, use `scripts/prepare_homepage_patch.py --site CURRENT_PUBLIC_HTML --output NEW_EMPTY_PATCH_OUTPUT`, replacing both directory placeholders. This prepares a separate patch for `index.html` and `en/index.html`: only the instruction block is replaced, other bytes are preserved, and a manifest records hashes. Compare the patch with the current source before deployment. Do not generate it from an old cached homepage or treat patch preparation as a live website edit.

After a real GitHub repository and Release exist, add their exact URLs to the documentation and website. Do not publish placeholder owner names, speculative download URLs, or a claim that generated pages are already live. Attach the reviewed files to the selected Release and record its source commit and version. Keep build output out of the source tree; use the local `build/` directory or CI artifacts for review.

Public bundles must include the same applicable README, changelog, and maintenance material as the repository. Check the source-bundle allowlist when introducing new top-level files. If the owner later supplies a license, include the exact approved file in the relevant distributions and rebuild their hashes.

For a complete integration patch, use `prepare_site_release.py` followed by `verify_site_release.py` as described in the README. They record and verify source hashes, both homepage changes, sitemap changes, and links against the combined website tree.
