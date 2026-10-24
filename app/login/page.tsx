'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth-client'

/**
 * Inicio de sesión.
 *
 * Es la puerta del panel administrativo. La app de campo también la usa
 * cuando el levantador entra por primera vez en un dispositivo.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setEnviando(true)

    try {
      const { error: authError } = await signIn.email({ email, password })
      if (authError) {
        setError(
          authError.status === 401
            ? 'El correo o la contraseña no son correctos.'
            : (authError.message ?? 'No se pudo iniciar sesión.'),
        )
        return
      }
      router.push('/admin/esquema')
      router.refresh()
    } catch {
      setError('No se pudo contactar al servidor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-slate-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm"
        style={{ border: '1px solid #e2e8f0' }}
      >
        <h1 className="text-lg font-bold text-slate-900">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-500">GeoPin — levantamiento GIS</p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: '#cbd5e1' }}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: '#cbd5e1' }}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-md px-3 py-2 text-sm" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="mt-5 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: '#1e3a5f' }}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
