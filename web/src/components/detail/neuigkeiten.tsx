import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS, type NewsEintrag, type NewsMeldung, type Release } from '@shared/types.ts'
import { loadNews, type Dataset } from '../../lib/data.ts'
import { useLang, type TranslationKey } from '../../lib/i18n.tsx'
import { datumKurz, newsSatz } from '../../lib/news-text.ts'
import { NEWS_FARBE } from '../NewsView.tsx'
import { anzeigeName } from '@shared/titles.ts'

interface Zeile {
  am: string
  m: NewsMeldung
  /** Der Teil der Reihe, den die Meldung betrifft. */
  teilId: number
}

/** Wie viele Meldungen ohne Aufklappen zu sehen sind. */
const SICHTBAR = 3

/**
 * **Die News eines Titels stehen auch in seinem Panel** (Daniel, 27.09.2026: „news section … sodass
 * man solche news dort direkt sieht und zum artikel/quelle der news springen kann"). Gezeigt wird
 * die ganze Reihe — „Staffel 2 angekündigt" gehört auch ins Panel von Staffel 1 —, neueste zuerst.
 */
export function Neuigkeiten({ data, titelId, reihenIds }: { data: Dataset; titelId: number; reihenIds: number[] }) {
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
  const zeilen = useMemo(() => meldungenDerReihe(liste ?? [], new Set([titelId, ...reihenIds])), [liste, titelId, reihenIds])
  if (!zeilen.length) return null
  const gezeigt = alle ? zeilen : zeilen.slice(0, SICHTBAR)
  return (
    <section className="flex flex-col gap-1" aria-label={t('detail.neuigkeiten')}>
      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-ak-leise">{t('detail.neuigkeiten')}</h3>
      <ul className="flex flex-col">
        {gezeigt.map((z, i) => (
          <NeuigkeitZeile key={`${z.am}-${z.teilId}-${z.m.art}-${i}`} z={z} data={data} titelId={titelId} />
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

function NeuigkeitZeile({ z, data, titelId }: { z: Zeile; data: Dataset; titelId: number }) {
  const { t } = useLang()
  const quelle = quelleFuer(z, data)
  const jahr = new Date().getFullYear().toString()
  const datum = z.am.startsWith(jahr) ? datumKurz(z.am).slice(0, 6) : datumKurz(z.am)
  return (
    <li className="flex items-start gap-3 border-t border-ak-linie py-2 first:border-t-0">
      <span className="w-[4.5rem] shrink-0 pt-0.5 text-xs tabular-nums text-ak-leise">{datum}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-1.5 text-xs ${NEWS_FARBE[z.m.art]}`}>{t(`news.art.${z.m.art}` as TranslationKey)}</span>
          {z.teilId !== titelId && <span className="text-xs font-semibold text-ak-text">{z.m.teil ?? teilName(z.teilId, data)}</span>}
        </span>
        <span className="text-sm text-ak-text">{newsSatz(z.m)}</span>
      </span>
      {quelle && (
        <a
          href={quelle.url}
          target="_blank"
          rel="noopener noreferrer"
          title={quelle.name}
          aria-label={t('detail.neuigkeitQuelle', { name: quelle.name })}
          className="flex min-h-11 shrink-0 items-center text-xs font-bold text-ak-akzent-text hover:underline sm:min-h-0"
        >
          {t('detail.quelleKurz')} ↗
        </a>
      )}
    </li>
  )
}

/** Alle Meldungen, deren Teil zur Reihe gehört — neueste zuerst. */
function meldungenDerReihe(liste: NewsEintrag[], ids: Set<number>): Zeile[] {
  const zeilen: Zeile[] = []
  for (const e of liste)
    for (const m of e.meldungen) {
      const teilId = m.teilId ?? e.titelId
      if (ids.has(teilId)) zeilen.push({ am: e.am, m, teilId })
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

/** Name eines anderen Teils der Reihe, wenn die Meldung keinen eigenen nennt (sie meint dann den Kopf). */
function teilName(id: number, data: Dataset): string {
  const t = data.titleById.get(id)
  return t ? anzeigeName(t) : ''
}
