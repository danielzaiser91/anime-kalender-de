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
  ein Titel gilt als erledigt, wenn **jede offene Staffel** eine Meldung hat (seit 23.10.2026; vorher
  genügte irgendeine Meldung des Titels, und rund 115 offene Staffeln blieben liegen) — außer eine
  Wiedervorlage (`seit` an einer offenen Staffel) verlangt eine neuere.
*/
/* Reihen mit Meldungen im Briefkasten, die der Stand noch als offen führt; `fertig()` in melder.js fragt sie. */
globalThis.akNetflixWartet = new Set()

/** Hat jede offene Staffel des Eintrags mindestens ein gemeldetes Paar? (`paar.staffel` = Staffelnummer.) */
globalThis.akNetflixStaffelnGedeckt = (eintrag, paare) =>
  (eintrag?.staffeln ?? []).filter((st) => st.offen).every((st) => paare.some((p) => Number(p.staffel) === Number(st.nr)))

/*
  **Eine Definition für „Netflix-Titel erledigt" laut Worker-Stand** (24.10.2026). Daniel: Statusanzeige
  „46 offen · 27 Titel · 19 ohne Kennung", Knopf „5". Der Worker zieht nur Meldungen seit dem Prüfstand-
  Bau ab, die Erweiterung zusätzlich jede im Briefkasten gedeckte (`akNetflixWartet`) — dieselbe Frage,
  zwei Regeln. Sie bleiben verschieden (Worker-Seite: `pruefung-stand-anbieter.ts`); der Knopf-Tooltip
  zerlegt die Zahl des Stands darum vollständig, `fertig()` und die Zerlegung nutzen diese Funktion.
*/
globalThis.akNetflixErledigtLautStand = (id, standUrls, frisch, wartet) =>
  !standUrls.has(`https://www.netflix.com/title/${id}`) || frisch.has(String(id)) || wartet.has(String(id))

/** Zerlegt die Titelzahl des Stands: offen (= Knopf), hier gemeldet (Einspielung steht aus), nicht in der Liste. */
globalThis.akNetflixZaehlung = (standUrls, offene, frisch, wartet) => {
  if (!standUrls) return null
  const z = { imStand: standUrls.size, offen: 0, gemeldet: 0, ausserListe: 0 }
  for (const url of standUrls) {
    const id = String(url).split('/').pop()
    if (offene[id] === undefined) z.ausserListe++
    else if (globalThis.akNetflixErledigtLautStand(id, standUrls, frisch, wartet)) z.gemeldet++
    else z.offen++
  }
  return z
}

/** Tooltip-Zeilen, die die Zahl der Statusanzeige erklären; leer ohne Stand. */
globalThis.akNetflixZaehlText = (z, ohneKennung) => {
  if (!z) return ''
  const rest = z.ausserListe ? `, ${z.ausserListe} nicht in dieser Liste` : ''
  const kennung = ohneKennung ? ` Dazu ${ohneKennung} Verweise ohne Kennung, die nur dort stehen.` : ''
  return `\nStatusanzeige: ${z.imStand} Titel offen = ${z.offen} hier zu prüfen + ${z.gemeldet} hier schon gemeldet${rest}.${kennung}`
}

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
      const neue = paare.filter((p) => String(p.am ?? '') >= seit)
      if (!globalThis.akNetflixStaffelnGedeckt(offene[idAus(url)], neue)) return new Set()
      return new Set(neue.map((p) => `${p.staffel}|${p.nummer}`))
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

/**
 * Das Ende eines Durchgangs mit Zählung (23.10.2026): besucht (geöffnet), gemessen (abgeschlossen),
 * wartend (Meldung für jede offene Staffel im Briefkasten, nie geöffnet), übersprungen (nach Grund).
 * Ohne Zählung ließ sich nicht sagen, ob der Durchgang jeden Titel erreicht hat.
 */
globalThis.akNetflixEnde = (grund, uebersprungen, fertigeTitel, besucht, offeneTitel, wartet = globalThis.akNetflixWartet, melden = null) => {
  const nichtFertig = [...uebersprungen.keys()].filter((r) => !fertigeTitel.has(r))
  const wartend = Object.entries(offeneTitel).filter(([id, e]) => wartet.has(id) && !fertigeTitel.has(id) && (e?.staffeln ?? []).some((st) => st.offen)).length
  const zaehlung = { besucht, gemessen: fertigeTitel.size, wartend, uebersprungen: nichtFertig.length }
  globalThis.akProtokoll?.('durchgang-zaehlung', zaehlung)
  /* Meldeweg `/vorfall` (vorhanden, ohne neues Schema): die Zählung steht als Text; der Vorfall-Abruf listet sie. */
  void melden?.('durchgang-zaehlung', { text: JSON.stringify(zaehlung) })
  const text = ` · besucht ${besucht}, gemessen ${zaehlung.gemessen}, wartet auf Übernahme ${wartend}`
  return { grund, uebersprungen: nichtFertig, zaehlung, text }
}
