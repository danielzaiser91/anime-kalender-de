/**
 * Test von `lib/cr-browser-start.ts`: Chromium startet einmal je Lauf, und die erste Anforderung schreibt genau eine Logzeile mit ihrem Grund.
 * Ohne Netz und ohne Browser: der Starter ist eine Attrappe, die nur zählt.
 * Die Verdrahtung im Abruf prüft der zweite Teil am Syntaxbaum von `scrape-crunchyroll-dub.ts` (kein Textmuster).
 */
import { readFileSync } from 'node:fs'
import type { Browser } from 'playwright'
import ts from 'typescript'
import { browserHolerMit } from './lib/cr-browser-start.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const browser = { close: async () => undefined } as unknown as Browser

console.log('\nBrowserstart')
{
  const zeilen: string[] = []
  let starts = 0
  const starte = async () => {
    starts++
    return browser
  }
  const halter = browserHolerMit(starte, (z) => zeilen.push(z))
  pruefe('vor dem ersten Aufruf läuft kein Browser', halter.aktuell() === undefined)
  const erster = await halter.holen('kein Zugangspaket')
  pruefe('erster Aufruf startet genau einmal', starts === 1, starts)
  pruefe('erster Aufruf schreibt genau eine Zeile mit Grund', zeilen.length === 1 && zeilen[0] === '[cr-dub] Browser gestartet: kein Zugangspaket', zeilen)
  const zweiter = await halter.holen('Adresse ohne Serienkennung')
  pruefe('zweiter Aufruf startet nicht erneut', starts === 1, starts)
  pruefe('zweiter Aufruf schreibt keine zweite Zeile', zeilen.length === 1, zeilen)
  pruefe('zweiter Aufruf gibt denselben Browser', erster === zweiter && halter.aktuell() === erster)
}

console.log('\nFehlerfall')
{
  const zeilen: string[] = []
  let versuche = 0
  const starte = async () => {
    versuche++
    if (versuche === 1) throw new Error('startet nicht')
    return browser
  }
  const halter = browserHolerMit(starte, (z) => zeilen.push(z))
  let fehler = ''
  try {
    await halter.holen('--seitenanzeige')
  } catch (err) {
    fehler = (err as Error).message
  }
  pruefe('ein gescheiterter Start wird weitergereicht', fehler === 'startet nicht', fehler)
  pruefe('ein gescheiterter Start schreibt keine Zeile', zeilen.length === 0, zeilen)
  pruefe('ein gescheiterter Start merkt sich keinen Browser', halter.aktuell() === undefined)
  await halter.holen('--seitenanzeige')
  pruefe(
    'der nächste Aufruf versucht es erneut und schreibt dann genau eine Zeile',
    versuche === 2 && zeilen.length === 1 && zeilen[0] === '[cr-dub] Browser gestartet: --seitenanzeige',
    zeilen,
  )
}

console.log('\nVerdrahtung im Abruf')
const abruf = ts.createSourceFile(
  'scrape-crunchyroll-dub.ts',
  readFileSync(new URL('./scrape-crunchyroll-dub.ts', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
)
const knoten: ts.Node[] = []
const sammle = (n: ts.Node): void => {
  knoten.push(n)
  ts.forEachChild(n, sammle)
}
sammle(abruf)
const text = (n: ts.Node): string => n.getText(abruf)
const aufrufe = (name: string): ts.CallExpression[] =>
  knoten.filter((n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && text(n.expression) === name)

/* Zu welchem Aufbau der Browser gehört: `new CrunchyrollSeiten(…)`, `new CrunchyrollApi(…)` oder `.newPage(…)`. */
function umgebung(n: ts.Node): string {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isNewExpression(p)) return text(p.expression)
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === 'newPage') return 'newPage'
  }
  return ''
}
const erwartet: Record<string, string> = {
  'kein Zugangspaket': 'CrunchyrollApi',
  'Adresse ohne Serienkennung': 'CrunchyrollSeiten',
  '--seitenanzeige': 'newPage',
}
const holen = aufrufe('browserHalter.holen').map((c) => ({
  grund: ts.isStringLiteral(c.arguments[0]) ? c.arguments[0].text : '',
  umgebung: umgebung(c),
}))
pruefe('drei Aufrufe von holen, je mit Grund aus der Liste', holen.length === 3 && holen.every((h) => erwartet[h.grund] === h.umgebung), holen)
pruefe('jeder Grund steht an genau einer Stelle', new Set(holen.map((h) => h.grund)).size === 3, holen)

const starts = knoten.filter(
  (n): n is ts.PropertyAccessExpression => ts.isPropertyAccessExpression(n) && text(n.expression) === 'chromium' && n.name.text === 'launch',
)
/* Der Start gehört in `browserHolerMit(…)`, sonst läuft er am Grund und an der Meldung vorbei. */
function inStarter(n: ts.Node): boolean {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && text(p.expression) === 'browserHolerMit') return true
  }
  return false
}
pruefe('genau ein chromium.launch, und zwar im Starter', starts.length === 1 && inStarter(starts[0]), starts.length)

const schliessen = knoten.filter(
  (n): n is ts.PropertyAccessExpression => ts.isPropertyAccessExpression(n) && n.name.text === 'close' && text(n.expression).startsWith('browserHalter.aktuell()'),
)
pruefe('zwei close-Stellen über browserHalter.aktuell()', schliessen.length === 2, schliessen.length)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
