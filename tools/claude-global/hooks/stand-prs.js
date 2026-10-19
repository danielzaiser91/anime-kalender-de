// Hält in daniel-zum-abarbeiten/stand.md unter „## In Arbeit“ je offenem PR eine Zeile aktuell, dazu die gemergten der
// letzten 24 h (Daniel 19.10.2026: „kein manuelles eintragen per hauptsitzung mehr“). Geschrieben wird nur der Block
// zwischen AUF und ZU; eingerückte Notizen unter einer PR-Zeile wandern mit ihrer PR-Nummer mit, alles außerhalb bleibt.
// Auslöser: PostToolUse(Bash) — ein gh-Befehl, der PRs ändert, sofort; andere gh-pr/run-Befehle und UserPromptSubmit
// höchstens alle 5 min. Ohne gh, ohne Netz oder ohne Abschnitt „## In Arbeit“ bleibt die Datei unverändert.
// Einträge in ~/.claude/settings.json (async: blockiert nichts; `gh api graphql` braucht ≈ 3 s, gemessen 19.10.2026):
//   hooks.PostToolUse:      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node", "args": ["C:/Users/ih/.claude/hooks/stand-prs.js"], "timeout": 60, "async": true }] }
//   hooks.UserPromptSubmit: { "hooks": [{ "type": "command", "command": "node", "args": ["C:/Users/ih/.claude/hooks/stand-prs.js"], "timeout": 60, "async": true }] }
// Von Hand: node ~/.claude/hooks/stand-prs.js --jetzt
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const REPO = ['danielzaiser91', 'anime-kalender-de']
const GH_WINDOWS = 'C:/Program Files/GitHub CLI/gh.exe'
const AUF = '<!-- pr-zeilen: automatisch aus GitHub (Hook stand-prs.js); eigene Notizen eingerückt unter die PR-Zeile -->'
const ZU = '<!-- /pr-zeilen -->'
const MIN = 60000
const DROSSEL = 5 * MIN
const GEMERGT_FENSTER = 24 * 60 * MIN
// Datenläufe (Sammler, Bestandsbau) mergen stündlich von selbst; als „gemergt“ wären sie nur Rauschen.
const SAMMLER = /^chore\(data\):/
const SPERRE_ALT = 2 * MIN
const KURZ_MAX = 36
// Ändert PRs: Zeilen sofort nachziehen. Lesende gh-Befehle nur gedrosselt (Urteil und Checks kommen ohne eigenes Zutun).
const AENDERT = /\bgh(?:\.exe)?["']?\s+pr\s+(?:create|merge|close|ready|reopen|edit)\b/
const LIEST = /\bgh(?:\.exe)?["']?\s+(?:pr|run)\s/
// Erste Zeile des CI-Urteils (pr-pruefer.yml), gemessen an 25 offenen PRs am 19.10.2026.
const URTEIL = /^\*\*Prüfer-Review\*\* für ([0-9a-f]{7,40}) - Urteil: \*\*(.+?)\*\*/

const ABFRAGE = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    offen: pullRequests(states: OPEN, first: 100, orderBy: {field: CREATED_AT, direction: ASC}) {
      nodes { number title url isDraft mergeable headRefOid
        commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        comments(last: 30) { nodes { author { login } body } } }
    }
    gemergt: pullRequests(states: MERGED, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { number title url mergedAt }
    }
  }
}`

function pfade(env = process.env) {
  return {
    stand: env.STAND_PRS_DATEI || 'C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/stand.md',
    zustand: env.STAND_PRS_ZUSTAND || path.join(os.homedir(), '.claude', 'hooks', 'state', 'stand-prs.json'),
  }
}

// STAND_PRS_GH_SKRIPT: Node-Skript statt gh, nur für den Prozesstest.
function ghAufruf(args) {
  const skript = process.env.STAND_PRS_GH_SKRIPT
  const gh = skript ? process.execPath : fs.existsSync(GH_WINDOWS) ? GH_WINDOWS : 'gh'
  const opt = { encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  return execFileSync(gh, skript ? [skript, ...args] : args, opt)
}

/** { offen, gemergt } aus GitHub; wirft bei gh- oder Formatfehlern. */
function holePrs(gh = ghAufruf) {
  const args = ['api', 'graphql', '-f', `query=${ABFRAGE}`, '-F', `owner=${REPO[0]}`, '-F', `name=${REPO[1]}`]
  const repo = JSON.parse(gh(args)).data.repository
  if (!Array.isArray(repo.offen.nodes) || !Array.isArray(repo.gemergt.nodes)) throw new Error('Antwort ohne nodes')
  return { offen: repo.offen.nodes, gemergt: repo.gemergt.nodes }
}

/** Titel ohne Konventions-Präfix („fix(bau): “), höchstens KURZ_MAX Zeichen; ein „[…]“ vorne wird zum Zustand. */
function kurztitel(titel) {
  const klammer = /^\[([^\]]+)\]\s*/.exec(titel)
  const rest = (klammer ? titel.slice(klammer[0].length) : titel).replace(/^[\w-]+(?:\([^)]*\))?!?:\s*/, '').replace(/\*/g, '').trim()
  const marke = klammer ? klammer[1] : ''
  if (rest.length <= KURZ_MAX) return { titel: rest, marke }
  const schnitt = rest.slice(0, KURZ_MAX - 1)
  const wort = schnitt.lastIndexOf(' ')
  return { titel: `${(wort > 20 ? schnitt.slice(0, wort) : schnitt).replace(/[\s,.;:–-]+$/, '')}…`, marke }
}

/** Jüngstes CI-Urteil: { wort, alt } (alt: für einen früheren Kopf); null ohne Urteil. */
function urteil(pr) {
  const treffer = (pr.comments?.nodes ?? [])
    .filter((k) => k.author?.login === 'github-actions')
    .map((k) => URTEIL.exec(k.body))
    .filter(Boolean)
  const letztes = treffer.at(-1)
  return letztes ? { wort: letztes[2].split(',')[0], alt: !String(pr.headRefOid).startsWith(letztes[1]) } : null
}

const CHECKS = { SUCCESS: 'Checks grün', FAILURE: 'Checks rot', ERROR: 'Checks rot', PENDING: 'Checks laufen', EXPECTED: 'Checks laufen' }

/** Zustandsteile eines offenen PRs in fester Reihenfolge. */
function zustand(pr) {
  const u = urteil(pr)
  const rollup = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
  return [
    kurztitel(pr.title).marke,
    pr.isDraft ? 'Entwurf' : '',
    pr.mergeable === 'CONFLICTING' ? 'Konflikt' : '',
    u ? `Prüfer ${u.wort}${u.alt ? ' (älterer Kopf)' : ''}` : 'Prüfer offen',
    CHECKS[rollup] ?? '',
  ].filter(Boolean)
}

/** Bereit zum Merge: kein Entwurf, kein Konflikt, Urteil „ok“ auf dem aktuellen Kopf, Checks grün. */
function bereit(pr) {
  const u = urteil(pr)
  return zustand(pr).includes('Checks grün') && !pr.isDraft && pr.mergeable !== 'CONFLICTING' && u?.wort === 'ok' && !u.alt
}

const verweis = (pr) => `[PR ${pr.number}](${pr.url})`

function offeneZeile(pr) {
  return `- **${kurztitel(pr.title).titel}** — ${zustand(pr).join(' · ')} — ${verweis(pr)}`
}

/** „19.10. 16:27“ in Berliner Zeit. */
function berlin(iso) {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((t) => [t.type, t.value]),
  )
  return `${teile.day}.${teile.month}. ${teile.hour}:${teile.minute}`
}

function gemergtZeile(pr) {
  return `- [klein] **${kurztitel(pr.title).titel}** — gemergt ${berlin(pr.mergedAt)} — ${verweis(pr)}`
}

/** Eingerückte Notizen je PR-Nummer aus einem vorhandenen Block (Zeilen unter einer PR-Zeile, die mit Leerraum beginnen). */
function notizenAus(block) {
  const notizen = {}
  let nummer = null
  for (const zeile of block.split('\n')) {
    if (!/^\s/.test(zeile)) nummer = /\[PR (\d+)\]\(/.exec(zeile)?.[1] ?? null
    else if (nummer && /\S/.test(zeile)) (notizen[nummer] ??= []).push(zeile)
  }
  return notizen
}

/** Blockzeilen: offene PRs (bereite zuerst, sonst neueste zuerst), dann die in den letzten 24 h gemergten. */
function baueBlock({ offen, gemergt }, notizen, jetzt) {
  const sortiert = [...offen].sort((a, b) => Number(bereit(b)) - Number(bereit(a)) || b.number - a.number)
  const frisch = gemergt.filter((pr) => !SAMMLER.test(pr.title) && jetzt - Date.parse(pr.mergedAt) <= GEMERGT_FENSTER)
  frisch.sort((a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt))
  const mitNotizen = (pr, zeile) => [zeile, ...(notizen[pr.number] ?? [])]
  return [
    AUF,
    ...sortiert.flatMap((pr) => mitNotizen(pr, offeneZeile(pr))),
    ...frisch.flatMap((pr) => mitNotizen(pr, gemergtZeile(pr))),
    ZU,
  ]
}

/** Neuer Text von stand.md mit frischem Block, oder null ohne Abschnitt „## In Arbeit“. Der Block steht am Ende des Abschnitts. */
function ersetzeBlock(text, prs, jetzt) {
  const zeilen = text.split('\n')
  const auf = zeilen.indexOf(AUF)
  const zu = zeilen.indexOf(ZU, auf)
  if (auf >= 0 && zu > auf) {
    const block = baueBlock(prs, notizenAus(zeilen.slice(auf + 1, zu).join('\n')), jetzt)
    return [...zeilen.slice(0, auf), ...block, ...zeilen.slice(zu + 1)].join('\n')
  }
  const kopf = zeilen.findIndex((z) => z.startsWith('## In Arbeit'))
  if (kopf < 0) return null
  let ende = zeilen.findIndex((z, i) => i > kopf && z.startsWith('## '))
  if (ende < 0) ende = zeilen.length
  while (ende > kopf + 1 && zeilen[ende - 1].trim() === '') ende--
  return [...zeilen.slice(0, ende), ...baueBlock(prs, {}, jetzt), ...zeilen.slice(ende)].join('\n')
}

/** Sperre gegen zwei gleichzeitige Läufe; eine verwaiste (älter als SPERRE_ALT) wird übernommen. false: ein anderer Lauf ist dran. */
function sperre(datei, jetzt) {
  try {
    fs.writeFileSync(datei, String(jetzt), { flag: 'wx' })
    return true
  } catch {
    const alt = Number(fs.readFileSync(datei, 'utf8')) || 0
    if (jetzt - alt < SPERRE_ALT) return false
    fs.writeFileSync(datei, String(jetzt))
    return true
  }
}

/**
 * Liest stand.md erst nach der Abfrage (Handänderungen in der Zwischenzeit bleiben), schreibt nur bei Änderung, atomar.
 * Zeilenenden und Änderungszeit bleiben: daniel-dateien.js misst an der Änderungszeit, ob die Sitzung stand.md pflegt.
 */
function aktualisiere({ datei, gh = ghAufruf, jetzt }) {
  const prs = holePrs(gh)
  const sperrdatei = `${datei}.pr-sperre`
  if (!sperre(sperrdatei, jetzt)) return 'gesperrt'
  try {
    const alt = fs.readFileSync(datei, 'utf8')
    const eol = alt.includes('\r\n') ? '\r\n' : '\n'
    const neu = ersetzeBlock(alt.split(eol).join('\n'), prs, jetzt)?.split('\n').join(eol)
    if (neu === undefined) return 'ohne Abschnitt'
    if (neu === alt) return 'unverändert'
    const { atime, mtime } = fs.statSync(datei)
    const tmp = `${datei}.pr-neu`
    fs.writeFileSync(tmp, neu)
    fs.renameSync(tmp, datei)
    fs.utimesSync(datei, atime, mtime)
    return `geschrieben (${prs.offen.length} offen)`
  } finally {
    fs.rmSync(sperrdatei, { force: true })
  }
}

/** Soll dieser Hook-Aufruf laufen? Ändernde gh-Befehle sofort, sonst höchstens alle DROSSEL ms. */
function sollLaufen(input, letzter, jetzt) {
  const befehl = String(input.tool_input?.command ?? '')
  if (input.hook_event_name === 'PostToolUse') {
    if (AENDERT.test(befehl)) return true
    if (!LIEST.test(befehl)) return false
  }
  return jetzt - letzter >= DROSSEL
}

/** Ergebnis als Text; es steht auch im Zustand (`ergebnis`), denn ein async-Hook zeigt seine Ausgabe niemandem. */
function lauf(input, { env = process.env, gh = ghAufruf, jetzt = Date.now() } = {}) {
  const p = pfade(env)
  let letzter = 0
  try {
    letzter = JSON.parse(fs.readFileSync(p.zustand, 'utf8')).t || 0
  } catch {}
  if (!input.jetzt && !sollLaufen(input, letzter, jetzt)) return 'übersprungen'
  const merke = (ergebnis) => fs.writeFileSync(p.zustand, JSON.stringify({ t: jetzt, ergebnis }))
  fs.mkdirSync(path.dirname(p.zustand), { recursive: true })
  merke('läuft')
  let ergebnis
  try {
    ergebnis = aktualisiere({ datei: p.stand, gh, jetzt })
  } catch (e) {
    ergebnis = `Fehler: ${e.message.split('\n')[0]}`
  }
  merke(ergebnis)
  return ergebnis
}

module.exports = { AUF, ZU, holePrs, kurztitel, urteil, zustand, bereit, offeneZeile, gemergtZeile, berlin, notizenAus, baueBlock, ersetzeBlock, sperre, sollLaufen, lauf }

if (require.main === module) {
  if (process.argv.includes('--jetzt')) {
    process.stdout.write(`stand-prs: ${lauf({ jetzt: true })}\n`)
  } else {
    let s = ''
    process.stdin.on('data', (d) => (s += d)).on('end', () => {
      let eingabe = {}
      try {
        eingabe = JSON.parse(s)
      } catch {}
      lauf(eingabe)
    })
  }
}
