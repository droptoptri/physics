import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { productionConfig } from '../scripts/configure-production.mjs'

test('production configuration sets both HTTPS origins and generates unique secrets', () => {
  const config = productionConfig(' Company.RU ', 'admin@example.com')
  assert.match(config, /APP_ORIGIN=https:\/\/company.ru,https:\/\/cons.company.ru\n/)
  assert.match(config, /CONSORTIUM_HOST=cons.company.ru\n/)
  assert.match(config, /SESSION_SECRET=[a-f0-9]{64}\n/)
  assert.notEqual(config.match(/SESSION_SECRET=(.*)/)[1], productionConfig('company.ru','admin@example.com').match(/SESSION_SECRET=(.*)/)[1])
  assert.match(productionConfig('пример.рф','admin@example.com'), /SITE_DOMAIN=xn--e1afmkfd.xn--p1ai\n/)
})

test('production configuration rejects URL, host and email injection', () => {
  for (const domain of ['https://company.ru', 'company.ru/path', 'company.ru:3000', 'www.company.ru', 'cons.company.ru', 'company.ru\nSMTP_HOST=evil', 'localhost', '127.0.0.1', '-bad.ru']) {
    assert.throws(() => productionConfig(domain, 'admin@example.com'), domain)
  }
  for (const email of ['hello', 'admin@example.com\nNODE_ENV=test', "a'b@example.com"]) assert.throws(() => productionConfig('company.ru', email))
})

test('configuration CLI protects file permissions and refuses to overwrite a saved secret', () => {
  const cwd = mkdtempSync(join(tmpdir(),'sgt-production-config-'))
  const script = resolve('scripts/configure-production.mjs')
  try {
    const first = spawnSync(process.execPath, [script, 'company.ru', 'admin@example.com'], { cwd })
    assert.equal(first.status, 0)
    const file = join(cwd,'.env.production'), original = readFileSync(file,'utf8')
    assert.equal(statSync(file).mode & 0o777, 0o600)
    const second = spawnSync(process.execPath, [script, 'other.ru', 'admin@example.com'], { cwd })
    assert.equal(second.status, 1)
    assert.equal(readFileSync(file,'utf8'), original)
    assert.ok(!first.stdout.toString().includes(original.match(/SESSION_SECRET=(.*)/)[1]))
  } finally { rmSync(cwd,{recursive:true,force:true}) }
})
