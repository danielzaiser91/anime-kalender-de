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

export type ViewId = 'woche' | 'monat' | 'agenda' | 'datenbank' | 'abo' | 'newsletter' | 'impressum' | 'datenschutz'

export const VIEWS: { id: ViewId; label: string; inNav: boolean }[] = [
  { id: 'woche', label: 'Woche', inNav: true },
  { id: 'monat', label: 'Monat', inNav: true },
  { id: 'agenda', label: 'Agenda', inNav: true },
  { id: 'datenbank', label: 'Datenbank', inNav: true },
  { id: 'abo', label: 'Kalender-Abo', inNav: false },
  { id: 'newsletter', label: 'Newsletter', inNav: false },
  { id: 'impressum', label: 'Impressum', inNav: false },
  { id: 'datenschutz', label: 'Datenschutz', inNav: false },
]

export interface AppRoute {
  view: ViewId
  /** Ankerdatum der Kalenderansichten. */
  date: string
  /** Geöffnetes Detail-Panel. */
  release?: string
  title?: number
  filters: FilterState
}

/**
 * Kurzname je Listenfeld in der Adresse. Der Ausschluss bekommt denselben
 * Namen mit `x` davor — `g=Fantasy&xg=Ecchi` liest sich von selbst.
 */
const LIST_PARAM: Record<ListKey, string> = {
  platforms: 'p',
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(lists as any)[key] = NUMERIC_KEYS.has(key) ? raw.map(Number) : raw
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
  const view = (VIEWS.find((v) => v.id === pathPart)?.id ?? 'woche') as ViewId

  const filters: FilterState = {
    ...EMPTY_FILTERS,
    ...readLists(params, ''),
    excluded: readLists(params, 'x'),
    search: params.get('q') ?? '',
    confirmedOnly: params.get('sicher') === '1',
    favoritesOnly: params.get('fav') === '1',
    minConfidence: (params.get('conf') as DubConfidence) ?? 'low',
  }

  return {
    view,
    date: params.get('d') ?? todayIso(),
    release: params.get('r') ?? undefined,
    title: params.get('t') ? Number(params.get('t')) : undefined,
    filters,
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
  if (f.minConfidence !== 'low') params.set('conf', f.minConfidence)
  if (route.date !== todayIso()) params.set('d', route.date)
  if (route.release) params.set('r', route.release)
  if (route.title) params.set('t', String(route.title))

  const query = params.toString()
  return `#/${route.view}${query ? `?${query}` : ''}`
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
function syncSharePath(release: string | undefined): void {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const target = release ? `${base}/r/${encodeURIComponent(release)}/` : `${base}/`
  if (window.location.pathname === target) return
  // Nur innerhalb der eigenen Seite umschreiben. Läuft die App aus einem
  // Unterverzeichnis, das nicht zum Muster passt, bleibt der Pfad unangetastet.
  if (!window.location.pathname.startsWith(`${base}/`)) return
  history.replaceState(history.state, '', target + window.location.search + window.location.hash)
}

export function useRoute(): [AppRoute, (next: Partial<AppRoute>) => void] {
  const [route, setRoute] = useState<AppRoute>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  useEffect(() => {
    syncSharePath(route.release)
  }, [route.release])

  const navigate = (next: Partial<AppRoute>) => {
    const merged: AppRoute = { ...route, ...next }
    const hash = buildHash(merged)
    if (hash !== window.location.hash) window.location.hash = hash
    else setRoute(merged)
  }

  return [route, navigate]
}
