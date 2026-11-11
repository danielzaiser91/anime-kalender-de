/**
 * Ausweg aus der Patch-Notes-Prüfung per PR-Kommentar. Beschreibungen werden nie geändert; trifft die Textsuche
 * (`VERTAGUNG_IM_TEXT`) einen Satz der Beschreibung falsch (z. B. eine Messung „der nächste Bau zeigt sie“), hätte der PR sonst keinen Weg.
 * Ein Kommentar von PR-Autor oder Repo-Berechtigten mit einer Zeile „Patch Notes: …“ ersetzt die Beschreibung für diese Prüfung
 * (der neueste Kommentar gewinnt); dann wird der Text der Beschreibung nicht mehr abgesucht, nur die Zeile selbst gilt.
 */
import { ghApiJson } from './kind-mit-limit.mjs'

const VERTRAUT = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const PATCH_NOTES_ZEILE = /^[ \t]*Patch Notes:[ \t]*\S.*$/im

/** Wirksame Beschreibung: die Zeile „Patch Notes: …“ des neuesten Kommentars eines Berechtigten, sonst die Beschreibung selbst. */
export function wirksameBeschreibung(beschreibung, kommentare, autor) {
  const zaehlt = (k) => k.user?.login === autor || VERTRAUT.has(k.author_association)
  const zeilen = kommentare.filter((k) => zaehlt(k)).map((k) => PATCH_NOTES_ZEILE.exec(k.body ?? '')?.[0])
  return zeilen.filter(Boolean).at(-1)?.trim() ?? beschreibung
}

/** Wie `wirksameBeschreibung`, die Kommentare kommen aus `api(args)` (GitHub-API); ein Abruffehler lässt die Beschreibung gelten. */
export function beschreibungMitKommentaren(pr, repo, api = ghApiJson) {
  const beschreibung = pr.body ?? ''
  if (!repo || !pr.number) return beschreibung
  try {
    const kommentare = api(['--paginate', '--slurp', `repos/${repo}/issues/${pr.number}/comments`]).flat()
    return wirksameBeschreibung(beschreibung, kommentare, pr.user?.login)
  } catch (fehler) {
    console.error(`  ⚠ Patch-Notes-Pflicht: Kommentare nicht lesbar, es gilt die Beschreibung (${String(fehler.message).split('\n')[0]})`)
    return beschreibung
  }
}
