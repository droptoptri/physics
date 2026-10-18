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
  const root=await request.get('/',{headers:{Host:'cons.sgt-holding.ru'},maxRedirects:0})
  expect(root.status()).toBe(302)
  expect(root.headers().location).toBe('/ksk')
  const section=await request.get('/ksk',{headers:{Host:'cons.sgt-holding.ru'},maxRedirects:0})
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
