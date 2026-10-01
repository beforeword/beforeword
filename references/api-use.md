# API: local preparation and response reading

Use Python 3.10+; no external Python packages are required. The scripts build and read local files. They never contact a provider, read a key, or incur API charges. Commands below use Bash/POSIX shell syntax. Run them from a separate working directory; generated output cannot overwrite this package or an input file.

## Prepare

Set `BEFOREWORD_DIR` to the unpacked package directory and set `BEFOREWORD_MODEL` to a model available for the selected endpoint. These two variable names are package conventions. Keep the request in a UTF-8 `input.txt`; the CLI preserves its line endings, whitespace and Unicode without normalization. The `--language` switch selects the instruction language, not a mandatory output language.

Start in the unpacked repository root. The following commands create a separate temporary working folder and ask for a model ID; no provider call is made:

```bash
BEFOREWORD_DIR="$(pwd)"
BEFOREWORD_WORK="$(mktemp -d)"
cd "$BEFOREWORD_WORK"
printf '%s\n' 'Examine this written phrase: I understand.' > input.txt
printf 'Available model ID: '
read -r BEFOREWORD_MODEL
test -n "$BEFOREWORD_MODEL" || exit 1
```

```bash
python3 "$BEFOREWORD_DIR/scripts/build_payload.py" openai \
  --model "$BEFOREWORD_MODEL" --language ru \
  --input-file input.txt --output request.json
```

Provider arguments: `openai`, `anthropic`, `gemini`, `grok`, `deepseek`, `qwen`, `mistral`. Only Anthropic uses `--max-tokens` (default 2048); choose a supported value for the task and model. No sampling, reasoning or tool settings are added automatically. The formatter accepts empty text without altering it; the remote API may reject empty requests.

## Send deliberately

`api.json` provides each method, endpoint, header and key-variable placeholder. A generated JSON body is not an entire HTTP request. Read the selected provider entry before sending. Obtain/configure credentials through the provider's own account tooling; do not put them into the HTML guide, instruction, input, history, or shared response examples.

Example for OpenAI, assuming `OPENAI_API_KEY` is already configured locally:

```bash
curl --silent --show-error --request POST \
  'https://api.openai.com/v1/responses' \
  --header "Authorization: Bearer $OPENAI_API_KEY" \
  --header 'Content-Type: application/json' \
  --data-binary @request.json \
  --dump-header response.headers --output response.json \
  --write-out '%{http_code}\n'
```

This command sends the text to the provider and may incur charges when run. For another provider replace the endpoint and headers together using `api.json`; changing only the hostname is insufficient. Qwen requires the full regional/workspace-compatible endpoint in `QWEN_CHAT_ENDPOINT`; the package supplies no guessed default. Anthropic uses `x-api-key` and `anthropic-version`, with a workspace header only where required. Gemini uses `x-goog-api-key`.

Inspect the HTTP status before interpreting the body. For 400/404 inspect fields, endpoint, model and supported settings; for 401/403 check access and region; for 429 inspect provider rate limits and `Retry-After` if present. Preserve the error body. Do not retry charges indefinitely or treat transport failures as model answers. A non-JSON or streamed response needs the provider's own parser.

## Read a saved response

```bash
python3 "$BEFOREWORD_DIR/scripts/extract_response.py" openai \
  --response-file response.json --output answer.json
```

The extractor handles the seven non-streaming text response shapes. It preserves `text_parts`, raw provider `status`, `finish_reason`, available usage/error fields, and identifies omitted reasoning/tool/non-text block types. `text` concatenates the selected visible text parts without added separators; keep `text_parts` and the original response for exact boundaries. OpenAI/Grok message `phase` stays attached to each part: commentary is not labelled as a final answer. Chat Completions selects choice index 0 by default (`--choice-index` selects another).

An empty text result is not a successful reading. Inspect refusals, omitted blocks, status and finish reason. `incomplete`, `max_tokens` or `length` signals a possible truncated result; inspect the original provider response before evaluating it. The extractor does not turn a partial/error response into a completed answer. It does not process SSE events or Gemini `generateContent` responses.

## Continue a text conversation

Create `history.json` as an ordered JSON array of exact prior text turns, then pass it with the next input:

```json
[
  {"role": "user", "content": "Earlier request, preserved exactly."},
  {"role": "assistant", "content": "Earlier visible answer, preserved exactly."}
]
```

```bash
python3 "$BEFOREWORD_DIR/scripts/build_payload.py" gemini \
  --model "$BEFOREWORD_MODEL" --language ru \
  --history history.json --input-file next-input.txt \
  --output next-request.json
```

All seven formats resend beforeword on each request. Gemini converts these text turns to documented `user_input`/`model_output` steps. The files do not use server-side previous IDs; `store=false` is used where supported by the selected adapter. That flag does not describe every provider data-handling policy.

This portable format stores visible text only. It is not a lossless export of provider-native reasoning, signed blocks, tools, citations, images or audio. Do not strip these out of a native tool/agent conversation and call the result an equivalent continuation; retain native response objects and follow that provider's continuation documentation. Long histories can exceed model context; no silent trimming is performed.

## Evaluate

Record exact request/response files, model ID returned by the provider, endpoint, instruction version and generation settings. Apply `evaluation.md` to the actual visible answer. Local JSON and encoding tests establish formatting behavior only; they do not establish instruction adherence or beforeword as a fact. Run local checks with:

```bash
python3 "$BEFOREWORD_DIR/scripts/test_payload.py"
```

Primary request and response documentation is listed per provider in `api.json`, read for the 2026-10-01 UTC package. Availability and model-specific restrictions remain external to these files.
