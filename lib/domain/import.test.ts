import { describe, expect, it } from 'vitest'
import {
  claveDeIdempotencia,
  filaAParcela,
  mapearEncabezados,
  mapearFila,
  mismoCodigo,
  normalizarEncabezado,
} from './import'
import {
  BUFFER_DUPLICADOS_M,
  detectarDuplicados,
  detectarDuplicadosPorCodigo,
  distanciaMetros,
} from './dedup'
import { aplicarMerge, proponerMerge } from './merge'
import type { Parcela } from './types'

describe('normalizarEncabezado', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizarEncabezado('Metros Cuadrados')).toBe('metros_cuadrados')
  })

  it('convierte la puntuación en guiones bajos', () => {
    expect(normalizarEncabezado('Área (m²)')).toBe('area_m2')
  })

  it('colapsa separadores repetidos', () => {
    expect(normalizarEncabezado('código  catastral')).toBe('codigo_catastral')
  })
})

describe('mapearEncabezados', () => {
  it('reconoce los alias comunes', () => {
    const { mapa } = mapearEncabezados(['Código', 'Referencia', 'Lat', 'Lng'])
    expect(mapa['Código']).toBe('codigo')
    expect(mapa['Referencia']).toBe('nombre')
    expect(mapa['Lat']).toBe('latitud')
    expect(mapa['Lng']).toBe('longitud')
  })

  it('ignora las columnas que no reconoce sin fallar', () => {
    const { mapa, desconocidas } = mapearEncabezados(['Nombre', 'Columna sin sentido'])
    expect(mapa['Nombre']).toBe('nombre')
    expect(desconocidas).toEqual(['Columna sin sentido'])
  })

  it('no deja que dos columnas pisen el mismo campo', () => {
    const { mapa } = mapearEncabezados(['Área', 'Area m2'])
    const asignados = Object.values(mapa)
    expect(new Set(asignados).size).toBe(asignados.length)
  })
})

describe('mapearFila', () => {
  const mapa = { 'Código': 'codigo', 'Lat': 'latitud', 'Lng': 'longitud' }

  it('mapea los valores a los campos canónicos', () => {
    const resultado = mapearFila({ 'Código': 'C-1', 'Lat': 10.48, 'Lng': -66.9 }, mapa, 2)
    expect(resultado.datos).toEqual({ codigo: 'C-1', latitud: 10.48, longitud: -66.9 })
    expect(resultado.errores).toEqual([])
  })

  it('avisa cuando un número no se puede convertir', () => {
    const resultado = mapearFila({ 'Lat': 'no es un número' }, { 'Lat': 'latitud' }, 2)
    expect(resultado.errores).toHaveLength(1)
  })

  it('convierte la coma decimal', () => {
    const resultado = mapearFila({ 'Lat': '10,48' }, { 'Lat': 'latitud' }, 2)
    expect(resultado.datos.latitud).toBe(10.48)
  })
})

describe('filaAParcela', () => {
  it('arma una parcela válida', () => {
    const resultado = filaAParcela(
      { nombre: 'Casa', latitud: 10.48, longitud: -66.9, codigo: 'C-1' },
      2,
    )

    expect(resultado.errores).toEqual([])
    expect(resultado.parcela?.nombre).toBe('Casa')
    expect(resultado.parcela?.codigo).toBe('C-1')
    expect(resultado.parcela?.ubicacion).toEqual({ lat: 10.48, lng: -66.9 })
  })

  it('exige nombre', () => {
    const resultado = filaAParcela({ latitud: 10.48, longitud: -66.9, codigo: 'C-1' }, 2)
    expect(resultado.errores.join(' ')).toMatch(/nombre/i)
  })

  it('exige coordenadas', () => {
    const resultado = filaAParcela({ nombre: 'Casa', codigo: 'C-1' }, 2)
    expect(resultado.errores.join(' ')).toMatch(/coordenadas/i)
  })

  it('rechaza coordenadas fuera de rango', () => {
    const resultado = filaAParcela(
      { nombre: 'Casa', latitud: 120, longitud: -66.9, codigo: 'C-1' },
      2,
    )
    expect(resultado.errores.join(' ')).toMatch(/fuera de rango/i)
  })

  it('exige el código de parcela', () => {
    const resultado = filaAParcela({ nombre: 'Casa', latitud: 10.48, longitud: -66.9 }, 2)
    expect(resultado.errores.join(' ')).toMatch(/código de parcela/i)
  })

  it('acumula los errores previos', () => {
    const resultado = filaAParcela(
      { nombre: 'Casa', latitud: 10.48, longitud: -66.9, codigo: 'C-1' },
      2,
      ['Algo raro'],
    )
    expect(resultado.errores).toContain('Algo raro')
  })

  it('deja el estado pendiente por defecto', () => {
    const resultado = filaAParcela(
      { nombre: 'Casa', latitud: 10.48, longitud: -66.9, codigo: 'C-1' },
      2,
    )
    expect(resultado.parcela?.estado).toBe('pendiente')
  })

  it('respeta el estado cuando viene de la planilla', () => {
    const resultado = filaAParcela(
      { nombre: 'Casa', latitud: 10.48, longitud: -66.9, codigo: 'C-1', estado: 'completa' },
      2,
    )
    expect(resultado.parcela?.estado).toBe('completa')
  })
})

describe('claveDeIdempotencia', () => {
  it('normaliza a mayúsculas', () => {
    expect(claveDeIdempotencia(' c-1 ')).toBe('C-1')
  })

  it('devuelve null sin código', () => {
    expect(claveDeIdempotencia(undefined)).toBeNull()
    expect(claveDeIdempotencia('   ')).toBeNull()
  })
})

describe('mismoCodigo', () => {
  it('compara ignorando mayúsculas y espacios', () => {
    expect(mismoCodigo('C-1', ' c-1 ')).toBe(true)
  })

  it('no confunde códigos distintos', () => {
    expect(mismoCodigo('C-1', 'C-2')).toBe(false)
  })

  it('no da por iguales dos sin código', () => {
    expect(mismoCodigo(undefined, undefined)).toBe(false)
  })
})

describe('distanciaMetros', () => {
  it('da cero para el mismo punto', () => {
    expect(distanciaMetros({ lat: 10.48, lng: -66.9 }, { lat: 10.48, lng: -66.9 })).toBe(0)
  })

  it('mide un metro con precisión', () => {
    // Un milésimo de grado de latitud son unos 111 metros.
    const distancia = distanciaMetros({ lat: 10.48, lng: -66.9 }, { lat: 10.48001, lng: -66.9 })
    expect(distancia).toBeGreaterThan(1)
    expect(distancia).toBeLessThan(1.5)
  })

  it('mide kilómetros', () => {
    const distancia = distanciaMetros({ lat: 10.48, lng: -66.9 }, { lat: 10.58, lng: -66.9 })
    expect(distancia).toBeGreaterThan(11000)
    expect(distancia).toBeLessThan(11200)
  })
})

function parcela(id: string, lat: number, lng: number, codigo?: string): Parcela {
  return {
    id,
    nombre: id,
    descripcion: '',
    categoria: 'Vivienda',
    ubicacion: { type: 'Point', coordinates: [lng, lat] },
    gps: { fuente: 'sensor' },
    estado: 'pendiente',
    codigo,
    modulos: {},
    version: 1,
    creadoEn: '2026-10-24T10:00:00.000Z',
    creadoPor: 'u1',
    actualizadoEn: '2026-10-24T10:00:00.000Z',
    actualizadoPor: 'u1',
  }
}

describe('detectarDuplicados', () => {
  it('el buffer por defecto es de 2 metros', () => {
    expect(BUFFER_DUPLICADOS_M).toBe(2)
  })

  it('agrupa dos registros a menos de 2 metros', () => {
    const grupos = detectarDuplicados([
      parcela('a', 10.48, -66.9),
      parcela('b', 10.48001, -66.9),
    ])

    expect(grupos).toHaveLength(1)
    expect(grupos[0].ids).toEqual(['a', 'b'])
    expect(grupos[0].distanciaM).toBeLessThan(2)
  })

  it('no agrupa registros lejanos', () => {
    const grupos = detectarDuplicados([
      parcela('a', 10.48, -66.9),
      parcela('b', 10.49, -66.9),
    ])
    expect(grupos).toEqual([])
  })

  it('agrupa de forma transitiva', () => {
    // a-b a 1 m, b-c a 1 m, a-c a 2 m: los tres son un grupo.
    const grupos = detectarDuplicados([
      parcela('a', 10.48, -66.9),
      parcela('b', 10.480009, -66.9),
      parcela('c', 10.480018, -66.9),
    ])

    expect(grupos).toHaveLength(1)
    expect(grupos[0].ids).toHaveLength(3)
  })

  it('deja las parcelas solas fuera', () => {
    const grupos = detectarDuplicados([parcela('a', 10.48, -66.9)])
    expect(grupos).toEqual([])
  })

  it('ordena los grupos por cercanía', () => {
    const grupos = detectarDuplicados([
      // A y B a 1,11 m.
      parcela('a', 10.48, -66.9),
      parcela('b', 10.48001, -66.9),
      // C y D a 0,55 m: un par más cercano, en otra parte del mapa.
      parcela('c', 10.5, -66.9),
      parcela('d', 10.500005, -66.9),
    ])

    expect(grupos).toHaveLength(2)
    expect(grupos[0].ids).toEqual(['c', 'd'])
    expect(grupos[0].distanciaM).toBeLessThan(grupos[1].distanciaM)
  })
})

describe('detectarDuplicadosPorCodigo', () => {
  it('agrupa las parcelas con el mismo código', () => {
    const grupos = detectarDuplicadosPorCodigo([
      parcela('a', 10.48, -66.9, 'C-1'),
      parcela('b', 10.6, -66.9, 'c-1'),
    ])

    expect(grupos).toHaveLength(1)
    expect(grupos[0].motivo).toBe('codigo')
    expect(grupos[0].ids).toEqual(['a', 'b'])
  })

  it('ignora las parcelas sin código', () => {
    expect(detectarDuplicadosPorCodigo([parcela('a', 10.48, -66.9)])).toEqual([])
  })
})

describe('proponerMerge', () => {
  const existente = parcela('p1', 10.48, -66.9, 'C-1')
  existente.nombre = 'Casa vieja'
  existente.descripcion = 'Descripción original'
  existente.modulos = {
    edificacion: {
      version: 2,
      schemaVersion: 1,
      datos: { uso_general: 'Residencial', pisos: 1 },
      actualizadoEn: '',
      actualizadoPor: 'u1',
    },
  }

  it('solo lista los campos que difieren', () => {
    const propuesta = proponerMerge(existente, {
      id: 'p1',
      nombre: 'Casa nueva',
      descripcion: 'Descripción original',
      categoria: 'Vivienda',
      ubicacion: { lat: 10.48, lng: -66.9 },
      gps: { fuente: 'sensor' },
      estado: 'pendiente',
      modulos: [
        { moduleId: 'edificacion', baseVersion: 2, schemaVersion: 1, datos: { uso_general: 'Residencial', pisos: 3 } },
      ],
    })

    const campos = propuesta.conflictos.map((c) => c.campo)
    expect(campos).toContain('nombre')
    expect(campos).toContain('edificacion.pisos')
    expect(campos).not.toContain('descripcion')
    expect(campos).not.toContain('edificacion.uso_general')
  })

  it('propone conservar lo existente por defecto', () => {
    const propuesta = proponerMerge(existente, {
      id: 'p1',
      nombre: 'Casa nueva',
      descripcion: 'Otra',
      categoria: 'Vivienda',
      ubicacion: { lat: 10.48, lng: -66.9 },
      gps: { fuente: 'sensor' },
      estado: 'pendiente',
      modulos: [],
    })

    expect(propuesta.eleccionInicial.nombre).toBe('existente')
  })

  it('detecta el conflicto de ubicación', () => {
    const propuesta = proponerMerge(existente, {
      id: 'p1',
      nombre: 'Casa vieja',
      descripcion: 'Descripción original',
      categoria: 'Vivienda',
      ubicacion: { lat: 10.5, lng: -66.9 },
      gps: { fuente: 'sensor' },
      estado: 'pendiente',
      modulos: [],
    })

    expect(propuesta.conflictos.map((c) => c.campo)).toContain('ubicacion')
  })
})

describe('aplicarMerge', () => {
  const existente = parcela('p1', 10.48, -66.9, 'C-1')
  existente.nombre = 'Casa vieja'
  existente.modulos = {
    edificacion: {
      version: 2,
      schemaVersion: 1,
      datos: { uso_general: 'Residencial', pisos: 1 },
      actualizadoEn: '',
      actualizadoPor: 'u1',
    },
  }

  const entrante = {
    id: 'p1',
    nombre: 'Casa nueva',
    descripcion: 'Descripción original',
    categoria: 'Vivienda',
    ubicacion: { lat: 10.48, lng: -66.9 },
    gps: { fuente: 'sensor' as const },
    estado: 'pendiente' as const,
    modulos: [
      { moduleId: 'edificacion', baseVersion: 2, schemaVersion: 1, datos: { uso_general: 'Residencial', pisos: 3 } },
    ],
  }

  it('conserva lo existente si no se eligió nada', () => {
    const resultado = aplicarMerge(existente, entrante, {}, '2026-10-24T12:00:00.000Z', 'u2')
    expect(resultado.nombre).toBe('Casa vieja')
    expect(resultado.modulos.edificacion.datos.pisos).toBe(1)
  })

  it('toma lo entrante en los campos elegidos', () => {
    const resultado = aplicarMerge(
      existente,
      entrante,
      { nombre: 'entrante', 'edificacion.pisos': 'entrante' },
      '2026-10-24T12:00:00.000Z',
      'u2',
    )

    expect(resultado.nombre).toBe('Casa nueva')
    expect(resultado.modulos.edificacion.datos.pisos).toBe(3)
  })

  it('deja intactos los campos que noeligió', () => {
    const resultado = aplicarMerge(
      existente,
      entrante,
      { nombre: 'entrante' },
      '2026-10-24T12:00:00.000Z',
      'u2',
    )

    expect(resultado.descripcion).toBe(existente.descripcion)
    expect(resultado.modulos.edificacion.datos.pisos).toBe(1)
  })

  it('sube la versión del módulo que cambió y no la del otro', () => {
    const resultado = aplicarMerge(
      existente,
      entrante,
      { 'edificacion.pisos': 'entrante' },
      '2026-10-24T12:00:00.000Z',
      'u2',
    )

    expect(resultado.modulos.edificacion.version).toBe(3)
  })

  it('sube la versión global y registra la autoría', () => {
    const resultado = aplicarMerge(existente, entrante, { nombre: 'entrante' }, '2026-10-24T12:00:00.000Z', 'u2')
    expect(resultado.version).toBe(2)
    expect(resultado.actualizadoPor).toBe('u2')
    expect(resultado.actualizadoEn).toBe('2026-10-24T12:00:00.000Z')
  })

  it('mueve la ubicación cuando se elige la entrante', () => {
    const conUbicacion = { ...entrante, ubicacion: { lat: 10.5, lng: -66.8 } }
    const resultado = aplicarMerge(
      existente,
      conUbicacion,
      { ubicacion: 'entrante' },
      '2026-10-24T12:00:00.000Z',
      'u2',
    )

    expect(resultado.ubicacion.coordinates).toEqual([-66.8, 10.5])
  })
})
