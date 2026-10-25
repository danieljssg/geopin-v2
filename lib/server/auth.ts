import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { admin } from 'better-auth/plugins'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { getMongoClient } from './cosmos'
import { getServerEnv } from './env'
import { DEFAULT_ROLE, USER_ROLES } from '@/lib/auth/roles'

/**
 * Instancia de Better Auth sobre Cosmos DB for MongoDB.
 *
 * Se crea de forma perezosa: leer el entorno al importar el módulo haría que
 * cualquier import accidental —incluso desde el lado del cliente— reventara
 * en el arranque antes de tener un mensaje útil.
 */

let instance: AuthInstance | null = null

export function getAuth(): AuthInstance {
  if (!instance) instance = createAuth()
  return instance
}

export type AuthInstance = ReturnType<typeof createAuth>

function createAuth() {
  const env = getServerEnv()
  const client = getMongoClient()

  return betterAuth({
    appName: 'GeoPin',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(client.db(env.MONGODB_DB), {
      client,
      /**
       * CRÍTICO para Cosmos DB for MongoDB.
       *
       * El adaptador de Better Auth envuelve la creación de usuario y la de
       * sesión en una transacción cuando recibe el cliente. En Cosmos esas
       * transacciones solo son válidas dentro de una única partición, y
       * `user` y `session` viven en particiones distintas: la operación
       * fallaría en cada registro. Con `transaction: false` el adaptador
       * hace las escrituras por separado, que es lo que Cosmos necesita.
       */
      transaction: false,
      usePlural: false,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    user: {
      additionalFields: {
        /**
         * `input: false` es la garantía de seguridad: sin esto, cualquiera
         * que se registre podría enviar `role: "admin"` en el cuerpo del
         * signup y quedarse como administrador.
         */
        role: {
          type: [...USER_ROLES],
          required: false,
          defaultValue: DEFAULT_ROLE,
          input: false,
        },
      },
    },
    session: {
      // Siete días: un levantador puede estar varios días sin abrir la app.
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    /**
     * Gestión de usuarios (`/admin/list-users`, `set-role`, `ban-user`, …).
     *
     * `adminRoles` acota quién manda: solo el rol `admin`. `roles` acota qué
     * valores puede escribir `set-role`/`create-user`: Better Auth los valida
     * contra este mapa y rechaza con 400 cualquier rol fuera de USER_ROLES
     * (`user`, basura) en vez de guardarlo. `userAc` no concede ningún
     * permiso del plugin, así que el encuestador no administra usuarios.
     * `defaultRole` repite el nacimiento no-administrador del campo de abajo.
     */
    plugins: [
      admin({
        adminRoles: ['admin'],
        defaultRole: DEFAULT_ROLE,
        roles: { encuestador: userAc, admin: adminAc },
      }),
    ],
  })
}

/** Descarta la instancia cacheada. Solo para tests. */
export function resetAuth(): void {
  instance = null
}
