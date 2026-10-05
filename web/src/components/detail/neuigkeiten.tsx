import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS, type NewsEintrag, type NewsMeldung, type Release } from '@shared/types.ts'
import { loadNews, type Dataset } from '../../lib/data.ts'
import { useLang } from '../../lib/i18n.tsx'
import { artLabel, datumKurz, newsSatz } from '../../lib/news-text.ts'
import { NEWS_FARBE } from '../NewsView.tsx'
import { AbgeloestHinweis } from '../news-abgeloest.tsx'
import { QuellenKnopf } from '../beleg-dialog.tsx'
import { Klapptext } from '../klapptext.tsx'
import { NachtragText } from '../news-nachtrag.tsx'
import { todayIso } from '@shared/time.ts'
import { hostVon, istLink } from '@shared/quelle.ts'
import { GlockeZeichen, PanelKarte } from './panel-karte.tsx'

interface Zeile {
  am: string
  m: NewsMeldung
  /** Der Teil der Reihe, den die Meldung betrifft. */
  teilId: number
}

/** Der Punkt an der Zeitleiste, je Art in ihrer Farbe. */
const PUNKT: Record<NewsMeldung['art'], string> = {
  neu: 'bg-emerald-500',
  folgen: 'bg-blue-400',
  angekuendigt: 'bg-violet-500',
  disc: 'bg-amber-500',
  kino: 'bg-rose-500',
  verspaetet: 'bg-slate-400',
  nachgereicht: 'bg-teal-500',
  nachgetragen: 'bg-indigo-500',
}

/** Wie viele Meldungen ohne Aufklappen zu sehen sind. */
const SICHTBAR = 3

/**
 * **Die News eines Titels stehen auch in seinem Panel**, mit Sprung zur Quelle —
 * nur die des eigenen Titels, neueste zuerst (`meldungenImPanel`).
 */
export function Neuigkeiten({ data, titelId }: { data: Dataset; titelId: number }) {
  const { t } = useLang()
  const [liste, setListe] = useState<NewsEintrag[] | null>(null)
  const [alle, setAlle] = useState(false)
  useEffect(() => {
    let aktiv = true
    void loadNews().then((l) => aktiv && setListe(l))
    return () => {
      aktiv = false
    }
  }, [])
  const zeilen = useMemo(() => meldungenImPanel(liste ?? [], titelId, todayIso()), [liste, titelId])
  if (!zeilen.length) return null
  const gezeigt = alle ? zeilen : zeilen.slice(0, SICHTBAR)
  return (
    <PanelKarte symbol={<GlockeZeichen />} titel={t('detail.neuigkeiten')} zaehler={zeilen.length} akzent="violet">
      {/* Zeitleiste: ein senkrechter Strich, je Meldung ein farbiger Punkt in der Farbe ihrer Art. */}
      <ul className="relative flex flex-col gap-3.5 pl-4 before:absolute before:bottom-1 before:left-[3px] before:top-1.5 before:w-px before:bg-ak-rand">
        {gezeigt.map((z, i) => (
          <NeuigkeitZeile key={`${z.am}-${z.m.art}-${i}`} z={z} data={data} />
        ))}
      </ul>
      {zeilen.length > SICHTBAR && (
        <button type="button" onClick={() => setAlle(!alle)} aria-expanded={alle} className="mt-2 cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche-2 px-3 py-1 text-xs font-bold text-ak-text transition hover:border-ak-akzent hover:text-ak-akzent-text">
          {alle ? t('filter.showLess') : t('detail.neuigkeitenAlle', { n: zeilen.length })}
        </button>
      )}
    </PanelKarte>
  )
}

function NeuigkeitZeile({ z, data }: { z: Zeile; data: Dataset }) {
  /* Eine geschätzte Meldung hat keine Quelle, die sie belegt — sie sagt es selbst (01.10.2026). */
  const quelle = z.m.geschaetzt ? undefined : quelleFuer(z, data)
  const jahr = new Date().getFullYear().toString()
  const datum = z.am.startsWith(jahr) ? datumKurz(z.am).slice(0, 6) : datumKurz(z.am)
  const abgeloest = Boolean(z.m.ersetzt || z.m.zurueckgezogen)
  const belege = z.m.belege?.length ? z.m.belege : quelle ? [quelle] : []
  return (
    <li className="relative flex flex-col gap-1">
      <span aria-hidden className={`absolute -left-[17px] top-1.5 size-[9px] rounded-full ring-2 ring-ak-flaeche ${PUNKT[z.m.art]}`} />
      {/* Kopfzeile: Datum, Art und Quellen — der Text darunter hat die volle Breite. */}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 rounded-md bg-ak-flaeche-2 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ak-text">{datum}</span>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${NEWS_FARBE[z.m.art]}`}>{artLabel(z.m)}</span>
        {/* Eine geschätzte Meldung zeigt keine Quelle — die Seite dahinter nennt den Termin nicht. */}
        {!z.m.geschaetzt && <QuellenKnopf belege={belege} betreff={newsSatz(z.m)} />}
      </span>
      <span className={`text-[13px] font-medium leading-snug ${abgeloest ? 'text-ak-leise line-through' : 'text-ak-text'}`}>{newsSatz(z.m)}</span>
      {/* **Lange Vermerke nur aufgeklappt**: Der erste Satz steht da, der
          Rest hinter „mehr" — dieselbe Regel wie im Antwortkasten. */}
      {z.m.hinweis && (z.m.abschnitte?.length ? <div className="text-xs leading-snug text-ak-text/75"><NachtragText kurz={z.m.hinweis} abschnitte={z.m.abschnitte} /></div> : <Klapptext text={z.m.hinweis} className="text-xs leading-snug text-ak-text/75" />)}
      {abgeloest && <AbgeloestHinweis m={z.m} />}
    </li>
  )
}

/** Meldungen, die einen Termin nennen — sie veralten mit ihm. */
const TERMIN_ARTEN = new Set<NewsMeldung['art']>(['angekuendigt', 'disc', 'kino'])

/**
 * Was das Panel an News zeigt: **nur der eigene Titel** — bei Pokémon standen
 * Meldungen zu „Reisen" und „Horizonte" im Panel von „Generationen" —, **kein vorbeigegangener
 * Termin**. Ein **kommender** Termin bleibt: Die Pille nennt den Tag, die Meldung dazu nennt die Quelle
 * (Daniel, 04.10.2026: „News-Einträge fehlen im Panel"). Neueste zuerst.
 */
export function meldungenImPanel(liste: NewsEintrag[], titelId: number, heute: string): Zeile[] {
  const zeilen: Zeile[] = []
  for (const e of liste)
    for (const m of e.meldungen) {
      const teilId = m.teilId ?? e.titelId
      if (teilId !== titelId) continue
      /*
        Eine **angekündigte** Staffel bleibt sichtbar — sie ist noch kein Termin,
        den das Panel schon zeigt, sondern die Nachricht selbst.
      */
      if (TERMIN_ARTEN.has(m.art) && m.datum && m.datum < heute) continue
      zeilen.push({ am: e.am, m, teilId })
    }
  return zeilen.sort((a, b) => b.am.localeCompare(a.am))
}

/**
 * Wohin „Quelle" führt: der jüngste Beleg des Releases, um den es geht; ohne Beleg die Seite beim
 * Anbieter. Eine Meldung ohne eigenes Release („neu auf Deutsch") nimmt das Release ihres Teils
 * beim genannten Anbieter.
 */
function quelleFuer(z: Zeile, data: Dataset): { url: string; name: string } | undefined {
  /*
    **Eine abgelöste Meldung zeigt ihre *damalige* Quelle** (01.10.2026). Vorher löste das Panel sie
    über das **geltende** Release auf — die durchgestrichene 01.10.-Meldung bekam so den
    Crunchyroll-Link, der den 02.10. nennt. Der Link widersprach der Meldung, an der er stand.
  */
  if (z.m.ersetzt || z.m.zurueckgezogen)
    return istLink(z.m.quelle) ? { url: z.m.quelle, name: hostVon(z.m.quelle) } : undefined
  const release: Release | undefined = z.m.release
    ? data.releaseBySlug.get(z.m.release)
    : data.releases.find((r) => r.titleId === z.teilId && r.platform === z.m.platform)
  if (!release) return anbieterSeite(z, data)
  const beleg = [...(release.quellen ?? [])].sort((a, b) => b.gesehenAm.localeCompare(a.gesehenAm))[0]
  if (beleg) return { url: beleg.url, name: beleg.name }
  if (release.sources[0]) return { url: release.sources[0], name: hostVon(release.sources[0]) }
  if (release.platformUrl) return { url: release.platformUrl, name: PLATFORMS[release.platform]?.name ?? release.platform }
  return anbieterSeite(z, data)
}

/** „Neu auf Deutsch" hängt oft an keinem Release — dann führt die Quelle zur Serie beim Anbieter. */
function anbieterSeite(z: Zeile, data: Dataset): { url: string; name: string } | undefined {
  const stream = data.titleById.get(z.teilId)?.streams?.find((s) => s.platform === z.m.platform && s.url)
  return stream?.url ? { url: stream.url, name: PLATFORMS[stream.platform]?.name ?? stream.platform } : undefined
}
