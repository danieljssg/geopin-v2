'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { changePassword, updateUser, useSession } from '@/lib/auth-client'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Perfil del usuario.
 *
 * Actualiza los datos que la cuenta permite cambiar sin infraestructura de
 * verificación de correo: el nombre y la contraseña. El rol y el email no se
 * tocan acá — el rol lo gestiona administración (panel de usuarios) y el
 * email require verificación, que la plataforma no tiene montada.
 */

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

export default function PerfilPage() {
  const session = useSession()
  const router = useRouter()
  const user = session.data?.user

  const [nombre, setNombre] = useState('')
  const [nombreEnviando, setNombreEnviando] = useState(false)
  const [mensajeNombre, setMensajeNombre] = useState<Mensaje>(null)

  const [contrasenaActual, setContrasenaActual] = useState('')
  const [contrasenaNueva, setContrasenaNueva] = useState('')
  const [contrasenaEnviando, setContrasenaEnviando] = useState(false)
  const [mensajeContrasena, setMensajeContrasena] = useState<Mensaje>(null)

  useEffect(() => {
    if (!session.isPending && !user) router.replace('/login')
  }, [session.isPending, user, router])

  useEffect(() => {
    if (user) setNombre(user.name ?? '')
  }, [user])

  async function guardarNombre(event: React.FormEvent) {
    event.preventDefault()
    setMensajeNombre(null)
    setNombreEnviando(true)

    try {
      const { error } = await updateUser({ name: nombre.trim() })
      if (error) {
        setMensajeNombre({ tipo: 'error', texto: error.message ?? 'No se pudo guardar el nombre.' })
        return
      }
      setMensajeNombre({ tipo: 'ok', texto: 'Nombre actualizado.' })
      router.refresh()
    } catch {
      setMensajeNombre({ tipo: 'error', texto: 'No se pudo contactar al servidor.' })
    } finally {
      setNombreEnviando(false)
    }
  }

  async function guardarContrasena(event: React.FormEvent) {
    event.preventDefault()
    setMensajeContrasena(null)
    setContrasenaEnviando(true)

    try {
      const { error } = await changePassword({
        currentPassword: contrasenaActual,
        newPassword: contrasenaNueva,
        revokeOtherSessions: false,
      })
      if (error) {
        setMensajeContrasena({
          tipo: 'error',
          texto:
            error.status === 401
              ? 'La contraseña actual no es correcta.'
              : (error.message ?? 'No se pudo cambiar la contraseña.'),
        })
        return
      }
      setMensajeContrasena({ tipo: 'ok', texto: 'Contraseña actualizada.' })
      setContrasenaActual('')
      setContrasenaNueva('')
    } catch {
      setMensajeContrasena({ tipo: 'error', texto: 'No se pudo contactar al servidor.' })
    } finally {
      setContrasenaEnviando(false)
    }
  }

  if (session.isPending || !user) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center px-6">
        <Skeleton className="h-64 w-full max-w-md" />
      </main>
    )
  }

  return (
    <main className="bg-background flex min-h-screen items-start justify-center px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>
            {user.email} · {user.role === 'admin' ? 'Administrador' : 'Encuestador'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={guardarNombre} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            {mensajeNombre && (
              <Alert variant={mensajeNombre.tipo === 'error' ? 'destructive' : 'default'}>
                <AlertDescription>{mensajeNombre.texto}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={nombreEnviando}>
              {nombreEnviando ? 'Guardando…' : 'Guardar nombre'}
            </Button>
          </form>

          <Separator />

          <form onSubmit={guardarContrasena} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="contrasena-actual">Contraseña actual</Label>
              <Input
                id="contrasena-actual"
                type="password"
                required
                autoComplete="current-password"
                value={contrasenaActual}
                onChange={(e) => setContrasenaActual(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrasena-nueva">Contraseña nueva</Label>
              <Input
                id="contrasena-nueva"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={contrasenaNueva}
                onChange={(e) => setContrasenaNueva(e.target.value)}
              />
            </div>

            {mensajeContrasena && (
              <Alert variant={mensajeContrasena.tipo === 'error' ? 'destructive' : 'default'}>
                <AlertDescription>{mensajeContrasena.texto}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={contrasenaEnviando}>
              {contrasenaEnviando ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
