'use client'

import { NavBar } from '@/components/NavBar'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signUp } from '@/lib/auth-client'
import { RedirigirSiSesion } from '@/components/auth/RedirigirSiSesion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Inicio de sesión.
 *
 * Es la puerta del panel administrativo. La app de campo también la usa
 * cuando el levantador entra por primera vez en un dispositivo.
 */
export default function LoginPage() {
  return <Suspense fallback={<p className="p-6" role="status">Cargando acceso…</p>}><LoginForm /></Suspense>
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invite = searchParams.get('invite')
  const postAuthUrl = invite ? `/join?invite=${encodeURIComponent(invite)}` : undefined
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [googleEnviando, setGoogleEnviando] = useState(false)

  const visibleError = error ?? (searchParams.has('error')
    ? 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.'
    : null)

  async function entrarConGoogle() {
    setError(null)
    setGoogleEnviando(true)
    try {
      const { error: authError } = await signIn.social({
        provider: 'google',
        // El login resuelve la sesión y redirige según el rol existente.
        callbackURL: postAuthUrl ?? '/login',
        errorCallbackURL: '/login?error=google',
      })
      if (authError) {
        setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo o usa tu correo y contraseña.')
        setGoogleEnviando(false)
      }
    } catch {
      setError('No se pudo contactar al servidor.')
      setGoogleEnviando(false)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setEnviando(true)

    try {
      const result = registrando
        ? await signUp.email({ email, password, name, callbackURL: postAuthUrl ?? '/campo' })
        : await signIn.email({ email, password })
      const { error: authError, data } = result
      if (authError) {
        setError(
          authError.status === 401
            ? 'El correo o la contraseña no son correctos.'
            : (authError.message ?? 'No se pudo iniciar sesión.'),
        )
        return
      }
      // Cada rol aterriza en su herramienta: el encuestador va a capturar y
      // el admin al panel. Aterrizar siempre en /admin/esquema le mostraba
      // "Sin permiso" al encuestador.
      router.push(postAuthUrl ?? (data?.user?.role === 'admin' ? '/admin/dashboard' : '/campo'))
      router.refresh()
    } catch {
      setError('No se pudo contactar al servidor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-background"><NavBar /><main className="login-panel flex min-h-[calc(100dvh-65px)] items-center justify-center px-6 py-12">
      {/* Quien ya tiene sesión no necesita el formulario: al app por rol. */}
      <RedirigirSiSesion destino="/campo" destinoAdmin="/admin/dashboard" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{registrando ? 'Crear cuenta de encuestador' : 'Iniciar sesión'}</CardTitle>
          <CardDescription>GeoPin — levantamiento GIS</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {registrando && <div className="space-y-2"><Label htmlFor="name">Nombre</Label><Input id="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>}
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete={registrando ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {visibleError && (
              <Alert variant="destructive">
                <AlertDescription>{visibleError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={enviando || googleEnviando} className="w-full">
              {enviando ? 'Procesando…' : registrando ? 'Crear cuenta' : 'Entrar'}
            </Button>
          </form>
          <Button type="button" variant="link" className="mt-2 w-full" onClick={() => { setRegistrando((v) => !v); setError(null) }}>
            {registrando ? 'Ya tengo cuenta' : 'Crear cuenta con correo y contraseña'}
          </Button>
          <div className="mt-4 space-y-3">
            <p className="text-center text-sm text-muted-foreground">O continúa con</p>
            <Button type="button" variant="outline" className="w-full"
              disabled={enviando || googleEnviando} onClick={entrarConGoogle}>
              {googleEnviando ? 'Conectando con Google…' : 'Continuar con Google'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main></div>
  )
}
