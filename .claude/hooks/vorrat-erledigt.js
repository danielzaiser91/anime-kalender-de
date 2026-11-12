// Benennt Vorrat-Dateien gemergter PRs von `z-wartet-merge-<N>-…` / `vergeben-…` in `erledigt-…` um und zieht die Links
// in stand.md nach (sonst melden die Hooks tote Links). Gemergt zählt nur, was in `gemergt` steht: ein geschlossener PR
// ohne Merge bleibt, ebenso eine `vergeben-`-Datei, die einen noch offenen oder geschlossenen PR unter ihren Links hat.
const fs = require('node:fs')
const path = require('node:path')

const WARTET = /^z-wartet-merge-(\d+)-(.+\.md)$/
const VERGEBEN = /^vergeben-(.+\.md)$/
const PR_LINK = /\/pull\/(\d+)/g

/** Neuer Name oder null: ohne PR-Bezug (vergeben- ohne Link) oder solange ein PR der Datei nicht gemergt ist. */
function neuerName(name, text, gemergt) {
  const w = WARTET.exec(name)
  if (w) return gemergt.has(Number(w[1])) ? `erledigt-${w[1]}-${w[2]}` : null
  const v = VERGEBEN.exec(name)
  if (!v) return null
  const nummern = [...text.matchAll(PR_LINK)].map((m) => Number(m[1]))
  return nummern.length && nummern.every((n) => gemergt.has(n)) ? `erledigt-${v[1]}` : null
}

/**
 * Benennt um (nie über eine vorhandene Zieldatei) und liefert { text, zeilen }: stand.md-Text mit nachgezogenen
 * Links `vorrat/<alt>` → `vorrat/<neu>`, dazu eine Meldungszeile je Umbenennung. Fehlt der Ordner: nichts zu tun.
 */
function vorratErledigt({ ordner, text, gemergt }) {
  let namen = []
  try {
    namen = fs.readdirSync(ordner)
  } catch {
    return { text, zeilen: [] }
  }
  const zeilen = []
  let neu = text
  for (const name of namen.sort()) {
    const inhalt = VERGEBEN.test(name) ? fs.readFileSync(path.join(ordner, name), 'utf8') : ''
    const ziel = neuerName(name, inhalt, gemergt)
    if (!ziel || fs.existsSync(path.join(ordner, ziel))) continue
    fs.renameSync(path.join(ordner, name), path.join(ordner, ziel))
    neu = neu.split(`vorrat/${name}`).join(`vorrat/${ziel}`)
    zeilen.push(`Vorrat: ${name} → ${ziel}`)
  }
  return { text: neu, zeilen }
}

module.exports = { neuerName, vorratErledigt }
