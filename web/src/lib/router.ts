import { useEffect, useState } from 'react'
import type { DubConfidence } from '@shared/types.ts'
import {
  EMPTY_FILTERS,
  LIST_KEYS,
  emptyLists,
  type FilterLists,
  type FilterState,
  type ListKey,
} from './filters.ts'
import { todayIso } from '@shared/time.ts'

export type ViewId =
  | 'woche'
  | 'monat'
  | 'datenbank'
  | 'news'
  | 'abo'
  | 'newsletter'
  | 'quellen'
  | 'impressum'
  | 'datenschutz'

/** Alle Ansichten; die Navigation (Kalender · Datenbank · News) steht in `Header.tsx`. */
export const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'woche', label: 'Woche' },
  { id: 'monat', label: 'Monat' },
  { id: 'datenbank', label: 'Datenbank' },
  { id: 'news', label: 'News' },
  { id: 'abo', label: 'Kalender-Abo' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'quellen', label: 'Quellen' },
  { id: 'impressum', label: 'Impressum' },
  { id: 'datenschutz', label: 'Datenschutz' },
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
}

export interface AppRoute {
  view: ViewId
  /** Ankerdatum der Kalenderansichten. */
  date: string
  /** Geöffnetes Detail-Panel. */
  release?: string
  title?: number
  filters: FilterState
  /** Gewählte Sortierung der Datenbank — in der Adresse, damit ein geteilter Link sie mitnimmt (21.09.2026). */
  sort?: DbSort
}

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
}

/** Felder, deren Werte Zahlen sind — alle anderen bleiben Zeichenketten. */
const NUMERIC_KEYS = new Set<ListKey>(['fsk', 'years'])

function splitList(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : []
}

function readLists(params: URLSearchParams, prefix: '' | 'x'): FilterLists {
  const lists = emptyLists()
  for (const key of LIST_KEYS) {
    const raw = splitList(params.get(prefix + LIST_PARAM[key]))
    ;(lists as any)[key] = NUMERIC_KEYS.has(key) ? raw.map(Number) : raw
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

export function parseHash(hash: string): AppRoute {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = raw.split('?')
  const params = new URLSearchParams(queryPart ?? '')
  const alt = ALTE_ANSICHTEN[pathPart]
  const view = (alt?.view ?? VIEWS.find((v) => v.id === pathPart)?.id ?? 'woche') as ViewId

  const filters: FilterState = {
    ...EMPTY_FILTERS,
    ...readLists(params, ''),
    excluded: readLists(params, 'x'),
    search: params.get('q') ?? '',
    confirmedOnly: params.get('sicher') === '1',
    favoritesOnly: params.get('fav') === '1' || !!alt?.favoriten,
    availableOnly: params.get('wo') === '1' || !!alt?.verfuegbar,
    kostenlosOnly: params.get('frei') === '1',
    minConfidence: (params.get('conf') as DubConfidence) ?? 'low',
  }

  return {
    view,
    date: params.get('d') ?? todayIso(),
    release: params.get('r') ?? undefined,
    title: params.get('t') ? Number(params.get('t')) : undefined,
    filters,
    sort: DB_SORTS.find((s) => s === params.get('sort')),
  }
}

export function buildHash(route: AppRoute): string {
  const params = new URLSearchParams()
  const f = route.filters
  writeLists(params, f, '')
  writeLists(params, f.excluded, 'x')
  if (f.search.trim()) params.set('q', f.search.trim())
  if (f.confirmedOnly) params.set('sicher', '1')
  if (f.favoritesOnly) params.set('fav', '1')
  if (f.availableOnly) params.set('wo', '1')
  if (f.kostenlosOnly) params.set('frei', '1')
  if (f.minConfidence !== 'low') params.set('conf', f.minConfidence)
  if (route.date !== todayIso()) params.set('d', route.date)
  if (route.title) params.set('t', String(route.title))
  if (route.sort) params.set('sort', route.sort)

  const query = params.toString()
  return `#/${route.view}${query ? `?${query}` : ''}`
}

/**
 * **Der offene Titel steht im Pfad, nicht mehr doppelt im Hash** (Daniel, 01.10.2026:
 * `…/r/apothecary-diaries-s3-cour1/#/woche?xp=disc&r=apothecary-diaries-s3-cour1`).
 * Seitwärts geteilte Seiten liegen unter `/r/<slug>/`; diese Adresse trägt den
 * Titel bereits. `parseHash` liest `r`/`t` weiter als Rückfall für alte Links.
 */
export function releaseAusPfad(pathname: string): string | undefined {
  const basis = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '')
  const m = new RegExp(`^${basis}/r/([^/]+)/?$`).exec(pathname)
  return m?.[1] ? decodeURIComponent(m[1]) : undefined
}

/** Füllt den offenen Titel aus dem Pfad, wenn der Hash keinen nennt. */
function mitPfad(route: AppRoute, pathname: string): AppRoute {
  return route.release ? route : { ...route, release: releaseAusPfad(pathname) }
}

/**
 * **Der Adressbalken bekommt die kurze Fassung.** Eine alte Ansicht
 * (`#/agenda`) oder ein doppeltes `r=` wird ersetzt — `replaceState` schreibt
 * keinen Verlaufseintrag und feuert kein `hashchange`.
 */
function hashAufraeumen(neu: AppRoute, hash: string): void {
  if (ALTE_ANSICHTEN[hash.replace(/^#\/?/, '').split('?')[0]] || /[?&]r=/.test(hash))
    history.replaceState(history.state, '', window.location.pathname + window.location.search + buildHash(neu))
}

/**
 * Hält den Pfad in der Adressleiste zur geöffneten Karte passend.
 *
 * Hintergrund: Diese App routet über den Hash, und alles hinter dem `#`
 * bekommt kein Server und kein Crawler je zu sehen. Ein kopierter Link der
 * Form `…/#/woche?r=black-torch` kann deshalb prinzipiell keine eigene
 * Vorschau haben — WhatsApp, Discord und Co. fragen dafür `…/` ab und finden
 * dort das Standardbild. Daran lässt sich server-seitig nichts ändern.
 *
 * Was sich ändern lässt: welche Adresse überhaupt in der Leiste steht. Zu
 * jedem Release existiert unter `/r/<slug>/` eine vorgerenderte Seite mit
 * eigenem Titel, Text und Bild. Sobald eine Karte offen ist, schreiben wir
 * genau diesen Pfad in die Adresse — ohne Neuladen, die App läuft weiter.
 * Wer die Adresse dann kopiert, teilt automatisch die Fassung mit Vorschau.
 */
export function syncSharePath(release: string | undefined, titelSlug?: string): void {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const target = zielPfad(release, titelSlug)
  if (window.location.pathname === target) return
  // Nur innerhalb der eigenen Seite umschreiben. Läuft die App aus einem
  // Unterverzeichnis, das nicht zum Muster passt, bleibt der Pfad unangetastet.
  if (!window.location.pathname.startsWith(`${base}/`)) return
  history.replaceState(history.state, '', target + window.location.search + window.location.hash)
}

/** Der Pfad zur geöffneten Karte; ein Titel ohne Termin hat eine eigene Seite unter `/t/`. */
function zielPfad(release: string | undefined, titelSlug?: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  if (release) return `${base}/r/${encodeURIComponent(release)}/`
  return titelSlug ? `${base}/t/${encodeURIComponent(titelSlug)}/` : `${base}/`
}

const panelOffen = (r: Pick<AppRoute, 'release' | 'title'>) => Boolean(r.release || r.title)

/**
 * **Zurück schließt das Panel** (Daniel, 02.10.2026: auf dem Handy sprang „zurück" zur Woche davor
 * oder beendete die App). Der offene Titel steht nur im Pfad, und dessen Umschreiben legt keinen
 * Verlaufseintrag an. Deshalb bekommt das Öffnen einen eigenen Eintrag (`state.panel`); Zurück nimmt
 * ihn weg, und das ✕ geht denselben Schritt, statt einen zweiten Eintrag zu stapeln.
 */
function panelVerlauf(route: AppRoute, next: Partial<AppRoute>, merged: AppRoute): 'zurueck' | 'eintrag' | undefined {
  const nurPanel = Object.keys(next).every((k) => k === 'release' || k === 'title')
  if (panelOffen(route) && !panelOffen(merged) && nurPanel && history.state?.panel) return 'zurueck'
  if (!panelOffen(route) && panelOffen(merged)) return 'eintrag'
  return undefined
}

/** Ein geteilter Link öffnet direkt ein Panel: darunter liegt die Ansicht ohne Panel, damit Zurück erst das Panel schließt. */
function panelUnterlegen(route: AppRoute): void {
  if (!panelOffen(route) || history.state?.panel) return
  const url = window.location.pathname + window.location.search + window.location.hash
  history.replaceState(null, '', zielPfad(undefined) + window.location.search + buildHash({ ...route, release: undefined, title: undefined }))
  history.pushState({ panel: true }, '', url)
}

export function useRoute(): [AppRoute, (next: Partial<AppRoute>) => void] {
  const [route, setRoute] = useState<AppRoute>(() => mitPfad(parseHash(window.location.hash), window.location.pathname))

  useEffect(() => {
    const onChange = () => {
      const neu = mitPfad(parseHash(window.location.hash), window.location.pathname)
      hashAufraeumen(neu, window.location.hash)
      setRoute(neu)
    }
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
  }, [])

  useEffect(() => {
    syncSharePath(route.release)
  }, [route.release])

  const navigate = (next: Partial<AppRoute>) => {
    const merged: AppRoute = { ...route, ...next }
    const verlauf = panelVerlauf(route, next, merged)
    if (verlauf === 'zurueck') return history.back()
    const hash = buildHash(merged)
    if (verlauf === 'eintrag') {
      history.pushState({ panel: true }, '', zielPfad(merged.release) + window.location.search + hash)
      return setRoute(merged)
    }
    /* Pfad zuerst — ohne `r` im Hash ist `/r/<slug>/` die einzige Spur des Titels. */
    syncSharePath(merged.release)
    if (hash !== window.location.hash) window.location.hash = hash
    else setRoute(merged)
  }

  return [route, navigate]
}
