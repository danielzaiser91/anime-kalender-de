/**
 * Zusicherung: **Außerhalb von `leseZugeordnet` und einer kleinen Ausnahmeliste nennt kein Code `data/prime-zugeordnet.json`** (20.10.2026, Folge von PR 1612).
 * Anlass: Eine Seitensperre (`data/belege-entfernt.yaml`) wirkt nur dort, wo gelesen wird wie `leseZugeordnet`; sechs Leser lasen roh.
 * Geprüft wird der Syntaxbaum aller verfolgten Code-Dateien (Zeichenketten und Vorlagen, keine Kommentare), nicht der Text.
 * Prüfdateien (`check-*`, `*.test.*`) legen die Datei in Kulissen an und lesen das Ergebnis; sie sind ausgenommen.
 * Grenze: ein aus Teilen zusammengesetzter Pfad (`'prime-' + name`) wird nicht erkannt. Läuft in `check:logic`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const NENNT_DATEI = /prime-zugeordnet/

/** Dateien, die den Namen tragen dürfen — mit Grund. Jeder Eintrag muss ihn noch tragen (sonst veraltet die Liste). */
export const AUSNAHMEN: Record<string, string> = {
  'pipeline/lib/prime-meldung-riegel.ts': 'der Zugang selbst',
  'pipeline/lib/rohfolgen-abschluss.ts': 'Schreibziel des Zuordners; gelesen wird über leseZugeordnet',
  'tools/worker-rohfolgen-rettung.ts': 'kopiert die Datei als Ganzes aus dem Briefkasten-Zweig, liest keine Meldungen',
}

const CODE = /\.(ts|tsx|mjs|cjs|js)$/
const istPruefdatei = (pfad: string) => /^check-|\.test\./.test(basename(pfad))

/** TSX nur für .tsx: sonst läse der Parser `<T>(x) =>` oder `<any>x` als JSX und verschluckte den Rest der Datei (JS-Art tut dasselbe, daher TS auch für .mjs/.js). */
function scriptArt(pfad: string): ts.ScriptKind {
  return pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}

/** Die Zeichenketten-Texte einer Quelle, in denen der Dateiname vorkommt. */
export function nenntDatei(pfad: string, text: string): string[] {
  const art = scriptArt(pfad)
  const baum = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, art)
  const funde: string[] = []
  const gehe = (k: ts.Node): void => {
    const roh = ts.isStringLiteralLike(k) || ts.isTemplateHead(k) || ts.isTemplateMiddle(k) || ts.isTemplateTail(k) ? k.text : undefined
    if (roh !== undefined && NENNT_DATEI.test(roh)) funde.push(roh)
    ts.forEachChild(k, gehe)
  }
  gehe(baum)
  return funde
}

/** Rohe Leser: Dateien außerhalb der Ausnahmen, die den Namen nennen; dazu Ausnahmen, die ihn nicht mehr tragen. */
export function pruefeLeser(dateien: { pfad: string; text: string }[], ausnahmen: Record<string, string> = AUSNAHMEN): string[] {
  const fehler: string[] = []
  const gefunden = new Set<string>()
  for (const d of dateien) {
    if (!CODE.test(d.pfad) || istPruefdatei(d.pfad)) continue
    if (nenntDatei(d.pfad, d.text).length === 0) continue
    if (d.pfad in ausnahmen) gefunden.add(d.pfad)
    else fehler.push(`${d.pfad} nennt prime-zugeordnet.json — über leseZugeordnet lesen (pipeline/lib/prime-meldung-riegel.ts) oder mit Grund in AUSNAHMEN eintragen`)
  }
  for (const pfad of Object.keys(ausnahmen)) {
    if (!gefunden.has(pfad)) fehler.push(`Ausnahme ${pfad} nennt prime-zugeordnet.json nicht mehr — aus AUSNAHMEN entfernen`)
  }
  return fehler
}

function main(): number {
  const wurzel = resolve(fileURLToPath(import.meta.url), '../..')
  const pfade = execFileSync('git', ['ls-files', '-z'], { cwd: wurzel, windowsHide: true, maxBuffer: 1 << 26 }).toString().split('\0')
  const dateien = pfade.filter((p) => CODE.test(p)).map((pfad) => ({ pfad, text: readFileSync(resolve(wurzel, pfad), 'utf8') }))
  const fehler = pruefeLeser(dateien)
  if (fehler.length) {
    console.error(`FEHL check-prime-zugeordnet-leser:\n  ${fehler.join('\n  ')}`)
    return 1
  }
  console.log(`check-prime-zugeordnet-leser: ${dateien.length} Code-Dateien, kein roher Leser.`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main())
