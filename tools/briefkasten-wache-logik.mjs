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

/**
 * Übernahme-Stau (18.10.2026): Vom 11. bis 18.10. kam keine Meldung im Datensatz an, und kein Lauf wurde rot. Befund, wenn die
 * jüngste Übernahme (`zuletzt` aus `data/meldungen-uebernahme.json`) älter als `stunden` ist und eine zuzuordnende Meldung
 * (Adresse in `fehlend`, also nicht in der Liste) seit mehr als `stunden` wartet. Liegende Meldungen stehen in der Liste und
 * zählen nicht; ohne Stempel kein Befund. Rückgabe: Alter der Übernahme in Stunden und Zahl der Wartenden, sonst null.
 */
export function uebernahmeStau(zuletzt, fehlend, meldungen, jetzt, stunden) {
  const grenze = jetzt - stunden * 36e5
  if (!zuletzt || Date.parse(zuletzt) >= grenze) return null
  const offen = new Set(fehlend)
  const wartend = meldungen.filter((m) => offen.has(m.url) && Date.parse(m.gemeldet_am) < grenze)
  return wartend.length ? { stunden: Math.floor((jetzt - Date.parse(zuletzt)) / 36e5), wartend: wartend.length } : null
}
