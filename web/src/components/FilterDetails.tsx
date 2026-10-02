import {
  type PlatformId,
  PLATFORMS,
  RELEASE_TYPES,
  type ReleaseType,
  type DataMeta,
  type Fsk,
  type ReleaseStatus,
} from '@shared/types.ts'
import { Chip, Tooltip, TvZeichen, DiscZeichen } from './ui.tsx'
import { filterMode, modusVon, toggleFilter, type ModusFeld, type FilterState, type ListKey } from '../lib/filters.ts'
import { bereichsSuche, titelWoerter, type BereichsSuche } from '../lib/filter-suche.ts'
import type { Translate } from '../lib/i18n.tsx'
import type { Dispatch, SetStateAction, ReactNode } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { useState } from 'react'

export const FSK_OPTIONS: Fsk[] = [0, 6, 12, 16, 18]

export const STATUS_OPTIONS: ReleaseStatus[] = ['airing', 'tba', 'abgeschlossen', 'erschienen', 'unbekannt']

export const KEYWORD_PREVIEW = 24

export const STATUS_LABEL_KEY = {
  airing: 'status.airing',
  abgeschlossen: 'status.abgeschlossen',
  tba: 'status.tba',
  erschienen: 'status.erschienen',
  unbekannt: 'status.unbekannt',
} as const

/**
 * **Der UND/ODER-Schalter einer Kategorie.**
 *
 * Er erscheint erst ab der zweiten gewählten Pill: Bei einer einzigen bewirkt er
 * nichts, und ein Schalter ohne Wirkung ist Rauschen.
 */
function ModusSchalter({ wert, setzen }: { wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }) {
  const knopf = (w: 'und' | 'oder', text: string, titel: string) => (
    <Tooltip text={titel} eigenerFokus>
      <button
        type="button"
        onClick={() => setzen(w)}
        aria-pressed={wert === w}
        className={
          'rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider transition ' +
          (wert === w ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300')
        }
      >
        {text}
      </button>
    </Tooltip>
  )
  return (
    <span className="ml-1 inline-flex items-center gap-px rounded bg-slate-800/70 p-px">
      {knopf('oder', 'egal', 'Mindestens eines der gewählten')}
      {knopf('und', 'alle', 'Alle gewählten zusammen')}
    </span>
  )
}

/**
 * **Die Überschrift mit hervorgehobener Fundstelle** (01.10.2026).
 *
 * Trifft die Filtersuche ein Wort des Titels, bleibt der ganze Bereich stehen — dann soll man
 * auch sehen, **warum**. Markiert wird nur das ganze Wort: „FSK" leuchtet bei „fsk", nicht bei
 * „fs" (das öffnet den Bereich ohnehin nicht).
 */
function BereichsLabel({ label, suche }: { label: string; suche?: BereichsSuche }) {
  if (!suche) return <>{label}</>
  const treffer = new Set(titelWoerter(suche.query))
  const istTreffer = (wort: string) =>
    titelWoerter(wort).some((w) => treffer.has(w))
  return (
    <>
      {label.split(/([^\p{L}\p{N}]+)/u).map((teil, i) =>
        istTreffer(teil) ? (
          <mark key={i} className="rounded bg-ak-akzent/30 px-0.5 text-ak-text">
            {teil}
          </mark>
        ) : (
          teil
        ),
      )}
    </>
  )
}

export function Group({
  label,
  children,
  modus,
  inline,
  suche,
}: {
  label: string
  children: ReactNode
  modus?: { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
  /** Label und Chips in **einer** Zeile — für kurze Gruppen wie „Schnell". */
  inline?: boolean
  /** Die laufende Filtersuche — hebt Treffer in der Überschrift hervor. */
  suche?: BereichsSuche
}) {
  return (
    <div className={inline ? 'flex flex-wrap items-center gap-2' : 'flex flex-col gap-1.5'}>
      <span className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-ak-leise">
        <BereichsLabel label={label} suche={suche} />
        {modus && modus.anzahl > 1 ? <ModusSchalter wert={modus.wert} setzen={modus.setzen} /> : null}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

/**
 * **Eine Gruppe, die die Filtersuche kennt** — sie verschwindet samt Überschrift, wenn weder ein
 * Pillentext noch ein Titelwort passt. `texte` sind nur die Pillenbeschriftungen zum Prüfen;
 * angezeigt werden die Kinder, die der Aufrufer schon gefiltert hat.
 */
function Bereich({
  label,
  suche,
  texte,
  modus,
  inline,
  children,
}: {
  label: string
  suche?: BereichsSuche
  texte: (string | undefined)[]
  modus?: { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
  inline?: boolean
  children: ReactNode
}) {
  if (suche && !suche.bereich(label, texte)) return null
  return (
    <Group label={label} modus={modus} inline={inline} suche={suche}>
      {children}
    </Group>
  )
}

/** Bleibt diese Pille unter der laufenden Suche stehen? */
function zeigePille(suche: BereichsSuche | undefined, label: string, text: string): boolean {
  return !suche || suche.zeige(label, text)
}

/**
 * **„Meine Anbieter" — die eigenen Abos als ein Klick** (18.09.2026).
 *
 * Wer Netflix und Crunchyroll hat, wählt beide bei jedem Besuch neu aus.
 * Gespeichert wird im Browser, nicht in der Adresse — eine Vorliebe ist keine
 * Ansicht.
 */
const MEINE_ANBIETER = 'meineAnbieter'

function meineAnbieterLesen(verfuegbar: PlatformId[]): PlatformId[] {
  try {
    const roh = JSON.parse(localStorage.getItem(MEINE_ANBIETER) ?? '[]') as unknown
    return Array.isArray(roh) ? verfuegbar.filter((p) => roh.includes(p)) : []
  } catch {
    return []
  }
}

export function MeineAnbieter({
  aktuell,
  verfuegbar,
  setzen,
}: {
  aktuell: PlatformId[]
  verfuegbar: PlatformId[]
  setzen: (platforms: PlatformId[]) => void
}) {
  const { t } = useLang()
  const [gemerkt, setGemerkt] = useState(() => meineAnbieterLesen(verfuegbar))
  const gleich = gemerkt.length === aktuell.length && gemerkt.every((p) => aktuell.includes(p))
  const merken = () => {
    try {
      localStorage.setItem(MEINE_ANBIETER, JSON.stringify(aktuell))
    } catch {
      /* Gesperrter Speicher: dann gilt die Auswahl nur für diesen Besuch. */
    }
    setGemerkt([...aktuell])
  }
  const knopf =
    'cursor-pointer rounded-full border border-dashed border-ak-rand px-2.5 py-0.5 text-xs text-ak-leise transition hover:bg-ak-flaeche-2'
  if (gemerkt.length && !gleich)
    return (
      <button type="button" className={knopf} onClick={() => setzen(gemerkt)} title={gemerkt.map((p) => PLATFORMS[p].name).join(', ')}>
        ★ {t('filter.meineAnbieter')}
      </button>
    )
  if (aktuell.length && !gleich)
    return (
      <button type="button" className={knopf} onClick={merken}>
        ☆ {t('filter.meineAnbieterMerken')}
      </button>
    )
  return null
}

/**
 * **Die Schnell-Schalter** — Schalter (an/aus), nicht vom Klick-Modus betroffen.
 *
 * **Jeder Chip trägt ein Zeichen** (Daniel, 02.10.2026: „finde passende icons für jeden
 * schnellfilter (wie du es bereits bei nur favoriten gemacht hast)"). ★ war der Anfang; die
 * übrigen folgen demselben Muster — ein Zeichen, das die Zeile auf einen Blick lesbar macht.
 *
 * **Die beiden Ausblende-Chips sind Kurzformen echter Filter**, nicht eigene Schalter:
 * „TV-Termine ausblenden" schließt die Plattform „TV" aus, „Disc-Termine ausblenden" die
 * Release-Art „disc". Der zugehörige Chip in seiner Gruppe zeigt deshalb denselben Stand, und ein
 * Klick an einer der beiden Stellen wirkt an der anderen (Daniel, 01.10.2026).
 */
function SchnellSchalter({
  t,
  filters,
  set,
  favoriteCount,
  showConfidence,
  tvAn,
  setTvAn,
  suche,
}: {
  t: Translate
  filters: FilterState
  set: (patch: Partial<FilterState>) => void
  favoriteCount?: number
  showConfidence: boolean
  tvAn?: boolean
  setTvAn?: (an: boolean) => void
  suche?: BereichsSuche
}) {
  const label = t('filter.schnell')
  const discAus = filters.excluded.releaseTypes.includes('disc')
  const texte = [
    t('filter.favourites'),
    t('filter.kostenlos'),
    t('filter.confirmedOnly'),
    t('filter.tvAusblenden'),
    t('filter.discAusblenden'),
    t('filter.available'),
  ]
  return (
    <div className="border-b border-ak-linie px-3 py-2.5">
      <Bereich label={label} suche={suche} texte={texte} inline>
        {zeigePille(suche, label, t('filter.favourites')) && (
          <Chip ton="gruen" active={filters.favoritesOnly} onClick={() => set({ favoritesOnly: !filters.favoritesOnly })}>
            ★ {t('filter.favourites')}
            {favoriteCount ? ` (${favoriteCount})` : ''}
          </Chip>
        )}
        {zeigePille(suche, label, t('filter.kostenlos')) && (
          <Chip ton="gruen" active={filters.kostenlosOnly} onClick={() => set({ kostenlosOnly: !filters.kostenlosOnly })}>
            <span aria-hidden="true">🆓</span> {t('filter.kostenlos')}
          </Chip>
        )}
        {zeigePille(suche, label, t('filter.confirmedOnly')) && (
          <Chip ton="gruen" active={filters.confirmedOnly} onClick={() => set({ confirmedOnly: !filters.confirmedOnly })}>
            <span aria-hidden="true">✓</span> {t('filter.confirmedOnly')}
          </Chip>
        )}
        {setTvAn && zeigePille(suche, label, t('filter.tvAusblenden')) && (
          <Chip ton="gruen" active={tvAn === false} onClick={() => setTvAn(tvAn === false)}>
            <TvZeichen className="size-3 opacity-80" /> {t('filter.tvAusblenden')}
          </Chip>
        )}
        {zeigePille(suche, label, t('filter.discAusblenden')) && (
          <Chip ton="gruen" active={discAus} onClick={() => set(toggleFilter(filters, 'releaseTypes', 'disc', 'exclude'))}>
            <DiscZeichen className="size-3 opacity-80" /> {t('filter.discAusblenden')}
          </Chip>
        )}
        {showConfidence && zeigePille(suche, label, t('filter.available')) && (
          <Chip ton="gruen" active={filters.availableOnly} onClick={() => set({ availableOnly: !filters.availableOnly })}>
            <span aria-hidden="true">▶</span> {t('filter.available')}
          </Chip>
        )}
      </Bereich>
    </div>
  )
}

/**
 * **Klick-Modus und Filter-Suche in einer Zeile** — „Auswählen/Ausschließen" links, rechts das
 * Suchfeld für **alle** Pillen. Es ersetzt die drei einzelnen Suchfelder (Genre, Keyword, …):
 * Wer „fsk" tippt, sieht den FSK-Bereich; wer „fsk" in keiner Pille hat, sieht ihn nicht mehr.
 */
function KlickModusZeile({
  t,
  mode,
  setMode,
  filterQuery,
  setFilterQuery,
}: {
  t: Translate
  mode: 'include' | 'exclude'
  setMode: Dispatch<SetStateAction<'include' | 'exclude'>>
  filterQuery: string
  setFilterQuery: Dispatch<SetStateAction<string>>
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ak-leise">{t('filter.mode')}</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-ak-rand">
        {(['include', 'exclude'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={[
              'cursor-pointer px-3 py-1.5 text-xs font-bold transition',
              mode === m
                ? m === 'exclude'
                  ? 'bg-rose-500 text-white'
                  : 'bg-ak-flaeche text-ak-text'
                : 'text-ak-leise hover:bg-ak-flaeche-2',
            ].join(' ')}
          >
            {m === 'exclude' ? `⊘ ${t('filter.modeExclude')}` : t('filter.modeInclude')}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={filterQuery}
        onChange={(e) => setFilterQuery(e.target.value)}
        placeholder={t('filter.sucheAlle')}
        aria-label={t('filter.sucheAlle')}
        className="ml-auto w-full min-w-0 rounded-md border border-ak-rand bg-ak-flaeche px-2.5 py-1.5 text-xs text-ak-text sm:w-64"
      />
    </div>
  )
}

/**
 * **Was gerade greift, steht als entfernbarer Streifen darüber** — siehe
 * `kalender/AktiveFilter.tsx` (Kalender) bzw. `FilterBar.tsx` (Datenbank).
 */
export function FilterDetails({
  t,
  setMode,
  mode,
  modusVon2,
  filters,
  meta,
  set,
  chipState,
  pick,
  showConfidence,
  showAllProviders,
  setShowAllProviders,
  tRelease,
  visibleGenres,
  tGenre,
  shownKeywords,
  tKeyword,
  hiddenKeywordCount,
  setAllKeywords,
  allKeywords,
  matchingKeywords,
  favoriteCount,
  tvAn,
  setTvAn,
  filterQuery,
  setFilterQuery,
  platformZaehlung,
  genreListe,
  genreZaehlung,
}: {
  t: Translate
  setMode: Dispatch<SetStateAction<'include' | 'exclude'>>
  mode: 'include' | 'exclude'
  modusVon2: (feld: ModusFeld, anzahl: number) => { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
  filters: FilterState
  meta: DataMeta
  set: (patch: Partial<FilterState>) => void
  chipState: <K extends ListKey>(key: K, value: FilterState[K][number]) => { active: boolean; excluded: boolean }
  pick: <K extends ListKey>(key: K, value: FilterState[K][number]) => void
  showConfidence: boolean
  showAllProviders: boolean
  setShowAllProviders: Dispatch<SetStateAction<boolean>>
  tRelease: (type: ReleaseType, variant?: 'name' | 'short' | 'hint') => string
  visibleGenres: string[]
  tGenre: (name: string) => string
  shownKeywords: string[]
  tKeyword: (name: string) => string
  hiddenKeywordCount: number
  setAllKeywords: Dispatch<SetStateAction<boolean>>
  allKeywords: boolean
  matchingKeywords: string[]
  /** Zahl der gemerkten Titel — steht am Favoriten-Chip. */
  favoriteCount?: number
  /** Im Kalender: Schalter fürs Fernsehen und die Zahlen des Zeitraums. */
  tvAn?: boolean
  setTvAn?: (an: boolean) => void
  /** Das Suchfeld in der Klick-Modus-Zeile — durchsucht alle Pillen (01.10.2026). */
  filterQuery: string
  setFilterQuery: Dispatch<SetStateAction<string>>
  platformZaehlung?: Map<PlatformId, number>
  genreListe?: string[]
  genreZaehlung?: Map<string, number>
}) {
  const [mehr, setMehr] = useState(false)
  const plattformen: PlatformId[] = (platformZaehlung ? [...platformZaehlung.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p) : meta.platforms).filter((p) => p !== 'disc')
  const genres = genreListe ?? visibleGenres
  const mitZahl = (n: number | undefined) => (n ? <span className="opacity-60">{n}</span> : null)
  const suche = bereichsSuche(filterQuery)
  const plattformLabel = t('filter.platform')
  const genreLabel = t('filter.genre')
  const sichtbarPlattformen = plattformen.filter((p) => zeigePille(suche, plattformLabel, PLATFORMS[p].name))

  return (
    <>
      <SchnellSchalter
        t={t}
        filters={filters}
        set={set}
        favoriteCount={favoriteCount}
        showConfidence={showConfidence}
        tvAn={tvAn}
        setTvAn={setTvAn}
        suche={suche}
      />

      {/* Klick-Modus in eigener Zeile, darunter der Kasten mit den betroffenen Filtern. */}
      <div className="p-3">
        <div className="rounded-2xl border border-ak-rand bg-ak-flaeche-2 px-3 py-2">
          <KlickModusZeile t={t} mode={mode} setMode={setMode} filterQuery={filterQuery} setFilterQuery={setFilterQuery} />

          <div className="mt-3 rounded-xl border border-ak-rand bg-ak-flaeche p-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Bereich
                label={plattformLabel}
                suche={suche}
                texte={plattformen.map((p) => PLATFORMS[p].name)}
                modus={modusVon2('platforms', filters.platforms.length)}
              >
                <MeineAnbieter
                  aktuell={filters.platforms}
                  verfuegbar={meta.platforms}
                  setzen={(platforms) => set({ platforms })}
                />
                {sichtbarPlattformen.map((p) => (
                  <Chip
                    ton="gruen"
                    key={p}
                    color={PLATFORMS[p].color}
                    {...chipState('platforms', p)}
                    onClick={() => pick('platforms', p)}
                  >
                    {PLATFORMS[p].name} {mitZahl(platformZaehlung?.get(p))}
                  </Chip>
                ))}
              </Bereich>
              <Bereich
                label={genreLabel}
                suche={suche}
                texte={genres.map((g) => tGenre(g))}
                modus={modusVon2('genres', filters.genres.length)}
              >
                {genres.filter((g) => zeigePille(suche, genreLabel, tGenre(g))).map((g) => (
                  <Chip ton="gruen" key={g} {...chipState('genres', g)} onClick={() => pick('genres', g)}>
                    {tGenre(g)} {mitZahl(genreZaehlung?.get(g))}
                  </Chip>
                ))}
              </Bereich>
              <Grundgruppen t={t} meta={meta} filters={filters} modusVon2={modusVon2} chipState={chipState} pick={pick} tRelease={tRelease} suche={suche} />
            </div>

            {!suche && (
              <div className="mt-3 border-t border-dashed border-ak-linie pt-3">
                <button
                  type="button"
                  onClick={() => setMehr(!mehr)}
                  aria-expanded={mehr}
                  className="cursor-pointer text-[13px] font-bold text-ak-akzent-text hover:underline"
                >
                  {mehr ? t('filter.weniger') : t('filter.mehr')}
                </button>
              </div>
            )}
            {/* **Auch die Filter hinter „mehr Filter" werden durchsucht** (Daniel, 01.10.2026):
                Während gesucht wird, klappt die Fläche auf, damit ein Treffer nicht verborgen bleibt. */}
            {(mehr || suche) && (
              <FilterMehr
                t={t}
                meta={meta}
                filters={filters}
                showConfidence={showConfidence}
                modusVon2={modusVon2}
                chipState={chipState}
                pick={pick}
                set={set}
                tRelease={tRelease}
                tKeyword={tKeyword}
                showAllProviders={showAllProviders}
                setShowAllProviders={setShowAllProviders}
                shownKeywords={shownKeywords}
                hiddenKeywordCount={hiddenKeywordCount}
                setAllKeywords={setAllKeywords}
                allKeywords={allKeywords}
                matchingKeywords={matchingKeywords}
                suche={suche}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * **Die weiteren Filter** — erst hinter „mehr Filter". Sie gehören zum selben
 * Klick-Modus wie Anbieter und Genre darüber.
 */
type FilterMehrProps = {
  t: Translate
  meta: DataMeta
  filters: FilterState
  showConfidence: boolean
  modusVon2: (feld: ModusFeld, anzahl: number) => { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
  chipState: <K extends ListKey>(key: K, value: FilterState[K][number]) => { active: boolean; excluded: boolean }
  pick: <K extends ListKey>(key: K, value: FilterState[K][number]) => void
  set: (patch: Partial<FilterState>) => void
  tRelease: (type: ReleaseType, variant?: 'name' | 'short' | 'hint') => string
  tKeyword: (name: string) => string
  showAllProviders: boolean
  setShowAllProviders: Dispatch<SetStateAction<boolean>>
  shownKeywords: string[]
  hiddenKeywordCount: number
  setAllKeywords: Dispatch<SetStateAction<boolean>>
  allKeywords: boolean
  matchingKeywords: string[]
  /** Die laufende Filtersuche — `undefined`, solange nicht gesucht wird. */
  suche?: BereichsSuche
}

const CONFIDENCE_STUFEN = ['low', 'normal', 'high', 'very-high'] as const

const confidenceText = (t: Translate, i: number) => (i === 0 ? t('filter.source') : t('filter.sources', { n: i + 1 }))

/** Release-Art, FSK und Jahr — stehen seit dem 01.10.2026 oben bei Anbietern und Genre. */
function Grundgruppen({
  t,
  meta,
  filters,
  modusVon2,
  chipState,
  pick,
  tRelease,
  suche,
}: Pick<FilterMehrProps, 't' | 'meta' | 'filters' | 'modusVon2' | 'chipState' | 'pick' | 'tRelease' | 'suche'>) {
  const artenLabel = t('filter.releaseType')
  const arten = Object.keys(RELEASE_TYPES) as ReleaseType[]
  const fskLabel = t('filter.fsk')
  const jahrLabel = t('filter.year')
  return (
    <>
      <Bereich label={artenLabel} suche={suche} texte={arten.map((a) => tRelease(a))} modus={modusVon2('releaseTypes', filters.releaseTypes.length)}>
        {arten.filter((a) => zeigePille(suche, artenLabel, tRelease(a))).map((type) => (
          <Chip ton="gruen" key={type} color={RELEASE_TYPES[type].color} title={tRelease(type, 'hint')} {...chipState('releaseTypes', type)} onClick={() => pick('releaseTypes', type)}>
            {tRelease(type)}
          </Chip>
        ))}
      </Bereich>

      <Bereich label={fskLabel} suche={suche} texte={FSK_OPTIONS.map((f) => t('filter.fskFrom', { n: f }))}>
        {FSK_OPTIONS.filter((f) => zeigePille(suche, fskLabel, t('filter.fskFrom', { n: f }))).map((f) => (
          <Chip ton="gruen" key={f} {...chipState('fsk', f)} onClick={() => pick('fsk', f)}>
            {t('filter.fskFrom', { n: f })}
          </Chip>
        ))}
      </Bereich>

      <Bereich label={jahrLabel} suche={suche} texte={meta.years.map(String)} modus={modusVon2('years', filters.years.length)}>
        {meta.years.filter((y) => zeigePille(suche, jahrLabel, String(y))).map((y) => (
          <Chip ton="gruen" key={y} {...chipState('years', y)} onClick={() => pick('years', y)}>
            {y}
          </Chip>
        ))}
      </Bereich>
    </>
  )
}

function FilterMehr(props: FilterMehrProps) {
  const { t, chipState, pick, suche } = props
  const statusLabel = t('filter.status')
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Bereich label={statusLabel} suche={suche} texte={STATUS_OPTIONS.map((s) => t(STATUS_LABEL_KEY[s]))}>
        {STATUS_OPTIONS.filter((s) => zeigePille(suche, statusLabel, t(STATUS_LABEL_KEY[s]))).map((s) => (
          <Chip ton="gruen" key={s} {...chipState('statuses', s)} onClick={() => pick('statuses', s)}>
            {t(STATUS_LABEL_KEY[s])}
          </Chip>
        ))}
      </Bereich>

      <FilterMehrRest {...props} />
    </div>
  )
}

/** Bezugsquelle, Sicherheit und Keywords — der zweite Teil der „mehr Filter"-Fläche. */
function FilterMehrRest(props: FilterMehrProps) {
  const {
    t,
    meta,
    filters,
    showConfidence,
    modusVon2,
    chipState,
    pick,
    set,
    tKeyword,
    showAllProviders,
    setShowAllProviders,
    shownKeywords,
    hiddenKeywordCount,
    setAllKeywords,
    allKeywords,
    matchingKeywords,
    suche,
  } = props
  const providerLabel = t('filter.provider', { count: meta.providers.length })
  const sichtbareAnbieter = suche
    ? meta.providers.filter((p) => zeigePille(suche, providerLabel, p))
    : meta.providers.slice(0, showAllProviders ? undefined : 12)
  const confidenceLabel = t('filter.confidence')
  const keywordLabel = t('filter.keywords', { count: meta.keywords.length })
  return (
    <>
      {meta.providers.length > 0 && (
        <Bereich label={providerLabel} suche={suche} texte={meta.providers} modus={modusVon2('providers', filters.providers.length)}>
          {sichtbareAnbieter.map((name: string) => (
            <Chip ton="gruen" key={name} color="#34d399" {...chipState('providers', name)} onClick={() => pick('providers', name)}>
              {name}
            </Chip>
          ))}
          {!suche && meta.providers.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAllProviders((v) => !v)}
              className="cursor-pointer text-xs text-ak-akzent-text underline-offset-2 hover:underline"
            >
              {showAllProviders ? t('filter.showLess') : t('filter.showMore', { count: meta.providers.length })}
            </button>
          )}
        </Bereich>
      )}

      {showConfidence && (
        <Bereich label={confidenceLabel} suche={suche} texte={CONFIDENCE_STUFEN.map((_, i) => confidenceText(t, i))}>
          {CONFIDENCE_STUFEN.map((c, i) => ({ c, text: confidenceText(t, i) }))
            .filter(({ text }) => zeigePille(suche, confidenceLabel, text))
            .map(({ c, text }) => (
              <Chip ton="gruen" key={c} active={filters.minConfidence === c} onClick={() => set({ minConfidence: c })}>
                {text}
              </Chip>
            ))}
        </Bereich>
      )}

      <div className="sm:col-span-2 xl:col-span-1">
        <Bereich label={keywordLabel} suche={suche} texte={meta.keywords.map(tKeyword)} modus={modusVon2('keywords', filters.keywords.length)}>
          {shownKeywords.map((k) => (
            <Chip ton="gruen" key={k} {...chipState('keywords', k)} onClick={() => pick('keywords', k)}>
              {tKeyword(k)}
            </Chip>
          ))}
          {!suche && hiddenKeywordCount > 0 && (
            <Chip onClick={() => setAllKeywords((v) => !v)}>
              {allKeywords ? t('filter.showLess') : `(…) ${t('filter.showMore', { count: matchingKeywords.length })}`}
            </Chip>
          )}
        </Bereich>
      </div>
    </>
  )
}

/** `FilterDetails` mit eigenem Zustand — Suchfelder, Auswahlmodus und Aufklapper leben hier. */
export function FilterDetailsFeld({
  meta,
  filters,
  onChange,
  showConfidence,
  favoriteCount,
  tvAn,
  setTvAn,
  platformZaehlung,
  genreListe,
  genreZaehlung,
}: {
  meta: DataMeta
  filters: FilterState
  onChange: (next: FilterState) => void
  showConfidence: boolean
  favoriteCount?: number
  tvAn?: boolean
  setTvAn?: (an: boolean) => void
  platformZaehlung?: Map<PlatformId, number>
  genreListe?: string[]
  genreZaehlung?: Map<string, number>
}) {
  const werkzeug = useFilterWerkzeug(meta, filters, onChange, tvAn, setTvAn)
  return (
    <FilterDetails
      {...werkzeug}
      filters={filters}
      meta={meta}
      showConfidence={showConfidence}
      favoriteCount={favoriteCount}
      tvAn={tvAn}
      setTvAn={setTvAn}
      platformZaehlung={platformZaehlung}
      genreListe={genreListe}
      genreZaehlung={genreZaehlung}
    />
  )
}

function useFilterWerkzeug(
  meta: DataMeta,
  filters: FilterState,
  onChange: (next: FilterState) => void,
  /** Nur im Kalender: der Fernseh-Schalter. Er und der Plattform-Chip „TV" sind derselbe Filter. */
  tvAn?: boolean,
  setTvAn?: (an: boolean) => void,
) {
  const { t, tGenre, tKeyword, tRelease } = useLang()
  const [filterQuery, setFilterQuery] = useState('')
  const [allKeywords, setAllKeywords] = useState(false)
  const [showAllProviders, setShowAllProviders] = useState(false)
  // Auswahlmodus: Ein Klick auf ein Tag wählt es — oder verbietet es.
  const [mode, setMode] = useState<'include' | 'exclude'>('include')
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })
  const modusVon2 = (feld: ModusFeld, anzahl: number) => ({
    anzahl,
    wert: modusVon(filters, feld),
    setzen: (w: 'und' | 'oder') => set({ modus: { ...filters.modus, [feld]: w } }),
  })
  /* **Der TV-Schalter und der Plattform-Chip „TV" sind derselbe Filter** (Daniel, 01.10.2026):
     „tv ausblenden ist das selbe wie ausschließen tv". Der Zustand kommt aus dem Schalter, damit
     beide Stellen denselben Stand zeigen und ein Klick an der einen an der anderen wirkt. Das
     „Premieren bleiben sichtbar" (19.09.2026) hängt an `tvAus` und bleibt so erhalten. */
  const istTvChip = (key: ListKey, value: unknown) => key === 'platforms' && value === 'tv' && Boolean(setTvAn)
  const pick = <K extends ListKey>(key: K, value: FilterState[K][number]) => {
    if (istTvChip(key, value)) {
      setTvAn?.(tvAn === false)
      return
    }
    onChange(toggleFilter(filters, key, value, mode))
  }
  const chipState = <K extends ListKey>(key: K, value: FilterState[K][number]) => {
    if (istTvChip(key, value)) return { active: false, excluded: tvAn === false }
    const state = filterMode(filters, key, value)
    return { active: state === 'include', excluded: state === 'exclude' }
  }
  const visibleGenres = meta.genres.slice().sort((a, b) => tGenre(a).localeCompare(tGenre(b), 'de'))
  const suche = bereichsSuche(filterQuery)
  const sortedKeywords = meta.keywords.slice().sort((a, b) => tKeyword(a).localeCompare(tKeyword(b), 'de'))
  /* Die Keywords folgen derselben Suche wie alle Pillen — „stattdessen" kein eigenes Suchfeld
     mehr (Daniel, 01.10.2026). */
  const keywordLabel = t('filter.keywords', { count: meta.keywords.length })
  const matchingKeywords = suche ? sortedKeywords.filter((k) => zeigePille(suche, keywordLabel, tKeyword(k))) : sortedKeywords
  // Gewählte und ausgeschlossene Keywords bleiben immer sichtbar, sonst fände man ein Verbot nicht wieder.
  const setKeywords = [...filters.keywords, ...filters.excluded.keywords]
  const previewKeywords = [...setKeywords, ...matchingKeywords.filter((k) => !setKeywords.includes(k)).slice(0, KEYWORD_PREVIEW)]
  const shownKeywords = allKeywords || suche ? matchingKeywords : previewKeywords
  const hiddenKeywordCount = matchingKeywords.length - previewKeywords.length
  return {
    t, tGenre, tKeyword, tRelease, mode, setMode, modusVon2, set, pick, chipState, showAllProviders, setShowAllProviders,
    visibleGenres, shownKeywords, hiddenKeywordCount, allKeywords, setAllKeywords, matchingKeywords,
    filterQuery, setFilterQuery,
  }
}
