/**
 * Titel mit nur dem aniSearch-Artikel als Weg bekommen zusätzlich die Amazon-Suche nach der EAN derselben Ausgabe.
 * Läuft den echten Abschluss `schliesseWegeAb` (11-wege-abschluss) gegen einen Wegwerf-Ordner (`AK_ROOT`); Ausgaben und Artikel sind Kulisse.
 * Ohne den Aufruf im Abschluss — oder vor `bereinigeWege` — bleibt der Händler-Weg weg: dann wird dieser Test rot.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'disc-haendler-weg-'))
process.env.AK_ROOT = wurzel
const { suchadressenInTemp } = await import('./lib/suchadressen-temp.ts')
suchadressenInTemp()

let verletzt = 0
let gesamt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gesamt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const A1 = 'https://www.anisearch.de/article/111,erste'
const A2 = 'https://www.anisearch.de/article/222,zweite'
const A3 = 'https://www.anisearch.de/article/333,dritte'
const aus = (datum: string, url: string, kurz: string) => ({ datum, url, format: 'Blu-ray', kurz, edition: kurz })
const ausgaben = {
  // mehrere Ausgaben: der Weg gilt der ersten (wie der aniSearch-Link), nicht der zweiten
  '900601': [aus('2020-01-10', A1, 'Box 1'), aus('2021-02-11', A2, 'Box 2')],
  '900602': [aus('2020-01-10', A1, 'Box 1')],
  '900603': [aus('2020-01-10', A1, 'Box 1')],
  '900604': [aus('2020-01-10', A1, 'Box 1')],
  '900605': [aus('2020-01-10', A3, 'Ohne')],
  '900606': [aus('2020-01-10', A1, 'Box 1')],
  '900607': [aus('2020-01-10', A1, 'Box 1'), aus('2020-01-10', A2, 'Box 2')],
}
const artikel = {
  '111': { ean: '4020628530846', publisher: 'Crunchyroll', umfang: 'Box' },
  '222': { ean: '7630017528209', publisher: 'Kazé', umfang: 'Box' },
  '333': { publisher: 'Kazé', umfang: 'Box' },
}
const ani = { name: 'aniSearch', url: A1, kind: 'buy' as const, zugang: 'kauf' as const }
const amazon = { name: 'Amazon', url: 'https://www.amazon.de/dp/B0HGB36K4K', kind: 'buy' as const, zugang: 'kauf' as const }
const titel = (id: number, extra: object = {}) => ({ id, streams: [], keywords: [], genres: [], watchLinks: [{ ...ani }], ...extra })

try {
  mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'disc-ausgaben.json'), JSON.stringify(ausgaben))
  writeFileSync(join(wurzel, 'data', 'anisearch-artikel.json'), JSON.stringify(artikel))
  // Handdateien, die der Abschluss ohne Rückfallwert liest: leer genügt.
  for (const leer of ['kino-ankuendigungen.yaml', 'shop-wege-falsches-ziel.yaml']) writeFileSync(join(wurzel, 'data', leer), '[]\n')
  const { schliesseWegeAb } = await import('./bau/11-wege-abschluss.ts')
  const t = [
    titel(900601),
    titel(900602, { streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true, zugang: 'abo' }] }),
    titel(900603, { watchLinks: [{ ...ani }, { ...amazon }] }),
    titel(900604, { watchLinks: [{ ...amazon }] }),
    titel(900605),
    titel(900606, { watchLinks: [] }),
    titel(900607),
    titel(900608),
  ]
  schliesseWegeAb({
    titles: new Map(t.map((x) => [x.id, x as never])),
    anisearch: {},
    releases: [],
    zugangJeAdresse: new Map(),
    tmdbMehrdeutig: new Set(),
    toteAdressen: new Set(),
    linkBefunde: {},
    // belegtes Nein für eine Amazon-Suche (wie im echten Bestand): `bereinigeWege` streicht jede Amazon-Suche, wenn der Weg davor steht
    verweiseEntfernt: [{ url: 'https://www.amazon.de/s?k=etwas&i=instant-video' } as never],
    crAdresseZu: () => undefined,
    beantworteteSuchen: new Set(),
    suchOffen: [],
    alleChecks: [],
    lautPruefungTot: () => false,
    checksJePlattform: new Map(),
    belegFuer: () => undefined,
  })
  const ws = (id: number) => (t.find((x) => x.id === id)!.watchLinks as { name: string; url: string; kind: string; zugang?: string }[])
  const ean = (id: number) => ws(id).filter((w) => w.url.startsWith('https://www.amazon.de/s?k='))

  console.log('\nBau (schliesseWegeAb):')
  pruefe('nur aniSearch, EAN der ersten Ausgabe: Amazon-Suche dahinter', ws(900601).length === 2 && ws(900601)[1]!.url === 'https://www.amazon.de/s?k=4020628530846', ws(900601))
  pruefe('Weg ist ein Kaufweg „Amazon“ mit Zugangsart kauf', ws(900601)[1]!.name === 'Amazon' && ws(900601)[1]!.kind === 'buy' && ws(900601)[1]!.zugang === 'kauf', ws(900601)[1])
  pruefe('aniSearch-Weg bleibt unverändert vorn', ws(900601)[0]!.url === A1, ws(900601)[0])
  pruefe('mit Stream: kein EAN-Weg', ean(900602).length === 0, ws(900602))
  pruefe('mit Amazon-Handlink neben aniSearch: unverändert', ws(900603).length === 2 && ean(900603).length === 0, ws(900603))
  pruefe('Amazon-Handlink + später angelegter aniSearch-Weg: kein EAN-Weg daneben', ws(900604).length === 2 && ean(900604).length === 0, ws(900604))
  pruefe('Artikel ohne EAN: kein Weg', ean(900605).length === 0, ws(900605))
  pruefe('Titel ohne Wege (hier: nur Disc-Weg aus Phase 11-1) bekommt die EAN-Suche der ersten Ausgabe', ws(900606).length === 2 && ws(900606)[1]!.url === 'https://www.amazon.de/s?k=4020628530846', ws(900606))
  pruefe('zwei Ausgaben am selben Tag, verschieden: keine eindeutige EAN, kein Weg', ean(900607).length === 0, ws(900607))
  pruefe('Titel ohne Ausgabeliste (aniSearch von anderswo): kein EAN-Weg', ws(900608).length === 1 && ean(900608).length === 0, ws(900608))

  console.log('\nZählung (ergaenzeEanHaendlerWege):')
  const { ergaenzeEanHaendlerWege } = await import('./lib/disc-haendler-weg.ts')
  const { discIndexLaden } = await import('./lib/disc-ean.ts')
  const frisch = [titel(900601), titel(900605), titel(900608), titel(900602, { streams: [{ platform: 'netflix' }] }), titel(900602, { watchLinks: [] })]
  const anzahl = ergaenzeEanHaendlerWege(frisch as never, discIndexLaden())
  pruefe('zählt genau die Titel, die den Weg bekamen (1 von 5, auch ohne jeden Weg keiner)', anzahl === 1, anzahl)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(`\nDisc-Händler-Weg aus EAN: ${gesamt - verletzt} von ${gesamt} Fälle grün`)
if (verletzt) process.exit(1)
