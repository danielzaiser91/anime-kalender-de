/**
 * Wächter: Jede Stelle, die eine Uhrzeit (`.time`) an Besucher ausgibt, nutzt `zeit-text.ts` (`zeitMitMarke`/`zeitGeschaetzt`)
 * oder steht mit Grund in der Ausnahmeliste — sonst läuft die Kennzeichnung geschätzter Zeiten wieder auseinander.
 * Die Form der Ausgabe ist eine Zeile mit `.time` in `${…}`/`{…}`, neben „Uhr“ oder als Teil einer `join`-Zeile.
 * Läuft in `check:logic`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const ORDNER = ['shared', 'web/src', 'pipeline', 'worker/src']

/** Datei → Grund: gibt `.time` aus, aber nie als geschätzt (Prüftext, Beleg ohne geschätzte Zeit, Schlüssel). */
const AUSNAHMEN: Record<string, string> = {
  'shared/zeit-text.ts': 'der Helfer selbst',
  'pipeline/fetch-adn.ts': 'Logzeile des Sammlers',
  'pipeline/lib/beleg-api.ts': 'nennt die Zeit nur, wenn nicht geschätzt',
  'pipeline/lib/sichtungsfenster.ts': 'Prüftext für Handpfleger',
}

const AUSGABE = /\.time\}|\bUhr\b.*\.time\b|\.time\b.*\bUhr\b|\.time\]\.filter|\.time \?\? '–'|(const|let) \w+ = .*\?\.time$/

const KOMMENTAR = /^\s*(\/\/|\*|\/\*)/
/** Die Zeile nutzt den Helfer, wertet das Flag aus (`timeEstimated`) oder trägt das fertige Kennzeichen (`geschaetzt`) oder zählt herunter (`Countdown`, nur gemessene Zeiten). */
const GEKENNZEICHNET = /zeitMitMarke|zeitGeschaetzt|timeEstimated|\bgeschaetzt\b|Countdown/

export function findeLuecken(dateien: Record<string, string>, ausnahmen: Record<string, string>): string[] {
  return Object.entries(dateien).flatMap(([pfad, text]) => {
    if (ausnahmen[pfad]) return []
    const zeilen = text.split('\n').map((z, i) => ({ z, nr: i + 1 }))
    return zeilen.filter(({ z }) => !KOMMENTAR.test(z) && AUSGABE.test(z) && !GEKENNZEICHNET.test(z)).map(({ z, nr }) => `${pfad}:${nr}: ${z.trim()}`)
  })
}

function alleDateien(): Record<string, string> {
  const aus: Record<string, string> = {}
  for (const ordner of ORDNER) {
    for (const f of readdirSync(join(WURZEL, ordner), { recursive: true }) as string[]) {
      if (!/\.(ts|tsx)$/.test(f) || /check-|\.test\./.test(f)) continue
      const pfad = relative(WURZEL, join(WURZEL, ordner, f)).replaceAll('\\', '/')
      aus[pfad] = readFileSync(join(WURZEL, pfad), 'utf8')
    }
  }
  return aus
}

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const luecken = findeLuecken(alleDateien(), AUSNAHMEN)
pruefe('Uhrzeit-Ausgabe ohne zeitMitMarke', luecken.length === 0, `\n${luecken.join('\n')}`)
const probe = { 'x.ts': 'const a = `${ev.time} Uhr`', 'y.ts': 'const a = `${zeitMitMarke(ev, 1)} Uhr`\nconst b = `${ev.time} Uhr`', 'z.ts': '// ${ev.time} Uhr\nconst b = 1' }
pruefe('Probe: ungekennzeichnete Zeilen gefunden, gekennzeichnete und Kommentar nicht', findeLuecken(probe, {}).join('|').startsWith('x.ts:1:') && findeLuecken(probe, {}).length === 2 && findeLuecken(probe, {})[1]!.startsWith('y.ts:2:'))
pruefe('Probe: Ausnahme gilt', findeLuecken(probe, { 'x.ts': 'Grund', 'y.ts': 'Grund' }).length === 0)

if (fehler > 0) {
  console.error(`check-zeit-ausgabe: ${fehler} Fehler`)
  process.exit(1)
}
console.log(`check-zeit-ausgabe: ok (${Object.keys(alleDateien()).length} Dateien, ${Object.keys(AUSNAHMEN).length} Ausnahmen)`)
