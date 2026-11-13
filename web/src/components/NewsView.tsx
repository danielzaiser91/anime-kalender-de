import { useEffect, useMemo, useRef, useState } from 'react'
import { useUeberlaeuft } from '../lib/use-ueberlaeuft.ts'
import { type NewsArt, type NewsEintrag } from '@shared/types.ts'
import { feedUrl, loadNews, type Dataset } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { ohneAusgeblendete } from '../lib/ecchi.ts'
import { coverBild } from '../lib/cover.ts'
import { datumKurz } from '../lib/news-text.ts'
import { todayIso, addDays } from '@shared/time.ts'
import { KinoPlakette } from './news-kachel.tsx'
import { PatchnotesKnopf } from './PatchnotesKnopf.tsx'
import { ohneEingeordnete, verlaeufeAus } from '../lib/news-verlauf.ts'
import { AELTERE_SCHRITT_TAGE, teileGleichmelder } from '../lib/news-gruppen.ts'
import { NewsEintragInhalt } from './news-eintrag.tsx'
import { NewsFilterKnoepfe } from './news-eintrag.tsx'
import { ARTEN, _artenVollstaendig } from './news-eintrag.tsx'
void _artenVollstaendig


/*
  **Wie lange ein Film zurück noch mitläuft.** Ohne belegten letzten Spieltag
  (`cinemaUntil`, aus dem Kinoprogramm) wissen wir nicht, ob er noch läuft. Vier
  Wochen nach dem Start deckt die übliche Auswertung ab; die Karte nennt dann den
  Start, nicht „läuft noch".
*/
const KINO_RUECKBLICK_TAGE = 28

/**
 * **Karussell für Kinofilme, die gerade laufen oder bald starten** (Daniel,
 * 17.09.2026: „füg oben bei news ein karussel hinzu für aktuell laufende und
 * kommende kinofilme").
 *
 * Quelle sind die Kino-Releases des Datensatzes. Laufende stehen vorn, dann die
 * kommenden nach Starttermin. Eine Karte öffnet das Detail-Panel.
 */
export function KinoKarussell({
  data,
  oeffne,
}: {
  data: Dataset
  oeffne: (titelId: number) => void
}): React.JSX.Element | null {
  const { t } = useLang()
  const leiste = useRef<HTMLUListElement>(null); const ueberlaeuft = useUeberlaeuft(leiste, data)
  const heute = todayIso()
  const filme = useMemo(() => {
    const ab = addDays(heute, -KINO_RUECKBLICK_TAGE)
    const jeTitel = new Map<number, { titelId: number; start: string; bis?: string }>()
    for (const r of data.releases) {
      if (r.platform !== 'kino') continue
      const start = r.schedule?.firstEpisodeDate
      if (!start) continue
      if (r.cinemaUntil ? r.cinemaUntil < heute : start < ab) continue
      const bisher = jeTitel.get(r.titleId)
      /* Mehrere Kinotermine eines Titels: ein laufender vor einem kommenden, sonst der nähere. */
      if (bisher) {
        const lief = bisher.start < heute
        const laeuft = start < heute
        const besser = laeuft !== lief ? laeuft : laeuft ? start > bisher.start : start < bisher.start
        if (!besser) continue
      }
      jeTitel.set(r.titleId, { titelId: r.titleId, start, bis: r.cinemaUntil })
    }
    const laufend = [...jeTitel.values()].filter((f) => f.start < heute).sort((a, b) => b.start.localeCompare(a.start))
    const kommend = [...jeTitel.values()].filter((f) => f.start >= heute).sort((a, b) => a.start.localeCompare(b.start))
    return ohneAusgeblendete([...laufend, ...kommend].filter((f) => data.titleById.has(f.titelId)), data.titleById)
  }, [data, heute])

  if (!filme.length) return null

  const blaettern = (richtung: 1 | -1) => {
    const el = leiste.current
    if (el) el.scrollBy({ left: richtung * el.clientWidth * 0.8, behavior: 'smooth' })
  }
  /* Ohne Jahr, solange es das laufende ist — „ab 26.01." im Januar 2027 wäre sonst mehrdeutig. */
  const kurz = (iso: string) => (iso.slice(0, 4) === heute.slice(0, 4) ? datumKurz(iso).slice(0, 6) : datumKurz(iso))

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('news.kino.titel')}
        </h2>
        <div className={ueberlaeuft ? 'hidden gap-1 sm:flex' : 'hidden'}>
          <button
            type="button"
            onClick={() => blaettern(-1)}
            aria-label={t('news.kino.zurueck')}
            className="rounded border border-slate-300 px-2 text-sm text-slate-600 hover:bg-ak-flaeche-2 dark:border-slate-600 dark:text-slate-300"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => blaettern(1)}
            aria-label={t('news.kino.weiter')}
            className="rounded border border-slate-300 px-2 text-sm text-slate-600 hover:bg-ak-flaeche-2 dark:border-slate-600 dark:text-slate-300"
          >
            ›
          </button>
        </div>
      </div>
      <ul ref={leiste} data-kino="" className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {filme.map((f) => {
          const titel = data.titleById.get(f.titelId)!
          const name = titel.titleDe ?? titel.titleEn ?? titel.titleRomaji ?? ''
          const kommt = f.start >= heute
          /* Eine Einzelvorstellung (letzter Spieltag = Start) läuft „am", nicht „ab" (Your Name, CineAnime). */
          const zeile = kommt
            ? t(f.bis === f.start ? 'news.kino.am' : 'news.kino.ab', { d: kurz(f.start) })
            : f.bis
              ? t('news.kino.bis', { d: kurz(f.bis) })
              : t('news.kino.start', { d: kurz(f.start) })
          return (
            <li key={f.titelId} className="w-28 shrink-0 snap-start">
              <button
                type="button"
                onClick={() => oeffne(f.titelId)}
                className="group flex w-full flex-col gap-1 text-left"
              >
                <span className="relative block aspect-[2/3] w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
                  {titel.coverImage && (
                    <img
                      {...coverBild(titel.coverImage, 150)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                  <KinoPlakette kommt={kommt} text={zeile} />
                </span>
                <span className="line-clamp-2 text-xs font-medium text-slate-800 group-hover:underline dark:text-slate-100">
                  {name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function NewsView({ data, oeffne }: { data: Dataset; oeffne: (titelId: number) => void }): React.JSX.Element {
  const { t } = useLang()
  const [meldungen, setMeldungen] = useState<NewsEintrag[] | null>(null)
  const [offen, setOffen] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<NewsArt | null>(null)
  /*
    **Vorn stehen die letzten 14 Tage, Älteres auf Knopfdruck** (Daniel,
    15.09.2026: „news seite auf letzte 14 tage beschränken und für ältere news
    einen button ‚ältere News' anbieten"). Die Filterzähler zählen, was gerade
    gezeigt wird — sonst stünde „Disc 12" über einer Liste mit drei.
  */
  const [aeltereTage, setAeltereTage] = useState(0)
  const [gleichOffen, setGleichOffen] = useState<Set<string>>(new Set())
  const grenze = addDays(todayIso(), -14 - aeltereTage)

  useEffect(() => {
    let abgebrochen = false
    void loadNews().then((liste) => {
      if (!abgebrochen) setMeldungen(liste)
    })
    return () => {
      abgebrochen = true
    }
  }, [])

  /* Überholte Meldungen stehen unter der, die sie überholt hat — nicht mehr in ihrer eigenen Tagesliste. */
  const verlaeufe = useMemo(() => verlaeufeAus(meldungen ?? []), [meldungen])
  const sichtbar = useMemo(
    () => ohneEingeordnete(ohneAusgeblendete((meldungen ?? []).filter((e) => e.am >= grenze), data.titleById), verlaeufe.eingeordnet),
    [meldungen, grenze, verlaeufe, data],
  )
  const aeltereGibtEs = ohneEingeordnete(ohneAusgeblendete(meldungen ?? [], data.titleById), verlaeufe.eingeordnet).some((e) => e.am < grenze)

  /* Wie oft jede Art vorkommt — die Filterleiste zeigt nur, was es gibt. */
  const jeArt = useMemo(() => {
    const zahl = new Map<NewsArt, number>()
    for (const e of sichtbar) for (const m of e.meldungen) zahl.set(m.art, (zahl.get(m.art) ?? 0) + 1)
    return zahl
  }, [sichtbar])

  const tage = useMemo(() => {
    const jeTag = new Map<string, NewsEintrag[]>()
    for (const e of sichtbar) {
      if (filter && !e.meldungen.some((m) => m.art === filter)) continue
      /* Gruppiert wird nach dem Tag, nicht nach dem Zeitstempel — sonst bekäme jede Uhrzeit ihre eigene Überschrift. */
      const tag = e.am.slice(0, 10)
      const liste = jeTag.get(tag) ?? []
      liste.push(e)
      jeTag.set(tag, liste)
    }
    return [...jeTag.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [sichtbar, filter])

  const tagName = (iso: string): string =>
    iso === todayIso() ? `${datumKurz(iso)} · ${t('news.heute')}` : iso === addDays(todayIso(), -1) ? `${datumKurz(iso)} · ${t('news.gestern')}` : datumKurz(iso)

  const schluessel = (e: NewsEintrag): string => `${e.am}|${e.titelId}`

  const umschalten = (e: NewsEintrag): void => {
    /*
      **Eine einzelne Meldung öffnet den Teil, zu dem sie gehört.**

      Der Klick führte auf den Reihenkopf — und im Panel stand die Meldung dann
      nirgends. Für „Mononoke" bündelt die Zeile auf „The Phantom in the Rain",
      der Termin am 29.09.2026 gehört aber zu „Chapter III"; wer klickte,
      landete bei einem Titel ohne diesen Termin.

      Die aufgeklappten Zeilen konnten das längst (`m.teilId ?? e.titelId`) —
      nur die Kopfzeile nicht.

      **Bei mehreren Meldungen bleibt es beim Aufklappen.** Sie können zu
      verschiedenen Teilen gehören; einen davon zu wählen wäre geraten.
    */
    if (e.meldungen.length < 2) {
      oeffne(e.meldungen[0]?.teilId ?? e.titelId)
      return
    }
    setOffen((alt) => {
      const neu = new Set(alt)
      const k = schluessel(e)
      if (!neu.delete(k)) neu.add(k)
      return neu
    })
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-3 py-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {t('news.titel')} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">· {t('news.seit', { datum: datumKurz(grenze) })}</span>
        </h1>
        <a href={feedUrl('news.xml')} className="ak-tz text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400" title={t('news.rssHint')}>
          RSS
        </a>
      </div>
      <PatchnotesKnopf stand={data.meta.patchnotesStand} />
      <KinoKarussell data={data} oeffne={oeffne} />

      {/* Filterleiste: nur Arten, die wirklich vorkommen (ein leerer Filter ist eine Sackgasse). py-2.5 fängt die 44-px-Trefferfläche (.ak-tz::after) ein, sonst scrollt die Leiste senkrecht; auf dem Handy eine rollbare Reihe statt vier Zeilen Chips. */}
      {meldungen && meldungen.length > 0 && (
        <div className="-mx-3 -mt-2.5 mb-0.5 flex gap-1 overflow-x-auto px-3 py-2.5 max-sm:pr-8 max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <NewsFilterKnoepfe setFilter={setFilter} filter={filter} t={t} jeArt={jeArt} />
        </div>
      )}

      {meldungen && !tage.length && <p className="text-sm text-slate-500 dark:text-slate-400">{t('news.leer')}</p>}

      {tage.map(([tag, alle]) => {
        const { normal, gleich } = teileGleichmelder(alle)
        const liste = gleichOffen.has(tag) ? [...normal, ...gleich] : normal
        return (
        <div key={tag} className="mb-4">
          <h3 className="sticky top-0 z-10 bg-slate-50/90 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur dark:bg-slate-950/90 dark:text-slate-400">
            {tagName(tag)}
          </h3>
          {/*
            **Drei Zeilen je Eintrag, zwei Einträge nebeneinander** (Daniel,
            15.09.2026, mit Bild: „platz reicht kaum für diese news zeile - news
            3-zeilig machen. dann sollten auch 2 news nebeneinander passen").
            Titel, Teil und Kurzform standen in einer Zeile, und der Teil
            („Mononoke – The Movie: Chapter III – Der Fluch der Schlange")
            drückte den Titel zusammen. Jetzt hat jede Angabe ihre Zeile, die Chips
            stehen neben der Kurzform.
          */}
          <ul className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {liste.map((e) => {
              const auf = offen.has(schluessel(e))
              const sortiert = [...e.meldungen].sort((a, b) => ARTEN.indexOf(a.art) - ARTEN.indexOf(b.art))
              const erste = sortiert[0]!
              /* Ein Chip je Art, mit Zähler erst ab zwei — „Disc 1" sagt nichts. */
              const arten = ARTEN.map((a) => [a, sortiert.filter((m) => m.art === a).length] as const).filter(
                ([, n]) => n > 0,
              )
              return (
                <li key={schluessel(e)} className="min-w-0 border-b border-slate-100 dark:border-slate-800/70">
                  <NewsEintragInhalt
                    umschalten={umschalten}
                    e={e}
                    auf={auf}
                    erste={erste}
                    t={t}
                    arten={arten}
                    sortiert={sortiert}
                    oeffne={oeffne}
                    verlaeufe={verlaeufe}
                  />
                </li>
              )
            })}
          </ul>
          {gleich.length > 0 && (
            <button
              type="button"
              aria-expanded={gleichOffen.has(tag)}
              onClick={() => setGleichOffen((alt) => { const neu = new Set(alt); if (!neu.delete(tag)) neu.add(tag); return neu })}
              className="mt-1 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs text-slate-600 transition hover:bg-ak-flaeche-2 dark:border-slate-700 dark:text-slate-300"
            >
              {gleichOffen.has(tag) ? t('news.gleichZu') : t('news.gleich', { n: gleich.length })}
            </button>
          )}
        </div>
        )
      })}

      {aeltereGibtEs && (
        <button
          type="button"
          onClick={() => setAeltereTage((n) => n + AELTERE_SCHRITT_TAGE)}
          className="mt-1 w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 transition hover:bg-ak-flaeche-2 dark:border-slate-700 dark:text-slate-300"
        >
          {t('news.aeltere', { datum: datumKurz(addDays(grenze, -AELTERE_SCHRITT_TAGE)) })}
        </button>
      )}
    </section>
  )
}
