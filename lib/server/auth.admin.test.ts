import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeSignature } from 'better-auth/crypto'
import { getAuth, resetAuth } from './auth'
import { closeMongo } from './cosmos'
import { resetServerEnvCache } from './env'

/**
 * Autorización de los endpoints del plugin `admin` de Better Auth.
 *
 * Sustituye `internalAdapter` por sesiones en memoria y firma cookies reales
 * para ejercitar el handler HTTP completo sin base de datos. Cubre la matriz
 * del S3: sin sesión 401, encuestador 403, roles desconocidos no administran,
 * `set-role` valida contra el mapa y el registro sigue rechazando `role`.
 */

const ENTORNO_VALIDO = {
  MONGODB_URI: 'mongodb+srv://usuario:clave@cuenta.mongodb.cosmos.azure.com/?ssl=true',
  MONGODB_DB: 'geopin',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'https://geopin.example.com',
}

const BASE = 'https://geopin.example.com/api/auth'
const AHORA = Date.now()

function usuario(id: string, role: string) {
  return {
    id,
    name: `Usuario ${id}`,
    email: `${id}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(AHORA - 86_400_000),
    updatedAt: new Date(AHORA - 86_400_000),
    role,
    banned: false,
    banReason: null,
    banExpires: null,
  }
}

function sesion(duenio: ReturnType<typeof usuario>, token: string) {
  return {
    session: {
      id: `sesion-${duenio.id}`,
      token,
      userId: duenio.id,
      expiresAt: new Date(AHORA + 7 * 86_400_000),
      createdAt: new Date(AHORA - 3_600_000),
      updatedAt: new Date(AHORA - 3_600_000),
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      impersonatedBy: null,
    },
    user: duenio,
  }
}

async function preparar() {
  const ctx = await getAuth().$context
  const admin = usuario('admin-1', 'admin')
  const encuestador = usuario('enc-1', 'encuestador')
  const rolInvalido = usuario('user-1', 'user')
  const sesiones = new Map([
    ['token-admin', sesion(admin, 'token-admin')],
    ['token-enc', sesion(encuestador, 'token-enc')],
    ['token-user', sesion(rolInvalido, 'token-user')],
  ])

  Object.assign(ctx.internalAdapter, {
    findSession: async (token: string) => sesiones.get(token) ?? null,
    findUserById: async (id: string) =>
      [...sesiones.values()].find((s) => s.user.id === id)?.user ?? usuario(id, 'encuestador'),
    listUsers: async () => [admin, encuestador],
    countTotalUsers: async () => 2,
    deleteUserSessions: async () => undefined,
    deleteUser: async () => undefined,
    updateUser: async (id: string, data: Record<string, unknown>) => ({
      ...(sesiones.get('token-enc')?.user ?? encuestador),
      id,
      ...data,
    }),
  })

  const cookie = async (token: string) =>
    `${ctx.authCookies.sessionToken.name}=${token}.${await makeSignature(token, ctx.secret)}`

  const pedir = async (ruta: string, metodo: string, token?: string, cuerpo?: unknown) => {
    const headers: Record<string, string> = {}
    if (token) headers.cookie = await cookie(token)
    if (cuerpo !== undefined) headers['content-type'] = 'application/json'
    return getAuth().handler(
      new Request(`${BASE}${ruta}`, {
        method: metodo,
        headers,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      }),
    )
  }

  return { pedir }
}

describe('plugin admin: autorización de la gestión de usuarios', () => {
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

  it('sin sesión, todos los endpoints de administración responden 401', async () => {
    const { pedir } = await preparar()

    const casos: Array<[string, string, unknown?]> = [
      ['/admin/list-users', 'GET'],
      ['/admin/set-role', 'POST', { userId: 'u-1', role: 'admin' }],
      ['/admin/create-user', 'POST', { name: 'X', email: 'x@example.com', password: '12345678', role: 'admin' }],
      ['/admin/ban-user', 'POST', { userId: 'u-1' }],
      ['/admin/unban-user', 'POST', { userId: 'u-1' }],
      ['/admin/remove-user', 'POST', { userId: 'u-1' }],
    ]

    for (const [ruta, metodo, cuerpo] of casos) {
      const respuesta = await pedir(ruta, metodo, undefined, cuerpo)
      expect(respuesta.status, ruta).toBe(401)
    }
  })

  it('el encuestador recibe 403 en todos los endpoints y el admin opera', async () => {
    const { pedir } = await preparar()

    expect((await pedir('/admin/list-users', 'GET', 'token-enc')).status).toBe(403)
    expect((await pedir('/admin/set-role', 'POST', 'token-enc', { userId: 'u-1', role: 'admin' })).status).toBe(403)
    expect((await pedir('/admin/create-user', 'POST', 'token-enc', { name: 'X', email: 'x@example.com', password: '12345678', role: 'admin' })).status).toBe(403)
    expect((await pedir('/admin/ban-user', 'POST', 'token-enc', { userId: 'u-1' })).status).toBe(403)

    const lista = await pedir('/admin/list-users?limit=50&sortBy=createdAt&sortDirection=desc', 'GET', 'token-admin')
    expect(lista.status).toBe(200)
    expect((await lista.json()).total).toBe(2)

    expect((await pedir('/admin/ban-user', 'POST', 'token-admin', { userId: 'u-1' })).status).toBe(200)
    expect((await pedir('/admin/unban-user', 'POST', 'token-admin', { userId: 'u-1' })).status).toBe(200)
  })

  it('el rol admin del panel no borra ni impersona', async () => {
    const { pedir } = await preparar()

    // `adminPanel` concede solo lo que el panel usa: las rutas de borrar e
    // impersonar existen en la librería, pero la matriz de acceso las deja
    // en 403 incluso para un admin con sesión.
    expect((await pedir('/admin/remove-user', 'POST', 'token-admin', { userId: 'enc-1' })).status).toBe(403)
    expect((await pedir('/admin/impersonate-user', 'POST', 'token-admin', { userId: 'enc-1' })).status).toBe(403)
  })

  it('un rol fuera de USER_ROLES no administra', async () => {
    const { pedir } = await preparar()
    expect((await pedir('/admin/list-users', 'GET', 'token-user')).status).toBe(403)
  })

  it('set-role rechaza roles fuera de USER_ROLES y acepta los del mapa', async () => {
    const { pedir } = await preparar()

    const invalido = await pedir('/admin/set-role', 'POST', 'token-admin', { userId: 'u-1', role: 'superadmin' })
    expect(invalido.status).toBe(400)
    expect((await invalido.json()).code).toBe('YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE')

    expect((await pedir('/admin/set-role', 'POST', 'token-admin', { userId: 'u-1', role: 'admin' })).status).toBe(200)
  })

  it('el registro sigue rechazando role enviado por el cliente', async () => {
    const { pedir } = await preparar()

    for (const role of ['admin', 'encuestador', 'user']) {
      const respuesta = await pedir('/sign-up/email', 'POST', undefined, {
        name: 'Intruso',
        email: 'intruso@example.com',
        password: 'contrasena-larga',
        role,
      })
      expect(respuesta.status).toBe(400)
      expect((await respuesta.json()).code).toBe('FIELD_NOT_ALLOWED')
    }
  })
})
