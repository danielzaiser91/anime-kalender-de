import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS, type NewsEintrag, type NewsMeldung, type Release } from '@shared/types.ts'
import { loadNews, type Dataset } from '../../lib/data.ts'
import { useLang, type TranslationKey } from '../../lib/i18n.tsx'
import { datumKurz, newsSatz } from '../../lib/news-text.ts'
import { NEWS_FARBE } from '../NewsView.tsx'
import { AbgeloestHinweis } from '../news-abgeloest.tsx'
import { QuellenZeile } from '../news-belege.tsx'
import { Klapptext } from '../klapptext.tsx'
import { todayIso } from '@shared/time.ts'
import { hostVon, istLink } from '@shared/quelle.ts'

interface Zeile {
  am: string
  m: NewsMeldung
  /** Der Teil der Reihe, den die Meldung betrifft. */
  teilId: number
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
  const zeilen = useMemo(() => meldungenImPanel(liste ?? [], titelId, data, todayIso()), [liste, titelId, data])
  if (!zeilen.length) return null
  const gezeigt = alle ? zeilen : zeilen.slice(0, SICHTBAR)
  return (
    <section className="flex flex-col gap-1" aria-label={t('detail.neuigkeiten')}>
      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-ak-leise">{t('detail.neuigkeiten')}</h3>
      <ul className="flex flex-col">
        {gezeigt.map((z, i) => (
          <NeuigkeitZeile key={`${z.am}-${z.m.art}-${i}`} z={z} data={data} />
        ))}
      </ul>
      {zeilen.length > SICHTBAR && (
        <button type="button" onClick={() => setAlle(!alle)} aria-expanded={alle} className="self-start py-1 text-xs font-bold text-ak-akzent-text hover:underline">
          {alle ? t('filter.showLess') : t('detail.neuigkeitenAlle', { n: zeilen.length })}
        </button>
      )}
    </section>
  )
}

function NeuigkeitZeile({ z, data }: { z: Zeile; data: Dataset }) {
  const { t } = useLang()
  /* Eine geschätzte Meldung hat keine Quelle, die sie belegt — sie sagt es selbst (01.10.2026). */
  const quelle = z.m.geschaetzt ? undefined : quelleFuer(z, data)
  const jahr = new Date().getFullYear().toString()
  const datum = z.am.startsWith(jahr) ? datumKurz(z.am).slice(0, 6) : datumKurz(z.am)
  const abgeloest = Boolean(z.m.ersetzt || z.m.zurueckgezogen)
  const belege = z.m.belege?.length ? z.m.belege : quelle ? [quelle] : []
  return (
    <li className="flex flex-col gap-1 border-t border-ak-linie py-2 first:border-t-0">
      {/* Kopfzeile: Datum, Art und Quellen — der Text darunter hat die volle Breite. */}
      <span className="flex items-baseline gap-2">
        <span className="shrink-0 text-xs tabular-nums text-ak-leise">{datum}</span>
        <span className={`shrink-0 rounded px-1.5 text-xs ${NEWS_FARBE[z.m.art]}`}>{t(`news.art.${z.m.art}` as TranslationKey)}</span>
        {/* Eine geschätzte Meldung zeigt keine Quelle — die Seite dahinter nennt den Termin nicht. */}
        {!z.m.geschaetzt && <QuellenZeile belege={belege} />}
      </span>
      <span className={`text-sm ${abgeloest ? 'text-ak-leise line-through' : 'text-ak-text'}`}>{newsSatz(z.m)}</span>
      {/* **Lange Vermerke nur aufgeklappt**: Der erste Satz steht da, der
          Rest hinter „mehr" — dieselbe Regel wie im Antwortkasten. */}
      {z.m.hinweis && <Klapptext text={z.m.hinweis} className="text-[11px] text-ak-leise" />}
      {abgeloest && <AbgeloestHinweis m={z.m} />}
    </li>
  )
}

/** Meldungen, die einen Termin nennen — sie veralten mit ihm. */
const TERMIN_ARTEN = new Set<NewsMeldung['art']>(['angekuendigt', 'disc', 'kino'])

/**
 * Was das Panel an News zeigt: **nur der eigene Titel** — bei Pokémon standen
 * Meldungen zu „Reisen" und „Horizonte" im Panel von „Generationen" —, **kein vorbeigegangener
 * Termin** und **kein kommender, den das Panel schon als Termin zeigt** (jedes Release des Titels
 * steht dort als Pille, Disc oder Kino). Neueste zuerst.
 */
export function meldungenImPanel(liste: NewsEintrag[], titelId: number, data: Pick<Dataset, 'releaseBySlug'>, heute: string): Zeile[] {
  const zeilen: Zeile[] = []
  for (const e of liste)
    for (const m of e.meldungen) {
      const teilId = m.teilId ?? e.titelId
      if (teilId !== titelId) continue
      const rel = m.release ? data.releaseBySlug.get(m.release) : undefined
      /*
        Eine **angekündigte** Staffel bleibt sichtbar — sie ist noch kein Termin,
        den das Panel schon zeigt, sondern die Nachricht selbst.
      */
      if (
        TERMIN_ARTEN.has(m.art) &&
        m.datum &&
        (m.datum < heute || (rel && rel.titleId === titelId && !rel.schedule.estimated))
      )
        continue
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
