import { describe, expect, it } from 'vitest'
import {
  COLUMNAS_NUCLEO,
  anilloEnSentidoAntihorario,
  columnasDeModulos,
  escaparCsv,
  prepararHojas,
  prepararShapefile,
  toCSV,
  toGeoJSON,
} from './export'
import type { ModuleSchema, Parcela } from './types'

function parcela(overrides: Partial<Parcela> & { id: string }): Parcela {
  return {
    nombre: 'Casa',
    descripcion: 'Con toldo',
    categoria: 'Vivienda',
    ubicacion: { type: 'Point', coordinates: [-66.9036, 10.4806] },
    gps: { fuente: 'sensor', precision: 8, fijadoEn: '2026-10-24T10:00:00.000Z' },
    estado: 'completa',
    modulos: {},
    version: 1,
    creadoEn: '2026-10-24T10:00:00.000Z',
    creadoPor: 'u1',
    actualizadoEn: '2026-10-24T10:00:00.000Z',
    actualizadoPor: 'u1',
    ...overrides,
  }
}

const ESQUEMA: ModuleSchema = {
  moduleId: 'edificacion',
  modulo: 'edificacion',
  version: 1,
  campos: [
    { key: 'uso_general', label: 'Uso general', tipo: 'lista', opciones: ['Residencial'], orden: 1 },
    { key: 'pisos', label: 'Pisos', tipo: 'entero', orden: 2 },
  ],
  actualizadoEn: '2026-10-24T10:00:00.000Z',
  actualizadoPor: 'u1',
}

describe('columnasDeModulos', () => {
  it('arma las columnas en el orden del esquema', () => {
    expect(columnasDeModulos([ESQUEMA])).toEqual(['edificacion.uso_general', 'edificacion.pisos'])
  })

  it('respeta el orden de los campos, no el del array', () => {
    const desordenado: ModuleSchema = {
      ...ESQUEMA,
      campos: [
        { key: 'pisos', label: 'Pisos', tipo: 'entero', orden: 2 },
        { key: 'uso_general', label: 'Uso general', tipo: 'lista', opciones: ['X'], orden: 1 },
      ],
    }
    expect(columnasDeModulos([desordenado])).toEqual(['edificacion.uso_general', 'edificacion.pisos'])
  })
})

describe('toGeoJSON', () => {
  it('produce una FeatureCollection', () => {
    const geojson = toGeoJSON([parcela({ id: 'p1' })])
    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features).toHaveLength(1)
  })

  it('no incluye el miembro crs, que el RFC 7946 quitó', () => {
    const geojson = toGeoJSON([parcela({ id: 'p1' })]) as unknown as Record<string, unknown>
    expect(geojson.crs).toBeUndefined()
  })

  it('pone las coordenadas en longitud, latitud', () => {
    const geojson = toGeoJSON([parcela({ id: 'p1' })])
    expect(geojson.features[0].geometry.type).toBe('Point')
    expect(geojson.features[0].geometry.coordinates).toEqual([-66.9036, 10.4806])
  })

  it('exporta el polígono cuando la parcela lo tiene', () => {
    const conPoligono = parcela({
      id: 'p1',
      geometria: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      },
    })

    const geojson = toGeoJSON([conPoligono])
    expect(geojson.features[0].geometry.type).toBe('Polygon')
  })

  it('pone el anillo exterior en sentido antihorario', () => {
    // Horario: el área con signo da negativa.
    const horario = [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 0],
    ]
    const conPoligono = parcela({
      id: 'p1',
      geometria: { type: 'Polygon', coordinates: [horario] },
    })

    const geojson = toGeoJSON([conPoligono])
    const anillo = (geojson.features[0].geometry.coordinates as number[][][])[0]

    let area = 0
    for (let i = 0; i < anillo.length - 1; i += 1) {
      area += anillo[i][0] * anillo[i + 1][1] - anillo[i + 1][0] * anillo[i][1]
    }
    expect(area).toBeGreaterThan(0)
  })

  it('incluye los datos de los módulos como propiedades', () => {
    const conModulo = parcela({
      id: 'p1',
      modulos: {
        edificacion: {
          version: 1,
          schemaVersion: 1,
          datos: { uso_general: 'Residencial', pisos: 2 },
          actualizadoEn: '',
          actualizadoPor: 'u1',
        },
      },
    })

    const geojson = toGeoJSON([conModulo], [ESQUEMA])
    const propiedades = geojson.features[0].properties

    expect(propiedades['edificacion.uso_general']).toBe('Residencial')
    expect(propiedades['edificacion.pisos']).toBe(2)
  })

  it('deja en null los datos que no se levantaron', () => {
    const geojson = toGeoJSON([parcela({ id: 'p1' })], [ESQUEMA])
    expect(geojson.features[0].properties['edificacion.uso_general']).toBeNull()
  })

  it('guarda la latitud y longitud por separado en las propiedades', () => {
    const geojson = toGeoJSON([parcela({ id: 'p1' })])
    expect(geojson.features[0].properties.latitud).toBe(10.4806)
    expect(geojson.features[0].properties.longitud).toBe(-66.9036)
  })
})

describe('anilloEnSentidoAntihorario', () => {
  it('deja intacto un anillo que ya va en sentido antihorario', () => {
    const antihorario = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]
    expect(anilloEnSentidoAntihorario(antihorario)).toBe(antihorario)
  })

  it('invierte un anillo horario', () => {
    const horario = [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 0],
    ]
    const invertido = anilloEnSentidoAntihorario(horario)
    expect(invertido).not.toBe(horario)
    expect(invertido[0]).toEqual(horario[horario.length - 1])
  })

  it('no toca un anillo demasiado corto', () => {
    const corto = [[0, 0], [1, 1]]
    expect(anilloEnSentidoAntihorario(corto)).toBe(corto)
  })
})

describe('escaparCsv', () => {
  it('deja los valores simples sin tocar', () => {
    expect(escaparCsv('casa')).toBe('casa')
    expect(escaparCsv(5)).toBe('5')
    expect(escaparCsv(true)).toBe('true')
  })

  it('pone entre comillas lo que tiene coma', () => {
    expect(escaparCsv('una, dos')).toBe('"una, dos"')
  })

  it('duplica las comillas internas', () => {
    expect(escaparCsv('dijo "hola"')).toBe('"dijo ""hola"""')
  })

  it('pone entre comillas lo que tiene salto de línea', () => {
    expect(escaparCsv('uno\r\ndos')).toBe('"uno\r\ndos"')
  })

  it('deja vacío el null', () => {
    expect(escaparCsv(null)).toBe('')
  })
})

describe('toCSV', () => {
  it('emite los encabezados del núcleo y de los módulos', () => {
    const csv = toCSV([parcela({ id: 'p1' })], [ESQUEMA])
    const primera = csv.replace(/^\ufeff/, '').split('\r\n')[0]
    expect(primera).toBe([...COLUMNAS_NUCLEO, 'edificacion.uso_general', 'edificacion.pisos'].join(','))
  })

  it('emite una fila por parcela', () => {
    const csv = toCSV([parcela({ id: 'p1' }), parcela({ id: 'p2' })], [ESQUEMA])
    const lineas = csv.replace(/^\ufeff/, '').trim().split('\r\n')
    expect(lineas).toHaveLength(3)
  })

  it('empieza con BOM para que Excel reconozca el UTF-8', () => {
    expect(toCSV([]).charCodeAt(0)).toBe(0xfeff)
  })

  it('escapa las descripciones con coma', () => {
    const csv = toCSV([parcela({ id: 'p1', descripcion: 'Casa, con patio' })])
    expect(csv).toContain('"Casa, con patio"')
  })
})

describe('prepararHojas', () => {
  it('prepara una hoja con los encabezados y las filas', () => {
    const hojas = prepararHojas([parcela({ id: 'p1' })], [ESQUEMA])
    expect(hojas).toHaveLength(1)
    expect(hojas[0].nombre).toBe('Parcelas')
    expect(hojas[0].encabezados).toHaveLength(COLUMNAS_NUCLEO.length + 2)
    expect(hojas[0].filas).toHaveLength(1)
  })

  it('arma la fila en el mismo orden que los encabezados', () => {
    const hojas = prepararHojas([parcela({ id: 'p1', nombre: 'Mi casa' })], [ESQUEMA])
    const indiceNombre = hojas[0].encabezados.indexOf('nombre')
    expect(hojas[0].filas[0][indiceNombre]).toBe('Mi casa')
  })
})

describe('prepararShapefile', () => {
  const parcela = (overrides: Partial<Parcela> & { id: string }): Parcela => ({
    nombre: 'Casa',
    descripcion: 'Con patio',
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
    ...overrides,
  })

  const esquema: ModuleSchema = {
    moduleId: 'edificacion',
    modulo: 'edificacion',
    version: 1,
    campos: [{ key: 'uso_general', label: 'Uso general', tipo: 'lista', opciones: ['X'], orden: 1 }],
    actualizadoEn: '',
    actualizadoPor: 'u1',
  }

  it('produce un zip con los cuatro archivos', () => {
    const resultado = prepararShapefile([parcela({ id: 'p1' })], [esquema])
    expect(resultado.puntos).toBe(1)
    expect(resultado.zip.length).toBeGreaterThan(100)
  })

  it('acorta los nombres de campo a 10 caracteres', () => {
    const resultado = prepararShapefile([parcela({ id: 'p1' })], [esquema])

    for (const campo of resultado.campos) {
      expect(campo.nombre.length).toBeLessThanOrEqual(10)
    }
  })

  it('no repite nombres de campo', () => {
    const resultado = prepararShapefile([parcela({ id: 'p1' })], [esquema])
    const nombres = resultado.campos.map((campo) => campo.nombre)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('documenta el mapeo entre el nombre corto y el original', () => {
    const resultado = prepararShapefile([parcela({ id: 'p1' })], [esquema])
    expect(resultado.mapeo.map((m) => m.original)).toContain('edificacion.uso_general')
  })

  it('el nombre corto de una columna es el mismo en todos los puntos', () => {
    const resultado = prepararShapefile(
      [parcela({ id: 'p1' }), parcela({ id: 'p2' })],
      [esquema],
    )

    const nombres = resultado.mapeo.filter((m) => m.original === 'edificacion.uso_general')
    expect(nombres).toHaveLength(1)
  })
})
