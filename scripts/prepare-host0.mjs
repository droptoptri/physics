import { cpSync, mkdirSync, existsSync, writeFileSync, rmSync, readdirSync, chmodSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const destination='.host0-build'
if(!existsSync('hosting/php/vendor/autoload.php'))throw new Error('Install the locked PHP dependencies in hosting/php with composer install --no-dev first.')
rmSync(destination,{recursive:true,force:true});mkdirSync(destination,{recursive:true})
cpSync('dist',`${destination}/public`,{recursive:true})
cpSync('hosting/php/public',`${destination}/public`,{recursive:true})
mkdirSync(`${destination}/sgt-private`)
for(const name of ['bootstrap.php','schema.php','mail.php','cron.php','.htaccess','install-password.example.txt'])cpSync(`hosting/php/private/${name}`,`${destination}/sgt-private/${name}`)
cpSync('hosting/php/vendor',`${destination}/sgt-private/vendor`,{recursive:true})
cpSync('hosting/php/composer.lock',`${destination}/sgt-private/composer.lock`)
cpSync('hosting/php/tests/router.php',`${destination}/router.php`)
cpSync('docs/REG-RU.md',`${destination}/ИНСТРУКЦИЯ.md`)
writeFileSync(`${destination}/README.txt`,'Сайт для sgt-h.ru, REG.RU Хост-0.\n\nСодержимое sgt-h.ru загрузите в корень сайта sgt-h.ru, включая .htaccess и .user.ini.\nПапку sgt-private разместите РЯДОМ с папкой сайта, за пределами его корня.\nНЕ загружайте sgt-private внутрь public.\nСоздайте в sgt-private файл install-password.txt со своим уникальным паролем от 20 символов, затем откройте https://sgt-h.ru/setup.\nПодробно: https://github.com/droptoptri/physics/blob/main/docs/REG-RU.md\n')
// Public assets must be readable by the hosting web server after ZIP extraction.
function publicPermissions(path) {
  chmodSync(path,0o755)
  for(const entry of readdirSync(path,{withFileTypes:true})) {
    const child=`${path}/${entry.name}`
    if(entry.isDirectory())publicPermissions(child)
    else chmodSync(child,0o644)
  }
}
publicPermissions(`${destination}/public`)
mkdirSync('releases',{recursive:true})
execFileSync('python3',['-c',`from pathlib import Path
import zipfile
root=Path('.host0-build')
with zipfile.ZipFile('releases/sgt-host0.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file() and p.name != 'router.php':
   relative=p.relative_to(root)
   if relative.parts[0]=='public': relative=Path('sgt-h.ru',*relative.parts[1:])
   z.write(p,relative)
`],{stdio:'inherit'})
console.log('Prepared releases/sgt-host0.zip. No passwords, user data or default accounts are bundled.')
