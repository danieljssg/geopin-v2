import { describe, expect, it } from 'vitest'
import {
  AuthError,
  ForbiddenError,
  UnauthorizedError,
  authErrorResponse,
} from './session'

describe('errores de autenticación', () => {
  it('UnauthorizedError responde 401', () => {
    const error = new UnauthorizedError()
    expect(error).toBeInstanceOf(AuthError)
    expect(error.status).toBe(401)
  })

  it('ForbiddenError responde 403', () => {
    const error = new ForbiddenError()
    expect(error).toBeInstanceOf(AuthError)
    expect(error.status).toBe(403)
  })
})

describe('authErrorResponse', () => {
  it('convierte un error de auth en una respuesta JSON', async () => {
    const response = authErrorResponse(new ForbiddenError('No autorizado.'))
    expect(response).not.toBeNull()
    expect(response!.status).toBe(403)

    const body = await response!.json()
    expect(body.error).toBe('No autorizado.')
  })

  it('devuelve null para un error que no viene de la autenticación', () => {
    expect(authErrorResponse(new Error('boom'))).toBeNull()
    expect(authErrorResponse('boom')).toBeNull()
    expect(authErrorResponse(undefined)).toBeNull()
  })
})
