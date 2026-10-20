"""Check generated content, localized navigation, shared resources and metadata."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import unittest
import build_languages as build


class Document(HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.tags = []
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class LocalizedSite(unittest.TestCase):
    def test_reproducible_pages(self):
        for language in build.LANGUAGES:
            for page in build.PAGES:
                with self.subTest(language=language, page=page):
                    path = build.ROOT / language / page
                    self.assertEqual(path.read_text(), build.build_page(language, page))

    def test_navigation_and_assets(self):
        for language in build.LANGUAGES:
            for page in build.PAGES:
                path = build.ROOT / language / page
                document = Document(path.read_text())
                with self.subTest(path=path):
                    self.assertIn(('html', {'lang': language}), document.tags)
                    switches = [a for tag, a in document.tags if tag == 'a' and 'data-language' in a]
                    self.assertEqual({a['data-language'] for a in switches}, set(build.LANGUAGES))
                    self.assertEqual([a['data-language'] for a in switches if a.get('aria-current') == 'true'], [language])
                    for tag, attrs in document.tags:
                        href = attrs.get('href', attrs.get('src', ''))
                        url = urlparse(href)
                        if not href or url.scheme or url.netloc:
                            continue
                        destination = (path.parent / unquote(url.path)).resolve()
                        self.assertTrue(destination.is_file(), str(destination))
                        if tag == 'a' and destination.suffix == '.html' and 'data-language' not in attrs:
                            if destination.name == 'languages.html':
                                self.assertEqual(url.query, f'page={page}')
                            else:
                                self.assertEqual(destination.parent, build.ROOT / language)
                    alternates = [a for tag, a in document.tags if a.get('rel') == 'alternate']
                    self.assertEqual({a['hreflang'] for a in alternates}, {'it', 'en', 'ja', 'x-default'})
                    source = Document((build.ROOT / 'content/templates' / page).read_text())
                    # Every original role, paragraph, credential and action survives localization.
                    for tag in ['p', 'li', 'article', 'h1', 'h2', 'h3']:
                        self.assertEqual(sum(t == tag for t, _ in source.tags),
                                         sum(t == tag for t, _ in document.tags))

    def test_compatible_entry_points(self):
        for page in build.PAGES:
            doc = Document((build.ROOT / page).read_text())
            body = next(a for tag, a in doc.tags if tag == 'body')
            self.assertEqual(body['data-language-entry'], page)
            choices = [a for tag, a in doc.tags if 'data-language' in a]
            self.assertEqual({a['href'] for a in choices}, {f'{code}/{page}' for code in build.LANGUAGES})
            self.assertNotIn('Choose your language', (build.ROOT / page).read_text())
            self.assertIn('<h1>', (build.ROOT / page).read_text())

    def test_secondary_language_page(self):
        doc = Document((build.ROOT / 'languages.html').read_text())
        body = next(a for tag, a in doc.tags if tag == 'body')
        self.assertEqual(body.get('data-language-picker'), 'true')
        self.assertNotIn('data-language-entry', body)


if __name__ == '__main__':
    unittest.main()
