import { useState } from 'react'
import { ArrowRight, ArrowUpRight, Compass, Layers3, ScanLine } from 'lucide-react'
const stages=[
  { title:'Оценка территории', caption:'Начинаем с геологической основы', text:'Анализируем материалы прошлых работ, строение участка и условия образования месторождений. Выделяем перспективные направления дальнейших исследований.' },
  { title:'Дистанционные исследования', caption:'От общей картины — к перспективным зонам', text:'Используем спутниковые материалы, мультиспектральную съёмку и лидар. Результаты интерпретации определяют участки для последующей наземной проверки.' },
  { title:'Полевые работы и пробы', caption:'Проверяем на местности', text:'Соединяем наземные исследования, геофизические методы и опробование. Мобильное технологическое оборудование помогает изучать сырьё непосредственно на объекте.' },
  { title:'Технологии переработки', caption:'Ищем ценность в составе сырья', text:'Разрабатываем подходы к обогащению бедных и упорных руд, хвостов и техногенного сырья. Учитываем основные и попутные полезные компоненты.' },
]
const regions=[
  {name:'Россия и Центральная Азия',countries:'Россия · Узбекистан · Казахстан'},
  {name:'Африка',countries:'Судан · Буркина-Фасо · Кения · Египет · Мали · Нигерия · Гана · Чад · Руанда'},
  {name:'Южная Америка',countries:'Перу · Парагвай · Аргентина · Венесуэла'},
  {name:'Ближний Восток',countries:'Иран'},
]
export default function GeoSection(){
  const [stage,setStage]=useState(0)
  const [region,setRegion]=useState(0)
  return <section className="geo-section" id="geo">
    <div className="wrap">
      <div className="section-index"><span><i/> 02 / СГТ — ГЕО</span><span>ГЕОЛОГИЯ. ПОИСК. ТЕХНОЛОГИИ.</span></div>
      <div className="geo-heading"><h2>Смотрим глубже.<br/><span>Видим возможности.</span></h2><p>Изучение геологических участков. Поиск полезных ископаемых. Технологии переработки руд и техногенного сырья.</p></div>
      <div className="geo-interactive">
        <div className={`geo-visual stage-${stage}`}>
          <div className="geo-visual-top"><span className="eyebrow">ПОД ПОВЕРХНОСТЬЮ — ПОТЕНЦИАЛ</span><span className="crosshair">+</span></div>
          <svg viewBox="0 0 700 500" aria-label="Интерактивный геологический разрез: от исходных данных к проектному решению" role="img">
            <defs><linearGradient id="earth-front" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#55555a"/><stop offset="1" stopColor="#25262b"/></linearGradient><linearGradient id="earth-top"><stop stopColor="#73767a"/><stop offset="1" stopColor="#414448"/></linearGradient><pattern id="contours" width="46" height="25" patternUnits="userSpaceOnUse"><path d="M-20 25 Q0 -5 20 13 T65 6 M-20 38 Q0 8 20 26 T65 19" fill="none" stroke="#c3c3c0" strokeWidth=".6" opacity=".4"/></pattern></defs>
            <g className="earth-object">
              <path d="M105 207 L350 87 L595 207 L350 327Z" fill="url(#earth-top)" stroke="#9b9d9b" strokeWidth=".7"/>
              <path d="M105 207 L350 327 L350 445 L105 325Z" fill="url(#earth-front)"/>
              <path d="M350 327 L595 207 L595 325 L350 445Z" fill="#35363b"/>
              <path d="M105 207 L350 87 L595 207 L350 327Z" fill="url(#contours)"/>
              <g fill="none" strokeWidth="1"><path d="M105 235 Q210 300 350 351 Q480 285 595 234" stroke="#858183"/><path d="M105 260 Q215 298 350 379 Q455 333 595 261" stroke="#b2a39d"/><path d="M105 287 Q245 350 350 410 Q475 370 595 287" stroke="#6f6565"/></g>
              <g className="geo-resource-layer"><path d="M105 266 Q240 314 350 387 Q480 325 595 270 L595 283 Q460 345 350 403 Q230 333 105 280Z" fill="#d71035"/><path d="M350 387 Q480 325 595 270 L595 283 Q460 345 350 403Z" fill="#fc3a5a"/></g>
              <g className="geo-survey" stroke="#eee9e6" fill="none" strokeWidth=".8"><path d="M210 230 L350 160 L490 230 L350 300Z" strokeDasharray="4 5"/><path d="M280 195 L420 265 M280 265 L420 195" strokeDasharray="4 5"/></g>
              <g className="geo-bore" stroke="#ed3454" fill="none"><path d="M350 140 V388" strokeWidth="2" strokeDasharray="5 5"/><circle cx="350" cy="230" r="12"/><circle cx="350" cy="230" r="25" opacity=".4"/><path d="M340 140h20 M345 133h10" strokeWidth="2"/></g>
              <g stroke="#777b7d" fill="none" strokeWidth=".6"><path d="M490 230 h135 v-65"/><path d="M595 279 h30 v60"/></g>
              <g fill="#b5b5b6" fontSize="9" fontFamily="Manrope,sans-serif" letterSpacing="1"><text x="550" y="152">ПОВЕРХНОСТЬ</text><text x="543" y="358">РЕСУРСНЫЙ СЛОЙ</text></g>
              <g fill="#ed3454"><circle cx="490" cy="230" r="3"/><circle cx="595" cy="279" r="3"/></g>
            </g>
          </svg>
          <div className="geo-scale"><span>СХЕМА ПОДХОДА</span><span>АНАЛИЗ → РЕШЕНИЕ <ArrowUpRight size={13}/></span></div>
        </div>
        <div className="geo-stages"><span className="eyebrow muted">ОТ ИЗУЧЕНИЯ УЧАСТКА К ПЕРЕРАБОТКЕ</span>{stages.map((s,i)=><div key={s.title} className={`geo-stage ${stage===i?'active':''}`}><button onClick={()=>setStage(i)} aria-expanded={stage===i} aria-controls={`geo-stage-${i}`}><span className="stage-number">0{i+1}</span><h3>{s.title}</h3><ArrowUpRight size={20}/></button>{stage===i&&<div className="geo-stage-content" id={`geo-stage-${i}`}><span>{s.caption}</span><p>{s.text}</p></div>}</div>)}<a className="text-link" href="mailto:info@sgt-holding.ru?subject=Запрос%20по%20направлению%20СГТ-ГЕО">Обсудить задачу <ArrowRight size={18}/></a></div>
      </div>
      <div className="geo-principles"><div><span>01</span><h3>Геология + технологии</h3><p>Оцениваем сырьё с учётом способов обогащения и дальнейшей переработки.</p></div><div><span>02</span><h3>Комплексный взгляд</h3><p>Изучаем основные и попутные компоненты: благородные, цветные, редкие и чёрные металлы.</p></div><div><span>03</span><h3>Проверка на местности</h3><p>Сопоставляем дистанционные данные, полевые наблюдения и результаты опробования.</p></div></div>
      <div className="geo-geography"><div className="geo-geography-heading"><span className="eyebrow red">ГЕОГРАФИЯ ИССЛЕДОВАНИЙ</span><h3>Опыт, который<br/>выходит за границы.</h3><p>Дистанционные и наземные исследования в России и за рубежом.</p></div><div className="geo-regions"><div className="region-buttons" aria-label="Регионы исследований">{regions.map((r,i)=><button key={r.name} onClick={()=>setRegion(i)} className={region===i?'active':''} aria-pressed={region===i}>{r.name}<ArrowUpRight size={14}/></button>)}</div><div className="region-countries" aria-live="polite"><span>0{region+1} / 04</span><p>{regions[region].countries}</p></div></div></div>
    </div>
  </section>
}
