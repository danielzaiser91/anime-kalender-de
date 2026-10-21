/*
  **Netflix-Titel, die gemeldet sind und nur noch auf die Übernahme warten** (4.27.0, 11.10.2026) —
  eigene Datei, weil `melder.js` über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest nach
  `disney-netz.js` (dessen `frischGemeldet` bündelt und merkt die Abfragen) und vor `melder.js`.

  Anlass: Nach dem Neuladen öffnete „▶ alle durchgehen" die 20 Titel erneut, die der Lauf am
  Vormittag gemeldet hatte (Gumball 70243420: 20 Folgen, 2 Staffeln, Briefkasten 16:13 Z). Der Stand
  des Workers führt einen Titel bis zur Übernahme durch den Bestandsbau weiter als offen
  (`standZieleNetflix`), und `frischGemeldetNetflix` kennt nur Meldungen dieser Seite. Der Prüfstand
  ist kein Maßstab: er entstand um 16:37, also nach der Meldung, und führt Gumball trotzdem offen.

  Maßgeblich ist darum der Briefkasten selbst (`?gemeldet=<Adresse>`, nicht zwischengespeichert):
  ein Titel mit Meldungen gilt als erledigt — außer eine Wiedervorlage (`seit` an einer offenen
  Staffel) verlangt eine neuere. Vorbehalt: ein Titel, den ein Lauf nur zum Teil meldete, gilt bis
  zur Übernahme auch als erledigt, wie schon in der Sitzung, in der er gemeldet wurde.
*/
/* Reihen mit Meldungen im Briefkasten, die der Stand noch als offen führt; `fertig()` in melder.js fragt sie. */
globalThis.akNetflixWartet = new Set()

globalThis.akNetflixUebernahme = async (zieleUrls, offene, worker, netz = globalThis.AK_DISNEY_NETZ) => {
  try {
    const idAus = (url) => String(url).split('/').pop()
    /* Die späteste Wiedervorlage unter den offenen Staffeln; leer = jede Meldung genügt. */
    const seitVon = (eintrag) =>
      (eintrag?.staffeln ?? []).filter((st) => st.offen).reduce((spaet, st) => (String(st.seit ?? '') > spaet ? String(st.seit) : spaet), '')
    const holen = async (url) => {
      const seit = seitVon(offene[idAus(url)])
      const antwort = await fetch(`${worker}?gemeldet=${encodeURIComponent(url)}`, { cache: 'no-store' })
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`)
      const paare = (await antwort.json()).paare ?? []
      return new Set(paare.filter((p) => String(p.am ?? '') >= seit).map((p) => `${p.staffel}|${p.nummer}`))
    }
    const urls = [...zieleUrls].filter((url) => offene[idAus(url)] !== undefined)
    const erledigt = await netz.frischGemeldet(urls, holen, { frist: 30 * 60 * 1000, seit: (u) => seitVon(offene[idAus(u)]) })
    globalThis.akNetflixWartet = new Set([...erledigt].map(idAus))
  } catch {
    /* Ohne Auskunft bleibt es bei der Rechnung des Stands: lieber einmal zu viel prüfen. */
    globalThis.akNetflixWartet = new Set()
  }
  return globalThis.akNetflixWartet
}

/*
  Reihen, die diese Sitzung selbst gemeldet hat (`frischGemeldetNetflix` in melder.js), werden auch
  abgelegt: Der Durchgang lädt je Titel eine neue Seite, und ohne Ablage fragte sie den Briefkasten
  wieder für alle offenen Reihen (24.400 Abrufe bei 100 Titeln, 11.10.2026).
*/
globalThis.akNetflixFrischSet = () =>
  globalThis.AK_DISNEY_NETZ?.gemerktesSet([], (id) => `https://www.netflix.com/title/${id}`)

/*
  Der Dialog fragte bei jedem Öffnen den Briefkasten für alle offenen Reihen (244 Abrufe). Innerhalb von
  zwei Minuten genügt, was da ist; die eigene Meldung merkt `meldungenMerken` ohnehin sofort.
*/
const meldungenGeladenUm = new Map()
globalThis.akMeldungenNeuLaden = (reihe, jetzt = Date.now(), frist = 120000) => {
  if (jetzt - (meldungenGeladenUm.get(reihe) ?? -Infinity) < frist) return false
  meldungenGeladenUm.set(reihe, jetzt)
  return true
}

/*
  „nichts da" aus der Übersicht oder von /browse: Der Titel gilt sofort als gemeldet. Ohne den Vermerk
  blieb die Zeile stehen, bis der nächste Stand den Briefkasten kannte — `fertig()` liest bei vorhandenem
  Stand nur ihn, nicht `erledigt.tot` (Daniel, 21.10.2026: drei Titel nach „nichts da" noch offen).
  Der Vermerk steht vor dem Speichern, denn dessen Änderung zeichnet den Dialog neu.
*/
globalThis.akNetflixTotGemeldet = async (id, frisch, merkeTot) => {
  frisch.add(String(id))
  await merkeTot(id)
}
