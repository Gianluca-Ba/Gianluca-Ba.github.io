#!/usr/bin/env python3
"""Build the static portfolios. No third-party dependencies required."""
from pathlib import Path
from html import escape, unescape
import json
import re

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ('it', 'en', 'ja')
PAGES = ('index.html', 'experience.html', 'about-me.html',
         'education-and-certifications.html', 'cv.html')
CATALOG = json.loads((ROOT / 'content/translations.json').read_text())
ORIGIN = 'https://gianluca-ba.github.io'


def translate(text, language):
    if language == 'en':
        return text
    return CATALOG[text][0 if language == 'it' else 1]


def switcher(language, page, prefix='../'):
    links = []
    for code, name in [('it', 'Italiano'), ('en', 'English'), ('ja', '日本語')]:
        current = ' aria-current="true"' if code == language else ''
        links.append(f'<a href="{prefix}{code}/{page}" lang="{code}" '
                     f'hreflang="{code}" data-language="{code}"{current}>{name}</a>')
    label = translate('Language', language)
    all_languages = translate('All languages', language)
    return (f'<nav class="language-switcher" aria-label="{label}">'
            f'<span class="language-label">{label}</span>' + ''.join(links) +
            f'<a class="language-all" href="{prefix}languages.html?page={page}" '
            f'aria-label="{all_languages}" title="{all_languages}">⋯</a></nav>')


def build_page(language, page):
    html = (ROOT / 'content/templates' / page).read_text()
    def replace_text(match):
        raw = match[1]
        key = ' '.join(unescape(raw).split())
        if not key:
            return match[0]
        value = translate(key, language)
        leading = raw[:len(raw) - len(raw.lstrip())]
        trailing = raw[len(raw.rstrip()):]
        return '>' + leading + escape(value, quote=False) + trailing + '<'
    html = re.sub(r'>([^<]+)<', replace_text, html)
    def replace_attribute(match):
        return match[1] + escape(translate(unescape(match[2]), language), quote=True) + '"'
    html = re.sub(r'((?:content|aria-label)=")([^"]+)"',
                  lambda m: replace_attribute(m) if unescape(m[2]) in CATALOG else m[0], html)
    html = html.replace('<html lang="en">', f'<html lang="{language}">')
    html = html.replace('href="style.css"', 'href="../style.css"')
    html = html.replace('href="resurces/', 'href="../resurces/')
    metadata = '  <link rel="stylesheet" href="../language.css">\n'
    metadata += f'  <link rel="canonical" href="{ORIGIN}/{language}/{page}">\n'
    metadata += ''.join(f'  <link rel="alternate" hreflang="{code}" '
                        f'href="{ORIGIN}/{code}/{page}">\n' for code in LANGUAGES)
    metadata += (f'  <link rel="alternate" hreflang="x-default" '
                 f'href="{ORIGIN}/{page}">\n'
                 '  <script src="../language.js" defer></script>\n')
    html = html.replace('</head>', metadata + '</head>')
    html = html.replace('<body>', '<body>\n  ' + switcher(language, page))
    return html


def build_entry(page):
    """Serve real portfolio content while automatically selecting a locale."""
    html = build_page('en', page)
    html = html.replace(switcher('en', page), switcher('en', page, prefix=''))
    html = html.replace('href="../style.css"', 'href="style.css"')
    html = html.replace('href="../language.css"', 'href="language.css"')
    html = html.replace('src="../language.js"', 'src="language.js"')
    html = html.replace('href="../resurces/', 'href="resurces/')
    html = html.replace('<body>', f'<body data-language-entry="{page}">')
    html = html.replace(f'href="{ORIGIN}/en/{page}"', f'href="{ORIGIN}/{page}"', 1)
    for section in PAGES:
        html = html.replace(f'href="{section}"', f'href="en/{section}"')
    return html


def main():
    for language in LANGUAGES:
        (ROOT / language).mkdir(exist_ok=True)
        for page in PAGES:
            (ROOT / language / page).write_text(build_page(language, page))
    (ROOT / 'languages.html').write_text((ROOT / 'content/language-entry.html').read_text())
    for page in PAGES:
        (ROOT / page).write_text(build_entry(page))
    print('Built 15 localized pages and 5 compatible entry points.')


if __name__ == '__main__':
    main()
