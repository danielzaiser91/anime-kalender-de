/**
 * Merge-Sperre „Prüfer verlangt Änderung“ (12.11.2026; Anlass PR 3393 und 3398, am 10.11. gemergt, obwohl der letzte Prüfer-Kommentar
 * „ändern“ lautete und kein Commit folgte). `pr-nachrechnen.mjs` ruft `prueferSperre` mit den Feldern `comments` und `commits` von `gh pr view`.
 * Maßgeblich ist der letzte Kommentar, dessen erste Zeile „Prüfer“ nennt und ein Urteil trägt (`Urteil: ändern`, `Prüfer Runde 1: ändern`); Nachträge und
 * Prüfstufen-Kommentare tragen keines. Ohne Prüfer-Kommentar (Stufe 0) gibt es keine Sperre. Ein Urteil „ok“ für einen anderen als den jetzigen Kopf zählt nur,
 * wenn sein eigener Diff gleich ist (`gleich`, pr-eigener-diff.mjs; 21.11.2026: reiner main-Nachzug kostet keine neue Freigabe).
 */
export const AENDERN = ['ändern', 'aendern']
export const FREI = ['ok', 'freigegeben', 'freigeben']
const DIRIGENT_ENTSCHEIDET = 'Dirigent entscheidet'

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

/**
 * Urteile, die für `kopf` zählen, zeitlich aufsteigend. `gleich(kurz)`: hat der genannte Kopf denselben eigenen Diff wie `kopf`?
 * Sagt `gleich` immer nein, zählt ein „ok“ nur für genau den Kopf, den es nennt.
 */
export function geltendeUrteile(comments, kopf, gleich) {
  const urteile = comments
    .map((c) => ({ zeit: c.createdAt, body: c.body, ...urteilAus(c.body) }))
    .filter((u) => u.wort !== undefined)
    .filter((u) => !(FREI.includes(u.wort) && u.kopf !== null && !kopf.startsWith(u.kopf) && !gleich(u.kopf)))
    .filter((u) => AENDERN.includes(u.wort) || FREI.includes(u.wort))
    .sort((a, b) => Date.parse(a.zeit) - Date.parse(b.zeit))
  return urteile.filter((u, i) => !wiederholtOffen(u, urteile.slice(0, i), kopf, gleich))
}

/**
 * „aendern, Auflagen offen: Dirigent entscheidet“ am diff-gleichen Kopf nach einem geltenden „ok“: der Abnahme-Prüfer wiederholt nur die
 * Auflagen, die der Dirigent mit dem „ok“ schon entschieden hat. Ein „aendern“ ohne diesen Zusatz trägt eigene Befunde und zählt immer.
 */
function wiederholtOffen(u, vorher, kopf, gleich) {
  if (!AENDERN.includes(u.wort) || u.kopf === null) return false
  if (!String(u.body).split(/\r?\n/)[0].includes(DIRIGENT_ENTSCHEIDET)) return false
  if (!kopf.startsWith(u.kopf) && !gleich(u.kopf)) return false
  return vorher.some((v) => FREI.includes(v.wort))
}

/** null = frei; sonst die Meldung samt Zeiten. `comments` und `commits` wie von `gh pr view --json comments,commits`, `gleich` siehe `geltendeUrteile`. */
export function prueferSperre(comments = [], commits = [], gleich = () => false) {
  const kopf = commits.length === 0 ? '' : commits[commits.length - 1].oid
  const urteile = geltendeUrteile(comments, kopf, gleich)
  const letztes = urteile[urteile.length - 1]
  if (letztes === undefined || !AENDERN.includes(letztes.wort)) return null
  const zeiten = commits.map((c) => c.committedDate).sort((a, b) => Date.parse(a) - Date.parse(b))
  const letzterCommit = zeiten[zeiten.length - 1]
  if (letzterCommit !== undefined && Date.parse(letzterCommit) > Date.parse(letztes.zeit)) return null
  return `PRÜFER VERLANGT ÄNDERUNG (Urteil ${letztes.zeit}, letzter Commit ${letzterCommit ?? 'keiner'})`
}
