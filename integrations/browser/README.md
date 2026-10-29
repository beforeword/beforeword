# beforeword browser integration

The Chrome extension is version **0.5.8** and includes the exact English core instruction **1.4.1**. The website, extension and instruction have separate release versions.

The reading result pairs an exact excerpt with a short account of what the proposed reading adds. The source stays visible; the explanation is labeled as added writing. Six constructed examples work without a model request. New reports do not require empty grounds or further questions. Existing reports remain readable.

## Layout

- `extension/`: Manifest V3 browser runtime, RU/EN interface, prepared examples and direct-provider adapters.
- `server/`, `app.js`, `package.json`: optional introductory API and homepage API. Node 24 or later is required by its SQLite storage.
- `tools/`: protocol, DOM and service tests, plus the deterministic Chrome packager. Tests use synthetic fixtures; those do not establish live provider behavior.

No credentials, user passages, deployment account configuration or quota database belong in this directory. The server needs its own environment settings; publishing browser files does not configure a server.

## Build

From this directory:

```sh
python3 -B tools/build-chrome.py --output build
```

The output is `beforeword-0.5.8-chrome.zip`. Its approved SHA-256 is `a3b33786d3e9a9cbd72ce1233948a4c736f4b199fbf85e0b2c1032ea27aa2495`. The complete English core SHA-256 is `b861f132d6535d26c37358cf379749d16c7b3ce1888547e0375cdc3985e5e7c2`.

The ZIP has `manifest.json` at its root and contains only the 33 allowlisted browser resources. Its sidecar manifest records every file hash. The builder verifies a second identical build and checks the ZIP contents byte for byte.

## Verify

The DOM tests use `linkedom`; install the pinned development dependencies with `npm ci`. They are not shipped in the extension. Use Node 24 or later for service tests.

```sh
npm test
python3 -B tools/build-chrome.py --output build
```

Real browser interaction, provider account eligibility and live model responses require separate checks. An unchecked provider/account mode prevents passage submission; it is not proof of a provider's settings. See the built-in data page and the current provider profiles for exact requirements and unavailable modes.

The introductory connection uses beforeword and OpenAI. Personal API keys are held temporarily by the extension and requests go to the explicitly selected provider. Model discovery sends the key without the selected passage. Neither a prepared example nor ordinary selection starts a model request.

The published data policy is [available in English](https://beforeword.xyz/extensions/privacy/en/) and [Russian](https://beforeword.xyz/extensions/privacy/).

The retained `manifest.safari.json` is a historical 0.5.6 template outside the Chrome package. It is not a tested or signed Safari 0.5.8 release. The optional server’s `candidate-1.3.6` profile remains a separately selected historical experiment; its stable path uses the current full 1.4.1 instruction. These source files and tests do not establish deployment, native installation or store approval.
