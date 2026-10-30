import { useEffect, useState } from 'react'
import type { Kandidat } from '@shared/empfehlung-pool.ts'
import { PLATFORMS, type Fsk, type PlatformId, type StreamLink, type Title } from '@shared/types.ts'
import { loadSynopsis } from '../../lib/data.ts'
import { belegLink } from '@shared/quelle.ts'
import { fuehreTasteAus, tasteZuAktion } from '../../lib/empfehlung-bedienung.ts'
import { metaZeile } from '../../lib/empfehlung-reise.ts'
import { useEscape } from '../../lib/escape.ts'
import { useLang } from '../../lib/i18n.tsx'
import { TrailerKino } from '../detail/kino.tsx'
import { FskBadge } from '../ui.tsx'
import { bannerUrl, Cover } from './bilder.tsx'


/** Ein Weg je Anbieter mit belegter Synchro, mit Zugangsart, wo sie etwas sagt. */
function anbieterWege(titel?: Title): StreamLink[] {
  const gesehen = new Set<string>()
  return (titel?.streams ?? []).filter((s) => s.dub === true && !gesehen.has(s.platform) && gesehen.add(s.platform))
}

function Anbieter({ wege, eigene }: { wege: StreamLink[]; eigene: ReadonlySet<string> }) {
  const { t } = useLang()
  return (
    <div className="flex flex-wrap gap-2">
      {wege.map((s) => (
        <a
          key={s.platform}
          href={belegLink(s)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ borderColor: PLATFORMS[s.platform as PlatformId]?.color }}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] px-3.5 text-sm font-semibold text-ak-text no-underline ${eigene.has(s.platform) ? 'bg-ak-flaeche-2' : 'bg-ak-flaeche'}`}
        >
          {PLATFORMS[s.platform as PlatformId]?.name ?? s.platform}
          {s.zugang === 'kauf' && <small className="font-normal text-ak-leise">{t('empf.kaufen')}</small>}
          {s.zugang === 'kostenlos' && <small className="font-normal text-ak-leise">{t('empf.kostenlos')}</small>}
        </a>
      ))}
    </div>
  )
}

/** Die Handlung ganz, als letzter Block der Detailansicht. */
export function Handlung({ text, kopf }: { text?: string; kopf: string }) {
  const { t } = useLang()
  return (
    <div className="min-[900px]:col-span-2">
      <h3 className={kopf}>{t('empf.handlung')}</h3>
      <p className="m-0 max-w-[60ch] whitespace-pre-line text-base leading-normal">{text ?? ''}</p>
    </div>
  )
}

function ZweiteEbene({ k, titel, genres, eigene }: { k: Kandidat; titel?: Title; genres: string[]; eigene: ReadonlySet<string> }) {
  const { t, tGenre } = useLang()
  const [text, setText] = useState<string>()
  useEffect(() => {
    let aktiv = true
    loadSynopsis(k.id).then((s) => aktiv && setText(s?.de ?? s?.en))
    return () => {
      aktiv = false
    }
  }, [k.id])
  const kopf = 'mb-2 mt-0 text-xs font-normal uppercase tracking-[0.12em] text-ak-leise'
  return (
    <div className="mx-auto grid max-w-[1100px] snap-start gap-5 px-5 pb-10 pt-4 min-[900px]:grid-cols-[1.2fr_1fr] min-[900px]:gap-7">
      <div>
        <h3 className={`${kopf} mt-0`}>{t('empf.blick')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {k.fsk == null ? <span className="rounded-full border border-ak-rand bg-ak-pille px-3 py-1 text-[13px]">{t('empf.fskOffen')}</span> : <FskBadge fsk={k.fsk as Fsk} />}
          {genres.map((g) => (
            <span key={g} className="rounded-full border border-ak-rand bg-ak-pille px-3 py-1 text-[13px]">
              {tGenre(g)}
            </span>
          ))}
          {titel?.studios?.[0] && <span className="rounded-full border border-ak-rand bg-ak-pille px-3 py-1 text-[13px]">{titel.studios[0]}</span>}
        </div>
        <h3 className={`${kopf} mt-5`}>{t('empf.aufDeutschBei')}</h3>
        <Anbieter wege={anbieterWege(titel)} eigene={eigene} />
      </div>
      <div>
        <h3 className={kopf}>{t('empf.trailer')}</h3>
        {titel?.trailer ? <TrailerKino trailer={titel.trailer} titel={k.n} /> : <p className="m-0 text-[13px] text-ak-sehr-leise">{t('empf.keinTrailer')}</p>}
      </div>
      <Handlung text={text} kopf={kopf} />
    </div>
  )
}

/** Esc löst „zurück“ aus (sonst nichts: keine Pfeile, kein G). */
export function useZurueckTaste(zurueck: () => void) {
  useEscape(true, (e) => {
    const aktion = tasteZuAktion({ key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, ziel: (e.target as HTMLElement | null)?.tagName ?? '' })
    fuehreTasteAus(aktion, { zurueck })
  })
}

/** Ein Vorschlag groß im Bild; nach unten die zweite Ebene. Zurück geht nur per Kopfzeilen-Knopf oder Esc. */
export function Leinwand({ k, titel, genres, eigene, zurueck }: {
  k: Kandidat
  titel?: Title
  genres: string[]
  eigene: ReadonlySet<string>
  zurueck: () => void
}) {
  const { t } = useLang()
  useZurueckTaste(zurueck)
  const banner = bannerUrl(titel, 1280)
  const nichtBei = eigene.size > 0 && !k.p.some(([p]) => eigene.has(p))
  return (
    <section className="relative flex min-h-0 flex-1 overflow-hidden" aria-label={k.n}>
      <div className="empf-szene neu absolute inset-0 snap-y snap-proximity overflow-auto overscroll-contain">
        <div className="empf-leinwand relative flex h-full min-h-[460px] snap-start items-end">
          {banner ? <img src={banner} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover object-top" /> : <Cover titel={titel} breite={500} klasse="absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.6] blur-2xl" hoch />}
          <div className="relative z-10 mx-auto flex w-full max-w-[1100px] items-end gap-3.5 px-5 pb-10">
            <Cover titel={titel} breite={300} hoch klasse="w-[176px] flex-none rounded-lg bg-ak-flaeche-2 object-cover shadow-2xl min-[900px]:w-[280px] min-[900px]:rounded-xl aspect-[2/3]" />
            <div className="min-w-0">
              <h2 className="m-0 text-[clamp(28px,6vw,56px)] font-extrabold leading-none tracking-tight">{k.n}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-ak-leise">
                <span>{metaZeile(k, titel?.runtimeMin)}</span>
                {nichtBei && <span className="text-xs text-ak-sehr-leise">{t('empf.nichtBeiDeinen')}</span>}
                {k.ab !== undefined && <span className="w-full text-xs text-ak-warnung-text">{t('empf.staffel', { n: k.ab })}</span>}
              </div>
            </div>
          </div>
        </div>
        <ZweiteEbene k={k} titel={titel} genres={genres} eigene={eigene} />
      </div>
    </section>
  )
}
