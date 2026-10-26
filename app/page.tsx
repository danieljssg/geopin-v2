import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, BookOpen, FileSliders, MapPin, MoveUpRight, WifiOff } from 'lucide-react'
import { RedirigirSiSesion } from '@/components/auth/RedirigirSiSesion'
import { ThemeToggle } from '@/components/ThemeToggle'
import { TerritoryPreview } from '@/components/landing/TerritoryPreview'

export const metadata: Metadata = {
  title: 'GeoPin — Ingeniería del territorio',
  description: 'Plataforma de levantamiento territorial para el decanato de Ingeniería Civil y Urbanismo. Captura, organiza y analiza datos en campo, incluso sin conexión.',
}

const CAPACIDADES = [
  { icon: MapPin, title: 'El territorio, con precisión.', text: 'Registra parcelas, delimita perímetros y ubica cada captura con el GPS de tu dispositivo.', tag: '01 / CAPTURA GEOESPACIAL' },
  { icon: WifiOff, title: 'El campo no se detiene.', text: 'Descarga mapas y guarda capturas sin conexión. Sincroniza el trabajo cuando recuperes la señal.', tag: '02 / CONTINUIDAD EN CAMPO' },
  { icon: FileSliders, title: 'Cada estudio, su estructura.', text: 'Configura formularios por módulo y adapta la captura a las necesidades de cada levantamiento.', tag: '03 / FORMULARIOS FLEXIBLES' },
  { icon: BarChart3, title: 'Datos que orientan decisiones.', text: 'Consulta el avance por zona, revisa registros e importa o exporta información para su análisis.', tag: '04 / GESTIÓN Y ANÁLISIS' },
]
const ACCESOS = [
  { href: '/campo', title: 'App de campo', text: 'Captura georreferenciada', number: '01' },
  { href: '/listado', title: 'Parcelas levantadas', text: 'Consulta y revisión de registros', number: '02' },
  { href: '/admin/dashboard', title: 'Dashboard', text: 'Avance y cobertura territorial', number: '03' },
  { href: '/admin/importar', title: 'Importación', text: 'Archivos Excel y CSV', number: '04' },
  { href: '/admin/esquema', title: 'Esquemas', text: 'Configuración de formularios', number: '05' },
  { href: '/login', title: 'Mi cuenta', text: 'Acceso a la plataforma', number: '06' },
]

export default function LandingPage() {
  return (
    <div className="industrial landing-shell">
      <RedirigirSiSesion destino="/listado" />
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <header className="public-header"><div className="public-header-inner">
        <Link href="/" className="geopin-brand" aria-label="GeoPin, inicio"><span className="brand-symbol"><MapPin size={21} /></span>GeoPin<span className="brand-index">/ GIS</span></Link>
        <nav aria-label="Navegación principal" className="public-nav"><a href="#plataforma" className="desktop-link">Plataforma</a><Link href="/docs">Docs <ArrowUpRight size={13} /></Link><ThemeToggle /><Link href="/login" className="header-login">Entrar <ArrowRight size={15} /></Link></nav>
      </div></header>
      <main id="contenido">
        <section className="industrial-hero">
          <div className="hero-topline"><span>DECANATO DE INGENIERÍA CIVIL Y URBANISMO</span><span>TECNOLOGÍA APLICADA AL TERRITORIO</span></div>
          <div className="hero-layout"><div className="hero-copy motion-safe:animate-fade-in-up">
            <p className="eyebrow"><span className="status-dot" /> PLATAFORMA DE LEVANTAMIENTO TERRITORIAL</p>
            <h1>Entender el territorio.<br /><span>Construir lo que sigue.</span></h1>
            <p className="hero-description">Del trabajo de campo al conocimiento urbano. Captura, organiza y analiza información geográfica en una plataforma pensada para la comunidad universitaria.</p>
            <div className="hero-actions"><Link href="/campo" className="industrial-button">Abrir app de campo <ArrowUpRight size={19} /></Link><Link href="/docs" className="text-action"><BookOpen size={17} /> Explorar documentación <ArrowRight size={16} /></Link></div>
            <div className="hero-notes"><span><WifiOff size={14} /> Trabajo sin conexión</span><span><MapPin size={14} /> Datos georreferenciados</span></div>
          </div><TerritoryPreview /></div>
          <div className="hero-baseline"><span>OBSERVAR. REGISTRAR. COMPRENDER.</span><a href="#plataforma">Explora la plataforma <ArrowDown size={14} /></a></div>
        </section>
        <section id="plataforma" className="industrial-section">
          <div className="section-heading"><p className="eyebrow">01 / CAPACIDADES</p><div><h2>Rigor técnico.<br /><span>Menos fricción en campo.</span></h2><p>Una herramienta común para estudiantes, docentes y equipos que estudian y transforman la ciudad.</p></div></div>
          <div className="capability-grid">{CAPACIDADES.map(({ icon: Icon, title, text, tag }) => <article className="capability-card" key={tag}><div className="capability-top"><Icon size={24} strokeWidth={1.4} /><MoveUpRight size={17} /></div><span className="technical-label">{tag}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>
        <section className="workflow-strip"><div><p className="eyebrow">DEL CAMPO AL ANÁLISIS</p><h2>Un flujo de trabajo conectado.</h2></div><ol>{[['01','Prepara','Define el levantamiento y sus formularios.'],['02','Captura','Registra el territorio, incluso sin señal.'],['03','Analiza','Sincroniza, revisa y comparte los resultados.']].map(([n,title,text]) => <li key={n}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
        <section id="herramientas" className="industrial-section"><div className="section-heading"><p className="eyebrow">02 / ESPACIO DE TRABAJO</p><div><h2>Tu siguiente paso,<br /><span>en un solo lugar.</span></h2><p>Accede a las herramientas de GeoPin con los permisos de tu cuenta.</p></div></div><div className="access-grid">{ACCESOS.map(({ href, title, text, number }) => <Link key={href} href={href} className="access-card"><span className="technical-label">{number}</span><div><h3>{title}</h3><p>{text}</p></div><ArrowUpRight size={20} /></Link>)}</div></section>
        <section className="docs-callout"><div><p className="eyebrow">CONOCIMIENTO COMPARTIDO</p><h2>La plataforma también<br />se entiende por dentro.</h2><p>Explora la arquitectura, los datos y las decisiones detrás de GeoPin.</p></div><Link href="/docs" className="industrial-button">Consultar documentación <ArrowUpRight size={18} /></Link></section>
      </main>
      <footer className="industrial-footer"><Link href="/" className="geopin-brand"><MapPin size={20} /> GeoPin</Link><span>Ingeniería Civil y Urbanismo · Información para el territorio.</span><Link href="/docs">Documentación <ArrowUpRight size={14} /></Link></footer>
    </div>
  )
}
