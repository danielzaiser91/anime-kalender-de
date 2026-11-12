// Benennt Vorrat-Dateien gemergter PRs von `z-wartet-merge-<N>-…` / `vergeben-…` in `erledigt-…` um und zieht die Links
// in stand.md nach (sonst melden die Hooks tote Links). `istGemergt(n)` entscheidet je PR (stand-prs.js: Liste der letzten
// 24 h, sonst gezielte Abfrage); ein geschlossener PR ohne Merge bleibt, ebenso eine `vergeben-`-Datei mit einem noch
// offenen PR unter ihren Vergeben-Links. Bei `vergeben-` zählen nur Links in Zeilen `**Vergeben:** …` (so schreibt der
// Dirigent den eigenen PR dorthin); Links in „Vorab geprüft“ o. Ä. sind Verweise auf Fremd-PRs und zählen nicht,
// sonst wäre die Datei beim ersten schon gemergten Verweis „erledigt“. Ohne Vergeben-Zeile bleibt die Datei.
const fs = require('node:fs')
const path = require('node:path')

const WARTET = /^z-wartet-merge-(\d+)-(.+\.md)$/
const VERGEBEN = /^vergeben-(.+\.md)$/
const ERLEDIGT_WARTET = /^erledigt-(\d+)-(.+\.md)$/
const VERGEBEN_ZEILE = /^\*\*Vergeben:\*\*.*$/gm
const PR_LINK = /\/pull\/(\d+)/g

function vergebenNummern(text) {
  return (text.match(VERGEBEN_ZEILE) ?? []).flatMap((z) => [...z.matchAll(PR_LINK)].map((m) => Number(m[1])))
}

/** Neuer Name oder null: ohne PR-Bezug oder solange ein PR der Datei nicht gemergt ist. */
function neuerName(name, text, istGemergt) {
  const w = WARTET.exec(name)
  if (w) return istGemergt(Number(w[1])) ? `erledigt-${w[1]}-${w[2]}` : null
  const v = VERGEBEN.exec(name)
  if (!v) return null
  const nummern = vergebenNummern(text)
  return nummern.length && nummern.every((n) => istGemergt(n)) ? `erledigt-${v[1]}` : null
}

/** Mögliche frühere Namen einer erledigt-Datei (vergeben- oder z-wartet-merge-). */
function alteNamen(name) {
  const w = ERLEDIGT_WARTET.exec(name)
  const rest = name.slice('erledigt-'.length)
  return [`vergeben-${rest}`, ...(w ? [`z-wartet-merge-${w[1]}-${w[2]}`] : [])]
}

/** Selbstheilung: scheiterte früher das Schreiben von stand.md nach dem Umbenennen, zeigt der Link auf eine fehlende alte Datei. */
function zieheLinksNach(ordner, namen, text) {
  let neu = text
  for (const name of namen.filter((n) => n.startsWith('erledigt-'))) {
    for (const alt of alteNamen(name)) {
      if (!namen.includes(alt)) neu = neu.split(`vorrat/${alt}`).join(`vorrat/${name}`)
    }
  }
  return neu
}

/**
 * Benennt um (nie über eine vorhandene Zieldatei; ein scheiternder Rename überspringt die Datei) und liefert
 * { text, zeilen }: stand.md-Text mit nachgezogenen Links `vorrat/<alt>` → `vorrat/<neu>`, dazu eine Meldungszeile je
 * Umbenennung bzw. je Fehlschlag. Fehlt der Ordner: nichts zu tun.
 */
function vorratErledigt({ ordner, text, istGemergt }) {
  let namen = []
  try {
    namen = fs.readdirSync(ordner).sort()
  } catch {
    return { text, zeilen: [] }
  }
  const zeilen = []
  let neu = zieheLinksNach(ordner, namen, text)
  for (const name of namen) {
    const inhalt = VERGEBEN.test(name) ? fs.readFileSync(path.join(ordner, name), 'utf8') : ''
    const ziel = neuerName(name, inhalt, istGemergt)
    if (!ziel || namen.includes(ziel)) continue
    try {
      fs.renameSync(path.join(ordner, name), path.join(ordner, ziel))
    } catch (e) {
      zeilen.push(`Vorrat: ${name} nicht umbenannt (${e.code ?? e.message})`)
      continue
    }
    neu = neu.split(`vorrat/${name}`).join(`vorrat/${ziel}`)
    zeilen.push(`Vorrat: ${name} → ${ziel}`)
  }
  return { text: neu, zeilen }
}

module.exports = { neuerName, vorratErledigt }
