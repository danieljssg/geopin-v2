import { describe, expect, it } from 'vitest'
import { SEED_SCHEMAS, SERVICIOS_REQUERIDOS } from '@/lib/domain/seed'
import { validateFieldValue } from '@/lib/domain/schema'
import type { FieldDef } from '@/lib/domain/types'

const TODOS_LOS_CAMPOS: FieldDef[] = SEED_SCHEMAS.flatMap((schema) => schema.campos)

describe('esquemas semilla', () => {
  it('publica los tres módulos temáticos del plan', () => {
    expect(SEED_SCHEMAS.map((s) => s.moduleId).sort()).toEqual([
      'edificacion',
      'equipamiento',
      'infraestructura',
    ])
  })

  it('habilita los siete servicios que exige la Fase 2', () => {
    const keys = new Set(TODOS_LOS_CAMPOS.map((campo) => campo.key))
    for (const servicio of SERVICIOS_REQUERIDOS) {
      expect(keys.has(servicio)).toBe(true)
    }
  })

  it('no repite la clave de un campo dentro de un módulo', () => {
    for (const schema of SEED_SCHEMAS) {
      const keys = schema.campos.map((campo) => campo.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('no repite la clave de un campo entre módulos', () => {
    const keys = TODOS_LOS_CAMPOS.map((campo) => campo.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('exige opciones en toda lista desplegable', () => {
    for (const campo of TODOS_LOS_CAMPOS.filter((c) => c.tipo === 'lista')) {
      expect(campo.opciones?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('valida sus propias opciones contra el validador', () => {
    for (const campo of TODOS_LOS_CAMPOS.filter((c) => c.tipo === 'lista')) {
      for (const opcion of campo.opciones ?? []) {
        expect(validateFieldValue(campo, opcion)).toBeNull()
      }
    }
  })

  it('ordena los campos de forma contigua desde uno', () => {
    for (const schema of SEED_SCHEMAS) {
      const ordenes = schema.campos.map((campo) => campo.orden)
      expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b))
      expect(ordenes[0]).toBe(1)
    }
  })
})
