import { useEffect, useRef, useState } from 'react'
import { naechstesPaar, type Antwort, type Sitzung } from '@shared/empfehlung-kern.ts'
import type { Kandidat } from '@shared/empfehlung-pool.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import type { Title } from '@shared/types.ts'
import { stand } from '../../lib/empfehlung-reise.ts'
import { useLang } from '../../lib/i18n.tsx'
import { bannerUrl } from './bilder.tsx'
import { coverBild } from '../../lib/cover.ts'

/** Zeit, in der der Sieger aufleuchtet, bevor das nächste Paar kommt. */
const ANTWORT_VERZOEGERUNG_MS = 380

function Karte({ k, titel, genres, status, wahl }: { k: Kandidat; titel?: Title; genres: string[]; status: '' | 'gewinnt' | 'verliert'; wahl: () => void }) {
  const banner = bannerUrl(titel, 780)
  const cover = coverBild(titel?.coverImage, 300)
  return (
    <button
      type="button"
      onClick={wahl}
      className={`empf-kandidat ${status} relative block h-full min-h-0 w-full overflow-hidden rounded-2xl bg-ak-flaeche-2 shadow-2xl md:aspect-[2/3] md:h-auto md:max-h-full md:w-auto md:max-w-full`}
    >
      <picture>
        {cover.src && <source media="(min-width: 720px)" srcSet={cover.srcSet} sizes="300px" />}
        {(banner ?? cover.src) && <img src={banner ?? cover.src} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
      </picture>
      <span className="absolute inset-x-0 bottom-0 px-3.5 pb-3 pt-12 text-left text-[clamp(16px,4.5vw,22px)] font-extrabold leading-tight empf-name">
        {k.n}
        <span className="mt-1.5 flex gap-1 text-[11px] font-semibold">
          {genres.map((g) => (
            <i key={g} className="empf-chip rounded-full px-2 py-0.5 not-italic">
              {g}
            </i>
          ))}
        </span>
      </span>
    </button>
  )
}

/** Ein Duell: zwei Karten, Zwischenstand, Zurück und „Kann mich nicht entscheiden“. */
export function Duell({ kontext, sitzung, ziel, titel, antworte, zurueck, schein }: {
  kontext: Kontext
  sitzung: Sitzung
  ziel: number
  titel?: Map<number, Title>
  antworte: (a: Antwort) => void
  zurueck: () => void
  schein: (url?: string) => void
}) {
  const { t, tGenre } = useLang()
  const [gewaehlt, setGewaehlt] = useState<Antwort>()
  const zeit = useRef<number | undefined>(undefined)
  const paar = naechstesPaar(kontext, sitzung.zustand)
  useEffect(() => () => window.clearTimeout(zeit.current), [])
  useEffect(() => setGewaehlt(undefined), [sitzung.zustand])
  if (!paar) return null
  const s = stand(kontext, sitzung.zustand, ziel)
  const [a, b] = paar.map((i) => kontext.datei.einstiege[i])
  const genres = (k: Kandidat) => k.g.slice(0, 2).map((i) => tGenre(kontext.datei.genres[i]))
  const waehle = (antwort: Antwort) => {
    if (gewaehlt) return
    setGewaehlt(antwort)
    const sieger = antwort === 'A' ? a : antwort === 'B' ? b : undefined
    if (sieger) schein(bannerUrl(titel?.get(sieger.id), 300))
    zeit.current = window.setTimeout(() => antworte(antwort), antwort === 'N' ? 0 : ANTWORT_VERZOEGERUNG_MS)
  }
  const status = (me: Antwort): '' | 'gewinnt' | 'verliert' => (!gewaehlt || gewaehlt === 'N' ? '' : gewaehlt === me ? 'gewinnt' : 'verliert')
  const zahlen = s.rest === null ? t('empf.restUntergrenze') : s.rest === s.gesamt ? t('empf.startZahl', { gesamt: s.gesamt }) : t('empf.restZahl', { rest: s.rest, gesamt: s.gesamt })
  return (
    <section className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-16" aria-live="polite">
      <div className="empf-rein mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col text-center">
        <div className="mb-2.5 flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: ziel }, (_, i) => (
            <i key={i} className={`block h-1 w-[22px] rounded-sm ${i < sitzung.zustand.gewertet ? 'bg-ak-akzent' : 'bg-ak-rand'}`} />
          ))}
        </div>
        <h1 className="m-0 text-[clamp(26px,5vw,44px)] font-extrabold leading-none tracking-tight">{t('empf.duellFrage')}</h1>
        <p className="mb-3 mt-1 text-sm text-ak-leise">{t('empf.duellNr', { nr: s.nr, ziel: s.ziel })}</p>
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[1fr_auto_1fr] items-center justify-items-center gap-2 md:grid-cols-[1fr_auto_1fr] md:grid-rows-1 md:gap-4">
          <div className="h-full min-h-0 w-full md:flex md:justify-end"><Karte k={a} titel={titel?.get(a.id)} genres={genres(a)} status={status('A')} wahl={() => waehle('A')} /></div>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-ak-sehr-leise">{t('empf.oder')}</span>
          <div className="h-full min-h-0 w-full md:flex md:justify-start"><Karte k={b} titel={titel?.get(b.id)} genres={genres(b)} status={status('B')} wahl={() => waehle('B')} /></div>
        </div>
        <p className="mt-2.5 text-[13px] text-ak-leise">{zahlen}</p>
        <div className="mt-1.5 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <button type="button" onClick={zurueck} className={`min-h-11 px-1 text-sm text-ak-leise ${sitzung.verlauf.length ? '' : 'invisible'}`}>
            {t('empf.zurueck')}
          </button>
          <button type="button" onClick={() => waehle('N')} className="min-h-11 justify-self-center rounded-xl border border-dashed border-ak-rand px-4.5 font-semibold text-ak-leise">
            {t('empf.egal')}
          </button>
          <span className="invisible min-h-11 px-1 text-sm" aria-hidden>{t('empf.zurueck')}</span>
        </div>
      </div>
    </section>
  )
}
