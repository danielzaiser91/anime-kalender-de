/**
 * Beim Nachliefern eines Funds (`fund-schonen.mjs`): Schlüssel, die `data/tmdb-von-hand.yaml` mit `ohne: true` ausschließt, kommen nicht aus dem Fund zurück.
 * Nur Node-Bordmittel (der Workflow-Schritt läuft vor `npm ci`); die Handdatei hat je Eintrag Zeilen `- anilistId: N` und (optional) `  ohne: true`.
 */
export const OHNE_DATEIEN = ['data/tmdb-titles.json', 'data/tmdb-banner.json', 'data/tmdb-folgen.json']

/** AniList-IDs der Einträge mit `ohne: true`; ein Eintrag beginnt mit `- ` in Spalte 0. */
export function ohneSchluessel(yamlText) {
  const ids = []
  let aktuell = null
  for (const zeile of yamlText.split(/\r?\n/)) {
    const neu = /^- anilistId:\s*(\d+)\s*(#.*)?$/.exec(zeile)
    if (neu) aktuell = neu[1]
    else if (/^- /.test(zeile)) aktuell = null
    else if (aktuell && /^\s+ohne:\s*true\s*$/.test(zeile)) ids.push(aktuell)
  }
  return ids
}

/** JSON-Objekt ohne die Schlüssel; gibt den neuen Text (kompakt wie die Dateien, Zeilenende erhalten) und die tatsächlich entfernten Schlüssel zurück. */
export function streicheSchluessel(jsonText, schluessel) {
  const obj = JSON.parse(jsonText)
  const entfernt = schluessel.filter((k) => Object.hasOwn(obj, k))
  for (const k of entfernt) delete obj[k]
  const text = entfernt.length ? JSON.stringify(obj) + (jsonText.endsWith('\n') ? '\n' : '') : jsonText
  return { text, entfernt }
}
