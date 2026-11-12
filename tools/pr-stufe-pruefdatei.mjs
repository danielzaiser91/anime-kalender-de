/**
 * Prüfdatei-Erkennung für tools/pr-stufe.mjs: pipeline/check-*.ts ist ein Wächter, kein Produktivcode.
 * Ändert ein PR nur sie (und Tests), genügt Stufe 1 statt 2 — solange kein Produktivcode sie importiert.
 * Produktivcode = jede Quelle außer check-*-Dateien und Tests (pipeline/bau, pipeline/lib, shared, web, worker, tools, …).
 * Ein Import über eine andere Prüfdatei zählt mit (Fixpunkt): importiert Produktivcode check-a und check-a die check-b, ist auch check-b Stufe 2.
 * Im Zweifel (keine Kette gelesen) bleibt es Stufe 2.
 */
const PRUEFDATEI = /^pipeline\/check-((?![^/]*\.(?:test|spec)\.)[^/]+)\.ts$/
const QUELLE_MIT_IMPORT = /\.(mjs|cjs|js|ts|tsx)$/
const TEST = /\.(test|spec)\./

const istCheck = (pfad) => /(^|\/)check-[^/]+\.[cm]?[jt]sx?$/.test(pfad)

// Import-Angabe (import/from/require/dynamischer Import) mit Ziel .../check-<stamm>[.ts]; Erwähnung in Kommentar oder Text zählt nicht.
const IMPORT_AUF_CHECK = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"][^'"\n]*\/check-([^'"\n/]+?)(?:\.[cm]?[jt]sx?)?['"]/g

const stammCache = new WeakMap()

/** Namen (ohne check-/.ts) aller Prüfdateien, die Produktivcode erreicht, auch über andere Prüfdateien. */
function erreichteStaemme(kette) {
  if (stammCache.has(kette)) return stammCache.get(kette)
  const quellen = kette.quellen.filter((q) => QUELLE_MIT_IMPORT.test(q.pfad))
  const ziele = (q) => new Set([...q.text.matchAll(IMPORT_AUF_CHECK)].map((m) => m[1]))
  const pruefer = new Map(quellen.filter((q) => PRUEFDATEI.test(q.pfad)).map((q) => [PRUEFDATEI.exec(q.pfad)[1], ziele(q)]))
  const erreicht = new Set()
  const offen = []
  const vormerken = (staemme) => {
    for (const s of staemme) {
      if (erreicht.has(s)) continue
      erreicht.add(s)
      offen.push(s)
    }
  }
  for (const q of quellen) if (!istCheck(q.pfad) && !TEST.test(q.pfad)) vormerken(ziele(q))
  // Fixpunkt: was eine erreichte Prüfdatei importiert, ist ebenfalls erreicht.
  while (offen.length) vormerken(pruefer.get(offen.pop()) ?? [])
  stammCache.set(kette, erreicht)
  return erreicht
}

/** true, wenn `pfad` eine pipeline/check-*.ts ist, die kein Produktivcode importiert (auch nicht über Prüfdateien). */
export function istPruefdatei(pfad, kette) {
  const m = PRUEFDATEI.exec(pfad)
  if (!m || !kette) return false
  return !erreichteStaemme(kette).has(m[1])
}
