/**
 * Welche Quellen ein Workflow bei jedem Lauf abruft — und ob jede eine eigene Frist in `quellen-fristen.mjs` hat.
 * Anlass (26.10.2026): `crunchyroll` läuft stündlich, hatte aber keinen Fristeintrag; die Standardfrist von 4 Tagen
 * (Alarm erst bei 8) ließ den stummen Kalender fünf Tage unbemerkt.
 */
import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import ts from 'typescript'
import { parse } from 'yaml'
import { schreiberNamen } from '../pipeline/lib/quellen-schreiber.ts'

/** Alle `run:`-Texte der Schritte eines Workflows. */
export function laufBefehle(workflowText) {
  const doc = parse(workflowText)
  const befehle = []
  for (const job of Object.values(doc.jobs ?? {})) {
    for (const schritt of job.steps ?? []) if (typeof schritt.run === 'string') befehle.push(schritt.run)
  }
  return befehle
}

/** Skriptdateien (`.ts`/`.mjs`), die ein Befehl aufruft; `npm run x` wird über `package.json` aufgelöst. */
export function skriptDateien(befehl, npmSkripte, besucht = new Set()) {
  const dateien = new Set()
  for (const m of befehl.matchAll(/(?:^|[\s'"])((?:\.\/)?[\w./-]+\.(?:ts|mjs))(?=[\s'"]|$)/g)) {
    if (!m[1].startsWith('node_modules/')) dateien.add(m[1].replace(/^\.\//, ''))
  }
  for (const m of befehl.matchAll(/npm run ([\w:-]+)/g)) {
    if (besucht.has(m[1]) || !npmSkripte[m[1]]) continue
    besucht.add(m[1])
    for (const d of skriptDateien(npmSkripte[m[1]], npmSkripte, besucht)) dateien.add(d)
  }
  return [...dateien].sort()
}

/** Namen aus `recordSource(…)`-Aufrufen im Syntaxbaum (`schreiberNamen`, derselbe Leser wie `check-quellen-schreiber.ts`); ein Name, der keine Zeichenkette ist, steht als „?“ da. */
export function quellenNamen(quelltext) {
  return schreiberNamen(quelltext)
}

/** Relative Importe (`import … from`, `export … from`, `import('…')`) einer Quelldatei, als Pfade ab der Wurzel; Pakete bleiben draußen. */
export function importZiele(quelltext, datei) {
  const ziele = []
  const merke = (spec) => {
    if (typeof spec === 'string' && spec.startsWith('.') && /\.(ts|mjs)$/.test(spec)) ziele.push(posix.normalize(posix.join(posix.dirname(datei), spec)))
  }
  const besuche = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) merke(n.moduleSpecifier.text)
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) merke(n.arguments[0].text)
    ts.forEachChild(n, besuche)
  }
  besuche(ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true))
  return ziele
}

/** Die Datei und alles, was sie über relative Importe erreicht (`pipeline/lib/*.ts` usw.), mit ihrem Quelltext; nicht lesbare Ziele entfallen. */
function erreichbar(wurzel, start) {
  const gesehen = new Map()
  const offen = [start]
  while (offen.length) {
    const datei = offen.pop()
    if (gesehen.has(datei)) continue
    let text
    try {
      text = readFileSync(join(wurzel, datei), 'utf8')
    } catch {
      continue
    }
    gesehen.set(datei, text)
    offen.push(...importZiele(text, datei))
  }
  return gesehen
}

/** Quellennamen aller Skripte, die der Workflow aufruft, mit den Dateien, aus denen sie stammen. */
export function quellenDesWorkflows(wurzel, workflowDatei) {
  const npmSkripte = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8')).scripts
  const quellen = {}
  for (const befehl of laufBefehle(readFileSync(join(wurzel, '.github/workflows', workflowDatei), 'utf8'))) {
    for (const datei of skriptDateien(befehl, npmSkripte)) {
      for (const [quelle, text] of erreichbar(wurzel, datei)) {
        for (const name of quellenNamen(text)) (quellen[name] ??= new Set()).add(quelle)
      }
    }
  }
  return quellen
}

/** Quellen, die der Workflow bei jedem Lauf schreibt, aber keinen eigenen Fristeintrag haben. */
export function ohneFrist(quellen, fristen) {
  return Object.keys(quellen).filter((name) => !(name in fristen)).sort()
}
