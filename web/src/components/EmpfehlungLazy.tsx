import { lazy, Suspense } from 'react'
import type { Dataset } from '../lib/data.ts'

/** „Was gucken?“ ist ein eigener Chunk und lädt erst auf `#/empfehlung` (Start-Budget). */
const EmpfehlungView = lazy(() => import('./empfehlung/EmpfehlungView.tsx'))

export function EmpfehlungLazy({ data }: { data: Dataset }) {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-ak-grund" aria-hidden />}>
      <EmpfehlungView data={data} />
    </Suspense>
  )
}
