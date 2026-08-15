import { useMemo, useState } from 'react'
import { PLATFORMS, type Title } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import { useLang } from '../lib/i18n.tsx'
import { DubMark, Tooltip } from './ui.tsx'

/**
 * „Wo kann ich das sehen?" — der Kalender von der anderen Seite gelesen.
 *
 * Die Kalenderansichten beantworten *wann*. Für die große Mehrheit der Titel
 * ist das aber die falsche Frage: Nur gut hundert der 2.753 Anime haben
 * überhaupt einen anstehenden Termin, alles andere ist längst erschienen und
 * liegt in irgendeinem Katalog. Wer „Cowboy Bebop auf Deutsch" sucht, will
 * wissen, wo — nicht wann.
 *
 * Deshalb sortiert diese Ansicht nach **Anbieter** statt nach Datum, und
 * trennt Ansehen von Kaufen: Ein Abo-Stream und eine DVD für 30 € sind zwei
 * verschiedene Antworten, auch wenn beide „verfügbar" heißen.
 */

/** Ein Verweis auf einen Titel bei einem Anbieter. */
interface Eintrag {
  title: Title
  url: string
  dub?: boolean
}

interface Anbieter {
  key: string
  name: string
  color: string
  kind: 'stream' | 'buy'
  eintraege: Eintrag[]
}

/** Wie viele Titel je Anbieter ohne Klick zu sehen sind. */
const VORSCHAU = 24

/**
 * Farbe eines Anbieters, der keine eigene `PlatformId` hat.
 *
 * Viele `watchLinks` sind Weiterverkäufe bekannter Dienste — „Crunchyroll über
 * Prime Video" ist Crunchyroll, und die orangene Marke daneben hilft beim
 * Wiedererkennen mehr als ein weiteres Grau. Findet sich kein Bezug, bleibt es
 * neutral; eine erfundene Hausfarbe wäre eine Behauptung über eine fremde Marke.
 */
function farbeFuer(name: string): string {
  const klein = name.toLowerCase()
  for (const [id, p] of Object.entries(PLATFORMS)) {
    if (id === 'unbekannt' || id === 'disc' || id === 'kino') continue
    if (klein.startsWith(p.name.toLowerCase())) return p.color
  }
  return '#94a3b8'
}

/**
 * Alle Bezugswege nach Anbieter gebündelt.
 *
 * Zwei Quellen fließen zusammen: `streams` (die großen Plattformen, mit
 * belegtem oder offenem Synchro-Stand) und `watchLinks` (alles andere, was
 * aniSearch kennt — Amazon, maxdome, Apple TV). Der Synchro-Stand fehlt bei
 * `watchLinks` grundsätzlich: Sie stammen aus einer Verfügbarkeitsliste, die
 * über Sprachfassungen nichts sagt.
 *
 * Gebündelt wird über **Name und Zugangsart**, nicht über die Herkunft der
 * Angabe. Sonst stünde „Prime Video" zweimal in der Liste — einmal mit 231
 * Einträgen aus `streams`, einmal mit sechs aus `watchLinks` — und der Leser
 * hielte die kleinere Zahl für einen anderen Dienst. Die Zugangsart bleibt
 * dabei trennend: „YouTube" zum Ansehen und „YouTube" zum Kaufen sind zwei
 * verschiedene Antworten.
 */
function nachAnbieter(titles: Title[]): Anbieter[] {
  const map = new Map<string, Anbieter>()

  const hole = (name: string, color: string, kind: 'stream' | 'buy'): Anbieter => {
    const key = `${kind}:${name.toLowerCase()}`
    let a = map.get(key)
    if (!a) {
      a = { key, name, color, kind, eintraege: [] }
      map.set(key, a)
    }
    return a
  }

  for (const title of titles) {
    for (const s of title.streams) {
      const p = PLATFORMS[s.platform] ?? PLATFORMS.unbekannt
      // `disc` und `kino` stehen an Releases, nicht an Stream-Verweisen — der
      // Zweig greift nur, falls das je jemand ändert.
      const kind = s.platform === 'disc' ? 'buy' : 'stream'
      hole(p.name, p.color, kind).eintraege.push({ title, url: s.url, dub: s.dub })
    }
    for (const w of title.watchLinks ?? []) {
      hole(w.name, farbeFuer(w.name), w.kind).eintraege.push({ title, url: w.url })
    }
  }

  return [...map.values()]
    .map((a) => ({
      ...a,
      /**
       * Doppelte wegwerfen — dieselbe Adresse zum selben Titel kann aus beiden
       * Quellen kommen. Der Eintrag mit belegtem Synchro-Stand gewinnt: Er
       * weiß mehr, und ein „?" daneben machte die Auskunft wieder unsicher.
       */
      eintraege: [
        ...a.eintraege
          .reduce((acc, e) => {
            const k = `${e.title.id}|${e.url}`
            const bisher = acc.get(k)
            if (!bisher || (bisher.dub === undefined && e.dub !== undefined)) acc.set(k, e)
            return acc
          }, new Map<string, Eintrag>())
          .values(),
      ].sort((x, y) => anzeigeName(x.title).localeCompare(anzeigeName(y.title), 'de')),
    }))
    .sort((a, b) => b.eintraege.length - a.eintraege.length)
}

function AnbieterKarte({
  anbieter,
  onOpenTitle,
}: {
  anbieter: Anbieter
  onOpenTitle: (id: number) => void
}) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  const [sichtbar, setSichtbar] = useState(VORSCHAU)

  const bilanz = useMemo(() => {
    let ja = 0
    let nein = 0
    let offen = 0
    for (const e of anbieter.eintraege) {
      if (e.dub === true) ja++
      else if (e.dub === false) nein++
      else offen++
    }
    return { ja, nein, offen }
  }, [anbieter])

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-white/[0.06]"
      >
        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: anbieter.color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {anbieter.name}
          </span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
            {anbieter.eintraege.length === 1
              ? t('where.titleOne')
              : t('where.titles', { count: anbieter.eintraege.length.toLocaleString('de-DE') })}
          </span>
        </span>

        {/* Die Bilanz nur dort, wo es überhaupt eine gibt: Bei den
            Weiterverkäufern ist jeder Eintrag offen, dreimal dieselbe Zahl
            sagt nichts. */}
        {bilanz.ja > 0 && (
          <span className="flex shrink-0 items-center gap-2 text-[11px]">
            {bilanz.ja > 0 && (
              <Tooltip text={t('where.tallyYes')} seite="oben">
                <span className="font-semibold text-emerald-500">✓ {bilanz.ja}</span>
              </Tooltip>
            )}
            {bilanz.offen > 0 && (
              <Tooltip text={t('where.tallyOpen')} seite="oben">
                <span className="text-slate-400">? {bilanz.offen}</span>
              </Tooltip>
            )}
          </span>
        )}

        <span className={`shrink-0 text-slate-400 transition ${offen ? 'rotate-90' : ''}`} aria-hidden="true">
          ›
        </span>
      </button>

      {offen && (
        <div className="border-t border-slate-200 px-3 py-2 dark:border-white/10">
          <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-3">
            {anbieter.eintraege.slice(0, sichtbar).map((e) => (
              <li key={`${e.title.id}-${e.url}`} className="flex items-center gap-2 py-0.5 text-[13px]">
                <DubMark dub={e.dub} />
                <button
                  type="button"
                  onClick={() => onOpenTitle(e.title.id)}
                  className="min-w-0 flex-1 cursor-pointer truncate text-left text-slate-700 hover:text-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:text-slate-300 dark:hover:text-sky-400"
                >
                  {anzeigeName(e.title)}
                </button>
                <Tooltip text={t('where.openAt', { name: anbieter.name })} seite="oben">
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-slate-400 transition hover:text-sky-500"
                    aria-label={t('where.openAt', { name: anbieter.name })}
                  >
                    ↗
                  </a>
                </Tooltip>
              </li>
            ))}
          </ul>
          {sichtbar < anbieter.eintraege.length && (
            <button
              type="button"
              onClick={() => setSichtbar((v) => v + VORSCHAU * 4)}
              className="mt-2 cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200/60 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
            >
              {t('where.more', { count: anbieter.eintraege.length - sichtbar })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function WhereView({
  titles,
  gesamt,
  onOpenTitle,
}: {
  titles: Title[]
  /** Wie viele Anime der Datensatz insgesamt führt — für die Kopfzeile. */
  gesamt: number
  onOpenTitle: (id: number) => void
}) {
  const { t } = useLang()
  const anbieter = useMemo(() => nachAnbieter(titles), [titles])

  const mitWeg = useMemo(
    () => titles.filter((x) => x.streams.length > 0 || (x.watchLinks?.length ?? 0) > 0).length,
    [titles],
  )

  const streams = anbieter.filter((a) => a.kind === 'stream')
  const kauf = anbieter.filter((a) => a.kind === 'buy')

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t('where.summary', {
          mit: mitWeg.toLocaleString('de-DE'),
          gesamt: gesamt.toLocaleString('de-DE'),
          anbieter: anbieter.length,
        })}
      </p>

      {[
        { titel: t('where.stream'), hinweis: t('where.streamHint'), liste: streams },
        { titel: t('where.buy'), hinweis: t('where.buyHint'), liste: kauf },
      ].map(
        (block) =>
          block.liste.length > 0 && (
            <section key={block.titel} className="flex flex-col gap-2">
              <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {block.titel}
                <span className="text-[11px] font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
                  {block.hinweis}
                </span>
              </h2>
              <div className="grid gap-2">
                {block.liste.map((a) => (
                  <AnbieterKarte key={a.key} anbieter={a} onOpenTitle={onOpenTitle} />
                ))}
              </div>
            </section>
          ),
      )}

      {anbieter.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
          {t('where.empty')}
        </p>
      )}
    </div>
  )
}
