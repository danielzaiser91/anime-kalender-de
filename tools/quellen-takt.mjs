/**
 * Welche Quellen ein Workflow bei jedem Lauf abruft — und ob jede eine eigene Frist in `quellen-fristen.mjs` hat.
 * Anlass (26.10.2026): `crunchyroll` läuft stündlich, hatte aber keinen Fristeintrag; die Standardfrist von 4 Tagen
 * (Alarm erst bei 8) ließ den stummen Kalender fünf Tage unbemerkt.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

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

/** Namen aus `recordSource('name', …)`-Aufrufen im Quelltext (nur Wörtliches). */
export function quellenNamen(quelltext) {
  return [...quelltext.matchAll(/recordSource\(\s*'([\w-]+)'/g)].map((m) => m[1])
}

/** Quellennamen aller Skripte, die der Workflow aufruft, mit den Dateien, aus denen sie stammen. */
export function quellenDesWorkflows(wurzel, workflowDatei) {
  const npmSkripte = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8')).scripts
  const quellen = {}
  for (const befehl of laufBefehle(readFileSync(join(wurzel, '.github/workflows', workflowDatei), 'utf8'))) {
    for (const datei of skriptDateien(befehl, npmSkripte)) {
      let text
      try {
        text = readFileSync(join(wurzel, datei), 'utf8')
      } catch {
        continue
      }
      for (const name of quellenNamen(text)) (quellen[name] ??= new Set()).add(datei)
    }
  }
  return quellen
}

/** Quellen, die der Workflow bei jedem Lauf schreibt, aber keinen eigenen Fristeintrag haben. */
export function ohneFrist(quellen, fristen) {
  return Object.keys(quellen).filter((name) => !(name in fristen)).sort()
}
