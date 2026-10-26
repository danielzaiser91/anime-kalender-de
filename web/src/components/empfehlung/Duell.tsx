import { useEffect, useState } from 'react'
import { naechstesPaar, type Antwort, type Sitzung } from '@shared/empfehlung-kern.ts'
import type { Kandidat } from '@shared/empfehlung-pool.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import type { Title } from '@shared/types.ts'
import { BREIT_AB_PX, kartenQuelle } from '../../lib/empfehlung-duell-bilder.ts'
import { stand } from '../../lib/empfehlung-reise.ts'
import { useLang } from '../../lib/i18n.tsx'
import { bannerUrl } from './bilder.tsx'
import { DuellKarten, type Status } from './DuellKarten.tsx'
import './duell.css'
import { useDuell } from './use-duell.ts'

/** Ob das Fenster so breit ist, dass die Karten das Hochformat-Cover zeigen (wie die Medienabfrage im Layout). */
function useBreit(): boolean {
  const abfrage = `(min-width: ${BREIT_AB_PX}px)`
  const [breit, setBreit] = useState(() => window.matchMedia(abfrage).matches)
  useEffect(() => {
    const m = window.matchMedia(abfrage)
    const lies = () => setBreit(m.matches)
    m.addEventListener('change', lies)
    return () => m.removeEventListener('change', lies)
  }, [abfrage])
  return breit
}

/** Ein Duell: zwei Karten, Zwischenstand, Zurück und „Andere Vorschläge“. */
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
  const breit = useBreit()
  const { schritt, gewaehlt, waehle, zurueckGehen } = useDuell({ kontext, sitzung, ziel, titel, breit, antworte, zurueck })
  const paar = naechstesPaar(kontext, sitzung.zustand)
  if (!paar) return null
  const s = stand(kontext, sitzung.zustand, ziel)
  const [a, b] = paar.map((i) => kontext.datei.einstiege[i]) as [Kandidat, Kandidat]
  const genres = (k: Kandidat) => k.g.slice(0, 2).map((i) => tGenre(kontext.datei.genres[i]))
  const wahl = (antwort: Antwort) => {
    if (!waehle(antwort)) return
    const sieger = antwort === 'A' ? a : antwort === 'B' ? b : undefined
    if (sieger) schein(bannerUrl(titel?.get(sieger.id), 300))
  }
  const status = (me: 'A' | 'B'): Status => (!gewaehlt || gewaehlt === 'N' ? '' : gewaehlt === me ? 'gewinnt' : 'verliert')
  const quelle = (id: number) => { const t = titel?.get(id); return kartenQuelle(bannerUrl(t, 780), t?.coverImage, breit) }
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
        <DuellKarten paar={[a, b]} quelle={quelle} genres={genres} schritt={schritt} status={status} oder={t('empf.oder')} waehle={wahl} />
        <p className="mt-2.5 text-[13px] text-ak-leise">{zahlen}</p>
        <div className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-2 min-[600px]:grid-cols-[auto_1fr_auto]">
          <button type="button" onClick={zurueckGehen} className={`min-h-11 px-1 text-sm text-ak-leise ${sitzung.verlauf.length ? '' : 'invisible'}`}>
            {t('empf.zurueck')}
          </button>
          <button type="button" onClick={() => wahl('N')} className="min-h-11 justify-self-center rounded-xl border border-dashed border-ak-rand px-4.5 font-semibold text-ak-leise">
            {t('empf.egal')}
          </button>
          <span className="invisible hidden min-h-11 px-1 text-sm min-[600px]:inline" aria-hidden>{t('empf.zurueck')}</span>
        </div>
      </div>
    </section>
  )
}
