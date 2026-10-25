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
    // La PWA instalada abre la app de campo, no la landing: es la herramienta
    // que usan a diario los levantadores.
    start_url: '/campo',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Colores tomados de los tokens de app/globals.css (--background y
    // --primary): el manifiesto necesita literales, no pueden referenciar
    // variables CSS.
    background_color: 'oklch(1 0 0)',
    theme_color: 'oklch(0.6716 0.1368 48.5130)',
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
