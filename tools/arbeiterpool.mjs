/**
 * Arbeiterpool für `check-logic-alle.mjs` und `tests-alle.mjs`: startet Aufträge gleichzeitig (höchstens N),
 * puffert die Ausgabe je Auftrag und gibt sie in der Reihenfolge der Aufträge aus.
 * Ein Auftrag: `{ befehl, args, cwd, env, vorher?, nachher? }`; `nachher(ergebnis)` darf einen Fehltext liefern.
 */
import { spawn } from 'node:child_process'
import { availableParallelism } from 'node:os'

export const POOLGROESSE = Math.min(6, availableParallelism())

function starte(auftrag) {
  return new Promise((fertig) => {
    const teile = []
    const lauf = spawn(auftrag.befehl, auftrag.args, { cwd: auftrag.cwd, env: auftrag.env, stdio: ['ignore', 'pipe', 'pipe'] })
    lauf.stdout.on('data', (d) => teile.push([1, d]))
    lauf.stderr.on('data', (d) => teile.push([2, d]))
    lauf.on('error', (e) => fertig({ status: 1, teile: [[2, `${e.message}\n`]] }))
    lauf.on('close', (status) => fertig({ status: status ?? 1, teile }))
  })
}

/**
 * Führt die Aufträge aus. `anfang` = Indizes, die zuerst starten (langsame); Ausgabe immer in Auftragsreihenfolge.
 * Ohne `alle` startet nach dem ersten roten Auftrag keiner mehr. `meldung(i)` kommt vor der Ausgabe von Auftrag i.
 * Liefert `rote` (Indizes in Reihenfolge, mit Exit-Code in `status`) und die Zahl der gelaufenen Aufträge.
 */
export async function laufePool(auftraege, { alle, anfang = [], n = POOLGROESSE, meldung }) {
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
      const e = await starte(a)
      const fehler = e.status === 0 ? a.nachher?.(e) : null
      if (fehler) e.teile.push([2, `${fehler}\n`])
      e.rot = e.status !== 0 || Boolean(fehler)
      if (e.rot && e.status === 0) e.status = 1
      ergebnisse[i] = e
      if (e.rot && !alle) abgebrochen = true
      ausgeben()
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, auftraege.length) }, arbeiter))
  ausgeben()
  for (const i of auftraege.keys()) if (ergebnisse[i] && i >= ausgegeben) gib(i)
  const rote = [...auftraege.keys()].filter((i) => ergebnisse[i]?.rot).map((i) => ({ index: i, status: ergebnisse[i].status }))
  return { rote, gelaufen: ergebnisse.filter(Boolean).length }
}
