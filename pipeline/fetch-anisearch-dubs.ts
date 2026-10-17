/**
 * Holt aniSearchs Sprachangaben (`GET /v1/anime/dubs`) und reduziert sie auf das, was der Bau braucht: je Titel-Kennung von uns,
 * ob Deutsch vertont (`d`), geplant (`p`), abgebrochen (`c`) oder nicht genannt (`-`) ist.
 *
 * Anlass (Daniel, 06.10.2026, Handprüfung E/G): Zehn von zehn Titeln, bei denen aniSearch eine deutsche Ausgabe ohne Marke
 * „Synchronisiert" führt, hatten keine deutsche Tonspur — der Dub-Endpunkt bestätigte alle (14 von 14 Urteilen). Daraus folgt die
 * Regel in `bau/ohne-beleg.ts`. Ein Abruf je Stunde mit Token, ohne Token einer je 24 Stunden.
 *
 * Das Token steht in `ANISEARCH_TOKEN`; lokal liest das Skript es aus `my_secrets.md`. Ohne Browser-Kennung antwortet die API mit 423.
 *
 * Aufruf: `npx tsx pipeline/fetch-anisearch-dubs.ts`
 */
import { existsSync, readFileSync } from 'node:fs'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { anisearchBruecke } from './lib/anisearch-katalog-ids.ts'
import { zieheMarkeNach } from './lib/anisearch-marke.ts'

const GEHEIM = 'C:/code/ai/ai helper files/my_secrets.md'

type Sprachen = { dubbed?: string[]; planned?: string[]; canceled?: string[] }

function token(): string | undefined {
  if (process.env.ANISEARCH_TOKEN) return process.env.ANISEARCH_TOKEN
  if (!existsSync(GEHEIM)) return undefined
  const block = readFileSync(GEHEIM, 'utf8').split(/\n## /).find((b) => /aniSearch-API-Token/i.test(b))
  return /([A-Za-z0-9_|.-]{24,})/.exec(block?.split('\n').find((z) => /^-\s*Wert\s*:/i.test(z)) ?? '')?.[1]
}

export function deutschKennzeichen(s: Sprachen | undefined): 'd' | 'p' | 'c' | '-' {
  if (s?.dubbed?.includes('de')) return 'd'
  if (s?.planned?.includes('de')) return 'p'
  if (s?.canceled?.includes('de')) return 'c'
  return '-'
}

async function main(): Promise<void> {
  const t = token()
  const antwort = await fetch('https://api.anisearch.com/v1/anime/dubs', {
    headers: {
      ...(t ? { authorization: `Bearer ${t}` } : {}),
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      accept: 'application/json',
    },
  })
  if (!antwort.ok) {
    warn(`aniSearch-Dubs: HTTP ${antwort.status}`)
    recordSource('anisearch-dubs', 0, `HTTP ${antwort.status}`)
    return
  }
  const alle = (await antwort.json()) as Record<string, Sprachen>
  /* Unsere Titel-Kennung → aniSearch-Kennung; die Handdatei gilt vor der Brücke. */
  const unsere = anisearchBruecke()
  const aus: Record<string, string> = {}
  for (const [id, asId] of [...unsere].sort((a, b) => Number(a[0]) - Number(b[0]))) if (alle[asId]) aus[id] = deutschKennzeichen(alle[asId])
  /* Ein Abruf, der fast nichts liefert, ist kein Befund: der Bau würde sonst Titel ohne Eintrag als „nicht genannt" lesen. */
  if (Object.keys(alle).length < 10000) {
    warn(`aniSearch-Dubs: nur ${Object.keys(alle).length} Einträge, Datei bleibt unverändert`)
    recordSource('anisearch-dubs', 0, 'zu wenige Einträge')
    return
  }
  const ergebnis = schreibeMarken(alle, aus)
  if (!ergebnis) {
    const fehlen = uebernommeneKennungen(alle, readJson('data/anisearch-dub-ids.json', {})).length
    warn(`aniSearch-Dubs: ${fehlen} Kennungen der Liste fehlen in der Antwort (Grenze ${MAX_UEBERNOMMEN}), Dateien bleiben unverändert`)
    recordSource('anisearch-dubs', 0, `${fehlen} Kennungen fehlen in der Antwort (Grenze ${MAX_UEBERNOMMEN})`)
    return
  }
  log(`${Object.keys(alle).length} Einträge bei aniSearch, ${Object.keys(aus).length} von ${unsere.size} unserer Kennungen übernommen, ${ergebnis.nachgezogen} Einträge nachgezogen, ${ergebnis.uebernommen} Kennungen fehlen in der Antwort (alte Marke bleibt)`)
  recordSource('anisearch-dubs', Object.keys(aus).length)
}

/**
 * So viele Kennungen der Liste darf eine Antwort verschweigen, bevor der Lauf nichts schreibt. Gemessen am 17.10.2026: Die Liste (3.052 Kennungen)
 * ist seit dem 07.10. nie geschrumpft, 0 Kennungen fehlten, ein normaler Lauf übernimmt also 0. 30 (rund 1 %) lässt Raum für ein paar
 * von aniSearch zusammengeführte oder entfernte Einträge und bremst ab da jeden Schwund, der sonst unsichtbar „Deutsch“ behielte.
 */
export const MAX_UEBERNOMMEN = 30

/** Kennungen der bisherigen Liste, die die Antwort nicht nennt (ihre Marke bleibt, solange sie nicht widerlegt ist). */
export const uebernommeneKennungen = (alle: Record<string, Sprachen>, bisher: Record<string, string>): string[] => Object.keys(bisher).filter((id) => !(id in alle))

/**
 * Schreibt Auszug und Liste und zieht das Feld `dub` der Einträge auf die Liste nach: Die Marke steht in drei Dateien aus derselben Antwort und darf
 * nicht auseinanderlaufen (`check-bild-und-synchro.ts`; 18892 am 17.10.2026). Fehlen mehr als `MAX_UEBERNOMMEN` Kennungen der Liste in der Antwort,
 * wird nichts geschrieben (`undefined`).
 */
export function schreibeMarken(alle: Record<string, Sprachen>, auszug: Record<string, string>): { nachgezogen: number; uebernommen: number } | undefined {
  const bisher = readJson<Record<string, string>>('data/anisearch-dub-ids.json', {})
  const fehlend = uebernommeneKennungen(alle, bisher)
  if (fehlend.length > MAX_UEBERNOMMEN) return undefined
  writeJson('data/anisearch-dubs.json', auszug)
  /* Alle Kennungen mit Deutsch (auch ohne Titel bei uns): Quelle für `fetch-anisearch-eintraege.ts`. */
  const neu = Object.fromEntries(Object.entries(alle).map(([id, s]) => [id, deutschKennzeichen(s)] as const).filter(([, k]) => k !== '-'))
  /* Was die Antwort nicht nennt, ist nicht widerlegt: die bisherige Marke bleibt in Liste und Eintrag (beide müssen übereinstimmen). */
  const liste = { ...Object.fromEntries(fehlend.map((id) => [id, bisher[id]!])), ...neu }
  writeJson('data/anisearch-dub-ids.json', liste)
  const eintraege = readJson<Record<string, { dub: string }>>('data/anisearch-eintraege.json', {})
  const geaendert = zieheMarkeNach(eintraege, liste, alle)
  if (geaendert > 0) writeJson('data/anisearch-eintraege.json', eintraege)
  return { nachgezogen: geaendert, uebernommen: fehlend.length }
}

if (process.argv[1]?.endsWith('fetch-anisearch-dubs.ts')) await main()
