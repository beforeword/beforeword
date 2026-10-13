# Wiktionary definition fixtures

These nine JSON files are public definition and heading extracts from the English and Russian Wiktionary Action API, retrieved on 2026-10-13. They are test fixtures, **not an offline dictionary or a claim of vocabulary coverage**.

Each file retains its page title, exact revision ID, retrieval URL/date, and SHA-256 of the original response. Examples, quotations, translation tables and navigation were removed before redistribution. Definition wording was not paraphrased. Running the JavaScript parser on the original and reduced responses produced identical results for these nine fixtures.

Definitions and labels are by Wiktionary contributors, available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This extracted fixture data is distributed under the same license. The application source has its own license. The relevant page and contributor history can be reached with the title and revision in each file:

- English: `https://en.wiktionary.org/w/index.php?title=TITLE&oldid=REVISION`
- Russian: `https://ru.wiktionary.org/w/index.php?title=TITLE&oldid=REVISION`
- History: replace `oldid=REVISION` with `action=history`.

Source guidance: [Wiktionary copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights), [Wikimedia terms of use](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use), and [MediaWiki cross-site requests](https://www.mediawiki.org/wiki/API:Cross-site_requests).

The current entry comes from Wiktionary on an explicit lookup. Only the selected word or short expression is sent; the original passage is not sent by dictionary mode. The API response revision is recorded, with a source permalink. Rendering an old revision may use current templates; the retained definition text is the text actually extracted in that response, not a claim of immutable historical template output.
