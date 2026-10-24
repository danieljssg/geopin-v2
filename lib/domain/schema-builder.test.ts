import { describe, expect, it } from 'vitest'
import {
  addField,
  draftToSchema,
  moveField,
  normalizeOrder,
  removeField,
  schemasDiffer,
  slugifyFieldKey,
  updateField,
  validateSchemaFields,
} from './schema-builder'
import type { FieldDef } from './types'

function campo(overrides: Partial<FieldDef> = {}): FieldDef {
  return { key: 'uso_general', label: 'Uso general', tipo: 'texto', orden: 1, ...overrides }
}

describe('slugifyFieldKey', () => {
  it('quita acentos y espacios', () => {
    expect(slugifyFieldKey('Estado de la construcción')).toBe('estado_de_la_construccion')
  })

  it('colapsa separadores repetidos', () => {
    expect(slugifyFieldKey('Metros  --  cuadrados')).toBe('metros_cuadrados')
  })

  it('quita números iniciales problemáticos', () => {
    expect(slugifyFieldKey('123 campo')).toBe('campo_123_campo')
  })

  it('genera una clave válida para una etiqueta vacía', () => {
    expect(slugifyFieldKey('   ')).toBe('campo')
  })

  it('es determinista: la misma etiqueta da la misma clave', () => {
    expect(slugifyFieldKey('Uso general')).toBe(slugifyFieldKey('  Uso   General '))
  })

  it('produce claves que pasan la validación', () => {
    for (const etiqueta of ['Uso general', 'Área (m²)', 'Nº de pisos', 'Tipo — A/B']) {
      const key = slugifyFieldKey(etiqueta)
      const errores = validateSchemaFields([campo({ key, label: etiqueta })])
      expect(errores, `clave generada: ${key}`).toEqual([])
    }
  })
})

describe('validateSchemaFields', () => {
  it('acepta un conjunto válido', () => {
    expect(
      validateSchemaFields([
        campo({ key: 'a', label: 'A', orden: 1 }),
        campo({ key: 'b', label: 'B', tipo: 'lista', opciones: ['x', 'y'], orden: 2 }),
      ]),
    ).toEqual([])
  })

  it('exige al menos un campo', () => {
    expect(validateSchemaFields([])).toHaveLength(1)
  })

  it('rechaza claves repetidas', () => {
    const errores = validateSchemaFields([
      campo({ key: 'a', label: 'A', orden: 1 }),
      campo({ key: 'a', label: 'B', orden: 2 }),
    ])
    expect(errores.some((e) => e.message.includes('repetida'))).toBe(true)
  })

  it('rechaza claves con mayúsculas o símbolos', () => {
    for (const key of ['UsoGeneral', 'uso-general', '1campo', 'uso general']) {
      const errores = validateSchemaFields([campo({ key })])
      expect(errores.length, `clave: ${key}`).toBeGreaterThan(0)
    }
  })

  it('rechaza etiquetas vacías', () => {
    expect(validateSchemaFields([campo({ label: '  ' })]).length).toBeGreaterThan(0)
  })

  it('rechaza un tipo desconocido', () => {
    expect(
      validateSchemaFields([campo({ tipo: 'poligono' as never })]).length,
    ).toBeGreaterThan(0)
  })

  it('exige opciones en las listas', () => {
    expect(validateSchemaFields([campo({ tipo: 'lista', opciones: [] })]).length).toBeGreaterThan(0)
    expect(validateSchemaFields([campo({ tipo: 'lista', opciones: ['a'] })])).toEqual([])
  })

  it('rechaza opciones repetidas o vacías', () => {
    expect(
      validateSchemaFields([campo({ tipo: 'lista', opciones: ['a', 'a'] })]).length,
    ).toBeGreaterThan(0)
    expect(
      validateSchemaFields([campo({ tipo: 'lista', opciones: ['a', ' '] })]).length,
    ).toBeGreaterThan(0)
  })
})

describe('addField', () => {
  it('agrega al final con el orden correcto', () => {
    const campos = addField([campo({ key: 'a', orden: 1 })], {
      key: 'b',
      label: 'B',
      tipo: 'texto',
    })

    expect(campos.map((c) => c.key)).toEqual(['a', 'b'])
    expect(campos.map((c) => c.orden)).toEqual([1, 2])
  })
})

describe('updateField', () => {
  it('cambia la etiqueta sin tocar la clave', () => {
    const campos = updateField([campo({ key: 'a', label: 'Vieja' })], 'a', { label: 'Nueva' })
    expect(campos[0].label).toBe('Nueva')
    expect(campos[0].key).toBe('a')
  })

  it('no toca los demás campos', () => {
    const campos = updateField(
      [campo({ key: 'a', label: 'A' }), campo({ key: 'b', label: 'B' })],
      'a',
      { label: 'A2' },
    )
    expect(campos[1].label).toBe('B')
  })
})

describe('removeField', () => {
  it('borra y reordena', () => {
    const campos = removeField(
      [campo({ key: 'a' }), campo({ key: 'b' }), campo({ key: 'c' })],
      'b',
    )
    expect(campos.map((c) => c.key)).toEqual(['a', 'c'])
    expect(campos.map((c) => c.orden)).toEqual([1, 2])
  })
})

describe('moveField', () => {
  const base = [campo({ key: 'a' }), campo({ key: 'b' }), campo({ key: 'c' })]

  it('sube un campo', () => {
    expect(moveField(base, 'b', -1).map((c) => c.key)).toEqual(['b', 'a', 'c'])
  })

  it('baja un campo', () => {
    expect(moveField(base, 'b', 1).map((c) => c.key)).toEqual(['a', 'c', 'b'])
  })

  it('no hace nada si ya está en el extremo', () => {
    expect(moveField(base, 'a', -1).map((c) => c.key)).toEqual(['a', 'b', 'c'])
    expect(moveField(base, 'c', 1).map((c) => c.key)).toEqual(['a', 'b', 'c'])
  })

  it('mantiene el orden contiguo', () => {
    const movidos = moveField(base, 'c', -1)
    expect(movidos.map((c) => c.orden)).toEqual([1, 2, 3])
  })

  it('ignora una clave que no existe', () => {
    expect(moveField(base, 'zzz', 1).map((c) => c.key)).toEqual(['a', 'b', 'c'])
  })
})

describe('normalizeOrder', () => {
  it('reescribe el orden desde uno', () => {
    const campos = normalizeOrder([campo({ key: 'a', orden: 9 }), campo({ key: 'b', orden: 4 })])
    expect(campos.map((c) => c.orden)).toEqual([1, 2])
  })
})

describe('draftToSchema', () => {
  it('sube la versión en cada guardado', () => {
    const esquema = draftToSchema({
      moduleId: 'edificacion',
      modulo: 'edificacion',
      campos: [campo()],
      versionActual: 3,
      actor: 'admin-1',
      now: '2026-10-24T10:00:00.000Z',
    })

    expect(esquema.version).toBe(4)
    expect(esquema.actualizadoPor).toBe('admin-1')
    expect(esquema.actualizadoEn).toBe('2026-10-24T10:00:00.000Z')
  })

  it('normaliza el orden antes de publicar', () => {
    const esquema = draftToSchema({
      moduleId: 'edificacion',
      modulo: 'edificacion',
      campos: [campo({ key: 'a', orden: 7 }), campo({ key: 'b', orden: 2 })],
      versionActual: 0,
      actor: 'admin-1',
      now: '2026-10-24T10:00:00.000Z',
    })

    expect(esquema.campos.map((c) => c.orden)).toEqual([1, 2])
  })
})

describe('schemasDiffer', () => {
  it('detecta un cambio de etiqueta', () => {
    expect(schemasDiffer([campo({ label: 'A' })], [campo({ label: 'B' })])).toBe(true)
  })

  it('detecta un campo agregado', () => {
    expect(schemasDiffer([campo()], [campo(), campo({ key: 'b' })])).toBe(true)
  })

  it('detecta un cambio de requerido', () => {
    expect(schemasDiffer([campo({ requerido: false })], [campo({ requerido: true })])).toBe(true)
  })

  it('detecta un cambio de opciones', () => {
    const a = campo({ tipo: 'lista', opciones: ['x'] })
    const b = campo({ tipo: 'lista', opciones: ['x', 'y'] })
    expect(schemasDiffer([a], [b])).toBe(true)
  })

  it('dice que no hay cambios cuando son iguales', () => {
    expect(schemasDiffer([campo()], [campo()])).toBe(false)
  })
})
