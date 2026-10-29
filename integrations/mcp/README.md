# beforeword MCP · 1.4.1

An MCP tool and embedded view keep exact writing beside a short reading. A written word does not become what it names; “names” is also written. Literal citation checks do not certify a reading's truth or semantic quality. Practical requests remain practical requests.

The current chat's model proposes the reading. This server never calls an upstream model, loads a model key, reads browser history, or opens the existing beforeword API database.

## Run and test

Use Node.js 22 or later (24 recommended):

```sh
npm ci --ignore-scripts
npm run build
npm test
npm start
```

The view is bundled locally with the pinned official MCP Apps SDK into `dist/app.html`; there are no CDN imports or view network requests. `public/preview.html` is an explicitly synthetic development host and is excluded from production. `lib/analysis-core.cjs` is a byte-for-byte copy of the browser validator; provenance and tests detect drift. The production bundle is self-contained, without a sibling browser directory.

The server listens only on `127.0.0.1:8788`. `POST /mcp` serves current MCP and stateless 2025 clients. `GET /health` returns version/readiness only. No session, subscription or GET event stream is maintained.

## Contract

| Tool | Input | Effect |
| --- | --- | --- |
| `open_beforeword` | optional `source`, optional `locale: "ru" \| "en"` (default `en`) | Opens the view; a supplied source creates an immutable revision labelled `suppliedBy: "host"`. |
| `submit_source` | `source`, `locale` | Creates a revision labelled `suppliedBy: "app"`; intended for a deliberate panel action. App-only visibility is a host routing hint, not authentication. |
| `show_reading` | `sourceId`, `report` | Validates compact v3 structure and exact quote occurrences against that revision, then returns source and reading together. Does not retain the reading. |

The fixed v3 report is `{language, items:[{quote:{text, occurrence}, reading}]}`. It contains 1–5 items. Quotes are at most 1,200 UTF-16 units; readings at most 800. Occurrence numbers start at zero and count overlapping exact matches. The server derives `start`/`end`; supplied offsets, additional fields, a different language, normalized or otherwise altered quotations are rejected.

Successful `structuredContent` is `{sourceId, source, locale, suppliedBy, expiresAt, maxChars, ttlSeconds, reportVersion, report, validation}`. An empty view has null sourceId/expiry/provenance/report. A validated report has `validation: "literal-quotes-only"`. Plain text content provides the same source, capability, expiry, quotes and reading when a host has no embedded view.

`suppliedBy` describes the tool route. It does not prove the original author, a human action, or agreement with source material outside the received string. Source markup remains data and the view uses safe DOM construction.

## Temporary data and limits

- Exact received source and its locale/route/expiry are stored only in process memory. Source strings are never trimmed or normalized.
- A random 256-bit sourceId is a bearer capability for one revision. Keep it in the current conversation. There is no account or OAuth access boundary; anyone who has a valid capability can use it. No tool lists revisions.
- Capabilities expire 30 minutes after creation; access does not extend expiry. Expiry schedules deletion; a process restart clears all revisions. JavaScript memory management does not promise forensic erasure. Host conversation retention is separate.
- At most 256 revisions and 4 MiB of source UTF-16 storage are retained. A full store rejects a new revision rather than evicting an unexpired one. A source is at most 12,000 UTF-16 units.
- HTTP bodies are capped at 128 KiB. There are at most 32 active requests and 64 connections, with bounded request/header timeouts. Per-IP limits are 60 requests per minute, with a global 600-request limit and at most 2,048 in-memory IP counters. Stale counters are purged on another request; all counters disappear on restart.
- The application writes no source, report, capability or IP logs and has no persistent store. An external reverse proxy must separately disable MCP access/body logging and request-body disk buffering; that configuration is part of deployment, not this code's guarantee.

Unknown and expired capabilities both return `SOURCE_NOT_FOUND`. Tool errors include `EMPTY_INPUT`, `INPUT_TOO_LONG`, `INVALID_INPUT`, `INVALID_LANGUAGE`, `INVALID_REPORT`, `INVALID_CITATION`, `REPORT_TOO_LARGE`, and `STORE_FULL`; MCP schema failures can also be protocol validation errors. HTTP guards return `RATE_LIMITED`, `BODY_TOO_LARGE`, `HOST_OR_ORIGIN_DENIED` and other bounded codes without echoing submitted data.

## Host and reverse-proxy configuration

`PORT` defaults to 8788. `BEFOREWORD_MCP_HOSTS` is an exact comma-separated authority allowlist, default `localhost:8788,127.0.0.1:8788,beforeword.xyz`. `BEFOREWORD_MCP_ORIGINS` defaults to the exact HTTPS origins for beforeword.xyz, chatgpt.com and claude.ai. Absent Origin is accepted for non-browser MCP clients; other present origins are rejected. There is no wildcard or credential-bearing CORS.

`BEFOREWORD_MCP_TRUST_PROXY=1` trusts a single valid `X-Real-IP` only from a loopback peer. Use it only behind the local proxy that overwrites this header with the actual peer address. Forwarded address headers are ignored otherwise. The proxy must preserve `/mcp`, set `Host: beforeword.xyz`, and omit cookies/authorization not used by this unauthenticated service. Health probes in proxy mode also provide a valid X-Real-IP.

The UI resource is `ui://beforeword/1.4.1/app-c4d9c40552abff2447c774abc5cf463805b0084e75571fecdd91a46e157e74dc.html`, MIME `text/html;profile=mcp-app`, with no allowed external connections, resources or frames. Official MCP Apps metadata is accompanied by OpenAI-compatible resource metadata. A real host installation remains a separate test; local protocol and synthetic UI tests do not establish portal acceptance.

SDK references: [HTTP serving](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md), [MCP Apps quickstart](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/quickstart.md). Versions are pinned in package.json and package-lock.json.
