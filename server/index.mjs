import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import { openStore } from './storage.mjs'
import { createApp } from './app.mjs'
import { makeMailer, createMailWorker } from './mail.mjs'

const production=process.env.NODE_ENV==='production'
if(production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length<32)) throw new Error('Production requires SESSION_SECRET with at least 32 characters')
if(production && !process.env.APP_ORIGIN?.split(',').every(s=>s.trim().startsWith('https://'))) throw new Error('Production requires HTTPS APP_ORIGIN (comma-separated for multiple domains)')
const port=Number(process.env.PORT || 3000)
const host=process.env.HOST || '0.0.0.0'
const consortiumHost=(process.env.CONSORTIUM_HOST || 'cons.sgt-holding.ru').trim().toLowerCase()
const codespacesName=process.env.CODESPACE_NAME || ''
const codespacesDomain=process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || ''
const codespacesHost=process.env.CODESPACES==='true' && /^[a-z0-9-]+$/.test(codespacesName) && /^[a-z0-9.-]+$/.test(codespacesDomain) ? `${codespacesName}-${port}.${codespacesDomain}` : ''
const defaultOrigins=[`http://localhost:${port}`, ...(codespacesHost ? [`https://${codespacesHost}`] : [])]
const store=openStore(process.env.DATA_DIR || './var')
const mailer=makeMailer()
const worker=createMailWorker(store,mailer)
const app=createApp({store,secret:process.env.SESSION_SECRET || randomBytes(32).toString('hex'),production,origins:(process.env.APP_ORIGIN || defaultOrigins.join(',')).split(',').map(s=>s.trim()),mailerEnabled:!!mailer,worker,trustProxy:process.env.TRUST_PROXY==='1'})
app.use((req,res,next)=>{
  let path
  try{path=decodeURIComponent(req.path)}catch{return res.status(400).end()}
  if(/(?:^|\/)(?:var|\.git|\.env(?:\.[^/]*)?)(?:\/|$)/i.test(path) || path.includes(store.dataDir) || /\.sqlite(?:-|$)/i.test(path))return res.status(404).end()
  next()
})
app.get('/',(req,res,next)=>req.hostname.toLowerCase()===consortiumHost?res.redirect(302,'/ksk'):next())
if(production || process.env.SERVE_DIST==='true') {
  if(!existsSync(resolve('dist/index.html'))) throw new Error('Run npm run build first')
  app.use(express.static(resolve('dist'),{index:false,maxAge:0}))
  app.get(['/', '/ksk', '/geo', '/cabinet', '/privacy'],(_req,res)=>res.sendFile(resolve('dist/index.html')))
  app.use((_req,res)=>res.status(404).send('Страница не найдена'))
}else{
  const {createServer}=await import('vite')
  const vite=await createServer({server:{middlewareMode:true,hmr:false,allowedHosts:codespacesHost?[codespacesHost]:[],fs:{deny:['**/.git/**','**/.env*','**/var/**','**/*.sqlite','**/*.sqlite-*', `${store.dataDir}/**`]}},appType:'spa'})
  app.use(vite.middlewares)
}
const timer=setInterval(()=>void worker.flush(),60000)
timer.unref()
void worker.flush()
const server=app.listen(port,host,()=>console.log(`SGT server listening on port ${port}; email ${mailer?'configured':'pending SMTP configuration'}`))
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
  clearInterval(timer)
  server.close(()=>{store.db.close();process.exit(0)})
})
