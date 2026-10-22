import { withSerwist } from '@serwist/turbopack'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

/**
 * Envuelve la configuración de Next.js con Serwist.
 *
 * Se usa `@serwist/turbopack` y no `@serwist/next` porque Next 16 hace
 * Turbopack el bundler por defecto, y Turbopack no soporta plugins de
 * webpack — que es exactamente lo que hace el `withSerwist` clásico. Con
 * Turbopack, el service worker se compila con esbuild desde la ruta
 * `app/serwist/[path]/route.ts`.
 */
export default withSerwist(nextConfig)
