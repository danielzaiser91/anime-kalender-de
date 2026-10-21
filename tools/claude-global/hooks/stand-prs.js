// Hält in daniel-zum-abarbeiten/stand.md unter „## In Arbeit“ je offenem PR eine Zeile aktuell, dazu eine Sammelzeile der
// in 24 h gemergten PRs (Daniel 19.10.2026: „kein manuelles eintragen per hauptsitzung mehr“). Geschrieben wird nur der Block
// zwischen AUF und ZU (stand-prs-block.js): eingerückte Notizen unter einer PR-Zeile wandern mit, fremde Zeilen im Block
// rücken unter ZU, nichts geht verloren; bei unklaren Marken schreibt der Hook nichts und meldet es der Sitzung.
// Auslöser: PostToolUse(Bash) — ein gh-Befehl, der PRs ändert, sofort; andere gh-pr/run-Befehle und UserPromptSubmit
// höchstens alle 5 min. Scheitert der Abruf länger als 30 min, trägt der Block eine Zeile „PR-Liste veraltet“.
// Einträge in ~/.claude/settings.json als zusätzliche Elemente der vorhandenen Arrays (nie als neuer Schlüssel: der
// ersetzte die übrigen Hooks des Ereignisses); async blockiert nichts, `gh api graphql` braucht ≈ 3 s (19.10.2026):
//   hooks.PostToolUse[]:      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node", "args": ["C:/Users/ih/.claude/hooks/stand-prs.js"], "timeout": 60, "async": true }] }
//   hooks.UserPromptSubmit[]: { "hooks": [{ "type": "command", "command": "node", "args": ["C:/Users/ih/.claude/hooks/stand-prs.js"], "timeout": 60, "async": true }] }
// Von Hand: node ~/.claude/hooks/stand-prs.js --jetzt
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const B = require('./stand-prs-block.js')
const { waechter } = require('./stand-waechter.js')

const REPO = ['danielzaiser91', 'anime-kalender-de']
const GH_WINDOWS = 'C:/Program Files/GitHub CLI/gh.exe'
const MIN = 60000
const DROSSEL = 5 * MIN
const VERALTET = 30 * MIN
const GEMERGT_FENSTER = 24 * 60 * MIN
const MAX_SEITEN = 20
// Datenläufe (Sammler, Bestandsbau) mergen stündlich von selbst; als „gemergt“ wären sie nur Rauschen.
const SAMMLER = /^chore\(data\):/
const SPERRE_ALT = 2 * MIN
const KURZ_MAX = 36
// Ändert PRs: Zeilen sofort nachziehen. Lesende gh-Befehle nur gedrosselt (Urteil und Checks kommen ohne eigenes Zutun).
const AENDERT = /\bgh(?:\.exe)?["']?\s+pr\s+(?:create|merge|close|ready|reopen|edit)\b/
const LIEST = /\bgh(?:\.exe)?["']?\s+(?:pr|run)\s/
// Erste Zeile des CI-Urteils (pr-pruefer.yml) und des Prüfer-Agenten, gemessen an 27 offenen PRs am 19.10.2026.
const CI_URTEIL = /^\*\*Prüfer-Review\*\* für ([0-9a-f]{7,40}) - Urteil: \*\*(.+?)\*\*/
const AGENT_URTEIL = /^Prüfer(?: Runde (\d+))?: (freigeben|ändern|aendern)\b/
const AGENT_KOPF = /\bKopf:?\s+`?([0-9a-f]{7,40})\b/

// Gemergte nach letzter Änderung absteigend: jeder in 24 h gemergte steht vor dem ersten, der länger unverändert ist.
const GEMERGT = `pullRequests(states: MERGED, first: 100, after: $nach, orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes { number title url mergedAt updatedAt }
    }`
const ABFRAGE = `query($owner: String!, $name: String!, $nach: String) {
  repository(owner: $owner, name: $name) {
    offen: pullRequests(states: OPEN, first: 100, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage }
      nodes { number title url isDraft mergeable headRefOid
        commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        comments(last: 100) { nodes { author { login } body } } }
    }
    gemergt: ${GEMERGT}
  }
}`
const SEITE = `query($owner: String!, $name: String!, $nach: String) {
  repository(owner: $owner, name: $name) {
    gemergt: ${GEMERGT}
  }
}`

function pfade(env = process.env) {
  return {
    stand: env.STAND_PRS_DATEI || 'C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/stand.md',
    zustand: env.STAND_PRS_ZUSTAND || path.join(os.homedir(), '.claude', 'hooks', 'state', 'stand-prs.json'),
  }
}

// STAND_PRS_GH_SKRIPT: Node-Skript statt gh, nur für den Prozesstest. windowsHide: sonst blitzt je Lauf ein Konsolenfenster.
function ghAufruf(args, ausfuehren = execFileSync, hat = fs.existsSync) {
  const skript = process.env.STAND_PRS_GH_SKRIPT
  const gh = skript ? process.execPath : hat(GH_WINDOWS) ? GH_WINDOWS : 'gh'
  const opt = { encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  return ausfuehren(gh, skript ? [skript, ...args] : args, opt)
}

function frage(gh, abfrage, nach) {
  const args = ['api', 'graphql', '-f', `query=${abfrage}`, '-F', `owner=${REPO[0]}`, '-F', `name=${REPO[1]}`]
  return JSON.parse(gh(nach ? [...args, '-f', `nach=${nach}`] : args)).data.repository
}

/** { offen, gemergt } aus GitHub; gemergt vollständig bis zur 24-h-Grenze. Wirft bei gh-, Format- oder Mengenfehlern. */
function holePrs(gh, jetzt) {
  const repo = frage(gh, ABFRAGE)
  if (!Array.isArray(repo.offen?.nodes) || !Array.isArray(repo.gemergt?.nodes)) throw new Error('Antwort ohne nodes')
  if (repo.offen.pageInfo?.hasNextPage) throw new Error('mehr als 100 offene PRs, Liste wäre unvollständig')
  const gemergt = [...repo.gemergt.nodes]
  let seite = repo.gemergt
  for (let n = 1; seite.pageInfo?.hasNextPage && Date.parse(seite.nodes.at(-1)?.updatedAt) >= jetzt - GEMERGT_FENSTER; n++) {
    if (n >= MAX_SEITEN) throw new Error(`gemergte PRs: mehr als ${MAX_SEITEN} Seiten`)
    seite = frage(gh, SEITE, seite.pageInfo.endCursor).gemergt
    gemergt.push(...seite.nodes)
  }
  return { offen: repo.offen.nodes, gemergt }
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

const kommentare = (pr) => pr.comments?.nodes ?? []
const istKopf = (pr, sha) => String(pr.headRefOid).startsWith(sha)

/** Jüngstes CI-Urteil (github-actions): { wort, alt } (alt: für einen früheren Kopf); null ohne Urteil. */
function ciUrteil(pr) {
  const treffer = kommentare(pr)
    .filter((k) => k.author?.login === 'github-actions')
    .map((k) => CI_URTEIL.exec(k.body))
    .filter(Boolean)
  const letztes = treffer.at(-1)
  return letztes ? { wort: letztes[2].split(',')[0], alt: !istKopf(pr, letztes[1]) } : null
}

/**
 * Jüngstes Urteil des Prüfer-Agenten („Prüfer Runde N: freigeben|ändern“): { runde, wort, alt }; null ohne Urteil.
 * Kopf aus „Kopf <sha>“; fehlt die Angabe, gilt der aktuelle Kopf nur, wenn der Text ihn nennt (sonst alt).
 */
function agentUrteil(pr) {
  const k = kommentare(pr).filter((c) => AGENT_URTEIL.test(c.body)).at(-1)
  if (!k) return null
  const [, runde = '', wort] = AGENT_URTEIL.exec(k.body)
  const kopf = AGENT_KOPF.exec(k.body)?.[1]
  const aktuell = kopf ? istKopf(pr, kopf) : k.body.includes(String(pr.headRefOid).slice(0, 7))
  return { runde, wort, alt: !aktuell }
}

const CHECKS = { SUCCESS: 'Checks grün', FAILURE: 'Checks rot', ERROR: 'Checks rot', PENDING: 'Checks laufen', EXPECTED: 'Checks laufen' }
const kopfVermerk = (u) => (u.alt ? ' (älterer Kopf)' : '')

/** Zustandsteile eines offenen PRs in fester Reihenfolge; CI- und Agent-Urteil getrennt. */
function zustand(pr) {
  const ci = ciUrteil(pr)
  const agent = agentUrteil(pr)
  const rollup = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
  return [
    kurztitel(pr.title).marke,
    pr.isDraft ? 'Entwurf' : '',
    pr.mergeable === 'CONFLICTING' ? 'Konflikt' : '',
    ci ? `CI ${ci.wort}${kopfVermerk(ci)}` : 'CI offen',
    agent ? `Prüfer ${agent.runde ? `R${agent.runde} ` : ''}${agent.wort}${kopfVermerk(agent)}` : 'Prüfer offen',
    CHECKS[rollup] ?? '',
  ].filter(Boolean)
}

/** Bereit zum Merge: kein Entwurf, kein Konflikt, Checks grün, CI „ok“ und Agent „freigeben“, beide auf dem aktuellen Kopf. */
function bereit(pr) {
  const ci = ciUrteil(pr)
  const agent = agentUrteil(pr)
  const urteile = ci?.wort === 'ok' && !ci.alt && agent?.wort === 'freigeben' && !agent.alt
  return urteile && zustand(pr).includes('Checks grün') && !pr.isDraft && pr.mergeable !== 'CONFLICTING'
}

const verweis = (pr) => `[PR ${pr.number}](${B.ADR}${pr.number})`

function offeneZeile(pr) {
  return `- **${kurztitel(pr.title).titel}** — ${zustand(pr).join(' · ')} — ${verweis(pr)}`
}

/** „19.10. 16:27“ in Berliner Zeit. */
function berlin(zeit) {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(zeit))
      .map((t) => [t.type, t.value]),
  )
  return `${teile.day}.${teile.month}. ${teile.hour}:${teile.minute}`
}

/** Sammelzeile der in 24 h gemergten PRs (Nummer 0); der letzte Zeitpunkt zeigt, ob der Hook noch mitläuft. */
function sammelZeile(frisch) {
  return `- [klein] **Gemergt in 24 h: ${frisch.length}** — zuletzt ${berlin(Date.parse(frisch[0].mergedAt))} — [alle](${B.GEMERGT_LISTE})`
}

/** Reihen [{ nummer, zeile }]: offene (bereite zuerst, sonst neueste zuerst), dann eine Sammelzeile der in 24 h gemergten ohne Sammler. */
function reihen({ offen, gemergt }, jetzt) {
  const sortiert = [...offen].sort((a, b) => Number(bereit(b)) - Number(bereit(a)) || b.number - a.number)
  const frisch = gemergt.filter((pr) => !SAMMLER.test(pr.title) && jetzt - Date.parse(pr.mergedAt) <= GEMERGT_FENSTER)
  frisch.sort((a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt))
  const sammel = frisch.length ? [{ nummer: 0, zeile: sammelZeile(frisch) }] : []
  return [...sortiert.map((pr) => ({ nummer: pr.number, zeile: offeneZeile(pr) })), ...sammel]
}

function hinweisZeile(erfolg, fehler) {
  return `${B.HINWEIS}Stand ${erfolg ? berlin(erfolg) : 'unbekannt'}; Abruf scheitert: ${fehler}`
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

/** Neue PR-Reihen oder, wenn der Abruf scheitert, { fehler }. */
function frischeReihen(gh, jetzt) {
  try {
    return { reihen: reihen(holePrs(gh, jetzt), jetzt) }
  } catch (e) {
    return { fehler: String(e.message).split('\n')[0] }
  }
}

/**
 * Ein Durchgang: { ergebnis, erfolg?, laut? }. erfolg: Block ist frisch; laut: die Sitzung soll es erfahren.
 * Ein Abruffehler bleibt still, bis der letzte Erfolg älter als VERALTET ist; dann behält der Block seine Reihen und
 * bekommt die Hinweiszeile. Liest stand.md erst nach der Abfrage (Handänderungen der Zwischenzeit bleiben), schreibt nur
 * bei Änderung, atomar. Zeilenenden und Änderungszeit bleiben: daniel-dateien.js misst an der Änderungszeit, ob die
 * Sitzung stand.md pflegt.
 */
function aktualisiere({ datei, gh, jetzt, erfolg }) {
  const frisch = frischeReihen(gh, jetzt)
  if (frisch.fehler && jetzt - erfolg <= VERALTET) return { ergebnis: `Fehler: ${frisch.fehler}` }
  const sperrdatei = `${datei}.pr-sperre`
  if (!sperre(sperrdatei, jetzt)) return { ergebnis: 'gesperrt' }
  try {
    const vorher = fs.readFileSync(datei, 'utf8')
    const eol = vorher.includes('\r\n') ? '\r\n' : '\n'
    const hinweis = frisch.fehler ? hinweisZeile(erfolg, frisch.fehler) : ''
    const r = B.ersetzeBlock(vorher.split(eol).join('\n'), frisch.reihen ?? null, hinweis)
    if (r.fehler) return { ergebnis: `nicht geschrieben: ${r.fehler}`, laut: true }
    const neu = r.text.split('\n').join(eol)
    const warnung = waechter(r.text, jetzt)
    const zusatz = warnung ? { warnung } : {}
    const fertig = frisch.fehler ? { ergebnis: `veraltet: ${frisch.fehler}`, laut: true, ...zusatz } : null
    if (neu === vorher) return fertig ?? { ergebnis: 'unverändert', erfolg: true, ...zusatz }
    const { atime, mtime } = fs.statSync(datei)
    const tmp = `${datei}.pr-neu`
    fs.writeFileSync(tmp, neu)
    fs.renameSync(tmp, datei)
    fs.utimesSync(datei, atime, mtime)
    return fertig ?? { ergebnis: `geschrieben (${frisch.reihen.length} Zeilen)`, erfolg: true, ...zusatz }
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

function leseZustand(datei) {
  try {
    return JSON.parse(fs.readFileSync(datei, 'utf8'))
  } catch {
    return {}
  }
}

/** { ergebnis, laut? }; das Ergebnis steht auch im Zustand, samt Zeit des letzten Erfolgs (`erfolg`). */
function lauf(input, { env = process.env, gh = ghAufruf, jetzt = Date.now() } = {}) {
  const p = pfade(env)
  const vorher = leseZustand(p.zustand)
  const erfolg = Number(vorher.erfolg) || 0
  if (!input.jetzt && !sollLaufen(input, Number(vorher.t) || 0, jetzt)) return { ergebnis: 'übersprungen' }
  const merke = (ergebnis, e) => fs.writeFileSync(p.zustand, JSON.stringify({ t: jetzt, ergebnis, erfolg: e }))
  fs.mkdirSync(path.dirname(p.zustand), { recursive: true })
  merke('läuft', erfolg)
  let r
  try {
    r = aktualisiere({ datei: p.stand, gh, jetzt, erfolg })
  } catch (e) {
    r = { ergebnis: `Fehler: ${String(e.message).split('\n')[0]}`, laut: true }
  }
  merke(r.ergebnis, r.erfolg ? jetzt : erfolg)
  return r
}

/** Hook-Ausgabe: still, außer die Sitzung soll es erfahren (async-Hook: systemMessage erreicht sie beim nächsten Zug). */
function ausgabe(r) {
  const meldungen = [r.laut ? `stand-prs.js: ${r.ergebnis} (stand.md, Abschnitt „In Arbeit“)` : '', r.warnung ? `stand.md: ${r.warnung}` : ''].filter(Boolean)
  return meldungen.length ? `${JSON.stringify({ systemMessage: meldungen.join('\n') })}\n` : ''
}

module.exports = { ...B, GH_WINDOWS, ABFRAGE, SEITE, ghAufruf, holePrs, kurztitel, ciUrteil, agentUrteil, zustand, bereit, offeneZeile, berlin, sammelZeile, reihen, hinweisZeile, sperre, aktualisiere, sollLaufen, lauf, ausgabe }

if (require.main === module) {
  if (process.argv.includes('--jetzt')) {
    process.stdout.write(`stand-prs: ${lauf({ jetzt: true }).ergebnis}\n`)
  } else {
    let s = ''
    process.stdin.on('data', (d) => (s += d)).on('end', () => {
      let eingabe = {}
      try {
        eingabe = JSON.parse(s)
      } catch {}
      process.stdout.write(ausgabe(lauf(eingabe)))
    })
  }
}
