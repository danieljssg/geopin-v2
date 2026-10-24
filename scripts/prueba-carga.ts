import { closeMongo } from '../lib/server/cosmos'
import { findParcelasParaDashboard } from '../lib/server/repositories/levantamientos'
import { deleteParcela, saveParcela } from '../lib/server/repositories/parcelas'
import type { ParcelaDoc } from '../lib/server/collections'

/**
 * Prueba de carga contra el cluster real.
 *
 * Mide cuánto tarda el cluster en absorber el volumen de escritura del
 * levantamiento y estima el consumo de RU/s, para compararlo con el techo
 * del free tier (1000 RU/s) antes de que el equipo de campo empiece a
 * sincronizar.
 *
 * Los costos de RU que usa Azure para un documento chico: una escritura
 * punto a punto cuesta ~5 RU y una lectura ~1 RU. Son los valores que usa
 * el calculador de RU de la propia Microsoft, así que la estimación es
 * consistente con lo que muestra el portal.
 *
 * Uso:
 *   pnpm prueba:carga -- --parcelas 500
 */

const PREFIJO = 'carga-prueba'

/** RU aproximadas por escritura de un documento pequeño. */
const RU_POR_ESCRITURA = 5
/** Cosmos factura las lecturas por cada 4 KB devueltos, con un mínimo de 1 RU. */
const KB_POR_RU = 4

/**
 * RU de una lectura masiva.
 *
 * Un `find` que devuelve 300 documentos NO cuesta 1 RU por documento: se
 * factura por los datos devueltos. Con documentos de ~200 bytes, 300
 * parcelas son unos 60 KB, o sea ~15 RU. Contarlas como 1 RU cada una
 * multiplicaba el costo por veinte y daba un pico que rozaba el techo del
 * free tier sin que el cluster lo estuviera sintiendo.
 */
function ruDeLecturaMasiva(parcelas: number): { ru: number; bytes: number } {
  const bytes = parcelas * 200
  return { ru: Math.max(1, Math.ceil(bytes / (KB_POR_RU * 1024))), bytes }
}

function usage(): void {
  console.log(`
Prueba de carga contra el cluster.

  --parcelas <n>   cuántas parcelas escribir (por defecto 500)
  --mantener        no borrar los datos al terminar
`.trim())
}

async function main(): Promise<void> {
  const argumentos = process.argv.slice(2)
  const indice = argumentos.indexOf('--parcelas')
  const total = indice === -1 ? 500 : Number(argumentos[indice + 1])
  const mantener = argumentos.includes('--mantener')

  if (!Number.isInteger(total) || total <= 0) {
    usage()
    process.exit(1)
  }

  console.log(`Escribiendo ${total} parcelas de prueba…`)

  const ahora = new Date().toISOString()
  const inicio = Date.now()

  const ids: string[] = []

  for (let i = 0; i < total; i += 1) {
    const id = `${PREFIJO}-${i}-${Date.now()}`
    ids.push(id)

    const documento: ParcelaDoc = {
      _id: id,
      id,
      nombre: `Parcela de prueba ${i}`,
      descripcion: 'Generada por la prueba de carga.',
      categoria: 'Vivienda',
      ubicacion: { type: 'Point', coordinates: [-66.9 + i * 0.00001, 10.48] },
      gps: { fuente: 'sensor', precision: 8, fijadoEn: ahora },
      estado: 'pendiente',
      modulos: {},
      version: 1,
      creadoEn: ahora,
      creadoPor: 'prueba-carga',
      actualizadoEn: ahora,
      actualizadoPor: 'prueba-carga',
    }

    await saveParcela(documento)
  }

  const escrituraMs = Date.now() - inicio

  // Lectura de todo lo escrito, que es lo que hace el dashboard.
  const inicioLectura = Date.now()
  const leidas = await findParcelasParaDashboard()
  const lecturaMs = Date.now() - inicioLectura

  const ruEscritura = total * RU_POR_ESCRITURA
  const lectura = ruDeLecturaMasiva(leidas.length)
  const ruLectura = lectura.ru

  console.log('')
  console.log(`Escritura: ${total} parcelas en ${escrituraMs} ms`)
  console.log(`  ${(total / (escrituraMs / 1000)).toFixed(1)} escrituras/segundo`)
  console.log(`  ~${ruEscritura} RU (${(ruEscritura / (escrituraMs / 1000)).toFixed(1)} RU/s durante la escritura)`)
  console.log('')
  console.log(`Lectura: ${leidas.length} parcelas en ${lecturaMs} ms`)
  console.log(`  ~${(lectura.bytes / 1024).toFixed(0)} KB devueltos`)
  console.log(`  ~${ruLectura} RU (${(ruLectura / (lecturaMs / 1000)).toFixed(1)} RU/s durante la lectura)`)
  console.log('')

  const ruPorSegundoPico = Math.max(
    ruEscritura / (escrituraMs / 1000),
    ruLectura / (lecturaMs / 1000),
  )

  console.log(`Techo del free tier: 1000 RU/s`)
  console.log(`Pico estimado: ${ruPorSegundoPico.toFixed(1)} RU/s`)
  console.log(
    ruPorSegundoPico <= 1000
      ? '✓ Dentro del presupuesto del free tier.'
      : '✗ Supera el presupuesto del free tier: hay que revisar el modelo de acceso.',
  )

  if (!mantener) {
    console.log('')
    console.log('Borrando los datos de prueba…')
    const inicioBorrado = Date.now()
    for (const id of ids) await deleteParcela(id)
    console.log(`  ${ids.length} parcelas borradas en ${Date.now() - inicioBorrado} ms`)
  } else {
    console.log('')
    console.log('Los datos se conservan. Para borrarlos después, usá el script con --parcelas 0.')
  }
}

main()
  .then(async () => {
    await closeMongo()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error(error)
    await closeMongo()
    process.exit(1)
  })
