import { isPreview } from '../site'
import { demoUser, demoTenders } from '../preview'
import { sitePath } from '../site'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Eye, EyeOff, FileSearch, Loader2, LockKeyhole, LogOut, MapPin, Search, ShieldCheck } from 'lucide-react'
import { api, type User, type Tender } from '../api'

export default function Cabinet() {
  const [user,setUser]=useState<User|null>(null)
  const [loading,setLoading]=useState(true)
  const [mode,setMode]=useState<'login'|'register'>('login')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [visible,setVisible]=useState(false)
  const [tenders,setTenders]=useState<Tender[]>([])
  const [loadingTenders,setLoadingTenders]=useState(false)
  const [tenderError,setTenderError]=useState('')
  const [query,setQuery]=useState('')
  const [category,setCategory]=useState('Все направления')
  const [opened,setOpened]=useState<number|null>(null)
  const [retry,setRetry]=useState(0)
  const [demoNote,setDemoNote]=useState('')
  useEffect(()=>{if(isPreview){setLoading(false);return}api<{user:User|null}>('/api/auth/me').then(d=>setUser(d.user)).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
  useEffect(()=>{
    if(user?.approved){
      if(isPreview){setTenders(demoTenders);return}
      setLoadingTenders(true);setTenderError('')
      api<{tenders:Tender[]}>('/api/tenders').then(d=>setTenders(d.tenders)).catch(e=>setTenderError(e.message)).finally(()=>setLoadingTenders(false))
    }
  },[user,retry])
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();if(isPreview)return;setBusy(true);setError('')
    const data=new FormData(e.currentTarget)
    const payload=Object.fromEntries(data)
    try{
      const result=await api<{user:User}>(`/api/auth/${mode}`,{method:'POST',body:JSON.stringify({...payload,consent:data.has('consent')})})
      setUser(result.user)
    }catch(e){setError(e instanceof Error?e.message:'Ошибка соединения.')}
    finally{setBusy(false)}
  }
  async function logout(){if(isPreview){setUser(null);setTenders([]);setDemoNote('');return}setBusy(true);setError('');try{await api('/api/auth/logout',{method:'POST'});setUser(null);setTenders([])}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const filtered=tenders.filter(t=>(category==='Все направления'||t.category===category)&&`${t.title} ${t.region} ${t.description}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="cabinet-page">
    <header className="cabinet-header"><a href={sitePath('/')} className="wordmark" aria-label="СГТ-Холдинг — главная"><span>SGT<span className="brand-square"/></span><small>HOLDING</small></a><a className="text-link" href={sitePath('/')}><ArrowLeft size={16}/> Вернуться на сайт</a>{user&&<button className="text-link" onClick={logout} disabled={busy}>Выйти <LogOut size={17}/></button>}</header>
    {loading?<div className="cabinet-loading" role="status"><Loader2 className="spin"/> Загружаем кабинет…</div>:user?<main className="dashboard wrap">
      <div className="dashboard-top"><div><span className="eyebrow red">СГТ-КСК / ЛИЧНЫЙ КАБИНЕТ</span><h1>Здравствуйте, {user.name.split(' ')[0]}.</h1><p>{user.company}</p></div><span className={`account-badge ${user.approved?'approved':''}`}><ShieldCheck size={16}/>{user.approved?'Компания подтверждена':'На подтверждении'}</span></div>
      {error&&<p className="form-error" role="alert">{error}</p>}{isPreview&&<p className="preview-inline-note" role="status">{demoNote||'Демонстрационный кабинет. Все предложения ниже вымышлены и показаны для тестирования интерфейса.'}</p>}
      {!user.approved?<div className="pending-panel"><div className="pending-symbol"><LockKeyhole size={32}/></div><span className="eyebrow">РЕГИСТРАЦИЯ ЗАВЕРШЕНА</span><h2>Знакомство — первый шаг{' '}<br/>к совместной работе.</h2><p>Координатор проверит сведения о компании и откроет доступ к предложениям по тендерам. До подтверждения предложения защищены.</p><div className="pending-steps"><span><Check size={17}/> Аккаунт создан</span><span><span className="live-dot"/> Проверка компании</span><span>03 &nbsp; Доступ к тендерам</span></div><a className="button button-dark" href="mailto:antnpk@gmail.com?subject=СГТ-КСК%3A%20подтверждение%20компании">Связаться с координатором <ArrowUpRight size={18}/></a></div>:<>
        <div className="dashboard-section-title"><h2>Предложения по тендерам <span>{tenders.length}</span></h2><p>Актуальные возможности для участников консорциума</p></div>
        <div className="tender-tools"><label className="search-field"><Search size={19}/><input aria-label="Поиск по тендерам" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название, регион или вид работ"/></label><label className="select-field"><select aria-label="Направление тендера" value={category} onChange={e=>setCategory(e.target.value)}><option>Все направления</option>{Array.from(new Set(tenders.map(t=>t.category))).map(c=><option key={c}>{c}</option>)}</select><ChevronDown size={16}/></label></div>
        {loadingTenders?<p className="loading-line"><Loader2 className="spin" size={20}/> Загружаем предложения…</p>:tenderError?<div className="empty-tenders"><p role="alert">{tenderError}</p><button className="button button-dark" onClick={()=>setRetry(v=>v+1)}>Повторить загрузку</button></div>:filtered.length?<div className="tender-list">{filtered.map(t=><article className="tender-card" key={t.id}><div className="tender-meta"><span>{t.category}</span><span><MapPin size={14}/>{t.region}</span></div><button className="tender-title" onClick={()=>setOpened(opened===t.id?null:t.id)} aria-expanded={opened===t.id}><h3>{t.title}</h3><ArrowUpRight size={25}/></button><span className="tender-deadline"><CalendarDays size={15}/> Приём откликов до {new Date(t.deadline+'T12:00:00').toLocaleDateString('ru-RU')}</span>{opened===t.id&&<div className="tender-details"><p>{t.description}</p><a className="text-link red" onClick={isPreview?(e)=>{e.preventDefault();setDemoNote('Это демонстрационное предложение. Отклики в тестовой версии не отправляются.')}:undefined} href={`mailto:${encodeURIComponent(t.contact)}?subject=${encodeURIComponent('Отклик на тендер: '+t.title)}`}>Обсудить участие <ArrowRight size={17}/></a></div>}</article>)}</div>:<div className="empty-tenders"><FileSearch size={38} strokeWidth={1}/><h3>{tenders.length?'Ничего не нашлось':'Новые возможности — впереди'}</h3><p>{tenders.length?'Измените запрос или выберите другое направление.':'Координатор опубликует предложения здесь, как только они будут доступны.'}</p>{tenders.length>0&&<button className="text-link red" onClick={()=>{setQuery('');setCategory('Все направления')}}>Сбросить фильтры <ArrowRight size={16}/></button>}</div>}
      </>}
    </main>:<main className="auth-layout">
      <div className="auth-story"><span className="eyebrow">СГТ-КСК / ПАРТНЁРСКАЯ ПЛАТФОРМА</span><h1>Ваши компетенции.{' '}<br/>Наши общие{' '}<br/><em>возможности.</em></h1><p>Закрытое пространство для взаимодействия участников консорциума.</p><div className="auth-orbit" aria-hidden="true"><div/><div/><div/><span>SGT</span></div><div className="auth-story-bottom"><ShieldCheck size={20}/><span>Доступ к предложениям —{' '}<br/>после подтверждения компании</span></div></div>
      <div className="auth-form-panel"><div className="auth-form-inner"><span className="eyebrow red">ДОБРО ПОЖАЛОВАТЬ</span><h2>{mode==='login'?'Личный кабинет':'Стать участником'}</h2><p>{mode==='login'?'Войдите, чтобы увидеть предложения для вашей компании.':'Создайте аккаунт. Координатор проверит компанию и откроет доступ к предложениям.'}</p>{isPreview&&<div className="preview-cabinet-tools"><p>Регистрация и вход доступны в серверной версии. Здесь можно открыть демонстрационный кабинет без ввода данных.</p><button className="button button-dark full-width" onClick={()=>{setError('');setUser(demoUser)}}>Посмотреть демо-кабинет <ArrowUpRight size={18}/></button></div>}<div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>Вход</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>Регистрация</button></div>
      <form onSubmit={submit} key={mode}>
        {mode==='register'&&<><label>Компания<input name="company" required minLength={2} maxLength={200} autoComplete="organization" placeholder="Название вашей компании"/></label><label>Имя и фамилия<input name="name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Как к вам обращаться"/></label></>}
        <label>Электронная почта<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="name@company.ru"/></label>
        <label>Пароль<div className="password-input"><input name="password" type={visible?'text':'password'} required minLength={12} maxLength={128} autoComplete={mode==='register'?'new-password':'current-password'} placeholder={mode==='register'?'Не менее 12 символов':'Введите пароль'}/><button type="button" onClick={()=>setVisible(!visible)} aria-label={visible?'Скрыть пароль':'Показать пароль'}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>
        {mode==='register'&&<label className="checkbox-label"><input type="checkbox" name="consent" required/><span>Согласен на обработку данных для регистрации и рассмотрения партнёрства согласно <a href={sitePath('/privacy')} target="_blank" rel="noreferrer">политике обработки данных</a>.</span></label>}
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="button button-red full-width" disabled={busy||isPreview}>{busy?<Loader2 className="spin" size={19}/>:mode==='login'?'Войти в кабинет':'Зарегистрироваться'}<ArrowUpRight size={18}/></button>
      </form><a className="auth-help" href="mailto:antnpk@gmail.com?subject=СГТ-КСК%3A%20помощь%20со%20входом">Нужна помощь со входом?</a><p className="auth-footnote"><LockKeyhole size={13}/> Предложения доступны зарегистрированным и подтверждённым партнёрам.</p></div></div>
    </main>}
  </div>
}
