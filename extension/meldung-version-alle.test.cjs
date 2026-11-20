/**
 * Jeder POST an `/pruefung` in `extension/` trägt die Erweiterungsversion (20.11.2026).
 *
 * Anlass: `pruefung.ext_version` war bei allen 58 Prime-Zeilen seit 18.11. NULL, weil die zwei Prime-Rümpfe in `amazon.js` nur
 * `seitenAdresse` sendeten. Erfasst wird jeder Sendeaufruf (`fetch(WORKER, …)`/`sende(worker, …)` mit `method: 'POST'` und ADNs
 * `senden(token, …)`) einzeln, Kommentare vorher entfernt. Sein Rumpf muss `version:`, `meldungKopf()`, `beobachtung(`
 * (Netflix, setzt Version und Seite) oder `mitSeite(` (ADN) enthalten. Ausnahmen mit Grund unten (`OHNE`): Rümpfe, die keine Meldung
 * sind. Ein neuer Sendeaufruf ohne dies ist rot, auch ohne `seitenAdresse`. Wirkung von `meldungKopf()` selbst: `meldung-kopf.test.cjs`.
 */
const { readFileSync, readdirSync } = require('node:fs')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}

/** Rümpfe, die keine Meldung sind: Suchwort im Rumpf → Grund. */
const OHNE = {
  'erwartung:': 'Erwartung (Prime-Briefkasten), keine Beobachtung',
  'm.daten': 'Netflix-Stapel; die Rümpfe baut `beobachtung()` (netflix-meldung-version.test.cjs)',
}

/** Entfernt Kommentare, lässt Zeichenketten und Vorlagen unberührt; Zeilenumbrüche bleiben (Zeilennummern). */
function ohneKommentare(t) {
  let aus = ''
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < t.length && t[j] !== c) j += t[j] === '\\' ? 2 : 1
      aus += t.slice(i, j + 1)
      i = j
    } else if (c === '/' && t[i + 1] === '/') {
      while (i < t.length && t[i] !== '\n') i++
      aus += '\n'
    } else if (c === '/' && t[i + 1] === '*') {
      const ende = t.indexOf('*/', i + 2)
      aus += t.slice(i, ende + 2).replace(/[^\n]/g, '')
      i = ende + 1
    } else {
      aus += c
    }
  }
  return aus
}

/** Die Argumente ab der öffnenden Klammer bei `von` bis zur passenden schließenden (Zeichenketten übersprungen). */
function argumente(t, von) {
  let tiefe = 0
  for (let i = von; i < t.length; i++) {
    const c = t[i]
    if (c === '"' || c === "'" || c === '`') {
      i++
      while (i < t.length && t[i] !== c) i += t[i] === '\\' ? 2 : 1
    } else if (c === '(') tiefe++
    else if (c === ')' && --tiefe === 0) return t.slice(von, i + 1)
  }
  return t.slice(von)
}

/** Alle Sendeaufrufe an `/pruefung` einer Datei: `{ zeile, text }`. */
function sendeaufrufe(quelle) {
  const t = ohneKommentare(quelle)
  const fund = []
  const muster = /\b(fetch|sende|senden)\(\s*(WORKER|worker|token)\s*,/g
  let m
  while ((m = muster.exec(t))) {
    const text = argumente(t, m.index + m[1].length)
    if (m[1] !== 'senden' && !/method:\s*'POST'/.test(text)) continue
    fund.push({ zeile: t.slice(0, m.index).split('\n').length, text })
  }
  return fund
}

/** `def`: die Zeile `const mitSeite = …` der Datei; ADN-Aufrufe tragen die Version nur, wenn dort `version:` oder `meldungKopf()` steht. */
const traegt = (text, def = '') =>
  /\bversion:|meldungKopf\(\)|beobachtung\(/.test(text) || (/mitSeite\(/.test(text) && /\bversion:|meldungKopf\(\)/.test(def))

function selbsttest() {
  const nur = (q) => sendeaufrufe(q).length
  pruefe('Selbsttest: Aufruf im Kommentar zählt nicht', nur("// fetch(WORKER, { method: 'POST' })\n/* sende(worker, { method: 'POST' }) */") === 0)
  pruefe('Selbsttest: GET zählt nicht, POST zählt', nur("fetch(WORKER, { cache: 'x' })") === 0 && nur("fetch(WORKER, { method: 'POST', body: 1 })") === 1)
  pruefe('Selbsttest: „version“ im Kommentar zählt nicht als Träger', !traegt(ohneKommentare('{ /* version: 1 */ a: 1 }')))
}

selbsttest()
const dateien = readdirSync(__dirname).filter((n) => n.endsWith('.js') && !n.startsWith('offene-') && n !== 'kontext.js')
let stellen = 0
for (const datei of dateien) {
  const quelle = readFileSync(__dirname + '/' + datei, 'utf8')
  const def = ohneKommentare(quelle).split('\n').find((z) => z.includes('const mitSeite =')) ?? ''
  for (const { zeile, text } of sendeaufrufe(quelle)) {
    stellen++
    const ausnahme = Object.keys(OHNE).find((k) => text.includes(k))
    pruefe(`${datei}:${zeile}: POST an /pruefung trägt version${ausnahme ? ` (Ausnahme: ${OHNE[ausnahme]})` : ''}`, Boolean(ausnahme) || traegt(text, def), text.slice(0, 120))
  }
}
pruefe('Sendeaufrufe gefunden (nicht leer)', stellen >= 9, stellen)
console.log(`meldung-version-alle.test.cjs — ${faelle.length} Zusicherungen, ${stellen} Sendeaufrufe`)
process.exit(faelle.some((ok) => !ok) ? 1 : 0)
