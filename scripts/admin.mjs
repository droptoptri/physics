import { openStore, hashPassword } from '../server/storage.mjs'
import { readFileSync, unlinkSync } from 'node:fs'
import { z } from 'zod'
import { createMailWorker, makeMailer } from '../server/mail.mjs'

const store=openStore(process.env.DATA_DIR || './var')
const [command,...args]=process.argv.slice(2)
try {
  if(command==='users') {
    console.table(store.db.prepare('SELECT id,email,company,name,approved,created_at FROM users').all())
  }else if(command==='approve' || command==='revoke') {
    const email=z.email().parse(args[0]).toLowerCase()
    const found=store.db.prepare('SELECT id FROM users WHERE email=?').get(email)
    if(!found)throw new Error('Account not found')
    store.db.prepare('UPDATE users SET approved=? WHERE id=?').run(command==='approve'?1:0,found.id)
    if(command==='revoke')store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(found.id)
    console.log('Account updated')
  }else if(command==='delete-user') {
    const email=z.email().parse(args[0]).toLowerCase()
    const result=store.db.prepare('DELETE FROM users WHERE email=?').run(email)
    console.log('Deleted accounts:',result.changes)
  }else if(command==='reset-password') {
    const email=z.email().parse(args[0]).toLowerCase()
    const password=z.string().min(12).max(128).parse(process.env.NEW_PARTNER_PASSWORD)
    const result=store.db.prepare('UPDATE users SET password=? WHERE email=?').run(hashPassword(password),email)
    if(!result.changes)throw new Error('Account not found')
    store.db.prepare('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)').run(email)
    console.log('Password changed; existing sessions revoked')
  }else if(command==='add-tender') {
    const tender=z.object({title:z.string().min(3).max(200),category:z.string().min(2).max(100),region:z.string().min(2).max(100),description:z.string().min(10).max(10000),deadline:z.iso.date(),contact:z.email()}).strict().parse(JSON.parse(readFileSync(args[0],'utf8')))
    const result=store.db.prepare('INSERT INTO tenders(title,category,region,description,deadline,contact) VALUES(?,?,?,?,?,?)').run(tender.title,tender.category,tender.region,tender.description,tender.deadline,tender.contact)
    console.log('Tender created:',result.lastInsertRowid)
  }else if(command==='close-tender') {
    const id=z.coerce.number().int().positive().parse(args[0])
    console.log('Updated:',store.db.prepare('UPDATE tenders SET active=0 WHERE id=?').run(id).changes)
  }else if(command==='applications') {
    console.table(store.db.prepare('SELECT id,company,email,status,attempts,created_at,sent_at FROM applications ORDER BY created_at DESC').all())
  }else if(command==='retry-mail') {
    const mailer=makeMailer()
    if(!mailer)throw new Error('Configure SMTP first')
    await mailer.verify()
    store.db.prepare("UPDATE applications SET next_attempt=0 WHERE status='queued'").run()
    await createMailWorker(store,mailer).flush()
    console.log('Delivery run complete; check applications for status')
  }else if(command==='delete-application') {
    const id=z.uuid().parse(args[0])
    const app=store.db.prepare('SELECT stored_path FROM applications WHERE id=?').get(id)
    if(!app)throw new Error('Application not found')
    try{unlinkSync(app.stored_path)}catch(error){if(error.code!=='ENOENT')throw error}
    store.db.prepare('DELETE FROM applications WHERE id=?').run(id)
    console.log('Application and private attachment deleted')
  }else {
    console.log('Commands: users | approve EMAIL | revoke EMAIL | reset-password EMAIL | delete-user EMAIL | add-tender FILE.json | close-tender ID | applications | retry-mail | delete-application UUID')
    if(command)process.exitCode=1
  }
}catch(error){console.error(error instanceof z.ZodError?'Invalid input':error.message);process.exitCode=1}
finally{store.db.close()}
