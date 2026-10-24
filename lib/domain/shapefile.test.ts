import { describe, expect, it } from 'vitest'
import {
  PRJ_WGS84,
  construirShapefile,
  construirZip,
  camposTruncados,
  crc32,
  empaquetarShapefile,
  type CampoShapefile,
  type PuntoShapefile,
} from './shapefile'

const CAMPOS: CampoShapefile[] = [
  { nombre: 'codigo', tipo: 'texto' },
  { nombre: 'nombre', tipo: 'texto' },
  { nombre: 'area_m2', tipo: 'numero' },
]

const PUNTOS: PuntoShapefile[] = [
  { x: -66.9036, y: 10.4806, atributos: { codigo: 'C-1', nombre: 'Casa', area_m2: 250.5 } },
  { x: -66.8, y: 10.5, atributos: { codigo: 'C-2', nombre: 'Bodega', area_m2: 100 } },
]

function lector(datos: Uint8Array) {
  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength)
  return {
    u32BE: (offset: number) => vista.getUint32(offset, false),
    u32LE: (offset: number) => vista.getUint32(offset, true),
    u16LE: (offset: number) => vista.getUint16(offset, true),
    i32LE: (offset: number) => vista.getInt32(offset, true),
    f64LE: (offset: number) => vista.getFloat64(offset, true),
    u8: (offset: number) => vista.getUint8(offset),
    texto: (offset: number, largo: number) =>
      new TextDecoder().decode(datos.slice(offset, offset + largo)),
  }
}

describe('crc32', () => {
  it('coincide con el valor conocido de la referencia', () => {
    // El CRC32 de "123456789" es 0xCBF43926.
    const datos = new TextEncoder().encode('123456789')
    expect(crc32(datos)).toBe(0xcbf43926)
  })

  it('devuelve 0 para datos vacíos', () => {
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('construirShapefile — .shp', () => {
  it('escribe la cabecera con el código de archivo correcto', () => {
    const { shp } = construirShapefile(PUNTOS, CAMPOS)
    const r = lector(shp)

    expect(r.u32BE(0)).toBe(9994)
    expect(r.u32LE(8)).toBe(1000)
    expect(r.u32LE(12)).toBe(1) // punto
  })

  it('declara el largo del archivo en palabras de 16 bits', () => {
    const { shp } = construirShapefile(PUNTOS, CAMPOS)
    const r = lector(shp)

    expect(r.u32BE(4)).toBe(shp.length / 2)
    expect(shp.length % 2).toBe(0)
  })

  it('escribe los límites de la capa', () => {
    const { shp } = construirShapefile(PUNTOS, CAMPOS)
    const r = lector(shp)

    expect(r.f64LE(16)).toBeCloseTo(-66.9036, 6)
    expect(r.f64LE(24)).toBeCloseTo(10.4806, 6)
    expect(r.f64LE(32)).toBeCloseTo(-66.8, 6)
    expect(r.f64LE(40)).toBeCloseTo(10.5, 6)
  })

  it('escribe un registro por punto con sus coordenadas', () => {
    const { shp } = construirShapefile(PUNTOS, CAMPOS)
    const r = lector(shp)

    // Primer registro: número, largo del contenido, tipo, X, Y.
    expect(r.u32BE(100)).toBe(1)
    expect(r.u32BE(104)).toBe(10)
    expect(r.u32LE(108)).toBe(1)
    expect(r.f64LE(112)).toBeCloseTo(-66.9036, 9)
    expect(r.f64LE(120)).toBeCloseTo(10.4806, 9)

    // Segundo registro, 28 bytes más allá.
    expect(r.u32BE(128)).toBe(2)
    expect(r.f64LE(140)).toBeCloseTo(-66.8, 9)
  })

  it('maneja el caso sin puntos', () => {
    const { shp } = construirShapefile([], CAMPOS)
    const r = lector(shp)
    expect(r.u32BE(4)).toBe(50)
    expect(shp.length).toBe(100)
  })
})

describe('construirShapefile — .shx', () => {
  it('guarda el desplazamiento de cada registro en palabras', () => {
    const { shx } = construirShapefile(PUNTOS, CAMPOS)
    const r = lector(shx)

    expect(r.u32BE(0)).toBe(9994)
    expect(r.u32BE(100)).toBe(50) // (100 bytes de cabecera) / 2
    expect(r.u32BE(104)).toBe(10)
    // El segundo registro está 28 bytes más allá.
    expect(r.u32BE(108)).toBe(64)
  })
})

describe('construirShapefile — .dbf', () => {
  it('escribe la cabecera con la cantidad de registros', () => {
    const { dbf } = construirShapefile(PUNTOS, CAMPOS)
    const r = lector(dbf)

    expect(r.u8(0)).toBe(0x03)
    expect(r.u32LE(4)).toBe(2)
    expect(r.u16LE(8)).toBe(32 * (CAMPOS.length + 1) + 1)
  })

  it('describe cada campo con su tipo', () => {
    const { dbf } = construirShapefile(PUNTOS, CAMPOS)
    const r = lector(dbf)

    const primerCampo = 32
    expect(r.texto(primerCampo, 11).trim()).toBe('codigo')
    expect(r.u8(primerCampo + 11)).toBe(0x43) // 'C'

    const segundoCampo = 32 + 32
    expect(r.texto(segundoCampo, 11).trim()).toBe('nombre')
    expect(r.u8(segundoCampo + 11)).toBe(0x43)

    const tercerCampo = 32 + 64
    expect(r.texto(tercerCampo, 11).trim()).toBe('area_m2')
    expect(r.u8(tercerCampo + 11)).toBe(0x4e) // 'N'
  })

  it('escribe los registros con sus atributos', () => {
    const { dbf } = construirShapefile(PUNTOS, CAMPOS)
    const r = lector(dbf)

    const largoCabecera = r.u16LE(8)
    const primerRegistro = largoCabecera

    expect(r.u8(primerRegistro)).toBe(0x20) // registro activo
    expect(r.texto(primerRegistro + 1, 3)).toBe('C-1')
  })

  it('deja vacío un atributo ausente', () => {
    const { dbf } = construirShapefile(
      [{ x: 0, y: 0, atributos: { codigo: 'X', nombre: 'Y' } }],
      [CAMPOS[0], CAMPOS[1], CAMPOS[2]],
    )
    const r = lector(dbf)
    const largoRegistro = r.u16LE(10)
    const ultimo = r.u16LE(8) + largoRegistro

    expect(r.texto(ultimo - 18, 18).trim()).toBe('')
  })

  it('termina con el marcador de fin de archivo', () => {
    const { dbf } = construirShapefile(PUNTOS, CAMPOS)
    expect(dbf[dbf.length - 1]).toBe(0x1a)
  })
})

describe('construirShapefile — .prj', () => {
  it('describe el sistema de referencia WGS 84', () => {
    const { prj } = construirShapefile(PUNTOS, CAMPOS)
    const texto = new TextDecoder().decode(prj)
    expect(texto).toBe(PRJ_WGS84)
    expect(texto).toContain('GEOGCS')
    expect(texto).toContain('WGS_1984')
  })
})

describe('construirZip', () => {
  it('escribe la firma local y la central', () => {
    const zip = construirZip([{ nombre: 'a.txt', datos: new TextEncoder().encode('hola') }])
    const r = lector(zip)

    expect(r.u32LE(0)).toBe(0x04034b50)

    // El directorio central empieza después del archivo local.
    const inicioCentral = r.u32LE(zip.length - 6)
    expect(r.u32LE(inicioCentral)).toBe(0x02014b50)
    expect(r.u32LE(zip.length - 22)).toBe(0x06054b50)
  })

  it('guarda el nombre y el contenido del archivo', () => {
    const contenido = new TextEncoder().encode('hola')
    const zip = construirZip([{ nombre: 'a.txt', datos: contenido }])
    const r = lector(zip)

    const largoNombre = r.u16LE(26)
    expect(r.texto(30, largoNombre)).toBe('a.txt')
    expect(r.u32LE(14)).toBe(crc32(contenido))
    expect(r.u32LE(22)).toBe(contenido.length)
  })

  it('acepta varios archivos', () => {
    const zip = construirZip([
      { nombre: 'a.txt', datos: new TextEncoder().encode('a') },
      { nombre: 'b.txt', datos: new TextEncoder().encode('b') },
    ])
    const r = lector(zip)

    expect(r.u16LE(zip.length - 12)).toBe(2)
  })
})

describe('empaquetarShapefile', () => {
  it('incluye los cuatro archivos del shapefile', () => {
    const zip = empaquetarShapefile(construirShapefile(PUNTOS, CAMPOS))
    const texto = new TextDecoder().decode(zip)

    expect(texto).toContain('parcelas.shp')
    expect(texto).toContain('parcelas.shx')
    expect(texto).toContain('parcelas.dbf')
    expect(texto).toContain('parcelas.prj')
  })
})

describe('camposTruncados', () => {
  it('avisa de los nombres que no caben en 10 caracteres', () => {
    expect(camposTruncados([{ nombre: 'nombre', tipo: 'texto' }])).toEqual([])
    expect(camposTruncados([{ nombre: 'nombre_del_sitio', tipo: 'texto' }])).toEqual([
      'nombre_del_sitio',
    ])
  })
})
