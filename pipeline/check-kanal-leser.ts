/**
 * Zusicherung: **Jeder Leser des Kanal-Wissens im Bau sieht die Merkliste `data/kanal-seiten.json`** (19.10.2026, PR 1613 R2), nicht nur `rohDeutsch()`.
 * Im vollen Bau fing die Liste zuerst nur 16 von 272 Prime-Ja ab, weil Stufe 3 (`urteilSchliesstLuecken`), das späte Urteil (13-schreiben), die
 * Wächter D-25..D-27 (`kanalFehler`) und die Wegwahl (`belegFuer`) allein die YAML lasen. Hier läuft jeder dieser Leser gegen eine Kulisse (`AK_ROOT`),
 * in der ein Kanal-Titel nur in der Merkliste steht (Adresse ≠ gelesene Seite), dazu eine Gegenprobe ohne Listeneintrag. Dazu der Schreibweg der Liste:
 * ein zweiter Lauf mit weniger Kanal-Belegen in der YAML behält den Eintrag, die gelesene Seite steht in der Notiz, die Seite eines fremden Titels deckt nicht,
 * ein doppelter Block in der Eingabe wird vor dem Schreiben entfernt. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'kanal-leser-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`
const KANAL = 'Abos: crunchyrollde, ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg'
let fehler = 0
const pruefe = (name: string, ok: boolean, info?: unknown) => {
  if (!ok) fehler++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${JSON.stringify(info)}`}`)
}

/** 9301: Kanal nur in der Liste, gelesene Seite ≠ Adresse. 9302: kein Eintrag (Gegenprobe). 9303: nur in der Liste, Adresse = Seite. */
const LISTE = [
  { anilistId: 9301, platform: 'primevideo', url: dp('B0ADRESSE1'), checkedAt: '', note: 'Amazon-Seite B0SEITE001 — ACHTUNG: Kanal-Titel', kanalOhneBeleg: true },
  { anilistId: 9303, platform: 'primevideo', url: dp('B0ADRESSE3'), checkedAt: '', note: 'Amazon-Seite B0ADRESSE3 — ACHTUNG: Kanal-Titel', kanalOhneBeleg: true },
]
const fremdesNein = (id: number) => `- anilistId: ${id}
  platform: primevideo
  url: ${dp(`B0FREMD${id}`)}
  dub: false
  checkedAt: '2026-10-02'
`
const stream = (url: string, dub?: boolean) => ({ platform: 'primevideo', url, ...(dub === undefined ? {} : { dub }) })
const titel = (id: number, url: string, dub?: boolean) => ({ id, slug: `leser-${id}`, titleRomaji: `Leser ${id}`, streams: [stream(url, dub)] }) as unknown as Title

async function pruefeStufe3(): Promise<void> {
  const { urteilSchliesstLuecken, schliesseSpaeteLuecken } = await import('./bau/urteil-schliesst-luecken.ts')
  const jetzt = () => [titel(9301, dp('B0SEITE001')), titel(9302, dp('B0SEITE002')), titel(9303, dp('B0ADRESSE3'))]
  const frueh = jetzt()
  urteilSchliesstLuecken(new Map(frueh.map((t) => [t.id, t])))
  pruefe('Stufe 3: Kanal-Seite nur in der Liste (Adresse ≠ Seite) bekommt kein Ja', frueh[0]!.streams[0]!.dub !== true, frueh[0]!.streams[0])
  pruefe('Stufe 3: Kanal-Seite nur in der Liste (Adresse = Seite) bekommt kein Ja', frueh[2]!.streams[0]!.dub !== true, frueh[2]!.streams[0])
  pruefe('Stufe 3: Gegenprobe ohne Listeneintrag bekommt das Ja', frueh[1]!.streams[0]!.dub === true, frueh[1]!.streams[0])
  const spaet = jetzt()
  const n = schliesseSpaeteLuecken(spaet, [] as Release[])
  pruefe('spätes Urteil: Kanal-Seiten nur in der Liste bleiben ohne Ja', spaet[0]!.streams[0]!.dub !== true && spaet[2]!.streams[0]!.dub !== true, spaet.map((t) => t.streams[0]))
  pruefe('spätes Urteil: Gegenprobe bekommt das Ja, Zahl 1', spaet[1]!.streams[0]!.dub === true && n === 1, { n })
}

async function pruefeWaechter(): Promise<void> {
  const { kanalFehler } = await import('./bau/kanal-fehler.ts')
  const meldungen = kanalFehler([titel(9301, dp('B0SEITE001'), true), titel(9302, dp('B0SEITE002'), true)], [])
  pruefe('D-25: Ja auf einer Kanal-Seite nur aus der Liste wird gemeldet', meldungen.some((m) => m.includes('Titel 9301')), meldungen)
  pruefe('D-25: Gegenprobe ohne Listeneintrag bleibt still', !meldungen.some((m) => m.includes('Titel 9302')), meldungen)
}

async function pruefeWegwahl(): Promise<void> {
  const { sammleBelege } = await import('./bau/09-1-belege.ts')
  const bau = sammleBelege({
    releases: [],
    titles: new Map(),
    crBySeriesId: new Map(),
    tmdbMehrdeutig: new Set(),
    tmdbTitles: {},
    tvJeTmdb: new Set(),
    toteAdressen: new Set(),
    crDub: { scrapedAt: '', serien: [] } as never,
  })
  const kanal = bau.belegFuer(9301, 'primevideo', dp('B0ADRESSE1'), 1)
  const frei = bau.belegFuer(9302, 'primevideo', dp('B0ADRESSE2'), 1)
  pruefe('belegFuer: das Nein einer fremden Adresse gilt für die Listen-Adresse nicht', kanal === undefined, kanal)
  pruefe('belegFuer: Gegenprobe ohne Listeneintrag nimmt das Nein bei einem Weg', frei?.anilistId === 9302, frei)
}

async function pruefeSchreibweg(): Promise<void> {
  const { schreibeBelege } = await import('./lib/dub-confirmed.ts')
  const { mitMerkliste, MERKLISTE } = await import('./lib/kanal-merkliste.ts')
  const datei = join(kulisse, 'data/dub-confirmed.yaml')
  const block = (id: number, url: string, seite: string) => `- anilistId: ${id}
  platform: primevideo
  url: ${url}
  dub: true
  checkedAt: '2026-10-01'
  note: "Tonspuren: Deutsch — Amazon-Seite ${seite}: alle 4 Folgen geprüft, ${KANAL}"
`
  const liste = () => JSON.parse(readFileSync(join(kulisse, MERKLISTE), 'utf8')) as { anilistId: number; note: string; url: string }[]
  rmSync(join(kulisse, MERKLISTE), { force: true })
  schreibeBelege(datei, block(9321, dp('B0ADRESSE9'), 'B0SEITE009'), () => {})
  pruefe('Schreibweg: die gelesene Seite steht in der Notiz, die Adresse in der url', liste()[0]?.note.includes('Amazon-Seite B0SEITE009') === true && liste()[0]?.url === dp('B0ADRESSE9'), liste())
  schreibeBelege(datei, fremdesNein(9322), () => {})
  pruefe('Schreibweg: ein späterer Lauf ohne den Kanal-Beleg in der YAML behält den Eintrag', liste().some((e) => e.anilistId === 9321), liste())
  const doppelt = block(9323, dp('B0ADRESSE8'), 'B0SEITE008').repeat(2)
  schreibeBelege(datei, doppelt, () => {})
  const geschrieben = readFileSync(datei, 'utf8')
  pruefe('Schreibweg: ein doppelter Block wird vor dem Schreiben entfernt', geschrieben.split('anilistId: 9323').length === 2, geschrieben)
  const fremd = { anilistId: 9331, platform: 'primevideo', url: dp('B0ADRESSEA'), note: 'Amazon-Seite B0GEMEINSAM — ACHTUNG: Kanal-Titel', kanalOhneBeleg: true } as never
  const andererTitel = { anilistId: 9332, platform: 'primevideo', url: dp('B0ADRESSEB'), note: 'Amazon-Seite B0GEMEINSAM — ACHTUNG: Kanal-Titel', dub: true } as never
  const gesamt = mitMerkliste([andererTitel], [fremd])
  pruefe('Merkliste: der Handbeleg eines fremden Titels derselben Seite deckt den Eintrag nicht', gesamt.length === 2, gesamt)
  const eigene = { anilistId: 9331, platform: 'primevideo', url: dp('B0ADRESSEA'), note: 'Amazon-Seite B0GEMEINSAM: Tonspuren English' } as never
  const nein = { ...(eigene as object), dub: false } as never
  pruefe('Merkliste: eine Messung derselben Seite ohne Aussage deckt den Eintrag nicht', mitMerkliste([eigene], [fremd]).length === 2, mitMerkliste([eigene], [fremd]))
  pruefe('Merkliste: ein Nein derselben Seite deckt den Eintrag', mitMerkliste([nein], [fremd]).length === 1, mitMerkliste([nein], [fremd]))
  const nichtDa = { ...(eigene as object), available: false } as never
  pruefe('Merkliste: ein „nicht verfügbar“ derselben Seite deckt den Eintrag', mitMerkliste([nichtDa], [fremd]).length === 1, mitMerkliste([nichtDa], [fremd]))
}

/** `kanalAdresseGemerkt` (Prime-Phase): Titel, Anbieter und Kanal-Merkmal müssen alle zutreffen. */
async function pruefeAdresseGemerkt(): Promise<void> {
  const { kanalAdresseGemerkt } = await import('./lib/kanal-wissen.ts')
  const kanal = { anilistId: 9341, platform: 'netflix', url: dp('B0ADRESSEG'), checkedAt: '', note: 'Amazon-Seite B0ADRESSEG — ACHTUNG: Kanal-Titel', kanalOhneBeleg: true } as never
  const ohneMerkmal = { anilistId: 9342, platform: 'primevideo', url: dp('B0ADRESSEH'), checkedAt: '', note: 'Amazon-Seite B0ADRESSEH: Tonspuren English' } as never
  const checks = [kanal, ohneMerkmal]
  pruefe('Adresse gemerkt: Titel, Anbieter und Adresse gleich, mit Kanal-Merkmal', kanalAdresseGemerkt(checks, 9341, 'netflix', dp('B0ADRESSEG')), checks)
  pruefe('Adresse gemerkt: derselbe Titel mit Weg eines anderen Anbieters unter derselben Adresse nicht', !kanalAdresseGemerkt(checks, 9341, 'primevideo', dp('B0ADRESSEG')), checks)
  pruefe('Adresse gemerkt: ein Eintrag ohne Kanal-Merkmal nicht', !kanalAdresseGemerkt(checks, 9342, 'primevideo', dp('B0ADRESSEH')), checks)
  pruefe('Adresse gemerkt: ein anderer Titel unter derselben Adresse nicht', !kanalAdresseGemerkt(checks, 9343, 'netflix', dp('B0ADRESSEG')), checks)
}

try {
  schreibe('data/dub-confirmed.yaml', [9301, 9302, 9303].map(fremdesNein).join(''))
  schreibe('data/kanal-seiten.json', JSON.stringify(LISTE))
  schreibe('data/urteile.json', JSON.stringify(Object.fromEntries([9301, 9302, 9303].map((id) => [`${id}|primevideo`, { urteil: 'deutsch' }]))))
  schreibe('data/verweise-entfernt.json', '{}')
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  schreibe('data/anisearch-ids-hand.yaml', '')
  await pruefeStufe3()
  await pruefeWaechter()
  await pruefeWegwahl()
  await pruefeSchreibweg()
  await pruefeAdresseGemerkt()
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler) {
  console.error(`check-kanal-leser: ${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-kanal-leser: ok')
