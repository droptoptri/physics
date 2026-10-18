import { useRef, useState } from 'react'

const towers = [
  { x: 270, y: 195, h: 125, w: 64, type: 'solid' },
  { x: 365, y: 220, h: 185, w: 68, type: 'frame' },
  { x: 180, y: 245, h: 100, w: 58, type: 'frame' },
  { x: 275, y: 305, h: 165, w: 82, type: 'red' },
  { x: 390, y: 330, h: 110, w: 65, type: 'solid' },
  { x: 160, y: 345, h: 70, w: 50, type: 'solid' },
]
function Tower({ x, y, h, w, type }: typeof towers[number]) {
  const d = w * .53
  const color = type === 'red' ? '#df1637' : type === 'solid' ? '#81858a' : '#575c63'
  return <g className={`tower tower-${type}`}>
    <path d={`M ${x} ${y} l ${w} ${d} l 0 ${-h} l ${-w} ${-d} Z`} fill={type === 'frame' ? '#1a1c2080' : type === 'red' ? '#a90924' : '#3b3e43'} stroke={color} strokeWidth=".8" />
    <path d={`M ${x+w} ${y+d} l ${w} ${-d} l 0 ${-h} l ${-w} ${d} Z`} fill={type === 'frame' ? '#1a1c2060' : type === 'red' ? '#e01b3c' : '#51555b'} stroke={color} strokeWidth=".8" />
    <path d={`M ${x} ${y-h} l ${w} ${-d} l ${w} ${d} l ${-w} ${d} Z`} fill={type === 'red' ? '#f33b58' : '#70757d'} fillOpacity={type === 'frame' ? .14 : 1} stroke={color} strokeWidth=".8" />
    {Array.from({ length: Math.floor(h/17) }, (_, i) => <g key={i} stroke={type === 'red' ? '#ff607a' : '#9298a0'} strokeOpacity=".5" strokeWidth=".6">
      <path d={`M ${x} ${y-i*17} l ${w} ${d} l ${w} ${-d}`} fill="none" />
      {type === 'frame' && <path d={`M ${x} ${y-i*17} l ${w} ${d-17} l ${w} ${17-d}`} fill="none" />}
    </g>)}
    {[.25,.5,.75].map(f => <g key={f} stroke={color} strokeWidth=".7"><path d={`M ${x+w*f} ${y+d*f} v ${-h}`} /><path d={`M ${x+w+w*f} ${y+d-d*f} v ${-h}`} /></g>)}
  </g>
}
export default function Structure() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const b = e.currentTarget.getBoundingClientRect()
    ref.current?.style.setProperty('--rx', `${(e.clientY-b.top-b.height/2)/70}deg`)
    ref.current?.style.setProperty('--ry', `${(e.clientX-b.left-b.width/2)/70}deg`)
  }
  return <div className="structure-scene" onPointerMove={move} onPointerLeave={() => {ref.current?.style.setProperty('--rx','0deg');ref.current?.style.setProperty('--ry','0deg')}}>
    <div className="scene-grid" aria-hidden="true" />
    <div className="scene-object" ref={ref}>
      <svg viewBox="0 0 680 520" role="img" aria-label="Архитектурная схема: разные компетенции объединяются в один проект">
        <defs><radialGradient id="scene-glow"><stop stopColor="#c61336" stopOpacity=".17"/><stop offset="1" stopColor="#c61336" stopOpacity="0"/></radialGradient><filter id="red-glow"><feGaussianBlur stdDeviation="4" /></filter></defs>
        <ellipse cx="340" cy="320" rx="300" ry="200" fill="url(#scene-glow)" />
        <g className="platform" fill="none" stroke="#444950" strokeWidth=".65">
          <path d="M 75 339 L 335 201 L 595 339 L 335 477 Z" fill="#202227"/>
          <path d="M 75 339 v 13 L 335 490 L 595 352 v -13 M 335 477 v 13"/>
          {Array.from({ length: 9 }, (_, i) => <g key={i}><path d={`M ${75+i*32.5} ${339-i*17.25} l 260 138`}/><path d={`M ${75+i*32.5} ${339+i*17.25} l 260 -138`}/></g>)}
        </g>
        <g className="signal-paths" fill="none" stroke="#d51c3e" strokeWidth="1.2"><path id="signal1" d="M 100 339 L 205 394 L 335 325 L 465 394 L 570 339"/><path id="signal2" d="M 205 270 L 335 339 L 465 270"/></g>
        {towers.map((t,i)=><Tower {...t} key={i}/>)}
        <path d="M 335 80 v -35 M 320 60 l 15 -15 l 15 15" fill="none" stroke="#ef3153" strokeWidth="1" className="rise-arrow"/>
        <g fill="#f34563"><circle r="2.6"><animateMotion dur="7s" repeatCount="indefinite"><mpath href="#signal1"/></animateMotion></circle><circle r="2"><animateMotion dur="5s" repeatCount="indefinite"><mpath href="#signal2"/></animateMotion></circle></g>
        <g fill="none" stroke="#969ba4" strokeWidth=".6" strokeDasharray="2 4"><path d="M 180 145 H 110 v 75"/><path d="M 500 240 H 560 v -60"/><path d="M 420 420 H 535"/></g>
        <g fill="#b6b7be" fontFamily="Manrope, sans-serif" fontSize="9" letterSpacing="1.3"><text x="100" y="132">ИНЖИНИРИНГ</text><text x="505" y="164">РЕСУРСЫ</text><text x="472" y="442">КОМПЕТЕНЦИИ</text></g>
        <circle cx="110" cy="220" r="3" fill="#d71035"/><circle cx="560" cy="180" r="3" fill="#d71035"/>
      </svg>
    </div>
    <div className="scene-label"><span className="live-dot"/> СИЛА В ОБЪЕДИНЕНИИ <span className="scene-cross">+</span></div>
    <div className="scene-selector" aria-label="Принципы объединения">{['Компетенции','Ресурсы','Координация'].map((s,i)=><button key={s} className={active===i?'active':''} onClick={()=>setActive(i)} aria-pressed={active===i}>{String(i+1).padStart(2,'0')}<span>{s}</span></button>)}</div>
    <p className="scene-caption" aria-live="polite">{['Профильная экспертиза для каждого этапа проекта.','Производственная и инженерная база участников.','Единый подход к взаимодействию проектных команд.'][active]}</p>
  </div>
}
