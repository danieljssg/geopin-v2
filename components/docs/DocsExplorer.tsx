'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowDown, Boxes, Database, Globe2, Laptop, LockKeyhole, Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const NODOS = [
  { id: 'ui', title: 'Interfaz web y móvil', detail: 'Next.js App Router, React y componentes shadcn/ui. El formulario de campo y los paneles se adaptan al ancho disponible.', icon: Laptop },
  { id: 'api', title: 'API y reglas de dominio', detail: 'Route handlers validan contratos, permisos y peticiones. Las reglas GIS, de sincronización e importación se mantienen en módulos de dominio puros.', icon: Server },
  { id: 'mongo', title: 'MongoDB compatible', detail: 'Cosmos DB for MongoDB almacena parcelas, esquemas, campañas y datos de autenticación. Los índices espaciales aceleran consultas GeoJSON.', icon: Database },
  { id: 'offline', title: 'Trabajo sin conexión', detail: 'IndexedDB conserva formularios, esquemas y una outbox. Al recuperar conexión, el sincronizador reintenta con backoff y aplica conflictos por módulo.', icon: Boxes },
]

const ENTIDADES = [
  { name: 'parcelas', fields: 'id, ubicacion (GeoJSON), geometria, gps, estado, levantamientoId, modulos, version, autoría', detail: 'Documento principal de captura. Los datos editables viven dentro de `modulos`; cada módulo guarda versión, versión del esquema y autoría.' },
  { name: 'schemas', fields: 'moduleId, modulo, version, campos[], actualizadoEn, actualizadoPor', detail: 'Un documento por módulo publicado. Los campos se definen dinámicamente y se guardan con la captura mediante schemaVersion.' },
  { name: 'levantamientos', fields: 'id, nombre, ciudad, totalEsperado, creadoEn, creadoPor', detail: 'Campañas de trabajo que agrupan parcelas y permiten medir avance contra el total esperado.' },
  { name: 'user / session', fields: 'Colecciones administradas por Better Auth', detail: 'Cuentas, roles y sesiones. El rol es controlado por servidor y determina las capacidades de la API y navegación.' },
]

export function DocsExplorer() {
  const [nodoActivo, setNodoActivo] = useState(NODOS[0].id)
  const [entidadActiva, setEntidadActiva] = useState(ENTIDADES[0].name)
  const nodo = NODOS.find((item) => item.id === nodoActivo) ?? NODOS[0]
  const entidad = ENTIDADES.find((item) => item.name === entidadActiva) ?? ENTIDADES[0]

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="h-fit lg:sticky lg:top-24">
          <Card className="gap-2 p-2 lg:p-3">
          <p className="hidden px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">En esta guía</p>
          <nav aria-label="Índice de documentación" className="flex gap-1 overflow-x-auto lg:flex-col">
            {[['#arquitectura', 'Arquitectura'], ['#datos', 'Base de datos'], ['#decisiones', 'Decisiones'], ['#rutas', 'Rutas'], ['#desarrollo', 'Desarrollo']].map(([href, label]) => (
              <a key={href} href={href} className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{label}</a>
            ))}
          </nav>
        </Card>
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
              <div aria-live="polite" className="mt-4 rounded-xl bg-muted/70 p-4"><div className="flex items-center gap-2"><Globe2 className="size-4"/><p className="text-sm font-semibold">{nodo.title}</p></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{nodo.detail}</p></div>
            </CardContent>
          </Card>
          <pre className="overflow-x-auto rounded-xl border bg-card p-4 text-xs leading-6 text-muted-foreground"><code>{`Navegador → Next.js UI → Route handlers → Dominio / repositorios → MongoDB\n        ↘ IndexedDB + outbox ─── sincronización ────↗`}</code></pre>
        </section>

        <section id="datos" className="scroll-mt-24 space-y-4">
          <div><Badge variant="outline">Modelo de datos</Badge><h2 className="mt-2 text-xl font-semibold tracking-tight">Estructura de almacenamiento</h2><p className="mt-1 text-sm text-muted-foreground">Elige una colección para consultar su forma y propósito.</p></div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">{ENTIDADES.map((item) => <button key={item.name} type="button" aria-pressed={item.name === entidadActiva} onClick={() => setEntidadActiva(item.name)} className={`rounded-xl border px-4 py-3 text-left transition-colors ${item.name === entidadActiva ? 'border-foreground bg-muted' : 'bg-card hover:bg-muted/60'}`}><span className="font-mono text-sm font-semibold">{item.name}</span><span className="mt-1 block text-xs text-muted-foreground">{item.fields}</span></button>)}</div>
            <Card><CardHeader><CardTitle className="font-mono text-base">{entidad.name}</CardTitle><CardDescription>{entidad.detail}</CardDescription></CardHeader><CardContent><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campos principales</p><code className="block rounded-lg bg-muted p-3 text-xs leading-6">{entidad.fields}</code></CardContent></Card>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Colección</th><th className="px-4 py-3">Índice / clave</th><th className="px-4 py-3">Uso</th></tr></thead><tbody className="divide-y"><tr><td className="px-4 py-3 font-mono">parcelas</td><td className="px-4 py-3">_id = id; ubicación 2dsphere</td><td className="px-4 py-3">Identidad, geobúsqueda y sincronización idempotente</td></tr><tr><td className="px-4 py-3 font-mono">parcelas</td><td className="px-4 py-3">codigo único sparse; estado; campaña; autor; fecha</td><td className="px-4 py-3">Búsquedas, filtros y restricciones de duplicados</td></tr><tr><td className="px-4 py-3 font-mono">schemas</td><td className="px-4 py-3">modulo</td><td className="px-4 py-3">Lectura y publicación de esquemas</td></tr><tr><td className="px-4 py-3 font-mono">levantamientos</td><td className="px-4 py-3">ciudad</td><td className="px-4 py-3">Consulta y administración de campañas</td></tr></tbody></table></div>
          <p className="text-xs leading-5 text-muted-foreground">El proveedor Cosmos DB puede variar en el soporte de índices; el bootstrap informa fallos por índice y continúa con los demás.</p>
        </section>

        <section id="decisiones" className="scroll-mt-24 space-y-4">
          <div><Badge variant="outline">ADR resumido</Badge><h2 className="mt-2 text-xl font-semibold tracking-tight">Decisiones técnicas</h2></div>
          <Card><CardHeader><CardTitle>¿Por qué MongoDB y no PostgreSQL?</CardTitle><CardDescription>La aplicación ya está desplegada sobre Cosmos DB for MongoDB y el dominio usa documentos de captura con campos configurables.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p><strong className="text-foreground">Ajuste al modelo:</strong> los módulos y campos publicados cambian sin migraciones relacionales por cada ajuste del formulario. Cada módulo puede conservar su versión de esquema y de edición dentro de la parcela.</p><p><strong className="text-foreground">Geoespacial:</strong> GeoJSON y el índice 2dsphere representan puntos y polígonos del levantamiento con consultas espaciales disponibles en el proveedor compatible.</p><p><strong className="text-foreground">Operación y continuidad:</strong> Better Auth y la conexión existente comparten el cliente Mongo. El identificador de parcela como `_id` facilita escritura idempotente del flujo offline.</p><p><strong className="text-foreground">Costos de la elección:</strong> los esquemas flexibles requieren validación explícita en API/dominio; algunas capacidades de MongoDB cambian entre Cosmos RU y vCore. PostgreSQL/PostGIS sería una alternativa sólida para relaciones y consultas analíticas SQL, pero migrar implica rehacer persistencia, auth e índices.</p><p>Esta decisión documenta el diseño actual, no afirma una comparación de rendimiento ni descarta una migración futura.</p></CardContent></Card>
          <div className="grid gap-3 md:grid-cols-2"><Card><CardHeader><CardTitle className="text-sm">Concurrencia</CardTitle><CardDescription>Versión global de parcela y versión por módulo. Cambios independientes pueden combinarse; conflictos se reportan durante sincronización.</CardDescription></CardHeader></Card><Card><CardHeader><CardTitle className="text-sm">Offline primero</CardTitle><CardDescription>IndexedDB guarda caché y outbox. El navegador conserva capturas pendientes hasta que el servidor acepte la sincronización.</CardDescription></CardHeader></Card></div>
        </section>

        <section id="rutas" className="scroll-mt-24 space-y-4">
          <div><Badge variant="outline">Índice temático</Badge><h2 className="mt-2 text-xl font-semibold tracking-tight">Rutas de la aplicación</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">{[
            ['/','Portada pública','Presentación del producto y accesos.'], ['/campo','Captura GIS','Mapa, GPS, pines, perímetros y formulario offline.'], ['/listado','Parcelas','Búsqueda, filtros, estado, edición y exportación.'], ['/admin/dashboard','Dashboard','Avance, cobertura, servicios y densidad espacial.'], ['/admin/levantamientos','Campañas','Crea campañas y monitorea conteos.'], ['/admin/usuarios','Usuarios','Cuentas, roles y suspensión de acceso.'], ['/admin/esquema','Esquemas','Define campos configurables de captura.'], ['/admin/importar','Importación','Previsualiza archivos y resuelve duplicados.'], ['/perfil','Perfil','Nombre y contraseña de la cuenta.'], ['/docs','Documentación','Arquitectura, datos y convenciones del sistema.'],
          ].map(([href, title, description]) => <Link key={href} href={href} className="rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"><p className="font-mono text-xs text-muted-foreground">{href}</p><p className="mt-2 text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></Link>)}</div>
          <div className="rounded-xl border bg-muted/50 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4"/>API y permisos</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Los endpoints están en <code>app/api</code>. Los handlers validan contratos de <code>lib/api/contracts.ts</code>, sesión y permisos antes de acceder a servicios/repositorios. Ver el README para el índice completo de endpoints.</p></div>
        </section>

        <section id="desarrollo" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Convenciones de desarrollo</h2>
          <div className="grid gap-3 sm:grid-cols-2"><Card><CardHeader><CardTitle className="text-sm">Capas</CardTitle><CardDescription>UI en app/components; reglas puras en lib/domain; acceso servidor en repositories/services; borde HTTP en app/api.</CardDescription></CardHeader></Card><Card><CardHeader><CardTitle className="text-sm">Interfaz</CardTitle><CardDescription>Usa tokens shadcn y Tailwind, estados de carga con Skeleton, controles accesibles y distribuciones mobile-first.</CardDescription></CardHeader></Card><Card><CardHeader><CardTitle className="text-sm">Tipos y contratos</CardTitle><CardDescription>Actualiza los tipos de dominio y validación de entrada al modificar payloads o documentos.</CardDescription></CardHeader></Card><Card><CardHeader><CardTitle className="text-sm">Índices</CardTitle><CardDescription>Declara índices en lib/server/collections.ts y aplica con pnpm db:indexes según el entorno.</CardDescription></CardHeader></Card></div>
        </section>
      </div>
    </div>
  )
}
