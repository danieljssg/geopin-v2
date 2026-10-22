import { closeMongo } from '../lib/server/cosmos'
import { ensureIndexes, INDEX_SPECS } from '../lib/server/collections'

/**
 * Crea los índices que falten en la base de datos.
 *
 * Los índices se crean uno por uno y los que el motor no soporta se
 * reportan en lugar de cortar el bootstrap: hay dos motores distintos
 * detrás de "Cosmos DB for MongoDB" con capacidades de índice diferentes, y
 * un índice no soportado no debe dejar a la aplicación sin los demás.
 *
 * Uso:
 *   pnpm db:indexes
 */

async function main(): Promise<void> {
  const failures = await ensureIndexes()

  if (failures.length === 0) {
    console.log('Todos los índices quedaron creados o ya existían.')
    return
  }

  console.log(`Índices con problemas (${failures.length}):`)
  for (const failure of failures) {
    console.log(`  - ${failure.collection}.${failure.name}: ${failure.message}`)
  }

  if (failures.length === INDEX_SPECS.length) {
    console.log('Ningún índice se pudo crear: el problema no es de los índices.')
    console.log('Revisá la conectividad con el cluster y las credenciales de la URI.')
  } else {
    console.log('Los índices que sí se pudieron crear quedaron aplicados.')
  }

  process.exitCode = 1
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
