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
})

function captureError(fn: () => unknown): Error {
  try {
    fn()
  } catch (error) {
    return error as Error
  }
  throw new Error('Se esperaba un error y no se lanzó ninguno.')
}
