import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import { nowHhMm, todayIso } from '@shared/time.ts'
import { TvKasten } from '../../src/components/kalender/TvKasten.tsx'
import { FernsehZeichen } from '../../src/components/kalender/Zeichen.tsx'
import { PremiereMarke } from '../../src/components/kalender/PremiereMarke.tsx'
import { TREFFER_24_HOCH } from '../../src/components/detail/tippziel.ts'
import { buendeleTermine } from '../../src/lib/buendel.ts'
import { coverBild } from '../../src/lib/cover.ts'
import { useLang } from '../../src/lib/i18n.tsx'
import { tvPremiere } from '../../src/lib/tv-angabe.ts'
import { farbenVon, JetztLinie, KopfzeileText, Zustandsspalte, type Farben, type Stil } from './relative-uhrzeit-teile.tsx'
import { kastenZustand, kopfzeile, type Kastenzustand, type Zeilenzustand } from './relative-uhrzeit-zeit.ts'

type KastenEigenschaften = ComponentProps<typeof TvKasten>

/** Der Zustand des Kastens, wenn er den heutigen Tag zeigt; an anderen Tagen bleibt alles wie in der Seite. */
function zustandVon(gruppen: ReleaseEvent[][], data: KastenEigenschaften['data']): Kastenzustand | undefined {
  const heute = todayIso()
  if (gruppen[0]?.[0]?.date !== heute) return undefined
  const sendungen = gruppen.map((g) => data.releaseBySlug.get(g[0]!.releaseSlug)?.sendungen ?? [])
  return kastenZustand(gruppen, sendungen, heute, nowHhMm())
}

/**
 * Am Handy steht der Kasten unter den Kacheln, außerhalb der ersten Bildschirmhöhe; die Seite springt zur nächsten Kachel.
 * Im Mockup rückt er danach in die Mitte, damit ein Bild des Rasters ihn zeigt (nach der weichen Bewegung der Seite, ~0,5 s).
 */
function useKastenInsBild(aktiv: boolean) {
  const ziel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aktiv || !window.matchMedia('(max-width: 639px)').matches) return
    const uhr = window.setTimeout(() => ziel.current?.scrollIntoView({ block: 'center' }), 800)
    return () => window.clearTimeout(uhr)
  }, [aktiv])
  return ziel
}

/** Variante B klebt Kopf und Zeile zusammen oben; ohne Zeile bleibt der Kopf, wie er ist. */
function Kopf({ zeile, farben }: { zeile: ReturnType<typeof kopfzeile>; farben: Farben }) {
  const { t } = useLang()
  const titel = (
    <>
      <FernsehZeichen groesse={16} />
      {t('kal.imTv')}
    </>
  )
  if (!zeile) {
    return (
      <h3 className="sticky top-0 z-[1] -mx-3.5 -mt-3 flex items-center gap-2 rounded-t-2xl bg-ak-tv-grund px-3.5 pt-3 pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ak-tv">
        {titel}
      </h3>
    )
  }
  return (
    <div className="sticky top-0 z-[1] -mx-3.5 -mt-3 rounded-t-2xl bg-ak-tv-grund px-3.5 pt-3 pb-1.5">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ak-tv">{titel}</h3>
      <KopfzeileText zeile={zeile} farben={farben} />
    </div>
  )
}

/** Der Fernseh-Kasten mit Bezug zur Uhrzeit: A und C mit Jetzt-Linie und Zustandsspalte, B mit Kopfzeile. */
export function TvKastenJetzt({ stil, ...p }: KastenEigenschaften & { stil: Stil }) {
  const { t } = useLang()
  const farben = farbenVon(stil)
  const gruppen = buendeleTermine(p.termine, (ev) => !!ev.verpasst || tvPremiere(ev, p.data))
  const zustand = zustandVon(gruppen, p.data)
  const mitSpalte = stil !== 'B'
  const ziel = useKastenInsBild(!!zustand)
  const liste = (
    <ul className="flex flex-col">
      {gruppen.map((g, i) => (
        <ZeilenMitLinie key={g[0]!.id} linie={mitSpalte && zustand?.linieVor === i ? nowHhMm() : undefined} farben={farben}>
          <TvZeileJetzt gruppe={g} p={p} zustand={zustand?.zeilen[i]} farben={farben} mitSpalte={mitSpalte} />
        </ZeilenMitLinie>
      ))}
    </ul>
  )
  if (p.kompakt) return liste
  const zeile = stil === 'B' && zustand ? kopfzeile(zustand, gruppen.map((g) => g[0]!.name)) : undefined
  return (
    <div ref={ziel} className="flex min-h-full flex-col gap-0.5 rounded-2xl border border-ak-tv-rand bg-ak-tv-grund px-3.5 py-3">
      <Kopf zeile={zeile} farben={farben} />
      {p.termine.length === 0 ? <p className="text-[13px] text-ak-sehr-leise">{t('kal.keineAusstrahlung')}</p> : liste}
      {mitSpalte && zustand?.alleVorbei && <p className="pt-1 text-[13px] text-ak-sehr-leise">Heute nichts mehr</p>}
    </div>
  )
}

/** Vor der Zeile ggf. die Jetzt-Linie; beide sind Einträge derselben Liste. */
function ZeilenMitLinie({ linie, farben, children }: { linie?: string; farben: Farben; children: ReactNode }) {
  return (
    <>
      {linie && <JetztLinie jetzt={linie} farben={farben} />}
      {children}
    </>
  )
}

/** Eine Zeile wie in der Seite; vergangene tragen zusätzlich „vorbei" für Vorlesende, laufende sind nicht gedimmt. */
function TvZeileJetzt({
  gruppe,
  p,
  zustand,
  farben,
  mitSpalte,
}: {
  gruppe: ReleaseEvent[]
  p: KastenEigenschaften
  zustand: Zeilenzustand | undefined
  farben: Farben
  mitSpalte: boolean
}) {
  const { t } = useLang()
  const [auf, setAuf] = useState(false)
  const [ev, ...weitere] = gruppe as [ReleaseEvent, ...ReleaseEvent[]]
  if (p.hidden.has(ev.titleId)) return <li className="py-1 text-[13px] italic text-ak-sehr-leise">{ev.name}</li>
  const vorbei = zustand ? zustand.art === 'vorbei' : !!p.vorbeiBis && (gruppe[gruppe.length - 1]!.time ?? '99') < p.vorbeiBis
  const cover = p.data.titleById.get(ev.titleId)?.coverImage
  const premiere = tvPremiere(ev, p.data)
  const letzte = weitere[weitere.length - 1]?.time
  const spalte = mitSpalte && zustand && (zustand.art === 'laeuft' || zustand.art === 'naechste')
  return (
    <li data-tv-zeile className={vorbei ? 'ak-vorbei' : ''}>
      <button
        type="button"
        data-schliesst
        onClick={() => p.onOpen(ev)}
        className={`grid w-full cursor-pointer ${spalte ? 'grid-cols-[24px_44px_minmax(0,1fr)_auto]' : 'grid-cols-[24px_44px_minmax(0,1fr)]'} items-center gap-2 rounded-lg py-1 text-left text-[13px] transition hover:bg-ak-tv/10`}
      >
        {cover ? (
          <img {...coverBild(cover, 24)} alt="" loading="lazy" className="h-[34px] w-6 rounded object-cover" />
        ) : (
          <span className="h-[34px] w-6 rounded bg-ak-flaeche-2" />
        )}
        <span className="font-bold tabular-nums text-ak-tv">{ev.time ?? '–'}</span>
        <span className="flex min-w-0 flex-col">
          <span className="ak-titel font-semibold text-ak-text">
            {vorbei && <span className="sr-only">vorbei </span>}
            {ev.name}
            {premiere && <PremiereMarke platform="tv" vorher={ev.premiereVorher} className="ml-1.5 inline-block px-1.5 align-[1px]" />}
          </span>
          <span className="text-xs text-ak-leise">
            {ev.sender}
            {ev.episode && !ev.sichtung ? ` · ${t('kal.folge', { n: ev.episode })}` : ''}
          </span>
        </span>
        {spalte && <Zustandsspalte zustand={zustand} farben={farben} />}
      </button>
      {weitere.length > 0 && (
        <button
          type="button"
          onClick={() => setAuf(!auf)}
          aria-expanded={auf}
          className={`ml-[76px] flex min-h-11 cursor-pointer items-center rounded px-1 text-xs font-semibold text-ak-tv hover:underline sm:min-h-0 ${TREFFER_24_HOCH}`}
        >
          {auf
            ? t('kal.buendelAuch', { zeiten: weitere.map((w) => w.time ?? '–').join(', ') })
            : letzte
              ? t('kal.buendelTv', { n: weitere.length, zeit: letzte })
              : t('kal.buendelTvOhneZeit', { n: weitere.length })}
        </button>
      )}
    </li>
  )
}
