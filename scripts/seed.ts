import { seed } from '../lib/server/bootstrap'
import { closeMongo } from '../lib/server/cosmos'

/**
 * Siembra la base de datos: esquemas de los módulos y el administrador
 * inicial.
 *
 * El administrador se crea solo si hay `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el
 * entorno. Si faltan, los esquemas se siembran igual y el script avisa de
 * cómo crear el primer administrador.
 *
 * Uso:
 *   pnpm seed
 */

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME?.trim()

  if (!email || !password) {
    console.log('Sin ADMIN_EMAIL / ADMIN_PASSWORD: solo se siembran los esquemas.')
    console.log('Para crear el primer administrador, definí esas dos variables y volvé a correr.')
  } else if (password.length < 8) {
    console.error('ADMIN_PASSWORD debe tener al menos 8 caracteres.')
    process.exitCode = 1
    return
  }

  const summary = await seed({
    admin: email && password ? { email, password, name } : undefined,
  })

  console.log(`Esquemas insertados: ${summary.schemasInserted}`)
  console.log(`Esquemas actualizados: ${summary.schemasUpdated}`)
  console.log(`Esquemas preservados (editados por un admin): ${summary.schemasPreserved}`)
  console.log(`Administrador: ${summary.admin}`)
}

main()
  .then(async () => {
    await closeMongo()
    process.exit(process.exitCode ?? 0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
