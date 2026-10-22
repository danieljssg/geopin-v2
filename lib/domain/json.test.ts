import { describe, expect, it } from 'vitest'
import { jsonEquals } from './json'

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
