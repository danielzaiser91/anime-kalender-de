/*
  **Netflix' Staffelmenü lesen — Nummer und Folgenzahl je Eintrag** (eigene Datei, weil `melder.js` über der
  Zeilengrenze liegt; lädt laut Manifest vor `melder.js`).

  Gemessen am 22.09.2026 auf Dr. STONE: „Staffel N (M Folgen)". Die Folgenzahl steht nur dort, wo das Wort
  „Folgen" folgt: Das Kästchen neben „Staffel N:" ist die Altersfreigabe (16, 12, 6), keine Folgenzahl
  (Daniel, 16.10.2026, Vinland Saga und Dangers in My Heart).
*/

const FOLGEN_ZAHL = /(\d+)\s*(?:Folgen|Folge|Episoden|Episode|Episodes)\b/i

/** Die Nummer eines Staffeleintrags („Staffel 3", „Teil 2", „Season 1"); `null` ohne Zahl. */
globalThis.akNetflixStaffelNr = (roh) => {
  const nr = /(?:Staffel|Teil|Season)\s*(\d+)/i.exec(String(roh ?? ''))
  return nr ? Number(nr[1]) : null
}

/** Aus den Texten der Menüeinträge: `{ text, nr, folgen }` — `null`, wo die Zahl nicht dasteht. */
globalThis.akNetflixStaffelEintraege = (texte) =>
  texte.map((roh) => {
    const text = String(roh ?? '').trim()
    const folgen = FOLGEN_ZAHL.exec(text)
    return { text, nr: globalThis.akNetflixStaffelNr(text), folgen: folgen ? Number(folgen[1]) : null }
  })
