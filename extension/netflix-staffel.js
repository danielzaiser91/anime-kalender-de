/*
  **Netflix' Staffelmenü lesen — Nummer und Folgenzahl je Eintrag** (eigene Datei, weil `melder.js` über der
  Zeilengrenze liegt; lädt laut Manifest vor `melder.js`).

  Gemessen am 22.09.2026 auf Dr. STONE: „Staffel N (M Folgen)". Die Folgenzahl steht nur dort, wo das Wort
  „Folgen" folgt: Das Kästchen neben „Staffel N:" ist die Altersfreigabe (16, 12, 6), keine Folgenzahl
  (Daniel, 16.10.2026, Vinland Saga und Dangers in My Heart).

  **Die Beschriftung zählt nicht** (Daniel, 16.10.2026, Unicorn Academy: „Kapitel 1" statt „Staffel 1"): Die
  Nummer ist die Zahl nach dem ersten Wort des Eintrags, nachdem „(M Folgen)" abgezogen ist. Ob „Staffel",
  „Kapitel", „Teil", „Volume" oder „Season" davorsteht, ist gleich. Benannte Staffeln („Golden Wind") haben keine.
*/

const FOLGEN_ZAHL = /(\d+)\s*(?:Folgen|Folge|Episoden|Episode|Episodes)\b/i

/** Die Nummer eines Staffeleintrags, gleich wie er heißt; `null` ohne Zahl („Golden Wind"). */
globalThis.akNetflixStaffelNr = (roh) => {
  const ohneZahl = String(roh ?? '').replace(FOLGEN_ZAHL, ' ')
  const nr = /^\s*(?:\p{L}+\.?\s*)?(\d{1,3})(?!\d)/u.exec(ohneZahl)
  return nr ? Number(nr[1]) : null
}

/** Aus den Texten der Menüeinträge: `{ text, nr, folgen }` — `null`, wo die Zahl nicht dasteht. */
globalThis.akNetflixStaffelEintraege = (texte) =>
  texte.map((roh) => {
    const text = String(roh ?? '').trim()
    const folgen = FOLGEN_ZAHL.exec(text)
    return { text, nr: globalThis.akNetflixStaffelNr(text), folgen: folgen ? Number(folgen[1]) : null }
  })

/** Das Menü gehört zu der Reihe, aus der es gelesen wurde; ein Titel ohne Menü erbt nicht das des vorigen. */
globalThis.akNetflixMenueMerken = (eintraege, reihe) => Object.assign(eintraege, { reihe: String(reihe) })

/** Das gemerkte Menü, wenn es zu dieser Reihe gehört, sonst leer. */
globalThis.akNetflixMenue = (gemerkt, reihe) => (gemerkt?.reihe === String(reihe) ? gemerkt : [])

/**
 * Staffelnummer und Menütext einer Rohfolge (`staffelNr`, `staffelText`; der Worker legt beide ab).
 *
 * Nummer und Text stammen aus **demselben** Menüeintrag, sonst steht eine Folgenzahl neben der Nummer einer
 * anderen Staffel. Den Eintrag bestimmt die Nummer aus den Folgenkennungen (`ziel.ausKennung`, sicher); ohne
 * sie der Eintrag, dessen Folgenzahl genau einmal zur geladenen Gruppe passt, sonst die Anzeige im Feld, wenn
 * sie im Menü steht und zur Folgenzahl passt. Findet sich keiner, bleibt der Text ohne Folgenzahl. Bei zwei
 * Staffeln gleicher Länge (Vinland Saga: 24 und 24) bleibt die Nummer leer — geraten wird nicht. Der Text
 * trägt die Länge des Menüs mit (` · von 2`): Der Bau ordnet nur zu, wenn unsere Serienzahl an der Adresse
 * dieselbe ist (`pipeline/lib/netflix-staffeln.ts`), sonst verschöbe eine Lücke (My Hero Academia) die Nummern.
 */
globalThis.akNetflixRohStaffel = (ziel, menue, label, seasonId) => {
  const liste = menue ?? []
  const sicher = ziel.ausKennung ? ziel.staffel : null
  const gleichLang = liste.filter((e) => e.folgen === ziel.folgen)
  const nrAnzeige = globalThis.akNetflixStaffelNr(label)
  const eintrag =
    sicher != null
      ? liste.find((e) => e.nr === sicher)
      : (gleichLang.length === 1 ? gleichLang[0] : null) ??
        liste.find((e) => e.nr != null && e.nr === nrAnzeige && e.folgen === ziel.folgen)
  return {
    staffelNr: eintrag ? (eintrag.nr ?? null) : (ziel.staffel ?? null),
    staffelText: eintrag ? `${eintrag.text} · von ${liste.length}` : (label ?? (seasonId != null ? String(seasonId) : null)),
  }
}
