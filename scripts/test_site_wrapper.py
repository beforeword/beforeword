"""Guard the current published wrapper without fetching or rendering a website."""
import re
import unittest

import site_wrapper


def template(language):
    return (f'<!doctype html><html lang="{language}"><head>'
            '<meta charset="utf-8"><link rel="stylesheet" href="/model/assets/example.css">'
            '</head><body><header class="bw-header">old</header>'
            '<main id="main"><p>Text &amp; exact writing: «Если A, то B».</p></main>'
            '<footer class="bw-footer">old</footer><p id="copy-status"></p></body></html>')


class PublishedWrapper(unittest.TestCase):
    def test_content_preserved_while_current_navigation_and_theme_are_retained(self):
        snapshot = site_wrapper.load()
        for language in ('ru', 'en'):
            for evaluation in (False, True):
                with self.subTest(language=language, evaluation=evaluation):
                    source = template(language)
                    result = site_wrapper.apply(source, language, evaluation=evaluation)
                    route = 'model/' + ('evaluation/' if evaluation else '') + ('en/' if language == 'en' else '') + 'index.html'
                    wrapper = snapshot['pages'][route]
                    self.assertIn(wrapper['header'], result)
                    self.assertIn(wrapper['footer'], result)
                    self.assertEqual(re.search(r'<main.*?</main>', result).group(),
                                     re.search(r'<main.*?</main>', source).group())
                    self.assertIn('<p id="copy-status"></p>', result)
                    self.assertLess(result.index(snapshot['before_styles']), result.index('<link rel="stylesheet"'))
                    for asset in snapshot['external_assets']:
                        self.assertEqual(result.count('"' + asset + '"'), 1)
                    self.assertIn('/assets/beforeword/beforeword-reader.js?v=0.3.1', result)
                    self.assertIn('/assets/book-shell-20261011.js?v=0.3.0', result)

    def test_missing_ambiguous_and_already_wrapped_inputs_stop(self):
        source = template('ru')
        for invalid in (source.replace('</head>', ''),
                        source.replace('<header class="bw-header">old</header>', ''),
                        source.replace('</body>', '</body></body>'),
                        source.replace('</body>', '<footer class="bw-footer">another</footer></body>'),
                        site_wrapper.apply(source, 'ru')):
            with self.subTest(source=invalid), self.assertRaises(ValueError):
                site_wrapper.apply(invalid, 'ru')

    def test_wrong_language_stops(self):
        with self.assertRaises(ValueError):
            site_wrapper.apply(template('ru'), 'en')


if __name__ == '__main__':
    unittest.main()
