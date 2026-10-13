# Updating the public instruction pages

The model-page build uses the selected core and the shared RU/EN update data.
Version 1.3.4 also retains the published book header, footer, theme controls and
text-selection reader on both instruction and evaluation pages. The exact
wrapper captured on 13 October 2026 is in
`assets/site-wrapper/published-20261013.json`; source-page hashes are included.
The build applies it only to the four expected routes and stops if the base
template has missing, duplicate or already replaced wrapper elements.

The wrapper uses existing root-site assets listed in `model/release.json` under
`external_site_assets`. In particular, the reader remains at 0.3.1 and the book
shell script at 0.3.0. These are separate component versions, not instruction
versions. This build does not replace those assets or rebuild the rest of the
website. Changing the published shell later requires updating its captured
wrapper deliberately.
To include the homepage, supply current copies of the deployed `index.html`
and `en/index.html` in a separate input directory:

```sh
python3 scripts/build_public.py --output build/site --github-url https://github.com/beforeword/beforeword --home-source /absolute/path/to/current-homepages
```

The optional homepage step replaces the shared update panel, its asset links,
the full and 5,000-character copy targets, character counts and the edition
note. It preserves the rest of each supplied page. Missing or ambiguous targets
stop the build; it does not reconstruct the homepage from an older template.
The inputs remain unchanged. It does not fetch pages or deploy the result.

Use current source pages whenever other homepage changes have been published.
For hosting, compare the built files with a fresh deployed baseline and prepare
only changed files. Retain an exact backup and check each old hash before
replacement. The archive paths are relative to the existing webroot, without
an additional `public_html/` wrapper. Other homepage assets remain on the site.
Generated checksums must be calculated after the wrapper has been applied.
The 1.3.4 ZIP timestamps use the instruction release date; historical downloads
are not regenerated. Local source and packaging checks do not establish model
behavior or replace inspection of the published pages.

The 1.3.3 website copy revision explains the completed comparison and updates
stale homepage copy targets. It does not change the retained instruction text,
repeat model calls, or submit a new directory package. Earlier source states
and release artifacts remain available through their Git commits.
