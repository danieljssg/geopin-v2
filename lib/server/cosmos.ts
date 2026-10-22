import { MongoClient, type Db } from 'mongodb'
import { getServerEnv } from './env'

/**
 * Cliente de MongoDB contra Azure Cosmos DB for MongoDB.
 *
 * El cliente se cachea en `globalThis` para que el hot reload de Next.js no
 * abra una conexión nueva en cada recompilación — en desarrollo eso agota
 * los sockets de la cuenta de Cosmos.
 */

const GLOBAL_KEY = '__geopinMongoClient'

interface GlobalWithMongo {
  [GLOBAL_KEY]?: MongoClient
}

const globalRef = globalThis as typeof globalThis & GlobalWithMongo

export function getMongoClient(): MongoClient {
  if (!globalRef[GLOBAL_KEY]) {
    const env = getServerEnv()
    const client = new MongoClient(env.MONGODB_URI, {
      // Cosmos no implementa los reintentos de escritura de MongoDB.
      retryWrites: false,
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    })
    globalRef[GLOBAL_KEY] = client
  }
  return globalRef[GLOBAL_KEY]!
}

export function getDb(): Db {
  const env = getServerEnv()
  return getMongoClient().db(env.MONGODB_DB)
}

/**
 * Abre la conexión y la deja lista. Idempotente.
 *
 * La operación de red real ocurre en el primer comando; esto solo abre el
 * pool y resuelve el topología inicial.
 */
export async function connectToCosmos(): Promise<Db> {
  const client = getMongoClient()
  await client.connect()
  return client.db(getServerEnv().MONGODB_DB)
}

/** Cierra el cliente. Solo para tests y para apagados limpios. */
export async function closeMongo(): Promise<void> {
  const client = globalRef[GLOBAL_KEY]
  if (!client) return
  await client.close()
  delete globalRef[GLOBAL_KEY]
}

/**
 * Traduce un error del driver a un mensaje accionable.
 *
 * El error crudo del driver es un volcado de veinte líneas que no dice qué
 * hacer. Estas son las dos causas que se van a encontrar siempre: la red no
 * llega al cluster, o el cluster rechazó las credenciales.
 */
export function describeCosmosError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/Server selection timed out/i.test(message)) {
    return (
      'No se pudo alcanzar el cluster: el servidor selectó por timeout. ' +
      'Revisá la conectividad, las reglas de firewall del cluster y que la ' +
      'URI apunte al cluster correcto.'
    )
  }

  if (/Authentication failed|Unauthorized/i.test(message)) {
    return (
      'El cluster rechazó las credenciales de MONGODB_URI. Revisá el usuario, ' +
      'la contraseña (percent-encoded) y que el usuario tenga permisos sobre la base.'
    )
  }

  if (/MongoParseError/i.test(message)) {
    return (
      'La URI de MongoDB no se pudo parsear. Si la contraseña trae símbolos, ' +
      'codificala con encodeURIComponent.'
    )
  }

  return message
}
