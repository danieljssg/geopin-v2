/**
 * Acceso al blob storage con los tiles.
 *
 * La app sirve los tiles por su propio origen (`/tiles/{z}/{x}/{y}.png`) en
 * vez de apuntar directo al blob. Dos razones:
 *
 * 1. El service worker cachea por origen: si los tiles vinieran del blob, la
 *    app en producción y la de desarrollo cachearían en cachés distintos.
 * 2. El blob no necesita quedar expuesto: se accede por una SAS con
 *    permisos de lectura, que el servidor usa y el cliente nunca ve.
 */

export interface ConfigBlob {
  /** Base de la SAS del contenedor, con su cadena de consulta. */
  sasUrl: string
}

/** Lee la configuración del blob del entorno. */
export function getConfigBlob(
  source: Record<string, string | undefined> = process.env,
): ConfigBlob | null {
  const sasUrl = source.BLOB_SAS_URL?.trim()
  if (!sasUrl) return null
  return { sasUrl }
}

/**
 * Arma la URL de un blob con la SAS.
 *
 * La ruta va **antes** de la cadena de consulta: la SAS siempre termina con
 * sus parámetros, así que concatenar la ruta al final rompería la firma.
 */
export function urlDeBlob(sasUrl: string, ruta: string): string {
  const [base, consulta] = sasUrl.split('?')
  const limpio = base.replace(/\/$/, '')
  const sufijo = consulta ? `?${consulta}` : ''
  return `${limpio}/${ruta.replace(/^\//, '')}${sufijo}`
}

/**
 * Devuelve la respuesta del blob, o `null` si el objeto no existe.
 *
 * La respuesta viene con la cache del blob, así que el service worker puede
 * cachearla sin inventar una política.
 */
export async function leerBlob(ruta: string): Promise<Response | null> {
  const config = getConfigBlob()
  if (!config) return null

  const respuesta = await fetch(urlDeBlob(config.sasUrl, ruta), {
    headers: { 'x-ms-version': '2021-08-06' },
  })

  if (respuesta.status === 404) return null
  if (!respuesta.ok) {
    throw new Error(`El blob respondió ${respuesta.status} al pedir "${ruta}".`)
  }

  return respuesta
}
