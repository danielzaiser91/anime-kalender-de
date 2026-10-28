/**
 * Wächter gegen `|| true` (auch `|| :`, `; true`, `|| /bin/true`), `|| exit 0` und `set +e` in Workflows und Lauf-Skripten.
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

// `exit 0` nach `||` und `set +e` (auch `set +eu`, `set +o errexit`) verschlucken Fehler wie `|| true`.
export const ARTEN = [
  { name: '|| true', muster: /(\|\||;)\s*(?:\/bin\/|\/usr\/bin\/)?(?:true|:)(?![\w-])/ },
  { name: '|| exit 0', muster: /\|\|\s*exit\s+0(?![\w-])/ },
  { name: 'set +e', muster: /(?:^|[;&|(])\s*set\s+\+(?:[a-z]*e[a-z]*|o\s+errexit)(?![\w-])/ },
]

/** Zeilen mit Verschlucker (`art` = Name des Musters); Kommentarzeilen bleiben außen vor. */
export function findeOderTrue(text) {
  const treffer = []
  text.split('\n').forEach((zeile, i) => {
    if (zeile.trim().startsWith('#')) return
    const art = ARTEN.find((a) => a.muster.test(zeile))
    if (art) treffer.push({ zeile: i + 1, text: zeile.trim(), art: art.name })
  })
  return treffer
}

/** Trefferzahl je Muster, z. B. `|| true: 41, || exit 0: 3, set +e: 0`. */
export function zaehleArten(funde) {
  return ARTEN.map((a) => `${a.name}: ${funde.filter((f) => f.art === a.name).length}`).join(', ')
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

/**
 * Treffer abzüglich Ausnahmen; `verwaist` = Ausnahmen ohne Treffer, `abweichend` = Ausnahmen, deren
 * Trefferzahl nicht `anzahl` (Standard 1) entspricht — sonst deckte eine Ausnahme ein später
 * dazukommendes gleichlautendes `|| true` still mit.
 */
export function bewerte(funde, ausnahmen) {
  const zaehler = ausnahmen.map(() => 0)
  const offen = funde.filter((f) => {
    const hit = ausnahmen.findIndex((a) => a.datei === f.datei && f.text.includes(a.text))
    if (hit < 0) return true
    zaehler[hit] += 1
    return false
  })
  const verwaist = ausnahmen.filter((_, i) => zaehler[i] === 0)
  const abweichend = ausnahmen
    .map((ausnahme, i) => ({ ausnahme, gefunden: zaehler[i] }))
    .filter((x) => x.gefunden > 0 && x.gefunden !== (x.ausnahme.anzahl ?? 1))
  return { offen, verwaist, abweichend }
}

/** Alle Funde unter `wurzel`: `.github/workflows/*.yml` und `tools/*.sh`. */
export function sammleFunde(wurzel) {
  const funde = []
  const wf = resolve(wurzel, '.github/workflows')
  for (const f of readdirSync(wf).filter((n) => /\.ya?ml$/.test(n))) {
    for (const lauf of laufTexte(readFileSync(resolve(wf, f), 'utf8'))) {
      for (const t of findeOderTrue(lauf)) funde.push({ datei: `.github/workflows/${f}`, text: t.text, art: t.art })
    }
  }
  const tools = resolve(wurzel, 'tools')
  for (const f of readdirSync(tools).filter((n) => n.endsWith('.sh'))) {
    for (const t of findeOderTrue(readFileSync(resolve(tools, f), 'utf8'))) funde.push({ datei: `tools/${f}`, text: t.text, art: t.art })
  }
  return funde
}

/** Meldezeilen; leer = grün. */
export function pruefe(wurzel, ausnahmen = OHNE_BEFUND) {
  const { offen, verwaist, abweichend } = bewerte(sammleFunde(wurzel), ausnahmen)
  return [
    ...offen.map((f) => `✗ ${f.datei}: \`${f.text.slice(0, 120)}\` verschluckt einen Fehler (${f.art}). Beheben oder mit Begründung in tools/oder-true-ausnahmen.mjs eintragen.`),
    ...abweichend.map((x) => `✗ tools/oder-true-ausnahmen.mjs: Ausnahme für ${x.ausnahme.datei} („${x.ausnahme.text}“) trifft ${x.gefunden}-mal statt ${x.ausnahme.anzahl ?? 1}-mal — neues Vorkommen prüfen oder \`anzahl\` setzen.`),
    ...verwaist.map((a) => `✗ tools/oder-true-ausnahmen.mjs: Ausnahme für ${a.datei} („${a.text}“) trifft nichts mehr — streichen.`),
  ]
}
