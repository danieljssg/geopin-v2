import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tilesForBounds, type Bounds, type TileCoordinate } from '../lib/map/tiles'

/**
 * Pipeline de tiles autoalojados.
 *
 * Genera la pirámide de tiles de un área y la sube al blob storage, para
 * que la app de campo pueda descargar el mapa del levantamiento y usarlo sin
 * conexión.
 *
 * El paso de renderizado lo hace un tile server (imágenes
 * `overv/openstreetmap-tile-server`): tilemaker produce teselas **vectoriales**
 * y la app sirve PNG, así que el render del ráster no se puede hacer con
 * herramientas stack-free. Este script no implementa el render: arma el
 * comando exacto que hay que correr, y `scripts/descargar-tiles-render.ts`
 * baja la pirámide del server propio para que acá se suba tal cual está.
 *
 * Uso:
 *   pnpm tiles:generar -- --bbox -66.95,10.43,-66.85,10.53 --zoom 12,16
 *   pnpm tiles:generar -- --bbox -66.95,10.43,-66.85,10.53 --zoom 12,16 --desde ./tiles-render --subir
 */

interface Argumentos {
  bbox?: Bounds
  zoomMin: number
  zoomMax: number
  salida?: string
  desde?: string
  subir: boolean
  dryRun: boolean
}

function usage(): void {
  console.log(`
Genera y sube la pirámide de tiles de un área.

  --bbox n,o,s,e      límites del área (ej. -66.95,10.43,-66.85,10.53)
  --zoom min,max     niveles a generar (por defecto 12,18)
  --salida <dir>      dónde dejar el manifiesto
  --desde <dir>       directorio con los tiles ya renderizados
  --subir             sube los tiles al blob storage
  --dry-run           muestra el plan sin hacer nada

Variables de entorno:
  BLOB_SAS_URL        SAS de lectura/escritura del contenedor de tiles
  BLOB_CONTAINER      nombre del contenedor (para la CLI de Azure)
  AZURE_STORAGE_CONNECTION_STRING
`.trim())
}

function parseArgumentos(argv: string[]): Argumentos | null {
  const argumentos: Argumentos = { zoomMin: 12, zoomMax: 18, subir: false, dryRun: false }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    // El separador "--" lo pasan pnpm y npm entre el script y sus
    // argumentos: no es un argumento propio.
    if (arg === '--') continue

    switch (arg) {
      case '--bbox': {
        const valor = argv[++i]
        if (!valor) return null
        const [oeste, sur, este, norte] = valor.split(',').map((parte) => Number(parte.trim()))
        if ([oeste, sur, este, norte].some((n) => !Number.isFinite(n))) return null
        if (oeste >= este || sur >= norte) {
          console.error('El bbox es inválido: oeste/norte y sur/este tienen que ir en orden.')
          return null
        }
        argumentos.bbox = { west: oeste, south: sur, east: este, north: norte }
        break
      }
      case '--zoom': {
        const valor = argv[++i]
        if (!valor) return null
        const [min, max] = valor.split(',').map((parte) => Number(parte.trim()))
        if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) return null
        argumentos.zoomMin = min
        argumentos.zoomMax = max
        break
      }
      case '--salida':
        argumentos.salida = argv[++i]
        break
      case '--desde':
        argumentos.desde = argv[++i]
        break
      case '--subir':
        argumentos.subir = true
        break
      case '--dry-run':
        argumentos.dryRun = true
        break
      case '--help':
      case '-h':
        usage()
        process.exit(0)
        break
      default:
        console.error(`Argumento desconocido: ${arg}`)
        return null
    }
  }

  return argumentos
}

function comandoDisponible(comando: string): boolean {
  try {
    execFileSync('which', [comando], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** Comando de renderizado recomendado para el área. */
function comandoRender(bbox: Bounds, zoomMin: number, zoomMax: number, salida: string): string {
  const { west, south, east, north } = bbox
  return [
    '# Pirámide ráster con el server de tiles OSM en Docker: tilemaker produce',
    '# teselas vectoriales y la app sirve PNG, así que el render va por acá.',
    '',
    '# 1. Extract y recorte al área (sin recorte, el import procesa todo el país):',
    'curl -O https://download.geofabrik.de/south-america/venezuela-latest.osm.pbf',
    `osmium extract --bbox=${west},${south},${east},${north} venezuela-latest.osm.pbf -o ${salida}.osm.pbf`,
    '',
    '# 2. Importar el extract al server y levantarlo:',
    'docker volume create osm-data',
    `docker run --rm -v "$PWD/${salida}.osm.pbf:/data/region.osm.pbf" \\`,
    '  -v osm-data:/data/database/ overv/openstreetmap-tile-server import',
    'docker run -d --name osm-tiles -p 8080:80 \\',
    '  -v osm-data:/data/database/ overv/openstreetmap-tile-server run',
    '',
    '# 3. Bajar la pirámide del server propio (el plan es el mismo de este script):',
    `pnpm tiles:descargar -- --bbox ${west},${south},${east},${north} --zoom ${zoomMin},${zoomMax}`,
  ].join('\n')
}

async function subirConAzureCli(directorio: string, total: number): Promise<boolean> {
  if (!comandoDisponible('az')) return false

  const container = process.env.BLOB_CONTAINER
  const conexion = process.env.AZURE_STORAGE_CONNECTION_STRING

  if (!container || !conexion) {
    console.log('Falta BLOB_CONTAINER o AZURE_STORAGE_CONNECTION_STRING para usar la CLI de Azure.')
    return false
  }

  console.log(`Subiendo ${total} tiles con la CLI de Azure…`)

  try {
    execFileSync(
      'az',
      [
        'storage',
        'blob',
        'upload-batch',
        '--destination',
        container,
        '--source',
        directorio,
        '--pattern',
        '**/*.png',
        '--connection-string',
        conexion,
        '--overwrite',
        'true',
      ],
      { stdio: 'inherit' },
    )
    return true
  } catch (error) {
    console.error(`La CLI de Azure falló: ${(error as Error).message}`)
    return false
  }
}

async function subirConSas(
  tiles: readonly TileCoordinate[],
  directorio: string,
): Promise<boolean> {
  const sas = process.env.BLOB_SAS_URL?.trim()
  if (!sas) return false

  const [base, consulta] = sas.split('?')
  const limpio = base.replace(/\/$/, '')

  console.log(`Subiendo ${tiles.length} tiles con la SAS…`)

  let subidas = 0
  let fallidas = 0
  let procesadas = 0

  /**
   * Subida en paralelo: una pirámide estatal son decenas de miles de PUT y
   * en serie el tiempo se vuelve absurdo. Azure acepta varias conexiones por
   * cliente sin problema; 8 anda bien en una conexión doméstica.
   */
  const concurrencia = 8
  const cola = [...tiles]

  const trabajadores = Array.from(
    { length: Math.min(concurrencia, cola.length) },
    async () => {
      while (cola.length > 0) {
        const tile = cola.shift()
        if (!tile) return

        const ruta = `tiles/${tile.z}/${tile.x}/${tile.y}.png`
        const origen = join(directorio, ruta)

        let contenido: Buffer
        try {
          contenido = await import('node:fs/promises').then((fs) => fs.readFile(origen))
        } catch {
          // La pirámide no tiene esa tesela: se anota y se sigue, porque una
          // tesela que falta no puede impedir que las demás se suban.
          fallidas += 1
          procesadas += 1
          continue
        }

        const url = `${limpio}/${ruta}${consulta ? `?${consulta}` : ''}`

        const respuesta = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'image/png',
            'x-ms-blob-type': 'BlockBlob',
            'x-ms-version': '2021-08-06',
          },
          body: new Uint8Array(contenido),
        })

        if (!respuesta.ok) {
          console.error(`Falló la subida de ${ruta}: ${respuesta.status}`)
          fallidas += 1
        } else {
          subidas += 1
        }

        procesadas += 1

        if (procesadas % 500 === 0) {
          console.log(`  ${procesadas}/${tiles.length} (fallidas ${fallidas})`)
        }
      }
    },
  )

  await Promise.all(trabajadores)

  console.log(`Subidas ${subidas} de ${tiles.length} teselas${fallidas > 0 ? `, fallidas ${fallidas}` : ''}.`)
  return subidas > 0
}

async function main(): Promise<void> {
  const argumentos = parseArgumentos(process.argv.slice(2))

  if (!argumentos) {
    usage()
    process.exit(1)
  }

  if (!argumentos.bbox) {
    console.error('Falta --bbox.')
    usage()
    process.exit(1)
  }

  const bbox = argumentos.bbox
  const tiles = tilesForBounds(bbox, argumentos.zoomMin, argumentos.zoomMax)
  const salida = argumentos.salida ?? './tiles-manifest'
  const bytesEstimados = tiles.length * 20_000

  console.log(`Área: ${bbox.west},${bbox.south},${bbox.east},${bbox.north}`)
  console.log(`Niveles: z${argumentos.zoomMin} a z${argumentos.zoomMax}`)
  console.log(`Teselas: ${tiles.length} (unos ${(bytesEstimados / 1024 / 1024).toFixed(1)} MB)`)

  if (argumentos.dryRun) {
    console.log('\nPlan:')
    console.log(comandoRender(bbox, argumentos.zoomMin, argumentos.zoomMax, salida))
    process.exit(0)
  }

  if (!argumentos.desde) {
    console.log('\nNo hay tiles renderizados todavía. Para generarlos:')
    console.log(comandoRender(bbox, argumentos.zoomMin, argumentos.zoomMax, salida))
    console.log('\nDespués volvé a correr con --desde <directorio> --subir.')
    process.exit(2)
  }

  // Manifiesto: qué tile hay y de dónde sale.
  mkdirSync(salida, { recursive: true })
  const manifiesto = {
    bbox,
    zoomMin: argumentos.zoomMin,
    zoomMax: argumentos.zoomMax,
    generadoEn: new Date().toISOString(),
    total: tiles.length,
    tiles: tiles.map((tile) => ({ ...tile, ruta: `tiles/${tile.z}/${tile.x}/${tile.y}.png` })),
  }
  writeFileSync(join(salida, 'manifest.json'), JSON.stringify(manifiesto, null, 2))
  console.log(`Manifiesto escrito en ${join(salida, 'manifest.json')}`)

  if (!argumentos.subir) {
    console.log('\nFalta --subir: los tiles quedaron solo en el disco.')
    process.exit(0)
  }

  /**
   * El plan y lo renderizado tienen que coincidir: la subida no arregla
   * huecos. Si no hay nada, el mensaje tiene que decir qué falta y no un
   * ENOENT crudo del primer archivo.
   */
  const desde = argumentos.desde
  const faltantes = tiles.filter(
    (tile) => !existsSync(join(desde, `tiles/${tile.z}/${tile.x}/${tile.y}.png`)),
  )

  if (faltantes.length === tiles.length) {
    console.error(`No hay teselas renderizadas en ${desde}.`)
    console.error('\nPara generarlas:')
    console.error(comandoRender(bbox, argumentos.zoomMin, argumentos.zoomMax, salida))
    process.exit(1)
  }

  if (faltantes.length > 0) {
    console.warn(
      `Faltan ${faltantes.length} de ${tiles.length} teselas en ${argumentos.desde}; se suben las que haya.`,
    )
  }

  const subidoConCli = await subirConAzureCli(argumentos.desde, tiles.length)
  if (subidoConCli) {
    console.log('Tiles subidos.')
    process.exit(0)
  }

  const subidoConSas = await subirConSas(tiles, argumentos.desde)
  if (!subidoConSas) {
    console.error('No se pudo subir: falta BLOB_SAS_URL o la CLI de Azure con credenciales.')
    process.exit(1)
  }

  console.log('Tiles subidos.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
