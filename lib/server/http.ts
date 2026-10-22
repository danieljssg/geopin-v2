import { AuthError } from './session'

/**
 * Utilidades de respuesta para los route handlers.
 *
 * `apiRoute` es el wrapper que usan todas las rutas: traduce los errores de
 * autenticación a su código HTTP y deja que cualquier otro error se registre
 * y se devuelva como 500 sin filtrar detalles.
 */

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status })
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export function handleApiError(error: unknown): Response {
  if (error instanceof AuthError) {
    return jsonError(error.message, error.status)
  }

  console.error('[api] error no controlado:', error)
  return jsonError('Error interno del servidor.', 500)
}

/** Envuelve un handler y convierte las excepciones en respuestas HTTP. */
export async function apiRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    return handleApiError(error)
  }
}

/** Lee el cuerpo JSON de la petición. Lanza un error de cliente si no es JSON. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new RequestError('El cuerpo de la petición debe ser JSON válido.', 400)
  }
}

/** Error con código HTTP asociado. */
export class RequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'RequestError'
    this.status = status
  }
}

export function isRequestError(error: unknown): error is RequestError {
  return error instanceof RequestError
}
