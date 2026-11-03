/*
  **Eine Netflix-Meldung geht nur unter der Adresse raus, zu der ihre Folgen gehören** — eigene Datei, weil
  `melder.js` über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`.

  Anlass: Barbie (81184735) und The Loud House (81186971) am 13.10.2026. Die 13 Folgen von Barbie Staffel 2
  kamen 40 s nach der ersten Meldung ein zweites Mal an, diesmal unter der Adresse von The Loud House
  (gleiche gti, gleiche Messung). `randMelden()` setzt die Adresse erst beim Senden aus `gemeinteReihe()`;
  was der Durchlauf an Liste und Stichprobe noch hielt, stammte von der vorigen Titelseite.

  `durchlauf.listeFuer` ist die Seite, für die die Liste gelesen wurde (`nachrichtEmpfangen`). Gemeldet wird
  nur, wenn sie die Seite von jetzt ist und jede Folge in der Liste dieser Seite steht. Sonst zählt `verworfenFremd`.
*/


/**
 * Verworfenes sichtbar machen: `durchlauf.verworfenFremd` zählt mit Grund (Bericht und Protokoll lesen es), `offen` bleibt
 * stehen, bis `akRandAusfall` den Abbruchgrund daraus gebildet hat.
 */
function akNetflixVerworfen(durchlauf, grund) {
  const bisher = durchlauf.verworfenFremd?.anzahl ?? 0
  durchlauf.verworfenFremd = { anzahl: bisher + 1, grund, offen: true }
  console.warn(`[Anime-Kalender] Meldung verworfen (${bisher + 1}.): ${grund}`)
  try {
    globalThis.akProtokoll?.('meldung-verworfen', { grund, anzahl: bisher + 1 })
  } catch {
    /* Messen darf nie stören. */
  }
  return false
}

/**
 * `hier`: Kennung aus der Adresse (`titelDerAdresse()`), `null` im Player. `true` = melden.
 * Die Folge muss in `alleFolgen` (Staffelliste) oder in `folgen` (angezeigte Gruppe, bei Filmen die einzige) stehen;
 * beide sind die Liste der Seite `listeFuer`.
 */
globalThis.akNetflixSeitentreu = (durchlauf, hier, folgen) => {
  const listeFuer = durchlauf.listeFuer == null ? null : String(durchlauf.listeFuer)
  if (hier && listeFuer && String(hier) !== listeFuer) return akNetflixVerworfen(durchlauf, `Folgen von ${listeFuer}, Seite ist ${hier}`)
  if (!listeFuer) return true
  const bekannt = new Set([...(durchlauf.alleFolgen ?? []), ...(durchlauf.folgen ?? [])].map((f) => String(f.videoId)))
  const fremd = folgen.filter((f) => !bekannt.has(String(f.videoId)))
  if (fremd.length) return akNetflixVerworfen(durchlauf, `${fremd.length} Folge(n) nicht in der Liste von ${listeFuer}`)
  return true
}
