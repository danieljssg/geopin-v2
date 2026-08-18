/**
 * THESIS: A local cadastral reading surface, not a generic wall of metrics.
 * OWN-WORLD: Navy civic header, blueprint grid, white data sheets, and existing category colors.
 * STORY: Filter this device's pins, judge coverage, then inspect time and urban composition.
 * FIRST VIEWPORT: Source scope and navigation lead into filters beside an evidence-first report.
 * FORM: Split filter-and-report workspace selected directly for the fixed Operate brief; no concept seed.
 */
import type { Metadata } from 'next'
import DashboardView from '@/components/DashboardView'

export const metadata: Metadata = {
  title: 'Dashboard urbanístico | GeoPin',
  description: 'Análisis local demográfico, territorial y constructivo de los pines guardados en este dispositivo.',
}

export default function DashboardPage() {
  return <DashboardView />
}
