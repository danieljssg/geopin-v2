'use client'

/**
 * Sesión del cliente de campo.
 *
 * La raíz y el listado son páginas estáticas a propósito: el service worker
 * las precachea y son el shell que arranca sin conexión. Eso impide
 * protegerlas con un guard del servidor, así que la sesión se comprueba del
 * lado del cliente cuando la API responde 401.
 *
 * Un middleware que mirara la cookie sería más rápido, pero tiene un problema
 * peor: si la PWA se instala antes de iniciar sesión, el service worker
 * precachea el HTML de la redirección y el shell queda inutilizable offline.
 */

/** Si la respuesta es 401, manda al login. Devuelve `true` si redirigió. */
export function redirigirSiNoHaySesion(status: number): boolean {
  if (status !== 401) return false

  if (typeof window !== 'undefined') {
    window.location.replace('/login')
  }

  return true
}
