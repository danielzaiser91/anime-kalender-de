/**
 * Wächter: Die Crunchyroll-Uhrzeit eines Termins kommt aus dem Wochenprogramm, wenn dieses für denselben Tag eine andere nennt als der API-Stempel.
 *
 * Lehre (27.10.2026, Psyren: live 15:30, richtig 16:30): Crunchyrolls API stempelt Folgen nach einer Zeitumstellung weiter mit der alten
 * Zeit; das Wochenprogramm zeigt die Ortszeit. Die nächste Umstellung ist am 28.03.2027. Rot, sobald nach `alleTermine` und nach der Bau-Phase
 * die API-Zeit gewinnt, obwohl ein Beleg desselben Tages etwas anderes sagt. Zeitstempel, Serie und Beleg wörtlich aus `data/crunchyroll-dub.json`
 * und der Beleg-Datei (Psyren, GT00371866). Aufruf: npx tsx pipeline/check-cr-zeit-woche.ts
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'cr-zeit-woche-'))
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
process.env.AK_ROOT = wurzel
const { alleTermine } = await import('./lib/crunchyroll-termine.ts')
const { zeitAusWochenprogramm, zeitHinweis, quellenMitZeit } = await import('./lib/cr-zeit-woche.ts')
const { legeCrVerweiseUndTermineAn } = await import('./bau/09-4-4-termine.ts')
const { BELEGE_DATEI } = await import('./lib/woche-beleg.ts')
const { belegeMitKorrekturen, korrekturenNach } = await import('./lib/cr-zeit-merkliste.ts')
const { belegteFolgen } = await import('./lib/cr-batch-wache.ts')
type Belege = import('./lib/woche-beleg.ts').WocheBelege

const PS = 'https://www.crunchyroll.com/de/series/GT00371866/psyren'
const ARTIKEL = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/10/5/crunchyroll-wochenprogramm-herbst-2026'
const psyren = { id: 204011, titleEn: 'PSYREN', jpYear: 2026, format: 'TV', streams: [{ platform: 'crunchyroll', url: PS, dub: true }] }
const beleg = (seriesId: string, von: number, datum: string, zeit: string | null, artikel = ARTIKEL) =>
  ({ seriesId, titel: 'x', von, bis: von, datum, zeit, artikel, erstmalsAm: '2026-10-26T10:00:00.000Z' })
const belegeAus = (...b: ReturnType<typeof beleg>[]): Belege => Object.fromEntries(b.map((x, i) => [`k${i}`, x]))
const serie = (stempel: string[]) => ({
  url: PS,
  seriesId: 'GT00371866',
  katalog: 'de',
  staffeln: [{ name: 'Staffel 1', deutsch: stempel.length, folgen: 4, deutscheFolgen: stempel.map((v, i) => ({ nummer: i + 1, guid: `g${i}`, verfuegbarAb: v })) }],
})
const JETZT = Date.parse('2026-10-27T05:00:00Z')
const termine = (stempel: string[], belege: Belege) =>
  alleTermine([serie(stempel) as never], new Map([[PS, [psyren as never]]]), JETZT, belege)

const B16 = belegeAus(beleg('GT00371866', 1, '2026-10-26', '16:30'))

/* Hilfsfunktion der Beleg-Wahl. */
pruefe('Beleg für Serie und Tag: dessen Zeit samt Artikel', JSON.stringify(zeitAusWochenprogramm(B16, 'GT00371866', '2026-10-26')) === JSON.stringify({ zeit: '16:30', artikel: ARTIKEL }))
pruefe('anderer Tag: kein Beleg', zeitAusWochenprogramm(B16, 'GT00371866', '2026-10-27') === undefined)
pruefe('andere Serie: kein Beleg', zeitAusWochenprogramm(B16, 'GT00000000X', '2026-10-26') === undefined)
pruefe('keine Serienkennung: kein Beleg', zeitAusWochenprogramm(B16, undefined, '2026-10-26') === undefined)
pruefe('Beleg ohne Zeit zählt nicht', zeitAusWochenprogramm(belegeAus(beleg('GT00371866', 1, '2026-10-26', null)), 'GT00371866', '2026-10-26') === undefined)
const zwei = belegeAus(beleg('GT00371866', 1, '2026-10-26', '16:30'), beleg('GT00371866', 2, '2026-10-26', '19:00'))
pruefe('zwei Belege desselben Tages mit verschiedener Zeit: keine eindeutige, kein Beleg', zeitAusWochenprogramm(zwei, 'GT00371866', '2026-10-26') === undefined)
const gleich = belegeAus(beleg('GT00371866', 1, '2026-10-26', '16:30'), beleg('GT00371866', 2, '2026-10-26', '16:30'))
pruefe('zwei Belege desselben Tages mit gleicher Zeit: gilt', zeitAusWochenprogramm(gleich, 'GT00371866', '2026-10-26')?.zeit === '16:30')
pruefe('Hinweis nur mit Quelle', zeitHinweis(ARTIKEL).includes('Wochenprogramm') && zeitHinweis(undefined) === '')
pruefe('Quelle wird einmal angehängt', quellenMitZeit(['a'], ARTIKEL).join() === `a,${ARTIKEL}` && quellenMitZeit(['a', ARTIKEL], ARTIKEL).length === 2 && quellenMitZeit(['a'], undefined).join() === 'a')

/* Der Anlassfall und seine Gegenproben durch alleTermine. */
const API_NOV = '2026-10-26T14:30:00Z'
const ohne = termine([API_NOV], {})[0]
pruefe('Psyren ohne Beleg: API-Berlinzeit 15:30, keine Quelle', ohne?.time === '15:30' && ohne?.zeitQuelle === undefined, ohne)
const mit = termine([API_NOV], B16)[0]
pruefe('Psyren mit Beleg 16:30: die Wochenprogramm-Zeit gewinnt, der Artikel ist die Quelle', mit?.time === '16:30' && mit?.zeitQuelle === ARTIKEL, mit)
const sommer = termine(['2026-10-14T14:30:00Z'], belegeAus(beleg('GT00371866', 1, '2026-10-14', '16:30')))[0]
pruefe('Sommerzeit, API und Beleg stimmen (16:30): unverändert, keine Quelle', sommer?.time === '16:30' && sommer?.zeitQuelle === undefined, sommer)
const andererTag = termine([API_NOV], belegeAus(beleg('GT00371866', 1, '2026-11-02', '16:30')))[0]
pruefe('Beleg eines anderen Tages: API-Zeit bleibt', andererTag?.time === '15:30', andererTag)
const gemischt = termine([API_NOV, '2026-10-26T15:30:00Z'], B16)[0]
pruefe('Folgen mit verschiedenen API-Zeiten (kein Termin-time): nichts wird erfunden', gemischt?.time === undefined && gemischt?.zeitQuelle === undefined, gemischt)
const spaeterTag = termine([API_NOV, '2026-11-02T14:30:00Z'], B16)[0]
pruefe('Beleg gilt für den ersten Tag, der Rest bleibt in den Folgen: Termin 16:30', spaeterTag?.time === '16:30' && spaeterTag?.firstEpisodeDate === '2026-10-26', spaeterTag)
pruefe('Beleg ohne Zeit ändert nichts', termine([API_NOV], belegeAus(beleg('GT00371866', 1, '2026-10-26', null)))[0]?.time === '15:30')

/* Der Wächter selbst: nie gewinnt die API-Zeit gegen einen Beleg desselben Tages (Winter wie Sommer, auch nach 28.03.2027). */
const paare: [string, string, string][] = [
  ['2026-10-26T14:30:00Z', '2026-10-26', '16:30'],
  ['2026-10-25T13:00:00Z', '2026-10-25', '15:00'],
  ['2027-03-29T14:30:00Z', '2027-03-29', '17:30'],
  ['2026-10-14T14:30:00Z', '2026-10-14', '16:30'],
]
for (const [stempel, tag, zeit] of paare) {
  const t = termine([stempel], belegeAus(beleg('GT00371866', 1, tag, zeit)))[0]
  pruefe(`${tag}: nach alleTermine gilt die Beleg-Zeit ${zeit}, nie die API-Zeit`, t?.firstEpisodeDate === tag && t?.time === zeit, t)
}

/* Merkliste: reine Funktionen. */
const gemerkt = { seriesId: 'GT00371866', datum: '2026-10-26', zeit: '16:30', artikel: ARTIKEL }
pruefe('Merkliste ohne frischen Beleg: wird als Beleg gelesen', zeitAusWochenprogramm(belegeMitKorrekturen({}, { 'GT00371866|2026-10-26': gemerkt }), 'GT00371866', '2026-10-26')?.zeit === '16:30')
pruefe('Merkliste mit frischem Beleg desselben Tages: nur der frische zählt (sonst widersprächen sie sich)', zeitAusWochenprogramm(belegeMitKorrekturen(belegeAus(beleg('GT00371866', 1, '2026-10-26', '17:00')), { 'GT00371866|2026-10-26': gemerkt }), 'GT00371866', '2026-10-26')?.zeit === '17:00')
pruefe('Merkliste nimmt nur Termine mit ersetzter Zeit auf', Object.keys(korrekturenNach({}, [{ time: '15:30' }, { time: '16:30', zeitQuelle: ARTIKEL, zeitSchluessel: 'GT00371866|2026-10-26' }])).join() === 'GT00371866|2026-10-26')
pruefe('Merkliste behält Altes und ist beim zweiten Durchlauf unverändert', JSON.stringify(korrekturenNach({ 'GT00371866|2026-10-26': gemerkt }, [])) === JSON.stringify({ 'GT00371866|2026-10-26': gemerkt }))

/* Die Bau-Phase liest die Beleg-Datei wirklich und trägt Zeit, Herkunft und Quelle am Release ein. */
function phase(belege: Belege, vorher: import('../shared/types.ts').Release[] = []) {
  writeFileSync(join(wurzel, BELEGE_DATEI), JSON.stringify(belege))
  const releases = vorher
  const log = console.log
  console.log = () => undefined
  try {
    legeCrVerweiseUndTermineAn({
      titles: new Map([[psyren.id, psyren as never]]),
      anisearch: {},
      belegt: 0,
      crDub: { serien: [serie([API_NOV])] } as never,
      verschwunden: 0,
      usNeinOffen: 0,
      nachUrl: new Map([[PS, [psyren as never]]]),
      releases,
      jetzt: JETZT,
    })
  } finally {
    console.log = log
  }
  return releases[0]
}
try {
  const o = phase({})
  pruefe('Phase ohne Beleg: 15:30, nur die Serienseite als Quelle, kein Hinweis', o?.schedule?.time === '15:30' && o?.sources?.join() === PS && !/Wochenprogramm/.test(o?.herkunft ?? ''), o)
  const r = phase(B16)
  pruefe('Phase mit Beleg: Release Psyren 26.10. um 16:30', r?.schedule?.firstEpisodeDate === '2026-10-26' && r?.schedule?.time === '16:30', r?.schedule)
  pruefe('Phase mit Beleg: der Artikel steht unter den Quellen, die Herkunft nennt das Wochenprogramm', r?.sources?.includes(ARTIKEL) === true && r?.sources?.includes(PS) === true && /Wochenprogramm/.test(r?.herkunft ?? ''), r)
  pruefe('Phase mit Beleg: die Zahl der belegten Folgen bleibt lesbar', belegteFolgen(r?.herkunft) === 1, r?.herkunft)
  /* Prüfer 2207: der Beleg verfällt nach 21 Tagen, die gemerkte Zeit nicht. */
  const spaeter = phase({})
  pruefe('Beleg verfallen (Datei leer): die gemerkte Zeit 16:30 gilt weiter', spaeter?.schedule?.time === '16:30' && spaeter?.sources?.includes(ARTIKEL) === true, spaeter)
  const frischer = phase(belegeAus(beleg('GT00371866', 1, '2026-10-26', '17:00')))
  pruefe('frischer Beleg desselben Tages schlägt die gemerkte Zeit', frischer?.schedule?.time === '17:00', frischer)
  const danach = phase({})
  pruefe('und die Merkliste hat die neue Zeit übernommen', danach?.schedule?.time === '17:00', danach)
  const sammel = { slug: 'ps-katalog', titleId: 204011, name: 'Psyren', platform: 'crunchyroll', platformUrl: PS, releaseType: 'batch', dateMeaning: 'available-from', year: 2026, sources: [PS], schedule: { firstEpisodeDate: '2026-10-26', lastEpisodeDate: '2026-10-26' } } as never
  const s = phase(B16, [sammel])
  pruefe('Phase, Sammeldatum ersetzt: Zeit 16:30, Artikel unter den Quellen, Herkunft nennt das Wochenprogramm', s?.schedule?.time === '16:30' && s?.sources?.includes(ARTIKEL) === true && /Wochenprogramm/.test(s?.herkunft ?? ''), s)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`✖ check-cr-zeit-woche: ${verletzt} von ${faelle} Fällen verletzt`)
  process.exit(1)
}
console.log(`✓ check-cr-zeit-woche: ${faelle} Fälle (Wochenprogramm-Zeit schlägt API-Stempel desselben Tages, Phase liest die Belege, die Merkliste überlebt den Beleg)`)
