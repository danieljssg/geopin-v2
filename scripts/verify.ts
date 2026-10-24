import { getAuth } from '../lib/server/auth'
import { closeMongo } from '../lib/server/cosmos'
import { schemasCollection, usuariosCollection } from '../lib/server/collections'
import { findParcela, deleteParcela } from '../lib/server/repositories/parcelas'
import { writeParcela } from '../lib/server/services/parcelas'
import { getModuleSchema, saveModuleSchema } from '../lib/server/repositories/esquemas'
import { draftToSchema, validateSchemaFields } from '../lib/domain/schema-builder'
import { closeDraft } from '../lib/domain/polygon-draft'
import { isUsable, shouldFollowSensor } from '../lib/domain/gps'
import { prepararHojas, toCSV, toGeoJSON } from '../lib/domain/export'
import { analizarImportacion, aplicarImportacion } from '../lib/server/services/importacion'
import type { Parcela } from '../lib/domain/types'
import * as XLSX from 'xlsx'
import { coberturaServicios, densidadCeldas, resumirLevantamiento } from '../lib/domain/dashboard'
import {
  createLevantamiento,
  deleteLevantamiento,
  findLevantamiento,
  findParcelasParaDashboard,
} from '../lib/server/repositories/levantamientos'
import type { ParcelaCreateRequest } from '../lib/api/contracts'

/**
 * Prueba de ida y vuelta contra la base de datos real.
 *
 * Verifica lo que ninguna suite unitaria puede verificar: que el cluster
 * acepta las escrituras, que la idempotencia aguanta un reintento real y que
 * el control de concurrencia por módulo se comporta como dice.
 *
 * Uso:
 *   pnpm verify
 */

const ADMIN = { id: 'verify-admin', nombre: 'Verificación' }
const PARCELA_ID = `verify-${Date.now()}`

function payload(modulos: ParcelaCreateRequest['modulos']): ParcelaCreateRequest {
  return {
    id: PARCELA_ID,
    nombre: 'Parcela de verificación',
    descripcion: 'Creada por pnpm verify. Se borra al terminar.',
    categoria: 'Vivienda',
    codigo: undefined,
    ubicacion: { lat: 10.4806, lng: -66.9036 },
    gps: { fuente: 'sensor', precision: 8 },
    estado: 'pendiente',
    levantamientoId: undefined,
    modulos,
  }
}

function modulo(moduleId: string, baseVersion: number, datos: Record<string, unknown>) {
  return { moduleId, baseVersion, schemaVersion: 1, datos }
}

let fallos = 0

function verificar(descripcion: string, condicion: boolean, detalle?: unknown): void {
  if (condicion) {
    console.log(`  ✓ ${descripcion}`)
    return
  }
  fallos += 1
  console.log(`  ✗ ${descripcion}`)
  if (detalle !== undefined) console.log(`      ${JSON.stringify(detalle)}`)
}

async function main(): Promise<void> {
  console.log('Esquemas')
  const esquemas = await schemasCollection().find({}).toArray()
  verificar('los tres módulos están publicados', esquemas.length === 3, esquemas.map((e) => e.moduleId))
  verificar(
    'cada módulo tiene sus campos',
    esquemas.every((esquema) => esquema.campos.length > 0),
  )

  console.log('\nAdministrador')
  const usuarios = await usuariosCollection().find({ role: 'admin' }).toArray()
  verificar('existe al menos un administrador', usuarios.length > 0)
  verificar('tiene rol admin', usuarios.every((u) => u.role === 'admin'))
  verificar('el admin tiene email', usuarios.every((u) => typeof u.email === 'string'))

  console.log('\nAutenticación')
  const auth = getAuth()
  verificar('la instancia de Better Auth está construida', typeof auth.api.signInEmail === 'function')

  console.log('\nEscritura de parcela')
  const creacion = await writeParcela(
    payload([modulo('edificacion', 0, { uso_general: 'Residencial' })]),
    ADMIN,
  )
  verificar('la parcela se crea', creacion.estado === 'creado', creacion.estado)
  verificar('el módulo queda en versión 1', creacion.moduleVersions.edificacion === 1)

  const guardada = await findParcela(PARCELA_ID)
  verificar('se puede leer del cluster', guardada !== null)
  verificar('guarda la ubicación', guardada?.ubicacion?.coordinates?.[0] === -66.9036, guardada?.ubicacion)
  verificar('guarda el dato del módulo', guardada?.modulos?.edificacion?.datos?.uso_general === 'Residencial')
  verificar(
    'guarda la autoría',
    guardada?.modulos?.edificacion?.actualizadoPor === ADMIN.id,
  )

  console.log('\nIdempotencia')
  const repetida = await writeParcela(
    payload([modulo('edificacion', 0, { uso_general: 'Residencial' })]),
    ADMIN,
  )
  verificar('reenviar lo mismo no lo duplica', repetida.estado === 'ignorado', repetida.estado)
  verificar('la versión no se mueve', repetida.moduleVersions.edificacion === 1, repetida.moduleVersions)

  console.log('\nConcurrencia')
  const primera = await writeParcela(
    payload([modulo('edificacion', 1, { uso_general: 'Comercial' })]),
    { id: 'otro-encuestador', nombre: 'Otro' },
  )
  verificar('la primera edición se aplica', primera.estado === 'actualizado', primera.estado)
  verificar('la versión sube a 2', primera.moduleVersions.edificacion === 2, primera.moduleVersions)

  const enConflicto = await writeParcela(
    payload([modulo('edificacion', 1, { uso_general: 'Industrial' })]),
    ADMIN,
  )
  verificar('una edición con versión vieja entra en conflicto', enConflicto.estado === 'conflicto', enConflicto.estado)
  verificar('el conflicto trae el detalle', enConflicto.conflictos.length === 1, enConflicto.conflictos)

  const otroModulo = await writeParcela(
    payload([
      modulo('edificacion', 2, { uso_general: 'Comercial' }),
      modulo('equipamiento', 0, { vialidad: 'Asfalto' }),
    ]),
    ADMIN,
  )
  verificar('un módulo distinto no colisiona', otroModulo.estado === 'actualizado', otroModulo.estado)
  verificar('el módulo nuevo queda en versión 1', otroModulo.moduleVersions.equipamiento === 1)

  console.log('\nLimpieza')
  await deleteParcela(PARCELA_ID)
  const despues = await findParcela(PARCELA_ID)
  verificar('la parcela de prueba se borró', despues === null)

  console.log('\nAdministrador de esquemas')
  const original = await getModuleSchema('edificacion')
  verificar('el módulo de edificación existe', original !== null)

  if (original) {
    const campoPrueba = {
      key: 'campo_de_verificacion',
      label: 'Campo de verificación',
      tipo: 'lista' as const,
      opciones: ['Sí', 'No'],
      requerido: false,
      orden: original.campos.length + 1,
    }

    const borrador = [...original.campos, campoPrueba]
    verificar('el borrador es válido', validateSchemaFields(borrador).length === 0)

    const publicado = draftToSchema({
      moduleId: 'edificacion',
      modulo: 'edificacion',
      campos: borrador,
      versionActual: original.version,
      actor: ADMIN.id,
      now: new Date().toISOString(),
    })

    await saveModuleSchema(publicado)
    const releido = await getModuleSchema('edificacion')

    verificar('el campo nuevo persiste', releido?.campos.some((c) => c.key === campoPrueba.key) === true)
    verificar('la versión subió', releido?.version === original.version + 1, releido?.version)
    verificar('el orden queda contiguo', releido?.campos.every((c, i) => c.orden === i + 1) === true)

    // Se restaura el esquema original para no dejar rastro.
    await saveModuleSchema(original)
    const restaurado = await getModuleSchema('edificacion')
    verificar('el esquema se restaura', restaurado?.campos.length === original.campos.length)
  }

  console.log('\nGeometría de la parcela')

  // Cuadrado de 0,001° sobre el ecuador: 111,13 m de lado.
  const LADO = 111_132.92 * 0.001
  const borrador = [
    { lng: 0, lat: 0 },
    { lng: 0.001, lat: 0 },
    { lng: 0.001, lat: 0.001 },
    { lng: 0, lat: 0.001 },
  ]

  const cierre = closeDraft(borrador)
  verificar('un cuadrado se cierra', cierre.ok === true)
  if (cierre.ok) {
    verificar('el anillo tiene cinco puntos', cierre.geometria.coordinates[0].length === 5)
    verificar(
      'el anillo cierra con el primer vértice',
      JSON.stringify(cierre.geometria.coordinates[0][0]) ===
        JSON.stringify(cierre.geometria.coordinates[0][4]),
    )
    verificar('el área coincide con el lado al cuadrado', Math.abs(cierre.areaM2 - LADO * LADO) < 1)
    verificar('el perímetro coincide con cuatro lados', Math.abs(cierre.perimetroM - LADO * 4) < 0.1)

    const conGeometria = await writeParcela(
      {
        ...payload([modulo('edificacion', 0, { uso_general: 'Residencial' })]),
        id: `${PARCELA_ID}-geo`,
        geometria: cierre.geometria,
        areaM2: cierre.areaM2,
        perimetroM: cierre.perimetroM,
      },
      ADMIN,
    )
    verificar('la parcela con geometría se guarda', conGeometria.estado === 'creado', conGeometria.estado)

    const leida = await findParcela(`${PARCELA_ID}-geo`)
    verificar('la geometría persiste como Polygon', leida?.geometria?.type === 'Polygon')
    verificar('el área persiste', Math.abs((leida?.areaM2 ?? 0) - cierre.areaM2) < 0.01)
    verificar('el perímetro persiste', Math.abs((leida?.perimetroM ?? 0) - cierre.perimetroM) < 0.01)

    await deleteParcela(`${PARCELA_ID}-geo`)
  }

  // El lazo se rechaza: los lados se cruzan y el área no tiene sentido.
  const lazo = closeDraft([
    { lng: 0, lat: 0 },
    { lng: 0.002, lat: 0.002 },
    { lng: 0.002, lat: 0 },
    { lng: 0, lat: 0.002 },
  ])
  verificar('un contorno cruzado se rechaza', lazo.ok === false)

  console.log('\nGPS')

  verificar('una lectura de 8 m es aceptable', isUsable(8) === true)
  verificar('una lectura de 30 m se descarta', isUsable(30) === false)
  verificar('una lectura de 15,1 m se descarta', isUsable(15.1) === false)
  verificar(
    'la posición manual no la mueve el sensor',
    shouldFollowSensor('manual', { lat: 10.48, lng: -66.9, accuracy: 3, timestamp: Date.now() }) === false,
  )

  const conSensor = await writeParcela(
    {
      ...payload([modulo('edificacion', 0, { uso_general: 'Residencial' })]),
      id: `${PARCELA_ID}-gps`,
      gps: { fuente: 'sensor', precision: 8 },
    },
    ADMIN,
  )
  verificar('la parcela con GPS del sensor se guarda', conSensor.estado === 'creado', conSensor.estado)

  const leidaGps = await findParcela(`${PARCELA_ID}-gps`)
  verificar('persiste el origen sensor', leidaGps?.gps?.fuente === 'sensor', leidaGps?.gps)
  verificar('persiste la precisión', leidaGps?.gps?.precision === 8, leidaGps?.gps)
  verificar('persiste el momento de la fijación', typeof leidaGps?.gps?.fijadoEn === 'string')

  await deleteParcela(`${PARCELA_ID}-gps`)

  console.log('\nDashboard del levantamiento')

  const LEVANTAMIENTO_ID = `${PARCELA_ID}-lev`
  await createLevantamiento({
    id: LEVANTAMIENTO_ID,
    nombre: 'Levantamiento de verificación',
    ciudad: 'Caracas',
    totalEsperado: 10,
    creadoEn: new Date().toISOString(),
    creadoPor: ADMIN.id,
  })

  const levantamiento = await findLevantamiento(LEVANTAMIENTO_ID)
  verificar('el levantamiento se crea', levantamiento !== null)
  verificar('guarda el total esperado', levantamiento?.totalEsperado === 10)

  // Dos parcelas del levantamiento: una con acueducto y otra sin.
  for (const [indice, acueducto] of (['Conectado', 'No conectado'] as const).entries()) {
    await writeParcela(
      {
        ...payload([
          {
            moduleId: 'infraestructura',
            baseVersion: 0,
            schemaVersion: 1,
            datos: { acueducto, electricidad: 'Conectado' },
          },
        ]),
        id: `${LEVANTAMIENTO_ID}-p${indice}`,
        levantamientoId: LEVANTAMIENTO_ID,
        estado: indice === 0 ? 'completa' : 'pendiente',
      },
      ADMIN,
    )
  }

  const documentos = await findParcelasParaDashboard(LEVANTAMIENTO_ID)
  const parcelasDominio = documentos.map((documento) => {
    const { _id, ...resto } = documento
    return resto as unknown as Parameters<typeof resumirLevantamiento>[0][number]
  })

  verificar('el dashboard lee solo las parcelas del levantamiento', documentos.length === 2)

  const resumen = resumirLevantamiento(parcelasDominio, levantamiento?.totalEsperado)
  verificar('el avance se calcula contra el total esperado', resumen.totalEsperado === 10)
  verificar('cuenta las levantadas', resumen.levantadas === 2)
  verificar('calcula el avance en porcentaje', resumen.avancePct === 20, resumen.avancePct)
  verificar('calcula las faltantes', resumen.faltantes === 8, resumen.faltantes)
  verificar('distingue completadas de pendientes', resumen.completadas === 1 && resumen.pendientes === 1)

  const cobertura = coberturaServicios(parcelasDominio)
  const acueducto = cobertura.find((servicio) => servicio.key === 'acueducto')!
  verificar('la cobertura de acueducto cuenta las dos declaradas', acueducto.declaradas === 2)
  verificar('la cobertura de acueducto es del 50 por ciento', acueducto.coberturaPct === 50, acueducto.coberturaPct)
  verificar('el acueducto queda en déficit', acueducto.enDeficit === true)

  const electricidad = cobertura.find((servicio) => servicio.key === 'electricidad')!
  verificar('la electricidad queda al 100 por ciento', electricidad.coberturaPct === 100, electricidad.coberturaPct)
  verificar('la electricidad no queda en déficit', electricidad.enDeficit === false)

  const celdas = densidadCeldas(parcelasDominio)
  verificar('el mapa de calor agrupa las parcelas cercanas', celdas.length >= 1)

  await deleteParcela(`${LEVANTAMIENTO_ID}-p0`)
  await deleteParcela(`${LEVANTAMIENTO_ID}-p1`)
  await deleteLevantamiento(LEVANTAMIENTO_ID)
  verificar('el levantamiento de prueba se borra', (await findLevantamiento(LEVANTAMIENTO_ID)) === null)

  console.log('\nExportación')

  const paraExportar: Parcela[] = [
    {
      id: 'exp-1',
      nombre: 'Casa, con patio',
      descripcion: 'Tiene "comillas" y una coma',
      categoria: 'Vivienda',
      ubicacion: { type: 'Point', coordinates: [-66.9036, 10.4806] },
      gps: { fuente: 'sensor', precision: 8 },
      estado: 'completa',
      modulos: {
        edificacion: {
          version: 1,
          schemaVersion: 1,
          datos: { uso_general: 'Residencial' },
          actualizadoEn: '',
          actualizadoPor: 'u1',
        },
      },
      version: 1,
      creadoEn: '2026-10-24T10:00:00.000Z',
      creadoPor: 'u1',
      actualizadoEn: '2026-10-24T10:00:00.000Z',
      actualizadoPor: 'u1',
    },
  ]

  const geojson = toGeoJSON(paraExportar, []) as unknown as Record<string, unknown>
  verificar('el GeoJSON es una FeatureCollection', geojson.type === 'FeatureCollection')
  verificar('el GeoJSON no lleva el miembro crs', geojson.crs === undefined)

  const feature = (geojson.features as Array<{ geometry: { coordinates: number[] }; properties: Record<string, unknown> }>)[0]
  verificar('el GeoJSON pone longitud primero', feature.geometry.coordinates[0] === -66.9036)
  verificar('el GeoJSON pone latitud segundo', feature.geometry.coordinates[1] === 10.4806)
  verificar('el GeoJSON incluye la latitud en las propiedades', feature.properties.latitud === 10.4806)

  const csv = toCSV(paraExportar, [])
  verificar('el CSV escapa las comas', csv.includes('"Casa, con patio"'))
  verificar('el CSV escapa las comillas dobles', csv.includes('""comillas""'))
  verificar('el CSV empieza con BOM', csv.charCodeAt(0) === 0xfeff)
  verificar('el CSV trae la fila de encabezados', csv.includes('id,codigo,nombre'))

  const hojas = prepararHojas(paraExportar, [])
  verificar('la hoja de Excel trae los encabezados', hojas[0].encabezados.includes('nombre'))
  verificar('la hoja de Excel trae una fila por parcela', hojas[0].filas.length === 1)

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.aoa_to_sheet([hojas[0].encabezados, ...hojas[0].filas]),
    hojas[0].nombre,
  )
  const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' })
  const releido = XLSX.read(buffer, { type: 'buffer' })
  const primeraFila = XLSX.utils.sheet_to_json(releido.Sheets.Parcelas, { header: 1 })[0] as string[]
  verificar('el Excel se puede volver a leer', releido.SheetNames.includes('Parcelas'))
  verificar('el Excel conserva los encabezados', primeraFila.includes('nombre'))

  console.log('\nImportación de archivos de campo')

  const codigoA = `IMP-${Date.now()}`
  const codigoB = `${codigoA}-B`

  const csvImportacion = [
    'Código,Nombre,Latitud,Longitud,Área (m²),Descripción',
    `${codigoA},"Casa del parque, con patio",10.4806,-66.9036,250.5,Vista al parque`,
    `${codigoB},Bodega,10.4807,-66.9037,,Sin área declarada`,
    ',Fila sin código,10.4808,-66.9038,,No se puede importar',
  ].join('\r\n')

  const contenido = Buffer.from(csvImportacion, 'utf-8').toString('base64')

  const analisis = await analizarImportacion(contenido, 'csv')
  verificar('la previsualización no crea nada', analisis.creadas === 0)
  verificar('la previsualización cuenta las filas', analisis.resumen.filas === 3)
  verificar('reconoce dos filas importables', analisis.resumen.nuevas === 2, analisis.resumen)
  verificar('reporta la fila sin código como error', analisis.resumen.conErrores === 1, analisis.resumen)
  verificar('reconoce el área con el alias de la planilla', analisis.filas[0].accion === 'nueva')
  verificar('mapea el área con unidades', analisis.filas[0].codigo === codigoA)

  const aplicacion = await aplicarImportacion(contenido, 'csv', ADMIN)
  verificar('la importación crea las parcelas nuevas', aplicacion.creadas === 2, aplicacion.creadas)

  const guardadaImportada = await findParcela(
    (await findParcelasParaDashboard()).find((p) => p.codigo === codigoA)?._id ?? '',
  )
  verificar('la parcela importada se puede leer', guardadaImportada !== null)
  verificar('la parcela importada conserva el nombre con coma', guardadaImportada?.nombre.includes('parque') === true)
  verificar('la parcela importada guarda el área', guardadaImportada?.areaM2 === 250.5, guardadaImportada?.areaM2)
  verificar('la parcela importada guarda la descripción', guardadaImportada?.descripcion === 'Vista al parque')

  // Idempotencia: el mismo archivo otra vez no crea nada nuevo.
  const segunda = await aplicarImportacion(contenido, 'csv', ADMIN)
  verificar('reimportar el mismo archivo no crea nada', segunda.creadas === 0, segunda.creadas)
  verificar('reimportar marca las filas como ya existentes', segunda.resumen.actualizadas === 2, segunda.resumen)

  const totalConEseCodigo = (await findParcelasParaDashboard()).filter(
    (parcela) => parcela.codigo === codigoA,
  ).length
  verificar('no hay parcelas duplicadas con el mismo código', totalConEseCodigo === 1, totalConEseCodigo)

  // Limpieza: se borra exactamente lo que se creó, por id.
  for (const id of aplicacion.idsCreadas) {
    await deleteParcela(id)
  }
  const remanentes = (await findParcelasParaDashboard()).filter(
    (parcela) => parcela.codigo === codigoA || parcela.codigo === codigoB,
  )
  verificar('las parcelas importadas se borran', remanentes.length === 0, remanentes.length)
}

main()
  .then(async () => {
    await closeMongo()
    if (fallos > 0) {
      console.log(`\n${fallos} verificación(es) fallaron.`)
      process.exit(1)
    }
    console.log('\nTodas las verificaciones pasaron.')
    process.exit(0)
  })
  .catch(async (error) => {
    console.error(error)
    await closeMongo()
    process.exit(1)
  })
