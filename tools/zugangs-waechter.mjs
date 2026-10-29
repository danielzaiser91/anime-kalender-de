#!/usr/bin/env node
/**
 * Wächter für die Zugänge, von denen die automatischen Läufe leben (`data/zugangs-register.json`).
 * Er liest nie einen Secret-Wert — nur Namen und den Verlauf der Läufe (`gh run list`).
 *
 *   node tools/zugangs-waechter.mjs                    # Läufe in ihrer Frist? Kontingent leer? Ablauf nah?
 *   node tools/zugangs-waechter.mjs --register-pruefen # offline: Register gegen .github/workflows/
 *
 * Exit 1 bei Befund. `GH_BIN` überschreibt das gh-Programm, `GITHUB_REPOSITORY` das Repo.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'

const WURZEL = new URL('..', import.meta.url)
const register = JSON.parse(readFileSync(new URL('data/zugangs-register.json', WURZEL), 'utf8'))
const REPO = process.env.GITHUB_REPOSITORY || 'danielzaiser91/anime-kalender-de'
const GH = process.env.GH_BIN || 'gh'
const WARN_TAGE = 14
// Ein Claude-Schritt, der so schnell scheitert, hat nie gearbeitet (Kontingent leer oder Token ungültig).
const KONTINGENT_SEKUNDEN = 60
const CLAUDE_SCHRITT = /claude-code-action|^Recherche$/

/** Namen aller `secrets.X` je Workflow-Datei. */
export function secretsJeWorkflow(verzeichnis = new URL('.github/workflows/', WURZEL)) {
  const aus = {}
  for (const datei of readdirSync(verzeichnis).filter((d) => d.endsWith('.yml'))) {
    const text = readFileSync(new URL(datei, verzeichnis), 'utf8')
    for (const m of text.matchAll(/secrets\.([A-Za-z0-9_]+)/g)) (aus[m[1]] ??= new Set()).add(datei)
  }
  return aus
}

/** Widersprüche zwischen Register und Workflows (leer = stimmig). */
export function registerBefunde(reg = register, secrets = secretsJeWorkflow(), workflowDateien = null) {
  const befunde = []
  const dateien = workflowDateien ?? readdirSync(new URL('.github/workflows/', WURZEL))
  const ids = new Set(reg.zugaenge.map((z) => z.id))
  for (const name of Object.keys(secrets)) if (!ids.has(name)) befunde.push(`Secret ${name} steht in Workflows, nicht im Register`)
  for (const z of reg.zugaenge) {
    for (const feld of ['wofuer', 'gueltig', 'erneuerung', 'folge', 'ort']) if (!z[feld]) befunde.push(`${z.id}: Feld ${feld} fehlt`)
    if (z.ort === 'github-secret' || z.ort === 'github-automatisch') {
      const ist = [...(secrets[z.id] ?? [])].sort()
      const soll = [...z.workflows].sort()
      if (ist.join() !== soll.join()) befunde.push(`${z.id}: Workflows im Register ${soll.length}, in .github/workflows ${ist.length} (${ist.filter((w) => !soll.includes(w)).concat(soll.filter((w) => !ist.includes(w))).join(', ')})`)
    }
    for (const w of z.workflows) if (!dateien.includes(w)) befunde.push(`${z.id}: Workflow ${w} existiert nicht`)
  }
  for (const w of Object.keys(reg.laeufe)) if (!dateien.includes(w)) befunde.push(`laeufe: ${w} existiert nicht`)
  return befunde
}

const gh = (...args) => JSON.parse(execFileSync(GH, args, { encoding: 'utf8', maxBuffer: 20e6 }))
const stunden = (iso) => (Date.now() - Date.parse(iso)) / 3600e3

function letzteLaeufe(workflow, limit = 20) {
  return gh('run', 'list', '--repo', REPO, '--workflow', workflow, '--limit', String(limit), '--json', 'databaseId,conclusion,status,createdAt,event')
}

/** Ein leeres Kontingent: Claude-Schritt scheitert in Sekunden. Gibt die Fundstellen zurück. */
export function kontingentFunde(schritte) {
  return schritte.filter((s) => CLAUDE_SCHRITT.test(s.name) && s.conclusion === 'failure' && s.started_at && s.completed_at && (Date.parse(s.completed_at) - Date.parse(s.started_at)) / 1000 <= KONTINGENT_SEKUNDEN)
}

function pruefeLauf(workflow, spez) {
  const zeilen = []
  const laeufe = letzteLaeufe(workflow)
  const fertig = laeufe.filter((l) => l.status === 'completed' && l.conclusion !== 'cancelled' && l.conclusion !== 'skipped')
  const erfolg = fertig.find((l) => l.conclusion === 'success')
  if (spez.fristStunden != null) {
    if (!erfolg) zeilen.push({ rot: true, text: `${workflow}: kein erfolgreicher Lauf unter den letzten ${laeufe.length}` })
    else if (stunden(erfolg.createdAt) > spez.fristStunden) zeilen.push({ rot: true, text: `${workflow}: letzter Erfolg vor ${Math.round(stunden(erfolg.createdAt))} h (Frist ${spez.fristStunden} h)` })
    else zeilen.push({ rot: false, text: `${workflow}: letzter Erfolg vor ${Math.round(stunden(erfolg.createdAt))} h (Frist ${spez.fristStunden} h)` })
  }
  if (spez.claude) {
    // Nur solange kein späterer Lauf gelungen ist — danach ist das Kontingent wieder da.
    for (const l of fertig.filter((x) => x.conclusion === 'failure' && stunden(x.createdAt) <= 24 * 7 && !(erfolg && erfolg.createdAt > x.createdAt)).slice(0, 5)) {
      const jobs = gh('api', `repos/${REPO}/actions/runs/${l.databaseId}/jobs`).jobs ?? []
      const funde = kontingentFunde(jobs.flatMap((j) => j.steps ?? []))
      if (funde.length) zeilen.push({ rot: true, kontingent: true, text: `${workflow}: Claude-Schritt „${funde[0].name}“ endete nach wenigen Sekunden (Lauf ${l.databaseId}, ${l.createdAt.slice(0, 16)}Z) — Kontingent leer oder CLAUDE_CODE_OAUTH_TOKEN ungültig` })
    }
  }
  return zeilen
}

function ablaufBefunde() {
  const aus = []
  const ohne = []
  for (const z of register.zugaenge) {
    const bis = z.gueltig.gueltigBis
    if (!bis) {
      if (z.erneuerung.art === 'handgriff') ohne.push(z.id)
      continue
    }
    const tage = Math.floor((Date.parse(bis) - Date.now()) / 86400e3)
    if (tage <= WARN_TAGE) aus.push({ rot: true, text: `${z.id}: läuft ${tage < 0 ? `seit ${-tage} Tagen ab` : `in ${tage} Tagen`} ab (${bis}) — ${z.erneuerung.text}` })
  }
  return { aus, ohne }
}

/** Der Wecker startet mit dem PAT (Nutzer); die Wache mit GITHUB_TOKEN (`github-actions[bot]`) und darf den Wecker nicht vortäuschen. */
export const vomWecker = (lauf) => lauf.event === 'workflow_dispatch' && !String(lauf.actor?.login).endsWith('[bot]')

function weckerBefund() {
  const laeufe = gh('api', 'repos/' + REPO + '/actions/workflows/refresh-hourly.yml/runs?per_page=20&event=workflow_dispatch').workflow_runs
  const l = laeufe.find(vomWecker)
  if (!l) return { rot: true, text: 'GITHUB_WECKER_TOKEN: unter den letzten 20 Starts des Stundenlaufs keiner vom Cloudflare-Wecker (nur Wecker-Wache oder gar keiner)' }
  const h = stunden(l.created_at)
  return { rot: h > 5, text: `GITHUB_WECKER_TOKEN: letzter Start durch den Wecker vor ${Math.round(h)} h` }
}

/** Workflows, die der Wecker startet, die `wecker-wache.yml` aber nicht nachholen würde (leer = stimmig). */
export function wachePlanBefunde(weckplanText, wacheText) {
  const plan = [...weckplanText.matchAll(/workflow: '([^']+)'(?![^}\n]*\brepo:\s*')/g)].map((m) => m[1])
  const wache = new Set([...wacheText.matchAll(/([A-Za-z0-9-]+\.yml):\d+/g)].map((m) => m[1]))
  return plan.filter((w) => !wache.has(w)).map((w) => `Wecker-Plan startet ${w}, die Wecker-Wache holt es nicht nach (PLAN in wecker-wache.yml)`)
}

/** Workflows, die nur per Abruf starten und bewusst nicht im Weckplan stehen, mit Grund (belegt aus Kopfkommentar und Aufrufern, 13.10.2026). */
export const OHNE_WECKPLAN = {
  'cache-ablegen.yml': 'startet `tools/cache-holen.mjs` selbst, wenn kein Artefakt jünger als 24 h ist (Kopfkommentar: „Nur auf Abruf, ohne Zeitplan“)',
  'claude-auftrag.yml': 'von Hand angestoßener Arbeitsauftrag (Kopfkommentar)',
  'crunchyroll-nachholen.yml': 'Nachhol-Lauf von Hand, auf Ansage (Kopfkommentar)',
  'fund-nachliefern.yml': 'spielt den Fund eines gescheiterten Sammel-Laufs auf Ansage nach, Lauf-Nummer als Eingabe',
  'mutationsprobe.yml': 'Mutationsreihe per Knopf (gh workflow run), Zweig und Liste als Eingabe',
  'region-test.yml': 'einmaliger Versuch von Hand (Kopfkommentar)',
  'weiche-test.yml': 'einmalige Messung von Hand (Kopfkommentar)',
}

/** Schlüssel des `on:`-Blocks (Blockform sowie `on: [a, b]` und `on: a`). */
export function ausloeser(workflowText) {
  const zeilen = workflowText.split(/\r?\n/)
  const i = zeilen.findIndex((z) => /^on:/.test(z))
  if (i < 0) return []
  const rest = zeilen[i].slice(3).replace(/#.*/, '').replace(/[[\]]/g, '').trim()
  if (rest) return rest.split(',').map((s) => s.trim())
  const keys = []
  for (const z of zeilen.slice(i + 1)) {
    if (/^\S/.test(z) && !z.startsWith('#')) break
    const m = z.match(/^ {2}([a-z_]+):/)
    if (m) keys.push(m[1])
  }
  return keys
}

/**
 * Jeder Workflow, der nur per `workflow_dispatch` startet, steht im Weckplan oder in `OHNE_WECKPLAN`; Ausnahmen, die nicht (mehr) stimmen, werden gemeldet.
 * `workflows`: Dateiname -> Text. Anlass 13.10.2026: `offizielle-news.yml` lief nie, weil sein Plan-Eintrag fehlte.
 */
export function weckplanLuecken(weckplanText, workflows, ausnahmen = OHNE_WECKPLAN) {
  const plan = new Set([...weckplanText.matchAll(/workflow: '([^']+)'(?![^}\n]*\brepo:\s*')/g)].map((m) => m[1]))
  const b = []
  for (const [name, text] of Object.entries(workflows)) {
    const keys = ausloeser(text)
    if (!keys.length) b.push(`${name}: kein on:-Block erkannt`)
    else if (keys.every((k) => k === 'workflow_dispatch') && !plan.has(name) && !(name in ausnahmen)) b.push(`${name} startet nur per Abruf, steht aber weder im Weckplan (shared/weckplan.ts) noch in OHNE_WECKPLAN (tools/zugangs-waechter.mjs)`)
  }
  for (const name of Object.keys(ausnahmen)) {
    if (!(name in workflows)) b.push(`OHNE_WECKPLAN: ${name} gibt es nicht mehr`)
    else if (plan.has(name)) b.push(`OHNE_WECKPLAN: ${name} steht im Weckplan, Ausnahme streichen`)
  }
  return b
}

function workflowTexte() {
  const verz = new URL('.github/workflows/', WURZEL)
  return Object.fromEntries(readdirSync(verz).filter((d) => d.endsWith('.yml')).map((d) => [d, readFileSync(new URL(d, verz), 'utf8')]))
}

function main() {
  if (process.argv.includes('--register-pruefen')) {
    const b = registerBefunde()
    b.push(...wachePlanBefunde(readFileSync(new URL('shared/weckplan.ts', WURZEL), 'utf8'), readFileSync(new URL('.github/workflows/wecker-wache.yml', WURZEL), 'utf8')))
    b.push(...weckplanLuecken(readFileSync(new URL('shared/weckplan.ts', WURZEL), 'utf8'), workflowTexte()))
    if (b.length) {
      console.error(b.map((x) => `✗ ${x}`).join('\n'))
      process.exit(1)
    }
    console.log(`Zugangs-Register stimmig: ${register.zugaenge.length} Zugänge, ${Object.keys(register.laeufe).length} überwachte Läufe.`)
    return
  }
  const zeilen = []
  for (const [workflow, spez] of Object.entries(register.laeufe)) zeilen.push(...pruefeLauf(workflow, spez))
  zeilen.push(weckerBefund())
  const { aus, ohne } = ablaufBefunde()
  zeilen.push(...aus)
  const rot = zeilen.filter((z) => z.rot)
  for (const z of zeilen) console.log(`${z.rot ? '✗' : '✓'} ${z.text}`)
  if (ohne.length) console.log(`ℹ Ablaufdatum unbekannt (gueltigBis leer): ${ohne.join(', ')} — Daniel liest es einmal im Konto ab und trägt es ins Register ein.`)
  if (rot.some((z) => z.kontingent)) console.log('::warning title=Claude-Kontingent leer::Claude-Läufe enden nach Sekunden — Abo-Kontingent oder CLAUDE_CODE_OAUTH_TOKEN prüfen (docs/wissen/betrieb.md)')
  console.log(rot.length ? `\n${rot.length} Befund(e) bei den Zugängen.` : '\nZugänge unauffällig.')
  if (rot.length) process.exit(1)
}

if (process.argv[1]?.endsWith('zugangs-waechter.mjs')) main()
