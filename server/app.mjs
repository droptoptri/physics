import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import { z } from 'zod'
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto'
import { fileTypeFromFile } from 'file-type'
import { unlinkSync } from 'node:fs'
import { digest, hashPassword, checkPassword } from './storage.mjs'
import { mailConfig } from './mail.mjs'

const authSchema = z.object({ email: z.email().max(254).transform(s=>s.toLowerCase().trim()), password: z.string().min(12).max(128) })
const registerSchema = authSchema.extend({ company: z.string().trim().min(2).max(200), name: z.string().trim().min(2).max(120), consent: z.literal(true) })
const applicationSchema = z.object({
  company: z.string().trim().min(2).max(200), name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform(s=>s.toLowerCase().trim()),
  inn: z.string().trim().refine(s=>s==='' || /^\d{10}$|^\d{12}$/.test(s)),
  message: z.string().trim().max(3000), consent: z.literal('true'), website: z.literal('')
})
const sessionName = 'sgt_session'
const removeFile = path => { if (path) {try { unlinkSync(path) } catch { /* already removed */ }} }
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(s=>s.trim().split('=')).filter(a=>a.length===2))
}
export function createApp({ store, secret, production = false, origins = ['http://localhost:3000'], mailerEnabled = mailConfig(), worker, limits = true, trustProxy = false }) {
  const app = express()
  app.disable('x-powered-by')
  if (trustProxy) app.set('trust proxy', 1)
  app.use(helmet({ contentSecurityPolicy: production ? {
    directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], fontSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], formAction: ["'self'"] }
  } : false, crossOriginEmbedderPolicy: false, strictTransportSecurity: production ? undefined : false }))
  app.use(express.json({ limit: '20kb' }))
  app.get('/api/health', (_req,res)=>res.json({ ok: true }))
  app.get('/api/config', (_req,res)=>res.json({ mailEnabled: mailerEnabled, recipient: 'antnpk@gmail.com' }))
  app.use('/api', (_req,res,next)=>{ res.setHeader('Cache-Control','no-store'); next() })
  const csrfSignature = value => createHmac('sha256', secret).update(value).digest('hex')
  app.get('/api/csrf', (req,res)=>{
    const value = randomBytes(24).toString('hex')
    const token = `${value}.${csrfSignature(value)}`
    res.cookie('sgt_csrf', token, { httpOnly: true, secure: production, sameSite: 'strict', path: '/', maxAge: 3600_000 })
    res.json({ token })
  })
  app.use('/api', (req,res,next)=>{
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next()
    const origin = req.headers.origin
    if (origin && !origins.includes(origin)) return res.status(403).json({ error: 'Запрос с этого адреса не разрешён.' })
    const token = req.headers['x-csrf-token']
    if (typeof token !== 'string' || token !== cookies(req).sgt_csrf) return res.status(403).json({ error: 'Обновите страницу и повторите отправку.' })
    const [value, signature] = token.split('.')
    const expected = csrfSignature(value || '')
    if (!/^[a-f0-9]{48}$/.test(value || '') || !/^[a-f0-9]{64}$/.test(signature || '') || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(403).json({error:'Недействительный токен запроса.'})
    next()
  })
  const limit = (windowMs, max) => limits ? rateLimit({ windowMs, max, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Слишком много запросов. Попробуйте позже.' } }) : (_req,_res,next)=>next()
  app.use('/api/auth', limit(15*60_000, 30))
  const currentUser = req => {
    const token = cookies(req)[sessionName]
    if (!token) return null
    return store.db.prepare('SELECT u.id,u.email,u.company,u.name,u.approved FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(digest(token),Date.now()) || null
  }
  const session = (res,userId) => {
    const token = randomBytes(32).toString('hex')
    store.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now())
    store.db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token),userId,Date.now()+7*86400_000)
    res.cookie(sessionName,token,{ httpOnly:true,secure:production,sameSite:'lax',maxAge:7*86400_000,path:'/' })
  }
  app.get('/api/auth/me',(req,res)=>res.json({user:currentUser(req)}))
  app.post('/api/auth/register',(req,res,next)=>{
    try {
      const parsed = registerSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({error:'Проверьте поля. Пароль должен содержать от 12 до 128 символов; необходимо согласие на обработку данных.'})
      const {email,password,company,name} = parsed.data
      const exists = store.db.prepare('SELECT id FROM users WHERE email=?').get(email)
      if (exists) return res.status(409).json({error:'Не удалось зарегистрировать этот адрес. Войдите или свяжитесь с координатором.'})
      const result=store.db.prepare('INSERT INTO users(email,company,name,password,consent_version,consent_at) VALUES(?,?,?,?,?,?)').run(email,company,name,hashPassword(password),'2026-10-18-v1',new Date().toISOString())
      session(res,Number(result.lastInsertRowid))
      const user=store.db.prepare('SELECT id,email,company,name,approved FROM users WHERE id=?').get(Number(result.lastInsertRowid))
      res.status(201).json({user})
    } catch(error) {next(error)}
  })
  app.post('/api/auth/login',(req,res)=>{
    const parsed=authSchema.safeParse(req.body)
    if(!parsed.success) return res.status(401).json({error:'Неверный email или пароль.'})
    const user=store.db.prepare('SELECT * FROM users WHERE email=?').get(parsed.data.email)
    // Always run the KDF to avoid a fast response for unknown addresses.
    const valid=checkPassword(parsed.data.password,user?.password || `00000000000000000000000000000000:${'0'.repeat(128)}`)
    if(!user || !valid) return res.status(401).json({error:'Неверный email или пароль.'})
    session(res,user.id)
    const {password,...safe}=user
    res.json({user:safe})
  })
  app.post('/api/auth/logout',(req,res)=>{
    const token=cookies(req)[sessionName]
    if(token) store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token))
    res.clearCookie(sessionName,{path:'/',httpOnly:true,secure:production,sameSite:'lax'})
    res.json({ok:true})
  })
  app.get('/api/tenders',(req,res)=>{
    const user=currentUser(req)
    if(!user) return res.status(401).json({error:'Войдите в личный кабинет.'})
    if(!user.approved) return res.status(403).json({error:'Доступ откроется после подтверждения вашей компании координатором.'})
    const tenders=store.db.prepare("SELECT id,title,category,region,description,deadline,contact FROM tenders WHERE active=1 AND date(deadline)>=date('now') ORDER BY deadline").all()
    res.json({tenders})
  })
  const upload=multer({
    storage:multer.diskStorage({destination:store.uploadsDir,filename:(_req,_file,cb)=>cb(null,randomUUID())}),
    limits:{fileSize:10*1024*1024,files:1,fields:9,fieldSize:12000},
    fileFilter:(_req,file,cb)=>{
      if(!/\.(docx|pdf)$/i.test(file.originalname)) return cb(Object.assign(new Error('Загрузите анкету в формате DOCX или PDF.'),{status:400}))
      cb(null,true)
    }
  })
  app.post('/api/applications', limit(60*60_000,10), upload.single('questionnaire'), async(req,res,next)=>{
    try {
      const parsed=applicationSchema.safeParse(req.body)
      if(!parsed.success || !req.file) { removeFile(req.file?.path);return res.status(400).json({error:'Заполните обязательные поля, приложите анкету и подтвердите согласие.'}) }
      const type=await fileTypeFromFile(req.file.path)
      const extension=req.file.originalname.toLowerCase().endsWith('.pdf')?'pdf':'docx'
      if(!type || type.ext!==extension) {removeFile(req.file.path);return res.status(400).json({error:'Содержимое файла не соответствует формату DOCX или PDF.'})}
      const id=randomUUID(), {company,name,email,inn,message}=parsed.data
      const filename=`anketa-${id.slice(0,8)}.${extension}`
      store.db.prepare('INSERT INTO applications(id,company,name,email,inn,message,filename,stored_path,consent_version) VALUES(?,?,?,?,?,?,?,?,?)').run(id,company,name,email,inn,message,filename,req.file.path,'2026-10-18-v1')
      res.status(202).json({id,status:'queued',mailEnabled:mailerEnabled})
      void worker?.flush()
    }catch(error){removeFile(req.file?.path);next(error)}
  })
  app.use('/api',(_req,res)=>res.status(404).json({error:'Запрос не найден.'}))
  app.use((error,req,res,next)=>{
    if(!req.path.startsWith('/api')) return next(error)
    if(res.headersSent) return next(error)
    if(error instanceof multer.MulterError) return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?'Размер анкеты не должен превышать 10 МБ.':'Не удалось принять файл. Загрузите одну анкету до 10 МБ.'})
    if(error.status===400 || error.type==='entity.parse.failed') return res.status(400).json({error:error.message || 'Проверьте отправленные данные.'})
    console.error('API request failed:',error.code || error.name)
    res.status(500).json({error:'Не удалось выполнить запрос. Попробуйте ещё раз.'})
  })
  return app
}
