/**
 * Kein TMDB-Abruf im Bestand ist älter als 180 Tage (API-Bedingungen 1.C: Zwischenspeicher höchstens 6 Monate).
 * Geprüft sind die Dateien mit Abrufdatum; Plakate und Hintergrundbilder tragen keins (Stand: `docs/wissen/quellen.md`, 12.10.2026).
 * Aufruf: `npm run check:bestand-liste`. Rot heißt: der Sammler hat den Bestand nicht rechtzeitig erneuert.
 */
import { alterInTagen, FRIST_TAGE, hatInhalt, inhaltsStand, type MitInhaltsstand } from './lib/tmdb-ablauf.ts'
import { readJson } from './lib/util.ts'

const jetzt = new Date()
const zuAlt: string[] = []

function pruefeDatei(datei: string, eintraege: [string, string | undefined][]): void {
  const alt = eintraege.filter(([, stand]) => (alterInTagen(stand, jetzt) ?? Infinity) > FRIST_TAGE)
  for (const [id, stand] of alt) zuAlt.push(`${datei} ${id}: ${stand ?? 'ohne Datum'}`)
  console.log(`  ${alt.length ? '✖' : '✓'} ${datei}: ${eintraege.length} Einträge, ${alt.length} älter als ${FRIST_TAGE} Tage`)
}

const titel = readJson<Record<string, MitInhaltsstand>>('data/tmdb-titles.json', {})
pruefeDatei('data/tmdb-titles.json', Object.entries(titel).filter(([, e]) => hatInhalt(e)).map(([id, e]) => [id, inhaltsStand(e)]))
for (const datei of ['data/tmdb-folgen.json', 'data/cartoon-folgen.json']) {
  const bestand = readJson<Record<string, { geholtAm?: string }>>(datei, {})
  pruefeDatei(datei, Object.entries(bestand).map(([id, e]) => [id, e.geholtAm]))
}
const cartoons = readJson<Record<string, { geholtAm?: string }>>('data/cartoons.json', {})
pruefeDatei('data/cartoons.json', Object.entries(cartoons).map(([id, e]) => [id, e.geholtAm]))

if (zuAlt.length) {
  console.error(`\n${zuAlt.length} TMDB-Einträge älter als ${FRIST_TAGE} Tage:\n${zuAlt.slice(0, 20).join('\n')}`)
  process.exit(1)
}
console.log('\nTMDB-Ablauf (Bestand): nichts älter als 180 Tage.')
