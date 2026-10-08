import type { ReactNode } from 'react'
import { useLang } from '../lib/i18n.tsx'

/**
 * Vorschau `startgeruest`: Kopf und Navigation stehen sofort, darunter ein Wochen-Skelett statt eines
 * Spinners. Raster und Kartenform (2/3) sind die der echten Woche, damit beim Füllen nichts springt.
 */
const KARTEN_PRO_TAG = [2, 2, 1]

function SkelettTag({ karten }: { karten: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-ak-linie py-5 lg:grid-cols-[110px_minmax(0,1fr)] lg:py-6">
      <div className="flex items-baseline gap-3 lg:flex-col lg:items-start lg:gap-1">
        <span className="h-8 w-8 rounded bg-ak-flaeche-2 lg:h-11 lg:w-11" />
        <span className="h-3 w-16 rounded bg-ak-flaeche-2" />
      </div>
      <div className="grid grid-cols-2 content-start gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(128px,1fr))] sm:gap-x-3.5 lg:min-h-[250px]">
        {Array.from({ length: karten }, (_, i) => (
          <div key={i} className="aspect-[2/3] rounded-xl bg-ak-flaeche-2" />
        ))}
      </div>
    </div>
  )
}

/** Das Wochen-Skelett: Titelzeile und drei Tage. */
export function WochenSkelett() {
  const { t } = useLang()
  return (
    <div className="min-h-[100svh] animate-pulse motion-reduce:animate-none" role="status" aria-label={t('app.loading')}>
      <div className="mb-4 h-7 w-40 rounded bg-ak-flaeche-2" />
      {KARTEN_PRO_TAG.map((n, i) => (
        <SkelettTag key={i} karten={n} />
      ))}
    </div>
  )
}

/** Der Rumpf der Seite, solange die Daten laden. `kopf` ist der echte Header samt Navigation. */
export function StartGeruest({ kopf }: { kopf: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
      {kopf}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <WochenSkelett />
      </main>
    </div>
  )
}
