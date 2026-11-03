'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, Boxes, Database, Globe2, Laptop, LockKeyhole, Search, X, Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const NODOS = [
  { id: 'ui', title: 'Interfaz web y móvil', detail: 'Next.js App Router, React y componentes shadcn/ui. El formulario de campo y los paneles se adaptan al ancho disponible.', icon: Laptop },
  { id: 'api', title: 'API y reglas de dominio', detail: 'Route handlers validan contratos, permisos y peticiones. Las reglas GIS, de sincronización e importación se mantienen en módulos de dominio puros.', icon: Server },
  { id: 'mongo', title: 'MongoDB compatible', detail: 'Cosmos DB for MongoDB almacena parcelas, esquemas, levantamientos, entornos Manager, membresías, solicitudes, invitaciones y autenticación. Los índices espaciales aceleran consultas GeoJSON.', icon: Database },
  { id: 'offline', title: 'Trabajo sin conexión', detail: 'IndexedDB separa capturas y outbox por cuenta; los esquemas y dashboards se cachean por usuario, levantamiento y filtros. El sincronizador reintenta con backoff y conserva como bloqueadas las capturas cuyo acceso fue revocado.', icon: Boxes },
]

const ENTIDADES = [
  { name: 'parcelas', fields: 'id, ubicacion (GeoJSON), geometria, gps, estado, levantamientoId, modulos, version, autoría', detail: 'Documento principal de captura. Los datos editables viven dentro de `modulos`; cada módulo guarda versión, versión del esquema y autoría.' },
  { name: 'schemas', fields: 'moduleId, modulo, version, campos[], actualizadoEn, actualizadoPor', detail: 'Un documento por módulo publicado. Los campos se definen dinámicamente y se guardan con la captura mediante schemaVersion.' },
  { name: 'levantamientos', fields: 'id, nombre, ciudad, totalEsperado, workspaceId?, propietarioId?, creadoEn, creadoPor', detail: 'Campañas que agrupan parcelas. workspaceId vincula el entorno Manager; propietarioId identifica levantamientos personales. Los anteriores sin workspaceId mantienen compatibilidad de acceso.' },
  { name: 'workspaces', fields: 'id, nombre, managerId, estado, creadoEn, creadoPor', detail: 'Entorno de un Manager, activo o suspendido. La provisión reutiliza el entorno existente y conserva su identidad y datos.' },
  { name: 'workspace_memberships', fields: 'id, workspaceId, userId, surveyId?, invitacionId, creadoEn', detail: 'Acceso del encuestador al entorno completo o a un levantamiento concreto cuando existe surveyId.' },
  { name: 'manager_requests', fields: 'userId, nombreWorkspace, proposito, participantesEsperados, estado, revisadoPor?, workspaceId?', detail: 'Solicitudes pendientes, aprobadas o rechazadas. La aprobación registra al administrador y vincula el entorno provisionado.' },
  { name: 'invitations', fields: 'digest, targetType, targetId, workspaceId, expiraEn, revocado', detail: 'Invitaciones por enlace o código para un entorno o levantamiento. Se almacenan hashes de los secretos; caducan a los siete días y pueden revocarse.' },
  { name: 'workspace_fields', fields: 'workspaceId, field, creadoPor, creadoEn', detail: 'Campos adicionales del entorno que complementan el formulario base de edificación. El servidor genera identificadores únicos al agregarlos desde un levantamiento.' },
  { name: 'user / session', fields: 'Colecciones administradas por Better Auth', detail: 'Cuentas, roles y sesiones. El rol es controlado por servidor y determina las capacidades de la API y navegación.' },
]

const SECCIONES = [
  { id: 'arquitectura', title: 'Arquitectura', keywords: 'interfaz next react api mongodb offline sincronización capas' },
  { id: 'managers', title: 'Managers y permisos', keywords: 'manager entorno workspace solicitud aprobación invitación código enlace membresía roles administrador encuestador campos personalizados google registro' },
  { id: 'operacion', title: 'Captura y análisis', keywords: 'gps precisión mapa controles dashboard filtros fecha categoría exportación offline caché sincronización bloqueadas' },
  { id: 'datos', title: 'Base de datos', keywords: 'parcelas schemas levantamientos user session colecciones índices geojson almacenamiento' },
  { id: 'decisiones', title: 'Decisiones técnicas', keywords: 'mongodb postgresql cosmos concurrencia offline conflictos' },
  { id: 'rutas', title: 'Rutas de la aplicación', keywords: 'campo captura listado dashboard campañas usuarios esquemas importación perfil permisos api' },
  { id: 'desarrollo', title: 'Desarrollo', keywords: 'convenciones capas interfaz tipos contratos índices' },
]
const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function DocsExplorer() {
  const [consulta, setConsulta] = useState('')
  const [seccionActiva, setSeccionActiva] = useState('arquitectura')
  const resultados = SECCIONES.filter(item => normalizar(`${item.title} ${item.keywords}`).includes(normalizar(consulta.trim())))

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setSeccionActiva(visible.target.id)
    }, { rootMargin: '-5% 0px -60% 0px', threshold: 0 })
    SECCIONES.forEach(({ id }) => { const element = document.getElementById(id); if (element) observer.observe(element) })
    return () => observer.disconnect()
  }, [])

  const [nodoActivo, setNodoActivo] = useState(NODOS[0].id)
  const [entidadActiva, setEntidadActiva] = useState(ENTIDADES[0].name)
  const nodo = NODOS.find((item) => item.id === nodoActivo) ?? NODOS[0]
  const entidad = ENTIDADES.find((item) => item.name === entidadActiva) ?? ENTIDADES[0]

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="h-fit lg:sticky lg:top-24">
        <div className="docs-search">
          <Search size={15} aria-hidden="true" />
          <label htmlFor="docs-query" className="sr-only">Buscar en la documentación</label>
          <input id="docs-query" type="search" placeholder="Buscar en la guía…" value={consulta} onChange={event => setConsulta(event.target.value)} />
          {consulta && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setConsulta('')}><X size={15} /></button>}
          {consulta.trim() && <div className="docs-results"><p role="status">{resultados.length ? `${resultados.length} secciones encontradas` : 'Sin resultados. Prueba con parcelas, API u offline.'}</p>{resultados.map(item => <a key={item.id} href={`#${item.id}`} onClick={() => { setSeccionActiva(item.id); setConsulta('') }}>{item.title}</a>)}</div>}
        </div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">En esta guía / {String(SECCIONES.length).padStart(2, '0')}</p>
        <nav aria-label="Índice de documentación" className="docs-index flex gap-1 overflow-x-auto lg:flex-col">
          {SECCIONES.map((item, index) => <a key={item.id} href={`#${item.id}`} aria-current={seccionActiva === item.id ? 'location' : undefined} onClick={() => setSeccionActiva(item.id)} className="shrink-0 px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"><span className="mr-3 font-mono text-[10px] opacity-60">0{index + 1}</span>{item.title}</a>)}
        </nav>
        <Link href="/campo" className="mt-6 hidden border-t pt-4 text-xs text-muted-foreground hover:text-foreground lg:block">↗ Abrir app de campo</Link>
      </aside>

      <div className="min-w-0 space-y-10">
        <section id="arquitectura" className="scroll-mt-24 space-y-4">
          <div><Badge variant="secondary">Mapa interactivo</Badge><h2 className="mt-2 text-xl font-semibold tracking-tight">Arquitectura del sistema</h2><p className="mt-1 text-sm text-muted-foreground">Selecciona una capa para ver su responsabilidad.</p></div>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {NODOS.map((item) => {
                  const Icon = item.icon
                  const activo = item.id === nodoActivo
                  return <div key={item.id} className="contents">
                    <button type="button" aria-pressed={activo} onClick={() => setNodoActivo(item.id)} className={`flex min-h-24 flex-col items-start justify-between rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${activo ? 'border-foreground bg-muted ring-1 ring-foreground/15' : 'bg-card'}`}>
                      <Icon className="size-5"/><span className="mt-3 text-sm font-medium">{item.title}</span>
                    </button>
                  </div>
                })}
              </div>
              <div className="mt-4 flex justify-center text-muted-foreground xl:hidden"><ArrowDown className="size-4"/></div>
              <div aria-live="polite" className="mt-4 rounded-xl bg-muted/70 p-4"><div key={nodo.id} className="motion-safe:animate-fade-in"><div className="flex items-center gap-2"><Globe2 className="size-4"/><p className="text-sm font-semibold">{nodo.title}</p></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{nodo.detail}</p></div></div>
            </CardContent>
          </Card>
          <pre className="overflow-x-auto rounded-xl border bg-card p-4 text-xs leading-6 text-muted-foreground"><code>{`Navegador → Next.js UI → Route handlers → Dominio / repositorios → MongoDB\n        ↘ IndexedDB + outbox ─── sincronización ────↗`}</code></pre>
        </section>

        <section id="managers" className="scroll-mt-24 space-y-4">
          <div><Badge variant="outline">Equipos y acceso</Badge><h2 className="mt-2 text-xl font-semibold tracking-tight">Managers, entornos y permisos</h2><p className="mt-1 text-sm text-muted-foreground">Cada entorno agrupa los levantamientos y el equipo de un Manager. La API verifica el acceso al levantamiento en captura, listado, dashboard, sincronización y exportación.</p></div>
          <Card><CardHeader><CardTitle>Del registro al trabajo en equipo</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <ol className="list-decimal space-y-3 pl-5">
              <li><strong className="text-foreground">Crear cuenta:</strong> el registro por correo y contraseña y las cuentas nuevas con Google comienzan como encuestador. Google requiere configuración OAuth en el despliegue; una cuenta existente conserva su rol.</li>
              <li><strong className="text-foreground">Solicitar un entorno:</strong> en <Link href="/manager" className="underline">/manager</Link>, el encuestador indica nombre, propósito y participantes esperados. Puede consultar allí el estado de su solicitud.</li>
              <li><strong className="text-foreground">Aprobar:</strong> el administrador resuelve las solicitudes en /manager. También puede asignar el rol Manager desde Usuarios: si hay una solicitud pendiente, se utiliza su nombre de entorno y se marca aprobada. Crear o actualizar una cuenta Manager provisiona su entorno sin duplicarlo.</li>
              <li><strong className="text-foreground">Reparar un entorno existente:</strong> en Usuarios, el administrador dispone de «Reparar entorno» si falta la provisión. Conserva identidad y datos; esta acción también reactiva el entorno si estaba suspendido.</li>
              <li><strong className="text-foreground">Organizar el trabajo:</strong> el Manager crea levantamientos en su panel y elige cada uno mediante selectores para generar invitaciones o agregar campos. Las etiquetas de los campos son editables, el servidor genera sus identificadores y el tipo booleano aparece como «Verdadero/falso».</li>
              <li><strong className="text-foreground">Invitar:</strong> comparte el enlace o código generado; el encuestador lo acepta con sesión iniciada en <Link href="/join" className="underline">/join</Link>. La invitación da acceso al entorno completo o al levantamiento seleccionado, caduca a los siete días y el Manager puede revocarla.</li>
            </ol>
          </CardContent></Card>
          <div className="grid gap-3 md:grid-cols-3">{[
            ['Administrador', 'Administra cuentas, roles, solicitudes, reparación de entornos, esquemas e importaciones. Puede consultar todos los levantamientos.'],
            ['Manager', 'Gestiona los levantamientos, invitaciones y campos de su entorno activo; consulta y exporta los registros de esos levantamientos.'],
            ['Encuestador', 'Accede a levantamientos propios, creados por él o habilitados por membresía. El listado y la exportación limitan los registros a su autoría. Los levantamientos anteriores sin workspaceId conservan el acceso de compatibilidad.'],
          ].map(([title, detail]) => <Card key={title}><CardHeader><CardTitle className="text-sm">{title}</CardTitle><CardDescription>{detail}</CardDescription></CardHeader></Card>)}</div>
        </section>

        <section id="operacion" className="scroll-mt-24 space-y-4">
          <div><Badge variant="outline">Trabajo de campo</Badge><h2 className="mt-2 text-xl font-semibold tracking-tight">Captura, análisis y continuidad sin conexión</h2></div>
          <div className="grid gap-3 md:grid-cols-2">{[
            ['GPS y mapa', 'Localizar centra el dispositivo a zoom 19, limitado por el máximo del mapa. El pin automático requiere precisión de 15 m o mejor. Si el error supera 150 m, se oculta el círculo de incertidumbre y se sigue mostrando la precisión real. Los controles de ubicación y zoom están abajo a la derecha.'],
            ['Dashboard por levantamiento', 'Selecciona un levantamiento para consultar avance, cobertura, servicios, resumen territorial y análisis espacial. Los filtros de fecha y categoría actualizan el análisis y los registros de resultados.'],
            ['Listado y exportación', 'El listado ofrece vistas Lista y Mapa online. Las exportaciones requieren levantamiento y respetan filtros y permisos; están disponibles en GeoJSON, CSV, XLSX y Shapefile. Sin levantamientos o registros, los paneles muestran el estado vacío correspondiente.'],
            ['Datos offline por cuenta', 'Las capturas y la cola de envío se separan por usuario. Esquemas y dashboards se cachean según usuario, levantamiento y filtros. Si caduca la sesión o se revoca el acceso, los pendientes se conservan bloqueados para revisión y no se eliminan.'],
          ].map(([title, detail]) => <Card key={title}><CardHeader><CardTitle className="text-sm">{title}</CardTitle><CardDescription>{detail}</CardDescription></CardHeader></Card>)}</div>
        </section>

        <section id="datos" className="scroll-mt-24 space-y-4">
          <div><Badge variant="outline">Modelo de datos</Badge><h2 className="mt-2 text-xl font-semibold tracking-tight">Estructura de almacenamiento</h2><p className="mt-1 text-sm text-muted-foreground">Elige una colección para consultar su forma y propósito.</p></div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">{ENTIDADES.map((item) => <button key={item.name} type="button" aria-pressed={item.name === entidadActiva} onClick={() => setEntidadActiva(item.name)} className={`rounded-xl border px-4 py-3 text-left transition-colors ${item.name === entidadActiva ? 'border-foreground bg-muted' : 'bg-card hover:bg-muted/60'}`}><span className="font-mono text-sm font-semibold">{item.name}</span><span className="mt-1 block text-xs text-muted-foreground">{item.fields}</span></button>)}</div>
            <Card aria-live="polite"><CardHeader key={entidad.name} className="motion-safe:animate-fade-in"><CardTitle className="font-mono text-base">{entidad.name}</CardTitle><CardDescription>{entidad.detail}</CardDescription></CardHeader><CardContent><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campos principales</p><code className="block rounded-lg bg-muted p-3 text-xs leading-6">{entidad.fields}</code></CardContent></Card>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Colección</th><th className="px-4 py-3">Índice / clave</th><th className="px-4 py-3">Uso</th></tr></thead><tbody className="divide-y"><tr><td className="px-4 py-3 font-mono">parcelas</td><td className="px-4 py-3">_id = id; ubicación 2dsphere</td><td className="px-4 py-3">Identidad, geobúsqueda y sincronización idempotente</td></tr><tr><td className="px-4 py-3 font-mono">parcelas</td><td className="px-4 py-3">codigo único sparse; estado; campaña; autor; fecha</td><td className="px-4 py-3">Búsquedas, filtros y restricciones de duplicados</td></tr><tr><td className="px-4 py-3 font-mono">schemas</td><td className="px-4 py-3">modulo</td><td className="px-4 py-3">Lectura y publicación de esquemas</td></tr><tr><td className="px-4 py-3 font-mono">levantamientos</td><td className="px-4 py-3">ciudad</td><td className="px-4 py-3">Consulta y administración de campañas</td></tr><tr><td className="px-4 py-3 font-mono">workspaces</td><td className="px-4 py-3">managerId único</td><td className="px-4 py-3">Un entorno por Manager y provisión concurrente sin duplicados</td></tr><tr><td className="px-4 py-3 font-mono">workspace_memberships</td><td className="px-4 py-3">workspaceId + userId + surveyId</td><td className="px-4 py-3">Acceso por entorno o levantamiento</td></tr></tbody></table></div>
          <p className="text-xs leading-5 text-muted-foreground">El proveedor Cosmos DB puede variar en el soporte de índices; el bootstrap informa fallos por índice y continúa con los demás.</p>
        </section>

        <section id="decisiones" className="scroll-mt-24 space-y-4">
          <div><Badge variant="outline">ADR resumido</Badge><h2 className="mt-2 text-xl font-semibold tracking-tight">Decisiones técnicas</h2></div>
          <Card><CardHeader><CardTitle>¿Por qué MongoDB y no PostgreSQL?</CardTitle><CardDescription>La aplicación ya está desplegada sobre Cosmos DB for MongoDB y el dominio usa documentos de captura con campos configurables.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p><strong className="text-foreground">Ajuste al modelo:</strong> los módulos y campos publicados cambian sin migraciones relacionales por cada ajuste del formulario. Cada módulo puede conservar su versión de esquema y de edición dentro de la parcela.</p><p><strong className="text-foreground">Geoespacial:</strong> GeoJSON y el índice 2dsphere representan puntos y polígonos del levantamiento con consultas espaciales disponibles en el proveedor compatible.</p><p><strong className="text-foreground">Operación y continuidad:</strong> Better Auth y la conexión existente comparten el cliente Mongo. El identificador de parcela como `_id` facilita escritura idempotente del flujo offline.</p><p><strong className="text-foreground">Costos de la elección:</strong> los esquemas flexibles requieren validación explícita en API/dominio; algunas capacidades de MongoDB cambian entre Cosmos RU y vCore. PostgreSQL/PostGIS sería una alternativa sólida para relaciones y consultas analíticas SQL, pero migrar implica rehacer persistencia, auth e índices.</p><p>Esta decisión documenta el diseño actual, no afirma una comparación de rendimiento ni descarta una migración futura.</p></CardContent></Card>
          <div className="grid gap-3 md:grid-cols-2"><Card><CardHeader><CardTitle className="text-sm">Concurrencia</CardTitle><CardDescription>Versión global de parcela y versión por módulo. Cambios independientes pueden combinarse; conflictos se reportan durante sincronización.</CardDescription></CardHeader></Card><Card><CardHeader><CardTitle className="text-sm">Offline primero</CardTitle><CardDescription>IndexedDB guarda caché y outbox por cuenta. La cola conserva los registros bloqueados por sesión o permisos y aplica control de versiones al sincronizar.</CardDescription></CardHeader></Card></div>
        </section>

        <section id="rutas" className="scroll-mt-24 space-y-4">
          <div><Badge variant="outline">Índice temático</Badge><h2 className="mt-2 text-xl font-semibold tracking-tight">Rutas de la aplicación</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">{[
            ['/','Portada pública','Presentación del producto y accesos.'], ['/login','Acceso y registro','Correo y contraseña; Google cuando está configurado.'], ['/manager','Entornos Manager','Solicitudes, aprobación, levantamientos, invitaciones y campos según el rol.'], ['/join','Unirse a un equipo','Acepta un enlace o código de invitación con sesión iniciada.'], ['/dashboard','Acceso al dashboard','Redirige al panel de análisis según el rol.'], ['/mi-dashboard','Mi dashboard','Panel del encuestador para sus levantamientos accesibles.'], ['/campo','Captura GIS','Mapa, GPS, pines, perímetros y formulario offline.'], ['/listado','Parcelas','Búsqueda, filtros, estado, edición y exportación.'], ['/admin/dashboard','Dashboard','Análisis por levantamiento y filtros para administradores y Managers.'], ['/admin/levantamientos','Campañas','Crea campañas y monitorea conteos.'], ['/admin/usuarios','Usuarios','Cuentas, roles, suspensión y reparación de entornos Manager.'], ['/admin/esquema','Esquemas','Define campos configurables de captura.'], ['/admin/importar','Importación','Previsualiza archivos y resuelve duplicados.'], ['/perfil','Perfil','Nombre y contraseña de la cuenta.'], ['/docs','Documentación','Arquitectura, datos y convenciones del sistema.'],
          ].map(([href, title, description]) => <Link key={href} href={href} className="rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"><p className="font-mono text-xs text-muted-foreground">{href}</p><p className="mt-2 text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></Link>)}</div>
          <div className="rounded-xl border bg-muted/50 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4"/>API y permisos</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Los endpoints están en <code>app/api</code>. Los flujos de equipo usan <code>/api/manager-requests</code>, <code>/api/workspaces</code>, <code>/api/invitations</code>, <code>/api/invitations/accept</code>, <code>/api/levantamientos/[id]/fields</code> y <code>/api/admin/manager-workspace</code>. Los handlers validan contratos de <code>lib/api/contracts.ts</code>, sesión y permisos antes de acceder a servicios/repositorios. Ver el README para el índice completo de endpoints.</p></div>
        </section>

        <section id="desarrollo" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Convenciones de desarrollo</h2>
          <div className="grid gap-3 sm:grid-cols-2"><Card><CardHeader><CardTitle className="text-sm">Capas</CardTitle><CardDescription>UI en app/components; reglas puras en lib/domain; acceso servidor en repositories/services; borde HTTP en app/api.</CardDescription></CardHeader></Card><Card><CardHeader><CardTitle className="text-sm">Interfaz</CardTitle><CardDescription>Usa tokens shadcn y Tailwind, estados de carga con Skeleton, controles accesibles y distribuciones mobile-first.</CardDescription></CardHeader></Card><Card><CardHeader><CardTitle className="text-sm">Tipos y contratos</CardTitle><CardDescription>Actualiza los tipos de dominio y validación de entrada al modificar payloads o documentos.</CardDescription></CardHeader></Card><Card><CardHeader><CardTitle className="text-sm">Índices</CardTitle><CardDescription>Declara índices en lib/server/collections.ts y aplica con pnpm db:indexes según el entorno.</CardDescription></CardHeader></Card></div>
        </section>
      </div>
    </div>
  )
}
