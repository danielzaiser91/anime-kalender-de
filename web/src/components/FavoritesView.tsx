import { useEffect, useMemo, useState } from 'react'
import type { Release, Title } from '@shared/types.ts'
import { loadAllTitles, type Dataset } from '../lib/data.ts'
import { lastEpisodeDate, releaseStatus } from '@shared/logic.ts'
import { addDays, formatDate, todayIso } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'
import { favoritSeit } from '../lib/favorites.ts'
import { DubMark, PlatformBadge, SectionTitle, StatusBadge } from './ui.tsx'

/**
 * Die Favoriten-Seite.
 *
 * Sie beantwortet **eine** Frage zuerst: „Was habe ich verpasst, und was kommt?"
 * Daniel am 29.08.2026: „sodass man schnell sehen kann was man verpasst hat und
 * was noch kommt von den favoriten."
 *
 * Deshalb steht der Zeitstrahl oben, obwohl er nur ein Fünftel der Fläche
 * bekommt — er beantwortet die dringendere Frage. Die Übersicht darunter
 * beantwortet die zweite: „Was habe ich mir eigentlich alles gemerkt?"
 *
 * Der Plan mit allen Vorgaben steht in `docs/favoriten-seite.md`.
 */

const TAGE_ZURUECK = 7
const TAGE_VORAUS = 7

type SortierUnd = 'datum' | 'alphabet' | 'bewertung'
type Kategorie = 'alle' | 'laufend' | 'abgeschlossen' | 'ohne-termin'

interface Zeile {
  title: Title
  releases: Release[]
  /** Der nächste Termin ab heute — die Angabe, für die man herkommt. */
  naechster?: string
  /** Der letzte Termin bis heute, für „zuletzt". */
  letzter?: string
  status: 'laufend' | 'abgeschlossen' | 'ohne-termin'
  hatDeutsch: boolean
}

export function FavoritesView({
  data,
  favorites,
  onToggleFavorite,
  onOpen,
}: {
  data: Dataset
  favorites: Set<number>
  onToggleFavorite: (id: number) => void
  onOpen: (releaseSlug: string) => void
}) {
  const { t } = useLang()
  const heute = todayIso()

  /**
   * **Ein gemerkter Titel darf hier nicht fehlen — auch wenn er keinen Termin hat.**
   *
   * Der Erstaufruf lädt `titles-core.json`: die Titel, auf die ein Release
   * zeigt. Wer einen Anime ohne Termin merkt, hat ihn danach in der
   * Favoritenliste stehen, aber nicht im Index — und die Schleife unten stieg
   * bei `!title` still aus.
   *
   * Gemessen am 29.08.2026 an der Live-Seite: Von fünf gesetzten Favoriten
   * erschienen **zwei**. Death Note, Jujutsu Kaisen und One Punch Man stehen im
   * Vollbestand und fehlten im Kern. Der Stern ließ sich setzen, die Seite
   * verschwieg ihn — genau der Fehler, den dieses Projekt an fremden Quellen
   * bemängelt.
   *
   * Nachgeladen wird nur, wenn wirklich einer fehlt. Bei den meisten Besuchern
   * passiert also nichts; wer Titel ohne Termin merkt, zahlt einmal für die
   * größere Datei. `loadAllTitles` hält seine Zusage selbst fest, ein zweiter
   * Aufruf kostet nichts.
   */
  const [nachgeladen, setNachgeladen] = useState(0)
  const fehlt = useMemo(
    () => [...favorites].some((id) => !data.titleById.has(id)),
    // `nachgeladen` steht bewusst in der Liste: Nach dem Abruf ist der Index
    // ein anderer, und ohne das Signal würde React den alten Wert behalten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [favorites, data, nachgeladen],
  )
  useEffect(() => {
    if (!fehlt) return
    let abgemeldet = false
    void loadAllTitles(data).then(() => {
      if (!abgemeldet) setNachgeladen((n) => n + 1)
    })
    return () => {
      abgemeldet = true
    }
  }, [fehlt, data])
  const [sortierUnd, setSortierUnd] = useState<SortierUnd>('datum')
  const [kategorie, setKategorie] = useState<Kategorie>('alle')
  const [nurDeutsch, setNurDeutsch] = useState(false)
  const [suche, setSuche] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [offen, setOffen] = useState<number | null>(null)
  /** Zuletzt entfernt — für den Widerruf statt einer Rückfrage. */
  const [entfernt, setEntfernt] = useState<{ id: number; name: string } | null>(null)

  /**
   * Eine Zeile je gemerktem Titel, mit allem, was die Anzeige braucht.
   *
   * Der Status wird **gerechnet**, nicht gelesen: `schedule.lastEpisodeDate` ist
   * bei den meisten Releases nicht gesetzt (siehe CLAUDE.md), und wer sein
   * Fehlen als „läuft noch" auslegt, erklärt jede abgeschlossene Reihe für
   * laufend.
   */
  /**
   * Alle Folgentermine je Titel — einmal gebaut, nicht je Zeile gesucht.
   *
   * `eventsByDate` ist nach Tag geordnet; für die Frage „wann läuft dieser
   * Titel" braucht es die andere Richtung.
   */
  const eventsJeTitel = useMemo(() => {
    const je = new Map<number, string[]>()
    for (const e of data.events) {
      if (!favorites.has(e.titleId)) continue
      const liste = je.get(e.titleId) ?? []
      liste.push(e.date)
      je.set(e.titleId, liste)
    }
    return je
  }, [data.events, favorites])

  const zeilen = useMemo<Zeile[]>(() => {
    const raus: Zeile[] = []
    for (const id of favorites) {
      const title = data.titleById.get(id)
      if (!title) continue
      const releases = data.releasesByTitle.get(id) ?? []
      /*
        **Die Termine kommen aus den Folgen, nicht aus dem Staffelstart.**

        `schedule.firstEpisodeDate` ist der **Beginn** einer Staffel. Bei allem,
        was läuft, liegt der in der Vergangenheit — die Zeile schrieb deshalb
        „zuletzt 02.05.2026" neben ein grünes „läuft", und genau die Frage, für
        die man herkommt („wann kommt die nächste Folge?"), blieb unbeantwortet.
        Im Bildschirmabzug vom 29.08.2026 stand das bei allen drei laufenden
        Titeln.

        `events.json` führt jede einzelne Folge. Das ist dieselbe Quelle, aus der
        der Zeitstrahl darüber liest — und der stimmte von Anfang an.
      */
      const termine = [...(eventsJeTitel.get(id) ?? [])].sort()
      const naechster = termine.find((d) => d >= heute)
      /*
        **Der Kalender führt nicht jede Folge — das Release schon.**

        `events.json` ist die Kalenderansicht und enthält nur, was jemand
        eintragen wollte. Für One Piece steht dort **ein** Termin: der
        20.05.2019, an dem ADN die Serie ins Angebot nahm. Das Release daneben
        trägt 515 Folgen und ein Ende am 25.03.2026.

        Die Zeile schrieb deshalb „zuletzt 20.05.2019" — für den Leser heißt
        das „seit sieben Jahren nichts mehr", und das ist falsch. Gemessen an
        der Live-Seite am 29.08.2026.

        `lastEpisodeDate()` beantwortet es richtig: Sie liest das belegte Ende,
        wo es steht, und rechnet es sonst aus Startdatum, Folgenzahl und
        Sendepausen — nie aus dem Feld allein, das bei den meisten Releases gar
        nicht gesetzt ist (CLAUDE.md).

        Genommen wird das spätere von beidem, aber nur aus der Vergangenheit:
        Ein Release, das noch läuft, hat sein Ende in der Zukunft, und das ist
        kein „zuletzt".
      */
      const ausReleases = releases
        .map((r) => lastEpisodeDate(r))
        .filter((d): d is string => Boolean(d) && d! < heute)
        .sort()
        .at(-1)
      const ausEvents = [...termine].reverse().find((d) => d < heute)
      const letzter =
        ausReleases && ausEvents ? (ausReleases > ausEvents ? ausReleases : ausEvents) : (ausReleases ?? ausEvents)
      /*
        Ein Titel gilt als laufend, wenn **irgendein** Release von ihm läuft.
        Ein künftiger Disc-Termin macht daraus nicht „läuft noch" — dafür fragt
        `releaseStatus` jedes Release einzeln.
      */
      const laufend = releases.some((r) => releaseStatus(r, heute) === 'airing')
      const status = laufend ? 'laufend' : termine.length ? 'abgeschlossen' : 'ohne-termin'
      raus.push({
        title,
        releases,
        naechster,
        letzter,
        status,
        hatDeutsch: (title.streams ?? []).some((s) => s.dub === true),
      })
    }
    return raus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites, data, heute, eventsJeTitel, nachgeladen])

  /** Die vierzehn Tage des Zeitstrahls, mit den Folgen je Tag. */
  const strahl = useMemo(() => {
    const von = addDays(heute, -TAGE_ZURUECK)
    const tage: { datum: string; anzahl: number; namen: string[] }[] = []
    for (let i = 0; i <= TAGE_ZURUECK + TAGE_VORAUS; i++) {
      const datum = addDays(von, i)
      const treffer = (data.eventsByDate.get(datum) ?? []).filter((e) => favorites.has(e.titleId))
      tage.push({
        datum,
        anzahl: treffer.length,
        namen: [...new Set(treffer.map((e) => data.titleById.get(e.titleId)?.titleDe ?? ''))].filter(Boolean),
      })
    }
    return tage
  }, [data, favorites, heute])

  const gefiltert = useMemo(() => {
    const suchtext = suche.trim().toLowerCase()
    return zeilen
      .filter((z) => kategorie === 'alle' || z.status === kategorie)
      .filter((z) => !nurDeutsch || z.hatDeutsch)
      .filter((z) => {
        if (!tagFilter) return true
        return (data.eventsByDate.get(tagFilter) ?? []).some((e) => e.titleId === z.title.id)
      })
      .filter((z) => {
        if (!suchtext) return true
        return [z.title.titleDe, z.title.titleEn, z.title.titleRomaji]
          .filter(Boolean)
          .some((n) => n!.toLowerCase().includes(suchtext))
      })
      .sort((a, b) => {
        if (sortierUnd === 'alphabet') return name(a.title).localeCompare(name(b.title), 'de')
        if (sortierUnd === 'bewertung') return (b.title.score ?? 0) - (a.title.score ?? 0)
        /*
          **Drei Blöcke, nicht ein Datumsvergleich.**

          Ein einfaches Sortieren nach dem nächstbesten Datum stellte am
          29.08.2026 abgeschlossene Titel vom 20.08. über einen, der heute lief —
          weil „zuletzt 20.08." früher ist als „nächste Folge 29.08.". Beide Daten
          sind richtig, sie beantworten nur verschiedene Fragen.

          Wer nach Termin sortiert, will wissen, was als Nächstes kommt. Also:
          erst das Künftige aufsteigend (das Nächste zuerst), dann das
          Vergangene absteigend (das zuletzt Gelaufene zuerst), dann das ohne
          Termin.
        */
        const rang = (z: Zeile) => (z.naechster ? 0 : z.letzter ? 1 : 2)
        if (rang(a) !== rang(b)) return rang(a) - rang(b)
        if (a.naechster && b.naechster) return a.naechster.localeCompare(b.naechster)
        if (a.letzter && b.letzter) return b.letzter.localeCompare(a.letzter)
        return name(a.title).localeCompare(name(b.title), 'de')
      })
  }, [zeilen, kategorie, nurDeutsch, suche, sortierUnd, tagFilter, data])

  /**
   * Nach Reihe gruppiert — „Digimon (7)" statt sieben Zeilen.
   *
   * Reihen mit einem einzigen gemerkten Teil bekommen keinen Gruppenkopf: Eine
   * Überschrift über einer einzelnen Zeile ist keine Gliederung, sondern eine
   * zweite Zeile.
   */
  const gruppen = useMemo(() => {
    const je = new Map<number, Zeile[]>()
    for (const z of gefiltert) {
      const f = z.title.franchiseId ?? z.title.id
      const liste = je.get(f) ?? []
      liste.push(z)
      je.set(f, liste)
    }
    return [...je.values()]
  }, [gefiltert])

  const zahlen = useMemo(
    () => ({
      alle: zeilen.length,
      laufend: zeilen.filter((z) => z.status === 'laufend').length,
      abgeschlossen: zeilen.filter((z) => z.status === 'abgeschlossen').length,
      'ohne-termin': zeilen.filter((z) => z.status === 'ohne-termin').length,
    }),
    [zeilen],
  )

  if (!favorites.size) {
    return (
      <div className="rounded-xl border border-slate-200 p-8 text-center dark:border-white/10">
        <p className="text-slate-600 dark:text-slate-300">{t('fav.emptyTitle')}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('fav.emptyHint')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Zeitstrahl
        tage={strahl}
        heute={heute}
        gewaehlt={tagFilter}
        onWaehlen={(d) => setTagFilter((v) => (v === d ? null : d))}
      />

      <section className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>{t('fav.overview', { count: zahlen.alle })}</SectionTitle>
          {zeilen.length > 20 && (
            <input
              type="search"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={t('fav.search')}
              className="rounded-lg border border-slate-300 bg-transparent px-2.5 py-1 text-sm dark:border-white/15"
            />
          )}
        </div>

        {/* Die Zahlen sind zugleich der Filter — eine Angabe, die man ohnehin liest. */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(['alle', 'laufend', 'abgeschlossen', 'ohne-termin'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKategorie(k)}
              className={[
                'cursor-pointer rounded-lg border px-2.5 py-1 text-xs transition',
                kategorie === k
                  ? 'border-sky-500 bg-sky-500/10 font-medium text-slate-900 dark:text-white'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-white/15 dark:text-slate-300',
              ].join(' ')}
            >
              {t(`fav.cat.${k}`)} <span className="tabular-nums opacity-70">{zahlen[k]}</span>
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">{t('fav.sort')}</span>
            <select
              value={sortierUnd}
              onChange={(e) => setSortierUnd(e.target.value as SortierUnd)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-transparent px-2 py-1 dark:border-white/15"
            >
              <option value="datum">{t('fav.sort.date')}</option>
              <option value="alphabet">{t('fav.sort.alpha')}</option>
              <option value="bewertung">{t('fav.sort.score')}</option>
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={nurDeutsch}
              onChange={(e) => setNurDeutsch(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-sky-500"
            />
            <span className="text-slate-600 dark:text-slate-300">{t('fav.onlyDub')}</span>
          </label>
          {tagFilter && (
            <button
              type="button"
              onClick={() => setTagFilter(null)}
              className="cursor-pointer text-sky-500 hover:underline"
            >
              {t('fav.dayFilter', { datum: formatDate(tagFilter) })} ✕
            </button>
          )}
        </div>

        {!gefiltert.length ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('fav.noMatch')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {gruppen.map((gruppe) => (
              <Gruppe
                key={gruppe[0].title.id}
                zeilen={gruppe}
                offen={offen}
                onOeffnen={setOffen}
                onOpen={onOpen}
                onEntfernen={(z) => {
                  onToggleFavorite(z.title.id)
                  setEntfernt({ id: z.title.id, name: name(z.title) })
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/*
        Widerruf statt Rückfrage: Eine Sicherheitsabfrage bei einer Handlung, die
        man mehrmals am Tag macht, ist Belästigung — ein Rückgängig-Streifen ist
        es nicht.
      */}
      {entfernt && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm shadow-lg dark:border-white/15 dark:bg-slate-900">
          <span className="text-slate-700 dark:text-slate-200">{t('fav.removed', { name: entfernt.name })}</span>
          <button
            type="button"
            onClick={() => {
              onToggleFavorite(entfernt.id)
              setEntfernt(null)
            }}
            className="cursor-pointer font-medium text-sky-500 hover:underline"
          >
            {t('fav.undo')}
          </button>
          <button
            type="button"
            onClick={() => setEntfernt(null)}
            className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function name(t: Title): string {
  return t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id)
}

/**
 * Vierzehn Tage auf einen Blick.
 *
 * **Vergangenes und Künftiges sehen verschieden aus**, und das ist der ganze
 * Zweck — dieselbe Farbe für beides verschenkt die halbe Aussage.
 *
 * **Aber die Seite sagt nicht „verpasst".** Daniel am 29.08.2026: „verpasst
 * kannst du intern markieren aber nicht schreiben, weil es eine assumption ist,
 * du kannst nicht wissen was nutzer gesehen haben oder nicht." Er hat recht: Wir
 * kennen die Termine, nicht den Abend des Lesers. „Erschienen" ist eine Tatsache
 * und sagt genau so viel; wer etwas davon nachholen will, sieht es sofort.
 *
 * **Leere Tage bleiben stehen.** Ein Zeitstrahl, der nur belegte Tage zeigt,
 * verliert seinen Maßstab — dann sagt der Abstand zwischen zwei Marken nichts
 * mehr.
 */
function Zeitstrahl({
  tage,
  heute,
  gewaehlt,
  onWaehlen,
}: {
  tage: { datum: string; anzahl: number; namen: string[] }[]
  heute: string
  gewaehlt: string | null
  onWaehlen: (datum: string) => void
}) {
  const { t } = useLang()
  const erschienen = tage.filter((d) => d.datum < heute).reduce((n, d) => n + d.anzahl, 0)
  const kommt = tage.filter((d) => d.datum > heute).reduce((n, d) => n + d.anzahl, 0)

  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <SectionTitle>{t('fav.timeline')}</SectionTitle>
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {t('fav.missed', { count: erschienen })}
        </span>
        <span className="text-xs text-sky-600 dark:text-sky-400">{t('fav.upcoming', { count: kommt })}</span>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {tage.map((d) => {
          const istHeute = d.datum === heute
          const vergangen = d.datum < heute
          const aktiv = gewaehlt === d.datum
          return (
            <button
              key={d.datum}
              type="button"
              onClick={() => d.anzahl && onWaehlen(d.datum)}
              disabled={!d.anzahl}
              title={d.namen.join(', ')}
              className={[
                'flex min-w-[42px] flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition',
                d.anzahl ? 'hover:bg-slate-100 dark:hover:bg-white/5' : 'cursor-default',
                aktiv ? 'bg-slate-100 dark:bg-white/10' : '',
                istHeute ? 'ring-1 ring-slate-400 dark:ring-white/40' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'text-[10px] tabular-nums',
                  istHeute ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
              >
                {d.datum.slice(8)}.{d.datum.slice(5, 7)}.
              </span>
              <span
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                  !d.anzahl
                    ? 'bg-slate-200/60 text-transparent dark:bg-white/5'
                    : vergangen
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      : istHeute
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-sky-500/20 text-sky-700 dark:text-sky-300',
                ].join(' ')}
              >
                {d.anzahl || '·'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Eine Reihe mit ihren gemerkten Teilen — flach, ohne zweite Einrückung. */
function Gruppe({
  zeilen,
  offen,
  onOeffnen,
  onOpen,
  onEntfernen,
}: {
  zeilen: Zeile[]
  offen: number | null
  onOeffnen: (id: number | null) => void
  onOpen: (slug: string) => void
  onEntfernen: (z: Zeile) => void
}) {
  const { t } = useLang()
  const mehrere = zeilen.length > 1

  return (
    <div className={mehrere ? 'rounded-lg bg-slate-50 p-2 dark:bg-white/[0.03]' : ''}>
      {mehrere && (
        <p className="mb-1 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {t('fav.series', { count: zeilen.length })}
        </p>
      )}
      <div className="flex flex-col">
        {zeilen.map((z) => (
          <TitelZeile
            key={z.title.id}
            zeile={z}
            offen={offen === z.title.id}
            onOeffnen={() => onOeffnen(offen === z.title.id ? null : z.title.id)}
            onOpen={onOpen}
            onEntfernen={() => onEntfernen(z)}
          />
        ))}
      </div>
    </div>
  )
}

function TitelZeile({
  zeile,
  offen,
  onOeffnen,
  onOpen,
  onEntfernen,
}: {
  zeile: Zeile
  offen: boolean
  onOeffnen: () => void
  onOpen: (slug: string) => void
  onEntfernen: () => void
}) {
  const { t } = useLang()
  const { title, releases, naechster, letzter } = zeile
  const seit = favoritSeit(title.id)

  return (
    <div className="border-b border-slate-200 last:border-0 dark:border-white/10">
      <div className="flex items-center gap-2 py-1.5">
        <button
          type="button"
          onClick={onOeffnen}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-white">{name(title)}</span>
          {zeile.hatDeutsch && <DubMark dub />}
          <StatusBadge status={zeile.status === 'laufend' ? 'airing' : 'abgeschlossen'} small />
        </button>

        {/* Der nächste Termin steht in der Zeile — dafür kommt man her. */}
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {naechster ? formatDate(naechster) : letzter ? `zuletzt ${formatDate(letzter)}` : '—'}
        </span>

        <button
          type="button"
          onClick={onEntfernen}
          title={t('fav.remove')}
          className="shrink-0 cursor-pointer px-1 text-slate-400 transition hover:text-amber-500"
        >
          ★
        </button>
      </div>

      {offen && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pb-2 pl-1 text-xs text-slate-500 sm:grid-cols-3 dark:text-slate-400">
          <Angabe label={t('fav.savedSince')} wert={seit ? formatDate(seit) : t('fav.savedLong')} />
          <Angabe label={t('fav.year')} wert={title.jpYear ? String(title.jpYear) : '—'} />
          <Angabe label={t('fav.episodes')} wert={title.episodes ? String(title.episodes) : '—'} />
          <Angabe label={t('fav.score')} wert={title.score ? `${title.score} %` : '—'} />
          <Angabe label={t('fav.studio')} wert={(title.studios ?? [])[0] ?? '—'} />
          <Angabe
            label={t('fav.where')}
            wert={
              (title.streams ?? []).length ? (
                <span className="flex flex-wrap gap-1">
                  {(title.streams ?? []).map((s) => (
                    <PlatformBadge key={s.url} platform={s.platform} small />
                  ))}
                </span>
              ) : (
                '—'
              )
            }
          />
          {releases.length > 0 && (
            <div className="col-span-full mt-1">
              <button
                type="button"
                onClick={() => onOpen(releases[0].slug)}
                className="cursor-pointer text-sky-500 hover:underline"
              >
                {t('fav.details')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Angabe({ label, wert }: { label: string; wert: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-slate-700 dark:text-slate-200">{wert}</span>
    </div>
  )
}
