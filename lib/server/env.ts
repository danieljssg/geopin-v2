/**
 * Validación de las variables de entorno del servidor.
 *
 * Vive bajo `lib/server/` para que un import accidental desde un componente
 * cliente falle en build en lugar de filtrar un secreto al bundle.
 */

export interface ServerEnv {
  /** URI de MongoDB. En Cosmos DB for MongoDB tiene forma `mongodb+srv://...`. */
  MONGODB_URI: string
  /** Nombre de la base de datos dentro de la cuenta de Cosmos. */
  MONGODB_DB: string
  /** Secreto de Better Auth. Mínimo 32 caracteres. */
  BETTER_AUTH_SECRET: string
  /** Origen público de la aplicación, sin barra final. */
  BETTER_AUTH_URL: string
}

export class EnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvError'
  }
}

const REQUIRED_KEYS = [
  'MONGODB_URI',
  'MONGODB_DB',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
] as const

const MIN_SECRET_LENGTH = 32

/**
 * Valida y normaliza el entorno del servidor.
 *
 * Lanza `EnvError` con un mensaje accionable. Nunca registra el valor de los
 * secretos: solo el nombre de la variable que falta.
 */
export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const missing: string[] = []

  for (const key of REQUIRED_KEYS) {
    const value = source[key]
    if (typeof value !== 'string' || value.trim() === '') missing.push(key)
  }

  if (missing.length > 0) {
    throw new EnvError(
      `Faltan variables de entorno del servidor: ${missing.join(', ')}. ` +
        'Revisá el archivo .env.local o la configuración del despliegue.',
    )
  }

  const uri = source.MONGODB_URI!.trim()
  const db = source.MONGODB_DB!.trim()
  const secret = source.BETTER_AUTH_SECRET!.trim()
  const url = source.BETTER_AUTH_URL!.trim()

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new EnvError(
      `BETTER_AUTH_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres ` +
        `(tiene ${secret.length}).`,
    )
  }

  if (url.endsWith('/')) {
    throw new EnvError('BETTER_AUTH_URL no debe terminar en "/".')
  }

  validateCosmosUri(uri)

  return {
    MONGODB_URI: uri,
    MONGODB_DB: db,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: url,
  }
}

/**
 * Cosmos DB for MongoDB no implementa los reintentos de escritura del
 * driver de MongoDB. Dejarlos activados hace fallar la escritura con un
 * error que no dice nada sobre la causa real, así que se falla temprano y
 * con un mensaje que sí lo dice.
 */
function validateCosmosUri(uri: string): void {
  if (/[?&]retrywrites=true/i.test(uri)) {
    throw new EnvError(
      'MONGODB_URI no debe incluir retryWrites=true: Cosmos DB for MongoDB no ' +
        'soporta los reintentos de escritura del driver de MongoDB.',
    )
  }

  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new EnvError('MONGODB_URI debe empezar por "mongodb://" o "mongodb+srv://".')
  }
}

let cached: ServerEnv | null = null

/** Devuelve el entorno validado, cacheándolo tras la primera lectura. */
export function getServerEnv(): ServerEnv {
  if (!cached) cached = parseServerEnv()
  return cached
}

/** Limpia la cache. Solo para tests. */
export function resetServerEnvCache(): void {
  cached = null
}
