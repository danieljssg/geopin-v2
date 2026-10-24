import { describe, expect, it } from 'vitest'
import {
  OPACIDAD_MAXIMA,
  OPACIDAD_MINIMA,
  capasBasePorDefecto,
  capasDeTipo,
  parsearCapasSuperpuestas,
  todasLasCapas,
  validarCapas,
} from './capas'

describe('capasBasePorDefecto', () => {
  it('trae OSM y OpenTopoMap', () => {
    const capas = capasBasePorDefecto('')
    expect(capas.map((c) => c.id)).toEqual(['osm', 'topo'])
  })

  it('agrega la fuente propia solo si hay base configurada', () => {
    expect(capasBasePorDefecto('').some((c) => c.id === 'propio')).toBe(false)
    expect(capasBasePorDefecto('/tiles').some((c) => c.id === 'propio')).toBe(true)
  })

  it('arma la plantilla XYZ de la fuente propia', () => {
    const propia = capasBasePorDefecto('/tiles').find((c) => c.id === 'propio')!
    expect(propia.url).toBe('/tiles/{z}/{x}/{y}.png')
  })

  it('todas las capas base llevan atribución', () => {
    for (const capa of capasBasePorDefecto('/tiles')) {
      expect(capa.attribution.length).toBeGreaterThan(0)
    }
  })
})

describe('parsearCapasSuperpuestas', () => {
  it('devuelve vacío sin variable', () => {
    expect(parsearCapasSuperpuestas(undefined).capas).toEqual([])
    expect(parsearCapasSuperpuestas('   ').capas).toEqual([])
  })

  it('avisa de un JSON inválido sin romper', () => {
    const resultado = parsearCapasSuperpuestas('{no es json')
    expect(resultado.capas).toEqual([])
    expect(resultado.error).toMatch(/JSON/i)
  })

  it('avisa si no es una lista', () => {
    const resultado = parsearCapasSuperpuestas('{"id":"x"}')
    expect(resultado.error).toMatch(/lista/i)
  })

  it('lee una capa completa', () => {
    const resultado = parsearCapasSuperpuestas(
      JSON.stringify([
        {
          id: 'ortofoto',
          label: 'Ortofoto 2024',
          url: 'https://geo.muni.ve/wms',
          wmsLayers: 'ortofoto_2024',
          attribution: 'Municipalidad',
          opacity: 0.7,
        },
      ]),
    )

    expect(resultado.error).toBeUndefined()
    expect(resultado.capas).toHaveLength(1)
    expect(resultado.capas[0].wmsLayers).toBe('ortofoto_2024')
    expect(resultado.capas[0].tipo).toBe('superposicion')
  })

  it('exige id, label y url', () => {
    const resultado = parsearCapasSuperpuestas(JSON.stringify([{ id: 'a' }]))
    expect(resultado.capas).toHaveLength(0)
    expect(resultado.error).toMatch(/id, label y url/i)
  })

  it('rechaza ids repetidos', () => {
    const resultado = parsearCapasSuperpuestas(
      JSON.stringify([
        { id: 'a', label: 'A', url: 'https://a' },
        { id: 'a', label: 'B', url: 'https://b' },
      ]),
    )
    expect(resultado.capas).toHaveLength(1)
    expect(resultado.error).toMatch(/repetida/i)
  })

  it('acota la opacidad al rango válido', () => {
    const resultado = parsearCapasSuperpuestas(
      JSON.stringify([
        { id: 'a', label: 'A', url: 'https://a', opacity: 5 },
        { id: 'b', label: 'B', url: 'https://b', opacity: -1 },
      ]),
    )

    expect(resultado.capas[0].opacity).toBe(OPACIDAD_MAXIMA)
    expect(resultado.capas[1].opacity).toBe(OPACIDAD_MINIMA)
  })

  it('usa 0,8 por defecto', () => {
    const resultado = parsearCapasSuperpuestas(
      JSON.stringify([{ id: 'a', label: 'A', url: 'https://a' }]),
    )
    expect(resultado.capas[0].opacity).toBe(0.8)
  })
})

describe('todasLasCapas', () => {
  it('pone las base antes que las superposiciones', () => {
    const capas = todasLasCapas('/tiles', [
      {
        id: 'orto',
        label: 'Orto',
        tipo: 'superposicion',
        url: 'https://orto',
        attribution: '',
        opacity: 0.8,
      },
    ])

    expect(capas[0].tipo).toBe('base')
    expect(capas[capas.length - 1].tipo).toBe('superposicion')
  })
})

describe('capasDeTipo', () => {
  it('separa base de superposición', () => {
    const capas = todasLasCapas('/tiles', [
      {
        id: 'orto',
        label: 'Orto',
        tipo: 'superposicion',
        url: 'https://orto',
        attribution: '',
        opacity: 0.8,
      },
    ])

    expect(capasDeTipo(capas, 'base')).toHaveLength(3)
    expect(capasDeTipo(capas, 'superposicion')).toHaveLength(1)
  })
})

describe('validarCapas', () => {
  it('acepta una configuración sana', () => {
    expect(validarCapas(todasLasCapas('/tiles', []))).toEqual([])
  })

  it('avisa si no hay capa base', () => {
    const capas = [
      {
        id: 'a',
        label: 'A',
        tipo: 'superposicion' as const,
        url: 'https://a',
        attribution: '',
        opacity: 0.8,
      },
    ]
    expect(validarCapas(capas).join(' ')).toMatch(/capa base/i)
  })

  it('avisa de ids repetidos', () => {
    const capas = [
      { id: 'a', label: 'A', tipo: 'base' as const, url: 'https://a', attribution: '', opacity: 1 },
      { id: 'a', label: 'B', tipo: 'base' as const, url: 'https://b', attribution: '', opacity: 1 },
    ]
    expect(validarCapas(capas).join(' ')).toMatch(/repetida/i)
  })

  it('avisa de una opacidad inválida', () => {
    const capas = [
      { id: 'a', label: 'A', tipo: 'base' as const, url: 'https://a', attribution: '', opacity: 3 },
    ]
    expect(validarCapas(capas).join(' ')).toMatch(/opacidad/i)
  })
})
