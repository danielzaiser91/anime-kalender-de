/**
 * Wächter über den Ort jeder Prüfung (18.11.2026, Teil von `tools/pr-kette-pruefen.mjs`): Jede Prüfung steht in genau einem Ort, „pr“ (PR-Kette und Deploy)
 * oder „nachts“ (`.github/workflows/nacht-pruefung.yml`). Die Nacht-Einträge stehen in `tools/pruefung-ort.json`, alles andere läuft im PR.
 * Regeln:
 *  - jeder Eintrag hat Ort (pr/nachts), `grund`, `beleg` (Datei:Zeile, was ihn rot machen kann) und bei „nachts“ `deploy` (true/false: liest er echte Bot-Daten,
 *    läuft er zusätzlich im Deploy-Job `zusicherungen`); jede Datei gibt es, Logik-Einträge stehen in `tools/check-logic-liste.txt`;
 *  - `erwartet` nennt die Zahl der Nacht-Einträge je Art: wer einen Eintrag streicht (Prüfung wandert still zurück in den PR) oder anfügt, ändert sie bewusst mit;
 *  - `check:nachts(-logik|-tests|-deploy)` stehen in package.json in fester Form; `nacht-pruefung.yml` hat nur `workflow_dispatch` und zwei Jobs, die `npm run check:nachts-logik`
 *    bzw. `-tests` ohne `if` und ohne `continue-on-error` ausführen; steht ein Eintrag mit `deploy: true` da, führt der Deploy-Job `zusicherungen` `npm run check:nachts-deploy` ohne `continue-on-error` aus.
 * Aufruf: über `node tools/pr-kette-pruefen.mjs [wurzel]`; `ortFehler(wurzel)` liefert die Verstöße (leer = in Ordnung).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { listenEintraege } from './liste-pruefen.mjs'
import { nachOrt, ORT_DATEI } from './pruefung-ort.mjs'
import { findeTests } from './tests-liste.mjs'

/** Soll-Fassung der package.json-Skripte; Logik und Tests laufen nachts in zwei Jobs, damit eine rote Logik-Prüfung die Tests nicht verdeckt. */
const SKRIPTE = {
  'check:nachts-logik': 'node tools/check-logic-alle.mjs --nachts',
  'check:nachts-tests': 'node tools/tests-alle.mjs --nachts --alle',
  'check:nachts': 'npm run check:nachts-logik && npm run check:nachts-tests',
  'check:nachts-deploy': 'node tools/check-logic-alle.mjs --nachts-deploy && node tools/tests-alle.mjs --nachts-deploy',
}
const EINTRAG_SCHLUESSEL = ['ort', 'grund', 'beleg', 'deploy']
const ARTEN = ['logik', 'tests']

/** Verstöße eines Eintrags (Form): bekannte Schlüssel, Ort, Grund, Beleg, `deploy` bei „nachts“. */
function eintragFehler(art, name, e) {
  const f = []
  for (const k of Object.keys(e ?? {})) if (!EINTRAG_SCHLUESSEL.includes(k)) f.push(`${art} ${name}: Schlüssel "${k}" nicht erlaubt`)
  if (e?.ort !== 'pr' && e?.ort !== 'nachts') f.push(`${art} ${name}: ort muss "pr" oder "nachts" sein`)
  for (const k of ['grund', 'beleg']) if (typeof e?.[k] !== 'string' || e[k].trim() === '') f.push(`${art} ${name}: ${k} fehlt`)
  if (e?.ort === 'nachts' && typeof e.deploy !== 'boolean') f.push(`${art} ${name}: deploy (true/false) fehlt`)
  if (e?.ort === 'pr' && e.deploy !== undefined) f.push(`${art} ${name}: deploy gilt nur bei nachts`)
  return f
}

/** Verstöße der Zuordnung gegen die echten Prüfungen: Datei vorhanden, Zahl, Vollständigkeit der Aufteilung. */
function zuordnungFehler(ort, alle) {
  const f = []
  for (const art of ARTEN) {
    const eintraege = ort[art] ?? {}
    for (const [name, e] of Object.entries(eintraege)) {
      f.push(...eintragFehler(art, name, e))
      if (!alle[art].includes(name)) f.push(`${art} ${name}: Prüfung gibt es nicht (mehr)`)
    }
    const nachts = nachOrt(alle[art], ort, art, 'nachts')
    if (ort.erwartet?.[art] !== nachts.length) f.push(`${art}: ${nachts.length} Nacht-Einträge, erwartet ${ort.erwartet?.[art]} (tools/pruefung-ort.json, „erwartet“ bewusst mitändern)`)
  }
  return f
}

/** Verstöße des Nacht-Workflows: nur `workflow_dispatch`, zwei Jobs (Logik, Tests), je ein Prüfschritt ohne Ausweg. */
function nachtWorkflowFehler(doc) {
  const f = []
  const jobs = Object.values(doc?.jobs ?? {})
  if (JSON.stringify(Object.keys(doc?.on ?? {})) !== '["workflow_dispatch"]') f.push('nacht-pruefung.yml: on muss genau workflow_dispatch sein (Start durch den Wecker)')
  if (jobs.length !== 2) f.push(`nacht-pruefung.yml: genau zwei Jobs verlangt (Logik, Tests), gefunden ${jobs.length}`)
  for (const job of jobs) {
    if (job.if !== undefined || job['continue-on-error'] !== undefined) f.push('nacht-pruefung.yml: Job ohne if und continue-on-error (Rot darf nicht verschluckt werden)')
    for (const s of job.steps ?? []) if (s.run !== undefined && (s.if !== undefined || s['continue-on-error'] !== undefined)) f.push('nacht-pruefung.yml: Prüfschritt ohne if und continue-on-error')
  }
  const laeufe = jobs.map((j) => (j.steps ?? []).map((s) => s.run).filter((r) => r !== undefined).join('|')).sort()
  if (JSON.stringify(laeufe) !== JSON.stringify(['npm run check:nachts-logik', 'npm run check:nachts-tests'])) f.push(`nacht-pruefung.yml: jeder Job führt genau einen Schritt aus, "npm run check:nachts-logik" bzw. "npm run check:nachts-tests" (gefunden: ${laeufe.join(' ; ')})`)
  return f
}

/** Verstöße des Deploy-Jobs: mit `deploy: true`-Einträgen führt `zusicherungen` `npm run check:nachts-deploy` ohne Ausweg aus. */
function deployFehler(doc, ort) {
  const braucht = ARTEN.some((a) => Object.values(ort[a] ?? {}).some((e) => e.ort === 'nachts' && e.deploy === true))
  const schritte = (doc?.jobs?.zusicherungen?.steps ?? []).filter((s) => String(s.run ?? '').split('\n').some((z) => z.trim() === 'npm run check:nachts-deploy'))
  if (!braucht) return schritte.length > 0 ? ['deploy.yml: check:nachts-deploy steht da, aber kein Eintrag hat deploy: true'] : []
  if (schritte.length !== 1) return [`deploy.yml: Job zusicherungen braucht genau einen Schritt mit "npm run check:nachts-deploy", gefunden ${schritte.length}`]
  return schritte[0]['continue-on-error'] === undefined ? [] : ['deploy.yml: Schritt check:nachts-deploy ohne continue-on-error']
}

/** Alle Verstöße gegen die Regeln im Kopf; `wurzel` = Repo-Wurzel. */
export function ortFehler(wurzel) {
  const lies = (d) => readFileSync(join(wurzel, d), 'utf8')
  if (!existsSync(join(wurzel, ORT_DATEI))) return [`${ORT_DATEI} fehlt`]
  const ort = JSON.parse(lies(ORT_DATEI))
  const fehler = Object.keys(ort).filter((k) => ![...ARTEN, 'erwartet', '_hinweis'].includes(k)).map((k) => `${ORT_DATEI}: Schlüssel "${k}" nicht erlaubt`)
  const alle = { logik: listenEintraege(lies('tools/check-logic-liste.txt')), tests: findeTests(join(wurzel, 'tools'), wurzel).map((t) => `tools/${t}`) }
  fehler.push(...zuordnungFehler(ort, alle))
  const { scripts } = JSON.parse(lies('package.json'))
  for (const [name, soll] of Object.entries(SKRIPTE)) if (scripts[name] !== soll) fehler.push(`package.json: ${name} muss "${soll}" sein`)
  fehler.push(...nachtWorkflowFehler(parse(lies('.github/workflows/nacht-pruefung.yml'))), ...deployFehler(parse(lies('.github/workflows/deploy.yml')), ort))
  return fehler
}

/** Zählzeile für das CI-Log. */
export function ortZeile(wurzel) {
  const ort = JSON.parse(readFileSync(join(wurzel, ORT_DATEI), 'utf8'))
  const zahl = (art, modus) => nachOrt(Object.keys(ort[art] ?? {}), ort, art, modus).length
  return `${zahl('logik', 'nachts')} Logik-Prüfungen und ${zahl('tests', 'nachts')} Tests nachts (davon im Deploy: ${zahl('logik', 'deploy')} und ${zahl('tests', 'deploy')}), alle übrigen im PR`
}
