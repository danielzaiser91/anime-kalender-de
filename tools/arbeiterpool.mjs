/**
 * Arbeiterpool für `check-logic-alle.mjs` und `tests-alle.mjs`: startet Aufträge gleichzeitig (höchstens N),
 * puffert die Ausgabe je Auftrag und gibt sie in der Reihenfolge der Aufträge aus.
 * Ein Auftrag: `{ befehl, args, cwd, env, vorher?, nachher? }`; `nachher(ergebnis)` darf einen Fehltext liefern.
 */
import { spawn, spawnSync } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { gitStand, veraenderte } from './git-stand-wache.mjs'

export const POOLGROESSE = Math.min(6, availableParallelism())

/** Die letzten `n` nicht leeren Zeilen der gepufferten Ausgabe (beide Kanäle in Ausgabereihenfolge). */
export function letzteZeilen(teile, n = 8) {
  const zeilen = teile.map(([, d]) => String(d)).join('').split('\n').map((z) => z.trimEnd()).filter(Boolean)
  return zeilen.slice(-n)
}

/** Die `n` langsamsten Aufträge als Zeilen „<Sekunden> s  <Name>“ (längste zuerst) samt Summe aller Laufzeiten; `sekunden[i]` gehört zu `namen[i]`, ungelaufene fehlen. */
export function dauerZeilen(namen, sekunden, n = 25) {
  const gelaufen = namen.map((name, i) => ({ name, s: sekunden[i] })).filter((a) => typeof a.s === 'number')
  const summe = gelaufen.reduce((s, a) => s + a.s, 0)
  const spitze = gelaufen.sort((a, b) => b.s - a.s).slice(0, n)
  return [...spitze.map((a) => `${a.s.toFixed(1).padStart(7)} s  ${a.name}`), `${summe.toFixed(1).padStart(7)} s  Summe aller ${gelaufen.length} Prüfungen`]
}

// Frist je Auftrag. Gemessen 03.11.2026: langsamste Prüfung in check:logic (CI-Lauf 41693405921) 26,1 s,
// langsamster Test lokal unter Windows (`quellen-pr-pruefung.test.mjs`) 146,7 s; 600 s = gut das Vierfache davon.
// Ein Hänger endet so nach 10 min statt am Job-Timeout von 30 min.
export const FRIST_S = 600

/** Argumente für `taskkill`: `/T` nimmt die Kindprozesse mit. */
export const taskkillArgs = (pid) => ['/T', '/F', '/PID', String(pid)]

/** Beendet den Prozess samt Kindern: Linux Prozessgruppe (Auftrag läuft als Gruppenführer), Windows `taskkill /T`. */
export function beendeBaum(pid, { plattform = process.platform, gruppe = (p) => process.kill(-p, 'SIGKILL'), taskkill = (p) => spawnSync('taskkill', taskkillArgs(p), { windowsHide: true, stdio: 'ignore', timeout: 15_000 }) } = {}) {
  try {
    if (plattform === 'win32') taskkill(pid)
    else gruppe(pid)
  } catch {
    // Prozess war schon weg.
  }
}

function starte(auftrag, fristS) {
  return new Promise((fertig) => {
    const beginn = performance.now()
    const teile = []
    let ueberschritten = false
    const lauf = spawn(auftrag.befehl, auftrag.args, { cwd: auftrag.cwd, env: auftrag.env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' })
    const frist = setTimeout(() => {
      ueberschritten = true
      beendeBaum(lauf.pid)
    }, fristS * 1000)
    lauf.stdout.on('data', (d) => teile.push([1, d]))
    lauf.stderr.on('data', (d) => teile.push([2, d]))
    lauf.on('error', (e) => {
      clearTimeout(frist)
      fertig({ status: 1, teile: [[2, `${e.message}\n`]] })
    })
    // Ein Signal (OOM-Killer, Zeitlimit) hinterlässt sonst eine rote Prüfung ganz ohne Fehlerzeile.
    lauf.on('close', (status, signal) => {
      clearTimeout(frist)
      if (ueberschritten) teile.push([2, `Frist ${fristS} s überschritten, Prozess samt Kindern beendet.\n`])
      else if (signal) teile.push([2, `Prozess durch Signal ${signal} beendet (kein Exit-Code).\n`])
      fertig({ status: ueberschritten ? 1 : (status ?? 1), teile, sekunden: (performance.now() - beginn) / 1000 })
    })
  })
}

/**
 * Führt die Aufträge aus. `anfang` = Indizes, die zuerst starten (langsame); Ausgabe immer in Auftragsreihenfolge.
 * Ohne `alle` startet nach dem ersten roten Auftrag keiner mehr. `meldung(i)` kommt vor der Ausgabe von Auftrag i.
 * Mit `wurzel` (Git-Arbeitsbaum) wird nach dem Lauf geprüft, ob getrackte Dateien verändert wurden (`veraendert`).
 * Jeder Auftrag hat `fristS` Sekunden (Standard `FRIST_S`), danach wird er samt Kindern beendet und ist rot.
 * Liefert `rote` (Indizes in Reihenfolge, mit Exit-Code in `status` und den letzten Ausgabezeilen in `ende`), die Zahl der gelaufenen Aufträge und `veraendert`.
 */
export async function laufePool(auftraege, { alle, anfang = [], n = POOLGROESSE, meldung, wurzel, fristS = FRIST_S }) {
  const reihe = [...anfang, ...auftraege.keys()].filter((v, i, a) => a.indexOf(v) === i)
  const ergebnisse = new Array(auftraege.length)
  let naechster = 0
  let abgebrochen = false
  let ausgegeben = 0
  const gib = (i) => {
    meldung(i)
    for (const [kanal, d] of ergebnisse[i].teile) (kanal === 1 ? process.stdout : process.stderr).write(d)
  }
  const ausgeben = () => {
    while (ausgegeben < auftraege.length && ergebnisse[ausgegeben]) gib(ausgegeben++)
  }
  const arbeiter = async () => {
    while (!abgebrochen && naechster < reihe.length) {
      const i = reihe[naechster++]
      const a = auftraege[i]
      a.vorher?.()
      const e = await starte(a, fristS)
      const fehler = e.status === 0 ? a.nachher?.(e) : null
      if (fehler) e.teile.push([2, `${fehler}\n`])
      e.rot = e.status !== 0 || Boolean(fehler)
      if (e.rot && e.status === 0) e.status = 1
      ergebnisse[i] = e
      if (e.rot && !alle) abgebrochen = true
      ausgeben()
    }
  }
  const standVorher = wurzel ? gitStand(wurzel) : null
  await Promise.all(Array.from({ length: Math.min(n, auftraege.length) }, arbeiter))
  ausgeben()
  for (const i of auftraege.keys()) if (ergebnisse[i] && i >= ausgegeben) gib(i)
  const rote = [...auftraege.keys()].filter((i) => ergebnisse[i]?.rot).map((i) => ({ index: i, status: ergebnisse[i].status, ende: letzteZeilen(ergebnisse[i].teile) }))
  const veraendert = wurzel ? veraenderte(standVorher, gitStand(wurzel)) : []
  if (veraendert.length) console.error(`Der Lauf hat getrackte Dateien verändert (eine Prüfung schreibt ins Repo): ${veraendert.join(', ')}`)
  return { rote, gelaufen: ergebnisse.filter(Boolean).length, veraendert, sekunden: auftraege.map((_, i) => ergebnisse[i]?.sekunden) }
}
