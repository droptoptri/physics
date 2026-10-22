import {test} from 'node:test'
import {execFileSync} from 'node:child_process'

test('Host-0 update preserves installed secrets and submissions while supplying the original GEO PDF',()=>{
  execFileSync('python3',['-c',`
from pathlib import Path
import tempfile,zipfile
with tempfile.TemporaryDirectory(prefix='sgt-update-') as directory:
 root=Path(directory)
 private=root/'sgt-private';private.mkdir()
 protected={'config.json':b'existing-database-and-smtp-settings','secret.key':b'existing-session-secret','uploads/existing.docx':b'private-file','vendor/autoload.php':b'existing-vendor'}
 for name,value in protected.items():
  p=private/name;p.parent.mkdir(exist_ok=True);p.write_bytes(value)
 with zipfile.ZipFile('releases/sgt-host0-update.zip') as z:
  assert not any(p.startswith('/') or '..' in Path(p).parts for p in z.namelist())
  assert not any(p.endswith(('config.json','secret.key','install-password.txt')) or '/uploads/' in p or '/vendor/' in p for p in z.namelist())
  assert 'sgt-h.ru/setup.php' not in z.namelist()
  assert z.read('sgt-h.ru/documents/SGT_GEO_Updated_2026.pdf')==Path('public/documents/SGT_GEO_Updated_2026.pdf').read_bytes()
  z.extractall(root)
 for name,value in protected.items(): assert (private/name).read_bytes()==value,name
 assert (root/'sgt-h.ru/index.html').is_file()
 assert b'ok@sgt-h.ru' in (private/'bootstrap.php').read_bytes()
 assert b'2026-10-22-v2' in (private/'bootstrap.php').read_bytes()
`],{stdio:'pipe'})
})
