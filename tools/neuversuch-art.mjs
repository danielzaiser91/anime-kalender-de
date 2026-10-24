/**
 * Art des Neuversuchs in `tools/commit-data.sh`: was muss nach einem abgelehnten Push (Fernstand bewegt) wirklich noch laufen?
 * Aufruf: node tools/neuversuch-art.mjs <logik-basis> <bau-basis> <neuer-fernstand>   → eine Zeile: `nichts`, `daten` oder `code`.
 *
 * Anlass (24.10.2026, Lauf 40091570662): Jeder Neuversuch baute und prüfte alles neu (~7,5 min), main bewegte sich in der Zeit
 * schneller, sechs Versuche und die 45-min-Frist gingen verloren. Die Einteilung nutzt dieselben Pfade wie `pr-nachrechnen.mjs`
 * (Bewegung auf main, die die Kette nicht entwertet), damit es nur eine Liste gibt:
 *   nichts  seit dem Bau bewegten sich nur Bot-Dateien ohne Leser: Bau und Prüfungen gelten weiter, nur Rebase.
 *   daten   seit der letzten check:logic bewegten sich nur Datenpfade: neu bauen und check:bestand, check:logic gilt weiter.
 *   code    alles andere, auch jeder Fehler beim Vergleich (fail closed): volle Kette.
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { istDatenpfad } from './pr-nachrechnen.mjs'
import { istBotDatei } from './pr-nachrechnen-bot-pfade.mjs'

/** Bot-Dateien, die `check:bestand` liest (Test `neuversuch-art-leser.test.mjs`): bei ihrer Bewegung muss `check:bestand` laufen, also nie `nichts`. */
export const BESTAND_GELESEN = ['tools/kalender-plausibilitaet-grenzen.json']

const istNichtsDatei = (datei) => istBotDatei(datei) && !BESTAND_GELESEN.some((p) => datei === p || datei.startsWith(`${p}/`))

function geaendert(von, bis) {
  const aus = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', von, bis], { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26 })
  return aus.split('\0').filter(Boolean)
}

export function neuversuchArt(logikBasis, bauBasis, neu, diff = geaendert) {
  try {
    const seitLogik = diff(logikBasis, neu)
    if (!seitLogik.every(istDatenpfad)) return 'code'
    const seitBau = diff(bauBasis, neu)
    return seitBau.every(istNichtsDatei) ? 'nichts' : 'daten'
  } catch {
    return 'code'
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [logik, bau, neu] = process.argv.slice(2)
  console.log(logik && bau && neu ? neuversuchArt(logik, bau, neu) : 'code')
}
