"""Keep current public model content and shell while updating exact payloads."""
import hashlib,html,re,unittest
from html.parser import HTMLParser
import current_model_wrapper as wrapper

class Ids(HTMLParser):
    def __init__(self):super().__init__();self.ids=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if 'id' in d:self.ids.append(d['id'])

class CurrentModel(unittest.TestCase):
    def apply(self,language,evaluation=False):
        generated='<html><head><title>Selected report</title><link rel="stylesheet" href="/model/assets/public-1.4.1-7fe920efa6e1.css"></head><body><main id="main" tabindex="-1"><h1 id="title">Selected report</h1><p>Fresh report content.</p></main></body></html>'
        return wrapper.apply(generated,language,evaluation=evaluation,core='Exact & core <value>\nЯ «текст».\n',version='1.4.1',date='2026-10-30',description='Fresh description')
    def test_model_keeps_current_proposal_and_shell(self):
        for language in ('ru','en'):
            with self.subTest(language=language):
                before=wrapper.load(language);after=self.apply(language)
                # Header, rail, footer and settings dialog are exact, including
                # current navigation, wordmark, accessibility labels and handlers.
                for pattern in [r'<header class="site-header".*?</header>',r'<div class="rail".*?</nav></div>',r'<footer\b.*?</footer>',r'<dialog\b.*?</dialog>']:
                    self.assertEqual(re.search(pattern,before,re.S).group(),re.search(pattern,after,re.S).group())
                value=re.search(r'<textarea\b[^>]*id="instruction-text"[^>]*>(.*?)</textarea>',after,re.S).group(1)
                self.assertEqual(html.unescape(value),'Exact & core <value>\nЯ «текст».\n')
                self.assertEqual(len(re.findall(r'_(?:RU|EN)_1\.4\.1\.zip',after)),3)
                for section in ['principle','fact-word','learning-and-acceptance','instrument','example','requirements','interfaces','risks','development-plan','plan-1','plan-2','plan-3','plan-4','plan-5','plan-6','response']:
                    pattern=r'<section\b[^>]*id="'+section+r'"[^>]*>.*?</section>'
                    self.assertEqual(re.search(pattern,before,re.S).group(),re.search(pattern,after,re.S).group())
                self.assertNotIn('/assets/book-shell-20261011',after)
                self.assertIn('/model/assets/brand-1.4.1/favicon.svg',after)
                self.assertIn('name="beforeword-version" content="1.4.1"',after)
                ids=Ids();ids.feed(after);self.assertEqual(len(ids.ids),len(set(ids.ids)))
    def test_report_main_updates_and_legacy_marks_are_removed(self):
        for language in ('ru','en'):
            before=wrapper.load(language,True);after=self.apply(language,True)
            self.assertIn('Fresh report content.',after)
            self.assertNotIn('class="brand-mark"',after)
            self.assertIn('/assets/ui-20261018-v8/navigation.js',after)
            self.assertEqual(after.count('style="width:9em;height:auto;max-width:100%"'),2)
            self.assertNotIn('style="color:#eeeae0"',after)
            for tag in re.findall(r'<link\b[^>]*(?:canonical|hreflang)[^>]*>',before):self.assertIn(tag,after)
    def test_invalid_generated_document_is_rejected(self):
        with self.assertRaises(ValueError):wrapper.apply('<html></html>','ru',evaluation=False,core='x',version='1.4.1',date='2026-10-30',description='x')

if __name__=='__main__':unittest.main()
