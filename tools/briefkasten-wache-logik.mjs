/**
 * Urteil der Briefkasten-Wache: welche ungelisteten Adressen sind liegengeblieben?
 * Eigene Datei, damit die Entscheidung ohne Netz getestet werden kann (`briefkasten-wache.test.mjs`).
 */

/** Älteste `gemeldet_am` je Adresse aus der Listenabfrage. */
export function aeltesteJeAdresse(meldungen) {
  const aelteste = new Map()
  for (const m of meldungen) {
    const bisher = aelteste.get(m.url)
    if (!bisher || m.gemeldet_am < bisher) aelteste.set(m.url, m.gemeldet_am)
  }
  return aelteste
}

/**
 * Ungelistete Adressen, deren älteste Meldung vor `jetzt - stunden` liegt. Eine Adresse, die in
 * `meldungen` fehlt (Antwort abgeschnitten), hat kein bekanntes Alter und zählt nicht als alt.
 */
export function liegengeblieben(fehlend, meldungen, jetzt, stunden) {
  const grenze = new Date(jetzt - stunden * 36e5).toISOString()
  const aelteste = aeltesteJeAdresse(meldungen)
  return fehlend.filter((u) => aelteste.has(u) && aelteste.get(u) < grenze)
}
