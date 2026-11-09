#!/usr/bin/env node
/**
 * PreToolUse-Sperre (Bash) für die echte D1 (14.10.2026): `wrangler d1 execute|export|migrations apply`
 * mit `--remote`/`--preview` geht nur durch, wenn das Plan-Tor (EXPLAIN QUERY PLAN gegen das Schema, ohne Daten)
 * nichts findet oder eine Freigabe des Dirigenten vorliegt, und das Tagesbudget reicht. Lesen mit Schlüssel bleibt frei.
 * Anlass: das Einspiel-SQL der Titelzeile las 9,1 Mio. Zeilen (Tageskontingent 5 Mio.), geschätzt waren 50.000.
 * Logik: C:/code/ai/__assets/tools/d1-schutz/ (plan-tor.mjs, urteil.mjs, zustand.mjs). Test: node ~/.claude/hooks/d1-sperre-test.mjs
 * Schutz vor Versehen, nicht vor Absicht. Abgedeckt auch: Quotes/Backslashes im Wort, Flaggen vor `d1`, `bash|sh -…c [--]`,
 * `cmd //c`, `bash <<EOF`, `bash <<<`, `npm run <skript>` (samt pre/post); `$`-Wörter im Aufruf und `| bash` sperren,
 * außer bei wörtlichem `--local` ohne `--remote` im selben Befehl.
 * Nicht abgedeckt: Skripte, die wrangler selbst starten (node x.mjs, bash x.sh, node -e), `source <(…)`, `env -S`,
 * `npm run` nach `cd "$D"`, `npm start|test`, pnpm/yarn, REST-Aufrufe per fetch, Unterbefehle ohne execute/export/migrations.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const SCHUTZ = 'C:/code/ai/__assets/tools/d1-schutz'
const STANDARD_WORKER = 'C:/code/ai/anime-kalender-de/worker'
const ARTEN = ['execute', 'export', 'migrations apply']
// Vorfilter ohne Quotes und Backslashes (`d""1`, `--rem''ote`, `\-\-remote` sind für die Shell dieselben Wörter);
// ohne wrangler-Wort, weil Hüllen wie `node cf.cjs d1 execute …` weiterreichen; `$` kann `--remote` erst zur Laufzeit liefern.
function d1Ruf(text) {
  const n = text.replace(/["'\\]/g, '')
  // `d1` als eigenes Shell-Wort, nicht Teil eines Dateinamens wie `d1-limit.ts` (17.10.2026, Fehlalarm im Prüfer).
  return /(^|[\s;&|(`$])d1(?=[\s;&|)`]|$)/.test(n) && /--(remote|preview)|\$/.test(n)
}
const REMOTE = /^--(remote|preview)(?!=false$)(=.*)?$/
const WRANGLER = /^wrangler(@[\w.^~-]+)?(\.js|\.cmd|\.exe)?$/i
// Befehle, die einen wrangler-Text nur ausgeben oder durchsuchen; mit Backtick im Befehl gilt das nicht.
const HARMLOS = /^(echo|printf|grep)$/
const UNBEKANNT = '<Arbeitsordner aus $-Variable>'
// `$` erweitert nur vor einem Variablenzeichen (`'$.titel'` in SQL ist wörtlich); ohne Quotes auch `$'…'` und `$"…"`.
const ERWEITERT = /[\w{(@*#?!$-]/
const ERWEITERT_ROH = /[\w{(@*#?!$'"-]/
const erweitert = (c, nach, muster) => c === '`' || (c === '$' && muster.test(nach ?? ''))
const HUELLE = /^((ba)?sh|cmd)(\.exe)?$/i
// sh-Flaggengruppe mit c (`-c`, `-lc`, `-ec`) oder cmd `/c` (in Git Bash `//c`)
const HUELLE_C = /^(-[a-zA-Z]*c[a-zA-Z]*|\/\/?[cC])$/
const NPM_RUN = /^(run|run-script)$/
const MAX_TIEFE = 5
const sq = (t) => `'${t.replaceAll("'", `'\\''`)}'`

/** Bash-Text → einfache Befehle als Wortlisten; ein Wort ist `unsicher`, wenn die Shell es erst erweitern würde ($, Backtick). */
function zerlege(text) {
  const befehle = [[]]
  let wort = null
  let heredoc = null
  let herein = false
  const schliesse = () => {
    if (wort) befehle[befehle.length - 1].push(wort)
    wort = null
  }
  const neu = () => {
    schliesse()
    if (befehle[befehle.length - 1].length) befehle.push([])
  }
  const an = (t, unsicher = false) => {
    // Das Wort nach `<<<` ist stdin des Befehls (für `bash <<< "…"`).
    if (!wort) {
      wort = { text: '', unsicher: false, herein }
      herein = false
    }
    wort.text += t
    wort.unsicher = wort.unsicher || unsicher
  }
  // `$(…)`/Backtick in doppelten Quotes: die Shell führt den Inhalt aus, er wird als eigener Befehlstext geprüft.
  const ersetze = (innen) => (wort.ersetzungen ??= []).push(innen)
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\n' && heredoc) {
      neu()
      // Endmarke auf eigener Zeile, bei <<- auch mit Tabs davor; der Inhalt hängt am Befehl (für `bash <<EOF`).
      const ende = new RegExp(`\\n\\t*${heredoc.marke}(?=\\n|$)`, 'g')
      ende.lastIndex = i
      const m = ende.exec(text)
      heredoc.befehl.heredoc = text.slice(i + 1, m ? m.index : text.length)
      // Ohne Quotes an der Endmarke führt die Shell `$(…)` und Backticks im Inhalt aus.
      heredoc.befehl.expandiert = !heredoc.gequotet
      i = m ? ende.lastIndex : text.length
      heredoc = null
      continue
    }
    if (c === ' ' || c === '\t') schliesse()
    else if ('\n;&|()'.includes(c)) neu()
    else if (c === '<' || c === '>') {
      schliesse()
      // `<<<` (Herestring) passt nicht auf das Muster: nach `<<` folgt kein Wortzeichen.
      const treffer = text.startsWith('<<', i) ? /^<<-?\s*(['"]?)(\w+)/.exec(text.slice(i)) : null
      if (treffer) heredoc = { marke: treffer[2], gequotet: treffer[1] !== '', befehl: befehle[befehle.length - 1] }
      herein = text.startsWith('<<<', i)
      while ('<>'.includes(text[i + 1])) i++
    } else if (c === '#' && !wort) {
      const zeilenende = text.indexOf('\n', i)
      i = (zeilenende < 0 ? text.length : zeilenende) - 1
    } else if (c === "'") {
      const ende = text.indexOf("'", i + 1)
      an(text.slice(i + 1, ende < 0 ? text.length : ende))
      i = ende < 0 ? text.length : ende
    } else if (c === '"') i = doppelt(text, i, an, ersetze)
    else if (c === '\\') an(text[++i] ?? '')
    else an(c, erweitert(c, text[i + 1], ERWEITERT_ROH))
  }
  schliesse()
  return befehle.filter((b) => b.length)
}

function doppelt(text, start, an, ersetze) {
  let i = start + 1
  an('')
  while (i < text.length && text[i] !== '"') {
    const e = text[i] === '\\' ? null : ersetzung(text, i)
    if (text[i] === '\\' && '"\\$`'.includes(text[i + 1])) an(text[++i])
    else if (e) {
      ersetze(e.innen)
      an(text.slice(i, e.ende + 1), true)
      i = e.ende
    } else an(text[i], erweitert(text[i], text[i + 1], ERWEITERT))
    i++
  }
  return i
}

/** `$(…)` oder Backtick ab Stelle i: Inhalt und Index des schließenden Zeichens (ohne Ende: Textende, im Zweifel wird mehr geprüft). */
function ersetzung(text, i) {
  if (text[i] === '`') {
    const ende = backtickEnde(text, i + 1)
    return { innen: text.slice(i + 1, ende), ende }
  }
  if (text[i] !== '$' || text[i + 1] !== '(') return null
  const ende = klammerEnde(text, i + 2)
  return { innen: text.slice(i + 2, ende), ende }
}

function backtickEnde(text, start) {
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === '`') return i
  }
  return text.length
}

// Ende von "…" (Index des schließenden Quotes); `$(…)` darin kann selbst Quotes enthalten.
function dqEnde(text, start) {
  for (let i = start + 1; i < text.length; i++) {
    const e = text[i] === '\\' ? null : ersetzung(text, i)
    if (text[i] === '\\') i++
    else if (e) i = e.ende
    else if (text[i] === '"') return i
  }
  return text.length
}

// Index der `)`, die `$(` schließt: überspringt Quotes, Escapes und Heredoc-Inhalte (Apostroph und `)` im Nachrichtentext).
function klammerEnde(text, start) {
  let tiefe = 1
  let marke = null
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '\n' && marke) {
      const ende = new RegExp(`\\n\\t*${marke}(?=\\n|$)`, 'g')
      ende.lastIndex = i
      const m = ende.exec(text)
      i = m ? ende.lastIndex - 1 : text.length
      marke = null
    } else if (c === '\\') i++
    else if (c === "'") {
      const q = text.indexOf("'", i + 1)
      i = q < 0 ? text.length : q
    } else if (c === '"') i = dqEnde(text, i)
    else if (c === '<' && text.startsWith('<<<', i)) i += 2
    else if (c === '<' && text.startsWith('<<', i)) {
      marke = /^<<-?\s*['"]?(\w+)/.exec(text.slice(i))?.[1] ?? null
      i++
    } else if (c === '(') tiefe++
    else if (c === ')' && --tiefe === 0) return i
  }
  return text.length
}

/** Befehlstexte, die die Shell in einem Befehl erst ausführt: `$(…)`/Backtick-Inhalt in Wörtern und im unquotierten Heredoc. */
function ersetzungsTexte(woerter) {
  const innen = woerter.flatMap((x) => x.ersetzungen ?? [])
  if (!woerter.expandiert) return innen
  const body = woerter.heredoc
  for (let i = 0; i < body.length; i++) {
    const e = body[i] === '\\' ? null : ersetzung(body, i)
    if (body[i] === '\\') i++
    else if (e) {
      innen.push(e.innen)
      i = e.ende
    }
  }
  return innen
}

const winPfad = (p) =>
  String(p)
    .replace(/^~(?=\/|$)/, os.homedir().replace(/\\/g, '/'))
    .replace(/^\/([a-z])(?=\/|$)/i, (_, l) => `${l.toUpperCase()}:`)

// Nach `cd "$D"` ist der Ordner unbekannt; relative Pfade bleiben es, absolute nicht.
function aufloesen(cwd, p) {
  if (cwd === UNBEKANNT && !path.isAbsolute(winPfad(p))) return UNBEKANNT
  return path.resolve(cwd, winPfad(p)).replace(/\\/g, '/')
}

/** Alle Werte einer Flagge (`--x wert` und `--x=wert`), in Reihenfolge. */
function werte(args, name) {
  return args.flatMap((a, i) => {
    if (a.text === name) return args[i + 1] ? [args[i + 1]] : []
    return a.text.startsWith(name + '=') ? [{ ...a, text: a.text.slice(name.length + 1) }] : []
  })
}

const wert = (args, name) => werte(args, name)[0] ?? null

// Wörtliches `--local` ohne jede Form von --remote im selben Befehl läuft nur lokal, auch mit `$`: wrangler 4.120
// bricht bei --local und --remote zugleich ab (execute, export, migrations apply), --preview braucht --remote.
function lokal(woerter) {
  return woerter.some((x) => x.text === '--local') && !woerter.some((x) => /--remote/.test(x.text))
}

// Text einer Hülle (`bash -c "…"`): jeder Befehl mit `$`-Wort muss für sich lokal sein; die übrigen prüft die Rekursion.
const lokalerText = (t) => zerlege(t).every((b) => !b.some((x) => x.unsicher) || lokal(b))

/** Alle d1-Aufrufe an der echten D1 in einem Bash-Text, mit dem Arbeitsordner, in dem sie laufen; auch in Hüllen und npm-Skripten. */
function d1Aufrufe(text, startCwd, tiefe = 0) {
  if (tiefe > MAX_TIEFE) return [{ unsicher: true, cwd: startCwd, grund: `D1-Schutz: Hüllen oder npm-Skripte tiefer als ${MAX_TIEFE} Ebenen verschachtelt (Skripttiefe) — nicht auswertbar.` }]
  const funde = []
  let cwd = winPfad(startCwd || process.cwd())
  for (const woerter of zerlege(text)) {
    for (const t of ersetzungsTexte(woerter)) funde.push(...d1Aufrufe(t, cwd, tiefe + 1))
    let k = 0
    while (k < woerter.length && /^\w+=/.test(woerter[k].text)) k++
    const w = woerter.slice(k)
    if (w[0]?.text === 'cd' && w[1]) cwd = w[1].unsicher ? UNBEKANNT : aufloesen(cwd, w[1].text)
    if (harmlos(w)) continue
    funde.push(...huellen(w, woerter.heredoc, text, cwd, tiefe), ...npmSkripte(w, cwd, tiefe))
    // eval, xargs (hängt Argumente an) und ein Befehl aus einer Variable liefern ihren Aufruf erst zur Laufzeit;
    // frei nur, wenn jeder Befehl darin wörtlich lokal ist (eval liest seine Argumente als Text neu).
    const laufzeit = /^(eval|xargs)$/.test(w[0]?.text ?? '') || w[0]?.unsicher
    if (laufzeit && d1Ruf(text) && !zerlege(w.map((x) => x.text).join(' ')).every(lokal)) funde.push({ unsicher: true, cwd })
    else funde.push(...[d1Aufruf(w, cwd)].filter(Boolean))
  }
  return funde
}

/** echo/grep … mit wrangler-Text als Argument führt nichts aus (auch hinter xargs); ein Backtick im Befehl schon. */
function harmlos(w) {
  const befehl = w[0]?.text === 'xargs' ? w.find((x, i) => i > 0 && !x.text.startsWith('-')) : w[0]
  return HARMLOS.test(befehl?.text ?? '') && !w.some((x) => x.text.includes('`'))
}

/** Ab dem Wort `d1` (wrangler davor oder eine Hülle, die an wrangler weiterreicht): Unterbefehl, Argumente samt globaler Flaggen. */
function d1Aufruf(w, cwd) {
  const ist = (x) => WRANGLER.test(path.basename(x.text))
  // $VAR oder $'…' nach wrangler: Unterbefehl, Ziel und --remote stehen erst zur Laufzeit fest.
  const wr = w.findIndex(ist)
  const nurLokal = lokal(w)
  if (wr >= 0 && !nurLokal && w.slice(wr).some((x) => x.unsicher)) return { unsicher: true, cwd }
  for (let j = 0; j < w.length; j++) {
    if (w[j].text !== 'd1') continue
    const k = w.slice(0, j).findLastIndex(ist)
    const args = w.slice(k < 0 ? j + 1 : k + 1)
    const art = d1Art(w.slice(j + 1))
    if (k < 0 && !art) continue
    if (!nurLokal && w.slice(j).some((x) => x.unsicher)) return { unsicher: true, cwd }
    if (!ARTEN.includes(art) || !args.some((a) => REMOTE.test(a.text))) continue
    const ort = wert(args, '--cwd')
    return { art, args, cwd: ort ? aufloesen(cwd, ort.text) : cwd, unsicher: false }
  }
  return null
}

// Erstes Unterbefehlswort nach `d1`, egal welche Flaggen (mit oder ohne Wert) davor stehen: im Zweifel wird geprüft, nicht freigegeben.
function d1Art(nach) {
  const i = nach.findIndex((x) => ['execute', 'export', 'migrations'].includes(x.text))
  if (i < 0) return null
  if (nach[i].text !== 'migrations') return nach[i].text
  return nach.slice(i + 1).some((x) => x.text === 'apply') ? 'migrations apply' : 'migrations'
}

/** bash -c / sh -lc / cmd //c "<Befehl>" und bash <<EOF prüfen den inneren Text; eine Shell, die von stdin liest, ist nicht auswertbar. */
function huellen(w, heredoc, text, cwd, tiefe) {
  const s = w.findIndex((x) => HUELLE.test(path.basename(x.text)))
  if (s < 0) return []
  const c = w.findIndex((x, i) => i > s && HUELLE_C.test(x.text))
  // `bash -c -- "…"`: `--` beendet die Flaggen; `bash <<< "…"` liest das Wort als Skript.
  const innen = c > 0 ? w[c + 1 + (w[c + 1]?.text === '--')] : w.find((x) => x.herein)
  const unsicher = d1Ruf(text) ? [{ unsicher: true, cwd }] : []
  if (innen) return [...(innen.unsicher && !lokalerText(innen.text) ? unsicher : []), ...d1Aufrufe(innen.text, cwd, tiefe + 1)]
  if (heredoc !== undefined) return d1Aufrufe(heredoc, cwd, tiefe + 1)
  return w.slice(s + 1).every((x) => x.text.startsWith('-') || x.text === '/dev/stdin') ? unsicher : []
}

/** npm run <skript>: pre-, Haupt- und post-Skript aus der nächsten package.json (oder --prefix), Argumente hinten angehängt. */
function npmSkripte(w, cwd, tiefe) {
  const n = w.findIndex((x) => /^npm(\.cmd)?$/i.test(path.basename(x.text)))
  const r = w.findIndex((x, i) => n >= 0 && i > n && NPM_RUN.test(x.text))
  if (r < 0) return []
  const rest = w.slice(r + 1)
  const i = rest.findIndex((x, j) => !x.text.startsWith('-') && rest[j - 1]?.text !== '--prefix')
  if (i < 0) return []
  const name = rest[i].text
  const extra = rest.slice(i + 1).map((x) => sq(x.text)).join(' ')
  const prefix = wert(w.slice(n), '--prefix')
  // Nach `cd "$D"` ist die package.json unbekannt (bekannte Grenze, betrieb.md).
  const dir = prefix ? aufloesen(cwd, prefix.text) : cwd === UNBEKANNT ? null : paketOrdner(cwd)
  if (!dir || !fs.existsSync(`${dir}/package.json`)) return []
  const skripte = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8')).scripts ?? {}
  return [`pre${name}`, name, `post${name}`]
    .filter((s) => typeof skripte[s] === 'string')
    .flatMap((s) => d1Aufrufe(s === name ? `${skripte[s]} ${extra}` : skripte[s], dir, tiefe + 1))
}

function paketOrdner(cwd) {
  for (let d = cwd; ; d = path.dirname(d)) {
    if (fs.existsSync(`${d}/package.json`)) return d.replace(/\\/g, '/')
    if (path.dirname(d) === d) return null
  }
}

/** Ordner der D1 für diesen Aufruf: --config, cwd, cwd/worker (bei bekanntem Datenbanknamen nur mit passender database_name), sonst BEKANNTE, sonst die Kalender-D1. */
function workerVerzeichnis(cwd, config, name) {
  const { leseDatenbank, BEKANNTE } = require(`${SCHUTZ}/datenbank.mjs`)
  const kandidaten = [config ? path.dirname(aufloesen(cwd, config)) : null, cwd, `${cwd}/worker`]
  const ok = (d) => {
    const k = d && leseDatenbank(d)
    return k && (!BEKANNTE[name] || !k.name || k.name === name)
  }
  return (kandidaten.find(ok) ?? BEKANNTE[name] ?? STANDARD_WORKER).replace(/\\/g, '/')
}

/** Aufruf → Eingabe für urteil(): SQL aus --command oder --file; null, wenn wrangler nichts ausführen würde. */
function urteilsEingabe(a) {
  if (a.unsicher) return { grund: a.grund ?? 'D1-Schutz: Aufruf an der echten D1 nicht auswertbar ($-Variable, $(…), Backtick, eval, xargs oder Shell über stdin). SQL als Datei ablegen und Pfad und Befehl wörtlich angeben.' }
  const schluessel = `wrangler d1 ${a.args.map((x) => x.text).join(' ')}`
  if (a.art !== 'execute') return { art: a.art, schluessel }
  const name = a.args.slice(a.args.findIndex((x) => x.text === 'execute') + 1).find((x) => !x.text.startsWith('-'))?.text
  const workerDir = workerVerzeichnis(a.cwd, (wert(a.args, '--config') ?? wert(a.args, '-c'))?.text, name)
  // Alle Werte: welchen wrangler bei doppelter Flagge nimmt, prüft der Hook nicht nach.
  const befehle = werte(a.args, '--command').map((x) => x.text)
  if (befehle.length) return { art: a.art, sql: befehle.join(';\n'), schluessel: befehle.join(';\n'), workerDir }
  const dateien = werte(a.args, '--file').map((x) => aufloesen(a.cwd, x.text))
  if (!dateien.length) return null
  if (dateien.includes(UNBEKANNT)) return { grund: 'D1-Schutz: --file nach cd mit $-Variable — Ordner nicht auswertbar. Pfad absolut oder cd wörtlich angeben.' }
  try {
    const sql = dateien.map((p) => fs.readFileSync(p, 'utf8')).join(';\n')
    return { art: a.art, sql, schluessel: sql, workerDir }
  } catch {
    return { grund: `D1-Schutz: SQL-Datei ${dateien.join(', ')} nicht lesbar — ohne Prüfung keine Ausführung an der echten D1.` }
  }
}

function pruefe(input, umgebung = {}) {
  if (input?.tool_name !== 'Bash') return null
  const text = String(input.tool_input?.command ?? '')
  if (!d1Ruf(text) && !/\bnpm\b/.test(text)) return null
  try {
    const aufrufe = d1Aufrufe(text, input.cwd)
    // urteil.mjs lädt node:sqlite (gemessen ≈ 15 ms je Aufruf); jedes `npm …` käme sonst dafür vorbei.
    if (!aufrufe.length) return null
    const { urteil } = require(`${SCHUTZ}/urteil.mjs`)
    for (const a of aufrufe) {
      const e = urteilsEingabe(a)
      if (!e) continue
      const grund = e.grund ?? urteil(e, umgebung)
      if (grund) return grund
    }
    return null
  } catch (fehler) {
    // Ein Fehler in der Prüfung darf die echte D1 nicht freigeben.
    return d1Ruf(text) ? `D1-Schutz: Prüfung gescheitert (${String(fehler?.message ?? fehler).slice(0, 120)}) — ohne Prüfung keine Ausführung an der echten D1.` : null
  }
}


module.exports = { pruefe, zerlege, d1Aufrufe }

if (require.main === module) {
  let roh = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (c) => { roh += c })
  process.stdin.on('end', () => {
    const grund = pruefe(JSON.parse(roh || '{}'))
    if (grund) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: grund } }))
    process.exit(0)
  })
}
