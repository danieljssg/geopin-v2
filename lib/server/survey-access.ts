import type { SessionUser } from './session'
import type { Filter } from 'mongodb'
import { levantamientosCollection, membershipsCollection, workspacesCollection, type LevantamientoDoc } from './collections'

/** Authorization for surveys, shared by dashboard, list, sync and export handlers. */
export async function accessibleSurvey(user: SessionUser, surveyId: string): Promise<LevantamientoDoc | null> {
  const survey = await levantamientosCollection().findOne({ _id: surveyId })
  if (!survey) return null
  if (user.role === 'admin') return survey
  if (user.role === 'manager') {
    const workspace = await workspacesCollection().findOne({ _id: survey.workspaceId, managerId: user.id, estado: 'activo' })
    return workspace ? survey : null
  }
  if (survey.propietarioId === user.id || survey.creadoPor === user.id) return survey
  if (!survey.workspaceId) return survey // Pre-workspace public surveys remain available to existing surveyors.
  const membership = await membershipsCollection().findOne({
    userId: user.id,
    workspaceId: survey.workspaceId,
    $or: [{ surveyId: survey.id }, { surveyId: { $exists: false } }],
  })
  return membership ? survey : null
}

export async function visibleSurveys(user: SessionUser): Promise<LevantamientoDoc[]> {
  if (user.role === 'admin') return levantamientosCollection().find({}).sort({ creadoEn: -1 }).toArray()
  if (user.role === 'manager') {
    const workspace = await workspacesCollection().findOne({ managerId: user.id, estado: 'activo' })
    return workspace ? levantamientosCollection().find({ workspaceId: workspace.id }).sort({ creadoEn: -1 }).toArray() : []
  }
  const memberships = await membershipsCollection().find({ userId: user.id }).toArray()
  const surveyIds = memberships.flatMap((item) => item.surveyId ? [item.surveyId] : [])
  const workspaceIds = memberships.filter((item) => !item.surveyId).map((item) => item.workspaceId)
  const clauses: Filter<LevantamientoDoc>[] = [
    { workspaceId: { $exists: false } },
    { propietarioId: user.id },
    { creadoPor: user.id },
  ]
  if (surveyIds.length) clauses.push({ _id: { $in: surveyIds } })
  if (workspaceIds.length) clauses.push({ workspaceId: { $in: workspaceIds } })
  return levantamientosCollection().find({ $or: clauses }).sort({ creadoEn: -1 }).toArray()
}
