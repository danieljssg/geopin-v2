'use client'

import { useState } from 'react'
import { Crosshair, Layers3, MapPin } from 'lucide-react'

const CAPAS = [
  { nombre: 'Parcelas', etiqueta: 'Registro catastral', detalle: 'Perímetros y ocupación del suelo', codigo: 'PARCELA / 024', valor: '1.284 m²' },
  { nombre: 'Servicios', etiqueta: 'Infraestructura urbana', detalle: 'Redes y servicios del territorio', codigo: 'RED / AGUA', valor: 'Trazado urbano' },
  { nombre: 'Capturas', etiqueta: 'Levantamiento de campo', detalle: 'Ubicación de registros georreferenciados', codigo: 'PUNTO / 008', valor: 'Registro GPS' },
]

export function TerritoryPreview() {
  const [activa, setActiva] = useState(0)
  const capa = CAPAS[activa]
  return (
    <div className="territory-preview motion-safe:animate-fade-in">
      <div className="map-toolbar"><span><span className="status-dot" /> EXPLORADOR TERRITORIAL</span><Crosshair size={16} /></div>
      <div className="map-canvas">
        <svg viewBox="0 0 560 420" role="img" aria-label={`Vista ilustrativa de ${capa.nombre.toLowerCase()} de un sector urbano`} className="territory-map">
          <defs><pattern id="survey-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#fff" strokeOpacity=".055" /></pattern></defs>
          <rect width="560" height="420" fill="url(#survey-grid)" />
          <g fill="none" stroke="#5b655f" strokeWidth="1" opacity=".45"><path d="M-20 280Q100 150 200 250T580 120M-20 300Q100 170 200 270T580 140M-20 320Q100 190 200 290T580 160M-20 340Q100 210 200 310T580 180M-20 360Q100 230 200 330T580 200" /></g>
          <g transform="translate(55 35) rotate(-18 230 180)">
            <g fill="#293330" stroke="#69726b" strokeWidth="1"><path d="M20 30h100v70H20zM135 30h80v70h-80zM230 30h130v70H230zM20 120h100v90H20zM135 120h80v90h-80zM230 120h130v90H230zM20 230h100v80H20zM135 230h80v80h-80zM230 230h130v80H230zM380 30h65v180h-65zM380 230h65v80h-65z" /></g>
            <g stroke="#46514b" strokeWidth="1"><path d="M65 30v70m110-70v70m100-70v70m40-70v70M65 120v90m110-90v90m100-90v90m40-90v90M65 230v80m110-80v80m100-80v80m40-80v80" /></g>
            <g className="map-layer" opacity={activa === 0 ? 1 : .15}><path d="M230 120h85v90h-85z" fill="#eebc55" fillOpacity=".2" stroke="#eebc55" strokeWidth="2" /><g fill="#eebc55">{[[230,120],[315,120],[315,210],[230,210]].map(([x,y]) => <rect key={`${x}-${y}`} x={x-3} y={y-3} width="6" height="6" />)}</g></g>
            <g className="map-layer" opacity={activa === 1 ? 1 : .12} fill="none" stroke="#79c8d5" strokeWidth="3" strokeDasharray="6 4"><path d="M-20 110H460M222 0v340M370 0v340" /></g>
            <g className="map-layer" opacity={activa === 2 ? 1 : .25} fill="#eebc55" stroke="#202724" strokeWidth="4">{[[70,65],[175,160],[275,265],[410,160],[275,65]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8" />)}</g>
          </g>
          <g fill="#a7afa8" fontFamily="monospace" fontSize="9"><text x="25" y="395">0 ├──────┼──────┤ 100 m</text><text x="520" y="42">N</text><path d="m523 49-5 16 5-4 5 4Z" fill="#eebc55" /></g>
        </svg>
        <div className="map-caption"><span>SECTOR URBANO</span><span>VISTA ILUSTRATIVA / SIN DATOS REALES</span></div>
        <div className="map-selection" aria-live="polite"><MapPin size={17} /><div key={activa} className="motion-safe:animate-fade-in"><span>{capa.codigo}</span><strong>{capa.valor}</strong></div><span className="selection-cross">+</span></div>
      </div>
      <div className="map-tabs" aria-label="Capas de la demostración"><Layers3 size={15} />{CAPAS.map((item, i) => <button key={item.nombre} type="button" aria-pressed={activa === i} onClick={() => setActiva(i)}>{item.nombre}</button>)}</div>
      <div className="map-description" aria-live="polite"><strong>{capa.etiqueta}</strong><span>{capa.detalle}</span></div>
    </div>
  )
}
