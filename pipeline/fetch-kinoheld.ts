/**
 * **kinoheld-Adressen für Kinotermine über DuckDuckGo** (19.09.2026).
 *
 * Der Kino-Banner verlinkt kinoheld („Kinos & Tickets"), weil dort kein bestimmtes Kino
 * vorausgewählt ist (Daniel, 19.09.2026). kinoheld selbst sperrt Agenten (`robots.txt:
 * Disallow: /`) — nachsehen, ob es eine Filmseite gibt, dürfen wir dort nicht. Bis hierhin
 * stand deshalb jede Adresse von Hand im Kinotermin, und fehlende blieben liegen: „Your
 * Name" hatte eine, bei uns stand „sobald es sie gibt".
 *
 * **Woher:** die HTML-Suche von DuckDuckGo (`html.duckduckgo.com/robots.txt`: `Allow: /`;
 * Google, Bing und Brave sperren `/search`, gelesen 19.09.2026). Übernommen wird eine
 * Adresse `kinoheld.de/film/<slug>` nur, wenn jedes Wort des Filmtitels (ab drei Buchstaben)
 * im Slug steht — „Your Name." passt auf `your-name-gestern-heute-und-fuer-immer`, ein
 * fremder Film nicht.
 *
 * Wöchentlich, nur Kinotermine ohne kinoheld-Adresse, 3 s Abstand. Ergebnis:
 * `data/kinoheld.json` — Release-Slug → Adresse; der Bau hängt sie als Quelle an.
 */
import { readJson, writeJson, log, warn } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Release, Title } from '../shared/types.ts'

const ZIEL = 'data/kinoheld.json'
const UA = 'Mozilla/5.0 (anime-kalender-de; https://anime-kalender.de; wöchentlich)'

/** Wörter eines Titels, wie sie in einem kinoheld-Slug stehen. */
export function slugWoerter(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
}

/** Die erste kinoheld-Filmadresse im Suchergebnis, deren Slug alle Titelwörter trägt. */
export function passendeAdresse(html: string, namen: string[]): string | undefined {
  const slugs = [...html.matchAll(/kinoheld\.de(?:%2F|\/)film(?:%2F|\/)([a-z0-9-]+)/g)].map((m) => m[1]!)
  for (const slug of slugs) {
    const teile = new Set(slug.split('-'))
    if (namen.some((n) => slugWoerter(n).length > 0 && slugWoerter(n).every((w) => teile.has(w))))
      return `https://www.kinoheld.de/film/${slug}`
  }
  return undefined
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))

if (process.argv[1]?.endsWith('fetch-kinoheld.ts')) {
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const roh = readJson<Title[] | { titles: Title[] }>('public/data/titles.json', [])
  const titles = new Map((Array.isArray(roh) ? roh : roh.titles).map((t) => [t.id, t]))
  const heute = new Date().toISOString().slice(0, 10)
  const bestand = readJson<Record<string, string>>(ZIEL, {})
  const offen = releases.filter(
    (r) =>
      r.platform === 'kino' &&
      !bestand[r.slug] &&
      !(r.sources ?? []).some((q) => q.includes('kinoheld.de/film/')) &&
      (r.schedule?.firstEpisodeDate ?? '') >= heute,
  )
  let gefunden = 0
  let fehler = 0
  for (const r of offen) {
    const t = titles.get(r.titleId)
    const namen = [...new Set([r.name, t?.titleDe, t?.titleEn].filter((x): x is string => Boolean(x)))]
    try {
      const antwort = await fetch('https://html.duckduckgo.com/html/', {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ q: `kinoheld ${namen[0]}` }),
      })
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`)
      const adresse = passendeAdresse(await antwort.text(), namen)
      if (adresse) {
        bestand[r.slug] = adresse
        gefunden++
        log(`kinoheld: ${r.name} → ${adresse}`)
      }
    } catch (err) {
      fehler++
      warn(`kinoheld ${r.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
    await warte(3000)
  }
  writeJson(ZIEL, bestand, true)
  recordSource('kinoheld', gefunden, fehler ? `${fehler} Suche(n) gescheitert` : undefined, offen.length, true)
  log(`${offen.length} Kinotermine ohne kinoheld-Adresse gesucht, ${gefunden} gefunden → ${ZIEL}`)
}
