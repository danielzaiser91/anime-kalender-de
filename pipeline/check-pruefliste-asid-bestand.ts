/**
 * Die aniSearch-Kennung (`asId`) der Prüfliste der Erweiterung stimmt mit dem Titel überein.
 *
 * Anlass (16.10.2026): Die Prüfliste las die Kennung aus `data/anisearch.json` (Schlüssel: AniList-Kennung) und verlor so jeden
 * Titel, der aus aniSearch selbst stammt (id = 10.000.000 + Kennung): der Verweis führte auf die Suche statt auf die Titelseite.
 * Die Kennung steht im Titel (`titles.json`, `anisearchId`); diese Prüfung vergleicht die erzeugten Listen damit.
 * Liest `public/data` und `extension/`, gehört deshalb in `check:bestand`.
 */
import { existsSync, readFileSync } from 'node:fs'

type Titel = { id: number; anisearchId?: number }
type Eintrag = { id?: number; asId?: number | null; staffeln?: { id: number }[] }

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

/** Die Einträge einer Liste, deren Titel zugeordnet ist und deren Kennung vom Titel abweicht. */
function abweichungen(eintraege: [string, number | undefined, number | null | undefined][], titel: Map<number, Titel>): string[] {
  const schlecht: string[] = []
  for (const [name, id, asId] of eintraege) {
    const t = id === undefined ? undefined : titel.get(id)
    if (!t) continue
    if ((asId ?? null) !== (t.anisearchId ?? null)) schlecht.push(`${name} (Titel ${t.id}: Liste ${asId ?? 'null'}, Titel ${t.anisearchId ?? 'null'})`)
  }
  return schlecht
}

const quelle = (datei: string): string => readFileSync(datei, 'utf8')

if (existsSync('public/data/titles.json') && existsSync('public/data/prime-suche.json')) {
  const titel = new Map((JSON.parse(quelle('public/data/titles.json')) as Titel[]).map((t) => [t.id, t]))

  const prime = Object.entries(JSON.parse(quelle('public/data/prime-suche.json')) as Record<string, Eintrag>)
  const primeSchlecht = abweichungen(prime.map(([url, e]) => [url, e.id, e.asId]), titel)
  pruefe('Prime-Suchtreffer: asId = anisearchId des Titels', primeSchlecht.length === 0, primeSchlecht.slice(0, 5).join('; '))
  pruefe('Prime-Suchtreffer: Prüfung nicht leer', prime.some(([, e]) => e.id !== undefined && titel.has(e.id)))

  /* Netflix-Liste: Schlüssel ist die Anbieter-Adresse, der Titel hinter `asId` ist der erste der Staffeln. */
  const netflix = quelle('extension/offene-netflix.js').replace(/^[^{]*=\s*/, '')
  const liste = Object.entries(JSON.parse(netflix) as Record<string, Eintrag>)
  const netflixSchlecht = abweichungen(liste.map(([k, e]) => [k, e.staffeln?.[0]?.id, e.asId]), titel)
  pruefe('Netflix-Liste: asId = anisearchId des Titels', netflixSchlecht.length === 0, netflixSchlecht.slice(0, 5).join('; '))
}

if (fehler > 0) process.exit(1)
console.log('check-pruefliste-asid-bestand: ok')
