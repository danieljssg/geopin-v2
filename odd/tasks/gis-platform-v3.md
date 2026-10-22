# GIS Platform v3 — del prototipo cliente al sistema de levantamiento

Objetivo: convertir el prototipo GeoPin (100% cliente, IndexedDB) en la plataforma del plan `mejorasv2.md` — PWA de campo offline-first + plataforma web administrativa + backend Cosmos DB.
Rama: `feature/gis-platform-v3`. Estrategia de entrega: `ask-on-risk` (preguntar antes de partir PRs si el acumulado pasa ~400 líneas). Runner de tests: `vitest`.

## Specs

### S1 — Base de datos embebida local en el dispositivo móvil

> "Configurar base de datos embebida local (ej. SQLite / WatermelonDB / IndexedDB) para almacenamiento persistente en el dispositivo móvil."

Alcance: la PWA de campo persiste en IndexedDB vía Dexie. Alcance permitido: sustituye `lib/db.ts` (tabla `pins`) por tablas `outbox`, `cache_parcelas` y `cache_esquemas`.
Criterios: una escritura offline sobrevive al cierre de la app y al reload; ninguna escritura de campo se pierde ante fallo de red.
Checks: tests de repositorio local con Dexie en memoria.

### S2 — Cola de sincronización diferida

> "Diseñar cola de sincronización diferida (Background Sync) que almacene coordenadas, pines y formularios cuando no haya cobertura celular o megas."

Alcance: cola de salida (outbox) con reintento, idempotencia por `parcelaId` + `version`, y drenaje por evento `online`, al volver al foreground, por intervalo y con botón manual.
Criterios: la cola nunca duplica una parcela en el servidor; un reintento fallido no pierde el registro ni lo duplica.
Checks: test de idempotencia (mismo payload dos veces → un solo documento).

### S3 — Filtro de precisión GPS

> "descartar lecturas con margen de error superior a 15 metros"

Alcance: cliente de campo. Lecturas con `accuracy > 15` se marcan como no aptas y no se auto-fijan como posición del pin.
Criterios: una lectura de 30 m de exactitud no fija el pin por sí sola; el usuario ve el motivo.
Checks: test unitario de la función de decisión sobre lecturas límite (15, 15.1, 30).

### S4 — Indicador visual del estado del GPS

> "Agregar indicador visual en pantalla sobre el estado del GPS (precisión en metros y estado de la fijación de satélites)."

Alcance: cliente de campo. Muestra exactitud en metros y el estado de fijación.
Criterios: el indicador refleja el valor real de `coords.accuracy` y distingue `searching`/`found`/`error`/`denied`.
Checks: render del componente contra valores de `coords` simulados.

### S5 — Ubicación asistida o manual

> "Implementar opción de "Ubicación Asistida o Manual": permitir fijar la posición sobre el mapa si la lectura del sensor es imprecisa."

Alcance: cliente de campo. Ya existe click y arrastre en `MapView`; debe quedar explícito y alcanzar el pin cuando el GPS es apto.
Criterios: una posición elegida a mano se guarda con `gps.fuente = "manual"` y no se sobreescribe por una lectura posterior sin confirmación.
Checks: test de la regla de precedencia sensor vs. manual.

### S6 — Reintento automático de conexión de red

> "Automatizar mecanismo de reintento de conexión de red para evitar depender del reinicio manual de la interfaz de red (modo avión)."

Alcance: cliente de campo.
Criterios: al recuperar la red, la cola se drena sin que el usuario reinicie nada.
Checks: test del disparador `online` con cola pendiente.

### S7 — Tiles offline autoalojados (MBTiles)

Decisión del usuario: *"creo que sería mejor tener los mbtiles autoalojados para radios de 10x10km (ya tengo un blob storage setteado)"*.

Restricción legal verificada (OSMF Tile Usage Policy): el uso offline y el prefetch están **prohibidos** en `tile.openstreetmap.org` — *"Offline use is not permitted on tile.openstreetmap.org"* y *"Any 'download for offline' button or background job that fetches tiles a user is not currently viewing"* está en la lista de no permitidos. Lo que sí está permitido es cachear mientras el usuario navega por el viewport.

Alcance: la app consume una plantilla de tiles configurable `{TILE_BASE_URL}/{z}/{x}/{y}.png` servida desde el blob storage propio. Un botón "descargar mapa del levantamiento" precarga la pirámide z12–z18 del área de 10 × 10 km.

Cálculo de tamaño: en Venezuela (lat ~10.5°) un tile z18 cubre ~40 km; la pirámide completa de un área de 10 × 10 km son ~340 tiles (~7 MB). El prefetch es barato porque el área es chica.

Criterios: la app nunca pide tiles de OSMF fuera del viewport; la descarga del área se sirve solo desde el blob propio; el cálculo de la lista de tiles que cubren un bbox es una función pura testeable.
Checks: test del cálculo de la lista de tiles de un bbox.

### S8 — Motor de digitalización de parcelas

> "Desarrollar motor de digitalización de parcelas para dibujar límites sobre la pantalla (polígonos/overlay)."

Alcance: cliente de campo. Dibujo de vértices sobre el mapa, edición de vértices, cierre del polígono.
Criterios: un polígono cerrado produce un GeoJSON `Polygon` válido persistido en `parcelas.geometria`.
Checks: test de la geometría resultante y de su área/perímetro.

### S9 — Cálculo automático de área y perímetro

> "Implementar cálculo automático de área (m²) y perímetro a partir de los vértices marcados."

Alcance: motor de geometría del cliente y servidor.
Criterios: área en m² y perímetro en m, con tolerancia numérica declarada.
Checks: test contra un polígono de referencia con área conocida.

### S10 — Ingreso manual de metros cuadrados

> "Permitir el ingreso manual o la edición del valor de metros cuadrados en caso de no realizar el trazado gráfico."

Alcance: cliente de campo.
Criterios: `areaM2` acepta valor manual cuando no hay polígono; el trazado gráfico sobrescribe el valor manual con confirmación explícita.
Checks: test de la regla de precedencia.

### S11 — Navegación por pestañas dentro de la ficha de la parcela

> "Habilitar la opción de navegación por pestañas dentro de la misma ficha de la parcela para alternar entre categorías (Edificación, Servicios, Equipamiento)."

Alcance: cliente de campo. Las pestañas se derivan del esquema (S17), no de una lista fija.
Criterios: una visita registra todos los módulos en una sola pantalla/visita sin cambiar de módulo principal.
Checks: test de render del formulario por pestañas con esquema de dos módulos.

### S12 — Campos de entrada flexibles y notas de campo

> "Reemplazar restricciones numéricas rígidas por campos de entrada flexibles (permitir enteros, decimales y rangos sin bloqueos)."
> "Habilitar campos de texto amplio (textareas) para notas de campo u observaciones dinámicas."

Alcance: cliente de campo. Hoy `PinForm` ya usa `type=number` con `step` y `textarea`; debe pasar a los tipos declarados por el esquema.
Criterios: sin bloqueo por longitud fija; enteros, decimales y rangos son válidos según el tipo del campo.
Checks: test de validación por tipo de campo del esquema.

### S13 — Lista completa de servicios

> "Habilitó la lista completa de servicios: Acueductos, Drenajes, Cloacas, Electricidad, Vialidad, Telecomunicaciones, Aseo."

Alcance: datos semilla de esquemas.
Criterios: los siete servicios existen como módulo o campo de esquema con sus opciones.
Checks: test de los datos semilla contra el esquema publicado.

### S14 — Administrador de esquemas (schema builder)

> "Construir un administrador de esquemas para que el usuario/administrador pueda crear, editar o eliminar campos personalizados por módulo (estilo QGIS)."
> "Permitir la definición de tipos de datos por campo: lista desplegable, texto libre, entero, decimal, booleano."

Alcance: plataforma web administrativa + colección `schemas` en Cosmos.
Criterios: un campo creado en la web aparece en la app de campo en la siguiente carga de esquema, sin despliegue de código.
Criterios: el esquema es versionado; la app de campo conserva el esquema con el que se capturó la visita.
Checks: test de la API de esquemas (crear → leer → la app lo ve).

### S15 — Concurrencia entre encuestadores

> "Habilitar concurrencia: permitir que múltiples encuestadores registren simultáneamente diferentes módulos de una misma parcela en tiempo real o diferido."

Alcance: backend. Escrituras por módulo con control de versión optimista (`version` por módulo) y `updatedBy`.
Criterios: dosлевadores en módulos distintos de la misma parcela no se pisan; el mismo módulo detecta conflicto.
Checks: test de conflicto de versión por módulo.

### S16 — Importación y conciliación de Excel/CSV

> "Desarrollar módulo de importación y conciliación de archivos Excel/CSV generados por distintos encuestadores."
> "El sistema permite cargar múltiples archivos Excel de campo y cruzarlos sin borrar registros."

Alcance: plataforma web administrativa.
Criterios: la importación es idempotente por código de parcela; cruzar dos archivos no elimina registros.
Checks: test de importación del mismo archivo dos veces y de cruce de dos archivos con solapamiento.

### S17 — Detección de duplicados por proximidad geográfica

> "Crear algoritmo de detección de duplicados basado en proximidad geográfica (buffer de 2 metros) o ID de parcela."

Alcance: backend + admin. Buffer de 2 m calculado en la aplicación (Cosmos no ofrece `ST_BUFFER`).
Criterios: dos registros a menos de 2 m se marcan como duplicados candidatos; la resolución es manual.
Checks: test del umbral y del caso límite de exactamente 2 m.

### S18 — Interfaz de resolución de conflictos

> "Diseñar interfaz de resolución de conflictos para combinar registros de un mismo inmueble capturados por diferentes usuarios."

Alcance: plataforma web administrativa.
Criterios: el admin ve los dos registros, elige campo por campo y confirma; el original queda en el historial.
Checks: test del endpoint de resolución.

### S19 — Dashboard con mapa de calor y capas de levantamientos

> "Implementar visualización en mapa de calor y capas de pines de los levantamientos realizados vs. pendientes (ej. 163 completados de 283)."

Alcance: plataforma web administrativa. Requiere el concepto de `levantamiento` con total esperado.
Criterios: el mapa distingue visualmente parcelas completadas de las faltantes; el conteo refleja el total esperado.
Checks: test del cálculo de completados/pendientes.

### S20 — Motor de déficit y saturación de servicios

> "Desarrollar motor de cálculo de saturación/déficit de equipamiento urbano y cobertura de servicios a partir de los datos consolidados."

Alcance: motor de análisis en el admin (cliente y/o servidor).
Criterios: produce indicadores automáticos de cobertura de agua, electricidad, aseo y drenajes.
Checks: test del cálculo sobre un conjunto de parcelas conocido.

### S21 — Exportación en formatos estándar

> "Exportación de reportes tabulares y geográficos en formatos estándar (GeoJSON, Shapefile, Excel)."

Alcance: admin. GeoJSON y Excel ya existen como export local (`lib/export.ts`); falta GeoJSON y el export desde el servidor.
Criterios: el GeoJSON exportado cumple RFC 7946.
Checks: test de estructura GeoJSON.

### S22 — Superposición de WMS/WMTS y ortofotos

> "Permitir la superposición de ortofotos o capas WMS/WMTS personalizadas sobre el mapa base del cliente móvil."

Alcance: cliente de campo y admin. Decisión del usuario: `OSM/OpenTopoMap + WMS propios`.
Criterios: una capa WMS propia se superpone sobre la base con control de opacidad.
Checks: render del control de capas con una entrada WMS.

### S23 — Sustento legal y bibliográfico de las fuentes cartográficas

> "El sistema cuenta con la justificación legal/bibliográfica documentada para el uso de las fuentes cartográficas seleccionadas."

Alcance: documentación.
Criterios: documento con la licencia de cada fuente usada (OSM, OpenTopoMap, WMS propios) y su fecha de consulta.
Checks: revisión documental.

### S24 — Despliegue y pruebas de carga

> "Ejecución de pruebas de estrés con carga simulada de miles de entidades geográficas simultáneas."

Alcance: infraestructura. Decisión del usuario: `Una ciudad, menos de 500 parcelas`.
Criterios: el despliegue en producción está verificado y el presupuesto de RU/s del free tier (1000 RU/s, 25 GB) no se excede.
Checks: script de carga + lectura de RU/s en el portal.

### S25 — Sin captura fotográfica

Decisión del usuario: `No, solo texto y coordenadas`. **Descartado** de alcance: compresión 1920x1080 JPG70, blob storage S3-compatible, políticas de ciclo de vida.
Criterios: el modelo de datos no tiene campo de foto; no se crea bucket.

### S26 — Topología de un solo proyecto Next.js

Decisión del usuario: `como la primera, que recomiendas y cuál es mejor camino a seguir ?` → un solo proyecto.
Criterios: un repo, un deploy; `lib/server/` contiene toda la lógica de backend y queda extraíble.

### S27 — Cliente de campo PWA

Decisión del usuario: `cual recomiendas objetivamente ? porque debe ser rápido los despliegues y fácil mantenimiento... pudiera ser admin nextjs + expo... o que serwist haga todo?` → PWA con Next.js + Serwist.
Restricción: `Mixto Android + iPhone`. En iOS no existe Background Sync, por lo que el drenaje de la cola se apoya en Web Push (iOS 16.4+, home screen) + reintento en foreground.
Criterios: el bundle de campo no depende de un server dedicado; el service worker se compila con Turbopack.

### S28 — Azure DocumentDB for MongoDB vCore (Free Tier)

Decisión del usuario: `Cosmos DB for MongoDB (Recomendado)`. La cuenta creada es un cluster **vCore** — host `*.global.mongocluster.cosmos.azure.com`, `authMechanism=SCRAM-SHA-256` — no la API RU clásica.

Verificado (Microsoft Learn, docs de mayo y junio de 2026):

- **Free Tier**: cluster MongoDB dedicado, **32 GB de almacenamiento**, costo cero, de por vida, uno por suscripción. Se pide al crear el cluster. Regiones disponibles: East US, West US, West US 2, Central US, Canada Central, Brazil South, y varias de Europa y Asia.
- Restricciones del Free Tier: sin alta disponibilidad, sin Microsoft Entra ID, **sin Backup/Restore**, sin índices vectoriales HNSW/DiskANN, sin Diagnostic Logging, y **el cluster se pausa a los 60 días de inactividad**.
- El modelo de precio de vCore es vertical (vCores + almacenamiento), no RU/s: los 1000 RU/s + 25 GB del free tier de la API RU **no aplican** a esta cuenta.
- Multi-document transactions solo dentro de una colección no fragmentada: `user` y `session` están en colecciones distintas, así que `transaction: false` es obligatorio (ya está en `lib/server/auth.ts`).
- Índices: `2dsphere` sí, `unique` sí, `sparse` sí en vCore — la API RU no admite `sparse`.

Criterios: la geometría que el motor no soporta (buffer de 2 m, área, perímetro) se calcula en la aplicación; el bootstrap de índices tolera fallos individuales porque hay dos motores distintos detrás del mismo nombre de producto y una migración futura no debe romper el arranque.

### S29 — Autenticación propia

Decisión del usuario: `auth propia con better-auth o similar`.
Criterios: email + contraseña, roles `encuestador` y `admin`, sesión por cookie en la PWA; Better Auth con adaptador Mongo (compatible con Cosmos for MongoDB) y `toNextJsHandler` en route handlers de Next.js.

### S30 — Empezar de cero

Decisión del usuario: `Empezar de cero`.
Criterios: el backend nace vacío; **no** se migra el contenido actual de los IndexedDB de los dispositivos. Los pines actuales siguen visibles en la app existente hasta que el cliente de campo v2 los sustituya.

### S31 — Orden de fases corregido

El plan original pone el formulario (Fase 2) antes del schema builder (Fase 3). Eso obliga a reescribir el formulario. **Se invierte**: el esquema se define antes (T6) y el formulario se renderiza desde el esquema (S11, S12).

## Tasks

| ID | Tarea | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- | --- |
| T1 | Cimientos: harness de tests, validación de env, cliente Cosmos, índices, modelo de dominio v2, tipos de esquema | S13, S21, S28 | inline | completado | `e26a629` |
| T2 | Better Auth, roles `encuestador`/`admin`, guard de sesión | S29 | inline | completado | `ffdad81` |
| T3 | API de parcelas: CRUD, `version` por módulo, idempotencia de sync | S15, S17 | inline | pendiente | — |
| T4 | Shell PWA: manifest, Serwist/Turbopack, fallback offline, cache de teselas | S7, S22, S27 | inline | pendiente | — |
| T5 | Cliente de campo v2 sobre modelo v2: outbox Dexie, motor de sync, reintentos | S1, S2, S6 | inline | pendiente | — |
| T6 | Schema builder en admin + formulario renderizado desde el esquema | S11, S12, S14, S31 | inline | pendiente | — |
| T7 | Geometría: dibujo de polígonos, área, perímetro, m² manual | S8, S9, S10 | inline | pendiente | — |
| T8 | GPS: `watchPosition`, filtro 15 m, indicador, asistida/manual | S3, S4, S5 | inline | pendiente | — |
| T9 | Dashboard: consultas al servidor, mapa con heatmap, completados vs pendientes, déficit/saturación | S19, S20 | inline | pendiente | — |
| T10 | Importación Excel/CSV, cruce, dedup buffer 2 m, resolución de conflictos | S16, S17, S18 | inline | pendiente | — |
| T11 | Export desde el servidor: GeoJSON, CSV, Excel | S21 | inline | pendiente | — |
| T12 | WMS/WMTS propios, precarga de teselas, documento legal/bibliográfico | S7, S22, S23 | inline | pendiente | — |
| T13 | Hardening: quitar `ignoreBuildErrors`, carga, despliegue, documentación | S24, S25 | inline | pendiente | — |
| T14 | Pipeline de tiles autoalojados: extract OSM → clip al bbox del levantamiento → render → pirámide XYZ z12-z18 → blob storage | S7 | inline | pendiente | — |

Ruta de todas las tareas: **inline**. No hay razón de escritura delegada (ninguna unidad independiente de >100 líneas con superficies disjuntas en paralelo), y ninguna tarea nombra un ítem de alto riesgo que requiera verificador independiente más allá de sus propios checks.

## Log

### L1 — Petición original (2026-10-21)

> "@.docs/mejorasv2.md analiza este plan y compara con lo que tenemos, lo que viene es la evolución del proyecto, hay 2 opciones, escalar con un api/frontend separado en 2 proyectos, o escalar con nextjs + serwist para el offline, además de añadirle base de datos (se usará alguna de azure free-tier, sea cosmosDB SQL ó directamente cosmosDB mongodb compatible) antes de codear, hazme las preguntas necesarias"

### L2 — Respuestas del usuario a las preguntas de arquitectura (2026-10-21)

Verbatim: `cual recomiendas objetivamente ? porque debe ser rápido los despliegues y fácil mantenimiento... pudiera ser admin nextjs + expo... o que serwist haga todo?` · `como la primera, que recomiendas y cuál es mejor camino a seguir ?` · `Mixto Android + iPhone` · `Cosmos DB for MongoDB (Recomendado)` · `auth propia con better-auth o similar` · `No, solo texto y coordenadas` · `OSM/OpenTopoMap + WMS propios` · `Una ciudad, menos de 500 parcelas` · `Empezar de cero`

### L3 — Decisiones tomadas con las respuestas del usuario (2026-10-21)

- **PWA, no Expo.** El flujo de levantamiento es por parcela con la app en primer plano; solo el *sync* necesita diferirse. Con menos de 500 parcelas y sin fotos el payload es de cientos de KB, así que una cola con drenaje por `online` + foreground + intervalo + botón manual basta. En iOS el trigger de background es Web Push (iOS 16.4+, home screen), no Background Sync. Expo queda reservado para el caso en que aparezca el requisito de GPS continuo con el teléfono bloqueado.
- **Un solo proyecto Next.js.** La API tiene un único consumidor; partirla hoy no aporta nada y cuesta CORS, dos CI/CD y tipos duplicados. `lib/server/` mantiene las fronteras para poder extraerla en un día.
- **Serwist con Turbopack, no el `withSerwist` clásico.** Next 16 hace Turbopack el bundler por defecto y Turbopack no soporta plugins de webpack; `@serwist/next` queda inutilizable. Se usa `@serwist/turbopack` (`withSerwist` + `createSerwistRoute` + `SerwistProvider`), que exige Next ≥ 15 — el proyecto va en 16.3.1.
- **Fases 2 y 3 invertidas** (S31). El esquema se define antes que el formulario.
- **Supuesto declarado:** el levantamiento NO exige GPS continuo con el teléfono bloqueado. Si resulta falso, la recomendación de cliente de campo se revisa; el admin y la API no cambian.

### L7 — Decisiones del usuario sobre tiles y base de datos (2026-10-21)

- **MBTiles autoalojados, área de 10 × 10 km por levantamiento.** Decisión: *"creo que sería mejor tener los mbtiles autoalojados para radios de 10x10km (ya tengo un blob storage setteado) porque siendo venezuela, dudo mucho que los mapas u ortofotos estén actualizados o incluso que sean accesibles de alguna manera 'pública'"*. Es la decisión correcta por dos razones que se refuerzan: la política de OSMF prohíbe el uso offline en sus servidores públicos, y la hipótesis de que exista una ortofoto pública y actualizada en Venezuela es, con acierto, dudosa. Pipeline en T14.
- **La cuenta de base de datos es vCore, no la API RU.** El host `*.global.mongocluster.cosmos.azure.com` y el `authMechanism=SCRAM-SHA-256` delatan el cluster vCore, que es Free Tier: 32 GB dedicados, costo cero, de por vida. Pero sus límites son otros: sin Backup/Restore, sin Diagnostic Logging, se pausa a los 60 días de inactividad, y el precio es por vCores, no por RU/s — los 1000 RU/s + 25 GB de la API RU no aplican. **El plan de continuidad tiene que ser la exportación periódica al blob storage, no el backup de la base.**
- **El administrador solo existe si el seeder lo crea.** El rol tiene `input: false`, así que el registro nunca lo acepta; el primer admin lo crea `pnpm seed` con `ADMIN_EMAIL` y `ADMIN_PASSWORD` del entorno. Se eliminó `scripts/create-admin.ts`: un solo camino para crear administradores.

### L8 — Credenciales

La URI real con usuario y cuenta se pegó primero en `.env.example`, que **sí está versionado**. Se movió a `.env.local` — que está en `.gitignore` — y `.env.example` volvió a una plantilla genérica. No llegó a ningún commit: el contenido commiteado era el genérico. El `BETTER_AUTH_SECRET` faltaba y se generó uno de 48 bytes en `.env.local`.

**La contraseña de la URI quedó enmascarada como `<password>`**, así que la conexión a la cuenta real todavía no se pudo probar.

### L4 — Evidencia verificada (2026-10-21)

- Estado del repo: Next.js 16.3.1, React 19.2.8, TS 7.0.2, Tailwind v4, Leaflet 1.9.4 + react-leaflet 5, Dexie 4.4.5. Sin `app/api`, sin `fetch`, sin auth, sin variables de entorno. 3.899 LOC, sin tests, `next.config.mjs` con `typescript.ignoreBuildErrors: true`.
- `lib/db.ts`: Dexie `geopin`, una tabla `pins`.
- `lib/types.ts` / `lib/urban-options.ts`: modelo plano y fijo (11 campos + 4 listas cerradas); `lib/categories.ts`: 9 categorías fijas con normalización de legado.
- `lib/dashboard-analytics.ts`: funciones puras sobre `Pin[]` → reusables contra resultados de API sin cambios.
- `lib/export.ts`: exporta JSON/CSV/Excel; no importa.
- `components/MapView.tsx`: `getCurrentPosition` de un solo disparo, sin `watchPosition`, sin leer `coords.accuracy`.
- Azure Cosmos DB free tier (Microsoft Learn, doc 2025-06-24): **1000 RU/s y 25 GB**, se habilita al crear la cuenta, máximo 25 containers, sin serverless.
- Cosmos DB for MongoDB: `2dsphere` sí; `$geoWithin`/`$geoIntersects`/`$near`/`$nearSphere` sí; `$center`/`$centerSphere`/`$box`/`$polygon` no; `text`/`$where`/`jsonSchema` no. El spatial index de Cosmos no equivale al motor `2dsphere` de MongoDB real, ni usando la API Mongo.
- Cosmos DB for NoSQL: GeoJSON con spatial index por defecto, `ST_DISTANCE`/`ST_WITHIN`/`ST_INTERSECTS`; no `MultiPoint`.
- Ninguna opción Cosmos da PostGIS: `ST_BUFFER`, `ST_UNION` y `ST_AREA` confiable no existen. El buffer de 2 m y los cálculos geométricos van en la aplicación.
- Next.js 16: Turbopack es el bundler por defecto para dev y build; `next build --webpack` es el opt-out.
- Serwist: `@serwist/next` 9.5.13 (webpack, peer `next >= 14`) y `@serwist/turbopack` (serwist 10+, Next ≥ 15).
- Better Auth 1.7.12: `toNextJsHandler` para route handlers de Next.js, `mongodbAdapter` de `better-auth/adapters/mongodb`, y cliente Expo oficial (`@better-auth/expo/client` + `expo-secure-store`).

### L5 — Análisis de brechas por fase del plan (2026-10-21)

- **Fase 1**: el almacenamiento local ya existe (IndexedDB/Dexie) pero sin cola de sync, sin backend, sin service worker, sin precarga de tiles, sin filtro de precisión, sin indicador de exactitud, sin reconexión automática. Brecha: media-alta.
- **Fase 2**: falta todo lo geométrico; el formulario existe pero es un scroll largo sin pestañas; faltan los servicios de acueducto/cloacas/electricidad/vialidad/telecom/aseo; la entrada flexible y las textareas ya están. Brecha: alta.
- **Fase 3**: sin backend no hay módulos, ni schema builder, ni concurrencia. Brecha: total.
- **Fase 4**: sin import, sin dedup, sin UI de conflictos, sin mapa ni heatmap en el dashboard, sin GeoJSON/Shapefile. Brecha: total.
- **Fase 5**: sin fotos (descartado por S25), sin blob, sin WMS/WMTS; la atribución de OSM ya está. Brecha: alta.

### L6 — Progreso

**T1 completado (2026-10-21).**

Entregado:

- `lib/domain/types.ts` — modelo de dominio v2. `Parcela` con `ubicacion`/`geometria` en GeoJSON, `modulos: Record<string, ParcelaModuloData>` (datos por módulo con su propia versión y autoría), `version` global, `estado`, `levantamientoId`. `ModuleSchema` + `FieldDef` con los seis tipos del administrador de esquemas.
- `lib/domain/schema.ts` — validación pura por tipo de campo, `validateModuleData` que devuelve todos los errores, `coerceFieldValue` que normaliza la entrada cruda del formulario (incluye coma decimal).
- `lib/domain/seed.ts` — esquemas semilla de los tres módulos. Las opciones de edificación **se reutilizan de `lib/urban-options.ts`**, que queda como fuente de verdad única de las listas.
- `lib/server/env.ts` — validación de entorno con mensajes accionables y sin filtrar secretos. Rechaza `retryWrites=true` (Cosmos no lo soporta) y `BETTER_AUTH_URL` con barra final.
- `lib/server/cosmos.ts` — cliente `mongodb` cacheado en `globalThis` para sobrevivir al hot reload de Next.js.
- `lib/server/collections.ts` — colecciones, tipos de documento y bootstrap de índices: `ubicacion` 2dsphere, `codigo` unique sparse, `estado`, `levantamiento`, `creadoEn`.
- `vitest.config.mts` + `pnpm test` / `pnpm typecheck`. **El proyecto no tenía ningún runner de tests**; se agrega Vitest.

Evidencia de verificación:

- `pnpm test` → 31 tests, 3 archivos, todo en verde.
- `pnpm typecheck` → limpio.
- `pnpm build` → compila, 3 rutas prerenderizadas. La app existente no se rompió.

RED observado y corregido:

1. `lib/server/env.test.ts` falló al exigir `/barra final/i` en un mensaje que decía `no debe terminar en "/"`. El comportamiento era correcto; la aserción estaba atada a una redacción que no existía. Se cambió la aserción para que verifique el contrato (rechaza la URL y nombra la variable) en vez del texto.
2. `pnpm typecheck` detectó tres errores que el build no reportaba porque `next.config.mjs` tiene `typescript.ignoreBuildErrors: true`: un typo en el nombre de la constante de colección (`COLLECTION_PARCELLAS`) y la incompatibilidad de `NodeJS.ProcessEnv` con `NODE_ENV` obligatorio en `@types/node` v26. Se corrigieron los tres. **Esto confirma que el flag actual oculta errores de tipos reales** — quitarlo es parte de T13.

Excepción declarada al RED→GREEN: los módulos de T1 son nuevos, no hay comportamiento previo que pueda romperse, así que el test se escribió junto a la implementación en vez de observar RED contra código existente. El RED→GREEN estricto y el chequeo diferencial aplican desde T2 en adelante, donde se toca comportamiento existente.

Nota de ruta: T1 no nombra ningún ítem de alto riesgo. `Risk: none`.

**T2 completado (2026-10-21).**

Confirmación del usuario (2026-10-21): *"es cierto, sólo se usa la ubicación con la app abierta"* → el supuesto de S27/L3 queda confirmado y la recomendación de PWA no se revisa.

Entregado:

- `lib/auth/roles.ts` — roles `encuestador` y `admin`, nueve permisos y mapa rol→permisos. `normalizeRole` cae en `encuestador` ante un valor desconocido: la dirección del fallback es lo que importa, un rol corrupto nunca escala a administrador.
- `lib/server/auth.ts` — instancia de Better Auth sobre Cosmos DB for MongoDB, creada de forma perezosa para que importar el módulo no exija entorno configurado. `role` con `input: false` para que nadie se registre como admin.
- `lib/server/session.ts` — `getSessionUser`, `requireSessionUser`, `requirePermission` y traducción de errores a respuesta HTTP. Reciben las cabeceras explícitamente para no atarlos al App Router.
- `app/api/auth/[...all]/route.ts` — rutas de Better Auth con `dynamic = 'force-dynamic'`.
- `lib/auth-client.ts` — cliente de navegador con `inferAdditionalFields<AuthInstance>()` para que `session.user.role` esté tipado sin duplicar la definición del rol.
- `scripts/create-admin.ts` + `pnpm auth:create-admin` — alta y promoción de administradores, escribiendo el rol directo en la colección `user` porque `input: false` bloquea el signup.
- `.env.example` — variables de entorno documentadas, incluida la nota de que el free tier se pide al crear la cuenta.

Decisiones técnicas tomadas en T2:

- **`transaction: false` en el adaptador de MongoDB.** Better Auth activa transacciones por defecto cuando recibe el cliente, y en Cosmos solo son válidas dentro de una misma partición: `user` y `session` viven en particiones distintas, así que cada registro fallaría. Sin este flag, el primer usuario en registrarse rompe.
- **Sesión de 7 días** con refresco diario: un levantador puede pasar varios días sin abrir la app.
- **Sin middleware de Next.js.** El middleware corre en Edge y no puede hablar con el driver de Mongo; la verificación de sesión va en la página o en el route handler, que es donde Better Auth la recomienda con adaptador de base de datos.

Evidencia de verificación:

- `pnpm test` → 49 tests, 6 archivos, todo en verde.
- `pnpm typecheck` → limpio.
- `pnpm build` → compila; `/api/auth/[...all]` aparece como ruta dinámica y las otras tres siguen prerenderizadas.

RED observado y corregido:

1. `lib/auth/roles.test.ts` falló al afirmar que un rol desconocido no concede ningún permiso. La implementación era la correcta y el test estaba mal: la política de mínimo privilegio significa caer en `encuestador`, no en cero permisos. Se reescribió la aserción para fijar la propiedad de seguridad real — un rol desconocido nunca escala a admin — y se agregó un caso para variantes de mayúsculas y espacios (`'Admin'`, `' admin'`), que tampoco deben escalar.
2. `pnpm typecheck` detectó tres errores de tipos en T2: la anotación de retorno de `createAuth` creaba una referencia circular de tipo, `session.user.role` no existía porque `AuthInstance` estaba tipado con el genérico por defecto de `betterAuth()` en vez del tipo concreto de la instancia, y la colección `user` del script asumía `_id` como `ObjectId` cuando Better Auth lo guarda como string. Los tres corregidos.

Desviación registrada: para resolver el segundo error hubo que exponer el tipo concreto de la instancia (`AuthInstance`) y usar `inferAdditionalFields` en el cliente. Eso arrastra la configuración del servidor al tipado del cliente — sin valores de entorno, solo tipos — y es el mecanismo que la propia documentación de Better Auth prescribe para proyectos de un solo repositorio.

Nota de ruta: T2 toca credenciales y guards de autorización. `Risk: item 2 (security: auth, permisos y credenciales)`. La mitigación es el `input: false` sobre el rol, la validación de entorno que rechaza secretos cortos y la suite de roles; los checks de T2 son los 49 tests más el typecheck y el build.

Bloqueo conocido: T2 no se pudo probar contra una cuenta real de Cosmos porque no hay credenciales en este entorno. El smoke test `lib/server/auth.test.ts` valida que la configuración se construye sin tocar la red, pero el primer `pnpm auth:create-admin` contra la cuenta real es la prueba pendiente.

Próximo paso: T3 (API de parcelas: CRUD, `version` por módulo, idempotencia de sync).

**T2bis completado (2026-10-21), commit `a8f749d`.** Ajustes pedidos por el usuario tras la T2.

Entregado:

- `lib/server/bootstrap.ts` — siembra única: `seedSchemas()` crea los esquemas que faltan, actualiza los que siguen siendo del seed y **preserva los que un administrador ya editó**; `ensureAdmin()` crea o promueve el administrador. `seed()` orquesta ambas cosas y omite el admin si no hay credenciales.
- `scripts/seed.ts` + `pnpm seed` — siembra desde el entorno. `ADMIN_PASSWORD` va por variable de entorno y no por argumento: los argumentos quedan en el historial del shell y en la lista de procesos.
- `scripts/ensure-indexes.ts` + `pnpm db:indexes` — bootstrap de índices fuera del arranque de la app.
- `lib/server/collections.ts` — `ensureIndexes()` ahora crea cada índice por separado y **devuelve los fallos en lugar de lanzar**. Hay dos motores distintos detrás del nombre "Cosmos DB for MongoDB" con capacidades de índice diferentes (la API RU no admite `sparse`, vCore sí): un índice no soportado no puede tumbar el resto.
- Se eliminó `scripts/create-admin.ts`: queda un solo camino para crear administradores.
- `.env.example` — variables del cluster vCore con sus tres restricciones y las del administrador inicial.

Corrección de seguridad: la URI real se había pegado en `.env.example`, que está versionado. Se movió a `.env.local` (ignorado por git) antes de que llegara a un commit, y `.env.example` volvió a ser genérico.

Invariante de rol reforzado con dos tests que fallan si alguien toca la configuración: `auth.options.user.additionalFields.role.input` tiene que ser `false`, y su `defaultValue` tiene que ser `encuestador`. El primero es el que importa — con `input: true`, cualquiera que se registrara con `role: "admin"` en el body se quedaría como administrador.

Evidencia de verificación:

- `pnpm test` → 54 tests, 6 archivos, todo en verde.
- `pnpm typecheck` → limpio.
- `pnpm build` → compila.

Error propio detectado y corregido: al agregar el bloque de tests del rol por defecto, sobrescribí `lib/auth/roles.test.ts` completo y perdí los 10 tests que ya existían. Lo detectó la caída del conteo global (49 → 44). Se restauró el archivo con los 13 tests y el conteo volvió a cuadrar. Lalesson: contar los tests por archivo, no solo mirar que la suite pase.

Nota de ruta: T2bis no nombra ningún ítem de alto riesgo nuevo. `Risk: item 2 (security: credenciales movidas a un archivo ignorado por git y credenciales de administrador por entorno)`.

Bloqueo conocido sin cambios: la contraseña de la URI está enmascarada como `<password>`, así que la conexión a la cuenta real sigue sin probarse. Con la contraseña real en `.env.local`, `pnpm db:indexes` y `pnpm seed` cierran el bloqueo.

Próximo paso: T3 (API de parcelas: CRUD, `version` por módulo, idempotencia de sync).

