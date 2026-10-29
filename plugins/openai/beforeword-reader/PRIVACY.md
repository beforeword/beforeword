# beforeword directory reader · Privacy

Applies to the 1.4.1 remote MCP reader at `https://beforeword.xyz/mcp`. Updated 30 October 2026. Earlier skills-only packages did not call this service; the Chrome extension has its own privacy notice. Contact: [mail@beforeword.xyz](mailto:mail@beforeword.xyz).

## What reaches beforeword

When the reader is invoked, the host sends the supplied source text and interface language. Text deliberately submitted from the reader also reaches the same server. Editing alone stays in the panel until submission. A proposed reading and its quotations reach the server for citation validation. Do not supply material you do not want this service and your chat platform to process.

The reader stores each exact source, locale, tool-route label, random source identifier and expiry time in server memory. The tool-route label records whether the source arrived through the host or app tool; it does not authenticate authorship. The fixed lifetime is at most 30 minutes and is not extended by reading. A server restart also removes these records. Capacity is limited to 256 revisions and 4 MiB of UTF-16 source text; new submissions are rejected at capacity instead of deleting unexpired revisions.

Proposed readings are validated and returned, not added to the source store. The application does not persist source text or readings in a database or text logs, call a model provider, train a model, use advertising analytics, or sell this text. The current chat model creates the reading under the host platform's independent policies.

## Access and operational data

No beforeword account or OAuth connection is used. A random 256-bit source identifier grants temporary access to that revision until expiry. The host and current conversation can receive it; treat it as a temporary capability, not a public sharing link. The app does not put source identifiers into URLs. This is not an account-based private document vault.

The service uses in-memory network-address counters in 60-second windows to limit requests, bounded to 2,048 addresses. The reverse proxy and hosting infrastructure may retain ordinary access/error records, including IP addresses and request metadata. Those infrastructure records are separate from the temporary text store; the 30-minute lifetime is not a promise that infrastructure records or host-chat copies disappear. The application emits fixed operational messages, not source text or capability values.

Editing creates another source revision; it does not erase the earlier one before its expiry. Closing the view does not delete copies retained by the chat platform. The reader has no persistent document library, export to third parties or account-history retrieval.

## Limits and contact

The citation check establishes only that an exact excerpt occurs at the indicated position in the exact text received by this service. It does not establish the origin, truth or correct meaning of either text. ChatGPT, Claude and any other host have their own retention and training settings; consult those policies separately.

For questions or an incident, contact [mail@beforeword.xyz](mailto:mail@beforeword.xyz). Do not put private source text or a live source identifier into a public issue.
