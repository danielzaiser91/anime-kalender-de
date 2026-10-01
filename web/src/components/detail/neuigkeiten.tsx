import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS, type NewsEintrag, type NewsMeldung, type Release } from '@shared/types.ts'
import { loadNews, type Dataset } from '../../lib/data.ts'
import { useLang, type TranslationKey } from '../../lib/i18n.tsx'
import { datumKurz, newsSatz } from '../../lib/news-text.ts'
import { NEWS_FARBE } from '../NewsView.tsx'
import { AbgeloestHinweis } from '../news-abgeloest.tsx'
import { todayIso } from '@shared/time.ts'
import { Tooltip } from '../ui.tsx'

interface Zeile {
  am: string
  m: NewsMeldung
  /** Der Teil der Reihe, den die Meldung betrifft. */
  teilId: number
}

/** Wie viele Meldungen ohne Aufklappen zu sehen sind. */
const SICHTBAR = 3

/**
 * **Die News eines Titels stehen auch in seinem Panel** (Daniel, 27.09.2026), mit Sprung zur Quelle —
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
  const quelle = quelleFuer(z, data)
  const jahr = new Date().getFullYear().toString()
  const datum = z.am.startsWith(jahr) ? datumKurz(z.am).slice(0, 6) : datumKurz(z.am)
  const abgeloest = Boolean(z.m.ersetzt || z.m.zurueckgezogen)
  return (
    <li className="flex items-start gap-3 border-t border-ak-linie py-2 first:border-t-0">
      <span className="w-[4.5rem] shrink-0 pt-0.5 text-xs tabular-nums text-ak-leise">{datum}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`self-start rounded px-1.5 text-xs ${NEWS_FARBE[z.m.art]}`}>{t(`news.art.${z.m.art}` as TranslationKey)}</span>
        <span className={`text-sm ${abgeloest ? 'text-ak-leise line-through' : 'text-ak-text'}`}>{newsSatz(z.m)}</span>
        {abgeloest && <AbgeloestHinweis m={z.m} />}
      </span>
      {quelle && (
        <Tooltip text={quelle.name} seite="oben" eigenerFokus className="shrink-0">
          <a
            href={quelle.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('detail.neuigkeitQuelle', { name: quelle.name })}
            className="flex min-h-11 shrink-0 items-center text-xs font-bold text-ak-akzent-text hover:underline sm:min-h-0"
          >
            {t('detail.quelleKurz')} ↗
          </a>
        </Tooltip>
      )}
    </li>
  )
}

/** Meldungen, die einen Termin nennen — sie veralten mit ihm. */
const TERMIN_ARTEN = new Set<NewsMeldung['art']>(['angekuendigt', 'disc', 'kino'])

/**
 * Was das Panel an News zeigt (Daniel, 27.09.2026): **nur der eigene Titel** — bei Pokémon standen
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
        den das Panel schon zeigt, sondern die Nachricht selbst (Daniel, 01.10.2026).
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
  const release: Release | undefined = z.m.release
    ? data.releaseBySlug.get(z.m.release)
    : data.releases.find((r) => r.titleId === z.teilId && r.platform === z.m.platform)
  if (!release) return anbieterSeite(z, data)
  const beleg = [...(release.quellen ?? [])].sort((a, b) => b.gesehenAm.localeCompare(a.gesehenAm))[0]
  if (beleg) return { url: beleg.url, name: beleg.name }
  if (release.sources[0]) return { url: release.sources[0], name: new URL(release.sources[0]).hostname.replace(/^www\./, '') }
  if (release.platformUrl) return { url: release.platformUrl, name: PLATFORMS[release.platform]?.name ?? release.platform }
  return anbieterSeite(z, data)
}

/** „Neu auf Deutsch" hängt oft an keinem Release — dann führt die Quelle zur Serie beim Anbieter. */
function anbieterSeite(z: Zeile, data: Dataset): { url: string; name: string } | undefined {
  const stream = data.titleById.get(z.teilId)?.streams?.find((s) => s.platform === z.m.platform && s.url)
  return stream?.url ? { url: stream.url, name: PLATFORMS[stream.platform]?.name ?? stream.platform } : undefined
}
