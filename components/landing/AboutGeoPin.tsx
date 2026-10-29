import { ArrowUpRight, Plus } from 'lucide-react'

const MOMENTOS = [
  { titulo: 'El problema', texto: 'Cada encuestador trabajaba con datos aislados. Consolidar archivos Excel manualmente consumía tiempo y dificultaba la consulta de la información territorial.' },
  { titulo: 'La solución', texto: 'GeoPin permite registrar edificaciones, servicios, puntos y superficies desde una interfaz móvil, directamente en el territorio.' },
  { titulo: 'La diferencia', texto: 'Los levantamientos se consolidan en una base central, con un panel administrativo y mapas interactivos para consultar los resultados.' },
  { titulo: 'El propósito', texto: 'Facilitar actividades académicas y de investigación mediante una herramienta adaptable, con potencial para llegar a otras instituciones.' },
]

export function AboutGeoPin() {
  return (
    <section id="acerca" className="about-geopin industrial-section" aria-labelledby="about-title">
      <div className="about-intro">
        <div><p className="eyebrow">03 / ACERCA DE GEOPIN</p><h2 id="about-title">Una iniciativa académica.<br /><span>Un territorio de posibilidades.</span></h2></div>
        <p><strong>GeoPin</strong> es una plataforma web progresiva (PWA) para el levantamiento, caracterización y gestión de información geoespacial, orientada a estudiantes, docentes, investigadores y profesionales del urbanismo y áreas relacionadas.</p>
      </div>
      <ol className="about-moments">{MOMENTOS.map(({ titulo, texto }, index) => <li key={titulo}><span className="moment-number" aria-hidden="true">0{index + 1}</span><h3>{titulo}</h3><p>{texto}</p></li>)}</ol>
      <div className="about-faq">
        <div className="about-faq-heading"><p className="eyebrow">PERSONAS + PROPÓSITO</p><h3>Detrás de los datos,<br />hay una iniciativa.</h3><p>Conoce al equipo, el origen del proyecto y la visión que guía su evolución.</p><a href="https://github.com/danieljssg/geopin-v2" className="text-action">Explorar el repositorio <ArrowUpRight size={16} /></a></div>
        <div className="faq-items">
          <details open><summary>¿Quiénes están detrás de GeoPin?<Plus size={19} aria-hidden="true" /></summary><div className="faq-answer"><div className="team-person"><span className="technical-label">CO-CREADORA E IMPULSORA DE LA INICIATIVA</span><h4>Daniela Victoria Garcés Jiménez</h4><p>Estudiante de Urbanismo de la Universidad Centroccidental Lisandro Alvarado (UCLA).</p></div><div className="team-person"><span className="technical-label">DESARROLLO Y ARQUITECTURA DE SOFTWARE</span><h4>Daniel Saud</h4><a href="https://github.com/danieljssg">Conocer su trabajo en GitHub <ArrowUpRight size={14} aria-hidden="true" /></a></div></div></details>
          <details><summary>¿Por qué nace este proyecto?<Plus size={19} aria-hidden="true" /></summary><div className="faq-answer"><p>Surge de la necesidad de simplificar la recopilación de información en campo, reducir los procesos manuales de consolidación y facilitar la consulta y el análisis de datos territoriales mediante mapas interactivos y registros centralizados.</p></div></details>
          <details><summary>¿A quién está dirigido?<Plus size={19} aria-hidden="true" /></summary><div className="faq-answer"><p>A estudiantes, docentes, investigadores y profesionales del urbanismo y áreas relacionadas que necesitan levantar, caracterizar y consultar información geoespacial para sus actividades académicas y profesionales.</p></div></details>
          <details><summary>¿Cuál es la visión de GeoPin?<Plus size={19} aria-hidden="true" /></summary><div className="faq-answer"><p>GeoPin se concibe como una herramienta de apoyo académico y tecnológico, con la aspiración de facilitar su uso, estudio y evolución por parte de la comunidad universitaria. Su propósito es ser adaptable y potencialmente abierta a otras instituciones.</p></div></details>
        </div>
      </div>
    </section>
  )
}
