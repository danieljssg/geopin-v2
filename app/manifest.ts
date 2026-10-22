import type { MetadataRoute } from 'next'

/**
 * Manifiesto de la PWA.
 *
 * `display: "standalone"` hace que la app se abra sin la barra del navegador
 * cuando se la instala desde la pantalla de inicio. En iOS eso requiere
 * que el usuario la agregue a mano desde "Compartir → Agregar a inicio", y
 * es un paso que hay que explicar en el.material de campo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GeoPin — Levantamiento GIS',
    short_name: 'GeoPin',
    description:
      'Registro catastral y de servicios urbanos en campo, con captura offline y sincronización.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#1e3a5f',
    categories: ['productivity', 'utilities', 'navigation'],
    icons: [
      {
        src: '/geopin-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/geopin-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/geopin-icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
