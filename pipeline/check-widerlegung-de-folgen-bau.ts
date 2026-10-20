/**
 * Zusicherung (20.10.2026): Die Verdrahtung. `widerlegeDeutscheTermine` liest `data/crunchyroll-dub.json` selbst und reicht den
 * Katalog an `loeseGeteilteWegeVonWiderlegten` weiter; ein falscher Pfad oder ein leerer Rückfall schaltete den Fix still ab.
 * Läuft gegen eine Kulisse unter `os.tmpdir()` (`AK_ROOT`), nie gegen das Repo.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-widerlegung-de-folgen-bau.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const URL_E = 'https://www.crunchyroll.com/de/series/GTESTE/e'

function katalog(verfuegbarAb: string): unknown {
  const deutscheFolgen = [{ nummer: 1, guid: 'G1', verfuegbarAb }]
  const staffeln = [{ name: 'Staffel 3', folgen: 12, kacheln: 12, deutsch: 1, fremd: 0, deutscheFolgen }]
  return { scrapedAt: '', serien: [{ url: URL_E, katalog: 'de', geprueftAm: '2026-10-19', staffeln }] }
}

async function bau(verfuegbarAb: string | undefined): Promise<Title> {
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  const woche = { wocheAb: '2026-10-12', eintraege: [{ seriesId: 'GTESTE', titel: 'E', sprache: 'ja', datum: '2026-10-18' }] }
  writeFileSync(join(wurzel, 'data', 'crunchyroll-woche.json'), JSON.stringify(woche))
  rmSync(join(wurzel, 'data', 'crunchyroll-dub.json'), { force: true })
  if (verfuegbarAb) writeFileSync(join(wurzel, 'data', 'crunchyroll-dub.json'), JSON.stringify(katalog(verfuegbarAb)))
  const teil = (id: number, titleDe: string, jpYear: number, streams: unknown[], episodes?: number) => ({ id, franchiseId: 900097, format: 'TV', titleDe, jpYear, episodes, streams }) as unknown as Title
  const titel = teil(900003, 'E: Staffel 3', 2026, [{ platform: 'crunchyroll', url: URL_E, dub: true, sharedWith: 3 }], 12)
  const reihe = [teil(900097, 'E', 2023, []), teil(900096, 'E: Staffel 2', 2024, []), titel]
  const release = { slug: 'e-s3', titleId: 900003, platform: 'crunchyroll', schedule: { firstEpisodeDate: '2026-10-18', estimated: false } } as unknown as Release
  const { widerlegeDeutscheTermine } = await import('./bau/widerlegung-woche.ts')
  widerlegeDeutscheTermine([release], new Map(reihe.map((t) => [t.id, t])))
  pruefe('Kulisse: der Termin ist widerlegt', release.widerlegt?.am === '2026-10-18', release.widerlegt)
  return titel
}

console.log('\nWiderlegung und deutsche Folgen, Verdrahtung im Bau:')
const wurzel = mkdtempSync(join(tmpdir(), 'wid-de-folgen-'))
process.env.AK_ROOT = wurzel
try {
  const mit = await bau('2026-10-18T15:00:00Z')
  pruefe('Katalog mit deutscher Folge ab dem Tag: der Bau lässt den Weg stehen', mit.streams[0].dub === true && mit.streams[0].dubRanges?.length === 1, mit.streams[0])
  const ohne = await bau(undefined)
  pruefe('ohne Katalogdatei: der Bau löst den Weg', ohne.streams[0].dub === undefined, ohne.streams[0])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\nWiderlegung und deutsche Folgen, Verdrahtung: alle Prüfungen bestanden')
