# Reader citation validator provenance

The reader uses the pinned literal validator in `lib/analysis-core.cjs` for input shape, exact quotation occurrences and UTF-16 offsets. It does not call that module’s historical request-building functions. The current 1.4.1 instruction is loaded independently from `lib/core.en.txt`, whose SHA is checked at startup and build time.

The validator was recovered from the immutable GitHub blob `c4622f86993e3c83ad0ef269e846a550e9cfc450` in beforeword/beforeword. Its SHA-256 is `cdd7c1c70ae1e63a2ccdd90918bc99e556eb00d2d3c86cda59ff9ea4e603f822`. `tests/fixtures/analysis-core-pinned.cjs` preserves that historical source for byte comparison. Updating the browser extension does not silently change this reader contract. Protocol and citation tests cover the runtime separately.

This source is distinct from the native skills-only plugin in `plugins/openai/beforeword`. The remote reader package identity is `beforeword-reader`; it is under `plugins/openai/beforeword-reader`. Runtime deployment, personal installation, submission, review and public directory approval are separate states. Current receipts are retained outside the source repository; this source tree does not claim approval.
