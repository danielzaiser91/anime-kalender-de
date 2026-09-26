import { useEffect, useState } from 'react'
import type { DataMeta } from '@shared/types.ts'
import {
  modusVon, type ModusFeld,
  EMPTY_FILTERS,
  activeFilterCount,
  filterMode,
  toggleFilter,
  type FilterState,
  type ListKey,
} from '../lib/filters.ts'
import { useLang } from '../lib/i18n.tsx'
import { Chip } from './ui.tsx'
import { KEYWORD_PREVIEW } from './FilterDetails.tsx'
import { FilterDetails } from './FilterDetails.tsx'

/**
 * **Die Eingabe muss laufen, auch wenn die Suche nicht hinterherkommt.**
 *
 * Jeder Tastendruck schrieb direkt in `filters.search` — und daran hängt die
 * Filterung über 2.771 Titel samt allem, was sie zeichnet. Bei schneller
 * Eingabe blockierte das den Haupt-Thread zwischen zwei Anschlägen, und die
 * Tastatur verschluckte Zeichen (Daniel, 12.09.2026: „ich hab gerade was
 * gesucht und es hat extrem gelaggt, sodass tastatur eingaben verschluckt
 * wurden … mach ein input buffer rein, sodass die suche erst anfängt wenn
 * mindestens x ms nix eingegeben wurde").
 *
 * **Zwei Zustände statt einem:** Das Feld zeigt sofort, was getippt wurde —
 * daran darf nie etwas hängen. Gesucht wird erst, wenn `RUHE_MS`
 * vergangen sind, ohne dass eine weitere Taste kam.
 *
 * Die Zahl ist ein Kompromiss, kein Zufall: Deutlich darunter bündelt sie
 * nichts mehr (ein geübter Tipper schlägt alle 120 bis 200 ms an), deutlich
 * darüber fühlt sich die Seite träge an, weil die Trefferliste der Eingabe
 * sichtbar nachläuft.
 */
const RUHE_MS = 250

function Suchfeld({
  wert,
  setzen,
  platzhalter,
}: {
  wert: string
  setzen: (s: string) => void
  platzhalter: string
}) {
  const [getippt, setGetippt] = useState(wert)

  /*
    **Von außen geänderte Suche schlägt die eigene Anzeige.** „Filter
    zurücksetzen" und der Einstieg über eine Adresse mit Suchbegriff setzen
    `filters.search`, ohne dass hier jemand tippt — ohne diesen Abgleich
    stünde danach der alte Text im Feld.
  */
  useEffect(() => {
    setGetippt(wert)
  }, [wert])

  /*
    Der Weckruf wird bei jedem Anschlag neu gestellt; erst wenn einer
    durchläuft, geht der Begriff nach oben. Das Aufräumen in der Rückgabe ist
    der eigentliche Mechanismus, nicht nur Hygiene.
  */
  useEffect(() => {
    if (getippt === wert) return
    const uhr = setTimeout(() => setzen(getippt), RUHE_MS)
    return () => clearTimeout(uhr)
    /* `setzen` ist bei jedem Rendern eine neue Funktion — es gehört nicht in die Liste. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getippt, wert])

  return (
    <input
      type="search"
      value={getippt}
      onChange={(e) => setGetippt(e.target.value)}
      placeholder={platzhalter}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
    />
  )
}

export function FilterBar({
  meta,
  filters,
  onChange,
  showConfidence,
  favoriteCount,
}: {
  meta: DataMeta
  filters: FilterState
  onChange: (next: FilterState) => void
  showConfidence: boolean
  favoriteCount: number
}) {
  const { t, tGenre, tKeyword, tRelease } = useLang()
  const [open, setOpen] = useState(false)
  const [genreQuery, setGenreQuery] = useState('')
  const [keywordQuery, setKeywordQuery] = useState('')
  const [allKeywords, setAllKeywords] = useState(false)
  const [showAllProviders, setShowAllProviders] = useState(false)
  // Auswahlmodus: Ein Klick auf ein Tag wählt es — oder verbietet es.
  const [mode, setMode] = useState<'include' | 'exclude'>('include')
  const count = activeFilterCount(filters)

  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })
  /**
   * Der UND/ODER-Schalter einer Kategorie — nur für Felder, in denen ein Titel
   * mehrere Werte tragen kann. Status und FSK sind einwertig und bekommen
   * deshalb keinen (siehe `ModusFeld` in `filters.ts`).
   */
  const modusVon2 = (feld: ModusFeld, anzahl: number) => ({
    anzahl,
    wert: modusVon(filters, feld),
    setzen: (w: 'und' | 'oder') => set({ modus: { ...filters.modus, [feld]: w } }),
  })

  /** Ein Klick auf ein Tag — der Modus entscheidet, auf welche Seite es geht. */
  const pick = <K extends ListKey>(key: K, value: FilterState[K][number]) =>
    onChange(toggleFilter(filters, key, value, mode))

  /** Zustand eines Tags für die Darstellung. */
  const chipState = <K extends ListKey>(key: K, value: FilterState[K][number]) => {
    const state = filterMode(filters, key, value)
    return { active: state === 'include', excluded: state === 'exclude' }
  }

  const sortedGenres = meta.genres
    .slice()
    .sort((a, b) => tGenre(a).localeCompare(tGenre(b), 'de'))
  const visibleGenres = genreQuery
    ? sortedGenres.filter((g) => tGenre(g).toLowerCase().includes(genreQuery.toLowerCase()))
    : sortedGenres

  const sortedKeywords = meta.keywords
    .slice()
    .sort((a, b) => tKeyword(a).localeCompare(tKeyword(b), 'de'))
  const matchingKeywords = keywordQuery
    ? sortedKeywords.filter((k) => tKeyword(k).toLowerCase().includes(keywordQuery.toLowerCase()))
    : sortedKeywords
  // Gewählte und ausgeschlossene Keywords bleiben immer sichtbar, sonst könnte
  // man ein Verbot setzen und es anschließend nicht mehr finden.
  const setKeywords = [...filters.keywords, ...filters.excluded.keywords]
  const previewKeywords = [
    ...setKeywords,
    ...matchingKeywords.filter((k) => !setKeywords.includes(k)).slice(0, KEYWORD_PREVIEW),
  ]
  const shownKeywords = allKeywords || keywordQuery ? matchingKeywords : previewKeywords
  const hiddenKeywordCount = matchingKeywords.length - previewKeywords.length

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <div className="relative min-w-52 flex-1">
          <Suchfeld wert={filters.search} setzen={(search) => set({ search })} platzhalter={t('filter.search')} />
        </div>

        <Chip
          active={filters.favoritesOnly}
          onClick={() => set({ favoritesOnly: !filters.favoritesOnly })}
          color="#fbbf24"
        >
          ★ {t('filter.favourites')}
          {favoriteCount > 0 && <span className="opacity-60">({favoriteCount})</span>}
        </Chip>

        <Chip
          active={filters.kostenlosOnly}
          onClick={() => set({ kostenlosOnly: !filters.kostenlosOnly })}
          color="#10b981"
          title={t('filter.kostenlosHint')}
        >
          {t('filter.kostenlos')}
        </Chip>

        {/* Nur in der Datenbank sinnvoll: In den Kalenderansichten hat ohnehin
            alles einen Termin, dort wäre der Schalter wirkungslos. */}
        {showConfidence && (
          <Chip
            active={filters.availableOnly}
            onClick={() => set({ availableOnly: !filters.availableOnly })}
            color="#34d399"
            title={t('filter.availableHint')}
          >
            ▶ {t('filter.available')}
          </Chip>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
        >
          {t('filter.button')}
          {count > 0 && (
            <span className="rounded-full bg-sky-700 px-1.5 text-[11px] font-bold text-white">{count}</span>
          )}
          <span aria-hidden="true" className={open ? 'rotate-180 transition' : 'transition'}>
            ▾
          </span>
        </button>

        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            {t('filter.reset')}
          </button>
        )}
      </div>

      {open && (
        <div className="animate-fade-in border-t border-slate-200 dark:border-white/10">
          <FilterDetails
            t={t}
            setMode={setMode}
            mode={mode}
            modusVon2={modusVon2}
            filters={filters}
            meta={meta}
            set={set}
            chipState={chipState}
            pick={pick}
            showConfidence={showConfidence}
            showAllProviders={showAllProviders}
            setShowAllProviders={setShowAllProviders}
            tRelease={tRelease}
            genreQuery={genreQuery}
            setGenreQuery={setGenreQuery}
            visibleGenres={visibleGenres}
            tGenre={tGenre}
            keywordQuery={keywordQuery}
            setKeywordQuery={setKeywordQuery}
            shownKeywords={shownKeywords}
            tKeyword={tKeyword}
            hiddenKeywordCount={hiddenKeywordCount}
            setAllKeywords={setAllKeywords}
            allKeywords={allKeywords}
            matchingKeywords={matchingKeywords}
          />
        </div>
      )}
    </div>
  )
}
