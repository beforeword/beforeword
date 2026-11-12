from pathlib import Path
import os,stat,hashlib,json,zipfile,datetime
def require(condition):
 if not condition:raise RuntimeError('Public export safety precondition failed')
r=Path('/home/befohuyc/public_html')
out=r/'downloads/beforeword-data-boundary-20261112-c395513cc2ef5f78.zip'
names=set('assets/ai-20261104/examples.json\nassets/ai-20261104/real-runs.json'.splitlines())
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
