import type { ComponentProps } from 'react'
import type { Kandidat } from '@shared/empfehlung-pool.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import type { Title } from '@shared/types.ts'
import { artWort, type Stand } from '../../lib/empfehlung-reise.ts'
import { useLang } from '../../lib/i18n.tsx'
import { anbieterName } from '@shared/types.ts'
import type { PlatformId } from '@shared/types.ts'
import type { VorschlagAktionen } from '../../lib/empfehlung-aktionen.ts'
import { Ablage } from './Ablage.tsx'
import { Cover } from './bilder.tsx'


const ZEILE = 'flex min-h-11 items-center gap-2 rounded-[10px] border border-ak-rand bg-ak-flaeche px-2.5 text-left text-[13px] font-semibold hover:bg-ak-flaeche-2'

function Vorschlag({ k, titel, istFavorit, aktionen }: { k: Kandidat; titel?: Title; istFavorit: boolean; aktionen: VorschlagAktionen }) {
  const { t } = useLang()
  const anbieter = [...new Set(k.p.map(([p]) => anbieterName(p as PlatformId)))].join(', ')
  return (
    <li className="empf-rein flex min-w-0 flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 className="m-0 line-clamp-2 min-h-[2.4em] text-sm font-bold leading-tight">{k.n}</h3>
        <span className="truncate text-xs text-ak-leise">{[artWort(k), k.y, anbieter].filter(Boolean).join(' · ')}</span>
      </div>
      <button
        type="button"
        onClick={() => aktionen.oeffne(k.id)}
        aria-label={t('empf.coverOeffnen', { titel: k.n })}
        className="empf-kandidat relative block aspect-[2/3] w-full overflow-hidden rounded-xl bg-ak-flaeche-2 shadow-xl"
      >
        <Cover titel={titel} breite={200} klasse="h-full w-full object-cover" />
        <span className="empf-details">
          {t('empf.details')}
        </span>
        {istFavorit && (
          <span className="absolute right-2 top-2 grid h-[30px] w-[30px] place-items-center rounded-full bg-ak-favorit text-base text-ak-auf-akzent" aria-hidden>
            ★
          </span>
        )}
        {k.ab !== undefined && <span className="empf-name absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-5 text-left text-[11px] leading-tight">{t('empf.staffel', { n: k.ab })}</span>}
      </button>
      <div className="empf-aktionen flex flex-col gap-1">
        <button type="button" aria-pressed={istFavorit} aria-label={t('empf.favorit')} title={t('empf.favorit')} onClick={() => aktionen.favorit(k.id)} className={`${ZEILE} ${istFavorit ? 'border-ak-favorit-rand' : ''}`}>
          <i className="w-[18px] text-center not-italic text-ak-favorit-text">★</i>
          <span className="empf-aktion-text">{t('empf.favorit')}</span>
        </button>
        <button type="button" aria-label={t('empf.gesehen')} title={t('empf.gesehen')} onClick={() => aktionen.gesehen(k.id)} className={ZEILE}>
          <i className="w-[18px] text-center not-italic text-ak-gut-text">✓</i>
          <span className="empf-aktion-gesehen">{t('empf.gesehen')}</span>
        </button>
        <button type="button" aria-label={t('empf.nein')} title={t('empf.nein')} onClick={() => aktionen.nein(k.id)} className={ZEILE}>
          <i className="w-[18px] text-center not-italic text-ak-fehler-text">✕</i>
          <span className="empf-aktion-text">{t('empf.nein')}</span>
        </button>
      </div>
    </li>
  )
}

/** Der Schluss der Reise: bis zu fünf Vorschläge als Galerie, darunter „genauer“, „Von vorn“ und die Verworfenen. */
export function Vorschlaege({ kontext, gezeigt, titel, favoriten, aktionen, stand, genauer, vonVorn, ablage }: {
  kontext: Kontext
  gezeigt: number[]
  titel?: Map<number, Title>
  favoriten: Set<number>
  aktionen: VorschlagAktionen
  stand?: Stand
  genauer?: () => void
  vonVorn: () => void
  ablage: ComponentProps<typeof Ablage>
}) {
  const { t } = useLang()
  const kandidaten = gezeigt.map((id) => kontext.datei.einstiege[kontext.index.get(id)!])
  const wenige = kandidaten.length < 5
  const unter = stand?.rest === null ? 'empf.untenGrenze' : 'empf.untenZahl'
  return (
    <section className="empf-galerie-abschnitt flex-1 overflow-auto px-4 pb-8 pt-24" aria-live="polite">
      <div className="empf-galerie mx-auto max-w-[1040px]">
        {kandidaten.length === 0 ? (
          <div className="py-10 text-center">
            <h2 className="m-0 text-[clamp(26px,5vw,40px)] font-extrabold leading-tight">{t('empf.nichtsUebrig')}</h2>
            <p className="mb-5 mt-2 text-ak-leise">{t('empf.nichtsUebrigHinweis')}</p>
          </div>
        ) : (
          <>
            <h2 className="m-0 text-[clamp(28px,6vw,48px)] font-extrabold leading-none tracking-tight">{t(wenige ? 'empf.vorschlaegeWenige' : 'empf.vorschlaege')}</h2>
            {stand && <p className="mb-4 mt-1 text-sm text-ak-leise">{t(unter, { gesamt: stand.gesamt, rest: stand.rest ?? 0 })}</p>}
            {wenige && <p className="mb-3 text-sm font-semibold">{kandidaten.length === 1 ? t('empf.nurNochEiner') : t('empf.nurNoch', { n: kandidaten.length })}</p>}
            <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-3.5 p-0 min-[600px]:grid-cols-3 min-[900px]:grid-cols-5 min-[900px]:gap-x-4">
              {kandidaten.map((k) => (
                <Vorschlag key={k.id} k={k} titel={titel?.get(k.id)} istFavorit={favoriten.has(k.id)} aktionen={aktionen} />
              ))}
            </ul>
          </>
        )}
        <Ablage {...ablage}>
          {genauer && (
            <button type="button" onClick={genauer} className="min-h-11 rounded-xl bg-ak-akzent px-4.5 font-semibold text-ak-auf-akzent">
              {t('empf.genauer')}
            </button>
          )}
          <button type="button" onClick={vonVorn} className="min-h-11 rounded-xl border border-ak-rand bg-ak-flaeche px-4.5 font-semibold">
            {t('empf.vonVorn')}
          </button>
        </Ablage>
      </div>
    </section>
  )
}
