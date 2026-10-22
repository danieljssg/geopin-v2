import { describe, expect, it } from 'vitest'
import {
  coerceFieldValue,
  isBlank,
  validateFieldValue,
  validateModuleData,
} from '@/lib/domain/schema'
import type { FieldDef } from '@/lib/domain/types'

function campo(overrides: Partial<FieldDef> = {}): FieldDef {
  return {
    key: 'prueba',
    label: 'Prueba',
    tipo: 'texto',
    orden: 1,
    ...overrides,
  }
}

describe('isBlank', () => {
  it('trata undefined, null y cadenas vacías como ausentes', () => {
    expect(isBlank(undefined)).toBe(true)
    expect(isBlank(null)).toBe(true)
    expect(isBlank('')).toBe(true)
    expect(isBlank('   ')).toBe(true)
  })

  it('no trata cero ni false como ausentes', () => {
    expect(isBlank(0)).toBe(false)
    expect(isBlank(false)).toBe(false)
  })
})

describe('validateFieldValue', () => {
  it('acepta un texto largo sin bloquearlo', () => {
    const largo = 'a'.repeat(5000)
    expect(validateFieldValue(campo({ tipo: 'texto' }), largo)).toBeNull()
  })

  it('rechaza un texto por encima del límite de seguridad', () => {
    const error = validateFieldValue(campo({ tipo: 'texto' }), 'a'.repeat(20_001))
    expect(error).toMatch(/no puede superar/i)
  })

  it('exige un entero y no acepta un decimal', () => {
    expect(validateFieldValue(campo({ tipo: 'entero' }), '3')).toBeNull()
    expect(validateFieldValue(campo({ tipo: 'entero' }), 3)).toBeNull()
    expect(validateFieldValue(campo({ tipo: 'entero' }), '3.5')).toMatch(/entero/i)
  })

  it('acepta decimales con punto y con coma', () => {
    expect(validateFieldValue(campo({ tipo: 'decimal' }), '12.5')).toBeNull()
    expect(validateFieldValue(campo({ tipo: 'decimal' }), '12,5')).toBeNull()
  })

  it('rechaza texto no numérico en un campo decimal', () => {
    expect(validateFieldValue(campo({ tipo: 'decimal' }), 'mucho')).toMatch(/número/i)
  })

  it('exige un booleano real', () => {
    expect(validateFieldValue(campo({ tipo: 'booleano' }), true)).toBeNull()
    expect(validateFieldValue(campo({ tipo: 'booleano' }), 'sí')).toMatch(/verdadero o falso/i)
  })

  it('exige que el valor de una lista esté entre las opciones', () => {
    const lista = campo({ tipo: 'lista', opciones: ['Conectado', 'No conectado'] })
    expect(validateFieldValue(lista, 'Conectado')).toBeNull()
    expect(validateFieldValue(lista, 'Medio conectado')).toMatch(/opciones/i)
  })

  it('acepta una fecha parseable y rechaza una no parseable', () => {
    expect(validateFieldValue(campo({ tipo: 'fecha' }), '2026-10-21')).toBeNull()
    expect(validateFieldValue(campo({ tipo: 'fecha' }), 'ayer')).toMatch(/fecha válida/i)
  })

  it('solo exige el valor cuando el campo es requerido', () => {
    expect(validateFieldValue(campo({ requerido: false }), undefined)).toBeNull()
    expect(validateFieldValue(campo({ requerido: true }), undefined)).toMatch(/obligatorio/i)
    expect(validateFieldValue(campo({ requerido: true }), '')).toMatch(/obligatorio/i)
  })
})

describe('validateModuleData', () => {
  it('devuelve todos los errores, no solo el primero', () => {
    const campos: FieldDef[] = [
      campo({ key: 'a', label: 'A', tipo: 'entero' }),
      campo({ key: 'b', label: 'B', tipo: 'lista', opciones: ['x'] }),
    ]
    const errores = validateModuleData(campos, { a: 'no-numero', b: 'y' })
    expect(errores.map((e) => e.key)).toEqual(['a', 'b'])
  })

  it('no reporta errores cuando los datos son válidos', () => {
    const campos: FieldDef[] = [
      campo({ key: 'a', label: 'A', tipo: 'entero' }),
      campo({ key: 'b', label: 'B', tipo: 'lista', opciones: ['x'] }),
    ]
    expect(validateModuleData(campos, { a: 2, b: 'x' })).toEqual([])
  })
})

describe('coerceFieldValue', () => {
  it('convierte el string de un input numérico a entero', () => {
    expect(coerceFieldValue(campo({ tipo: 'entero' }), '7')).toBe(7)
    expect(coerceFieldValue(campo({ tipo: 'entero' }), '7.9')).toBe(7)
  })

  it('convierte la coma decimal', () => {
    expect(coerceFieldValue(campo({ tipo: 'decimal' }), '12,5')).toBe(12.5)
  })

  it('devuelve undefined para un valor vacío', () => {
    expect(coerceFieldValue(campo(), '  ')).toBeUndefined()
  })

  it('interpreta los booleanos serializados', () => {
    expect(coerceFieldValue(campo({ tipo: 'booleano' }), 'true')).toBe(true)
    expect(coerceFieldValue(campo({ tipo: 'booleano' }), 'false')).toBe(false)
  })
})
