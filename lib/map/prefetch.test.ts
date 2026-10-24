import { describe, expect, it, vi } from 'vitest'
import {
  descargarTiles,
  estimarVolumen,
  formatearBytes,
  tilesDelArea,
  urlDeTile,
  type CacheMinimo,
} from './prefetch'

function cacheFalso() {
  const guardadas = new Map<string, Response>()
  return {
    guardadas,
    cache: {
      put: async (request: Request, response: Response) => {
        guardadas.set(request.url, response)
      },
    } satisfies CacheMinimo,
  }
}

describe('urlDeTile', () => {
  it('arma la URL en z/x/y', () => {
    expect(urlDeTile('/tiles', { z: 12, x: 100, y: 200 })).toBe('/tiles/12/100/200.png')
  })

  it('quita la barra final del base', () => {
    expect(urlDeTile('/tiles/', { z: 12, x: 1, y: 2 })).toBe('/tiles/12/1/2.png')
  })
})

describe('tilesDelArea', () => {
  it('devuelve los tiles del rango por defecto', () => {
    const tiles = tilesDelArea({
      bounds: { north: 10.53, south: 10.43, east: -66.85, west: -66.95 },
    })
    expect(tiles.length).toBeGreaterThan(0)
    expect(Math.min(...tiles.map((t) => t.z))).toBe(12)
    expect(Math.max(...tiles.map((t) => t.z))).toBe(16)
  })

  it('respeta un rango distinto', () => {
    const tiles = tilesDelArea({
      bounds: { north: 10.53, south: 10.43, east: -66.85, west: -66.95 },
      minZoom: 14,
      maxZoom: 16,
    })
    expect(new Set(tiles.map((t) => t.z))).toEqual(new Set([14, 15, 16]))
  })
})

describe('descargarTiles', () => {
  it('descarga los tiles y los guarda en el caché', async () => {
    const { cache, guardadas } = cacheFalso()
    const fetchImpl = vi.fn().mockResolvedValue(new Response('tile'))

    const resultado = await descargarTiles({
      tiles: [
        { z: 12, x: 1, y: 2 },
        { z: 12, x: 1, y: 3 },
      ],
      baseUrl: '/tiles',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(resultado.descargados).toBe(2)
    expect(resultado.fallidos).toBe(0)
    expect(guardadas.size).toBe(2)
    // La clave del caché es la URL absoluta, que es la que usa el service worker.
    expect([...guardadas.keys()].some((url) => url.endsWith('/tiles/12/1/2.png'))).toBe(true)
  })

  it('sigue adelante cuando un tile falla', async () => {
    const { cache } = cacheFalso()
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/12/1/3.png')) return new Response('no', { status: 404 })
      return new Response('tile')
    })

    const resultado = await descargarTiles({
      tiles: [
        { z: 12, x: 1, y: 2 },
        { z: 12, x: 1, y: 3 },
      ],
      baseUrl: '/tiles',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(resultado.descargados).toBe(1)
    expect(resultado.fallidos).toBe(1)
    expect(resultado.errores).toHaveLength(1)
    expect(resultado.errores[0].mensaje).toMatch(/404/)
  })

  it('informa el progreso', async () => {
    const { cache } = cacheFalso()
    const progreso: Array<[number, number]> = []

    await descargarTiles({
      tiles: [
        { z: 12, x: 1, y: 1 },
        { z: 12, x: 1, y: 2 },
      ],
      baseUrl: '/tiles',
      cache,
      fetchImpl: (async () => new Response('tile')) as unknown as typeof fetch,
      onProgress: (hechos, total) => progreso.push([hechos, total]),
    })

    expect(progreso).toEqual([
      [1, 2],
      [2, 2],
    ])
  })

  it('no hace nada con una lista vacía', async () => {
    const { cache } = cacheFalso()
    const fetchImpl = vi.fn()

    const resultado = await descargarTiles({
      tiles: [],
      baseUrl: '/tiles',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(resultado.total).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('respeta la concurrencia pedida', async () => {
    const { cache } = cacheFalso()
    let enVuelo = 0
    let maximoEnVuelo = 0

    const fetchImpl = vi.fn().mockImplementation(async () => {
      enVuelo += 1
      maximoEnVuelo = Math.max(maximoEnVuelo, enVuelo)
      await new Promise((resolver) => setTimeout(resolver, 1))
      enVuelo -= 1
      return new Response('tile')
    })

    await descargarTiles({
      tiles: Array.from({ length: 10 }, (_, i) => ({ z: 12, x: 1, y: i })),
      baseUrl: '/tiles',
      cache,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      concurrencia: 3,
    })

    expect(maximoEnVuelo).toBeLessThanOrEqual(3)
    expect(maximoEnVuelo).toBeGreaterThan(1)
  })
})

describe('estimarVolumen', () => {
  it('estima por cantidad de tiles', () => {
    expect(estimarVolumen([{ z: 1, x: 1, y: 1 }, { z: 1, x: 1, y: 2 }], 1000)).toBe(2000)
  })
})

describe('formatearBytes', () => {
  it('usa la unidad correcta', () => {
    expect(formatearBytes(500)).toBe('500 B')
    expect(formatearBytes(2048)).toBe('2 KB')
    expect(formatearBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
