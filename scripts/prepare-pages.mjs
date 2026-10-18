import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const directory = resolve('dist-pages')
const html = readFileSync(resolve(directory, 'index.html'))
for (const route of ['ksk', 'geo', 'cabinet', 'privacy']) {
  mkdirSync(resolve(directory, route), { recursive: true })
  writeFileSync(resolve(directory, route, 'index.html'), html)
}
writeFileSync(resolve(directory, '.nojekyll'), '')
writeFileSync(resolve(directory, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
console.log('GitHub Pages preview prepared with direct entry routes.')
