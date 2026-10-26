'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { changePassword, updateUser, useSession } from '@/lib/auth-client'
import { NavBar } from '@/components/NavBar'
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
import { PageHeading } from '@/components/PageHeading'

/**
 * Perfil del usuario.
 *
 * Actualiza los datos que la cuenta permite cambiar sin infraestructura de
 * verificación de correo: el nombre y la contraseña. El rol y el email no se
 * tocan acá — el rol lo gestiona administración (panel de usuarios) y el
 * email requiere verificación, que la plataforma no tiene montada.
 */

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

/**
 * Formulario de nombre. El `key` del uso lo remonta cuando cambia el
 * usuario, así que el valor inicial nace de la sesión sin necesidad de
 * sincronizar estado en un efecto (regla del linter de hooks de React).
 */
function FormularioNombre({ inicial }: { inicial: string }) {
  const router = useRouter()
  const [nombre, setNombre] = useState(inicial)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)

  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    setMensaje(null)
    setEnviando(true)

    // El `required` solo mira el valor crudo: un nombre de puros espacios
    // pasaría y se guardaría vacío.
    const limpio = nombre.trim()
    if (!limpio) {
      setMensaje({ tipo: 'error', texto: 'El nombre no puede quedar vacío.' })
      setEnviando(false)
      return
    }

    try {
      const { error } = await updateUser({ name: limpio })
      if (error) {
        setMensaje({ tipo: 'error', texto: error.message ?? 'No se pudo guardar el nombre.' })
        return
      }
      setMensaje({ tipo: 'ok', texto: 'Nombre actualizado.' })
      router.refresh()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar nombre'}
      </Button>
    </form>
  )
}

function FormularioContrasena() {
  const [contrasenaActual, setContrasenaActual] = useState('')
  const [contrasenaNueva, setContrasenaNueva] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)

  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    setMensaje(null)
    setEnviando(true)

    try {
      const { error } = await changePassword({
        currentPassword: contrasenaActual,
        newPassword: contrasenaNueva,
        // Al cambiar la contraseña se revocan las demás sesiones: es la
        // práctica estándar para expulsar una sesión robada.
        revokeOtherSessions: true,
      })
      if (error) {
        // Better Auth reporta la contraseña actual inválida como 400
        // INVALID_PASSWORD; el 401 queda por si el contrato cambia.
        const contrasenaInvalida =
          error.code === 'INVALID_PASSWORD' || error.status === 400 || error.status === 401
        setMensaje({
          tipo: 'error',
          texto: contrasenaInvalida
            ? 'La contraseña actual no es correcta.'
            : (error.message ?? 'No se pudo cambiar la contraseña.'),
        })
        return
      }
      setMensaje({ tipo: 'ok', texto: 'Contraseña actualizada.' })
      setContrasenaActual('')
      setContrasenaNueva('')
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
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

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  )
}

export default function PerfilPage() {
  const session = useSession()
  const router = useRouter()
  const user = session.data?.user

  useEffect(() => {
    if (!session.isPending && !user) router.replace('/login')
  }, [session.isPending, user, router])

  if (session.isPending || !user) {
    return (
      <main className="bg-muted flex min-h-screen items-center justify-center px-6">
        <Skeleton className="h-64 w-full max-w-md" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-muted">
      <NavBar />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <PageHeading title="Perfil" description="Actualiza los datos de tu cuenta y la contraseña de acceso." />
        <Card className="mx-auto w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Datos de acceso</CardTitle>
            <CardDescription>
              {user.email} · {user.role === 'admin' ? 'Administrador' : 'Encuestador'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <FormularioNombre key={user.id} inicial={user.name ?? ''} />

            <Separator />

            <FormularioContrasena />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
