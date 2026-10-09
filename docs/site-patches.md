# Updating the public instruction pages

The model-page build uses the selected core and the shared RU/EN update data.
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
For hosting, put the contents beneath `build/site/public_html/` into the existing
webroot. The archive must contain `index.html`, `en/index.html` and `model/`,
without an additional `public_html/` wrapper. Other homepage assets remain on
the existing site.

The 1.3.3 website copy revision explains the completed comparison and updates
stale homepage copy targets. It does not change the retained instruction text,
repeat model calls, or submit a new directory package. Earlier source states
and release artifacts remain available through their Git commits.
