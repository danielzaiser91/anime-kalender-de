/**
 * Zusicherung: Eine Meldung für Folge 1–25 an der Prime-Summenseite eines Titels mit 13 Folgen wird auf 1–13 gekappt (Haikyu!! Staffel 4,
 * 27 Folgen, 20.10.2026: der Beleg „1–25“ für „Haikyu!! To the Top“ ließ jeden Lauf eine Überschreitung neu anhängen). Eine Meldung nur
 * für Folgen hinter der Folgenzahl ergibt gar keinen Beleg, eine ohne Folgennummer bleibt ein Beleg für den ganzen Titel. Gekappt wird erst ab
 * 3 Folgen über der Zahl (`KAPPUNG_AB_UEBERSCHREITUNG`); um 1–2 bleibt die Meldung stehen (Entscheidung Dirigent 20.10.2026). Der Lauf liest
 * erfundene Meldungen gegen eine Attrappe des Bestands (`tools/meldung-summenseite-mock.mjs`), geschrieben wird nichts (`--trocken`).
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/meldung-summenseite-mock.mjs')).href
const fehler: string[] = []

const lauf = spawnSync(
  process.execPath,
  [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts'), '--trocken'],
  { cwd: wurzel, encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: 'test' } },
)
const beleg = lauf.stdout.split('\n').filter((z) => !z.startsWith('['))
const titel = beleg.filter((z) => /^- anilistId: \d+$/.test(z)).map((z) => z.replace('- anilistId: ', ''))
const notizen = beleg.filter((z) => z.startsWith('  note: '))
if (lauf.status !== 0) fehler.push(`Lauf endete mit ${lauf.status}`)
if (titel.join() !== '1,3,4,5') fehler.push(`Belege für Titel ${titel.join(', ') || 'keinen'} statt 1, 3, 4 und 5`)
if (!notizen[0]?.startsWith('  note: "Folgen 1–13 mit deutschem Ton')) fehler.push(`Notiz von Titel 1: ${notizen[0] ?? 'keine'}`)
if (!notizen[1]?.startsWith('  note: "Tonspuren: Deutsch')) fehler.push(`Notiz von Titel 3: ${notizen[1] ?? 'keine'}`)
if (!notizen[2]?.startsWith('  note: "Folgen 1–14 mit deutschem Ton')) fehler.push(`Notiz von Titel 4 (um 2 drüber, bleibt): ${notizen[2] ?? 'keine'}`)
if (!notizen[3]?.startsWith('  note: "Folgen 1–12 mit deutschem Ton')) fehler.push(`Notiz von Titel 5 (um 3 drüber, gekappt): ${notizen[3] ?? 'keine'}`)
const meldungen = lauf.stderr.split('\n').filter((z) => z.includes('über der Folgenzahl'))
if (!meldungen.some((z) => z.includes('Titel 1: Folgen 1–25 ') && z.includes('Folgenzahl 13 ') && z.endsWith('gekappt'))) fehler.push('keine Warnung „gekappt“ für Titel 1')
if (!meldungen.some((z) => z.includes('Titel 2: Folgen 14–25 ') && z.includes('Folgenzahl 12 ') && z.endsWith('verworfen'))) fehler.push('keine Warnung „verworfen“ für Titel 2')
if (!meldungen.some((z) => z.includes('Titel 5: Folgen 1–15 ') && z.includes('Folgenzahl 12 ') && z.endsWith('gekappt'))) fehler.push('keine Warnung „gekappt“ für Titel 5')
if (meldungen.length !== 3) fehler.push(`${meldungen.length} Kappungs-Warnungen statt 3 (Titel 1, 2, 5)`)
if (beleg.some((z) => /to: 25/.test(z))) fehler.push('Beleg nennt Folgen über der Folgenzahl')
if (fehler.length) {
  console.error(`check-meldung-summenseite: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-meldung-summenseite: 1–25 bei 13 Folgen → 1–13; nur 14–25 bei 12 → kein Beleg; ohne Folgennummer → Beleg bleibt; um 2 drüber → bleibt, um 3 → gekappt.')
