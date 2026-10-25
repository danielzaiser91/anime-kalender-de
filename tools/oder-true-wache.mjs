/**
 * Wächter gegen `|| true` (auch `|| :`, `; true`, `|| /bin/true`) in Workflows und Lauf-Skripten.
 *
 * Warum: Ein verschluckter Fehler vor einem Werkzeug, das Daten schreibt oder belegt, lässt den Lauf grün
 * und den Beleg still verloren gehen (Prüfer 1578). Jeder Treffer ist deshalb ein Fehler, außer er steht
 * mit Begründung in `OHNE_BEFUND` (tools/oder-true-ausnahmen.mjs). Eine Ausnahme ohne Treffer ist ebenfalls
 * ein Fehler, damit die Liste nicht verwaist.
 *
 * Gescannt wird je Workflow-Schritt der geparste `run`-Text, je `tools/*.sh` der Dateitext; reine
 * Kommentarzeilen zählen nicht.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { OHNE_BEFUND } from './oder-true-ausnahmen.mjs'

const MUSTER = /(\|\||;)\s*(?:\/bin\/|\/usr\/bin\/)?(?:true|:)(?![\w-])/

/** Zeilen mit Verschlucker; Kommentarzeilen bleiben außen vor. */
export function findeOderTrue(text) {
  const treffer = []
  text.split('\n').forEach((zeile, i) => {
    if (zeile.trim().startsWith('#')) return
    if (MUSTER.test(zeile)) treffer.push({ zeile: i + 1, text: zeile.trim() })
  })
  return treffer
}

/** Alle `run`-Texte einer Workflow-Datei. */
export function laufTexte(yamlText) {
  let doc
  try {
    doc = parse(yamlText)
  } catch {
    return [] // kaputtes YAML meldet check-workflows.mjs selbst
  }
  const jobs = Object.values(doc?.jobs ?? {})
  return jobs.flatMap((job) => (job?.steps ?? []).map((s) => s?.run).filter((r) => typeof r === 'string'))
}

/** Treffer abzüglich Ausnahmen; `verwaist` = Ausnahmen, die nichts mehr treffen. */
export function bewerte(funde, ausnahmen) {
  const benutzt = new Set()
  const offen = funde.filter((f) => {
    const hit = ausnahmen.findIndex((a) => a.datei === f.datei && f.text.includes(a.text))
    if (hit < 0) return true
    benutzt.add(hit)
    return false
  })
  const verwaist = ausnahmen.filter((_, i) => !benutzt.has(i))
  return { offen, verwaist }
}

/** Alle Funde unter `wurzel`: `.github/workflows/*.yml` und `tools/*.sh`. */
export function sammleFunde(wurzel) {
  const funde = []
  const wf = resolve(wurzel, '.github/workflows')
  for (const f of readdirSync(wf).filter((n) => /\.ya?ml$/.test(n))) {
    for (const lauf of laufTexte(readFileSync(resolve(wf, f), 'utf8'))) {
      for (const t of findeOderTrue(lauf)) funde.push({ datei: `.github/workflows/${f}`, text: t.text })
    }
  }
  const tools = resolve(wurzel, 'tools')
  for (const f of readdirSync(tools).filter((n) => n.endsWith('.sh'))) {
    for (const t of findeOderTrue(readFileSync(resolve(tools, f), 'utf8'))) funde.push({ datei: `tools/${f}`, text: t.text })
  }
  return funde
}

/** Meldezeilen; leer = grün. */
export function pruefe(wurzel, ausnahmen = OHNE_BEFUND) {
  const { offen, verwaist } = bewerte(sammleFunde(wurzel), ausnahmen)
  return [
    ...offen.map((f) => `✗ ${f.datei}: \`${f.text.slice(0, 120)}\` verschluckt einen Fehler (|| true). Beheben oder mit Begründung in tools/oder-true-ausnahmen.mjs eintragen.`),
    ...verwaist.map((a) => `✗ tools/oder-true-ausnahmen.mjs: Ausnahme für ${a.datei} („${a.text}“) trifft nichts mehr — streichen.`),
  ]
}
