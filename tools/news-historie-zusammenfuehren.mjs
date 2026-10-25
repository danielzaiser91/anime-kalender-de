#!/usr/bin/env node
/**
 * Dreiwege-Zusammenführung der News-Historie für einen Merge-Konflikt: überträgt, was der PR gegenüber der
 * Merge-Basis geändert hat, auf den main-Stand. Die Datei ist einzeilig, git sieht darum jede Änderung als Konflikt.
 *
 * Aufruf: node tools/news-historie-zusammenfuehren.mjs <basis> <pr> <main> <ziel>
 * (die drei Stände vorher per `git show <merge-base>:<pfad>`, `HEAD:<pfad>`, `origin/main:<pfad>` in Dateien legen).
 * Jeder Schlüssel der obersten Ebene ist eine Zuordnung Id -> Wert; Objekte werden Feld für Feld verglichen, alles andere
 * (Zahl, Text, Liste) als Ganzes. Haben PR und main dasselbe Feld verschieden geändert, bricht das Werkzeug ab (Exit 1).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const istObjekt = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Drei Werte -> Ergebnis; undefined heißt „fehlt“. Wirft bei Widerspruch. */
function mische(basis, pr, haupt, pfad) {
  if (gleich(pr, basis)) return haupt
  if (gleich(haupt, basis) || gleich(haupt, pr)) return pr
  if (istObjekt(pr) && istObjekt(haupt)) {
    const b = istObjekt(basis) ? basis : {}
    const aus = {}
    for (const k of new Set([...Object.keys(haupt), ...Object.keys(pr)])) {
      const v = mische(b[k], pr[k], haupt[k], `${pfad}/${k}`)
      if (v !== undefined) aus[k] = v
    }
    return aus
  }
  throw new Error(`Widerspruch bei ${pfad}: PR und main ändern es verschieden`)
}

function mischeKarte(basis, pr, haupt, schluessel) {
  const karte = { ...(haupt ?? {}) }
  let n = 0
  for (const id of new Set([...Object.keys(basis ?? {}), ...Object.keys(pr ?? {})])) {
    if (gleich(pr?.[id], basis?.[id])) continue
    const v = mische(basis?.[id], pr?.[id], haupt?.[id], `${schluessel}/${id}`)
    if (gleich(v, haupt?.[id])) continue
    if (v === undefined) delete karte[id]
    else karte[id] = v
    n++
  }
  return { karte, n }
}

/** Gibt { ergebnis, uebernommen: { schluessel: Zahl } } zurück. */
export function fuehreZusammen(basis, pr, haupt) {
  const ergebnis = { ...haupt }
  // Ein Schlüssel, der in PR und main fehlt, bleibt weg (auch wenn die Basis ihn kannte).
  const uebernommen = {}
  for (const schluessel of new Set([...Object.keys(basis), ...Object.keys(pr), ...Object.keys(haupt)])) {
    const [b, p, h] = [basis[schluessel], pr[schluessel], haupt[schluessel]]
    if (p === undefined && h === undefined) continue
    if (istObjekt(b) || istObjekt(p) || istObjekt(h)) {
      const { karte, n } = mischeKarte(b, p, h, schluessel)
      ergebnis[schluessel] = karte
      uebernommen[schluessel] = n
      continue
    }
    const v = mische(b, p, h, schluessel)
    if (v === undefined) delete ergebnis[schluessel]
    else ergebnis[schluessel] = v
    uebernommen[schluessel] = gleich(v, h) ? 0 : 1
  }
  return { ergebnis, uebernommen }
}

export function main(argv) {
  const [basis, pr, haupt, ziel] = argv
  if (!ziel) {
    console.error('Aufruf: news-historie-zusammenfuehren.mjs <basis> <pr> <main> <ziel>')
    return 2
  }
  const [B, P] = [basis, pr].map((p) => JSON.parse(readFileSync(p, 'utf8')))
  const roh = readFileSync(haupt, 'utf8')
  let r
  try {
    r = fuehreZusammen(B, P, JSON.parse(roh))
  } catch (e) {
    console.error(`news-historie-zusammenfuehren: ${e.message}`)
    return 1
  }
  writeFileSync(ziel, JSON.stringify(r.ergebnis) + (roh.endsWith('\n') ? '\n' : ''))
  for (const [k, n] of Object.entries(r.uebernommen)) console.log(`übernommen ${k}: ${n}`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)))
