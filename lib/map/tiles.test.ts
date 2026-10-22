import { describe, expect, it } from 'vitest'
import {
  boundsFromPoints,
  countTilesForBounds,
  latToTileY,
  lonToTileX,
  tileToLat,
  tileToLon,
  tilesForBounds,
} from './tiles'

describe('lonToTileX', () => {
  it('mapea el mundo entero a una sola tesela en z0', () => {
    expect(lonToTileX(-180, 0)).toBe(0)
    expect(lonToTileX(0, 0)).toBe(0)
    expect(lonToTileX(179.9, 0)).toBe(0)
  })

  it('parte el mundo en cuatro en z1', () => {
    expect(lonToTileX(-180, 1)).toBe(0)
    expect(lonToTileX(-1, 1)).toBe(0)
    expect(lonToTileX(1, 1)).toBe(1)
    expect(lonToTileX(179, 1)).toBe(1)
  })

  it('nunca se sale del rango válido', () => {
    expect(lonToTileX(180, 3)).toBe(7)
    expect(lonToTileX(-180, 3)).toBe(0)
  })
})

describe('latToTileY', () => {
  it('sitúa el ecuador en el borde entre las dos filas de z1', () => {
    // El ecuador es exactamente el borde entre la fila norte y la sur, así
    // que la fila 1 es la que empieza en latitud 0.
    expect(latToTileY(0, 1)).toBe(1)
    expect(latToTileY(0.1, 1)).toBe(0)
    expect(latToTileY(-0.1, 1)).toBe(1)
    expect(latToTileY(0, 2)).toBe(2)
  })

  it('acota la latitud al máximo representable', () => {
    expect(latToTileY(90, 2)).toBe(0)
    expect(latToTileY(-90, 2)).toBe(3)
  })
})

describe('tileToLon y tileToLat', () => {
  it('son la inversa de lonToTileX y latToTileY', () => {
    for (const lon of [-66.9, -1, 0, 45, 179]) {
      const x = lonToTileX(lon, 12)
      const esquina = tileToLon(x, 12)
      expect(lon).toBeGreaterThanOrEqual(esquina)
      expect(lon).toBeLessThan(esquina + 360 / 2 ** 12)
    }
  })

  it('devuelven la esquina de una tesela', () => {
    expect(tileToLon(0, 1)).toBe(-180)
    expect(tileToLat(0, 1)).toBeCloseTo(85.05112878, 4)
  })
})

describe('tilesForBounds', () => {
  const AREA = { north: 10.53, south: 10.43, east: -66.85, west: -66.95 }

  it('devuelve una lista sin duplicados', () => {
    const tiles = tilesForBounds(AREA, 12, 14)
    const claves = new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`))
    expect(claves.size).toBe(tiles.length)
  })

  it('el conteo coincide con el número de teselas devueltas', () => {
    const tiles = tilesForBounds(AREA, 12, 14)
    expect(tiles.length).toBe(countTilesForBounds(AREA, 12, 14))
  })

  it('recorre los zooms de menor a mayor', () => {
    const tiles = tilesForBounds(AREA, 12, 15)
    const zooms = tiles.map((t) => t.z)
    expect(zooms).toEqual([...zooms].sort((a, b) => a - b))
    expect(new Set(zooms)).toEqual(new Set([12, 13, 14, 15]))
  })

  it('mantiene cada tesela dentro del rango válido de su nivel', () => {
    for (const tile of tilesForBounds(AREA, 10, 16)) {
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.x).toBeLessThan(2 ** tile.z)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeLessThan(2 ** tile.z)
    }
  })

  it('z12 a z16 alcanza para tener el mapa base sin conexión', () => {
    // Un tile z16 mide unos 600 m, así que el área de 11x11 km entra en
    // unas pocascientas teselas: es lo que se precachea.
    const base = tilesForBounds(AREA, 12, 16)
    expect(base.length).toBeGreaterThan(200)
    expect(base.length).toBeLessThan(800)
  })

  it('z17 y z18 multiplican el volumen y se cargan bajo demanda', () => {
    // Un tile z18 mide unos 150 m: cubrir el área con ellos son miles de
    // teselas. Por eso el precacheo se detiene en z16 y el resto se va
    // llenando a medida que el surveyor navega.
    const hasta16 = tilesForBounds(AREA, 12, 16).length
    const hasta18 = tilesForBounds(AREA, 12, 18).length
    expect(hasta18).toBeGreaterThan(hasta16 * 8)
  })
})

describe('boundsFromPoints', () => {
  it('devuelve null sin puntos', () => {
    expect(boundsFromPoints([])).toBeNull()
  })

  it('abarca todos los puntos con margen', () => {
    const bounds = boundsFromPoints([
      { lat: 10.48, lng: -66.9 },
      { lat: 10.5, lng: -66.85 },
    ])
    expect(bounds).not.toBeNull()
    if (!bounds) return
    expect(bounds.north).toBeGreaterThan(10.5)
    expect(bounds.south).toBeLessThan(10.48)
    expect(bounds.east).toBeGreaterThan(-66.85)
    expect(bounds.west).toBeLessThan(-66.9)
  })

  it('no se sale de los límites geográficos', () => {
    const bounds = boundsFromPoints([{ lat: 89.9, lng: 179.9 }], 100000)
    expect(bounds).not.toBeNull()
    if (!bounds) return
    expect(bounds.north).toBeLessThanOrEqual(85.05112878)
    expect(bounds.east).toBeLessThanOrEqual(180)
    expect(bounds.south).toBeGreaterThanOrEqual(-85.05112878)
    expect(bounds.west).toBeGreaterThanOrEqual(-180)
  })
})
