import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tilesForBounds, type Bounds, type TileCoordinate } from '../lib/map/tiles'

/**
 * Descarga del server de tiles la pirámide que después se sube al blob.
 *
 * El server de tiles (imágenes `overv/openstreetmap-tile-server`) renderiza
 * PNG bajo demanda contra PostGIS. Este script pide solo las teselas del plan
 * —la misma matemática de `lib/map/tiles.ts` que usa el generador y la app—
 * y las deja en el árbol `tiles/{z}/{x}/{y}.png` que espera la subida.
 *
 * El server es origen propio: descargar en bloque de acá no viola la política
 * de uso de teselas de nadie. Esa restricción aplica a los servers públicos.
 *
 * Uso:
 *   pnpm tiles:descargar -- --bbox -66.95,10.43,-66.85,10.53 --zoom 12,16
 *
 * Con `--server` se apunta a otro renderd; con `--concurrencia` se regula
 * cuántas teselas se piden a la vez (el server renderiza bajo demanda, así
 * que conviene no saturarlo).
 */

interface Argumentos {
  bbox?: Bounds
  zoomMin: number
  zoomMax: number
  server: string
  destino: string
  concurrencia: number
}

function usage(): void {
  console.log(`
Baja del server de tiles la pirámide del área.

  --bbox w,s,e,n     límites del área (ej. -66.95,10.43,-66.85,10.53)
  --zoom min,max     niveles a bajar (por defecto 12,16)
  --server <url>     raíz del server de tiles (por defecto http://localhost:8080)
  --destino <dir>    dónde dejar el árbol (por defecto ./tiles-render)
  --concurrencia n   cuántas teselas a la vez (por defecto 4)
`.trim())
}

function parseArgumentos(argv: string[]): Argumentos | null {
  const argumentos: Argumentos = {
    zoomMin: 12,
    zoomMax: 16,
    server: 'http://localhost:8080',
    destino: './tiles-render',
    concurrencia: 4,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    // El separador "--" lo pasan pnpm y npm entre el script y sus
    // argumentos: no es un argumento propio.
    if (arg === '--') continue

    const valor = argv[i + 1]

    switch (arg) {
      case '--bbox': {
        if (!valor) return null
        const partes = valor.split(',').map(Number)
        if (partes.length !== 4 || partes.some((n) => !Number.isFinite(n))) {
          console.error('El bbox tiene que ser cuatro números: w,s,e,n.')
          return null
        }
        argumentos.bbox = { west: partes[0], south: partes[1], east: partes[2], north: partes[3] }
        i += 1
        break
      }
      case '--zoom': {
        if (!valor || !/^\d+,\d+$/.test(valor)) {
          console.error('El zoom tiene que ser dos números: min,max.')
          return null
        }
        const [minimo, maximo] = valor.split(',').map(Number)
        if (minimo < 0 || maximo > 22 || minimo > maximo) {
          console.error('El rango de niveles no es válido.')
          return null
        }
        argumentos.zoomMin = minimo
        argumentos.zoomMax = maximo
        i += 1
        break
      }
      case '--server': {
        if (!valor) return null
        argumentos.server = valor
        i += 1
        break
      }
      case '--destino': {
        if (!valor) return null
        argumentos.destino = valor
        i += 1
        break
      }
      case '--concurrencia': {
        const numero = Number(valor)
        if (!Number.isInteger(numero) || numero < 1 || numero > 16) {
          console.error('La concurrencia tiene que ser un número de 1 a 16.')
          return null
        }
        argumentos.concurrencia = numero
        i += 1
        break
      }
      default:
        console.error(`Argumento desconocido: ${arg}`)
        return null
    }
  }

  return argumentos
}

const MINIMO_PNG = 45

/**
 * Baja una tesela y la escribe en el árbol de destino.
 *
 * Devuelve `null` si salió bien; el motivo del error si no. Con reintentos
 * porque el server renderiza bajo demanda y una tesela puede tardar más que
 * el primer intento.
 */
async function bajarTile(
  server: string,
  tile: TileCoordinate,
  destino: string,
): Promise<string | null> {
  const ruta = `tiles/${tile.z}/${tile.x}/${tile.y}.png`
  const url = `${server.replace(/\/$/, '')}/tile/${tile.z}/${tile.x}/${tile.y}.png`
  const archivo = join(destino, ruta)
  const reintentoMaximo = 2

  for (let intento = 0; intento <= reintentoMaximo; intento += 1) {
    if (intento > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500 * intento))
    }

    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(30_000) })

      if (!respuesta.ok) {
        throw new Error(`El server respondió ${respuesta.status}.`)
      }

      const tipo = respuesta.headers.get('content-type') ?? ''
      if (!tipo.includes('image/')) {
        throw new Error(`El server respondió ${tipo || 'sin content-type'} y no es una imagen.`)
      }

      const cuerpo = Buffer.from(await respuesta.arrayBuffer())
      // Un PNG válido mide al menos 45 bytes (firma + IHDR + IEND): menos que
      // eso es basura y no una tesela.
      if (cuerpo.byteLength < MINIMO_PNG) {
        throw new Error(`La respuesta mide ${cuerpo.byteLength} bytes y no es una imagen.`)
      }

      await mkdir(join(destino, 'tiles', String(tile.z), String(tile.x)), { recursive: true })
      await writeFile(archivo, cuerpo)
      return null
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido.'
      if (intento === reintentoMaximo) return mensaje
    }
  }

  return null // inalcanzable: el bucle ya devolvió en el último intento
}

/**
 * Chequeo previo: si el server no está levantado o no puede renderizar,
 * mejor fallar con ese diagnóstico que encolar cientos de intentos inútiles.
 */
async function chequeoPrevio(server: string): Promise<void> {
  const base = server.replace(/\/$/, '')

  try {
    const indice = await fetch(base, { signal: AbortSignal.timeout(10_000) })
    if (!indice.ok) throw new Error(`respondió ${indice.status}`)
  } catch {
    console.error(`El server de tiles no responde en ${base}.`)
    console.error('Levantalo con:')
    console.error('  docker run -d --name osm-tiles -p 8080:80 \\')
    console.error('    -v osm-data:/data/database/ overv/openstreetmap-tile-server run')
    process.exit(1)
  }

  try {
    const prueba = await fetch(`${base}/tile/0/0/0.png`, { signal: AbortSignal.timeout(30_000) })
    const tipo = prueba.headers.get('content-type') ?? ''

    if (!prueba.ok || !tipo.includes('image/')) {
      throw new Error(`${tipo || 'sin content-type'} y status ${prueba.status}`)
    }
  } catch (error) {
    const detalle = error instanceof Error ? error.message : 'sin detalle.'
    console.error(`El server responde en ${base} pero no pudo renderizar la tesela de prueba: ${detalle}.`)
    console.error('Casi siempre es el import: la base quedó sin datos o el extract no era un .osm.pbf válido.')
    console.error('Los motivos exactos están en los logs:')
    console.error('  docker logs osm-tiles --tail 20')
    process.exit(1)
  }
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

  const { bbox } = argumentos

  if (bbox.east <= bbox.west || bbox.north <= bbox.south) {
    console.error('El bbox está invertido: tiene que ser w,s,e,n con oeste < este y sur < norte.')
    process.exit(1)
  }

  const tiles = tilesForBounds(bbox, argumentos.zoomMin, argumentos.zoomMax)

  console.log(`Área: ${bbox.west},${bbox.south},${bbox.east},${bbox.north}`)
  console.log(`Niveles: z${argumentos.zoomMin} a z${argumentos.zoomMax}`)
  console.log(`Teselas: ${tiles.length}`)
  console.log(`Server: ${argumentos.server}`)

  if (tiles.length === 0) {
    console.error('El área no cubre ninguna tesela en esos niveles.')
    process.exit(1)
  }

  await chequeoPrevio(argumentos.server)

  const cola = [...tiles]
  const bajadas: Array<{ tile: TileCoordinate; mensaje: string }> = []
  let procesadas = 0
  let yaEstaban = 0

  const trabajadores = Array.from(
    { length: Math.min(argumentos.concurrencia, cola.length) },
    async () => {
      while (cola.length > 0) {
        const tile = cola.shift()
        if (!tile) return

        // Resumible: lo que ya está en el árbol no se vuelve a pedir.
        if (existsSync(join(argumentos.destino, `tiles/${tile.z}/${tile.x}/${tile.y}.png`))) {
          yaEstaban += 1
          procesadas += 1
          continue
        }

        const error = await bajarTile(argumentos.server, tile, argumentos.destino)

        procesadas += 1
        if (error) {
          bajadas.push({ tile, mensaje: error })
        }

        if (procesadas % 50 === 0) {
          console.log(`  ${procesadas}/${tiles.length} (fallidas ${bajadas.length})`)
        }
      }
    },
  )

  await Promise.all(trabajadores)

  const descargadas = procesadas - yaEstaban - bajadas.length

  console.log(`\nDescargadas: ${descargadas} de ${tiles.length}`)
  if (yaEstaban > 0) {
    console.log(`Ya estaban: ${yaEstaban}`)
  }

  if (bajadas.length > 0) {
    console.error(`\nFallidas: ${bajadas.length}. Primeras causas:`)
    for (const { tile, mensaje } of bajadas.slice(0, 5)) {
      console.error(`  z${tile.z}/${tile.x}/${tile.y}: ${mensaje}`)
    }
    if (bajadas.length === tiles.length) {
      console.error('Ninguna tesela se pudo bajar: el problema es del server, no de la red.')
    }
    console.error('Se pueden reintentar corriendo de nuevo: lo ya bajado no se repite.')
    process.exit(2)
  }

  console.log('\nSiguiente paso:')
  console.log(
    `  pnpm tiles:generar -- --bbox ${bbox.west},${bbox.south},${bbox.east},${bbox.north} ` +
      `--zoom ${argumentos.zoomMin},${argumentos.zoomMax} --desde ${argumentos.destino} --subir`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
