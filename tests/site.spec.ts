import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
const questionnaire=readFileSync('public/documents/sgt-partner-questionnaire.docx')

test('landing navigation, accordions, animations and document downloads',async({page,isMobile})=>{
  const errors:string[]=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading',{level:1})).toContainText('Объединяем')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  await page.getByRole('button',{name:'Промышленные объекты'}).click()
  await expect(page.getByText('Производственные комплексы, реконструкция предприятий и технологические объекты.')).toBeVisible()
  if(isMobile)await page.getByRole('button',{name:'Открыть меню'}).click()
  await page.getByRole('navigation',{name:'Основная навигация'}).getByRole('link',{name:'СГТ — ГЕО'}).click()
  await expect(page).toHaveURL(/#geo/)
  await expect(page.getByRole('heading',{name:'Смотрим глубже. Видим возможности.'})).toBeInViewport()
  await page.getByRole('button',{name:'Дистанционные исследования'}).click()
  await expect(page.getByText('От общей картины — к перспективным зонам')).toBeVisible()
  await page.getByRole('button',{name:'Южная Америка',exact:true}).click()
  await expect(page.getByText('Перу · Парагвай · Аргентина · Венесуэла')).toBeVisible()
  const response=await page.request.get('/documents/sgt-partner-questionnaire.docx')
  expect(response.ok()).toBeTruthy()
  expect((await response.body()).length).toBe(questionnaire.length)
  expect((await page.request.get('/documents/sgt-ksk.pdf')).status()).toBe(200)
  expect(errors).toEqual([])
})

test('partner form accepts the original questionnaire and honestly shows queued status',async({page})=>{
  await page.goto('/')
  await page.getByRole('button',{name:'Стать партнёром'}).first().click()
  const dialog=page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Компания').fill('ООО Браузерный тест')
  await dialog.getByLabel('Контактное лицо').fill('Тестовый Партнёр')
  await dialog.getByLabel('Электронная почта').fill('browser@example.com')
  await dialog.locator('input[type=file]').setInputFiles({name:'anketa.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:questionnaire})
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button',{name:'Отправить заявку'}).click()
  await expect(dialog.getByRole('heading')).toContainText('Спасибо за интерес')
  await expect(dialog.getByText(/Отправка на почту станет доступна/)).toBeVisible()
  await dialog.getByRole('button',{name:'Вернуться на сайт'}).click()
  await expect(dialog).not.toBeVisible()
})

test('registration creates a pending account, protects tenders and supports logout',async({page})=>{
  await page.goto('/cabinet')
  await page.getByRole('button',{name:'Регистрация',exact:true}).click()
  await page.getByLabel('Компания', {exact:true}).fill('ООО Новый партнёр')
  await page.getByLabel('Имя и фамилия').fill('Алексей Тестовый')
  await page.getByLabel('Электронная почта').fill(`partner-${Date.now()}@example.com`)
  await page.getByLabel('Пароль',{exact:true}).fill('Test-partner-password-2026')
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:'Зарегистрироваться'}).click()
  await expect(page.getByRole('heading',{level:1})).toContainText('Алексей')
  await expect(page.getByText('На подтверждении',{exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading',{level:1})).toContainText('Алексей')
  const tenders=await page.request.get('/api/tenders')
  expect(tenders.status()).toBe(403)
  await page.getByRole('button',{name:'Выйти'}).click()
  await expect(page.getByRole('heading',{name:'Личный кабинет',exact:true})).toBeVisible()
})

test('keyboard dialog dismissal and direct geo entry work without layout overflow',async({page})=>{
  await page.goto('/geo')
  await expect(page.getByRole('heading',{name:'Смотрим глубже. Видим возможности.'})).toBeInViewport()
  await page.locator('#partnership').getByRole('button',{name:'Стать партнёром'}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
})

test('private storage cannot be retrieved through public paths',async({request})=>{
  for(const path of ['/var/sgt.sqlite','/var/sgt.sqlite-wal','/var/uploads/any','.env','/@fs/tmp/sgt-playwright-data/sgt.sqlite']){
    const r=await request.get('/'+path.replace(/^\//,''))
    expect(r.status(),path).toBe(404)
  }
})


test('consortium subdomain enters the section without a fragment redirect loop',async({request})=>{
  const root=await request.get('/',{headers:{Host:'cons.test.example'},maxRedirects:0})
  expect(root.status()).toBe(302)
  expect(root.headers().location).toBe('/ksk')
  const otherHost=await request.get('/',{headers:{Host:'sgt-holding.ru'},maxRedirects:0})
  expect(otherHost.status()).toBe(200)
  const section=await request.get('/ksk',{headers:{Host:'cons.test.example'},maxRedirects:0})
  expect(section.status()).toBe(200)
  expect(await section.text()).toContain('<div id="root">')
})

test('approved partner can search real test proposals, open details and contact the coordinator',async({page})=>{
  const {DatabaseSync}=await import('node:sqlite')
  const email=`approved-${Date.now()}@example.com`
  await page.goto('/cabinet')
  await page.getByRole('button',{name:'Регистрация',exact:true}).click()
  await page.getByLabel('Компания',{exact:true}).fill('Тестовый подрядчик')
  await page.getByLabel('Имя и фамилия').fill('Иван Проверочный')
  await page.getByLabel('Электронная почта').fill(email)
  await page.getByLabel('Пароль',{exact:true}).fill('Test-approved-password-2026')
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:'Зарегистрироваться'}).click()
  await expect(page.getByText('На подтверждении',{exact:true})).toBeVisible()
  const db=new DatabaseSync('/tmp/sgt-playwright-data/sgt.sqlite')
  db.exec('PRAGMA foreign_keys=ON')
  db.prepare('UPDATE users SET approved=1 WHERE email=?').run(email)
  const tender=db.prepare('INSERT INTO tenders(title,category,region,description,deadline,contact) VALUES(?,?,?,?,?,?)').run('Тест: инженерные сети','Инженерные системы','Сибирь','Тестовое описание работ для проверки закрытого кабинета.','2099-12-31','coordinator@example.com')
  try{
    await page.reload()
    await expect(page.getByText('Компания подтверждена',{exact:true})).toBeVisible()
    await page.getByLabel('Поиск по тендерам').fill('несуществующий объект')
    await expect(page.getByRole('heading',{name:'Ничего не нашлось'})).toBeVisible()
    await page.getByRole('button',{name:'Сбросить фильтры'}).click()
    await page.getByLabel('Направление тендера').selectOption('Инженерные системы')
    await page.getByRole('button',{name:'Тест: инженерные сети'}).click()
    await expect(page.getByText('Тестовое описание работ для проверки закрытого кабинета.')).toBeVisible()
    await expect(page.getByRole('link',{name:'Обсудить участие'})).toHaveAttribute('href',/^mailto:coordinator%40example.com/)
  }finally{
    db.prepare('DELETE FROM tenders WHERE id=?').run(tender.lastInsertRowid)
    db.prepare('DELETE FROM users WHERE email=?').run(email)
    db.close()
  }
})

test('core pages and partner form pass automated WCAG A/AA checks with reduced motion',async({page})=>{
  const {default:AxeBuilder}=await import('@axe-core/playwright')
  await page.emulateMedia({reducedMotion:'reduce'})
  for(const target of ['landing','login','register','partner']){
    await page.goto(target==='login'||target==='register'?'/cabinet':'/')
    if(target==='register')await page.getByRole('button',{name:'Регистрация',exact:true}).click()
    if(target==='partner')await page.getByRole('button',{name:'Стать партнёром'}).first().click()
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    expect(result.violations,`${target}: ${JSON.stringify(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})))}`).toEqual([])
  }
})

// Check rendered text, since hiding a <br> can silently join words only on mobile.
test('copy keeps word separators and has no indented or clipped lines at nine widths', async ({page}) => {
  const { checkResponsiveCopy } = await import('./typography')
  await checkResponsiveCopy(page, '/')
})

for(const language of ['en','zh'] as const){
  test(`complete ${language} entry, language links, PDF and separate consent work`,async({page,request})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`/geo?lang=${language}`)
    await expect(page.locator('html')).toHaveAttribute('lang',language==='zh'?'zh-Hans':'en')
    const geo=page.locator('#geo')
    await expect(geo.getByRole('heading',{level:2})).toContainText(language==='en'?'Looking deeper.':'深入探索。')
    const download=geo.getByRole('link',{name:language==='en'?'Download presentation':'下载演示文稿'})
    await expect(download).toHaveAttribute('download','SGT_GEO_Updated_2026.pdf')
    const pdf=await request.get((await download.getAttribute('href'))!)
    expect(Buffer.from(await pdf.body())).toEqual(readFileSync('public/documents/SGT_GEO_Updated_2026.pdf'))
    await expect(geo.getByText(language==='en'?'Further information on completed projects and studies is available upon additional request.':'有关已完成项目及研究的详细信息，可另行提出请求获取。')).toBeVisible()
    await expect(page.locator('.contact-channels>a')).toHaveAttribute('href','mailto:ok@sgt-h.ru')
    await expect(page.locator('.metric-source')).toHaveCount(0)
    const languageLinks=page.locator('.site-header .language-switcher')
    await expect(languageLinks.getByRole('link',{name:language==='en'?'English':'简体中文',exact:true})).toHaveAttribute('aria-current','true')
    await expect(languageLinks.getByRole('link',{name:'Русский',exact:true})).toHaveAttribute('href','/geo')
    await page.locator('#partnership').getByRole('button').click()
    const dialog=page.getByRole('dialog')
    await expect(dialog.getByRole('checkbox')).not.toBeChecked()
    await expect(dialog.locator('a[href*="/consent"]')).toHaveAttribute('href',`/consent?lang=${language}`)
    await expect(dialog.locator('a[href*="/privacy"]')).toHaveAttribute('href',`/privacy?lang=${language}`)
    await dialog.getByLabel(language==='en'?'Company':'企业名称',{exact:false}).first().fill('Language test company')
    await dialog.getByLabel(language==='en'?'Contact person':'联系人').fill('Test Partner')
    await dialog.getByLabel(language==='en'?'Email':'电子邮箱',{exact:false}).fill(`locale-${language}-${Date.now()}@example.com`)
    await dialog.locator('input[type=file]').setInputFiles('public/documents/sgt-partner-questionnaire.docx')
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button',{name:language==='en'?'Submit application':'提交申请'}).click()
    await expect(dialog.getByRole('heading')).toContainText(language==='en'?'Thank you':'感谢')
    await page.goto(`/consent?lang=${language}`)
    await expect(page.getByRole('heading',{level:1})).toContainText(language==='en'?'Consent to personal data processing':'个人数据处理同意书')
    await expect(page.locator('main')).toContainText('9721166136')
    await expect(page.locator('main')).toContainText('1227700319428')
    expect(errors).toEqual([])
  })

  test(`${language} cabinet, legal pages and responsive header remain usable`,async({page})=>{
    await page.goto(`/cabinet?lang=${language}`)
    await expect(page.getByRole('heading',{level:2})).toContainText(language==='en'?'Partner portal':'合作伙伴平台')
    await page.getByRole('button',{name:language==='en'?'Register':'注册',exact:true}).click()
    await expect(page.locator('input[type=checkbox]')).not.toBeChecked()
    await expect(page.locator('a[href*="/consent"]')).toHaveAttribute('href',`/consent?lang=${language}`)
    await page.getByLabel(language==='en'?'Company':'企业名称',{exact:true}).fill('Language cabinet company')
    await page.getByLabel(language==='en'?'Full name':'姓名',{exact:true}).fill('Language Partner')
    await page.getByLabel(language==='en'?'Email':'电子邮箱',{exact:true}).fill(`registration-${language}-${Date.now()}@example.com`)
    await page.getByLabel(language==='en'?'Password':'密码',{exact:true}).fill('Language-password-2026')
    await page.getByRole('checkbox').check()
    await page.getByRole('button',{name:language==='en'?'Create account':'创建账户',exact:true}).click()
    await expect(page.locator('.account-badge')).toContainText(language==='en'?'Awaiting verification':'等待审核')
    for(const width of [320,375,768,1024,1440]){
      await page.setViewportSize({width,height:900})
      await page.goto(`/?lang=${language}`)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${language} width=${width}`).toBeTruthy()
      for(const a of await page.locator('.site-header .language-switcher a').all())await expect(a).toBeInViewport()
    }
    await page.goto(`/privacy?lang=${language}`)
    await expect(page.getByRole('heading',{level:1})).toContainText(language==='en'?'Personal data processing policy':'个人数据处理政策')
  })
}

test('translated legal pages and partner forms pass automated accessibility checks',async({page})=>{
  const {default:AxeBuilder}=await import('@axe-core/playwright')
  await page.emulateMedia({reducedMotion:'reduce'})
  for(const lang of ['en','zh'])for(const target of ['partner','consent','privacy']){
    await page.goto(`${target==='partner'?'/':`/${target}`}?lang=${lang}`)
    if(target==='partner')await page.locator('.hero-actions button').click()
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),`${lang} ${target}`).toEqual([])
  }
})
