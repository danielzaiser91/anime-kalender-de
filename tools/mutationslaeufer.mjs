#!/usr/bin/env node
/**
 * Mutationsläufer: je Mutant eine oder mehrere Textänderungen (auch in mehreren Dateien) einspielen,
 * Testbefehl(e) laufen lassen, Dateien aus der Kopie zurücksetzen. Rot = entdeckt, GRÜN = überlebt.
 *
 * Aufruf: node tools/mutationslaeufer.mjs <mutanten.json> --test "<befehl>" [--test "<befehl>" …]
 *           [--cwd <ordner>] [--timeout <sek>] [--log <ordner>]
 * Mutanten (JSON-Liste), Dateipfade relativ zu --cwd, Windows-, Git-Bash- (/c/…) und Slash-Pfade:
 *   { "name": "…", "aenderungen": [{ "datei": "a.ts", "suche": "…", "ersetze": "…", "nr": 2, "zeile": 14 }],
 *     "tests": ["…"] }      // tests je Mutant überschreibt --test
 *   { "datei": "a.ts", "suche": "…", "ersetze": "…" }   // Kurzform mit einer Änderung
 *   { "name": "Kontrolle", "aenderungen": [] }          // unmutierter Kontrollmutant, muss grün bleiben
 * suche darf mehrzeilig sein (\n); kommt sie mehrfach vor, wählt nr (n-tes Vorkommen, ab 1) und/oder zeile
 * (Vorkommen auf dieser Zeile) aus, sonst gilt der Mutant als mehrdeutig. suche "@ENDE" hängt ersetze an.
 * Mehrere Änderungen einer Datei beziehen sich alle auf das Original (kein Verschieben der Anker).
 * Sicherung: Kopie `<datei>.mutlauf-orig` neben jeder berührten Datei, Rückspiel bytegleich nach jedem
 * Mutanten, bei Abbruch (Signal) und beim Ende; Rest eines toten Laufs verweigert den Start.
 * Vor dem Testlauf druckt der Läufer je Mutant `@@ Datei:Zeile` mit `-`/`+`-Zeilen; ändert die Änderung den Text nicht
 * (suche == ersetze), gilt der Mutant als „wirkungslos“ (unbrauchbar, Exit 1) und die Tests laufen nicht.
 * Exit 0 alle rot (Kontrollen grün), 1 Überlebende/unbrauchbare, 2 Aufruf/Grundlauf rot/Rückspiel kaputt.
 */
import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join, resolve, win32 } from "node:path"
import { pathToFileURL } from "node:url"

export function normalisierePfad(pfad, cwd, plattform = process.platform) {
  const bash = /^\/([a-zA-Z])(\/.*)?$/.exec(pfad)
  // Ein Laufwerkspfad ist nur für win32 aufzulösen; alles andere folgt der Plattform des Aufrufers.
  if (plattform === "win32" && bash) return win32.resolve(cwd, `${bash[1].toUpperCase()}:${bash[2] ?? "/"}`)
  return resolve(cwd, pfad)
}

function alleVorkommen(text, suche) {
  const treffer = []
  for (let i = text.indexOf(suche); i >= 0; i = text.indexOf(suche, i + suche.length)) treffer.push(i)
  return treffer
}

export function zeileVon(text, index) {
  return text.slice(0, index).split("\n").length
}

// Ein Anker im Originaltext: { index, laenge, ersetze } oder { fehler }.
export function findeStelle(text, a) {
  const crlf = text.includes("\r\n")
  const passe = (s) => (crlf && !s.includes("\r\n") ? s.replace(/\n/g, "\r\n") : s)
  const ersetze = passe(a.ersetze)
  if (a.suche === "@ENDE") {
    const nl = crlf ? "\r\n" : "\n"
    return { index: text.length, laenge: 0, ersetze: (text.endsWith("\n") ? "" : nl) + ersetze + nl }
  }
  const suche = passe(a.suche)
  let treffer = alleVorkommen(text, suche)
  if (treffer.length === 0) return { fehler: "nicht gefunden" }
  if (a.zeile !== undefined) {
    treffer = treffer.filter((i) => zeileVon(text, i) === a.zeile)
    if (treffer.length === 0) return { fehler: `nicht gefunden auf Zeile ${a.zeile}` }
  }
  if (a.nr === undefined && treffer.length > 1) return { fehler: `mehrdeutig (${treffer.length}-mal)` }
  const index = treffer[(a.nr ?? 1) - 1]
  if (index === undefined) return { fehler: `Vorkommen ${a.nr} fehlt (nur ${treffer.length})` }
  return { index, laenge: suche.length, ersetze }
}

export function normalisiereListe(liste) {
  if (!Array.isArray(liste)) throw new Error("Mutantenliste muss ein JSON-Array sein")
  return liste.map((m, i) => {
    const aenderungen = m.aenderungen ?? [{ datei: m.datei, suche: m.suche, ersetze: m.ersetze, nr: m.nr, zeile: m.zeile }]
    for (const a of aenderungen) {
      const ok = typeof a.datei === "string" && typeof a.suche === "string" && a.suche !== "" && typeof a.ersetze === "string"
      if (!ok) throw new Error(`Mutant ${i + 1}: datei/suche/ersetze fehlen oder sind leer: ${JSON.stringify(a)}`)
    }
    return { name: m.name ?? `m${i + 1}`, aenderungen, tests: m.tests }
  })
}

// Plan eines Mutanten gegen die Originaltexte: { texte: Map<pfad,text>, diff } oder { urteil, detail }.
export function planeMutant(m, originale, cwd) {
  const jeDatei = new Map()
  const diff = []
  for (const a of m.aenderungen) {
    const pfad = normalisierePfad(a.datei, cwd)
    const orig = originale.get(pfad).toString("utf8")
    const s = findeStelle(orig, a)
    if (s.fehler) return { urteil: s.fehler.startsWith("mehrdeutig") ? "mehrdeutig" : "nicht gefunden", detail: `${a.datei}: ${s.fehler}` }
    if (!jeDatei.has(pfad)) jeDatei.set(pfad, [])
    jeDatei.get(pfad).push(s)
    const alt = orig.slice(s.index, s.index + s.laenge)
    diff.push(`@@ ${a.datei}:${zeileVon(orig, s.index)}`, ...alt.split("\n").map((z) => `- ${z}`), ...s.ersetze.split("\n").map((z) => `+ ${z}`))
  }
  const texte = new Map()
  for (const [pfad, stellen] of jeDatei) {
    let text = originale.get(pfad).toString("utf8")
    stellen.sort((x, y) => y.index - x.index)
    for (let i = 1; i < stellen.length; i++) {
      if (stellen[i].index + stellen[i].laenge > stellen[i - 1].index) return { urteil: "nicht gefunden", detail: "Änderungen überlappen" }
    }
    for (const s of stellen) text = text.slice(0, s.index) + s.ersetze + text.slice(s.index + s.laenge)
    texte.set(pfad, text)
  }
  const gleich = [...texte].every(([pfad, t]) => t === originale.get(pfad).toString("utf8"))
  if (m.aenderungen.length > 0 && gleich) return { urteil: "wirkungslos", detail: "Text nach der Änderung unverändert", diff }
  return { texte, diff }
}

// Laufende Testprozesse: ein Signal an den Läufer beendet sie vor dem Zurückspielen.
const laufendeKinder = new Set()

function beendeBaum(kind) {
  if (process.platform !== "win32") {
    try {
      process.kill(-kind.pid, "SIGKILL")
    } catch {
      kind.kill("SIGKILL")
    }
    return
  }
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(kind.pid)], { stdio: "ignore", windowsHide: true })
  } catch {
    // Prozess war schon weg
  }
}

export function laufTest(befehl, cwd, timeoutSek) {
  return new Promise((fertig) => {
    let ausgabe = ""
    const kind = spawn(befehl, { cwd, shell: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"], windowsHide: true })
    const sammle = (d) => {
      ausgabe = (ausgabe + d).slice(-4000)
    }
    laufendeKinder.add(kind)
    kind.stdout.on("data", sammle)
    kind.stderr.on("data", sammle)
    let abgelaufen = false
    const uhr = setTimeout(() => {
      abgelaufen = true
      beendeBaum(kind)
    }, timeoutSek * 1000)
    kind.on("close", (code) => {
      laufendeKinder.delete(kind)
      clearTimeout(uhr)
      fertig({ gruen: !abgelaufen && code === 0, abgelaufen, code, ausgabe })
    })
    kind.on("error", (e) => {
      laufendeKinder.delete(kind)
      clearTimeout(uhr)
      fertig({ gruen: false, abgelaufen: false, code: -1, ausgabe: String(e) })
    })
  })
}

// Tests der Reihe nach, beim ersten roten Schluss: { urteil, fangend, ausgabe }.
export async function probiereTests(tests, cwd, timeout) {
  for (const t of tests) {
    const r = await laufTest(t, cwd, timeout)
    if (!r.gruen) return { urteil: "rot", fangend: t, detail: r.abgelaufen ? "Zeitlimit" : `Exit ${r.code}`, ausgabe: r.ausgabe }
  }
  return { urteil: "GRÜN", fangend: "", detail: "alle Tests grün", ausgabe: "" }
}

function parseArgs(argv) {
  const opt = { tests: [], timeout: 300, cwd: process.cwd(), log: "", liste: "" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--test") opt.tests.push(argv[++i] ?? "")
    else if (a === "--cwd") opt.cwd = resolve(argv[++i] ?? ".")
    else if (a === "--timeout") opt.timeout = Number(argv[++i])
    else if (a === "--log") opt.log = resolve(argv[++i] ?? ".")
    else opt.liste = a
  }
  return opt
}

const kuerze = (s, n) => s.replace(/\s+/g, " ").replace(/\|/g, "\\|").slice(0, n)

export function tabelle(zeilen) {
  const kopf = ["| Nr | Mutant | Dateien | Urteil | fangender Test |", "|---|---|---|---|---|"]
  const rest = zeilen.map((z, i) => {
    const dateien = [...new Set(z.m.aenderungen.map((a) => a.datei))].join(", ") || "-"
    return `| ${i + 1} | ${kuerze(z.m.name, 60)} | ${dateien} | ${z.urteil}${z.detail ? ` (${kuerze(z.detail, 40)})` : ""} | ${kuerze(z.fangend ?? "", 60)} |`
  })
  return [...kopf, ...rest].join("\n")
}

function schreibeLog(ordner, nr, z) {
  const slug = `${String(nr).padStart(2, "0")}-${z.m.name.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40)}`
  writeFileSync(join(ordner, `${slug}.diff`), `${(z.diff ?? []).join("\n")}\n`)
  writeFileSync(join(ordner, `${slug}.log`), `${z.urteil} ${z.detail ?? ""}\nTest: ${z.fangend ?? ""}\n${z.ausgabe ?? ""}\n`)
}

// Urteil des Gesamtlaufs: Anzahl der Mutanten, die nicht wie erwartet ausgehen.
function bewerte(zeilen) {
  return zeilen.filter((z) => (z.kontrolle ? z.urteil !== "GRÜN" : z.urteil !== "rot")).length
}

async function lauf(opt, mutanten, originale) {
  const grund = new Set(mutanten.flatMap((m) => m.tests ?? opt.tests))
  for (const t of grund) {
    const r = await laufTest(t, opt.cwd, opt.timeout)
    if (!r.gruen) {
      console.error(`Grundlauf ohne Mutation ist rot (Exit ${r.code}): ${t}\n${r.ausgabe}`)
      return null
    }
  }
  const zeilen = []
  for (const m of mutanten) {
    const plan = planeMutant(m, originale, opt.cwd)
    let z = { m, kontrolle: m.aenderungen.length === 0, ...plan }
    if (plan.diff) console.log(`--- ${m.name}\n${plan.diff.join("\n")}`)
    if (plan.texte) {
      for (const [pfad, text] of plan.texte) writeFileSync(pfad, text)
      z = { ...z, ...(await probiereTests(m.tests ?? opt.tests, opt.cwd, opt.timeout)) }
      for (const [pfad, bytes] of originale) writeFileSync(pfad, bytes)
    }
    zeilen.push(z)
    if (opt.log) schreibeLog(opt.log, zeilen.length, z)
    console.log(`${z.urteil.padEnd(14)} ${m.name} ${z.detail ? `(${z.detail})` : ""}`)
  }
  return zeilen
}

export const SIGNALE = ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]

// Signal: erst Testprozesse beenden, dann Dateien zurückspielen, dann Exit 130.
export function beiSignal({ kinder, beendeBaum: beende, zuruecksetzen, exit }) {
  for (const kind of kinder) beende(kind)
  zuruecksetzen()
  exit(130)
}

export function registriereSignale(proc, abhaengigkeiten) {
  for (const sig of SIGNALE) proc.on(sig, () => beiSignal(abhaengigkeiten))
}

export async function main(argv) {
  const opt = parseArgs(argv)
  if (!opt.liste || !(opt.timeout > 0)) {
    console.error('Aufruf: mutationslaeufer.mjs <mutanten.json> --test "<befehl>" [--test …] [--cwd <ordner>] [--timeout <sek>] [--log <ordner>]')
    return 2
  }
  const mutanten = normalisiereListe(JSON.parse(readFileSync(normalisierePfad(opt.liste, process.cwd(), process.platform), "utf8").replace(/^﻿/, "")))
  if (mutanten.some((m) => (m.tests ?? opt.tests).length === 0)) {
    console.error("Kein Testbefehl: --test oder tests je Mutant angeben")
    return 2
  }
  const originale = new Map()
  for (const m of mutanten) {
    for (const a of m.aenderungen) {
      const pfad = normalisierePfad(a.datei, opt.cwd)
      if (!existsSync(pfad)) throw new Error(`Datei fehlt: ${pfad}`)
      if (existsSync(`${pfad}.mutlauf-orig`)) throw new Error(`Rest eines abgebrochenen Laufs: ${pfad}.mutlauf-orig (Inhalt ist das Original: zurückspielen, löschen)`)
      originale.set(pfad, readFileSync(pfad))
    }
  }
  if (opt.log) mkdirSync(opt.log, { recursive: true })
  for (const [pfad, bytes] of originale) writeFileSync(`${pfad}.mutlauf-orig`, bytes)
  const zuruecksetzen = () => {
    for (const [pfad, bytes] of originale) {
      writeFileSync(pfad, bytes)
      if (existsSync(`${pfad}.mutlauf-orig`)) unlinkSync(`${pfad}.mutlauf-orig`)
    }
  }
  registriereSignale(process, { kinder: laufendeKinder, beendeBaum, zuruecksetzen, exit: (code) => process.exit(code) })
  try {
    const zeilen = await lauf(opt, mutanten, originale)
    if (!zeilen) return 2
    const md = tabelle(zeilen)
    if (opt.log) writeFileSync(join(opt.log, "tabelle.md"), `${md}\n`)
    console.log(`\n${md}`)
    const schlecht = bewerte(zeilen)
    console.log(`\nmutationslaeufer: ${zeilen.filter((z) => z.urteil === "rot").length} rot, ${schlecht} nicht wie erwartet, ${zeilen.length} gesamt`)
    return schlecht > 0 ? 1 : 0
  } finally {
    zuruecksetzen()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e.message ?? e)
      process.exit(2)
    },
  )
}
