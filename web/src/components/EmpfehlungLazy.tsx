import { Suspense } from 'react'
import type { Dataset } from '../lib/data.ts'
import { lazyMitRueckfall } from './lazy-mit-rueckfall.tsx'

/** „Entdecken“ ist ein eigener Chunk und lädt erst auf `#/entdecken` (Start-Budget). */
const EmpfehlungView = lazyMitRueckfall<{ data: Dataset }>(() => import('./empfehlung/EmpfehlungView.tsx'), (m) => m.default)

export function EmpfehlungLazy({ data }: { data: Dataset }) {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-ak-grund" aria-hidden />}>
      <EmpfehlungView data={data} />
    </Suspense>
  )
}
