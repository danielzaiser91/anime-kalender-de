/**
 * Zusicherung (Syntaxbaum): **05-releases und 06-cr-simuldubs übergeben `observedEpisodes` nur den gekappten Eintrag** (`ohneWocheUeberAnzahl`).
 * Der Bau selbst liest Bestandsdateien und läuft nicht in `check:logic`; deshalb wird sein Quelltext geprüft.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'

/** Die Argumente (als Text) jedes Aufrufs `observedEpisodes(ohneWocheUeberAnzahl(...))` im Quelltext. */
export function gekappteBeobachtungen(quelltext: string): string[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const aufrufe: string[] = []
  const besuche = (n: ts.Node): void => {
    const arg = ts.isCallExpression(n) && n.expression.getText(datei) === 'observedEpisodes' ? n.arguments[0] : undefined
    if (arg && ts.isCallExpression(arg) && arg.expression.getText(datei) === 'ohneWocheUeberAnzahl') aufrufe.push(arg.arguments.map((a) => a.getText(datei)).join(','))
    ts.forEachChild(n, besuche)
  }
  besuche(datei)
  return aufrufe
}

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const bau05 = readFileSync(new URL('./bau/05-releases.ts', import.meta.url), 'utf8')
const kappung05 = 'observedEpisodes(ohneWocheUeberAnzahl(slot, schedule, entry.slug))'
pruefe('05-releases: observedEpisodes bekommt den gekappten Eintrag mit Eintrag, Plan und Namen, genau einmal', gekappteBeobachtungen(bau05).join('|') === 'slot,schedule,entry.slug', gekappteBeobachtungen(bau05))
pruefe('Sonde: ohne Kappung erkannt', bau05.includes(kappung05) && gekappteBeobachtungen(bau05.replace(kappung05, 'observedEpisodes(slot)')).length === 0)
pruefe('Sonde: falsches Argument erkannt', gekappteBeobachtungen(bau05.replace(kappung05, 'observedEpisodes(ohneWocheUeberAnzahl(slot, {}, entry.slug))')).join('|') !== 'slot,schedule,entry.slug')

const bau06 = readFileSync(new URL('./bau/06-cr-simuldubs.ts', import.meta.url), 'utf8')
const kappung06 = 'observedEpisodes(ohneWocheUeberAnzahl(slot, { episodeCount: episodeCountAssumed ? undefined : episodeCount }, name))'
pruefe('06-cr-simuldubs: observedEpisodes bekommt den gekappten Eintrag mit belegter Zahl, genau einmal', gekappteBeobachtungen(bau06).join('|') === 'slot,{ episodeCount: episodeCountAssumed ? undefined : episodeCount },name', gekappteBeobachtungen(bau06))
pruefe('Sonde 06: ohne Kappung erkannt', bau06.includes(kappung06) && gekappteBeobachtungen(bau06.replace(kappung06, 'observedEpisodes(slot)')).length === 0)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('05-releases und 06-cr-simuldubs kappen die Beobachtungen über ohneWocheUeberAnzahl')
