/**
 * **Sprecherseiten von aniSearch** (`/anime/<id>/seiyuu`): deutsche Sprecher je Figur.
 *
 * Sie belegen eine deutsche Fassung unabhängig von der Marke „Synchronisiert" und sollen AniList bei
 * den Sprechern ablösen. Ergebnis: `data/anisearch-sprecher.json`, Schlüssel ist die aniSearch-ID; die rohen
 * Besetzungszeilen liegen in `data/anisearch-sprecher-raw/<id>.html.gz`.
 *
 * Reihenfolge (10.10.2026, `lib/anisearch-sprecher-reihe.ts`): zuerst die Lücken im Hauptbestand, dann der Katalog.
 * Takt, Sperre (Pause statt Abbruch) und Zeitbudget wie `fetch-anisearch.ts`; die Frist ist `--minuten`.
 *
 * Aufruf: `tsx pipeline/fetch-anisearch-sprecher.ts [--limit N] [--minuten M]`
 */
import { kennungVon, type WegListe, type Zeile } from './lib/anisearch-archiv-vorrang.ts'
import { legeArchivAb } from './lib/anisearch-sprecher-archiv.ts'
import { arbeiteAb, type Abruf } from './lib/anisearch-sprecher-lauf.ts'
import { katalogAus, sprecherLuecken, type AnisearchEintrag, type Eintrag, type Luecken } from './lib/anisearch-sprecher-reihe.ts'
import { KENNUNG } from './lib/kennung.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'

const TAKT_MS = 6000
/** Zeitbudget: Der Workflow bricht bei 120 Minuten ab und verwirft dann alles, was noch nicht geschrieben ist (03.10.2026: 1.100 Seiten × ~6,7 s ≈ 123 Minuten). */
const MINUTEN = Number(/--minuten[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 100)
const START = Date.now()
const GRENZE = Number(/--limit[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 400)
const ZIEL = 'data/anisearch-sprecher.json'
const WEG_DATEI = 'data/anisearch-sprecher-weg.json'

async function hole(id: number): Promise<Abruf> {
  try {
    const antwort = await fetch(`https://www.anisearch.de/anime/${id}/seiyuu`, {
      headers: { 'User-Agent': KENNUNG, 'Accept-Language': 'de-DE,de;q=0.9' },
      redirect: 'follow',
    })
    if (antwort.ok) return { art: 'ok', html: await antwort.text() }
    warn(`aniSearch Sprecher ${id}: HTTP ${antwort.status}`)
    return antwort.status === 404 || antwort.status === 410 ? { art: 'weg', code: antwort.status } : { art: 'fehler' }
  } catch (err) {
    warn(`aniSearch Sprecher ${id}: ${(err as Error).message}`)
    return { art: 'fehler' }
  }
}

const bestand = readJson<Record<string, Eintrag>>(ZIEL, {})
const weg = readJson<WegListe>(WEG_DATEI, {})
const katalog = katalogAus(readJson<Record<string, AnisearchEintrag>>('data/anisearch.json', {}))
const bruecke = readJson<{ anisearch: Record<number, number> }>('data/anime-ids.json', { anisearch: {} }).anisearch
const haupt = readJson<Zeile[]>('public/data/titles.json', []).map((t) => kennungVon(t, bruecke)).filter((id): id is number => id !== undefined)

const luecken = (): Luecken => sprecherLuecken({ haupt, katalog, bestand, weg, jetztMs: Date.now() })
const zaehle = (l: Luecken): string =>
  `Hauptbestand ${l.haupt.length} von ${new Set(haupt).size}, Katalog ${l.katalog.length} von ${katalog.size} Kennungen ohne Sprecherseite`
const vorher = luecken()
log(`aniSearch-Sprecher-Lücke vorher: ${zaehle(vorher)}`)

const dran = [...vorher.haupt, ...vorher.katalog].slice(0, GRENZE)
log(`${dran.length} Sprecherseiten kommen dran (davon ${Math.min(dran.length, vorher.haupt.length)} aus dem Hauptbestand)`)

const sichern = (): void => {
  writeJson(ZIEL, bestand, true)
  writeJson(WEG_DATEI, weg, true)
}
const z = await arbeiteAb(dran, bestand, {
  hole,
  warte: sleep,
  archiviere: (id, html) => void legeArchivAb(id, html),
  sichern,
  weg,
  taktMs: TAKT_MS,
  ende: START + MINUTEN * 60_000,
  minuten: MINUTEN,
})

log(`${z.geholt} Seiten geholt, ${z.weg} gibt es nicht mehr, ${z.verdacht} leere in Folge nicht gespeichert; ${Object.keys(bestand).length} insgesamt`)
log(`aniSearch-Sprecher-Lücke nachher: ${zaehle(luecken())}`)
