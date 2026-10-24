import { describe, expect, it } from 'vitest'
import { EnvError, parseServerEnv } from '@/lib/server/env'

const BASE = {
  MONGODB_URI: 'mongodb+srv://usuario:clave@cuenta.mongodb.cosmos.azure.com/?ssl=true',
  MONGODB_DB: 'geopin',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'https://geopin.example.com',
}

function entorno(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return { ...BASE, ...overrides }
}

describe('parseServerEnv', () => {
  it('acepta un entorno completo', () => {
    const parsed = parseServerEnv(entorno())
    expect(parsed.MONGODB_DB).toBe('geopin')
    expect(parsed.BETTER_AUTH_URL).toBe('https://geopin.example.com')
  })

  it('reporta todas las variables faltantes por nombre', () => {
    const error = captureError(() => parseServerEnv({ MONGODB_DB: 'geopin' }))
    expect(error).toBeInstanceOf(EnvError)
    expect(error.message).toContain('MONGODB_URI')
    expect(error.message).toContain('BETTER_AUTH_SECRET')
    expect(error.message).toContain('BETTER_AUTH_URL')
  })

  it('no filtra el valor del secreto en el mensaje de error', () => {
    const error = captureError(() => parseServerEnv(entorno({ BETTER_AUTH_SECRET: 'corto' })))
    expect(error.message).not.toContain('corto')
    expect(error.message).toContain('BETTER_AUTH_SECRET')
  })

  it('rechaza un secreto más corto de 32 caracteres', () => {
    const error = captureError(() => parseServerEnv(entorno({ BETTER_AUTH_SECRET: 'corto' })))
    expect(error.message).toMatch(/al menos 32/i)
  })

  it('rechaza retryWrites=true porque Cosmos no lo soporta', () => {
    const uri = `${BASE.MONGODB_URI}&retryWrites=true`
    const error = captureError(() => parseServerEnv(entorno({ MONGODB_URI: uri })))
    expect(error.message).toMatch(/retryWrites/i)
  })

  it('rechaza una URI que no es de MongoDB', () => {
    const error = captureError(() =>
      parseServerEnv(entorno({ MONGODB_URI: 'https://ejemplo.com' })),
    )
    expect(error.message).toMatch(/mongodb/i)
  })

  it('rechaza BETTER_AUTH_URL con barra final', () => {
    const error = captureError(() =>
      parseServerEnv(entorno({ BETTER_AUTH_URL: 'https://geopin.example.com/' })),
    )
    expect(error.message).toContain('BETTER_AUTH_URL')
  })

  /**
   * La contraseña de la cuenta de Azure casi seguro trae caracteres
   * especiales, y varios de ellos rompen el parseo de la URI: el `#` abre un
   * fragmento, el `@` confunde el host y la `/` y la `?` cortan la URI.
   */
  it('rechaza una contraseña con caracteres que rompen la URI', () => {
    for (const prohibido of ['#', '@', '/', '?', ' ']) {
      const uri = `mongodb+srv://usuario:${encodeURIComponent('pa' + prohibido + 'ss')}@cuenta.mongodb.cosmos.azure.com/?ssl=true`
      // Se simula el caso real: la contraseña pegada sin codificar.
      const sinCodificar = `mongodb+srv://usuario:pa${prohibido}ss@cuenta.mongodb.cosmos.azure.com/?ssl=true`
      const error = captureError(() =>
        parseServerEnv(entorno({ MONGODB_URI: prohibido === ' ' ? sinCodificar : sinCodificar })),
      )
      expect(error.message, `debería rechazar ${prohibido}`).toMatch(/codific/i)
      expect(uri).toContain('mongodb+srv://')
    }
  })

  it('acepta una contraseña percent-encoded', () => {
    const uri =
      'mongodb+srv://usuario:pa%23ss%40word@cuenta.mongodb.cosmos.azure.com/?ssl=true'
    const parsed = parseServerEnv(entorno({ MONGODB_URI: uri }))
    expect(parsed.MONGODB_URI).toBe(uri)
  })

  it('acepta una contraseña con caracteres seguros', () => {
    const uri = 'mongodb+srv://usuario:ClaveSegura2026@cuenta.mongodb.cosmos.azure.com/?ssl=true'
    expect(() => parseServerEnv(entorno({ MONGODB_URI: uri }))).not.toThrow()
  })
})

function captureError(fn: () => unknown): Error {
  try {
    fn()
  } catch (error) {
    return error as Error
  }
  throw new Error('Se esperaba un error y no se lanzó ninguno.')
}

describe('el $ de las contraseñas', () => {
  it('rechaza un $ sin codificar', () => {
    const uri = 'mongodb+srv://usuario:Clave$ConSimbolo@cuenta.mongodb.cosmos.azure.com/?ssl=true'
    const error = captureError(() => parseServerEnv(entorno({ MONGODB_URI: uri })))
    expect(error.message).toMatch(/expande/i)
    expect(error.message).toContain('%24')
  })

  it('acepta el $ percent-encoded', () => {
    const uri = 'mongodb+srv://usuario:Clave%24ConSimbolo@cuenta.mongodb.cosmos.azure.com/?ssl=true'
    expect(() => parseServerEnv(entorno({ MONGODB_URI: uri }))).not.toThrow()
  })

  it('no confunde el $ de otra parte de la URI', () => {
    const uri = 'mongodb+srv://usuario:ClaveSegura@cuenta.mongodb.cosmos.azure.com/?ssl=true&appName=$APP'
    expect(() => parseServerEnv(entorno({ MONGODB_URI: uri }))).not.toThrow()
  })
})
