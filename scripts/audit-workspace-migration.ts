import { closeMongo, getDb } from '../lib/server/cosmos'

/** Read-only reconciliation report before workspace rollout. It deliberately makes no inferred ownership or data changes. */
async function main() {
  const db = getDb()
  const [records, surveys, users] = await Promise.all([
    db.collection('parcelas'),
    db.collection('levantamientos'),
    db.collection('user'),
  ])
  const report = {
    records: {
      total: await records.countDocuments({}),
      missingCreator: await records.countDocuments({ $or: [{ creadoPor: { $exists: false } }, { creadoPor: '' }] }),
      missingSurvey: await records.countDocuments({ $or: [{ levantamientoId: { $exists: false } }, { levantamientoId: '' }] }),
      withAreaM2: await records.countDocuments({ areaM2: { $type: 'number' } }),
      withLegacyAreaFields: await records.countDocuments({ $or: [{ 'modulos.edificacion.datos.hectareas_parcela': { $exists: true } }, { 'modulos.edificacion.datos.metros_cuadrados_parcela': { $exists: true } }] }),
    },
    surveys: {
      total: await surveys.countDocuments({}),
      withoutWorkspace: await surveys.countDocuments({ workspaceId: { $exists: false } }),
      withoutOwner: await surveys.countDocuments({ $or: [{ creadoPor: { $exists: false } }, { creadoPor: '' }] }),
    },
    users: { total: await users.countDocuments({}), managerRole: await users.countDocuments({ role: 'manager' }) },
    note: 'Read-only report. Resolve ambiguous creator, survey, and area-unit mappings before running any write migration.',
  }
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}).finally(async () => closeMongo())
