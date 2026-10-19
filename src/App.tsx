import { currentPage } from './site'
import { sitePath } from './site'
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpRight, Building2, Check, ChevronDown, Factory, HardHat, Landmark, LockKeyhole, Menu, MoveUpRight, Network, Route, X } from 'lucide-react'
import Structure from './components/Structure'
import PartnerForm from './components/PartnerForm'
import Cabinet from './components/Cabinet'
import GeoSection from './components/GeoSection'

const competencies=[
  {name:'Гражданское строительство',text:'Жилые и общественные здания, школы, медицинские и спортивные объекты.',Icon:Building2},
  {name:'Промышленные объекты',text:'Производственные комплексы, реконструкция предприятий и технологические объекты.',Icon:Factory},
  {name:'Транспортная инфраструктура',text:'Автомобильные дороги, мосты и сопутствующая инфраструктура.',Icon:Route},
  {name:'Инженерные системы',text:'Водоснабжение, водоотведение, инженерные сети и обеспечение территорий.',Icon:Network},
  {name:'Специальные проекты',text:'Нефтегазовая инфраструктура и объекты с повышенными техническими требованиями.',Icon:HardHat},
]
const process=[
  {title:'Изучаем задачу',text:'Анализируем технические требования, сроки, географию и состав работ.'},
  {title:'Находим компетенции',text:'Сопоставляем опыт, финансовый масштаб, разрешения и ресурсы участников.'},
  {title:'Собираем команду',text:'Выбираем профильного исполнителя и согласовываем роли и зоны ответственности.'},
]
function Counter({value,suffix}:{value:number;suffix?:string}){
  const ref=useRef<HTMLSpanElement>(null)
  const [current,setCurrent]=useState(value)
  useEffect(()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return
    let frame=0
    const observer=new IntersectionObserver(([entry])=>{
      if(!entry.isIntersecting)return
      observer.disconnect()
      const start=performance.now()
      function tick(now:number){const p=Math.min((now-start)/1250,1);setCurrent(Math.round(value*(1-(1-p)**3)));if(p<1)frame=requestAnimationFrame(tick)}
      frame=requestAnimationFrame(tick)
    },{threshold:.7})
    if(ref.current)observer.observe(ref.current)
    return()=>{observer.disconnect();cancelAnimationFrame(frame)}
  },[value])
  return <span ref={ref}><span className="sr-only">{value}{suffix}</span><span aria-hidden="true">{current.toLocaleString('ru-RU')}{suffix}</span></span>
}
function Privacy(){return <><header className="simple-header wrap"><a className="wordmark" href={sitePath('/')}><span>SGT<span className="brand-square"/></span><small>HOLDING</small></a><a href={sitePath('/')} className="text-link">На главную <ArrowUpRight size={17}/></a></header><main className="privacy wrap"><span className="eyebrow red">СГТ-ХОЛДИНГ</span><h1>Обработка{' '}<br/>персональных данных</h1><p className="privacy-date">Редакция от 18 октября 2026 года</p><h2>Для чего мы получаем данные</h2><p>Сведения из формы партнёра, приложенной анкеты и регистрации используются для рассмотрения возможности сотрудничества, проверки компании, ответа на обращение и предоставления доступа к предложениям консорциума.</p><h2>Какие сведения обрабатываются</h2><p>Название компании, ИНН, имя представителя, электронная почта, комментарий и сведения, которые вы включили в анкету. Для входа сохраняются защищённый хеш пароля и служебная сессия. Не включайте в анкету паспортные данные, сведения о здоровье и иные данные, не нужные для рассмотрения партнёрства.</p><h2>Как используются анкеты</h2><p>Анкета хранится в закрытой части системы и передаётся координатору по адресу antnpk@gmail.com после подключения почтовой доставки. Она не публикуется на сайте. Доступ предоставляется только уполномоченным сотрудникам для рассмотрения обращения.</p><h2>Ваш выбор и права</h2><p>Отправка формы и регистрация добровольны. Вы можете запросить сведения об обработке, исправление или удаление данных и отозвать согласие по адресу <a href="mailto:info@sgt-holding.ru">info@sgt-holding.ru</a>. Укажите адрес, использованный при обращении, и номер заявки, если он известен.</p><h2>Сроки и служебные cookie</h2><p>Данные используются в пределах целей обращения и применимых требований законодательства. По завершении рассмотрения или при отзыве согласия запрос на удаление рассматривается координатором. Cookie используются для авторизации (до 7 дней) и защиты форм. Рекламные и аналитические cookie на этом сайте не устанавливаются.</p><h2>Контакт</h2><p>СГТ-Холдинг: <a href="mailto:info@sgt-holding.ru">info@sgt-holding.ru</a>.</p></main></>}
export default function App(){
  const [partnerOpen,setPartnerOpen]=useState(false)
  const [menuOpen,setMenuOpen]=useState(false)
  const [active,setActive]=useState('ksk')
  const [competency,setCompetency]=useState(0)
  const [scrolled,setScrolled]=useState(false)
  const page=currentPage()
  useEffect(()=>{
    if(page==='/cabinet'||page==='/privacy')return
    const onScroll=()=>setScrolled(window.scrollY>300)
    window.addEventListener('scroll',onScroll,{passive:true})
    const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)setActive(e.target.id)},{rootMargin:'-20% 0px -55% 0px'})
    for(const id of ['ksk','geo','partnership']){const el=document.getElementById(id);if(el)observer.observe(el)}
    const reveal=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');reveal.unobserve(e.target)}})},{threshold:.08})
    document.querySelectorAll('.reveal').forEach(el=>reveal.observe(el))
    const target=window.location.hash.slice(1)||(page==='/geo'?'geo':page==='/ksk'?'ksk':'')
    const timer=window.setTimeout(()=>{if(target)document.getElementById(target)?.scrollIntoView({behavior:'instant'})},100)
    return()=>{window.removeEventListener('scroll',onScroll);observer.disconnect();reveal.disconnect();clearTimeout(timer)}
  },[page])
  useEffect(()=>{if(page==='/cabinet')document.title='Кабинет партнёра — СГТ-КСК';if(page==='/privacy')document.title='Обработка данных — СГТ-Холдинг'},[page])
  if(page==='/cabinet')return <Cabinet/>
  if(page==='/privacy')return <Privacy/>
  const openPartner=()=>{setMenuOpen(false);setPartnerOpen(true)}
  return <>
    <a className="skip-link" href="#main">Перейти к содержимому</a>
    <header className="site-header"><div className="header-inner wrap"><a href={sitePath('/')} className="logo" aria-label="СГТ-Холдинг — главная"><img src={sitePath('/brand/sgt-logo.jpeg')} alt="SGT Holding" width="96" height="68"/></a><div className="header-divider"/><span className="header-tagline">ОБЪЕДИНЯЯ КОМПЕТЕНЦИИ.{' '}<br/>СОЗДАВАЯ ВОЗМОЖНОСТИ.</span><nav id="mobile-nav" className={menuOpen?'header-nav open':'header-nav'} aria-label="Основная навигация"><a className={active==='ksk'?'active':''} href="#ksk" onClick={()=>setMenuOpen(false)}>СГТ — КСК</a><a className={active==='geo'?'active':''} href="#geo" onClick={()=>setMenuOpen(false)}>СГТ — ГЕО</a><a href="#partnership" onClick={()=>setMenuOpen(false)}>Партнёрам</a><a className="cabinet-link" href={sitePath('/cabinet')}><LockKeyhole size={15}/> Личный кабинет <ArrowUpRight size={15}/></a></nav><button className="mobile-menu icon-button" aria-label={menuOpen?'Закрыть меню':'Открыть меню'} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?<X/>:<Menu/>}</button></div></header>
    <main id="main">
      <section className="hero" id="ksk"><div className="wrap hero-wrap"><div className="hero-topline"><span><i/> СГТ — КОНСОРЦИУМ СТРОИТЕЛЬНЫХ КОМПАНИЙ</span><span>ОТ КОМПЕТЕНЦИЙ К РЕЗУЛЬТАТУ <MoveUpRight size={13}/></span></div><div className="hero-main"><div className="hero-copy"><div className="hero-chapter"><span>01</span> СТРОИМ СВЯЗИ. РЕАЛИЗУЕМ ПРОЕКТЫ.</div><h1>Объединяем{' '}<br/>компетенции.{' '}<br/><span>Создаём будущее.</span></h1><p>Сильные компании. Общие ресурсы.{' '}<br/>Единый подход к сложным строительным{' '}<br className="desktop-break"/>и инфраструктурным проектам.</p><div className="hero-actions"><button className="button button-red" onClick={openPartner}>Стать партнёром <ArrowUpRight size={19}/></button><a href="#competencies" className="hero-more">О консорциуме <span><ArrowDown size={17}/></span></a></div></div><Structure/></div><div className="hero-bottom"><div className="hero-metric"><strong><Counter value={10}/><span className="metric-accent">/</span></strong><p>генеральных подрядных{' '}<br/>компаний в объединении</p></div><div className="hero-metric"><strong><Counter value={20} suffix="+"/><span className="metric-unit">млрд ₽</span></strong><p>совокупная годовая{' '}<br/>выручка участников</p></div><div className="hero-metric"><strong><Counter value={1000} suffix="+"/></strong><p>специалистов строительного{' '}<br/>и инженерного профиля</p></div><a className="hero-scroll" href="#competencies"><span>ДВИГАЙТЕСЬ{' '}<br/>К ВОЗМОЖНОСТЯМ</span><ArrowDown size={25}/></a></div><p className="metric-source">По данным информационной справки СГТ-КСК. Подтверждающие документы — по запросу.</p></div></section>
      <section className="competencies-section" id="competencies"><div className="wrap"><div className="section-index"><span><i/> КОМПЕТЕНЦИИ ОБЪЕДИНЕНИЯ</span><a href={sitePath('/documents/sgt-ksk.pdf')} target="_blank" rel="noreferrer">О КОНСОРЦИУМЕ / PDF <ArrowUpRight size={15}/></a></div><div className="competencies-layout"><div className="section-heading reveal"><span className="eyebrow red">СИЛА РАЗНЫХ. РЕЗУЛЬТАТ ОБЩИЙ.</span><h2>Одна команда.{' '}<br/>Масштаб вашей{' '}<br/><span>задачи.</span></h2><p>Подбираем исполнителей под проект — с учётом специализации, ресурсов и требований объекта.</p><div className="competency-symbol" aria-hidden="true">{(()=>{const Icon=competencies[competency].Icon;return <Icon strokeWidth={.6}/>})()}<span>0{competency+1} / 05</span></div></div><div className="competencies-list reveal">{competencies.map((c,i)=><div key={c.name} className={`competency-row ${competency===i?'active':''}`}><button onClick={()=>setCompetency(i)} aria-expanded={competency===i} aria-controls={`competency-${i}`}><span className="list-number">0{i+1}</span><h3>{c.name}</h3><span className="row-arrow"><ArrowUpRight size={21}/></span></button>{competency===i&&<div className="competency-detail" id={`competency-${i}`}><p>{c.text}</p><span>ПРОФИЛЬНАЯ ЭКСПЕРТИЗА УЧАСТНИКОВ</span></div>}</div>)}</div></div><div className="project-process reveal">{process.map((p,i)=><div key={p.title}><span className="process-number">0{i+1}</span><div><h3>{p.title}</h3><p>{p.text}</p></div>{i<2&&<ArrowRight className="process-arrow" size={20}/>}</div>)}</div><div className="geography-strip"><span className="eyebrow red">ГЕОГРАФИЯ УЧАСТНИКОВ</span><p>Москва и ЦФО <i/> Северо-Запад <i/> Юг России <i/> Поволжье <i/> Урал <i/> Сибирь <i/> Дальний Восток</p></div><p className="qualification-note">Состав команды, обязательства и разрешения проверяются для каждого проекта. Ресурсы и допуски разных компаний не суммируются автоматически.</p></div></section>
      <section className="partnership-section" id="partnership"><div className="wrap partnership-inner reveal"><div><span className="eyebrow red">ВМЕСТЕ МОЖНО БОЛЬШЕ</span><h2>Следующий большой проект{' '}<br/>может стать <span>нашим общим.</span></h2><p>Присоединяйтесь к профессиональному объединению.{' '}<br/>Начнём со знакомства с вашей компанией.</p></div><div className="partnership-actions"><button className="button button-dark" onClick={openPartner}>Стать партнёром <ArrowUpRight size={20}/></button><a className="text-link" href={sitePath('/documents/sgt-partner-questionnaire.docx')} download><ArrowDownToLine size={18}/> Скачать опросный лист <span className="file-badge">DOCX</span></a><a className="subtle-link" href={sitePath('/cabinet')}>Уже партнёр? Войти в кабинет <ArrowRight size={15}/></a></div><span className="partnership-watermark" aria-hidden="true">+</span></div></section>
      <GeoSection/>
      <section className="contact-section"><div className="wrap"><div className="contact-top"><span className="eyebrow">НАЧНЁМ С ДИАЛОГА</span><span className="live-status"><i/> ОТКРЫТЫ К СОТРУДНИЧЕСТВУ</span></div><div className="contact-main"><h2>Есть задача?{' '}<br/><span>Найдём решение.</span></h2><a href="mailto:info@sgt-holding.ru" className="contact-arrow" aria-label="Написать СГТ-Холдинг"><ArrowUpRight strokeWidth={1} size={75}/></a></div><div className="contact-bottom"><p>Строительные, инфраструктурные и ресурсные проекты.{' '}<br/>Москва · Пн–Пт, 10:00–19:00 (МСК)</p><div className="contact-channels"><a href="mailto:info@sgt-holding.ru">info@sgt-holding.ru <ArrowUpRight size={19}/></a><div><a href="tel:+79999738884">+7 999 973 88 84</a><a href="https://t.me/sgtholding" target="_blank" rel="noreferrer">Telegram <ArrowUpRight size={13}/></a></div></div></div></div></section>
    </main>
    <footer className="site-footer"><div className="wrap"><div className="footer-top"><a className="wordmark" href="#ksk" aria-label="СГТ-Холдинг — наверх"><span>SGT<span className="brand-square"/></span><small>HOLDING</small></a><p>ОБЪЕДИНЯЯ КОМПЕТЕНЦИИ.{' '}<br/>СОЗДАВАЯ ВОЗМОЖНОСТИ.</p><nav aria-label="Навигация в подвале"><a href="#ksk">СГТ — КСК</a><a href="#geo">СГТ — ГЕО</a><a href={sitePath('/cabinet')}>Кабинет партнёра <ArrowUpRight size={13}/></a></nav><a className="back-to-top" href="#ksk" aria-label="Наверх"><ArrowUp size={22}/></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} СГТ-Холдинг</span><span>СТРОИМ БУДУЩЕЕ ВМЕСТЕ</span><a href={sitePath('/privacy')}>Обработка персональных данных</a></div></div></footer>
    <a href="#partnership" className={`floating-partner ${scrolled?'visible':''}`} aria-label="Перейти к партнёрству"><span>Стать партнёром</span><ArrowUpRight size={21}/></a>
    {partnerOpen&&<PartnerForm onClose={()=>setPartnerOpen(false)}/>}
  </>
}
