import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { domainToASCII, fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function productionConfig(domainInput, email) {
  const input = domainInput?.trim().toLowerCase() || ''
  if (!input || /[^\p{L}\p{N}.-]/u.test(input)) throw new Error('Укажите только доменное имя без URL, пути и порта.')
  const domain = domainToASCII(input)
  const labels = domain.split('.')
  if (domain.length > 253 || labels.length < 2 || !/[a-z]/.test(labels.at(-1)) || labels.some(s => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s))) {
    throw new Error('Укажите домен без https://, www., путей и порта, например company.ru.')
  }
  if (domain.startsWith('www.') || domain.startsWith('cons.')) throw new Error('Укажите основной домен, например company.ru.')
  if (!/^[a-zA-Z0-9.!#$%&*+\-=?^_`{|}~]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email || '')) throw new Error('Укажите контактный email для уведомлений о сертификате.')
  return `# Private production configuration. Do not commit or send this file in chat.
SITE_DOMAIN=${domain}
ACME_EMAIL='${email}'
APP_ORIGIN=https://${domain},https://cons.${domain}
CONSORTIUM_HOST=cons.${domain}
SESSION_SECRET=${randomBytes(32).toString('hex')}
# Fill these values from your mail provider. Single quotes preserve $ and # in passwords.
SMTP_HOST=''
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=''
SMTP_PASS=''
SMTP_FROM=''
`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const content = productionConfig(process.argv[2], process.argv[3])
    writeFileSync('.env.production', content, { flag: 'wx', mode: 0o600 })
    console.log('Создан .env.production с новым секретом. Заполните SMTP перед приёмом реальных анкет. Существующие файлы не перезаписываются.')
  } catch (error) {
    console.error(error.code === 'EEXIST' ? '.env.production уже существует. Измените его вручную; секрет и настройки сохранены.' : error.message)
    process.exitCode = 1
  }
}
