import { describe, expect, it } from 'vitest'
import { jsonEquals, stripUndefinedDeep } from './json'

describe('jsonEquals', () => {
  it('compara primitivos', () => {
    expect(jsonEquals(1, 1)).toBe(true)
    expect(jsonEquals('a', 'a')).toBe(true)
    expect(jsonEquals(true, true)).toBe(true)
    expect(jsonEquals(1, '1')).toBe(false)
    expect(jsonEquals(0, false)).toBe(false)
  })

  it('distingue null de undefined', () => {
    expect(jsonEquals(null, undefined)).toBe(false)
    expect(jsonEquals(null, null)).toBe(true)
    expect(jsonEquals(undefined, undefined)).toBe(true)
  })

  it('compara objetos sin importar el orden de las claves', () => {
    expect(jsonEquals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(jsonEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(jsonEquals({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('compara arrays por posición y longitud', () => {
    expect(jsonEquals([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(jsonEquals([1, 2], [2, 1])).toBe(false)
    expect(jsonEquals([1, 2], [1, 2, 3])).toBe(false)
  })

  it('compara objetos anidados', () => {
    expect(
      jsonEquals(
        { a: { b: [1, { c: 'x' }] } },
        { a: { b: [1, { c: 'x' }] } },
      ),
    ).toBe(true)
    expect(
      jsonEquals(
        { a: { b: [1, { c: 'x' }] } },
        { a: { b: [1, { c: 'y' }] } },
      ),
    ).toBe(false)
  })

  it('no confunde un array con un objeto', () => {
    expect(jsonEquals([], {})).toBe(false)
    expect(jsonEquals([1], { 0: 1 })).toBe(false)
  })

  it('trata NaN como igual a sí mismo', () => {
    expect(jsonEquals(NaN, NaN)).toBe(true)
    expect(jsonEquals(NaN, 1)).toBe(false)
  })
})

describe('stripUndefinedDeep', () => {
  it('quita las claves con undefined', () => {
    const limpio = stripUndefinedDeep({ a: 1, b: undefined })
    expect(limpio).toEqual({ a: 1 })
    expect('b' in limpio).toBe(false)
  })

  it('conserva los null explícitos', () => {
    expect(stripUndefinedDeep({ a: null })).toEqual({ a: null })
  })

  it('entra en objetos anidados', () => {
    const limpio = stripUndefinedDeep({ a: { b: undefined, c: 1 } })
    expect(limpio).toEqual({ a: { c: 1 } })
  })

  it('entra en arrays', () => {
    const limpio = stripUndefinedDeep({ a: [{ b: undefined, c: 2 }] })
    expect(limpio).toEqual({ a: [{ c: 2 }] })
  })

  it('no toca los primitivos', () => {
    expect(stripUndefinedDeep(5)).toBe(5)
    expect(stripUndefinedDeep('x')).toBe('x')
    expect(stripUndefinedDeep(true)).toBe(true)
  })

  it('quita un campo opcional ausente para que el índice sparse no lo indexe', () => {
    // Es el caso real: dos parcelas sin código catastral.
    const sinCodigo = stripUndefinedDeep({ _id: 'a', codigo: undefined, nombre: 'X' })
    expect('codigo' in sinCodigo).toBe(false)
  })
})
