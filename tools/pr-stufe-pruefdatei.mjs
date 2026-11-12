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

const maskiere = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const istCheck = (pfad) => /(^|\/)check-[^/]+\.[cm]?[jt]sx?$/.test(pfad)

function importiert(text, stamm) {
  const spez = `['"][^'"\\n]*/check-${maskiere(stamm)}(?:\\.[cm]?[jt]sx?)?['"]`
  return new RegExp(`(?:\\bfrom|\\bimport|\\brequire)\\s*\\(?\\s*${spez}`).test(text)
}

/** Namen (ohne check-/.ts) aller Prüfdateien, die Produktivcode erreicht, auch über andere Prüfdateien. */
function erreichteStaemme(kette) {
  const quellen = kette.quellen.filter((q) => QUELLE_MIT_IMPORT.test(q.pfad))
  const pruefer = quellen.filter((q) => PRUEFDATEI.test(q.pfad))
  const produktiv = quellen.filter((q) => !istCheck(q.pfad) && !TEST.test(q.pfad))
  const erreicht = new Set()
  let quellenVonHier = produktiv
  for (let neu = true; neu; ) {
    neu = false
    for (const p of pruefer) {
      const stamm = PRUEFDATEI.exec(p.pfad)[1]
      if (!erreicht.has(stamm) && quellenVonHier.some((q) => importiert(q.text, stamm))) {
        erreicht.add(stamm)
        quellenVonHier = [...quellenVonHier, p]
        neu = true
      }
    }
  }
  return erreicht
}

/** true, wenn `pfad` eine pipeline/check-*.ts ist, die kein Produktivcode importiert (auch nicht über Prüfdateien). */
export function istPruefdatei(pfad, kette) {
  const m = PRUEFDATEI.exec(pfad)
  if (!m || !kette) return false
  return !erreichteStaemme(kette).has(m[1])
}
