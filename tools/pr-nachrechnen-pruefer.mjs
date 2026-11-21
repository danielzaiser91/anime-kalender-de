/**
 * Merge-Sperre „Prüfer verlangt Änderung“ (12.11.2026; Anlass PR 3393 und 3398, am 10.11. gemergt, obwohl der letzte Prüfer-Kommentar
 * „ändern“ lautete und kein Commit folgte). `pr-nachrechnen.mjs` ruft `prueferSperre` mit den Feldern `comments` und `commits` von `gh pr view`.
 * Maßgeblich ist der letzte Kommentar, dessen erste Zeile „Prüfer“ nennt und ein Urteil trägt (`Urteil: ändern`, `Prüfer Runde 1: ändern`); Nachträge und
 * Prüfstufen-Kommentare tragen keines. Ohne Prüfer-Kommentar (Stufe 0) gibt es keine Sperre. Ein Urteil „ok“ für einen anderen als den jetzigen Kopf zählt nicht.
 * Ausnahme (21.11.2026, PR 4417): Trägt das Urteil „Auflagen offen: Dirigent entscheidet“, hebt ein späterer Abnahme-Kommentar des Inhabers zum jetzigen Kopf die Sperre auf.
 */
import { entscheide } from './abnahme-freigabe.mjs'

const AENDERN = ['ändern', 'aendern']
const FREI = ['ok', 'freigegeben', 'freigeben']

const URTEIL_ZEILE = /Urteil:\s*\**\s*(\p{L}+)/u
const URTEIL_RUNDE = /^\**Prüfer Runde \d+\**:\s*(\p{L}+)/u
const KOPF_IN_ZEILE = /für ([0-9a-f]{7,40})\b/

/** { wort, kopf } aus der ersten Zeile eines Prüfer-Kommentars, sonst null. */
export function urteilAus(body) {
  const zeile = String(body ?? '').split(/\r?\n/)[0]
  if (!zeile.includes('Prüfer')) return null
  const treffer = URTEIL_ZEILE.exec(zeile) ?? URTEIL_RUNDE.exec(zeile)
  if (treffer === null) return null
  return { wort: treffer[1].toLowerCase(), kopf: KOPF_IN_ZEILE.exec(zeile)?.[1] ?? null }
}

/** Der CI-Prüfer im Abnahme-Modus überlässt die Entscheidung ausdrücklich dem Dirigenten (`pr-pruefer.yml`). */
const DIRIGENT_ENTSCHEIDET = 'Auflagen offen: Dirigent entscheidet'

/** Nur das Urteil „… Auflagen offen: Dirigent entscheidet“ hebt eine Abnahme des Inhabers zum jetzigen Kopf auf, die nach dem Urteil kam (Regel von `abnahme-freigabe.mjs`). */
function dirigentHatEntschieden(urteil, comments, kopf) {
  if (!String(urteil.body ?? '').split(/\r?\n/)[0].includes(DIRIGENT_ENTSCHEIDET)) return false
  return comments.some((c) => Date.parse(c.createdAt) > Date.parse(urteil.zeit)
    && entscheide({ autor: c.author?.login, assoziation: c.authorAssociation, text: c.body, kopf }).art === 'frei')
}

/** null = frei; sonst die Meldung samt Zeiten. `comments` und `commits` wie von `gh pr view --json comments,commits`. */
export function prueferSperre(comments = [], commits = []) {
  const kopf = commits.length === 0 ? '' : commits[commits.length - 1].oid
  const urteile = comments
    .map((c) => ({ zeit: c.createdAt, body: c.body, ...urteilAus(c.body) }))
    .filter((u) => u.wort !== undefined)
    .filter((u) => !(FREI.includes(u.wort) && u.kopf !== null && !kopf.startsWith(u.kopf)))
    .filter((u) => AENDERN.includes(u.wort) || FREI.includes(u.wort))
    .sort((a, b) => Date.parse(a.zeit) - Date.parse(b.zeit))
  const letztes = urteile[urteile.length - 1]
  if (letztes === undefined || !AENDERN.includes(letztes.wort)) return null
  if (dirigentHatEntschieden(letztes, comments, kopf)) return null
  const zeiten = commits.map((c) => c.committedDate).sort((a, b) => Date.parse(a) - Date.parse(b))
  const letzterCommit = zeiten[zeiten.length - 1]
  if (letzterCommit !== undefined && Date.parse(letzterCommit) > Date.parse(letztes.zeit)) return null
  return `PRÜFER VERLANGT ÄNDERUNG (Urteil ${letztes.zeit}, letzter Commit ${letzterCommit ?? 'keiner'})`
}
