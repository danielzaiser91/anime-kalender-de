/**
 * Zusicherung (05.11.2026): Die Suchadressen-Liste nennt nur Titel, die im fertigen Bestand beim Anbieter keine Titelseite haben
 * (Anlass: Tank Chair 209499 stand auf der Liste, obwohl die Titelseite B0HKCYH1C6 in titles.json lag).
 * Die Verdrahtung in `schreibeDatensatz` belegt `check-pruefliste-verdrahtung.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-suchadressen-endzustand.ts`
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { suchenOhneTitelseite, schreibeSuchadressenImEndzustand } from './bau/13-3-suchadressen-endzustand.ts'
import { suchadressenInTemp } from './lib/suchadressen-temp.ts'
import type { SlimTitel } from './bau/13-2-auslieferung.ts'

let verletzt = 0
const faelle: string[] = []
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void faelle.push(name)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const slimTitel = (id: number, streams: { platform: string; url: string }[]) => ({ id, streams }) as unknown as SlimTitel
const such = (id: number, plattform: string) => ({ id, titel: `T${id}`, plattform, url: 'https://www.amazon.de/s?k=X' })
const ids = (l: { id: number }[]) => l.map((e) => e.id)
const SEITE = 'https://www.amazon.de/gp/video/detail/B0HKCYH1C6'

pruefe('Titelseite beim selben Anbieter: raus', ids(suchenOhneTitelseite([such(1, 'primevideo')], [slimTitel(1, [{ platform: 'primevideo', url: SEITE }])])).length === 0)
pruefe('kein Weg mehr: bleibt', ids(suchenOhneTitelseite([such(2, 'primevideo')], [slimTitel(2, [])])).join() === '2')
pruefe('Seite nur bei einem anderen Anbieter: bleibt', ids(suchenOhneTitelseite([such(3, 'primevideo')], [slimTitel(3, [{ platform: 'netflix', url: 'https://www.netflix.com/title/3' }])])).join() === '3')
pruefe('Seite gehört einem anderen Titel: bleibt', ids(suchenOhneTitelseite([such(4, 'primevideo')], [slimTitel(5, [{ platform: 'primevideo', url: SEITE }])])).join() === '4')
pruefe('Suche als Weg zählt nicht als Seite (?k=, /s, /search?q=)', ids(suchenOhneTitelseite([such(6, 'primevideo'), such(7, 'primevideo'), such(8, 'crunchyroll')], [
  slimTitel(6, [{ platform: 'primevideo', url: 'https://www.amazon.de/gp/video/search?k=x' }]),
  slimTitel(7, [{ platform: 'primevideo', url: 'https://www.amazon.de/s?x=1' }]),
  slimTitel(8, [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/search?q=x' }]),
])).join() === '6,7,8')
pruefe('Startseite ohne Pfad zählt nicht als Seite', ids(suchenOhneTitelseite([such(9, 'netflix')], [slimTitel(9, [{ platform: 'netflix', url: 'https://netflix.com' }])])).join() === '9')
pruefe('nicht ausgelieferter Titel: bleibt', ids(suchenOhneTitelseite([such(10, 'netflix')], [])).join() === '10')
pruefe('Mischfall: nur der Titel ohne Seite bleibt', ids(suchenOhneTitelseite([such(11, 'primevideo'), such(12, 'primevideo')], [slimTitel(11, [{ platform: 'primevideo', url: SEITE }]), slimTitel(12, [])])).join() === '12')

/* Stiller Ausfall: Was der Filter weglässt, steht mit Anzahl und Beispielen im Log (Aufruf wie in Phase 13, Listen in einem Temp-Ordner). */
suchadressenInTemp()
const zeilen: string[] = []
const echtesLog = console.log
console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
try {
  schreibeSuchadressenImEndzustand([such(21, 'primevideo'), such(22, 'primevideo'), such(23, 'primevideo')], [slimTitel(21, [{ platform: 'primevideo', url: SEITE }]), slimTitel(22, [])])
  schreibeSuchadressenImEndzustand([such(24, 'primevideo')], [slimTitel(24, [])])
} finally {
  console.log = echtesLog
}
const logzeilen = zeilen.filter((z) => z.startsWith('Suchadressen-Liste:'))
pruefe('Logzeile nennt Anzahl und Beispiel der weggelassenen Einträge', logzeilen[0] === 'Suchadressen-Liste: 1 von 3 Einträgen im Endzustand beantwortet — z. B. 21 T21 (primevideo)', logzeilen[0])
pruefe('Logzeile auch ohne weggelassene Einträge: 0 von 1', logzeilen[1] === 'Suchadressen-Liste: 0 von 1 Einträgen im Endzustand beantwortet', logzeilen[1])

/* Der Aufrufer: `liefereAus` in build.ts reicht `synchro.suchOffen` an die Auslieferung (Mutant `suchOffen: []` ließe die Liste live immer leer). */
const quelle = ts.createSourceFile('build.ts', readFileSync(new URL('./build.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const liefere = quelle.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'liefereAus')
const objekte: ts.ObjectLiteralExpression[] = []
const sammle = (n: ts.Node): void => {
  if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'schreibeDatensatzGemessen') n.arguments.filter(ts.isObjectLiteralExpression).forEach((o) => objekte.push(o))
  ts.forEachChild(n, sammle)
}
if (liefere) sammle(liefere)
const suchOffenWert = objekte.flatMap((o) => o.properties).find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText() === 'suchOffen')?.initializer.getText()
pruefe('build.ts: liefereAus reicht synchro.suchOffen an schreibeDatensatzGemessen', suchOffenWert === 'synchro.suchOffen', suchOffenWert)

if (verletzt > 0) process.exit(1)
console.log(`Suchadressen im Endzustand: ${faelle.length} Fälle grün (Titelseite raus; Suche, Startseite, anderer Anbieter, anderer Titel, unbekannter Titel bleiben; Logzeile; build.ts reicht suchOffen durch).`)
