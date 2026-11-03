import { defaultCache } from '@serwist/turbopack/worker'
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from 'serwist'
import { CACHE_TILES_PROPIOS } from '@/lib/map/prefetch'

/// <reference lib="webworker" />

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

/**
 * Service worker de la PWA de campo.
 *
 * Las políticas de cache responden a tres necesidades distintas:
 *
 * 1. **La app se abre sin red.** El shell y los assets de Next.js van
 *    precacheados, y toda navegación que falle cae en la página `/offline`.
 *
 * 2. **Los tiles se ven sin red.** Los tiles ya vistos quedan cacheados. La
 *    descarga del área del levantamiento (T14) los baja del blob storage
 *    propio, que es lo único que la política de OSMF permite precachear.
 *
 * 3. **La sesión nunca se cachea.** `/api/auth` va explícitamente a
 *    `NetworkOnly`: cachear una respuesta de sesión serviría para saltarse
 *    el cierre de sesión y para leakear credenciales al disco.
 */

const CACHE_TILES_TERCEROS = 'geopin-tiles-terceros-v1'
const CACHE_API = 'geopin-api-v1'

/** Dominios de tiles de terceros: se cachean como los permite su política. */
const TERCEROS = ['tile.openstreetmap.org', 'tile.opentopomap.org']

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    /**
     * Autenticación: jamás se cachea.
     *
     * Va primero porque el orden importa: la primera regla que coincide
     * gana, y una sesión cacheada es una sesión que sobrevive al cierre de
     * sesión y una cookie en el disco del dispositivo.
     */
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/auth'),
      handler: new NetworkOnly(),
      method: 'GET',
    },

    /** Authenticated API data is kept in account-scoped IndexedDB/local snapshots,
     * never in a shared service-worker cache that can survive account changes. */
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
      method: 'GET',
    },

    /**
     * Tiles propios: cache primero.
     *
     * El contenido es inmutable por versión, así que nunca hay que
     * revalidarlo. Es lo que hace posible el mapa offline.
     */
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith('/tiles/') && url.pathname.endsWith('.png'),
      handler: new CacheFirst({
        cacheName: CACHE_TILES_PROPIOS,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 4000,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          }),
        ],
      }),
      method: 'GET',
    },

    /**
     * Tiles de terceros: stale while revalidate.
     *
     * La política de OSMF exige cachear según las cabeceras del servidor o
     * al menos 7 días; el TTL de 30 días cumple las dos cosas. Lo que NO se
     * puede hacer es prefetchear un área, y esta regla no precachea nada:
     * solo guarda lo que el surveyor ya está mirando.
     */
    {
      matcher: ({ url }) => TERCEROS.some((domain) => url.hostname.endsWith(domain)),
      handler: new StaleWhileRevalidate({
        cacheName: CACHE_TILES_TERCEROS,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 800,
            maxAgeSeconds: 60 * 60 * 24 * 30,
            maxAgeFrom: 'last-used',
          }),
        ],
      }),
      method: 'GET',
    },

    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()

export { CACHE_API, CACHE_TILES_PROPIOS, CACHE_TILES_TERCEROS }
