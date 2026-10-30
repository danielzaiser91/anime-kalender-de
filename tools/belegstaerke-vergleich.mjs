/**
 * Belegstärke (`dubConfidence`) je Titel für zwei Git-Stände vergleichen, am committeten `public/data/titles.json`
 * (kein Bau). Aufruf: `node tools/belegstaerke-vergleich.mjs [alt] [neu]` (Standard: origin/main gegen HEAD).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const STUFEN = ['very-high', 'high', 'normal', 'low']
const FEHLT = 'fehlt'

const name = (t) => [t.titleDe, t.titleEn, t.titleRomaji].find((n) => typeof n === 'string' && n !== '')

function summiere(liste) {
  const s = Object.fromEntries([...STUFEN, FEHLT].map((k) => [k, 0]))
  for (const t of liste) s[STUFEN.includes(t.dubConfidence) ? t.dubConfidence : FEHLT]++
  return s
}

/** Summen je Stufe plus die Titel, deren Stufe sich ändert (neu/entfallen als „fehlt“). */
export function vergleicheStaerke(alt, neu) {
  const a = new Map(alt.map((t) => [t.id, t]))
  const b = new Map(neu.map((t) => [t.id, t]))
  const aenderungen = []
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const von = a.get(id)?.dubConfidence ?? FEHLT
    const nach = b.get(id)?.dubConfidence ?? FEHLT
    if (von !== nach) aenderungen.push({ id, name: name(b.get(id) ?? a.get(id)), von, nach })
  }
  return { alt: summiere(alt), neu: summiere(neu), aenderungen }
}

export function formatiere(e) {
  const zeilen = ['Stufe      vorher  nachher']
  for (const k of [...STUFEN, FEHLT]) {
    if (k === FEHLT && e.alt[k] === 0 && e.neu[k] === 0) continue
    zeilen.push(`${k.padEnd(10)} ${String(e.alt[k]).padStart(6)}  ${String(e.neu[k]).padStart(7)}`)
  }
  zeilen.push(`${e.aenderungen.length} Titel geändert`)
  for (const c of e.aenderungen) zeilen.push(`${c.id}${c.name ? ` (${c.name})` : ''}: ${c.von} → ${c.nach}`)
  return zeilen.join('\n')
}

function ladeStand(ref) {
  const roh = execFileSync('git', ['show', `${ref}:public/data/titles.json`], { encoding: 'utf8', maxBuffer: 1 << 30, windowsHide: true })
  return JSON.parse(roh)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [alt = 'origin/main', neu = 'HEAD'] = process.argv.slice(2)
  console.log(`Belegstärke ${alt} → ${neu}`)
  console.log(formatiere(vergleicheStaerke(ladeStand(alt), ladeStand(neu))))
}
