import {
  type PlatformId,
  PLATFORMS,
  RELEASE_TYPES,
  type ReleaseType,
  type DataMeta,
  type Fsk,
  type ReleaseStatus,
} from '@shared/types.ts'
import { Chip, Tooltip } from './ui.tsx'
import { TIPPFLAECHE_HOCH } from './detail/tippziel.ts'
import { SchnellChips } from './schnellfilter.tsx'
import { FilterSuche, KlickModusLeiste } from './filter/klick-modus.tsx'
import { filterMode, modusVon, toggleFilter, type ModusFeld, type FilterState, type ListKey } from '../lib/filters.ts'
import { nachZahlGeordnet } from '../lib/filter-liste.ts'
import { useGenreSicht } from './filter/genre-sicht.tsx'
import { bereichsSuche,titelWoerter, type BereichsSuche } from '../lib/filter-suche.ts'
import type { Translate } from '../lib/i18n.tsx'
import type { Dispatch, SetStateAction, ReactNode } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { useContext, useState } from 'react'
import { SprecherFilter } from './SprecherFilter.tsx'
import { TitelNamenContext } from '../lib/sprecher.ts'
import { HerkunftZaehlungContext } from '../lib/herkunft-zaehlung.ts'
import { herkunftListe, herkunftName, HerkunftChip, InfoZeichen } from './filter/herkunft-gruppe.tsx'

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
          'rounded px-1.5 py-px text-[9px] uppercase tracking-wider transition ' +
          (wert === w ? 'bg-ak-gewaehlt font-bold text-ak-auf-gewaehlt' : 'font-semibold text-ak-leise hover:text-ak-text')
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
  klasse,
  info,
}: {
  label: string
  /** Erklärung als ⓘ neben der Überschrift. */
  info?: string
  /** Zusätzliche Klassen, z. B. Platz im Raster des Filterkastens. */
  klasse?: string
  children: ReactNode
  modus?: { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
  /** Label und Chips in **einer** Zeile — für kurze Gruppen wie „Schnell". */
  inline?: boolean
  /** Die laufende Filtersuche — hebt Treffer in der Überschrift hervor. */
  suche?: BereichsSuche
}) {
  return (
    <div className={[inline ? 'flex flex-wrap items-center gap-2' : 'flex flex-col gap-1.5', klasse].filter(Boolean).join(' ')}>
      <span className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-ak-leise">
        <BereichsLabel label={label} suche={suche} />
        {info ? <InfoZeichen text={info} /> : null}
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
  klasse,
  info,
  children,
}: {
  label: string
  info?: string
  suche?: BereichsSuche
  texte: (string | undefined)[]
  modus?: { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
  inline?: boolean
  klasse?: string
  children: ReactNode
}) {
  if (suche && !suche.bereich(label, texte)) return null
  return (
    <Group label={label} modus={modus} inline={inline} suche={suche} klasse={klasse} info={info}>
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
 * **Die Schnell-Schalter** — ein Chip je Filter, Logik in `lib/schnellfilter.ts`, Darstellung in `schnellfilter.tsx`.
 * Sie sind Kurzformen echter Filter: Disc, TV und Cartoon zeigen denselben Stand wie ihre Pillen in den Gruppen darunter,
 * und ein Klick an einer Stelle wirkt an der anderen. Das Ziel eines Tipps gibt der Klick-Modus vor.
 */
function SchnellSchalter({
  t,
  filters,
  set,
  mode,
  favoriteCount,
  showConfidence,
  tvAn,
  setTvAn,
  suche,
}: {
  t: Translate
  filters: FilterState
  set: (patch: Partial<FilterState>) => void
  mode: 'include' | 'exclude'
  favoriteCount?: number
  showConfidence: boolean
  tvAn?: boolean
  setTvAn?: (an: boolean) => void
  suche?: BereichsSuche
}) {
  const label = t('filter.schnell')
  const schluessel = ['favoriten', 'cartoon', 'kostenlos', 'tv', 'disc', 'bestaetigt', 'verfuegbar', 'zweitanbieter']
  const texte = schluessel.map((k) => t(`filter.schnell.${k}` as never))
  /* Band über die volle Breite, kein Kasten: hebt die Schnellfilter ab (Mockup „Leiste neu“); Chips bleiben grün/rot. */
  return (
    <div className="border-y border-ak-info bg-ak-info-grund px-3 py-3">
      <Bereich label={label} suche={suche} texte={texte} klasse="[&>div]:gap-y-3">
        <SchnellChips t={t} filters={filters} onChange={(next) => set(next)} mode={mode} favoriteCount={favoriteCount} showConfidence={showConfidence} tvAn={tvAn} setTvAn={setTvAn} zeige={(text) => zeigePille(suche, label, text)} />
      </Bereich>
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
  zwischen,
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
  /** Das Suchfeld unter dem Klick-Modus — durchsucht alle Pillen (01.10.2026). */
  filterQuery: string
  setFilterQuery: Dispatch<SetStateAction<string>>
  platformZaehlung?: Map<PlatformId, number>
  genreListe?: string[]
  genreZaehlung?: Map<string, number>
  /** Abschnitte zwischen Schnell und Gruppen (aktive Filter, Schalter) — sie stehen unter dem festen Klick-Modus. */
  zwischen?: ReactNode
}) {
  const [mehr, setMehr] = useState(false)
  const suche = bereichsSuche(filterQuery)
  const plattformen: PlatformId[] = (platformZaehlung ? nachZahlGeordnet(meta.platforms, platformZaehlung) : meta.platforms).filter((p) => p !== 'disc')
  const genreSicht = useGenreSicht(genreListe, visibleGenres, filters, !!suche, t)
  const mitZahl = (n: number | undefined) => (n ? <span className="opacity-70">{n}</span> : null)
  const plattformLabel = t('filter.platform')
  const genreLabel = t('filter.genre')
  const sichtbarPlattformen = plattformen.filter((p) => zeigePille(suche, plattformLabel, PLATFORMS[p].name))
  return (
    <>
      <KlickModusLeiste t={t} mode={mode} setMode={setMode} />
      <div data-filter-scroll tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <FilterSuche t={t} filterQuery={filterQuery} setFilterQuery={setFilterQuery} />
      <SchnellSchalter
        t={t}
        filters={filters}
        set={set}
        mode={mode}
        favoriteCount={favoriteCount}
        showConfidence={showConfidence}
        tvAn={tvAn}
        setTvAn={setTvAn}
        suche={suche}
      />
      {zwischen}
      {/* Ein Rahmen: das Fenster. Die Gruppen trennen Überschriften; weitere (etwa „Herkunft") reihen sich im Raster ein. */}
      <div className="px-3 py-2.5">
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
            label={genreLabel} klasse="sm:col-start-2 sm:row-span-6"
            suche={suche}
            texte={genreSicht.alle.map((g) => tGenre(g))}
            modus={modusVon2('genres', filters.genres.length)}
          >
            {genreSicht.sichtbar.filter((g) => zeigePille(suche, genreLabel, tGenre(g))).map((g) => (
              <Chip key={g} {...chipState('genres', g)} onClick={() => pick('genres', g)}>
                {tGenre(g)} {mitZahl(genreZaehlung?.get(g))}
              </Chip>
            ))}
            {genreSicht.mehrChip}
          </Bereich>
          <Grundgruppen t={t} meta={meta} filters={filters} modusVon2={modusVon2} chipState={chipState} pick={pick} tRelease={tRelease} suche={suche} set={set} mode={mode} />
        </div>

        {!suche && <MehrKnopf t={t} mehr={mehr} setMehr={setMehr} />}
        {/* **Auch die Filter hinter „mehr Filter" werden durchsucht**:
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
    </>
  )
}

/** Der Knopf „mehr Filter" / „weniger" unter den Grundgruppen. */
function MehrKnopf({ t, mehr, setMehr }: { t: Translate; mehr: boolean; setMehr: Dispatch<SetStateAction<boolean>> }) {
  return (
    <div className="mt-3 border-t border-dashed border-ak-linie pt-3">
      <button
        type="button"
        onClick={() => setMehr(!mehr)}
        aria-expanded={mehr}
        className={`cursor-pointer text-[13px] font-bold text-ak-akzent-text hover:underline ${TIPPFLAECHE_HOCH}`}
      >
        {mehr ? t('filter.weniger') : t('filter.mehr')}
      </button>
    </div>
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

const confidenceText = (t: Translate, i: number) => t('filter.beleg').split('|')[i]!

/**
 * Der Sprecher-Filter als Bereich; die Zahl der gewählten Sprecher steht in der Überschrift, wie der Zähler an „Filter“.
 * Nur in der Datenbank: Dort stellt `App` die Titelnamen bereit (`TitelNamenContext`), im Kalender fehlen sie.
 */
function SprecherBereich({
  t,
  filters,
  set,
  mode,
  suche,
}: Pick<FilterMehrProps, 't' | 'filters' | 'set' | 'suche'> & { mode: 'include' | 'exclude' }) {
  const anzahl = filters.sprecher.length + filters.excluded.sprecher.length
  const label = t('filter.sprecher')
  if (!useContext(TitelNamenContext)) return null
  return (
    <Bereich label={anzahl ? `${label} (${anzahl})` : label} suche={suche} texte={[]}>
      <SprecherFilter filters={filters} onChange={set} mode={mode} />
    </Bereich>
  )
}

/** Die Herkunft des Titels mit Zahl; ohne Zählung der Ansicht (`HerkunftZaehlungContext`) fehlt die Gruppe. */
function HerkunftBereich({ t, filters, chipState, pick, suche }: Pick<FilterMehrProps, 't' | 'filters' | 'chipState' | 'pick' | 'suche'>) {
  const zaehlung = useContext(HerkunftZaehlungContext)
  const liste = zaehlung ? herkunftListe(zaehlung, filters) : []
  if (!zaehlung || !liste.length) return null
  const label = t('filter.herkunft')
  return (
    <Bereich label={label} info={t('filter.herkunft.info')} suche={suche} texte={liste.map((h) => herkunftName(t, h))}>
      {liste.filter((h) => zeigePille(suche, label, herkunftName(t, h))).map((h) => (
        <HerkunftChip key={h} t={t} land={h} anzahl={zaehlung.get(h)} zustand={chipState('land', h)} onClick={() => pick('land', h)} />
      ))}
    </Bereich>
  )
}

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
  set,
  mode,
}: Pick<FilterMehrProps, 't' | 'meta' | 'filters' | 'modusVon2' | 'chipState' | 'pick' | 'tRelease' | 'suche' | 'set'> & { mode: 'include' | 'exclude' }) {
  const artenLabel = t('filter.releaseType')
  const arten = Object.keys(RELEASE_TYPES) as ReleaseType[]
  const fskLabel = t('filter.fsk')
  const jahrLabel = t('filter.year')
  return (
    <>
      <SprecherBereich t={t} filters={filters} set={set} mode={mode} suche={suche} />
      <HerkunftBereich t={t} filters={filters} chipState={chipState} pick={pick} suche={suche} />
      <Bereich label={artenLabel} suche={suche} texte={arten.map((a) => tRelease(a))} modus={modusVon2('releaseTypes', filters.releaseTypes.length)}>
        {arten.filter((a) => zeigePille(suche, artenLabel, tRelease(a))).map((type) => (
          <Chip key={type} color={RELEASE_TYPES[type].color} title={tRelease(type, 'hint')} {...chipState('releaseTypes', type)} onClick={() => pick('releaseTypes', type)}>
            {tRelease(type)}
          </Chip>
        ))}
      </Bereich>

      <Bereich label={fskLabel} suche={suche} texte={FSK_OPTIONS.map((f) => t('filter.fskFrom', { n: f }))}>
        {FSK_OPTIONS.filter((f) => zeigePille(suche, fskLabel, t('filter.fskFrom', { n: f }))).map((f) => (
          <Chip key={f} {...chipState('fsk', f)} onClick={() => pick('fsk', f)}>
            {t('filter.fskFrom', { n: f })}
          </Chip>
        ))}
      </Bereich>

      <Bereich label={jahrLabel} suche={suche} texte={meta.years.map(String)} modus={modusVon2('years', filters.years.length)}>
        {meta.years.filter((y) => zeigePille(suche, jahrLabel, String(y))).map((y) => (
          <Chip key={y} {...chipState('years', y)} onClick={() => pick('years', y)}>
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
          <Chip key={s} {...chipState('statuses', s)} onClick={() => pick('statuses', s)}>
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
            <Chip key={name} color="#34d399" {...chipState('providers', name)} onClick={() => pick('providers', name)}>
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
              <Chip key={c} active={filters.minConfidence === c} onClick={() => set({ minConfidence: c })}>
                {text}
              </Chip>
            ))}
        </Bereich>
      )}

      <div className="sm:col-span-2 xl:col-span-1">
        <Bereich label={keywordLabel} suche={suche} texte={meta.keywords.map(tKeyword)} modus={modusVon2('keywords', filters.keywords.length)}>
          {shownKeywords.map((k) => (
            <Chip key={k} {...chipState('keywords', k)} onClick={() => pick('keywords', k)}>
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
  zwischen,
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
  zwischen?: ReactNode
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
      zwischen={zwischen}
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
  /* **Der TV-Schalter und der Plattform-Chip „TV" sind derselbe Filter**:
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
     mehr. */
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
