from pathlib import Path
import os,stat,hashlib,json,zipfile,datetime
def require(condition):
 if not condition:raise RuntimeError('Public export safety precondition failed')
r=Path('/home/befohuyc/public_html')
out=r/'downloads/beforeword-runtime-boundary-20261112-c0e75975d3e7d6b1.zip'
names=set('beta/app/analysis-core.js\nbeta/app/analysis-examples.js\nbeta/app/assets/brand.svg\nbeta/app/dictionary-core.js\nbeta/app/dictionary-ui.js\nbeta/app/dictionary.css\nbeta/app/form-core.js\nbeta/app/instructions.js\nbeta/app/panel.css\nbeta/app/panel.html\nbeta/app/panel.js\nbeta/app/reading-guide.css\nbeta/app/reading-guide.js\nbeta/app/reading-surface.js\nbeta/app/web-panel.css\nbeta/app/web-panel.js\nbeta/app/web-service.js\nbeta/beta.css\nbeta/beta.js\nbeta/en/index.html\nbeta/index.html\nextensions/extensions.css\nmodel/downloads/beforeword_toolkit.zip\nmusic/assets/ceramic-20260928.css\nmusic/assets/music-edition-20261012.css\nmusic/assets/music-interface-20261012.js\nmusic/assets/music-layout-548a5e0ddf0b.css\nmusic/assets/music-memorial-finish-20260930.css\nmusic/assets/site-5dfc7f525cc2.css\nmusic/assets/site-zhizn-20260930.js\nresearch/research-78f463419a55.css\nresearch/words-and-imprisonment/entry.css\nresearch/words-and-imprisonment/reader.css\nresearch/words-and-imprisonment/reader.js\nresearch/written-i/publication-7760bacf7c29.css\nresearch/written-i/reading-20e3785540ee.css'.splitlines())
blocked={'ma','api','server','private','beforeword-private','beforeword-api'}
entries=[];missing=[];total=0;created=False
require(not out.exists() and out.parent.is_dir() and not out.parent.is_symlink())
try:
 with zipfile.ZipFile(out,'x',zipfile.ZIP_DEFLATED) as z:
  created=True
  for n in sorted(names):
   p=r/n
   require(not n.startswith('/') and all(x not in blocked and x not in {'.','..'} and not x.startswith('.') for x in Path(n).parts))
   require(not any(q.is_symlink() for q in [p,*p.parents] if q!=r.parent))
   if not p.exists(): missing.append(n);continue
   s=p.stat();require(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size<16777216)
   data=p.read_bytes();e=p.stat()
   require((s.st_ino,s.st_size,s.st_mtime_ns)==(e.st_ino,e.st_size,e.st_mtime_ns))
   total+=len(data);require(total<268435456)
   z.writestr('public/'+n,data)
   entries.append({'path':n,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
  z.writestr('baseline.json',json.dumps({'schema_version':1,'source':'live_public_static_files','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':entries,'missing':missing},indent=2))
 os.chmod(out,0o644)
 print(json.dumps({'url':'https://beforeword.xyz/downloads/'+out.name,'size':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'files':len(entries),'missing':len(missing)}))
except BaseException:
 if created and out.exists():out.unlink()
 raise
