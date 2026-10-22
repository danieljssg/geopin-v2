import { describe, expect, it } from 'vitest'
import { applyModuleUpdates, appliedModules, hasConflicts } from './sync'
import type { ParcelaModuloData } from './types'

const ACTOR = { id: 'user-1', nombre: 'Ana' }
const NOW = '2026-10-22T10:00:00.000Z'

function modulo(version: number, datos: Record<string, unknown>): ParcelaModuloData {
  return {
    version,
    schemaVersion: 1,
    datos,
    actualizadoEn: '2026-10-21T10:00:00.000Z',
    actualizadoPor: 'user-0',
  }
}

describe('applyModuleUpdates', () => {
  it('crea el módulo con versión 1 cuando no existe', () => {
    const resultado = applyModuleUpdates(
      undefined,
      [{ moduleId: 'edificacion', baseVersion: 0, schemaVersion: 1, datos: { uso_general: 'Residencial' } }],
      ACTOR,
      NOW,
    )

    expect(resultado.resultados.edificacion).toBe('aplicado')
    expect(resultado.modulos.edificacion.version).toBe(1)
    expect(resultado.modulos.edificacion.actualizadoPor).toBe('user-1')
    expect(resultado.modulos.edificacion.actualizadoEn).toBe(NOW)
  })

  it('aplica la escritura y sube la versión cuando la base coincide', () => {
    const resultado = applyModuleUpdates(
      { edificacion: modulo(3, { uso_general: 'Residencial' }) },
      [{ moduleId: 'edificacion', baseVersion: 3, schemaVersion: 1, datos: { uso_general: 'Comercial' } }],
      ACTOR,
      NOW,
    )

    expect(resultado.resultados.edificacion).toBe('aplicado')
    expect(resultado.modulos.edificacion.version).toBe(4)
    expect(resultado.modulos.edificacion.datos).toEqual({ uso_general: 'Comercial' })
  })

  it('no pisa otro módulo que no viene en la actualización', () => {
    const resultado = applyModuleUpdates(
      {
        edificacion: modulo(2, { uso_general: 'Residencial' }),
        equipamiento: modulo(5, { vialidad: 'Asfalto' }),
      },
      [{ moduleId: 'edificacion', baseVersion: 2, schemaVersion: 1, datos: { uso_general: 'Comercial' } }],
      ACTOR,
      NOW,
    )

    expect(resultado.modulos.equipamiento.version).toBe(5)
    expect(resultado.modulos.equipamiento.datos).toEqual({ vialidad: 'Asfalto' })
  })

  it('detecta el conflicto cuando la versión base está desactualizada', () => {
    const resultado = applyModuleUpdates(
      { edificacion: modulo(4, { uso_general: 'Industrial' }) },
      [{ moduleId: 'edificacion', baseVersion: 2, schemaVersion: 1, datos: { uso_general: 'Comercial' } }],
      ACTOR,
      NOW,
    )

    expect(resultado.resultados.edificacion).toBe('conflicto')
    expect(hasConflicts(resultado)).toBe(true)
    expect(resultado.conflictos[0]).toMatchObject({
      moduleId: 'edificacion',
      baseVersion: 2,
      currentVersion: 4,
    })
    expect(resultado.conflictos[0].currentDatos).toEqual({ uso_general: 'Industrial' })
  })

  it('no pisa los datos actuales cuando hay conflicto', () => {
    const resultado = applyModuleUpdates(
      { edificacion: modulo(4, { uso_general: 'Industrial' }) },
      [{ moduleId: 'edificacion', baseVersion: 2, schemaVersion: 1, datos: { uso_general: 'Comercial' } }],
      ACTOR,
      NOW,
    )

    expect(resultado.modulos.edificacion.datos).toEqual({ uso_general: 'Industrial' })
    expect(resultado.modulos.edificacion.version).toBe(4)
    expect(appliedModules(resultado)).toEqual([])
  })

  it('trata un reintento con los mismos datos como ignorado, no como conflicto', () => {
    const datos = { uso_general: 'Comercial' }
    const resultado = applyModuleUpdates(
      { edificacion: modulo(4, { ...datos }) },
      [{ moduleId: 'edificacion', baseVersion: 3, schemaVersion: 1, datos: { ...datos } }],
      ACTOR,
      NOW,
    )

    expect(resultado.resultados.edificacion).toBe('ignorado')
    expect(hasConflicts(resultado)).toBe(false)
    expect(resultado.modulos.edificacion.version).toBe(4)
  })

  it('aplica un módulo y deja otro en conflicto en la misma tanda', () => {
    const resultado = applyModuleUpdates(
      {
        edificacion: modulo(4, { uso_general: 'Industrial' }),
        equipamiento: modulo(1, { vialidad: 'Asfalto' }),
      },
      [
        { moduleId: 'edificacion', baseVersion: 1, schemaVersion: 1, datos: { uso_general: 'Comercial' } },
        { moduleId: 'equipamiento', baseVersion: 1, schemaVersion: 1, datos: { vialidad: 'Tierra' } },
      ],
      ACTOR,
      NOW,
    )

    expect(resultado.resultados.edificacion).toBe('conflicto')
    expect(resultado.resultados.equipamiento).toBe('aplicado')
    expect(resultado.modulos.equipamiento.version).toBe(2)
    expect(resultado.modulos.equipamiento.datos).toEqual({ vialidad: 'Tierra' })
  })

  it('no muta los módulos que recibe', () => {
    const actuales = { edificacion: modulo(2, { uso_general: 'Residencial' }) }
    applyModuleUpdates(
      actuales,
      [{ moduleId: 'edificacion', baseVersion: 2, schemaVersion: 1, datos: { uso_general: 'Comercial' } }],
      ACTOR,
      NOW,
    )

    expect(actuales.edificacion.version).toBe(2)
    expect(actuales.edificacion.datos).toEqual({ uso_general: 'Residencial' })
  })
})
