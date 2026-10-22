import { getAuth } from './auth'
import { hasPermission, normalizeRole, type Permission, type UserRole } from '@/lib/auth/roles'

/**
 * Lectura de sesión y guardas de permisos.
 *
 * Las funciones reciben las cabeceras explícitamente para no atarlas al
 * App Router: así se pueden probar sin montar una request.
 */

export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
}

export class AuthError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = 'Necesitás iniciar sesión para continuar.') {
    super(message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = 'Tu rol no tiene permiso para esta acción.') {
    super(message, 403)
    this.name = 'ForbiddenError'
  }
}

/** Devuelve el usuario de la sesión, o `null` si no hay sesión válida. */
export async function getSessionUser(requestHeaders: Headers): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: requestHeaders })
  if (!session?.user) return null

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? '',
    role: normalizeRole(session.user.role),
  }
}

/** Exige una sesión. Lanza `UnauthorizedError` si no hay. */
export async function requireSessionUser(requestHeaders: Headers): Promise<SessionUser> {
  const user = await getSessionUser(requestHeaders)
  if (!user) throw new UnauthorizedError()
  return user
}

/** Exige una sesión con un permiso concreto. */
export async function requirePermission(
  requestHeaders: Headers,
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireSessionUser(requestHeaders)
  if (!hasPermission(user.role, permission)) {
    throw new ForbiddenError(`Tu rol (${user.role}) no tiene el permiso ${permission}.`)
  }
  return user
}

/**
 * Traduce un error de autenticación a una respuesta HTTP.
 * Devuelve `null` si el error no viene de la autenticación, para que el
 * llamador pueda propagarlo.
 */
export function authErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AuthError)) return null

  return Response.json(
    { error: error.message },
    { status: error.status },
  )
}
