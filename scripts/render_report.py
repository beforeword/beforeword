"""Render the evaluation reports' deliberately small Markdown vocabulary safely.

Unsupported block syntax or report links stop the build instead of losing text.
The Markdown files remain the downloadable sources of the HTML pages.
"""
from __future__ import annotations

import html
import re

REPORT_ASSETS = frozenset({
    'eval-cases.jsonl', 'evaluation-results.json', 'validation-2026-10-02.json',
})
_INLINE = re.compile(r'`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)')
_UNSUPPORTED_BLOCK = re.compile(r'^(?:#{1,6}\s|\s*[-*+]\s|\s*>|\s*```|\s*~~~|\s*<|\s*\d+[.)]\s)')


def inline(text: str) -> str:
    """Escape text and accept only inline code or links to known report assets."""
    pieces = []
    cursor = 0
    for match in _INLINE.finditer(text):
        pieces.append(html.escape(text[cursor:match.start()], quote=True))
        code, label, target = match.groups()
        if code is not None:
            pieces.append('<code>'+html.escape(code, quote=True)+'</code>')
        else:
            if target not in REPORT_ASSETS:
                raise ValueError('Unsupported evaluation report link: '+str(target))
            pieces.append('<a href="/model/reports/'+target+'" download="'+target+'">'+html.escape(label, quote=True)+'</a>')
        cursor = match.end()
    pieces.append(html.escape(text[cursor:], quote=True))
    return ''.join(pieces)


def _cells(line: str) -> list[str]:
    if not line.startswith('|') or not line.endswith('|'):
        raise ValueError('Evaluation table rows require opening and closing pipes.')
    cells = [cell.strip() for cell in line[1:-1].split('|')]
    if not cells or any(not cell for cell in cells):
        raise ValueError('Empty evaluation table cell.')
    return cells


def parse_report(source: str) -> tuple[str, str]:
    """Return the exact H1 title and HTML for every remaining source block."""
    lines = source.splitlines()
    if not lines or not lines[0].startswith('# ') or len(lines[0]) < 3:
        raise ValueError('Evaluation report must start with one H1 title.')
    title = lines[0][2:]
    output = []
    index = 1
    section = 0
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue
        if line.startswith('## '):
            section += 1
            output.append('<h2 id="report-section-'+str(section)+'">'+inline(line[3:])+'</h2>')
            index += 1
            continue
        if re.match(r'^\d+\. ', line):
            items = []
            expected = 1
            while index < len(lines) and re.match(r'^\d+\. ', lines[index]):
                match = re.fullmatch(r'(\d+)\. (.+)', lines[index])
                if not match or int(match.group(1)) != expected:
                    raise ValueError('Evaluation report ordered list must be consecutive from 1.')
                items.append('<li>'+inline(match.group(2))+'</li>')
                expected += 1
                index += 1
            output.append('<ol>'+''.join(items)+'</ol>')
            continue
        if line.startswith('|'):
            if not section:
                raise ValueError('Evaluation report table requires a preceding section heading.')
            headers = _cells(line)
            index += 1
            if index >= len(lines):
                raise ValueError('Evaluation table lacks a separator.')
            separator = _cells(lines[index])
            if len(separator) != len(headers) or any(not re.fullmatch(r':?-{3,}:?', cell) for cell in separator):
                raise ValueError('Invalid evaluation table separator.')
            index += 1
            rows = []
            while index < len(lines) and lines[index].startswith('|'):
                cells = _cells(lines[index])
                if len(cells) != len(headers):
                    raise ValueError('Evaluation table row width differs from its header.')
                rows.append('<tr>'+''.join('<td>'+inline(cell)+'</td>' for cell in cells)+'</tr>')
                index += 1
            if not rows:
                raise ValueError('Evaluation report table has no data rows.')
            output.append('<div class="report-table" role="region" aria-labelledby="report-section-'+str(section)+'" tabindex="0"><table><thead><tr>'+''.join('<th scope="col">'+inline(cell)+'</th>' for cell in headers)+'</tr></thead><tbody>'+''.join(rows)+'</tbody></table></div>')
            continue
        paragraph = []
        while index < len(lines) and lines[index].strip():
            value = lines[index]
            if value.startswith('## ') or value.startswith('|') or re.match(r'^\d+\. ', value):
                break
            if _UNSUPPORTED_BLOCK.match(value):
                raise ValueError('Unsupported evaluation report block: '+value[:60])
            paragraph.append(value)
            index += 1
        if not paragraph:
            raise ValueError('Unparsed evaluation report block: '+line[:60])
        output.append('<p>'+inline(' '.join(paragraph))+'</p>')
    return title, '\n'.join(output)
