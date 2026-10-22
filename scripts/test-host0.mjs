import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import assert from 'node:assert/strict'
import { get } from 'node:http'
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const id=randomBytes(4).toString('hex'), network=`sgt-host0-${id}`, db=`${network}-db`, web=`${network}-web`, smtp=`${network}-smtp`, volume=`${network}-private`
const folder=mkdtempSync(join(tmpdir(),'sgt-host0-')), dbPassword=randomBytes(24).toString('hex'), installKey=randomBytes(24).toString('hex')
const image=process.argv[2] || 'sgt-host0-test:local', base='http://localhost:3105'
let checks=0, browser
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const verify=(name)=>{checks++;console.log(`✓ Host-0: ${name}`)}
const waitFor=async(check)=>{for(let i=0;i<120;i++){try{if(await check())return}catch{}await setTimeout(250)}throw Error('Test service did not become ready')}
const cookieClient=()=>{
 const cookies=new Map()
 return async(path,options={})=>{
   const headers={Origin:'https://sgt-h.ru','X-Forwarded-Proto':'https',...options.headers,Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')}
   const r=await fetch(base+path,{...options,headers,redirect:'manual'})
   for(const c of r.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');cookies.set(k,v.join('='))}
   return r
 }
}
const admin=cookieClient(), partner=cookieClient(), guest=cookieClient()
const formToken=async(client,path)=>{const r=await client(path);const html=await r.text();const token=html.match(/name="csrf" value="([^"]+)"/);assert.ok(token,html.slice(0,200));return token[1]}
const adminPost=async(action,data={})=>{
 const csrf=await formToken(admin,'/admin')
 return admin('/admin',{method:'POST',body:new URLSearchParams({csrf,action,...data})})
}
const php=(code)=>execFileSync('docker',['exec','-i','--user','www-data',web,'php','-r',code],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
try{
 writeFileSync(join(folder,'db.env'),`MARIADB_ROOT_PASSWORD=${dbPassword}\nMARIADB_DATABASE=sgt_test\nMARIADB_USER=sgt_test\nMARIADB_PASSWORD=${dbPassword}\n`,{mode:0o600})
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',join(folder,'ca.key'),'-out',join(folder,'ca.crt'),'-subj','/CN=SGT local test CA'],{stdio:'ignore'})
 execFileSync('openssl',['req','-newkey','rsa:2048','-nodes','-keyout',join(folder,'server.key'),'-out',join(folder,'server.csr'),'-subj','/CN=sgt-smtp'],{stdio:'ignore'})
 writeFileSync(join(folder,'extensions.txt'),'subjectAltName=DNS:sgt-smtp\nextendedKeyUsage=serverAuth\n')
 execFileSync('openssl',['x509','-req','-in',join(folder,'server.csr'),'-CA',join(folder,'ca.crt'),'-CAkey',join(folder,'ca.key'),'-CAcreateserial','-days','1','-out',join(folder,'server.crt'),'-extfile',join(folder,'extensions.txt')],{stdio:'ignore'})
 writeFileSync(join(folder,'test.ini'),'openssl.cafile=/fixtures/ca.crt\n')
 chmodSync(folder,0o755);chmodSync(join(folder,'ca.crt'),0o644);chmodSync(join(folder,'test.ini'),0o644)
 // Persist attachments on the host temp filesystem, outside Docker's limited overlay.
 mkdirSync(join(folder,'uploads'),{mode:0o700})
 docker('network','create',network)
 docker('run','-d','--name',db,'--network',network,'--network-alias','db','--env-file',join(folder,'db.env'),'mariadb:11')
 await waitFor(()=>docker('exec',db,'healthcheck.sh','--connect','--innodb_initialized').includes(''))
 docker('run','-d','--name',smtp,'--network',network,'--network-alias','sgt-smtp','--mount',`type=bind,source=${folder},target=/fixtures,readonly`,'--mount',`type=bind,source=${resolve('hosting/php/tests/smtp.mjs')},target=/test-smtp.mjs,readonly`,'-p','127.0.0.1::8025','node:24-bookworm-slim','node','/test-smtp.mjs')
 const mailBase=`http://127.0.0.1:${docker('port',smtp,'8025/tcp').split(':').at(-1)}`
 docker('run','-d','--name',web,'--network',network,'--env','SGT_TEST_ORIGIN=http://localhost:3105','--mount',`type=volume,source=${volume},target=/site/sgt-private`,'--mount',`type=bind,source=${join(folder,'uploads')},target=/site/sgt-private/uploads`,'--mount',`type=bind,source=${folder},target=/fixtures,readonly`,'--mount',`type=bind,source=${join(folder,'test.ini')},target=/usr/local/etc/php/conf.d/sgt-test.ini,readonly`,'-p','127.0.0.1:3105:80',image)
 docker('exec',web,'chown','www-data:www-data','/site/sgt-private/uploads')
 await waitFor(async()=> (await admin('/setup')).status===200)
 execFileSync('docker',['exec','-i','--user','www-data',web,'php','-r',"file_put_contents('/site/sgt-private/install-password.txt',stream_get_contents(STDIN));"],{input:installKey,stdio:['pipe','pipe','pipe']})
 let csrf=await formToken(admin,'/setup')
 let setup=await admin('/setup',{method:'POST',body:new URLSearchParams({csrf,install_password:'wrong-install-password'})})
 assert.match(await setup.text(),/Неверный установочный пароль/)
 csrf=await formToken(admin,'/setup')
 setup=await admin('/setup',{method:'POST',body:new URLSearchParams({csrf,install_password:installKey,db_host:'db',db_name:'sgt_test',db_user:'sgt_test',db_password:dbPassword,admin_email:'admin@example.com',admin_password:'Admin-check-password-2026',consent:'yes'})})
 assert.match(await setup.text(),/Сайт настроен/)
 assert.equal(php("echo is_file('/site/sgt-private/install-password.txt')?'present':'removed';"),'removed')
 assert.match(await (await admin('/setup')).text(),/уже завершена/)
 verify('protected one-time setup connects to MySQL and removes the installation password')
 assert.equal((await guest('/api/health')).status,200)
 for(const path of ['/sgt-private/config.json','/.env','/.user.ini','/var/sgt.sqlite'])assert.ok([403,404].includes((await guest(path)).status),path)
 assert.equal((await guest('/api/tenders')).status,401)
 const redirect=await new Promise((resolve,reject)=>get(base,{headers:{Host:'cons.sgt-h.ru','X-Forwarded-Proto':'https'}},r=>{r.resume();resolve({status:r.statusCode,location:r.headers.location})}).on('error',reject))
 assert.equal(redirect.status,302);assert.equal(redirect.location,'https://cons.sgt-h.ru/ksk')
 assert.equal((await guest('/geo')).status,200)
 assert.equal((await guest('/consent?lang=zh')).status,200)
 verify('Apache routes, consortium redirect and private-file protection work')
 const tokenResponse=await partner('/api/csrf'), token=(await tokenResponse.json()).token
 assert.match(tokenResponse.headers.get('set-cookie'),/; secure/i)
 const authBody={email:'partner@example.com',password:'Partner-check-password-2026',company:'Тестовая компания',name:'Тестовый Партнёр',consent:true,consentVersion:'2026-10-22-v2',consentLocale:'en'}
 const post=(path,data,headers={})=>partner(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token,...headers},body:JSON.stringify(data)})
 assert.equal((await post('/api/auth/register',authBody,{'X-CSRF-Token':'wrong'})).status,403)
 assert.equal((await post('/api/auth/register',authBody,{Origin:'https://evil.example'})).status,403)
 assert.equal((await post('/api/auth/register',{...authBody,consent:false})).status,400)
 assert.equal((await post('/api/auth/register',{...authBody,consentVersion:'2026-10-18-v1'})).status,400)
 let registered=await post('/api/auth/register',authBody);assert.equal(registered.status,201)
 const partnerId=(await registered.json()).user.id
 assert.equal(php("require '/site/sgt-private/bootstrap.php';echo query('SELECT consent_version FROM sgt_users WHERE is_admin=0')->fetchColumn();"),'2026-10-22-v2:en')
 assert.equal((await post('/api/auth/register',authBody)).status,409)
 assert.equal((await partner('/api/tenders')).status,403)
 verify('registration enforces CSRF, origin, consent, unique email and pending access')
 assert.equal((await adminPost('login',{email:'admin@example.com',password:'Admin-check-password-2026'})).status,303)
 await adminPost('approve',{id:String(partnerId)})
 assert.equal((await partner('/api/tenders')).status,200)
 await adminPost('add_tender',{title:'Тест: инженерные сети',category:'Инженерные системы',region:'Москва',description:'Тестовый объём инженерных работ для проверки закрытого кабинета.',deadline:'2099-12-31',contact:'coordinator@example.com'})
 const tenders=await (await partner('/api/tenders')).json();assert.equal(tenders.tenders.length,1)
 await adminPost('close_tender',{id:String(tenders.tenders[0].id)})
 assert.equal((await (await partner('/api/tenders')).json()).tenders.length,0)
 await adminPost('revoke',{id:String(partnerId)})
 assert.equal((await partner('/api/tenders')).status,401)
 verify('administrator approval, publication, closing and revocation protect tender access')
 const upload=async(buffer,name='questionnaire.docx')=>{
  const form=new FormData();for(const[k,v]of Object.entries({company:'PHP test company',name:'Test Partner',email:'file@example.com',inn:'',message:'<script>alert(1)</script>\nTest message',website:'',consent:'true',consentVersion:'2026-10-22-v2',consentLocale:'zh'}))form.set(k,v)
  form.set('questionnaire',new Blob([buffer]),name)
  return partner('/api/applications',{method:'POST',headers:{'X-CSRF-Token':token},body:form})
 }
 assert.equal((await upload(Buffer.from('not a document'))).status,400)
 const oversized=await upload(Buffer.alloc(10*1024*1024+1));assert.equal(oversized.status,400,await oversized.text())
 const original=readFileSync('public/documents/sgt-partner-questionnaire.docx')
 let uploaded=await upload(original)
 assert.equal(uploaded.status,202)
 const application=await uploaded.json();assert.equal(application.mailEnabled,false)
 assert.equal(php("require '/site/sgt-private/bootstrap.php';echo query('SELECT consent_version FROM sgt_applications')->fetchColumn();"),'2026-10-22-v2:zh')
 assert.equal(php("require '/site/sgt-private/bootstrap.php';echo query('SELECT COUNT(*) FROM sgt_applications')->fetchColumn();"),'1')
 assert.equal((await guest(`/admin?download=${application.id}`)).status,404)
 const attachment=await admin(`/admin?download=${application.id}`);assert.equal(attachment.status,200);assert.deepEqual(Buffer.from(await attachment.arrayBuffer()),original)
 verify('real DOCX is private and durable; invalid and oversized files are rejected')
 let settings=await adminPost('save_smtp',{smtp_host:'sgt-smtp',smtp_port:'465',smtp_user:'test-user',smtp_from:'forms@example.com',smtp_password:'test-password-only'});assert.match(await settings.text(),/Почтовые настройки сохранены/)
 await waitFor(async()=> (await fetch(mailBase)).ok)
 await fetch(mailBase,{method:'POST',body:JSON.stringify({fail:true})})
 let sent=php("require '/site/sgt-private/bootstrap.php';require '/site/sgt-private/mail.php';echo flush_mail();");assert.equal(sent,'0')
 assert.equal(php("require '/site/sgt-private/bootstrap.php';echo query('SELECT attempts FROM sgt_applications')->fetchColumn();"),'1')
 await fetch(mailBase,{method:'POST',body:JSON.stringify({fail:false})})
 await adminPost('send_queue')
 const received=await (await fetch(mailBase)).json();assert.equal(received.messages.length,1);assert.equal(received.messages[0].recipient,'ok@sgt-h.ru');assert.match(received.messages[0].message,/filename="?anketa-/)
 assert.equal(php("require '/site/sgt-private/bootstrap.php';echo query('SELECT status FROM sgt_applications')->fetchColumn();"),'sent')
 verify('SMTP uses a trusted TLS certificate, retries a failure and attaches the original questionnaire to the fixed recipient')
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']})
 const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'X-Forwarded-Proto':'https'}})
 const page=await context.newPage()
 await page.goto(base+'/cabinet');await page.getByLabel('Электронная почта').fill(authBody.email);await page.getByLabel('Пароль',{exact:true}).fill(authBody.password);await page.getByRole('button',{name:'Войти в кабинет'}).click();await page.getByText('На подтверждении',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Выйти'}).click();await page.getByRole('heading',{name:'Личный кабинет',exact:true}).waitFor()
 await page.goto(base+'/admin');await page.getByLabel('Электронная почта').fill('admin@example.com');await page.getByLabel('Пароль',{exact:true}).fill('Admin-check-password-2026');await page.getByRole('button',{name:'Войти',exact:true}).click();await page.getByRole('heading',{name:'Партнёры и предложения'}).waitFor()
 const {default:AxeBuilder}=await import('@axe-core/playwright');const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(result.violations.map(v=>v.id),[])
 assert.ok(await page.getByText('<script>alert(1)</script>',{exact:false}).count())
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 verify('mobile browser signs into PHP cabinet and administrator UI; stored markup stays text; automated accessibility checks pass')
 await browser.close();browser=null
 await adminPost('delete_application',{application_id:application.id})
 assert.equal(php("require '/site/sgt-private/bootstrap.php';echo query('SELECT COUNT(*) FROM sgt_applications')->fetchColumn();"),'0')
 assert.equal(php("echo count(glob('/site/sgt-private/uploads/*'));"),'0')
 await adminPost('delete_user',{id:String(partnerId)})
 assert.equal(php("require '/site/sgt-private/bootstrap.php';echo query('SELECT COUNT(*) FROM sgt_users WHERE is_admin=0')->fetchColumn();"),'0')
 verify('administrator can delete partner data and its private attachment')
 console.log(`Host-0 checks complete: ${checks} scenarios passed on PHP 8.3, Apache and MariaDB.`)
}catch(error){try{execFileSync('docker',['logs','--tail','30',web],{stdio:'inherit'})}catch{}throw error}
finally{
 if(browser)await browser.close()
 // Make only this test's temporary upload directory removable by the host test user.
 try{docker('exec',web,'chmod','0777','/site/sgt-private/uploads')}catch{}
 for(const name of [web,smtp,db])try{docker('rm','-fv',name)}catch{}
 try{docker('volume','rm',volume)}catch{}
 try{docker('network','rm',network)}catch{}
 rmSync(folder,{recursive:true,force:true})
}
