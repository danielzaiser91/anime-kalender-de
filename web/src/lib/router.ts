import { useCallback, useEffect, useState } from 'react'
import type { DubConfidence } from '@shared/types.ts'
import {
  EMPTY_FILTERS,
  LIST_KEYS,
  emptyLists,
  type FilterLists,
  type FilterState,
  type ListKey,
} from './filters.ts'
import { FSK_COLORS, PLATFORMS, RELEASE_TYPES, STATUS_LABEL } from '@shared/types.ts'
import { todayIso } from '@shared/time.ts'
import { vorliebenLesen, vorliebenNachfuehren } from './vorlieben.ts'
import { kalenderBasis } from './kalender-filter.ts'
import { HERKUENFTE } from './herkunft.ts'

/** Woche und Monat haben ihre Filter nicht in der Adresse (`kalender-filter.ts`). */
const istKalender = (view: ViewId): boolean => view === 'woche' || view === 'monat'

export type ViewId =
  | 'woche'
  | 'monat'
  | 'datenbank'
  | 'news'
  | 'saison'
  | 'abo'
  | 'newsletter'
  | 'quellen'
  | 'impressum'
  | 'datenschutz'
  | 'entdecken'

/** Alle Ansichten; die Navigation (Kalender · Datenbank · News) steht in `Header.tsx`. */
export const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'woche', label: 'Woche' },
  { id: 'monat', label: 'Monat' },
  { id: 'datenbank', label: 'Datenbank' },
  { id: 'news', label: 'News' },
  { id: 'saison', label: 'Saison' },
  { id: 'abo', label: 'Kalender-Abo' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'quellen', label: 'Quellen' },
  { id: 'impressum', label: 'Impressum' },
  { id: 'datenschutz', label: 'Datenschutz' },
  { id: 'entdecken', label: 'Entdecken' },
]

/**
 * **Adressen der entfallenen Reiter** (26.09.2026): Agenda, Favoriten und „Wo sehen?" gibt es nicht
 * mehr, ihre Adressen sind aber veröffentlicht — geteilte Links und Push-Nachrichten, die bis zum
 * Umbau `#/favoriten` trugen. Sie führen dorthin, wo dieselbe Frage jetzt beantwortet wird.
 * Entfernen, wenn keine vor dem 26.09.2026 verschickte Push-Nachricht mehr geöffnet wird
 * (frühestens 31.12.2026).
 */
const ALTE_ANSICHTEN: Record<string, { view: ViewId; favoriten?: true; verfuegbar?: true }> = {
  agenda: { view: 'woche' },
  favoriten: { view: 'woche', favoriten: true },
  wo: { view: 'datenbank', verfuegbar: true },
  /* „Was gucken?“ lag bis 26.10.2026 unter `#/empfehlung`; entfernen frühestens 31.12.2026, wenn kein geteilter Link mehr ankommt. */
  empfehlung: { view: 'entdecken' },
}

export interface AppRoute {
  view: ViewId
  /** Ankerdatum der Kalenderansichten. */
  date: string
  /** Geöffnetes Detail-Panel (unsere Kennung); `disc`: Der Titel wurde über einen Disc-Termin geöffnet, der Kasten startet auf „Disc". */
  title?: number
  disc?: true
  filters: FilterState
  /** Gewählte Sortierung der Datenbank — in der Adresse, damit ein geteilter Link sie mitnimmt (21.09.2026). */
  sort?: DbSort
  /** Schalter der Datenbank in der Adresse (`ohne=1`, `staffeln=0|1`); fehlt der Parameter, gilt die Voreinstellung bzw. der gespeicherte Wert. */
  ohne?: true
  staffeln?: boolean
  /** Gewählter Reiter der Saison-Ansicht (`s=`); ohne Wert „jetzt“. */
  saison?: SaisonReiter
}

export const SAISON_REITER = ['jetzt', 'zuletzt', 'ausblick'] as const
export type SaisonReiter = (typeof SAISON_REITER)[number]

export type DbSort = 'relevanz' | 'titel' | 'jahr' | 'score'
const DB_SORTS: readonly DbSort[] = ['relevanz', 'titel', 'jahr', 'score']

/**
 * Kurzname je Listenfeld in der Adresse. Der Ausschluss bekommt denselben
 * Namen mit `x` davor — `g=Fantasy&xg=Ecchi` liest sich von selbst.
 */
const LIST_PARAM: Record<ListKey, string> = {
  platforms: 'p',
  providers: 'anb',
  releaseTypes: 'rt',
  statuses: 'st',
  fsk: 'fsk',
  years: 'y',
  genres: 'g',
  keywords: 'kw',
  sprecher: 'sp',
  land: 'her',
}

/** Felder, deren Werte Zahlen sind — alle anderen bleiben Zeichenketten. */
const NUMERIC_KEYS = new Set<ListKey>(['fsk', 'years'])

/** Listen mit festem Wertebereich: Eine unbekannte Kennung in der Adresse (`?p=prime`) wird verworfen, sonst bricht die Anzeige der Chips. */
const BEKANNTE_WERTE: Partial<Record<ListKey, Set<string>>> = {
  platforms: new Set(Object.keys(PLATFORMS)),
  releaseTypes: new Set(Object.keys(RELEASE_TYPES)),
  statuses: new Set(Object.keys(STATUS_LABEL)),
  fsk: new Set(Object.keys(FSK_COLORS)),
  land: new Set<string>(HERKUENFTE),
}

function splitList(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : []
}

function readLists(params: URLSearchParams, prefix: '' | 'x'): FilterLists {
  const lists = emptyLists()
  for (const key of LIST_KEYS) {
    const raw = splitList(params.get(prefix + LIST_PARAM[key]))
    const werte = NUMERIC_KEYS.has(key) ? raw.map(Number) : raw
    const bekannt = BEKANNTE_WERTE[key]
    ;(lists as any)[key] = bekannt ? werte.filter((w) => bekannt.has(String(w))) : werte
  }
  /*
    **`disc` ist eine Veröffentlichungsart, keine Plattform** (01.10.2026; am
    Bestand gemessen: 159 = 159, Differenz 0). Ein altes `xp=disc` wandert
    deshalb zu `xrt=disc` — sonst filterte es weiter, ohne sichtbar zu sein.
  */
  const plattformen = lists.platforms as unknown as string[]
  if (plattformen.includes('disc')) {
    ;(lists as any).platforms = plattformen.filter((p) => p !== 'disc')
    const arten = lists.releaseTypes as unknown as string[]
    if (!arten.includes('disc')) arten.push('disc')
  }
  return lists
}

function writeLists(params: URLSearchParams, lists: FilterLists, prefix: '' | 'x'): void {
  for (const key of LIST_KEYS) {
    const values = lists[key]
    if (values.length) params.set(prefix + LIST_PARAM[key], values.join(','))
  }
}

/**
 * **Schalter in der Adresse** (Datenbank: `ohne=1`, `staffeln=0|1`; Saison: `s=zuletzt|ausblick`), damit ein geteilter Link beim Empfänger
 * gleich aussieht. Fehlt der Parameter oder ist der Wert ungültig, gilt still die Voreinstellung bzw. der gespeicherte Wert.
 */
function schalterAusAdresse(params: URLSearchParams, view: ViewId): Pick<AppRoute, 'ohne' | 'staffeln' | 'saison'> {
  const staffeln = params.get('staffeln')
  return {
    ohne: view === 'datenbank' && params.get('ohne') === '1' ? true : undefined,
    staffeln: view === 'datenbank' && (staffeln === '0' || staffeln === '1') ? staffeln === '1' : undefined,
    saison: view === 'saison' ? SAISON_REITER.find((r) => r === params.get('s')) : undefined,
  }
}

function schalterInAdresse(params: URLSearchParams, route: AppRoute): void {
  if (route.view === 'datenbank') {
    if (route.ohne) params.set('ohne', '1')
    if (route.staffeln !== undefined) params.set('staffeln', route.staffeln ? '1' : '0')
  }
  if (route.view === 'saison' && route.saison && route.saison !== 'jetzt') params.set('s', route.saison)
}

export function parseHash(hash: string): AppRoute {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = raw.split('?')
  const params = new URLSearchParams(queryPart ?? '')
  const alt = ALTE_ANSICHTEN[pathPart]
  const view = (alt?.view ?? VIEWS.find((v) => v.id === pathPart)?.id ?? 'woche') as ViewId

  /*
    Die Schnellfilter kommen aus den Vorlieben im Browser. Eine Adresse mit `fav=1` & Co. (Push, alte Links)
    schaltet sie für diese Ansicht zusätzlich ein; sie wird nie mehr geschrieben (`buildHash`).
  */
  const vorlieben = vorliebenLesen()
  const excluded = readLists(params, 'x')
  if (vorlieben.discAus && !excluded.releaseTypes.includes('disc')) excluded.releaseTypes = [...excluded.releaseTypes, 'disc']
  const kalender = istKalender(view)
  /* Im Kalender zählt von der Adresse nur `fav=1` (veröffentlichte Push-Links); Suche und Filter der Datenbank gelten dort nicht. */
  const filters: FilterState = {
    ...EMPTY_FILTERS,
    ...(kalender ? {} : readLists(params, '')),
    excluded: kalender ? { ...EMPTY_FILTERS.excluded, releaseTypes: excluded.releaseTypes.filter((a) => a === 'disc') } : excluded,
    search: kalender ? '' : (params.get('q') ?? ''),
    confirmedOnly: vorlieben.confirmedOnly || (!kalender && params.get('sicher') === '1'),
    favoritesOnly: vorlieben.favoritesOnly || params.get('fav') === '1' || !!alt?.favoriten,
    availableOnly: vorlieben.availableOnly || (!kalender && params.get('wo') === '1') || !!alt?.verfuegbar,
    kostenlosOnly: vorlieben.kostenlosOnly || (!kalender && params.get('frei') === '1'),
    favoritesExcluded: vorlieben.favoritesExcluded, kostenlosExcluded: vorlieben.kostenlosExcluded, confirmedExcluded: vorlieben.confirmedExcluded, availableExcluded: vorlieben.availableExcluded,
    zweitanbieterExcluded: vorlieben.zweitanbieterExcluded,
    minConfidence: kalender ? 'low' : ((params.get('conf') as DubConfidence) ?? 'low'),
  }

  return {
    view,
    date: params.get('d') ?? todayIso(),
    title: params.get('t') ? Number(params.get('t')) : undefined,
    disc: params.get('disc') === '1' ? true : undefined,
    filters,
    sort: DB_SORTS.find((s) => s === params.get('sort')),
    ...schalterAusAdresse(params, view),
  }
}

export function buildHash(route: AppRoute): string {
  const params = new URLSearchParams()
  const f = route.filters
  if (!istKalender(route.view)) {
    writeLists(params, f, '')
    /* „Disc ausblenden" ist eine Vorliebe und steht nicht in der Adresse (`vorlieben.ts`). */
    writeLists(params, { ...f.excluded, releaseTypes: f.excluded.releaseTypes.filter((a) => a !== 'disc') }, 'x')
    if (f.search.trim()) params.set('q', f.search.trim())
    if (f.minConfidence !== 'low') params.set('conf', f.minConfidence)
  }
  if (route.date !== todayIso()) params.set('d', route.date)
  if (route.title) params.set('t', String(route.title))
  if (route.title && route.disc) params.set('disc', '1')
  if (route.sort) params.set('sort', route.sort)
  schalterInAdresse(params, route)

  const query = params.toString()
  return `#/${route.view}${query ? `?${query}` : ''}`
}

/**
 * **Der offene Titel steht im Pfad `/t/<ak>/`, nicht doppelt im Hash** (Stufe 1d, 05.10.2026: eine Adresse für alles,
 * Termin-Adressen `/r/` gibt es nicht mehr).
 */
export function titelAusPfad(pathname: string): number | undefined {
  const basis = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '')
  const m = new RegExp(`^${basis}/t/(\\d+)/?$`).exec(pathname)
  return m?.[1] ? Number(m[1]) : undefined
}

/** Füllt den offenen Titel aus dem Pfad, wenn der Hash keinen nennt. */
export function mitPfad(route: AppRoute, pathname: string): AppRoute {
  return route.title ? route : { ...route, title: titelAusPfad(pathname) }
}

/**
 * **Der Adressbalken bekommt die kurze Fassung.** Eine alte Ansicht
 * (`#/agenda`), ein doppeltes `r=` oder ein Filter an Woche und Monat (alter geteilter Link) wird ersetzt
 * — `replaceState` schreibt keinen Verlaufseintrag und feuert kein `hashchange`.
 */
const KALENDER_FILTER_PARAM = /[?&](q|conf|sicher|wo|frei|ohne|staffeln|x?(p|anb|rt|st|fsk|y|g|kw|sp))=/

export function hashAufraeumen(neu: AppRoute, umg: Umgebung): void {
  const { ort, verlauf } = umg
  if (
    ALTE_ANSICHTEN[ort.hash.replace(/^#\/?/, '').split('?')[0]] ||
    /[?&]r=/.test(ort.hash) ||
    (istKalender(neu.view) && KALENDER_FILTER_PARAM.test(ort.hash))
  )
    verlauf.replaceState(verlauf.state, '', ort.pathname + ort.search + adressHash(neu, ort.pathname))
}

/**
 * Hält den Pfad in der Adressleiste zur geöffneten Karte passend.
 *
 * Hintergrund: Diese App routet über den Hash, und alles hinter dem `#`
 * bekommt kein Server und kein Crawler je zu sehen. Ein kopierter Link der
 * Form `…/#/woche?t=123` kann deshalb prinzipiell keine eigene
 * Vorschau haben — WhatsApp, Discord und Co. fragen dafür `…/` ab und finden
 * dort das Standardbild. Daran lässt sich server-seitig nichts ändern.
 *
 * Was sich ändern lässt: welche Adresse überhaupt in der Leiste steht. Zu
 * jedem Release existiert unter `/r/<slug>/` eine vorgerenderte Seite mit
 * eigenem Titel, Text und Bild. Sobald eine Karte offen ist, schreiben wir
 * genau diesen Pfad in die Adresse — ohne Neuladen, die App läuft weiter.
 * Wer die Adresse dann kopiert, teilt automatisch die Fassung mit Vorschau.
 */
export function syncSharePath(titelSlug?: string, umg: Umgebung = browser()): void {
  const ziel = seitenAdresseFuer(umg.base, umg.ort, titelSlug)
  if (ziel) umg.verlauf.replaceState(umg.verlauf.state, '', ziel)
}

/** Adressleiste und Verlauf des Browsers, einsetzbar für Tests (`base` ohne Schrägstrich am Ende). */
export interface Umgebung {
  ort: { pathname: string; search: string; hash: string }
  verlauf: Pick<History, 'state' | 'replaceState' | 'pushState' | 'back'>
  base: string
}

const browser = (): Umgebung => ({ ort: window.location, verlauf: history, base: import.meta.env.BASE_URL.replace(/\/$/, '') })

/** Die Adresse, die in die Leiste soll — oder nichts, wenn sie schon stimmt oder die Seite nicht zum Muster passt. */
export function seitenAdresseFuer(base: string, ort: { pathname: string; search: string; hash: string }, titelSlug?: string): string | undefined {
  // Nur innerhalb der eigenen Seite umschreiben. Läuft die App aus einem
  // Unterverzeichnis, das nicht zum Muster passt, bleibt der Pfad unangetastet.
  if (!ort.pathname.startsWith(`${base}/`)) return undefined
  const ziel = titelAdresseNeu(zielPfad(titelSlug, base), ort.search, ort.hash, titelSlug)
  return ort.pathname + ort.search + ort.hash === ziel ? undefined : ziel
}

/** Der Hash ohne `t=`: Eine Kennung im Pfad steht nicht noch einmal im Hash (alte Links `#/…?t=<id>` werden so umgeschrieben). */
export function hashOhneTitel(hash: string): string {
  const [pfad, query] = hash.split('?')
  if (!query) return hash
  const params = new URLSearchParams(query)
  params.delete('t')
  const rest = params.toString()
  return rest ? `${pfad}?${rest}` : (pfad ?? '')
}

/** Die Adresse zu einem Titel-Pfad: Ist der Pfad die reine Kennung (`/t/15957/`), fällt `t=` aus dem Hash. */
export function titelAdresseNeu(pfad: string, search: string, hash: string, titelSlug?: string): string {
  return pfad + search + (titelSlug && /^\d+$/.test(titelSlug) ? hashOhneTitel(hash) : hash)
}

/** Der Hash fürs Schreiben: Trägt der Pfad den offenen Titel schon, steht er nicht zusätzlich im Hash. */
export function adressHash(route: AppRoute, pathname = window.location.pathname): string {
  const hash = buildHash(route)
  return route.title && titelAusPfad(pathname) === route.title ? hashOhneTitel(hash) : hash
}

/** Der Pfad zum geöffneten Titel: `/t/<ak>/`. */
function zielPfad(titelSlug?: string, base = import.meta.env.BASE_URL.replace(/\/$/, '')): string {
  return titelSlug ? `${base}/t/${encodeURIComponent(titelSlug)}/` : `${base}/`
}

const panelOffen = (r: Pick<AppRoute, 'title'>) => Boolean(r.title)

/**
 * **Zurück schließt das Panel** (Daniel, 02.10.2026: auf dem Handy sprang „zurück" zur Woche davor
 * oder beendete die App). Der offene Titel steht nur im Pfad, und dessen Umschreiben legt keinen
 * Verlaufseintrag an. Deshalb bekommt das Öffnen einen eigenen Eintrag (`state.panel`); Zurück nimmt
 * ihn weg, und das ✕ geht denselben Schritt, statt einen zweiten Eintrag zu stapeln.
 */
function panelVerlauf(route: AppRoute, next: Partial<AppRoute>, merged: AppRoute, state: { panel?: boolean } | null): 'zurueck' | 'eintrag' | undefined {
  const nurPanel = Object.keys(next).every((k) => k === 'title' || k === 'disc')
  if (panelOffen(route) && !panelOffen(merged) && nurPanel && state?.panel) return 'zurueck'
  if (!panelOffen(route) && panelOffen(merged)) return 'eintrag'
  return undefined
}

/** Ein geteilter Link öffnet direkt ein Panel: darunter liegt die Ansicht ohne Panel, damit Zurück erst das Panel schließt. */
function panelUnterlegen(route: AppRoute): void {
  if (!panelOffen(route) || history.state?.panel) return
  const url = window.location.pathname + window.location.search + window.location.hash
  history.replaceState(null, '', zielPfad(undefined) + window.location.search + buildHash({ ...route, title: undefined, disc: undefined }))
  history.pushState({ panel: true, tief: true }, '', url)
}

/** Ein Navigationsschritt auf der Adressleiste: Panel öffnen/schließen, Ansicht wechseln. */
export function navigiere(route: AppRoute, next: Partial<AppRoute>, merged: AppRoute, umg: Umgebung, setRoute: (r: AppRoute) => void): void {
  const { ort, verlauf: hist, base } = umg
  const art = panelVerlauf(route, next, merged, hist.state)
  /* Ein geteilter Link (Newsletter) hat kein Vorher in der App: ✕ und Klick daneben ersetzen die Adresse, statt zurückzugehen (Daniel, 07.10.2026). */
  if (art === 'zurueck' && hist.state?.tief) {
    hist.replaceState(null, '', zielPfad(undefined, base) + ort.search + adressHash(merged, ort.pathname))
    return setRoute(merged)
  }
  if (art === 'zurueck') return hist.back()
  const hash = adressHash(merged, ort.pathname)
  if (art === 'eintrag') {
    hist.pushState({ panel: true }, '', zielPfad(undefined, base) + ort.search + hash)
    return setRoute(merged)
  }
  /* Der Pfad `/t/<ak>/` des offenen Titels schreibt das Panel selbst; hier nur das Zurücksetzen beim Schließen. */
  if (!merged.title) syncSharePath(undefined, umg)
  if (hash !== ort.hash) ort.hash = hash
  else setRoute(merged)
}

/** Schalter umlegen: die Adresse wird ersetzt (kein Verlaufseintrag, kein `hashchange`). */
export function ersetzeAdresse(merged: AppRoute, umg: Umgebung, setRoute: (r: AppRoute) => void): void {
  const { ort, verlauf } = umg
  verlauf.replaceState(verlauf.state, '', ort.pathname + ort.search + adressHash(merged, ort.pathname))
  setRoute(merged)
}

/**
 * Gleiche Filter behalten ihre Identität: `navigate` und `parseHash` bauen sie bei jedem Schritt neu, und jede Rechnung, die an
 * `route.filters` hängt (Termine, Titelliste), liefe sonst beim Blättern, Umschalten und Panel-Öffnen von vorn (12.10.2026).
 */
function mitStabilenFiltern(alt: AppRoute, neu: AppRoute): AppRoute {
  return JSON.stringify(alt.filters) === JSON.stringify(neu.filters) ? { ...neu, filters: alt.filters } : neu
}

export function useRoute(): [AppRoute, (next: Partial<AppRoute>) => void, (next: Partial<AppRoute>) => void] {
  const [route, setzeRoute] = useState<AppRoute>(() => mitPfad(parseHash(window.location.hash), window.location.pathname))
  const setRoute = useCallback((neu: AppRoute) => setzeRoute((alt) => mitStabilenFiltern(alt, neu)), [])

  useEffect(() => {
    const onChange = () => liesAdresse(browser(), setRoute)
    onChange()
    panelUnterlegen(mitPfad(parseHash(window.location.hash), window.location.pathname))
    /*
      **Auch `popstate`, nicht nur `hashchange`**. `syncSharePath` schreibt nach jedem Hash-Wechsel den
      Pfad auf `/r/<slug>/` um. Zwei Verlaufseinträge unterscheiden sich dann nicht nur im Hash,
      sondern auch im Pfad — beim Zurückgehen feuert der Browser dafür kein `hashchange`, nur
      `popstate`. Feuern beide, setzt React denselben Zustand zweimal; das kostet nichts.
    */
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [setRoute])

  useEffect(() => {
    if (!route.title) syncSharePath()
  }, [route.title])

  const { navigate, ersetze } = schreiber(route, setRoute, browser)
  return [route, navigate, ersetze]
}

/** Die Route aus der Adressleiste lesen, die Adresse dabei aufräumen und die Route setzen. */
export function liesAdresse(umg: Umgebung, setRoute: (r: AppRoute) => void): void {
  const neu = mitPfad(parseHash(umg.ort.hash), umg.ort.pathname)
  hashAufraeumen(neu, umg)
  setRoute(neu)
}

/** Die beiden Schreibwege einer Route: `navigate` legt einen Schritt an, `ersetze` legt Schalter um (kein Verlaufseintrag, kein `hashchange`). */
export function schreiber(route: AppRoute, setRoute: (r: AppRoute) => void, umgebung: () => Umgebung) {
  const navigate = (next: Partial<AppRoute>) => {
    const merged: AppRoute = { ...route, ...next }
    /* Die Filter der Datenbank gehen nicht in den Kalender mit, die des Kalenders nicht in die Datenbank (`App.tsx`). */
    if (istKalender(merged.view)) merged.filters = kalenderBasis(merged.filters)
    /* Ändert sich ein Schnellfilter, wird er zur Vorliebe — vor dem Adresswechsel, den `parseHash` danach liest. */
    vorliebenNachfuehren(route.filters, merged.filters)
    navigiere(route, next, merged, umgebung(), setRoute)
  }
  const ersetze = (next: Partial<AppRoute>) => ersetzeAdresse({ ...route, ...next }, umgebung(), setRoute)
  return { navigate, ersetze }
}
