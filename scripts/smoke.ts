/**
 * Smoke test contra una instancia en marcha.
 *
 * Comprueba lo que ni el build ni los tests unitarios pueden: que las rutas
 * respondan lo que tienen que responder, que el login funcione contra la
 * base de datos real y que las APIs exijan sesión.
 *
 * Sirve después de cada despliegue.
 *
 * Uso:
 *   SMOKE_URL=https://geopin.example.com \
 *   ADMIN_EMAIL=admin@example.com \
 *   ADMIN_PASSWORD=... \
 *   pnpm smoke
 */

const BASE = (process.env.SMOKE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD

let fallos = 0

function verificar(descripcion: string, condicion: boolean, detalle?: unknown): void {
  if (condicion) {
    console.log(`  ✓ ${descripcion}`)
    return
  }
  fallos += 1
  console.log(`  ✗ ${descripcion}${detalle === undefined ? '' : ` → ${JSON.stringify(detalle)}`}`)
}

async function estado(ruta: string, cookie?: string): Promise<number> {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    redirect: 'manual',
    headers: cookie ? { cookie } : undefined,
  })
  return respuesta.status
}

async function main(): Promise<void> {
  console.log(`Smoke test contra ${BASE}`)

  console.log('\nSin sesión')
  verificar('la raíz responde', (await estado('/')) === 200)
  verificar('la página de login responde', (await estado('/login')) === 200)
  verificar('la página offline responde (la precachea el service worker)', (await estado('/offline')) === 200)
  verificar('el manifiesto de la PWA responde', (await estado('/manifest.webmanifest')) === 200)
  verificar('el service worker responde', (await estado('/serwist/sw.js')) === 200)

  verificar('la API rechaza sin sesión', (await estado('/api/parcelas')) === 401)
  verificar('la API de dashboard rechaza sin sesión', (await estado('/api/dashboard')) === 401)
  verificar('la API de export rechaza sin sesión', (await estado('/api/export?format=geojson')) === 401)

  console.log('\nRutas que redirigen')
  for (const ruta of ['/campo', '/campo/lista', '/dashboard']) {
    const codigo = await estado(ruta)
    verificar(`${ruta} redirige`, codigo === 307 || codigo === 308, codigo)
  }

  console.log('\nCon sesión')

  if (!EMAIL || !PASSWORD) {
    console.log('  (se omite: faltan ADMIN_EMAIL y ADMIN_PASSWORD)')
    console.log(`\n${fallos} verificación(es) fallaron.`)
    process.exit(fallos > 0 ? 1 : 0)
  }

  // El `Origin` es obligatorio: Better Auth rechaza un POST de login sin
  // origen, que es la protección contra CSRF. Un navegador siempre lo manda.
  const login = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: BASE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })

  verificar('el login funciona', login.status === 200, login.status)

  if (login.status !== 200) {
    const cuerpo = await login.text().catch(() => '')
    if (cuerpo.includes('INVALID_ORIGIN')) {
      console.log('')
      console.log('  El servidor rechazó el origen del login. Better Auth solo confía')
      console.log(`  en BETTER_AUTH_URL: SMOKE_URL (${BASE}) tiene que coincidir con esa`)
      console.log('  variable, o el login va a fallar también en el navegador.')
    }

    console.log(`\n${fallos} verificación(es) fallaron.`)
    process.exit(1)
  }

  const cookie = login.headers
    .getSetCookie()
    .map((valor) => valor.split(';')[0])
    .join('; ')

  for (const ruta of ['/', '/login', '/listado', '/admin/esquema', '/admin/dashboard', '/admin/importar']) {
    verificar(`${ruta} responde`, (await estado(ruta, cookie)) === 200)
  }

  for (const ruta of ['/api/parcelas', '/api/capas', '/api/dashboard', '/api/esquemas', '/api/levantamientos']) {
    verificar(`${ruta} responde`, (await estado(ruta, cookie)) === 200)
  }

  for (const formato of ['geojson', 'csv', 'xlsx', 'shp']) {
    verificar(
      `el export ${formato.toUpperCase()} responde`,
      (await estado(`/api/export?format=${formato}`, cookie)) === 200,
    )
  }

  console.log(`\n${fallos === 0 ? 'Todas las verificaciones pasaron.' : `${fallos} verificación(es) fallaron.`}`)
  process.exit(fallos > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
