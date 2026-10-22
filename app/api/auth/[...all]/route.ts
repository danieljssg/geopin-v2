import { toNextJsHandler } from 'better-auth/next-js'
import { getAuth } from '@/lib/server/auth'

/**
 * Rutas de autenticación de Better Auth.
 *
 * El handler se construye de forma perezosa para que importar este módulo no
 * exija tener el entorno configurado.
 */

export const dynamic = 'force-dynamic'

type AuthHandler = ReturnType<typeof toNextJsHandler>

let handler: AuthHandler | null = null

function getHandler(): AuthHandler {
  if (!handler) handler = toNextJsHandler(getAuth())
  return handler
}

export async function GET(request: Request): Promise<Response> {
  return getHandler().GET(request)
}

export async function POST(request: Request): Promise<Response> {
  return getHandler().POST(request)
}
