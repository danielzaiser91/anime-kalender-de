/**
 * Das Dossier für das Wachen-Urteil: je Datei eine Quelle der Befunde, als Text. Jede Quelle für sich in try/catch – fällt eine aus, steht ihr Fehler im Dossier
 * (das Urteil soll es wissen), die übrigen bleiben.
 */
import { LIMIT_SKRIPT_MS, mitLimit } from './kind-mit-limit.mjs'
import { existsSync, readFileSync } from 'node:fs'
import { rotAlarmText } from './bestand-rot-alarm.mjs'

const REPO = process.env.GITHUB_REPOSITORY || 'danielzaiser91/anime-kalender-de'
const STUNDEN = 3600e3

const lies = (pfad) => readFileSync(pfad, 'utf8')
const gh = (...a) => mitLimit(process.env.GH_BIN || 'gh', a, { encoding: 'utf8', maxBuffer: 16 << 20 })

/** Ein Werkzeug-Skript laufen lassen; sein Exit-Code 1 ist ein Befund, kein Fehler – die Ausgabe zählt. */
export function laufe(skript, ...args) {
  try {
    return mitLimit(process.execPath, [skript, ...args], { encoding: 'utf8', maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'] }, { limitMs: LIMIT_SKRIPT_MS })
  } catch (fehler) {
    if (String(fehler.message).startsWith('FEHLER:')) return fehler.message
    const aus = `${fehler.stdout ?? ''}${fehler.stderr ?? ''}`.trim()
    return `${aus}\n(Exit-Code ${fehler.status ?? '?'})`
  }
}

/** Dieser Workflow läuft gerade selbst: beim ersten Lauf (und mitten im Lauf) hat er keinen Erfolg, das ist kein Ausfall und gehört nicht ins Dossier. */
export function ohneEigenenLauf(text) {
  return text.replace(/claude-wache-urteil\.yml[^;\n]*/g, 'claude-wache-urteil.yml: eigener Lauf, hier nicht bewertet (er schreibt dieses Urteil gerade)')
}

/** Briefkasten-Ausgabe mit Lesehilfe: Meldungen sind Zeilen, Adressen eindeutige Seiten; gleiche Zahlen deuten auf die ältere Zählung je Zeile. */
export function briefkastenMitHilfe(aus) {
  const z = /(\d+) Meldungen auf (\d+) Adressen/.exec(aus)
  const hilfe = 'Lesehilfe: „Meldungen“ sind Zeilen im Briefkasten, „Adressen“ eindeutige Seiten. Viele Meldungen auf wenigen Adressen sind kein Rückstau; ungelistete Adressen sind der Befund.'
  const alt = z && z[1] === z[2] && Number(z[1]) > 1 ? '\nHinweis: Meldungen und Adressen sind gleich viele – möglicherweise zählt die Wache noch je Zeile; die Adressenzahl dann nicht als Rückstau werten.' : ''
  return `${hilfe}${alt}\n\n${aus}`
}

/** Läufe der letzten 48 Stunden je Workflow: Zählung nach Ausgang; je Workflow mit Fehlschlägen die drei jüngsten mit Zweig und Adresse. */
function laeufe() {
  const roh = gh('run', 'list', '--repo', REPO, '--limit', '1000', '--json', 'workflowName,conclusion,status,createdAt,url,headBranch')
  const alle = JSON.parse(roh)
  const grenze = Date.now() - 48 * STUNDEN
  const jung = alle.filter((l) => Date.parse(l.createdAt) >= grenze)
  const je = new Map()
  for (const l of jung) {
    const z = je.get(l.workflowName) ?? {}
    const art = l.status === 'completed' ? l.conclusion : l.status
    z[art] = (z[art] ?? 0) + 1
    je.set(l.workflowName, z)
  }
  const zeilen = [...je].sort().map(([name, z]) => `${name.padEnd(48)} ${Object.entries(z).map(([k, n]) => `${k} ${n}`).join(', ')}`)
  const rot = jung.filter((l) => l.conclusion === 'failure' || l.conclusion === 'timed_out')
  const jeRot = [...new Set(rot.map((l) => l.workflowName))].map((name) => {
    const treffer = rot.filter((l) => l.workflowName === name)
    const zeilenRot = treffer.slice(0, 3).map((l) => `  ${l.createdAt}  Zweig ${l.headBranch}  ${l.url}`)
    return [`${name} (${treffer.length}x):`, ...zeilenRot].join('\n')
  })
  const aelteste = alle.length ? alle[alle.length - 1].createdAt : '?'
  const kopf = `Läufe der letzten 48 Stunden (${jung.length}; die Abfrage reicht bis ${aelteste}):`
  const rotKopf = 'Fehlgeschlagen (Zweig main = Datenläufe, sonst Pull-Request-Zweige):'
  return [kopf, ...zeilen, '', rotKopf, ...(jeRot.length ? jeRot : ['(keiner)']), ''].join('\n')
}

/** Offene Issues und Pull Requests: Titel, Alter, Zweig. */
function offenes() {
  const issues = JSON.parse(gh('issue', 'list', '--repo', REPO, '--state', 'open', '--limit', '30', '--json', 'number,title,createdAt'))
  const prs = JSON.parse(gh('pr', 'list', '--repo', REPO, '--state', 'open', '--limit', '30', '--json', 'number,title,createdAt,headRefName'))
  const zeile = (x) => `#${x.number}  ${x.createdAt.slice(0, 10)}  ${x.title}${x.headRefName ? `  [${x.headRefName}]` : ''}`
  return `Offene Issues:\n${issues.map(zeile).join('\n') || '(keine)'}\n\nOffene Pull Requests:\n${prs.map(zeile).join('\n') || '(keine)'}\n`
}

/** Quellenzustand: Alter des letzten Erfolgs und letzter Fehler je Quelle, das Älteste zuerst; dazu die Blocker der Seite. */
function quellen() {
  const gesund = JSON.parse(lies('data/source-health.json'))
  const zeilen = Object.entries(gesund)
    .map(([name, s]) => ({ name, tage: (Date.now() - Date.parse(s.lastOk)) / (24 * STUNDEN), s }))
    .sort((a, b) => (Number.isFinite(b.tage) ? b.tage : 1e9) - (Number.isFinite(a.tage) ? a.tage : 1e9))
    .map(({ name, tage, s }) => `${name.padEnd(28)} letzter Erfolg ${Number.isFinite(tage) ? `vor ${tage.toFixed(1)} Tagen` : 'nie'}, ${s.lastCount ?? '?'} Treffer${s.lastError ? `, Fehler: ${s.lastError}` : ''}`)
  const blocker = existsSync('public/data/blocker.json') ? lies('public/data/blocker.json').slice(0, 2000) : '(Datei fehlt)'
  return `source-health.json, ältester Erfolg zuerst:\n${zeilen.join('\n')}\n\npublic/data/blocker.json:\n${blocker}\n`
}

/** Die von den Ableitungen verworfenen Serien je Grund. */
function ausgelassen() {
  const daten = JSON.parse(lies('data/termine-ausgelassen.json'))
  return `Serien ohne Termine, je Grund:\n${Object.entries(daten.jeGrund ?? {}).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${String(n).padStart(5)}  ${g}`).join('\n')}\n`
}

/** Die jüngsten Posteingangs-Zeilen für Claude. */
function meldungen() {
  const zeilen = lies('data/meldungen-an-claude.jsonl').trimEnd().split('\n').slice(-15)
  return `Letzte ${zeilen.length} Zeilen von data/meldungen-an-claude.jsonl:\n${zeilen.join('\n')}\n`
}

/** Die jüngsten drei Einträge der Auswertung: damit nichts doppelt gemeldet wird, was schon beurteilt ist. */
function frueher() {
  const teile = lies('daniel-zum-abarbeiten/00-wache-auswertung.md').split(/^(?=## )/m).slice(1, 4)
  return teile.join('\n')
}

const QUELLEN = [
  ['01-laeufe.txt', laeufe],
  ['02-delta-24h.txt', () => laufe('tools/delta-pruefen.mjs', '--tage', '1', '--alles')],
  ['03-briefkasten.txt', () => briefkastenMitHilfe(laufe('tools/briefkasten-wache.mjs'))],
  ['04-zugaenge.txt', () => ohneEigenenLauf(laufe('tools/zugangs-waechter.mjs'))],
  ['05-wochenwache.txt', () => ohneEigenenLauf(laufe('tools/wache-woechentlich.mjs', '--trocken'))],
  ['06-quellen.txt', quellen],
  ['07-ausgelassen.txt', ausgelassen],
  ['08-offene-issues-und-prs.txt', offenes],
  ['09-meldungen-an-claude.txt', meldungen],
  ['10-bisherige-urteile.md', frueher],
  ['11-wache-datei.md', () => lies('daniel-zum-abarbeiten/00-wache.md')],
  ['12-bestandsbau-alarm.txt', () => rotAlarmText(gh, REPO, Date.now())],
]

/** Alle Dossier-Dateien als [Name, Inhalt]; der Kopf trägt den Zeitpunkt. */
export function sammle() {
  return QUELLEN.map(([name, quelle]) => {
    let inhalt
    try {
      inhalt = quelle()
    } catch (fehler) {
      inhalt = `FEHLER beim Sammeln: ${String(fehler.message).split('\n')[0]}`
    }
    return [name, `Stand: ${new Date().toISOString()}\n\n${inhalt}`]
  })
}
