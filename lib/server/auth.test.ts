import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAuth, resetAuth } from './auth'
import { closeMongo } from './cosmos'
import { resetServerEnvCache } from './env'

/**
 * Smoke test de la configuración de Better Auth.
 *
 * No toca la red: `betterAuth()` solo arma el objeto de configuración y el
 * driver de Mongo abre los sockets de forma diferida. Lo que se verifica acá
 * es que la forma de la configuración sea válida —un `input: false` mal
 * puesto, un adaptador con opciones desconocidas o un enum de roles roto
 * fallan en la construcción, no en producción.
 */

const ENTORNO_VALIDO = {
  MONGODB_URI: 'mongodb+srv://usuario:clave@cuenta.mongodb.cosmos.azure.com/?ssl=true',
  MONGODB_DB: 'geopin',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'https://geopin.example.com',
}

describe('getAuth', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    for (const key of Object.keys(ENTORNO_VALIDO)) delete process.env[key]
    Object.assign(process.env, ENTORNO_VALIDO)
    resetServerEnvCache()
    resetAuth()
  })

  afterEach(async () => {
    await closeMongo()
    resetAuth()
    resetServerEnvCache()
    process.env = { ...originalEnv }
  })

  it('se construye sin lanzar con un entorno válido', () => {
    expect(() => getAuth()).not.toThrow()
  })

  it('devuelve la misma instancia en llamadas sucesivas', () => {
    expect(getAuth()).toBe(getAuth())
  })

  it('falla claro si falta el secreto de Better Auth', () => {
    delete process.env.BETTER_AUTH_SECRET
    resetServerEnvCache()
    resetAuth()
    expect(() => getAuth()).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('expone las rutas de signup y de sesión que usa la app', () => {
    const auth = getAuth()
    expect(typeof auth.api.signUpEmail).toBe('function')
    expect(typeof auth.api.getSession).toBe('function')
    expect(typeof auth.api.signInEmail).toBe('function')
    expect(typeof auth.api.signOut).toBe('function')
  })

  /**
   * El invariante de seguridad más importante de toda la T2: el rol no puede
   * entrar por la API. Con `input: false`, el esquema de entrada de Better
   * Auth excluye el campo, así que un body de registro con
   * `role: "admin"` se ignora. Sin esto, cualquiera que se registrara podría
   * quedarse como administrador.
   */
  it('el campo role no acepta entrada desde la API', () => {
    const auth = getAuth()
    const roleField = auth.options.user?.additionalFields?.role

    expect(roleField).toBeDefined()
    expect(roleField?.input).toBe(false)
  })

  it('el rol por defecto es el no-administrador', () => {
    const auth = getAuth()
    const roleField = auth.options.user?.additionalFields?.role

    expect(roleField?.defaultValue).toBe('encuestador')
    expect(roleField?.defaultValue).not.toBe('admin')
  })
})
