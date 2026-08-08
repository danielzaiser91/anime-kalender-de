import { useEffect, useState } from 'react'
import type { DubConfidence, Fsk, PlatformId, ReleaseStatus, ReleaseType } from '@shared/types.ts'
import { EMPTY_FILTERS, type FilterState } from './filters.ts'
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

const LIST_KEYS = ['p', 'rt', 'st', 'fsk', 'y', 'g', 'kw'] as const

function splitList(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : []
}

export function parseHash(hash: string): AppRoute {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = raw.split('?')
  const params = new URLSearchParams(queryPart ?? '')
  const view = (VIEWS.find((v) => v.id === pathPart)?.id ?? 'woche') as ViewId

  const filters: FilterState = {
    ...EMPTY_FILTERS,
    platforms: splitList(params.get('p')) as PlatformId[],
    releaseTypes: splitList(params.get('rt')) as ReleaseType[],
    statuses: splitList(params.get('st')) as ReleaseStatus[],
    fsk: splitList(params.get('fsk')).map(Number) as Fsk[],
    years: splitList(params.get('y')).map(Number),
    genres: splitList(params.get('g')),
    keywords: splitList(params.get('kw')),
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
  const lists: Record<(typeof LIST_KEYS)[number], (string | number)[]> = {
    p: f.platforms,
    rt: f.releaseTypes,
    st: f.statuses,
    fsk: f.fsk,
    y: f.years,
    g: f.genres,
    kw: f.keywords,
  }
  for (const key of LIST_KEYS) {
    if (lists[key].length) params.set(key, lists[key].join(','))
  }
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
