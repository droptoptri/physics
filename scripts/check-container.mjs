// Exercises the actual production image, including a private persistent volume.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { get } from 'node:http'
import { setTimeout } from 'node:timers/promises'

const image = process.argv[2] || 'sgt-holding:local'
const name = `sgt-check-${randomBytes(5).toString('hex')}`, volume = `${name}-data`
const directory = mkdtempSync(join(tmpdir(), 'sgt-container-'))
const config = join(directory, 'runtime.env')
writeFileSync(config, `SESSION_SECRET=${randomBytes(32).toString('hex')}\nAPP_ORIGIN=https://sgt-test.example\nCONSORTIUM_HOST=cons.sgt-test.example\n`, { mode: 0o600 })
const docker = (...args) => execFileSync('docker', args, { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim()
try {
  docker('run','-d','--name',name,'--read-only','--tmpfs','/tmp:size=32m,mode=1777','--cap-drop','ALL','--security-opt','no-new-privileges:true','--mount',`type=volume,source=${volume},target=/app/var`,'--env-file',config,'-p','127.0.0.1::3000',image)
  const port = docker('port',name,'3000/tcp').split(':').at(-1)
  let base = `http://127.0.0.1:${port}`
  const ready = async () => {
    for (let attempt=0;attempt<40;attempt++) {
      try { const r=await fetch(`${base}/api/health`); if(r.ok && (await r.json()).ok) return } catch {}
      await setTimeout(250)
    }
    throw new Error('Production container did not become healthy')
  }
  await ready()
  assert.equal(docker('exec',name,'id','-u'),'1000')
  const home=await fetch(base)
  assert.equal(home.status,200)
  const html=await home.text()
  const script=html.match(/src="([^"]+\.js)"/)[1]
  assert.equal((await fetch(base+script)).status,200)
  const consortium=await new Promise((resolve,reject)=>get(base,{headers:{Host:'cons.sgt-test.example'}},response=>{response.resume();resolve({status:response.statusCode,location:response.headers.location})}).on('error',reject))
  assert.equal(consortium.status,302)
  assert.equal(consortium.location,'/ksk')
  for(const path of ['/var/sgt.sqlite','/.env.production']) assert.equal((await fetch(base+path)).status,404)
  assert.equal((await fetch(`${base}/api/tenders`)).status,401)
  const csrf=await fetch(`${base}/api/csrf`)
  const {token}=await csrf.json()
  const cookie=csrf.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')
  assert.match(csrf.headers.get('set-cookie'), /; Secure/)
  const headers={Origin:'https://sgt-test.example',Cookie:cookie,'X-CSRF-Token':token}
  const registration=await fetch(`${base}/api/auth/register`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({email:'container@example.com',password:'Container-check-password-2026',company:'Container check',name:'Test Partner',consent:true})})
  assert.equal(registration.status,201)
  const session=registration.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')
  const form=new FormData()
  for(const [key,value] of Object.entries({company:'Container check',name:'Test Partner',email:'container@example.com',inn:'',message:'Container persistence check',consent:'true',website:''}))form.set(key,value)
  form.set('questionnaire',new Blob([readFileSync('public/documents/sgt-partner-questionnaire.docx')]),'questionnaire.docx')
  const upload=await fetch(`${base}/api/applications`,{method:'POST',headers,body:form})
  assert.equal(upload.status,202)
  assert.equal((await upload.json()).status,'queued')
  docker('restart',name)
  base = `http://127.0.0.1:${docker('port',name,'3000/tcp').split(':').at(-1)}`
  await ready()
  const me=await fetch(`${base}/api/auth/me`,{headers:{Cookie:session}})
  assert.equal((await me.json()).user.company,'Container check')
  docker('exec',name,'node','--input-type=module','-e',`import {DatabaseSync} from 'node:sqlite';import {existsSync} from 'node:fs';const db=new DatabaseSync('/app/var/sgt.sqlite');const a=db.prepare('SELECT stored_path FROM applications').get();if(!a||!existsSync(a.stored_path))process.exit(1);db.close()`)
  console.log('Production image verified: non-root startup, assets, private storage, custom consortium domain, Secure cookies, registration, DOCX queue and persistence across restart.')
} catch(error) {
  try { console.error(docker('logs','--tail','30',name)) } catch {}
  throw error
} finally {
  try { docker('rm','-f',name) } catch {}
  try { docker('volume','rm',volume) } catch {}
  rmSync(directory,{recursive:true,force:true})
}
