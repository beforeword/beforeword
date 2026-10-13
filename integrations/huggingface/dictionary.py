"""Bounded Wiktionary lookup. No generated definitions or model inference.

Only the selected word/expression is sent to one of two fixed Wikimedia hosts.
The parser extracts rendered definition text; it never returns source HTML.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from html.parser import HTMLParser
import json
import re
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_QUERY = 120
MAX_BYTES = 2 * 1024 * 1024
MAX_SENSES = 120
TIMEOUT = 15
EN_POS = {
    "Noun", "Proper noun", "Verb", "Adjective", "Adverb", "Pronoun",
    "Determiner", "Article", "Preposition", "Postposition", "Conjunction",
    "Interjection", "Particle", "Numeral", "Number", "Prefix", "Suffix",
    "Infix", "Circumfix", "Interfix", "Combining form", "Contraction", "Participle",
    "Abbreviation", "Initialism", "Acronym", "Letter", "Symbol", "Phrase",
    "Proverb", "Idiom", "Punctuation mark",
}
REMOVED_TAGS = {"dl", "ul", "ol", "style", "script", "iframe", "object", "embed", "img", "source", "link", "base", "table"}
REMOVED_CLASSES = {
    "example-fullblock", "example-block", "h-usage-example", "h-quotation",
    "reference", "mw-editsection", "HQToggle", "maintenance-line", "citation",
    "quotation", "mw-empty-elt", "defdate", "nyms-toggle", "nyms",
}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)
    parent: "Node | None" = None

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def ancestors(self):
        node = self.parent
        while node is not None:
            yield node
            node = node.parent


class Document(HTMLParser):
    def __init__(self, html: str):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs), parent=self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, value):
        self.stack[-1].children.append(value)


def text_content(node: Node, definition=False) -> str:
    def chunks(item):
        if isinstance(item, str):
            yield item
            return
        classes = set(item.attrs.get("class", "").split())
        if item is not node and (
            item.tag in {"style", "script"}
            or (definition and (item.tag in REMOVED_TAGS or classes & REMOVED_CLASSES))
        ):
            return
        for child in item.children:
            yield from chunks(child)
    # HTML collapses ASCII layout whitespace. NBSP, punctuation and Unicode stay.
    return re.sub(r"[\t\n\r\f ]+", " ", "".join(chunks(node))).strip(" \t\n\r\f")


def validate_query(word: str, language: str) -> str:
    if language not in ("en", "ru"):
        raise ValueError("language must be 'en' or 'ru'")
    if not isinstance(word, str) or not 1 <= len(word.encode("utf-16-le", errors="surrogatepass")) // 2 <= MAX_QUERY:
        raise ValueError("word must contain 1–120 characters")
    if any(unicodedata.category(c).startswith("C") for c in word):
        raise ValueError("word must not contain control characters")
    lookup = word.strip()
    if not lookup or len(lookup.split()) > 8:
        raise ValueError("Choose one word or a short dictionary expression, not a passage")
    if not any(unicodedata.category(c).startswith("L") for c in lookup):
        raise ValueError("word must contain letters")
    if any(not (unicodedata.category(c)[0] in "LMN" or unicodedata.category(c) == "Zs" or c in "-‑'’.") for c in lookup):
        raise ValueError("Use a written word or expression; URLs and namespaces are not accepted")
    return lookup


def source_record(language: str, title: str, revision: int | None = None) -> dict:
    origin = f"https://{language}.wiktionary.org"
    encoded = quote(title, safe="~()*!.'-")
    page = f"{origin}/wiki/{encoded}"
    return {
        "name": "Wiktionary · contributors" if language == "en" else "Викисловарь · участники",
        "url": f"{origin}/w/index.php?title={encoded}&oldid={revision}" if revision else page,
        "pageUrl": page,
        "historyUrl": f"{origin}/w/index.php?title={encoded}&action=history",
        "revision": revision,
        "snapshot": f"revision {revision}" if revision else None,
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
        "extraction": "Rendered definition text; ASCII HTML whitespace collapsed; examples, quotations, references and navigation excluded. No paraphrase. Definitions and labels are dictionary writing.",
    }


def form_links(node: Node, language: str, inflection: bool = False) -> list[str]:
    links = []
    for child in node.walk():
        if child.tag != "a":
            continue
        local = []
        for ancestor in child.ancestors():
            if ancestor is node:
                break
            local.append(ancestor)
        if any(a.tag == "dl" or set(a.attrs.get("class", "").split()) & {"example-fullblock", "example-block"} for a in local):
            continue
        if not inflection and not any("form-of-definition-link" in a.attrs.get("class", "").split() for a in local):
            continue
        href = child.attrs.get("href", "")
        if not href.startswith("/wiki/"):
            continue
        title = unquote(href[6:].split("#", 1)[0]).replace("_", " ")
        try:
            validate_query(title, language)
        except ValueError:
            continue
        if title not in links:
            links.append(title)
    return links


def parse_response(payload: dict, word: str, language: str, lookup: str | None = None) -> dict:
    lookup = lookup or validate_query(word, language)
    transformations = ["trim"] if lookup != word else []
    result = {"query": word, "lookup": lookup, "language": language,
              "status": "missing", "entries": [],
              "source": None, "transformations": transformations}
    if "error" in payload:
        if payload["error"].get("code") == "missingtitle":
            return result
        if payload["error"].get("code") == "invalidtitle":
            raise ValueError("INVALID_INPUT: dictionary title is invalid")
        raise RuntimeError("DICTIONARY_UNAVAILABLE: Wiktionary could not return this entry")
    parsed = payload.get("parse")
    if not isinstance(parsed, dict) or not isinstance(parsed.get("text"), str):
        raise RuntimeError("DICTIONARY_UNSUPPORTED: unexpected dictionary response")
    revision, title = parsed.get("revid"), parsed.get("title")
    if not isinstance(revision, int) or isinstance(revision, bool) or not 1 <= revision <= 2**53 - 1 or not isinstance(title, str):
        raise RuntimeError("DICTIONARY_UNSUPPORTED: entry revision or title unavailable")
    try:
        validate_query(title, language)
    except ValueError:
        raise RuntimeError("DICTIONARY_UNSUPPORTED: entry title is invalid") from None
    if parsed.get("ns", 0) != 0:
        raise RuntimeError("DICTIONARY_UNSUPPORTED: only dictionary entries are accepted")
    result["source"] = source_record(language, title, revision)
    if len(parsed["text"].encode("utf-8")) > MAX_BYTES:
        raise RuntimeError("DICTIONARY_TOO_LARGE: response size exceeds the limit")
    document = Document(parsed["text"]).root
    container = next((n for n in document.walk() if "mw-parser-output" in n.attrs.get("class", "").split()), None)
    if container is None:
        raise RuntimeError("DICTIONARY_UNSUPPORTED: dictionary content container is missing")
    active = False
    language_seen = False
    pos = ""
    heading_id = ""
    meaning = False
    entry = None
    total_senses = 0
    omitted = 0

    def add_list(list_node, candidate, parent_glosses=None, path="", inflection=False):
        nonlocal total_senses, omitted
        parent_glosses = parent_glosses or []
        for index, li in enumerate([n for n in list_node.children if isinstance(n, Node) and n.tag == "li"], 1):
            sense_path = f"{path}.{index}" if path else str(index)
            gloss = text_content(li, definition=True)
            glosses = parent_glosses + ([gloss] if gloss else [])
            if gloss:
                if total_senses >= MAX_SENSES:
                    omitted += 1
                else:
                    candidate["senses"].append({"id": f"{candidate['id']}:{sense_path}", "glosses": glosses,
                                                "formOf": form_links(li, language, inflection)})
                    total_senses += 1
            for nested in li.children:
                if isinstance(nested, Node) and nested.tag == "ol":
                    add_list(nested, candidate, glosses, sense_path, inflection)

    for node in container.children:
        if not isinstance(node, Node):
            continue
        heading_node = node if re.fullmatch(r"h[1-6]", node.tag) else None
        if heading_node is None and "mw-heading" in node.attrs.get("class", "").split():
            heading_node = next((n for n in node.walk() if re.fullmatch(r"h[1-6]", n.tag)), None)
        if heading_node is not None:
            heading = text_content(heading_node)
            level = int(heading_node.tag[1])
            if level == (2 if language == "en" else 1):
                active = heading == ("English" if language == "en" else "Русский")
                language_seen = language_seen or active
                pos, heading_id, meaning, entry = "", "", False, None
                continue
            if not active:
                continue
            entry = None
            if language == "en":
                meaning = heading in EN_POS
                if meaning:
                    pos, heading_id = heading, heading_node.attrs.get("id", heading)
            else:
                meaning = heading in {"Значение", "Значения"}
                if level == 2:
                    qualifier = re.search(r"\(([^)]+)\)", heading)
                    pos = qualifier.group(1) if qualifier else heading
                heading_id = heading_node.attrs.get("id", heading)
            continue
        if not active:
            continue
        inflection = language == "ru" and node.tag == "ul" and not meaning
        if inflection:
            forms = [n for n in node.children if isinstance(n, Node) and n.tag == "li" and re.match(r"^форма\s", text_content(n, True))]
            if not forms:
                continue
            entry = {"id": f"{language}:{revision}:form:{len(result['entries']) + 1}", "word": title, "pos": "словоформа", "senses": []}
            result["entries"].append(entry)
            add_list(Node("ul", children=forms), entry, inflection=True)
        elif node.tag == "ol" and meaning:
            # Separate top-level definition lists have distinct entry identities.
            entry = {"id": f"{language}:{revision}:{heading_id}:{len(result['entries']) + 1}", "word": title, "pos": pos, "senses": []}
            result["entries"].append(entry)
            add_list(node, entry)
    result["entries"] = [entry for entry in result["entries"] if entry["senses"]]
    if result["entries"]:
        result["status"] = "found"
    elif language_seen:
        raise RuntimeError("DICTIONARY_UNSUPPORTED: entry exists, but its definition layout is not supported")
    if omitted:
        result["truncation"] = {"shownSenses": total_senses, "omittedSenses": omitted, "limit": MAX_SENSES}
    return result


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_response(lookup: str, language: str) -> dict:
    validate_query(lookup, language)
    url = f"https://{language}.wiktionary.org/w/api.php?" + urlencode({
        "action": "parse", "format": "json", "formatversion": 2,
        "page": lookup, "prop": "text|revid", "disableeditsection": 1, "disabletoc": 1, "redirects": 1,
    })
    request = Request(url, headers={
        "User-Agent": "beforeword-dictionary/0.4 (https://beforeword.xyz; https://github.com/beforeword/beforeword)",
        "Accept": "application/json", "Accept-Encoding": "identity",
    })
    try:
        deadline = time.monotonic() + 15
        with build_opener(NoRedirects()).open(request, timeout=TIMEOUT) as response:
            if response.status != 200:
                raise RuntimeError("DICTIONARY_UNAVAILABLE: Wiktionary did not return an entry")
            chunks, size = [], 0
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_BYTES:
                    raise RuntimeError("DICTIONARY_TOO_LARGE: entry exceeds the supported response size")
                if time.monotonic() > deadline:
                    raise RuntimeError("DICTIONARY_TIMEOUT: dictionary lookup took too long")
                chunks.append(chunk)
        payload = json.loads(b"".join(chunks))
        if not isinstance(payload, dict):
            raise ValueError("not an object")
        return payload
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        raise RuntimeError("DICTIONARY_UNAVAILABLE: Wiktionary request failed; retry later") from None
    except (json.JSONDecodeError, UnicodeError, ValueError):
        raise RuntimeError("DICTIONARY_UNSUPPORTED: response is not a dictionary record") from None


def lookup_dictionary(word: str, language: str = "en") -> dict:
    """Lookup one selected written word; never infer a sense from a conversation."""
    lookup = validate_query(word, language)
    result = parse_response(fetch_response(lookup, language), word, language, lookup)
    lower = lookup.lower()
    if result["status"] == "missing" and lower != lookup:
        alternate = parse_response(fetch_response(lower, language), word, language, lower)
        alternate["transformations"] = (["trim"] if lookup != word else []) + ["lowercase"]
        result = alternate
    if result["entries"] and any(e["word"] != result["lookup"] for e in result["entries"]):
        result["transformations"].append("source-redirect")
    return result
