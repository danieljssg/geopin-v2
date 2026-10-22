import { spawnSync } from 'node:child_process'
import { createSerwistRoute } from '@serwist/turbopack'

/**
 * Sirve el service worker compilado.
 *
 * La revisión hace que el navegador detecte que hay una versión nueva del
 * service worker: sin ella, el navegador seguiría usando el anterior y la
 * app no se actualiza.
 */
const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ||
  crypto.randomUUID()

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: '/offline', revision }],
    swSrc: 'app/sw.ts',
    useNativeEsbuild: true,
  })
