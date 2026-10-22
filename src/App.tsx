import { tr } from './i18n'
import { currentPage } from './site';
import { sitePath } from './site';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpRight, Building2, Check, ChevronDown, Factory, HardHat, Landmark, LockKeyhole, Menu, MoveUpRight, Network, Route, X } from 'lucide-react';
import Structure from './components/Structure';
import PartnerForm from './components/PartnerForm';
import Cabinet from './components/Cabinet';
import GeoSection from './components/GeoSection';
import LegalPage from './components/LegalPage';
import LanguageSwitcher from './components/LanguageSwitcher';
import { initializeLocale, localeTag } from './i18n';
const competencies = [
    { name: tr("Гражданское строительство"), text: tr("Жилые и общественные здания, школы, медицинские и спортивные объекты."), Icon: Building2 },
    { name: tr("Промышленные объекты"), text: tr("Производственные комплексы, реконструкция предприятий и технологические объекты."), Icon: Factory },
    { name: tr("Транспортная инфраструктура"), text: tr("Автомобильные дороги, мосты и сопутствующая инфраструктура."), Icon: Route },
    { name: tr("Инженерные системы"), text: tr("Водоснабжение, водоотведение, инженерные сети и обеспечение территорий."), Icon: Network },
    { name: tr("Специальные проекты"), text: tr("Нефтегазовая инфраструктура и объекты с повышенными техническими требованиями."), Icon: HardHat },
];
const process = [
    { title: tr("Изучаем задачу"), text: tr("Анализируем технические требования, сроки, географию и состав работ.") },
    { title: tr("Находим компетенции"), text: tr("Сопоставляем опыт, финансовый масштаб, разрешения и ресурсы участников.") },
    { title: tr("Собираем команду"), text: tr("Выбираем профильного исполнителя и согласовываем роли и зоны ответственности.") },
];
function Counter({ value, suffix }: {
    value: number;
    suffix?: string;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const [current, setCurrent] = useState(value);
    useEffect(() => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches)
            return;
        let frame = 0;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting)
                return;
            observer.disconnect();
            const start = performance.now();
            function tick(now: number) { const p = Math.min((now - start) / 1250, 1); setCurrent(Math.round(value * (1 - (1 - p) ** 3))); if (p < 1)
                frame = requestAnimationFrame(tick); }
            frame = requestAnimationFrame(tick);
        }, { threshold: .7 });
        if (ref.current)
            observer.observe(ref.current);
        return () => { observer.disconnect(); cancelAnimationFrame(frame); };
    }, [value]);
    return <span ref={ref}><span className="sr-only">{value}{suffix}</span><span aria-hidden="true">{current.toLocaleString(localeTag)}{suffix}</span></span>;
}
export default function App() {
    const [partnerOpen, setPartnerOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [active, setActive] = useState('ksk');
    const [competency, setCompetency] = useState(0);
    const [scrolled, setScrolled] = useState(false);
    const page = currentPage();
    useEffect(() => initializeLocale(page), [page]);
    useEffect(() => {
        if (page === '/cabinet' || page === '/privacy' || page === '/consent')
            return;
        const onScroll = () => setScrolled(window.scrollY > 300);
        window.addEventListener('scroll', onScroll, { passive: true });
        const observer = new IntersectionObserver(entries => { for (const e of entries)
            if (e.isIntersecting)
                setActive(e.target.id); }, { rootMargin: '-20% 0px -55% 0px' });
        for (const id of ['ksk', 'geo', 'partnership']) {
            const el = document.getElementById(id);
            if (el)
                observer.observe(el);
        }
        const reveal = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) {
            e.target.classList.add('revealed');
            reveal.unobserve(e.target);
        } }); }, { threshold: .08 });
        document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
        const target = window.location.hash.slice(1) || (page === '/geo' ? 'geo' : page === '/ksk' ? 'ksk' : '');
        const timer = window.setTimeout(() => { if (target)
            document.getElementById(target)?.scrollIntoView({ behavior: 'instant' }); }, 100);
        return () => { window.removeEventListener('scroll', onScroll); observer.disconnect(); reveal.disconnect(); clearTimeout(timer); };
    }, [page]);
    if (page === '/cabinet')
        return <Cabinet />;
    if (page === '/privacy' || page === '/consent')
        return <LegalPage consent={page === '/consent'}/>;
    const openPartner = () => { setMenuOpen(false); setPartnerOpen(true); };
    return <>
    <a className="skip-link" href="#main">{tr("Перейти к содержимому")}</a>
    <header className="site-header"><div className="header-inner wrap"><a href={sitePath('/')} className="logo" aria-label={tr("СГТ-Холдинг \u2014 главная")}><img src={sitePath('/brand/sgt-logo.jpeg')} alt="SGT Holding" width="96" height="68"/></a><div className="header-divider"/><span className="header-tagline">{tr("ОБЪЕДИНЯЯ КОМПЕТЕНЦИИ.")}{' '}<br />{tr("СОЗДАВАЯ ВОЗМОЖНОСТИ.")}</span><nav id="mobile-nav" className={menuOpen ? 'header-nav open' : 'header-nav'} aria-label={tr("Основная навигация")}><a className={active === 'ksk' ? 'active' : ''} href="#ksk" onClick={() => setMenuOpen(false)}>{tr("СГТ \u2014 КСК")}</a><a className={active === 'geo' ? 'active' : ''} href="#geo" onClick={() => setMenuOpen(false)}>{tr("СГТ \u2014 ГЕО")}</a><a href="#partnership" onClick={() => setMenuOpen(false)}>{tr("Партнёрам")}</a><a className="cabinet-link" href={sitePath('/cabinet')}><LockKeyhole size={15}/>{tr(" Личный кабинет ")}<ArrowUpRight size={15}/></a></nav><LanguageSwitcher /><button className="mobile-menu icon-button" aria-label={menuOpen ? tr("Закрыть меню") : tr("Открыть меню")} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div></header>
    <main id="main">
      <section className="hero" id="ksk"><div className="wrap hero-wrap"><div className="hero-topline"><span><i />{tr(" СГТ \u2014 КОНСОРЦИУМ СТРОИТЕЛЬНЫХ КОМПАНИЙ")}</span><span>{tr("ОТ КОМПЕТЕНЦИЙ К РЕЗУЛЬТАТУ ")}<MoveUpRight size={13}/></span></div><div className="hero-main"><div className="hero-copy"><div className="hero-chapter"><span>01</span>{tr(" СТРОИМ СВЯЗИ. РЕАЛИЗУЕМ ПРОЕКТЫ.")}</div><h1>{tr("Объединяем")}{' '}<br />{tr("компетенции.")}{' '}<br /><span>{tr("Создаём будущее.")}</span></h1><p>{tr("Сильные компании. Общие ресурсы.")}{' '}<br />{tr("Единый подход к сложным строительным")}{' '}<br className="desktop-break"/>{tr("и инфраструктурным проектам.")}</p><div className="hero-actions"><button className="button button-red" onClick={openPartner}>{tr("Стать партнёром ")}<ArrowUpRight size={19}/></button><a href="#competencies" className="hero-more">{tr("О консорциуме ")}<span><ArrowDown size={17}/></span></a></div></div><Structure /></div><div className="hero-bottom"><div className="hero-metric"><strong><Counter value={10}/><span className="metric-accent">/</span></strong><p>{tr("генеральных подрядных")}{' '}<br />{tr("компаний в объединении")}</p></div><div className="hero-metric"><strong><Counter value={20} suffix="+"/><span className="metric-unit">{tr("млрд \u20BD")}</span></strong><p>{tr("совокупная годовая")}{' '}<br />{tr("выручка участников")}</p></div><div className="hero-metric"><strong><Counter value={1000} suffix="+"/></strong><p>{tr("специалистов строительного")}{' '}<br />{tr("и инженерного профиля")}</p></div><a className="hero-scroll" href="#competencies"><span>{tr("ДВИГАЙТЕСЬ")}{' '}<br />{tr("К ВОЗМОЖНОСТЯМ")}</span><ArrowDown size={25}/></a></div></div></section>
      <section className="competencies-section" id="competencies"><div className="wrap"><div className="section-index"><span><i />{tr(" КОМПЕТЕНЦИИ ОБЪЕДИНЕНИЯ")}</span><a href={sitePath('/documents/sgt-ksk.pdf')} target="_blank" rel="noreferrer">{tr("О КОНСОРЦИУМЕ / PDF ")}<ArrowUpRight size={15}/></a></div><div className="competencies-layout"><div className="section-heading reveal"><span className="eyebrow red">{tr("СИЛА РАЗНЫХ. РЕЗУЛЬТАТ ОБЩИЙ.")}</span><h2>{tr("Одна команда.")}{' '}<br />{tr("Масштаб вашей")}{' '}<br /><span>{tr("задачи.")}</span></h2><p>{tr("Подбираем исполнителей под проект \u2014 с учётом специализации, ресурсов и требований объекта.")}</p><div className="competency-symbol" aria-hidden="true">{(() => { const Icon = competencies[competency].Icon; return <Icon strokeWidth={.6}/>; })()}<span>0{competency + 1} / 05</span></div></div><div className="competencies-list reveal">{competencies.map((c, i) => <div key={c.name} className={`competency-row ${competency === i ? 'active' : ''}`}><button onClick={() => setCompetency(i)} aria-expanded={competency === i} aria-controls={`competency-${i}`}><span className="list-number">0{i + 1}</span><h3>{c.name}</h3><span className="row-arrow"><ArrowUpRight size={21}/></span></button>{competency === i && <div className="competency-detail" id={`competency-${i}`}><p>{c.text}</p><span>{tr("ПРОФИЛЬНАЯ ЭКСПЕРТИЗА УЧАСТНИКОВ")}</span></div>}</div>)}</div></div><div className="project-process reveal">{process.map((p, i) => <div key={p.title}><span className="process-number">0{i + 1}</span><div><h3>{p.title}</h3><p>{p.text}</p></div>{i < 2 && <ArrowRight className="process-arrow" size={20}/>}</div>)}</div><div className="geography-strip"><span className="eyebrow red">{tr("ГЕОГРАФИЯ УЧАСТНИКОВ")}</span><p>{tr("Москва и ЦФО ")}<i />{tr(" Северо-Запад ")}<i />{tr(" Юг России ")}<i />{tr(" Поволжье ")}<i />{tr(" Урал ")}<i />{tr(" Сибирь ")}<i />{tr(" Дальний Восток")}</p></div><p className="qualification-note">{tr("Состав команды, обязательства и разрешения проверяются для каждого проекта. Ресурсы и допуски разных компаний не суммируются автоматически.")}</p></div></section>
      <section className="partnership-section" id="partnership"><div className="wrap partnership-inner reveal"><div><span className="eyebrow red">{tr("ВМЕСТЕ МОЖНО БОЛЬШЕ")}</span><h2>{tr("Следующий большой проект")}{' '}<br />{tr("может стать ")}<span>{tr("нашим общим.")}</span></h2><p>{tr("Присоединяйтесь к профессиональному объединению.")}{' '}<br />{tr("Начнём со знакомства с вашей компанией.")}</p></div><div className="partnership-actions"><button className="button button-dark" onClick={openPartner}>{tr("Стать партнёром ")}<ArrowUpRight size={20}/></button><a className="text-link" href={sitePath('/documents/sgt-partner-questionnaire.docx')} download><ArrowDownToLine size={18}/>{tr(" Скачать опросный лист ")}<span className="file-badge">DOCX</span></a><a className="subtle-link" href={sitePath('/cabinet')}>{tr("Уже партнёр? Войти в кабинет ")}<ArrowRight size={15}/></a></div><span className="partnership-watermark" aria-hidden="true">+</span></div></section>
      <GeoSection />
      <section className="contact-section"><div className="wrap"><div className="contact-top"><span className="eyebrow">{tr("НАЧНЁМ С ДИАЛОГА")}</span><span className="live-status"><i />{tr(" ОТКРЫТЫ К СОТРУДНИЧЕСТВУ")}</span></div><div className="contact-main"><h2>{tr("Есть задача?")}{' '}<br /><span>{tr("Найдём решение.")}</span></h2><a href="mailto:ok@sgt-h.ru" className="contact-arrow" aria-label={tr("Написать СГТ-Холдинг")}><ArrowUpRight strokeWidth={1} size={75}/></a></div><div className="contact-bottom"><p>{tr("Строительные, инфраструктурные и ресурсные проекты.")}{' '}<br />{tr("Москва \u00B7 Пн\u2013Пт, 10:00\u201319:00 (МСК)")}</p><div className="contact-channels"><a href="mailto:ok@sgt-h.ru">ok@sgt-h.ru <ArrowUpRight size={19}/></a><div><a href="tel:+79999738884">+7 999 973 88 84</a><a href="https://t.me/sgtholding" target="_blank" rel="noreferrer">Telegram <ArrowUpRight size={13}/></a></div></div></div></div></section>
    </main>
    <footer className="site-footer"><div className="wrap"><div className="footer-top"><a className="wordmark" href="#ksk" aria-label={tr("СГТ-Холдинг \u2014 наверх")}><span>SGT<span className="brand-square"/></span><small>HOLDING</small></a><p>{tr("ОБЪЕДИНЯЯ КОМПЕТЕНЦИИ.")}{' '}<br />{tr("СОЗДАВАЯ ВОЗМОЖНОСТИ.")}</p><nav aria-label={tr("Навигация в подвале")}><a href="#ksk">{tr("СГТ \u2014 КСК")}</a><a href="#geo">{tr("СГТ \u2014 ГЕО")}</a><a href={sitePath('/cabinet')}>{tr("Кабинет партнёра ")}<ArrowUpRight size={13}/></a></nav><a className="back-to-top" href="#ksk" aria-label={tr("Наверх")}><ArrowUp size={22}/></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()}{tr(" СГТ-Холдинг")}</span><span>{tr("СТРОИМ БУДУЩЕЕ ВМЕСТЕ")}</span><a href={sitePath('/privacy')}>{tr("Обработка персональных данных")}</a></div></div></footer>
    <a href="#partnership" className={`floating-partner ${scrolled ? 'visible' : ''}`} aria-label={tr("Перейти к партнёрству")}><span>{tr("Стать партнёром")}</span><ArrowUpRight size={21}/></a>
    {partnerOpen && <PartnerForm onClose={() => setPartnerOpen(false)}/>}
  </>;
}
