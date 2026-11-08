/**
 * News-Delta je Titel für `bau-vergleich.mjs`: `public/data/news.json` ist eine Liste von Tagesgruppen
 * (`am`, `titelId`, `titel`, `meldungen[]`) ohne `id`, der Feldvergleich ordnet sie nach Stelle zu und
 * zeigt bei einer Einfügung nur Verschiebungen. Hier wird je Meldung (Tag, Titel, Art, Anbieter, Teil)
 * zugeordnet und nach Titel ausgegeben, was neu, weggefallen oder geändert ist (Anlass: PR 2428, eine
 * Umhängung erzeugte unbemerkt „neu“-Meldungen mit Bautag).
 */

const MAX_ZEILEN = 40

/** Schlüssel einer Meldung; gleiche Schlüssel am selben Tag werden durchnummeriert. */
function meldungsSchluessel(gruppe, m) {
  const teil = m.teilId ?? m.teil ?? ''
  return `${gruppe.am}|${gruppe.titelId}|${m.art}|${m.platform ?? ''}|${teil}`
}

function sammle(text) {
  const karte = new Map()
  const namen = new Map()
  let liste
  try {
    liste = JSON.parse(text)
  } catch {
    return { karte, namen }
  }
  if (!Array.isArray(liste)) return { karte, namen }
  for (const gruppe of liste) {
    namen.set(gruppe.titelId, gruppe.titel)
    for (const m of gruppe.meldungen ?? []) {
      const basis = meldungsSchluessel(gruppe, m)
      let n = 0
      while (karte.has(`${basis}#${n}`)) n++
      karte.set(`${basis}#${n}`, { gruppe, m })
    }
  }
  return { karte, namen }
}

const beschreibe = (zeichen, { gruppe, m }, zusatz = '') =>
  `  ${zeichen} ${gruppe.titel} (${gruppe.titelId}): ${gruppe.am} ${m.art}${m.platform ? ` ${m.platform}` : ''}${zusatz}`

/** Zeilen des News-Deltas; leer, wenn beide Texte dieselben Meldungen enthalten. */
export function newsDelta(altText, neuText) {
  const alt = sammle(altText)
  const neu = sammle(neuText)
  const zeilen = []
  let nNeu = 0
  let nWeg = 0
  let nAnders = 0
  for (const [schluessel, e] of neu.karte) {
    const vorher = alt.karte.get(schluessel)
    if (!vorher) {
      nNeu++
      zeilen.push(beschreibe('+', e))
    } else if (JSON.stringify(vorher.m) !== JSON.stringify(e.m)) {
      nAnders++
      zeilen.push(beschreibe('~', e, ' (Inhalt geändert)'))
    }
  }
  for (const [schluessel, e] of alt.karte) {
    if (neu.karte.has(schluessel)) continue
    nWeg++
    zeilen.push(beschreibe('-', e))
  }
  if (!zeilen.length) return []
  const kopf = `news.json je Titel: ${nNeu} neu, ${nWeg} weggefallen, ${nAnders} geändert`
  const rest = zeilen.length - MAX_ZEILEN
  return [kopf, ...zeilen.slice(0, MAX_ZEILEN), ...(rest > 0 ? [`  … und ${rest} weitere`] : [])]
}
