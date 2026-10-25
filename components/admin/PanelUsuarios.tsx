'use client'

import { useEffect, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/lib/auth-client'
import {
  DEFAULT_ROLE,
  ROLE_LABELS,
  USER_ROLES,
  hasPermission,
  normalizeRole,
  type UserRole,
} from '@/lib/auth/roles'

/**
 * Panel de gestión de usuarios.
 *
 * El cliente de Better Auth (`lib/auth-client.ts`) no declara el plugin
 * `admin`, y ese archivo está fuera de esta unidad. Por eso el panel habla
 * directo con los endpoints del plugin en el mismo origen y con la cookie de
 * sesión (`credentials: 'same-origin'`), que es exactamente el contrato que
 * expone `authClient.admin` pero sin tocar el cliente compartido.
 *
 * La autorización real la hace el servidor: cada endpoint exige sesión y el
 * permiso correspondiente. El chequeo local con `hasPermission` solo evita
 * mostrar acciones que después van a fallar.
 */

const RUTA_ADMIN = '/api/auth/admin'
const LIMITE = 50
const LARGO_MINIMO_CONTRASENA = 8

interface UsuarioAdmin {
  id: string
  name?: string | null
  email: string
  role?: string | null
  banned?: boolean | null
  createdAt?: string | null
}

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

/**
 * La búsqueda del endpoint cubre un solo campo (`searchField`). Se usa el
 * correo porque es el identificador con el que se inicia sesión.
 */
async function pedirUsuarios(opciones: {
  desplazamiento: number
  busqueda: string
}): Promise<{ usuarios?: UsuarioAdmin[]; total?: number; error?: string }> {
  const parametros = new URLSearchParams({
    limit: String(LIMITE),
    offset: String(opciones.desplazamiento),
    sortBy: 'createdAt',
    sortDirection: 'desc',
  })

  const busqueda = opciones.busqueda.trim()
  if (busqueda) {
    parametros.set('searchValue', busqueda)
    parametros.set('searchField', 'email')
    parametros.set('searchOperator', 'contains')
  }

  try {
    const respuesta = await fetch(`${RUTA_ADMIN}/list-users?${parametros.toString()}`, {
      credentials: 'same-origin',
    })

    if (!respuesta.ok) return { error: await leerError(respuesta) }

    const cuerpo = (await respuesta.json()) as {
      users?: UsuarioAdmin[]
      total?: number
    }

    return { usuarios: cuerpo.users ?? [], total: cuerpo.total ?? 0 }
  } catch (caught) {
    return {
      error: caught instanceof Error ? caught.message : 'No se pudo cargar la lista de usuarios.',
    }
  }
}

/** Envía una mutación del plugin y devuelve el mensaje de error, o `null`. */
async function enviarAdmin(ruta: string, cuerpo: Record<string, unknown>): Promise<string | null> {
  try {
    const respuesta = await fetch(`${RUTA_ADMIN}${ruta}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })

    if (!respuesta.ok) return leerError(respuesta)
    return null
  } catch (caught) {
    return caught instanceof Error ? caught.message : 'No se pudo contactar al servidor.'
  }
}

/** Traduce los errores propios del panel; el resto cae en el mensaje del API. */
const MENSAJES_POR_CODIGO: Record<string, string> = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ya existe una cuenta con ese correo.',
  USER_ALREADY_EXISTS: 'Ya existe una cuenta con ese correo.',
  YOU_CANNOT_BAN_YOURSELF: 'No podés suspender tu propia cuenta.',
  YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: 'Ese rol no existe.',
}

/** Better Auth responde `{ message, code }`; se tolera también `{ error }`. */
async function leerError(respuesta: Response): Promise<string> {
  if (respuesta.status === 401) return 'Tu sesión venció. Volvé a iniciar sesión.'
  if (respuesta.status === 403) return 'Tu rol no tiene permiso para esta acción.'

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { message?: string; code?: string; error?: string }
    | null

  if (cuerpo?.code && MENSAJES_POR_CODIGO[cuerpo.code]) return MENSAJES_POR_CODIGO[cuerpo.code]

  return cuerpo?.message ?? cuerpo?.error ?? `El servidor respondió ${respuesta.status}.`
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return '—'

  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? '—' : FORMATO_FECHA.format(fecha)
}

function estadoDe(usuario: UsuarioAdmin): 'activo' | 'suspendido' {
  return usuario.banned ? 'suspendido' : 'activo'
}

export default function PanelUsuarios() {
  const session = useSession()
  const user = session.data?.user
  const puedeGestionar = hasPermission(user?.role, 'usuarios:gestionar')

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [pagina, setPagina] = useState(0)
  const [recarga, setRecarga] = useState(0)

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoPassword, setNuevoPassword] = useState('')
  const [nuevoRol, setNuevoRol] = useState<UserRole>(DEFAULT_ROLE)
  const [creando, setCreando] = useState(false)

  /**
   * La carga aplica el resultado en un `.then()`, no en el cuerpo del efecto:
   * un `setState` síncrono ahí provoca un render en cascada.
   */
  useEffect(() => {
    if (!puedeGestionar) return

    let vivo = true

    void pedirUsuarios({
      desplazamiento: pagina * LIMITE,
      busqueda: busquedaAplicada,
    }).then((resultado) => {
      if (!vivo) return

      if (resultado.error) {
        setError(resultado.error)
        return
      }

      setError(null)
      setUsuarios(resultado.usuarios ?? [])
      setTotal(resultado.total ?? 0)
    })

    return () => {
      vivo = false
    }
  }, [puedeGestionar, pagina, busquedaAplicada, recarga])

  const cargando = usuarios === null && error === null

  function recargar() {
    setRecarga((valor) => valor + 1)
  }

  function buscar(event: React.FormEvent) {
    event.preventDefault()
    setUsuarios(null)
    setError(null)
    setPagina(0)
    setBusquedaAplicada(busqueda.trim())
    setRecarga((valor) => valor + 1)
  }

  function cambiarPagina(destino: number) {
    setUsuarios(null)
    setError(null)
    setPagina(destino)
  }

  async function cambiarRol(usuario: UsuarioAdmin, rol: UserRole) {
    if (rol === normalizeRole(usuario.role)) return

    setMensaje(null)
    setAccionEnCurso(`rol:${usuario.id}`)

    const errorEnvio = await enviarAdmin('/set-role', { userId: usuario.id, role: rol })

    setAccionEnCurso(null)

    if (errorEnvio) {
      setMensaje({ tipo: 'error', texto: errorEnvio })
      return
    }

    setMensaje({
      tipo: 'ok',
      texto: `Rol de ${usuario.email} actualizado a ${ROLE_LABELS[rol]}.`,
    })
    recargar()
  }

  async function alternarSuspension(usuario: UsuarioAdmin) {
    const suspendido = Boolean(usuario.banned)

    if (!suspendido && !confirm(`¿Suspender la cuenta de ${usuario.email}? No podrá iniciar sesión.`)) {
      return
    }

    setMensaje(null)
    setAccionEnCurso(`baneo:${usuario.id}`)

    const errorEnvio = await enviarAdmin(suspendido ? '/unban-user' : '/ban-user', {
      userId: usuario.id,
    })

    setAccionEnCurso(null)

    if (errorEnvio) {
      setMensaje({ tipo: 'error', texto: errorEnvio })
      return
    }

    setMensaje({
      tipo: 'ok',
      texto: suspendido
        ? `Cuenta de ${usuario.email} reactivada.`
        : `Cuenta de ${usuario.email} suspendida.`,
    })
    recargar()
  }

  async function crearUsuario(event: React.FormEvent) {
    event.preventDefault()

    // Cinturón y tirantes: el servidor ya exige el permiso, pero el formulario
    // tampoco debe enviar nada si la sesión dejó de ser administradora.
    if (!puedeGestionar) return

    setMensaje(null)

    if (nuevoPassword.length < LARGO_MINIMO_CONTRASENA) {
      setMensaje({
        tipo: 'error',
        texto: `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
      })
      return
    }

    setCreando(true)

    const errorEnvio = await enviarAdmin('/create-user', {
      name: nuevoNombre.trim(),
      email: nuevoEmail.trim(),
      password: nuevoPassword,
      role: nuevoRol,
    })

    setCreando(false)

    if (errorEnvio) {
      setMensaje({ tipo: 'error', texto: errorEnvio })
      return
    }

    setMensaje({ tipo: 'ok', texto: `Usuario ${nuevoEmail.trim()} creado.` })
    setNuevoNombre('')
    setNuevoEmail('')
    setNuevoPassword('')
    setNuevoRol(DEFAULT_ROLE)
    recargar()
  }

  if (session.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!puedeGestionar) {
    return (
      <p className="text-muted-foreground text-sm">
        Tu rol ({normalizeRole(user?.role)}) no puede gestionar usuarios.
      </p>
    )
  }

  const desde = usuarios && usuarios.length > 0 ? pagina * LIMITE + 1 : 0
  const hasta = usuarios ? pagina * LIMITE + usuarios.length : 0
  const hayAnterior = pagina > 0
  const haySiguiente = (pagina + 1) * LIMITE < total

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cuentas</CardTitle>
          <CardDescription>
            Buscá por correo, cambiá el rol o suspendé el acceso. Los usuarios
            suspendidos no pueden iniciar sesión.
          </CardDescription>
          <CardAction>
            <span className="text-muted-foreground text-xs">{total} en total</span>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-3">
          <form onSubmit={buscar} className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por correo"
              aria-label="Buscar usuarios por correo"
              className="w-full sm:w-64"
            />
            <Button type="submit" variant="outline" size="sm">
              Buscar
            </Button>
            {busquedaAplicada && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBusqueda('')
                  setUsuarios(null)
                  setError(null)
                  setPagina(0)
                  setBusquedaAplicada('')
                  setRecarga((valor) => valor + 1)
                }}
              >
                Limpiar
              </Button>
            )}
          </form>

          {mensaje && (
            <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{mensaje.texto}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {cargando ? (
            <div className="space-y-2" aria-label="Cargando usuarios">
              {Array.from({ length: 5 }, (_, indice) => (
                <Skeleton key={indice} className="h-9 w-full" />
              ))}
            </div>
          ) : usuarios === null ? null : usuarios.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {busquedaAplicada
                ? 'No hay usuarios que coincidan con la búsqueda.'
                : 'Todavía no hay usuarios registrados.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="py-2 pr-3 font-medium">Nombre</th>
                    <th className="py-2 pr-3 font-medium">Correo</th>
                    <th className="py-2 pr-3 font-medium">Rol</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium">Creado</th>
                    <th className="py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(usuarios ?? []).map((usuario) => {
                    const rol = normalizeRole(usuario.role)
                    const estado = estadoDe(usuario)

                    return (
                      <tr key={usuario.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{usuario.name || '—'}</td>
                        <td className="py-2 pr-3">{usuario.email}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={rol === 'admin' ? 'default' : 'outline'}>
                            {ROLE_LABELS[rol]}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={estado === 'activo' ? 'secondary' : 'destructive'}>
                            {estado}
                          </Badge>
                        </td>
                        <td className="text-muted-foreground py-2 pr-3 text-xs">
                          {formatearFecha(usuario.createdAt)}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={rol}
                              onValueChange={(valor) => {
                                void cambiarRol(usuario, normalizeRole(valor))
                              }}
                              disabled={accionEnCurso !== null}
                            >
                              <SelectTrigger
                                size="sm"
                                aria-label={`Rol de ${usuario.email}`}
                                className="w-36"
                              >
                                <SelectValue>
                                  {(valor) => ROLE_LABELS[normalizeRole(valor)]}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {USER_ROLES.map((opcion) => (
                                  <SelectItem key={opcion} value={opcion}>
                                    {ROLE_LABELS[opcion]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Button
                              type="button"
                              size="xs"
                              variant={estado === 'activo' ? 'destructive' : 'outline'}
                              disabled={accionEnCurso !== null}
                              onClick={() => {
                                void alternarSuspension(usuario)
                              }}
                            >
                              {accionEnCurso === `baneo:${usuario.id}`
                                ? 'Guardando…'
                                : estado === 'activo'
                                  ? 'Suspender'
                                  : 'Reactivar'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {usuarios && usuarios.length > 0 && (
          <CardFooter className="justify-between">
            <span className="text-muted-foreground text-xs">
              Mostrando {desde}–{hasta} de {total}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hayAnterior}
                onClick={() => cambiarPagina(pagina - 1)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!haySiguiente}
                onClick={() => cambiarPagina(pagina + 1)}
              >
                Siguiente
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crear usuario</CardTitle>
          <CardDescription>
            La cuenta nace con el rol elegido y la contraseña se puede cambiar
            después desde el perfil.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={crearUsuario} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="usuario-nombre">Nombre</Label>
                <Input
                  id="usuario-nombre"
                  required
                  value={nuevoNombre}
                  onChange={(event) => setNuevoNombre(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usuario-email">Correo</Label>
                <Input
                  id="usuario-email"
                  type="email"
                  required
                  autoComplete="off"
                  value={nuevoEmail}
                  onChange={(event) => setNuevoEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usuario-password">Contraseña</Label>
                <Input
                  id="usuario-password"
                  type="password"
                  required
                  minLength={LARGO_MINIMO_CONTRASENA}
                  autoComplete="new-password"
                  value={nuevoPassword}
                  onChange={(event) => setNuevoPassword(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Mínimo {LARGO_MINIMO_CONTRASENA} caracteres.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="usuario-rol">Rol</Label>
                <Select
                  value={nuevoRol}
                  onValueChange={(valor) => setNuevoRol(normalizeRole(valor))}
                >
                  <SelectTrigger id="usuario-rol" className="w-full">
                    <SelectValue>
                      {(valor) => ROLE_LABELS[normalizeRole(valor)]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((opcion) => (
                      <SelectItem key={opcion} value={opcion}>
                        {ROLE_LABELS[opcion]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={creando}>
              {creando ? 'Creando…' : 'Crear usuario'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
