"""Reconcile generated instructions with current published model pages.

No network or publication. The October30 snapshot is separate from older
historical wrappers. A generated instruction update must not restore an older
homepage/header or replace the current authored AI proposal.
"""
from pathlib import Path
import hashlib,html,json,re
ROOT=Path(__file__).resolve().parents[1]
SNAPSHOT=ROOT/'assets/site-wrapper/published-20261030'

def once(source,pattern,replace,label):
    matches=list(re.finditer(pattern,source,re.S))
    if len(matches)!=1:raise ValueError(f'Expected one {label}, got {len(matches)}')
    m=matches[0];value=replace(m) if callable(replace) else replace
    return source[:m.start()]+value+source[m.end():]

def load(language,evaluation=False):
    if language not in ('ru','en'):raise ValueError('Wrong page language')
    route='model/'+('evaluation/' if evaluation else '')+('en/' if language=='en' else '')+'index.html'
    manifest=json.loads((SNAPSHOT/'manifest.json').read_text());raw=(SNAPSHOT/route).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=manifest['pages'][route]['sha256']:raise ValueError('Published source snapshot changed')
    return raw.decode()

def meta(source,name,value):
    def replace(m):
        tag=m.group(0)
        if not re.search(r'(?:name|property)=["\']'+re.escape(name)+r'["\']',tag):return tag
        if re.search(r'content=["\']',tag):
            return re.sub(r'content=("[^"]*"|\'[^\']*\')',lambda _: 'content="'+html.escape(value,quote=True)+'"',tag,count=1)
        raise ValueError('Meta field has no content: '+name)
    return re.sub(r'<meta\b[^>]*>',replace,source)

def external_assets():
    refs=set()
    for language in ('ru','en'):
        for evaluation in (False,True):
            s=load(language,evaluation)
            refs.update(re.findall(r'(?:src|href)=["\'](/assets/[^"\']+)["\']',s))
    return sorted(refs)

def apply(generated,language,*,evaluation,core,version,date,description):
    current=load(language,evaluation);original=current
    generated_main=re.search(r'<main\b[^>]*>.*?</main>',generated,re.S)
    if generated_main is None:raise ValueError('Generated main missing')
    if evaluation:
        current=once(current,r'<main\b[^>]*>.*?</main>',generated_main.group(0),'current report main')
        # The stylesheet payload is unchanged, but the build writes its alias
        # under the selected version. Do not leave the snapshot's old alias
        # pointing at a file absent from the generated release.
        public_css=re.search(r'/model/assets/public-[^"\']+\.css',generated).group(0)
        current=once(current,r'/model/assets/public-[^"\']+\.css',public_css,'report stylesheet alias')
        title=html.unescape(re.search(r'<title>(.*?)</title>',generated,re.S).group(1))
        current=once(current,r'<title>.*?</title>','<title>'+html.escape(title)+'</title>','title')
        for name in ('og:title','twitter:title'):current=meta(current,name,title)
        # The legacy evaluation shell retains its controls and assets; replace
        # only the legacy symbol+name fragment with the approved full wordmark.
        wordmark=(ROOT/'brand/wordmark-light.svg').read_text()
        wordmark=re.sub(r'\s(?:width|height|role|aria-label)="[^"]*"','',wordmark,count=0)
        wordmark=wordmark.replace('<svg ','<svg aria-hidden="true" focusable="false" style="width:9em;height:auto;max-width:100%" ',1)
        wordmark=re.sub(r' style="color:#[a-fA-F0-9]+"','',wordmark)
        wordmark=re.sub(r'(fill|stroke)="#[a-fA-F0-9]+"',lambda m:m.group(1)+'="currentColor"',wordmark)
        pattern=r'<span class="brand-mark" aria-hidden="true"></span><span>beforeword</span>'
        current,count=re.subn(pattern,lambda _:wordmark,current)
        if count!=2:raise ValueError('Expected two legacy evaluation brand fragments')
        current,count=re.subn(r'<span class="brand-mark" aria-hidden="true"></span>','',current)
        if count!=1:raise ValueError('Expected one decorative legacy help mark')
    else:
        current=once(current,r'(<textarea\b[^>]*id="instruction-text"[^>]*>).*?(</textarea>)',lambda m:m.group(1)+html.escape(core,quote=False)+m.group(2),'current full instruction')
        # Update only current-version package links, never historical reports.
        current,count=re.subn(r'(https://beforeword\.xyz/model/downloads/beforeword_(?:openai_local_marketplace|claude_plugin|skill)_(?:RU|EN)_)\d+\.\d+\.\d+(\.zip)',lambda m:m.group(1)+version+m.group(2),current)
        if count!=3:raise ValueError('Expected exactly three current package links')
        label=('Полная инструкция · ' if language=='ru' else 'Full instruction · ')+version
        review_url='/model/evaluation/'+('en/' if language=='en' else '')
        review_label='Проверки инструкции: ответы и ограничения' if language=='ru' else 'Instruction checks: answers and limits'
        current=once(current,r'(<section class="s-section" id="medium-details">.*?</h2>)',lambda m:m.group(1)+'<p class="s-release-version">'+label+'</p><p class="s-release-review"><a href="'+review_url+'">'+review_label+'</a></p>','instruction version and review link')
        prefix='Выученными словами заменили себя, других и мир. ' if language=='ru' else 'Learned words have replaced ourselves, others and the world. '
        current=once(current,r'(<p class="s-lead">)(.*?)(</p>)',lambda m:m.group(1)+prefix+m.group(2)+m.group(3),'current proposal intro')
    for name in ('description','og:description','twitter:description'):current=meta(current,name,description)
    if re.search(r'<meta\b[^>]*name=["\']beforeword-version["\']',current):current=meta(current,'beforeword-version',version)
    else:current=current.replace('</head>','<meta name="beforeword-version" content="'+version+'">\n</head>',1)
    def update_graph(m):
        value=json.loads(m.group(2));nodes=value.get('@graph',[value])
        for item in nodes:
            types=item.get('@type',[]);types=[types] if isinstance(types,str) else types
            if 'WebPage' in types:
                item['description']=description;item['dateModified']=date
        return m.group(1)+json.dumps(value,ensure_ascii=False,separators=(',',':'))+m.group(3)
    current=re.sub(r'(<script\b[^>]*id="beforeword-seo-graph"[^>]*>)(.*?)(</script>)',update_graph,current,flags=re.S)
    # Versioned branding paths leave historical archives unchanged.
    current=re.sub(r'(<link\b[^>]*rel=["\']icon["\'][^>]*href=["\'])[^"\']+',lambda m:m.group(1)+'/model/assets/brand-'+version+'/favicon.svg',current)
    current=re.sub(r'(<link\b[^>]*href=["\'])[^"\']+(["\'][^>]*rel=["\']icon["\'])',lambda m:m.group(1)+'/model/assets/brand-'+version+'/favicon.svg'+m.group(2),current)
    current=re.sub(r'(<link\b[^>]*rel=["\']apple-touch-icon["\'][^>]*href=["\'])[^"\']+',lambda m:m.group(1)+'/model/assets/brand-'+version+'/avatar-paper-512.png',current)
    # No homepage, navigation, settings dialog or canonical/hreflang rewrite.
    for tag in re.findall(r'<link\b[^>]*(?:canonical|hreflang)[^>]*>',original):
        if tag not in current:raise ValueError('Canonical/language link changed')
    return current
