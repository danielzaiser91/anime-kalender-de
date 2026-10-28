/**
 * Zusicherung: Ein jüngeres Ja an derselben Adresse hebt ein älteres „nicht verfügbar“ auf, der Weg bleibt im Datensatz.
 * Anlass Spy × Family (140960, Disney+): Beleg vom 26.08. `available: false`, Beleg vom 16.10. Folgen 1–25 deutsch;
 * `verschmelze` ließ das alte `available: false` stehen, und `werteLinkpruefungAus` entfernte den Weg (16 Belege, 12 Wege live weg).
 * Geprüft wird der echte Weg: Handbeleg-Datei einer Kulisse (`AK_ROOT`) → `ladeHandbelege` → `werteLinkpruefungAus`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-juengeres-ja-weg.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PlatformId, Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kulisse = mkdtempSync(join(tmpdir(), 'ak-juengeres-ja-'))
mkdirSync(join(kulisse, 'data'))
process.env.AK_ROOT = kulisse
const { ladeHandbelege, verschmelze } = await import('./lib/dub-confirmed.ts')
const { werteLinkpruefungAus } = await import('./bau/09-2-linkpruefung.ts')

const SPY_URL = 'https://www.disneyplus.com/de-de/series/spyfamily/fet1h9jqmrAM'
/** Die beiden echten Zeilen (dub-confirmed.yaml, Spy × Family), wörtlich bis auf `checked`. */
const SPY_WEG = `- anilistId: 140960
  title: Spy × Family
  platform: disneyplus
  url: ${SPY_URL}
  available: false
  checkedAt: '2026-08-26'
  note: "Disney+ meldet: nicht in deinem Gebiet verfügbar"
`
const SPY_JA = `- anilistId: 140960
  title: Spy × Family
  platform: disneyplus
  url: ${SPY_URL}
  dub: true
  dubRanges:
    - { from: 1, to: 25, dub: true }
  checkedAt: '2026-10-16'
  note: "Folgen 1–25 mit deutschem Ton — Tonspuren: de, ja"
`
const SPY_WEG_NEU = SPY_WEG.replace('2026-08-26', '2026-10-20')
const SPY_JA_TEIL = SPY_JA.replace('to: 25', 'to: 5')

/** Schreibt die Zeilen als Handbelegdatei, lässt die Linkprüfung über den Titel laufen und liefert, ob der Weg erhalten bleibt. */
function wegBleibt(zeilen: string[]): boolean {
  writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), zeilen.join(''))
  const check = ladeHandbelege().find((c) => c.anilistId === 140960)
  const titel = { id: 140960, slug: 'spy-family', streams: [{ platform: 'disneyplus' as PlatformId, url: SPY_URL }] } as unknown as Title
  const titles = new Map<number, Title>([[140960, titel]])
  werteLinkpruefungAus({
    ytKanal: {},
    ytKauf: new Set(),
    titles,
    netflixOhneKennung: 0,
    checksJePlattform: new Map(),
    youtubeBefunde: {},
    belegFuer: (id, plattform) => (id === 140960 && plattform === 'disneyplus' ? check : undefined),
    vonHandBelegtAm: new Map(),
    checks: new Map(),
    vorherTitles: [],
  })
  return titel.streams.some((s) => s.url === SPY_URL)
}

try {
  console.log('\nJüngeres Ja nach älterem „nicht verfügbar“ (Spy × Family):')
  pruefe('älteres available: false, jüngeres Ja (1–25): der Weg bleibt', wegBleibt([SPY_WEG, SPY_JA]))
  pruefe('… in der Datei umgekehrt angeordnet: dasselbe', wegBleibt([SPY_JA, SPY_WEG]))
  pruefe('jüngeres Ja nennt nur Teilfolgen (1–5): der Weg bleibt', wegBleibt([SPY_WEG, SPY_JA_TEIL]))
  pruefe('Ja (1–25), dann jüngeres available: false: der Weg ist weg', !wegBleibt([SPY_JA, SPY_WEG_NEU]))
  pruefe('available: false, Ja, dann wieder available: false: der Weg ist weg', !wegBleibt([SPY_WEG, SPY_JA, SPY_WEG_NEU]))
  pruefe('available: false allein: der Weg ist weg', !wegBleibt([SPY_WEG]))
  pruefe('available: false und Ja am selben Tag: der Weg ist weg (kein Urteil gewinnt)', !wegBleibt([SPY_WEG, SPY_JA.replace('2026-10-16', '2026-08-26')]))

  console.log('\nverschmelze:')
  const alt = { anilistId: 1, platform: 'primevideo' as const, available: false, checkedAt: '2026-09-01' }
  const ja = { anilistId: 1, platform: 'primevideo' as const, dub: true, checkedAt: '2026-09-10' }
  pruefe('Ja löst available: false ab (kein available mehr, Urteil ja)', (() => {
    const v = verschmelze(alt, ja)
    return v.available === undefined && v.juengstesUrteil === 'ja' && v.dub === true
  })())
  pruefe('Ja mit available: true bleibt bei available: true', verschmelze(alt, { ...ja, available: true }).available === true)
  pruefe('jüngeres available: false neben dub: true bleibt', verschmelze(ja, { ...alt, checkedAt: '2026-09-20' }).available === false)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
