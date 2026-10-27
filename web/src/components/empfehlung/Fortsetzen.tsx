import type { Kandidat } from '@shared/empfehlung-pool.ts'
import type { Title } from '@shared/types.ts'
import { useLang } from '../../lib/i18n.tsx'
import { Cover } from './bilder.tsx'
import { MosaikHintergrund } from './MosaikHintergrund.tsx'

const TAFEL = 'relative z-10 flex min-h-0 flex-col justify-center gap-4 overflow-auto p-5'

/**
 * Startbildschirm mit Vorgeschichte, 70 zu 30: links bzw. oben „Fortfahren“ mit den Vorschlägen als Vorschau, rechts bzw. unten
 * „Vorschläge verwerfen und von vorn“ (Gesehenes und Verworfenes bleiben).
 */
export function Fortsetzen({ vorschau, titel, mosaik, offenesDuell, fortfahren, neu }: {
  vorschau: Kandidat[]
  titel?: Map<number, Title>
  mosaik: number[]
  offenesDuell: boolean
  fortfahren: () => void
  neu: () => void
}) {
  const { t } = useLang()
  return (
    <section className="empf-rein relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-4 pt-20 min-[900px]:flex-row" aria-label={t('view.entdecken')}>
      <MosaikHintergrund titel={titel} ids={mosaik} />
      <div data-teil="fortfahren" className={`${TAFEL} shrink-0 grow-0 basis-[calc((100%-0.75rem)*0.7)]`}>
        <h1 className="m-0 text-[clamp(24px,4vw,40px)] font-extrabold leading-tight">{t(offenesDuell ? 'empf.fortDuell' : 'empf.fortTitel')}</h1>
        <ul className="m-0 grid max-w-[760px] list-none grid-cols-5 gap-2 p-0 min-[900px]:gap-3">
          {vorschau.map((k) => (
            <li key={k.id} className="flex min-w-0 flex-col gap-1">
              <Cover titel={titel?.get(k.id)} breite={200} klasse="aspect-[2/3] w-full rounded-lg bg-ak-flaeche-2 object-cover" />
              <span className="line-clamp-2 text-[11px] leading-tight min-[900px]:text-xs">{k.n}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={fortfahren} className="min-h-12 self-start rounded-2xl bg-ak-akzent px-8 text-[17px] font-semibold text-ak-auf-akzent">
          {t('empf.fortfahren')}
        </button>
      </div>
      <div data-teil="neu" className={`${TAFEL} shrink-0 grow-0 basis-[calc((100%-0.75rem)*0.3)]`}>
        <button type="button" onClick={neu} className="min-h-12 rounded-2xl border border-ak-rand bg-ak-flaeche-2 px-4 py-2 text-[15px] font-semibold">
          {t('empf.neuVonVorn')}
        </button>
        <p className="m-0 text-xs text-ak-leise">{t('empf.neuHinweis')}</p>
      </div>
    </section>
  )
}
