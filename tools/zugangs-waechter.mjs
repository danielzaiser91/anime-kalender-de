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

function weckerBefund() {
  const l = letzteLaeufe('refresh-hourly.yml', 10).find((x) => x.event === 'workflow_dispatch')
  if (!l) return { rot: true, text: 'GITHUB_WECKER_TOKEN: unter den letzten 10 stündlichen Läufen keiner per workflow_dispatch (Wecker oder Wecker-Wache)' }
  const h = stunden(l.createdAt)
  return { rot: h > 5, text: `GITHUB_WECKER_TOKEN: letzter Start per workflow_dispatch vor ${Math.round(h)} h` }
}

function main() {
  if (process.argv.includes('--register-pruefen')) {
    const b = registerBefunde()
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
