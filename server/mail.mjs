import nodemailer from 'nodemailer'
import { resolve, dirname, sep } from 'node:path'

export const recipient = 'ok@sgt-h.ru'
export function mailConfig(env = process.env) {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM)
}
export function makeMailer(env = process.env) {
  if (!mailConfig(env)) return null
  const secure = env.SMTP_SECURE !== 'false'
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port: Number(env.SMTP_PORT || (secure ? 465 : 587)), secure,
    requireTLS: !secure,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000
  })
  return { sendMail: msg => transport.sendMail({ ...msg, from: env.SMTP_FROM }), verify: () => transport.verify() }
}
export function createMailWorker(store, mailer) {
  let running = false
  async function flush() {
    if (running || !mailer) return
    running = true
    try {
      const rows = store.db.prepare("SELECT * FROM applications WHERE status = 'queued' AND next_attempt <= ? ORDER BY created_at LIMIT 10").all(Date.now())
      for (const app of rows) {
        try {
          const path = resolve(app.stored_path)
          if (!path.startsWith(resolve(store.uploadsDir)+sep) || dirname(path) !== resolve(store.uploadsDir)) throw new Error('Invalid attachment path')
          await mailer.sendMail({
            to: recipient,
            replyTo: { name: app.name, address: app.email },
            subject: `СГТ-КСК: заявка партнёра ${app.company.replace(/[\r\n]/g, ' ')}`,
            text: [
              `Новая заявка партнёра № ${app.id}`, `Компания: ${app.company}`, `Контакт: ${app.name}`,
              `Email: ${app.email}`, `ИНН: ${app.inn || 'не указан'}`, `Сообщение: ${app.message || 'не указано'}`,
              `Согласие: ${app.consent_version}`, `Принята: ${app.created_at}`
            ].join('\n\n'),
            attachments: [{ filename: app.filename, path }], disableUrlAccess: true
          })
          store.db.prepare("UPDATE applications SET status='sent', sent_at=CURRENT_TIMESTAMP, attempts=attempts+1 WHERE id=?").run(app.id)
        } catch {
          const delay = Math.min(24 * 60 * 60_000, 60_000 * 2 ** Math.min(app.attempts, 10))
          store.db.prepare('UPDATE applications SET attempts=attempts+1, next_attempt=? WHERE id=?').run(Date.now()+delay, app.id)
          console.error(`Mail delivery pending for application ${app.id}; retry scheduled`)
        }
      }
    } finally { running = false }
  }
  return { flush }
}
