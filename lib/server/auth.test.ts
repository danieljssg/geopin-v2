import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { getAuth, resetAuth } from './auth'
import { closeMongo } from './cosmos'
import { resetServerEnvCache } from './env'
import { DEFAULT_ROLE, USER_ROLES, normalizeRole } from '@/lib/auth/roles'

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
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
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

  it('no registra Google sin credenciales', () => {
    expect(getAuth().options.socialProviders?.google).toBeUndefined()
  })

  it('Google usa las credenciales del servidor y asigna el rol mínimo aunque el perfil traiga admin', async () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
    const google = getAuth().options.socialProviders?.google
    expect(google?.clientId).toBe('google-client-id')
    expect(google?.clientSecret).toBe('google-client-secret')
    const mapProfile = google?.mapProfileToUser as (profile: Record<string, unknown>) => unknown
    expect(await mapProfile({ sub: 'google-user', email: 'user@example.com', role: 'admin' }))
      .toEqual({ role: 'encuestador' })
  })

  it('inicia OAuth con Google y construye el callback con BETTER_AUTH_URL', async () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
    const ctx = await getAuth().$context
    // Persistencia de state en memoria: este test no conecta con MongoDB.
    ctx.internalAdapter.createVerificationValue = async (data) => ({
      ...data,
      id: 'oauth-state',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const response = await getAuth().handler(new Request(
      `${ENTORNO_VALIDO.BETTER_AUTH_URL}/api/auth/sign-in/social`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ENTORNO_VALIDO.BETTER_AUTH_URL },
        body: JSON.stringify({ provider: 'google', callbackURL: '/login', errorCallbackURL: '/login?error=google' }),
      },
    ))
    expect(response.status).toBe(200)
    const body = await response.json()
    const url = new URL(body.url)
    expect(url.hostname).toBe('accounts.google.com')
    expect(url.searchParams.get('client_id')).toBe('google-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe(`${ENTORNO_VALIDO.BETTER_AUTH_URL}/api/auth/callback/google`)
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
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

  /**
   * La gestión de usuarios la aporta el plugin `admin`. Estas dos son las
   * condiciones que la hacen segura, y por eso se fijan acá:
   *
   * 1. `adminRoles` define qué rol manda: solo `admin`.
   * 2. `roles` acota los valores que `set-role` y `create-user` aceptan a los
   *    roles de la aplicación. Better Auth rechaza cualquier otro valor con
   *    `YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE` antes de escribir.
   *
   * El campo `role` adicional de arriba no se toca: sigue declarado con el
   * enum y `input: false`. El plugin agrega su propia declaración del mismo
   * campo, también con `input: false`, así que el guard de escalada se
   * mantiene por partida doble.
   */
  it('registra el plugin admin acotado a los roles de la aplicación', () => {
    const auth = getAuth()
    const plugin = auth.options.plugins?.find((candidato) => candidato.id === 'admin')

    expect(plugin).toBeDefined()

    const opciones = (
      plugin as
        | {
            options?: {
              adminRoles?: string | string[]
              defaultRole?: string
              roles?: Record<string, unknown>
            }
          }
        | undefined
    )?.options

    expect(opciones?.adminRoles).toEqual(['admin'])
    expect(opciones?.defaultRole).toBe(DEFAULT_ROLE)
    expect(opciones?.roles).toBeDefined()
    expect(Object.keys(opciones?.roles ?? {}).sort()).toEqual([...USER_ROLES].sort())
    expect(opciones?.roles?.encuestador).toBe(userAc)
    // El rol admin es el acceso reducido del panel: concede lo que la
    // gestión usa y deja fuera borrar e impersonar (y no es `adminAc`, el
    // acceso completo por defecto de la librería).
    const accesoAdmin = opciones?.roles?.admin as { statements: { user: string[] } }
    expect(accesoAdmin.statements.user).toEqual(
      expect.arrayContaining(['create', 'list', 'set-role', 'ban']),
    )
    expect(accesoAdmin.statements.user).not.toContain('delete')
    expect(accesoAdmin.statements.user).not.toContain('impersonate')
  })

  /**
   * El mapa de roles es lo que Better Auth consulta antes de cada acción de
   * administración. El encuestador no autoriza ninguna y el admin autoriza
   * todas: un `set-role`, `ban` o `list-users` con sesión de encuestador
   * termina en 403.
   */
  it('solo el rol admin autoriza las acciones de gestión de usuarios', () => {
    const acciones = { user: ['list', 'set-role', 'create', 'ban'] } as const

    expect(userAc.authorize(acciones).success).toBe(false)
    expect(adminAc.authorize(acciones).success).toBe(true)
  })

  /**
   * Los endpoints de administración no pueden quedar abiertos: sin cookie de
   * sesión responden 401 antes de tocar la base. Se prueban los tres que usa
   * el panel de usuarios.
   */
  it('list-users exige una sesión de administrador', async () => {
    const respuesta = await getAuth().handler(
      new Request('https://geopin.example.com/api/auth/admin/list-users'),
    )

    expect(respuesta.status).toBe(401)
  })

  it('set-role exige una sesión de administrador', async () => {
    const respuesta = await getAuth().handler(
      new Request('https://geopin.example.com/api/auth/admin/set-role', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'usuario-1', role: 'admin' }),
      }),
    )

    expect(respuesta.status).toBe(401)
  })

  it('create-user exige una sesión de administrador', async () => {
    const respuesta = await getAuth().handler(
      new Request('https://geopin.example.com/api/auth/admin/create-user', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Intruso',
          email: 'intruso@example.com',
          password: 'contrasena-larga',
          role: 'admin',
        }),
      }),
    )

    expect(respuesta.status).toBe(401)
  })

  /**
   * El mismo invariante, ahora por el camino real: un cuerpo de registro con
   * `role` no llega ni a la base. Antes del plugin la entrada se ignoraba en
   * silencio; con el plugin se rechaza con 400 (`FIELD_NOT_ALLOWED`), que es
   * más estricto y sigue impidiendo la escalada.
   */
  it('el registro rechaza un rol enviado por el cliente', async () => {
    const respuesta = await getAuth().handler(
      new Request('https://geopin.example.com/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Intruso',
          email: 'intruso@example.com',
          password: 'contrasena-larga',
          role: 'admin',
        }),
      }),
    )

    expect(respuesta.status).toBe(400)
    const cuerpo = (await respuesta.json()) as { code?: string; message?: string }
    expect(cuerpo.code).toBe('FIELD_NOT_ALLOWED')
    expect(cuerpo.message).toMatch(/role/)
  })

  /**
   * Segunda capa, la de lectura: aunque una fila vieja o corrupta tenga un rol
   * fuera del enum, `getSessionUser` lo normaliza al rol de mínimo privilegio.
   * `user` es el rol por defecto de Better Auth y por eso aparece en la lista:
   * nunca debe conceder permisos de administración.
   */
  it('un rol fuera de USER_ROLES cae en el rol de mínimo privilegio', () => {
    for (const rol of ['user', 'superusuario', '', null, undefined, 42]) {
      expect(normalizeRole(rol)).toBe(DEFAULT_ROLE)
      expect(USER_ROLES).toContain(normalizeRole(rol))
    }
  })
})
