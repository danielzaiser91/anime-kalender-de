/**
 * Kein TMDB-Abruf im Bestand ist älter als 180 Tage (API-Bedingungen 1.C: Zwischenspeicher höchstens 6 Monate).
 * Geprüft sind alle Dateien mit Abrufdatum, seit 13.10.2026 auch Plakate, Hintergrundbilder und `data/tmdb.json` (`inhaltAm`; Eintrag ohne Datum zählt als zu alt,
 * `null` = „TMDB hat keins" nicht).
 * Aufruf: `npm run check:bestand-liste`. Rot heißt: der Sammler hat den Bestand nicht rechtzeitig erneuert.
 */
import { tageSeit, FRIST_TAGE, hatInhalt, inhaltsStand, type MitInhaltsstand } from './lib/tmdb-ablauf.ts'
import { readJson } from './lib/util.ts'

const jetzt = new Date()
const zuAlt: string[] = []

function pruefeDatei(datei: string, eintraege: [string, string | undefined][]): void {
  const alt = eintraege.filter(([, stand]) => (tageSeit(stand, jetzt) ?? Infinity) > FRIST_TAGE)
  for (const [id, stand] of alt) zuAlt.push(`${datei} ${id}: ${stand ?? 'ohne Datum'}`)
  console.log(`  ${alt.length ? '✖' : '✓'} ${datei}: ${eintraege.length} Einträge, ${alt.length} älter als ${FRIST_TAGE} Tage`)
}

const titel = readJson<Record<string, MitInhaltsstand>>('data/tmdb-titles.json', {})
pruefeDatei('data/tmdb-titles.json', Object.entries(titel).filter(([, e]) => hatInhalt(e)).map(([id, e]) => [id, inhaltsStand(e)]))
for (const datei of ['data/tmdb-folgen.json', 'data/cartoon-folgen.json']) {
  const bestand = readJson<Record<string, { geholtAm?: string }>>(datei, {})
  pruefeDatei(datei, Object.entries(bestand).map(([id, e]) => [id, e.geholtAm]))
}
const bildDateien: [string, (e: MitInhaltsstand) => boolean][] = [['data/tmdb-poster.json', () => true], ['data/tmdb-banner.json', () => true], ['data/tmdb.json', hatInhalt]]
for (const [datei, traegt] of bildDateien) {
  const bestand = readJson<Record<string, MitInhaltsstand | null>>(datei, {})
  pruefeDatei(datei, Object.entries(bestand).filter((e): e is [string, MitInhaltsstand] => e[1] !== null && traegt(e[1])).map(([id, e]) => [id, e.inhaltAm]))
}
const staffel0 = readJson<Record<string, MitInhaltsstand>>('data/tmdb-staffel0.json', {})
pruefeDatei('data/tmdb-staffel0.json', Object.entries(staffel0).map(([id, e]) => [id, e.inhaltAm]))
const cartoons = readJson<Record<string, { geholtAm?: string }>>('data/cartoons.json', {})
pruefeDatei('data/cartoons.json', Object.entries(cartoons).map(([id, e]) => [id, e.geholtAm]))

if (zuAlt.length) {
  console.error(`\n${zuAlt.length} TMDB-Einträge älter als ${FRIST_TAGE} Tage:\n${zuAlt.slice(0, 20).join('\n')}`)
  console.log(`VERSTÖSSE: ${zuAlt.length}`)
  process.exit(1)
}
console.log('\nTMDB-Ablauf (Bestand): nichts älter als 180 Tage.')
console.log('VERSTÖSSE: 0')
