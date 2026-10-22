import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { openStore, checkPassword } from '../server/storage.mjs'
import { createApp } from '../server/app.mjs'
import { createMailWorker } from '../server/mail.mjs'

async function setup(t, options={}) {
  const directory=mkdtempSync(join(tmpdir(),'sgt-api-'))
  const store=openStore(directory)
  const app=createApp({store,secret:'test-secret-at-least-32-characters',origins:['https://sgt-holding.ru'],limits:false,...options})
  const server=app.listen(0,'127.0.0.1')
  await once(server,'listening')
  const base=`http://127.0.0.1:${server.address().port}`
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));store.db.close();rmSync(directory,{recursive:true,force:true})})
  const csrfResponse=await fetch(base+'/api/csrf')
  const {token}=await csrfResponse.json()
  let cookie=csrfResponse.headers.get('set-cookie').split(';')[0]
  async function request(path,{method='GET',body,headers={}}={}){
    const h={Cookie:cookie,...headers}
    if(method!=='GET')h['X-CSRF-Token']=token
    if(body&&!(body instanceof FormData))h['Content-Type']='application/json'
    const response=await fetch(base+path,{method,body:body instanceof FormData?body:body?JSON.stringify(body):undefined,headers:h,redirect:'manual'})
    const sc=response.headers.getSetCookie()
    if(sc.length){for(const c of sc){const part=c.split(';')[0];const name=part.split('=')[0];cookie=cookie.split('; ').filter(s=>!s.startsWith(name+'=')).concat(part).join('; ')}}
    return response
  }
  return {store,request,base,getCookie:()=>cookie}
}
const account={email:'partner@example.com',password:'a-long-test-password-2026',name:'Иван Иванов',company:'ООО Тест',consent:true,consentVersion:'2026-10-22-v2',consentLocale:'ru'}
function form(file=readFileSync(new URL('../public/documents/sgt-partner-questionnaire.docx',import.meta.url)),filename='anketa.docx'){
  const data=new FormData()
  for(const [k,v]of Object.entries({company:'ООО Тест',name:'Иван Иванов',email:'partner@example.com',inn:'1234567890',message:'Тестовая заявка',consent:'true',consentVersion:'2026-10-22-v2',consentLocale:'ru',website:''}))data.set(k,v)
  data.set('questionnaire',new Blob([file]),filename)
  return data
}

test('registration, approval, tender access and logout enforce the complete permission flow',async t=>{
  const {store,request}=await setup(t)
  assert.equal((await request('/api/tenders')).status,401)
  const created=await request('/api/auth/register',{method:'POST',body:account})
  assert.equal(created.status,201)
  const user=(await created.json()).user
  assert.equal(user.approved,0)
  const stored=store.db.prepare('SELECT password FROM users WHERE id=?').get(user.id)
  assert.notEqual(stored.password,account.password)
  assert.ok(checkPassword(account.password,stored.password))
  assert.ok(created.headers.get('set-cookie').includes('HttpOnly'))
  assert.ok(created.headers.get('set-cookie').includes('SameSite=Lax'))
  assert.equal((await request('/api/tenders')).status,403)
  const duplicate=await request('/api/auth/register',{method:'POST',body:account})
  assert.equal(duplicate.status,409)
  store.db.prepare('UPDATE users SET approved=1 WHERE id=?').run(user.id)
  const insert=store.db.prepare('INSERT INTO tenders(title,category,region,description,deadline,contact,active) VALUES(?,?,?,?,?,?,?)')
  insert.run('Промышленный объект','Строительство','Урал','Описание работ','2099-12-31','manager@example.com',1)
  insert.run('Архив','Строительство','Москва','Архивные работы','2020-12-31','manager@example.com',1)
  insert.run('Закрытый','Строительство','Москва','Закрытые работы','2099-12-31','manager@example.com',0)
  const tenders=await (await request('/api/tenders')).json()
  assert.equal(tenders.tenders.length,1)
  assert.equal(tenders.tenders[0].title,'Промышленный объект')
  assert.equal((await request('/api/auth/logout',{method:'POST'})).status,200)
  assert.equal((await request('/api/tenders')).status,401)
  assert.equal(store.db.prepare('SELECT count(*) n FROM sessions').get().n,0)
  assert.equal((await request('/api/auth/login',{method:'POST',body:{email:account.email,password:'incorrect-long-password'}})).status,401)
  assert.equal((await request('/api/auth/login',{method:'POST',body:{email:account.email,password:account.password}})).status,200)
  assert.equal((await request('/api/tenders')).status,200)
})

test('CSRF and origin checks block forged state-changing requests',async t=>{
  const {base,request}=await setup(t)
  assert.equal((await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(account)})).status,403)
  assert.equal((await request('/api/auth/register',{method:'POST',body:account,headers:{Origin:'https://attacker.example'}})).status,403)
  assert.equal((await request('/api/auth/register',{method:'POST',body:{...account,consent:false}})).status,400)
  assert.equal((await request('/api/auth/register',{method:'POST',body:{...account,password:'short'}})).status,400)
  assert.equal((await request('/api/auth/me')).headers.get('cache-control'),'no-store')
})

test('real DOCX questionnaire is stored privately, queued and delivered to the specified recipient',async t=>{
  const {store,request}=await setup(t,{mailerEnabled:true})
  const response=await request('/api/applications',{method:'POST',body:form()})
  assert.equal(response.status,202)
  const data=await response.json()
  assert.equal(data.status,'queued')
  const row=store.db.prepare('SELECT * FROM applications WHERE id=?').get(data.id)
  assert.equal(row.status,'queued')
  assert.equal(row.company,'ООО Тест')
  assert.ok(row.stored_path.startsWith(store.uploadsDir))
  assert.ok(readFileSync(row.stored_path).length>1000)
  let captured
  await createMailWorker(store,{sendMail:async message=>{captured=message}}).flush()
  assert.equal(captured.to,'ok@sgt-h.ru')
  assert.equal(captured.replyTo.address,'partner@example.com')
  assert.equal(captured.attachments.length,1)
  assert.equal(captured.attachments[0].path,row.stored_path)
  assert.equal(store.db.prepare('SELECT status FROM applications WHERE id=?').get(data.id).status,'sent')
  // A second queue pass must not send the same successfully processed application again.
  await createMailWorker(store,{sendMail:async()=>{throw new Error('duplicate delivery')}}).flush()
  assert.equal(store.db.prepare('SELECT attempts FROM applications WHERE id=?').get(data.id).attempts,1)
})

test('missing mail configuration preserves the application without claiming email delivery',async t=>{
  const {store,request}=await setup(t,{mailerEnabled:false})
  const r=await request('/api/applications',{method:'POST',body:form()})
  const result=await r.json()
  assert.equal(result.mailEnabled,false)
  await createMailWorker(store,null).flush()
  const row=store.db.prepare('SELECT status,attempts FROM applications WHERE id=?').get(result.id)
  assert.equal(row.status,'queued');assert.equal(row.attempts,0)
})

test('SMTP failure remains queued with backoff and succeeds after a later retry',async t=>{
  const {store,request}=await setup(t)
  const {id}=await (await request('/api/applications',{method:'POST',body:form()})).json()
  await createMailWorker(store,{sendMail:async()=>{throw new Error('SMTP unavailable')}}).flush()
  const row=store.db.prepare('SELECT * FROM applications WHERE id=?').get(id)
  assert.equal(row.status,'queued');assert.equal(row.attempts,1);assert.ok(row.next_attempt>Date.now())
  let count=0
  const worker=createMailWorker(store,{sendMail:async()=>{count++}})
  await worker.flush();assert.equal(count,0)
  store.db.prepare('UPDATE applications SET next_attempt=0 WHERE id=?').run(id)
  await worker.flush();assert.equal(count,1)
  assert.equal(store.db.prepare('SELECT status FROM applications WHERE id=?').get(id).status,'sent')
})

test('invalid, oversized and nonconsensual uploads are rejected and cleaned up',async t=>{
  const {store,request}=await setup(t)
  for(const [content,filename]of [[Buffer.from('not a document'),'fake.docx'],[Buffer.from('<script>alert(1)</script>'),'payload.html'],[Buffer.alloc(11*1024*1024),'large.pdf']]){
    const r=await request('/api/applications',{method:'POST',body:form(content,filename)})
    assert.equal(r.status,400,filename)
  }
  const f=form();f.set('consent','false')
  assert.equal((await request('/api/applications',{method:'POST',body:f})).status,400)
  const bot=form();bot.set('website','https://spam.example')
  assert.equal((await request('/api/applications',{method:'POST',body:bot})).status,400)
  assert.equal(store.db.prepare('SELECT count(*) n FROM applications').get().n,0)
  assert.deepEqual(readdirSync(store.uploadsDir),[])
})

test('approved access is checked again after revocation and sessions expire',async t=>{
  const {store,request}=await setup(t)
  await request('/api/auth/register',{method:'POST',body:account})
  store.db.prepare('UPDATE users SET approved=1').run()
  assert.equal((await request('/api/tenders')).status,200)
  store.db.prepare('UPDATE users SET approved=0').run()
  assert.equal((await request('/api/tenders')).status,403)
  store.db.prepare('UPDATE sessions SET expires_at=0').run()
  assert.equal((await request('/api/tenders')).status,401)
})

test('production cookies are Secure and HTML/script injection stays plain mail text',async t=>{
  const {request,store}=await setup(t,{production:true})
  const r=await request('/api/auth/register',{method:'POST',body:account})
  assert.equal(r.status,201)
  assert.match(r.headers.get('set-cookie'),/; Secure/)
  const f=form();f.set('company','<script>bad()</script>\r\nBcc: attacker@example.com')
  const {id}=await (await request('/api/applications',{method:'POST',body:f})).json()
  let mail
  await createMailWorker(store,{sendMail:async m=>{mail=m}}).flush()
  assert.ok(!/[\r\n]/.test(mail.subject));assert.equal(mail.html,undefined)
  assert.equal(store.db.prepare('SELECT status FROM applications WHERE id=?').get(id).status,'sent')
})

test('persistent database can be reopened repeatedly without losing accounts or consent',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'sgt-persistence-'))
  let store=openStore(directory)
  t.after(()=>{store.db.close();rmSync(directory,{recursive:true,force:true})})
  const {hashPassword}=await import('../server/storage.mjs')
  store.db.prepare('INSERT INTO users(email,company,name,password,consent_version,consent_at) VALUES(?,?,?,?,?,?)').run('persistent@example.com','Компания','Имя',hashPassword('persistent-secure-password'),'2026-10-18-v1',new Date().toISOString())
  store.db.close()
  store=openStore(directory)
  const user=store.db.prepare('SELECT * FROM users WHERE email=?').get('persistent@example.com')
  assert.equal(user.company,'Компания')
  assert.equal(user.consent_version,'2026-10-18-v1')
  assert.ok(user.consent_at)
  assert.ok(checkPassword('persistent-secure-password',user.password))
  store.db.close();store=openStore(directory)
  assert.equal(store.db.prepare('SELECT count(*) n FROM users').get().n,1)
})

test('current standalone consent version and language are required and stored without changing old records',async t=>{
  const {store,request}=await setup(t)
  for(const consentVersion of [undefined,'2026-10-18-v1']){
    assert.equal((await request('/api/auth/register',{method:'POST',body:{...account,consentVersion}})).status,400)
    const f=form();if(consentVersion)f.set('consentVersion',consentVersion);else f.delete('consentVersion')
    assert.equal((await request('/api/applications',{method:'POST',body:f})).status,400)
  }
  assert.equal((await request('/api/auth/register',{method:'POST',body:{...account,consentLocale:'xx'}})).status,400)
  assert.equal((await request('/api/auth/register',{method:'POST',body:{...account,consentLocale:'en'}})).status,201)
  assert.equal(store.db.prepare('SELECT consent_version FROM users').get().consent_version,'2026-10-22-v2:en')
  const f=form();f.set('consentLocale','zh')
  assert.equal((await request('/api/applications',{method:'POST',body:f})).status,202)
  const row=store.db.prepare('SELECT consent_version,created_at FROM applications').get()
  assert.equal(row.consent_version,'2026-10-22-v2:zh');assert.ok(row.created_at)
})
