// Vorschlags-Ledger: zieht „Vorschlag:“/„Veraltet:“ aus den Abschlussberichten der Subagenten
// und legt die Vorschläge, die noch in keiner Regel/Lehre/Doku stehen, in eine Liste (nur lesen
// außerhalb des Ausgabedatei, kein Netz). Aufruf: node tools/vorschlags-ledger.mjs [--tage 1] [--aus datei]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const LABEL = '(?:Veraltet|Gut|Schlecht|Unerwartet|Vorschlag)'

/** Schlussbericht: Handback-Text, sonst letzter Text der Assistenten-Nachricht. */
export function berichtAusJsonl(text) {
  let letzter = ''
  let handback = ''
  let ende = null
  for (const zeile of text.split('\n')) {
    let o
    try { o = JSON.parse(zeile) } catch { continue }
    if (o.timestamp) ende = o.timestamp
    if (o.type !== 'assistant' || !Array.isArray(o.message?.content)) continue
    const t = o.message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    if (t.trim()) letzter = t
    for (const b of o.message.content) {
      if (b.type === 'tool_use' && b.name === 'SubagentHandback') handback = b.input?.message || ''
    }
  }
  return { bericht: handback || letzter, ende }
}

/** Inhalt einer Rückblick-Zeile („Vorschlag: …“); leer bei Fehlen oder „keine“. */
export function zieheZeile(bericht, label) {
  const re = new RegExp(
    `(?:^|\\n|[.;—-]\\s)[\\s*\\-]*\\**${label}\\**\\s*[:–—-]\\s*([^\\n]*?)(?=\\s*(?:[;.]\\s*)?\\**${LABEL}\\**\\s*[:–—-]|\\n|$)`,
    'i',
  )
  const m = re.exec(bericht)
  if (!m) return ''
  const v = m[1].trim()
  return v.length < 12 || /^(—|-|keine?r?\b|nichts|kein weiterer)/i.test(v) ? '' : v
}

const STOPP = new Set(['sollte', 'werden', 'wurde', 'sollten', 'diesen', 'dieser', 'dieses', 'jeder', 'jedes', 'können', 'ebenfalls', 'welche', 'welcher', 'wären', 'nicht', 'damit', 'zuerst', 'danach', 'dabei', 'andere', 'anderen', 'mehr', 'eigene', 'eigenen', 'immer'])

/** Suchbegriffe: Code-Spans und PR-Nummern ganz, Wörter ab 7 Buchstaben als 6er-Stamm. */
export function schluessel(text) {
  const fest = new Set()
  for (const m of text.matchAll(/`([^`]{3,})`/g)) fest.add(m[1].toLowerCase())
  for (const m of text.matchAll(/(?:#|PR\s*)(\d{3,4})\b/g)) fest.add(`#${m[1]}`)
  const ohneCode = text.replace(/`[^`]*`/g, ' ')
  const stamm = new Set()
  for (const w of ohneCode.toLowerCase().match(/[a-zäöüß]{7,}/g) || []) {
    if (!STOPP.has(w)) stamm.add(w.slice(0, 6))
  }
  return { fest: [...fest], stamm: [...stamm] }
}

/** Korpus in Absätzen: ein Vorschlag gilt nur als gedeckt, wenn ein einzelner Absatz ihn trägt. */
export function korpusAus(texte) {
  const stuecke = []
  for (const text of texte) {
    for (const absatz of text.toLowerCase().split(/\n\s*\n/)) {
      const woerter = new Set()
      for (const w of absatz.match(/[a-zäöüß]{7,}/g) || []) woerter.add(w.slice(0, 6))
      stuecke.push({ roh: absatz, woerter })
    }
  }
  return stuecke
}

/** Gedeckt, wenn ein Absatz mindestens `schwelle` der Suchbegriffe trägt (mindestens 3 Begriffe nötig). */
export function istGedeckt(vorschlag, korpus, schwelle = 0.7) {
  const { fest, stamm } = schluessel(vorschlag)
  const gesamt = fest.length + stamm.length
  if (gesamt < 3) return false
  return korpus.some((k) => {
    const treffer = fest.filter((f) => k.roh.includes(f)).length + stamm.filter((s) => k.woerter.has(s)).length
    return treffer / gesamt >= schwelle
  })
}

/** Neue Listenzeilen: nur ungedeckte Vorschläge, nicht schon in `vorhanden` (nach Agent-ID). */
export function ledgerZeilen(eintraege, korpus, vorhanden) {
  const zeilen = []
  for (const e of eintraege) {
    if (!e.vorschlag || vorhanden.includes(e.id) || istGedeckt(e.vorschlag, korpus)) continue
    const veraltet = e.veraltet ? ` Veraltet gemeldet: ${e.veraltet}` : ''
    zeilen.push(`- [ ] ${e.datum} ${e.typ} \`${e.id}\`: ${e.vorschlag}${veraltet} → verankern / verwerfen: `)
  }
  return zeilen
}

function sammle(wurzel, endung, tiefe = 4) {
  const aus = []
  if (!fs.existsSync(wurzel)) return aus
  for (const e of fs.readdirSync(wurzel, { withFileTypes: true })) {
    const p = path.join(wurzel, e.name)
    if (e.isDirectory()) {
      if (tiefe > 0 && !/^(archiv|node_modules|state)$/.test(e.name)) aus.push(...sammle(p, endung, tiefe - 1))
    } else if (e.name.endsWith(endung)) aus.push(p)
  }
  return aus
}

export function ladeEintraege(projekte, seit) {
  const aus = []
  for (const sitzung of fs.existsSync(projekte) ? fs.readdirSync(projekte) : []) {
    const dir = path.join(projekte, sitzung, 'subagents')
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
      const { bericht, ende } = berichtAusJsonl(fs.readFileSync(path.join(dir, f), 'utf8'))
      if (!ende || new Date(ende) < seit) continue
      let typ = '?'
      try { typ = JSON.parse(fs.readFileSync(path.join(dir, f.replace('.jsonl', '.meta.json')), 'utf8')).agentType || '?' } catch { /* ohne Meta */ }
      aus.push({
        id: f.slice(0, -6),
        typ,
        datum: new Date(ende).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }),
        vorschlag: zieheZeile(bericht, 'Vorschlag'),
        veraltet: zieheZeile(bericht, 'Veraltet'),
      })
    }
  }
  return aus
}

export function ladeKorpus(wurzeln) {
  const dateien = wurzeln.flatMap((w) => (fs.statSync(w).isFile() ? [w] : sammle(w, '.md')))
  return korpusAus(dateien.map((d) => fs.readFileSync(d, 'utf8')))
}

export function lauf({ projekte, wurzeln, ausgabe, seit }) {
  const eintraege = ladeEintraege(projekte, seit)
  for (const w of wurzeln.filter((x) => !fs.existsSync(x))) console.log(`⚠ WARNUNG Vorschlags-Ledger: ${w} fehlt, Abgleich ohne diese Quelle`)
  const korpus = ladeKorpus(wurzeln.filter((w) => fs.existsSync(w)))
  const alt = fs.existsSync(ausgabe) ? fs.readFileSync(ausgabe, 'utf8') : '# Offene Agenten-Vorschläge\n\nVon `tools/vorschlags-ledger.mjs` angelegt; Zeile abhaken, wenn verankert oder verworfen.\n\n'
  const zeilen = ledgerZeilen(eintraege, korpus, alt.match(/`agent-[\w-]+`/g)?.map((s) => s.slice(1, -1)) || [])
  if (zeilen.length) fs.writeFileSync(ausgabe, `${alt.endsWith('\n') ? alt : `${alt}\n`}${zeilen.join('\n')}\n`)
  const mitVorschlag = eintraege.filter((e) => e.vorschlag).length
  console.log(`Vorschlags-Ledger: ${eintraege.length} Berichte, ${mitVorschlag} mit Vorschlag, ${zeilen.length} neu ungedeckt`)
  return zeilen.length
}

function arg(name, vorgabe) {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : vorgabe
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const home = os.homedir()
  const tage = Number(arg('--tage', '1'))
  lauf({
    projekte: arg('--projekte', path.join(home, '.claude', 'projects', 'C--code-ai-anime-kalender-de')),
    wurzeln: [
      path.join(repo, 'daniel-zum-abarbeiten', 'berichte', 'lehren.md'),
      path.join(home, '.claude', 'agents'),
      path.join(home, '.claude', 'skills'),
      path.join(home, '.claude', 'rules'),
      path.join(repo, 'docs', 'wissen'),
    ],
    ausgabe: arg('--aus', path.join(repo, 'daniel-zum-abarbeiten', 'listen', 'vorschlaege-offen.md')),
    seit: new Date(Date.now() - tage * 86400000),
  })
}
