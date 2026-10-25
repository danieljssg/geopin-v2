'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth-client'
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
      const { error: authError, data } = await signIn.email({ email, password })
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
      router.push(data?.user?.role === 'admin' ? '/admin/dashboard' : '/campo')
      router.refresh()
    } catch {
      setError('No se pudo contactar al servidor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>GeoPin — levantamiento GIS</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="username"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={enviando} className="w-full">
              {enviando ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
