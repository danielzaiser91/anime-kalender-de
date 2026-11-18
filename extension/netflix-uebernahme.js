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
/*
  Reihen mit Meldungen im Briefkasten, die der Stand noch als offen führt; `fertig()` in melder.js fragt sie.
  `null`, bis die erste Übernahme geantwortet hat: bis dahin gilt der Rückfall ohne Stand (Tot-Vermerk), sonst käme
  ein eben gemeldeter Titel im Fenster zwischen Stand und Übernahme sofort wieder.
*/
globalThis.akNetflixWartet = null

/** Hat jede offene Staffel des Eintrags mindestens ein gemeldetes Paar? (`paar.staffel` = Staffelnummer.) */
globalThis.akNetflixStaffelnGedeckt = (eintrag, paare) =>
  (eintrag?.staffeln ?? []).filter((st) => st.offen).every((st) => paare.some((p) => Number(p.staffel) === Number(st.nr)))

/*
  **Erledigt laut Worker-Stand** (24.10.2026): nicht mehr im Stand, in dieser Sitzung gemeldet oder im Briefkasten
  gedeckt (`akNetflixWartet`). Der Worker nimmt gedeckte Ziele seitdem selbst aus `ziele` (`worker/src/pruefung-gedeckt.ts`,
  gleiche Regel wie `akNetflixStaffelnGedeckt`); `tools/worker-netflix-zahl-gleich.test.ts` hält beide Zahlen gleich.
*/
globalThis.akNetflixErledigtLautStand = (id, standUrls, frisch, wartet) =>
  !standUrls.has(`https://www.netflix.com/title/${id}`) || frisch.has(String(id)) || wartet.has(String(id))

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
  **Alle Adressen in einer Anfrage** (`?gemeldet-liste=`, Worker: `pruefung-gemeldet-sammel.ts`; 16.11.2026, 4058): der
  Dialog fragte je Titel einzeln (98 bis 230 Anfragen je Klick); seit #4059 ruft ihn `netflix-stand.js` auf, nie der Dialog selbst. Antwort: Adresse → `{ nummern, paare }`; `null`: die Route fehlt (403, 404, 405 oder
  nicht auswertbar) — dann gilt der alte Weg je Adresse; `false`: keine Auskunft (429, 5xx, Netz) — dann bleibt der lokale Stand,
  weil N Einzelanfragen bei gerissenem Deckel die Last verdoppelten.
*/
globalThis.akGemeldetSammel = async (worker, adressen, holen = fetch) => {
  try {
    const vor = adressen.reduce((v, a) => { let i = 0; while (i < v.length && v[i] === a[i]) i++; return v.slice(0, i) }, adressen[0] ?? '')
    const anfang = vor.slice(0, vor.lastIndexOf('/') + 1)
    const enden = adressen.map((a) => a.slice(anfang.length))
    if (!enden.length || enden.some((e) => e.includes(','))) return null
    const antwort = await holen(`${worker}?gemeldet-liste=${encodeURIComponent(enden.join(','))}&vor=${encodeURIComponent(anfang)}`, { cache: 'no-store' })
    if (!antwort.ok) return [403, 404, 405].includes(antwort.status) ? null : false
    const { adressen: je } = await antwort.json()
    return je && typeof je === 'object' ? new Map(adressen.map((a) => [a, je[a] ?? { paare: [] }])) : null
  } catch {
    return false
  }
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
globalThis.akNetflixEnde = (grund, uebersprungen, fertigeTitel, besucht, offeneTitel, wartet = globalThis.akNetflixWartet, melden = null, nichtDa = globalThis.akNetflixNichtDa()) => {
  const nichtFertig = [...uebersprungen.keys()].filter((r) => !fertigeTitel.has(r))
  const wartend = Object.entries(offeneTitel).filter(([id, e]) => wartet?.has(id) && !fertigeTitel.has(id) && (e?.staffeln ?? []).some((st) => st.offen)).length
  const erinnern = nichtFertig.filter((r) => /^Erinnern-Knopf/.test(String(uebersprungen.get(r)))).length
  const zaehlung = { besucht, gemessen: fertigeTitel.size, wartend, uebersprungen: nichtFertig.length, nichtDa: nichtDa.size }
  globalThis.akProtokoll?.('durchgang-zaehlung', zaehlung)
  /* Meldeweg `/vorfall` (vorhanden, ohne neues Schema): die Zählung steht als Text; der Vorfall-Abruf listet sie. */
  void melden?.('durchgang-zaehlung', { text: JSON.stringify(zaehlung) })
  const rot = akNetflixNullGemessen(zaehlung, erinnern)
  const urteile = (zaehlung.nichtDa ? `, nicht bei Netflix ${zaehlung.nichtDa} (gemeldet)` : '') + (erinnern ? `, Erinnern-Knopf ${erinnern} (zurückgestellt)` : '')
  const text = ` · besucht ${besucht}, gemessen ${zaehlung.gemessen}${urteile}, wartet auf Übernahme ${wartend}${rot ? ' · ⚠ NICHTS GEMESSEN — der Durchgang hat nichts geliefert, nicht „ok“ melden' : ''}`
  return { grund, uebersprungen: nichtFertig, zaehlung, text, rot, uebersprungenText: akNetflixUebersprungenZahlen(nichtFertig, uebersprungen) }
}

/**
 * Besucht, aber nichts gemessen und kein Urteil: der Durchgang war wirkungslos (09.11.2026: 103 besucht, 0 gemessen, niemand merkte es).
 * Ein Urteil „nicht bei Netflix“ (gemeldet) ist eine Auskunft (15.11.2026: sieben Titel, Bericht blieb rot). Ebenso der Erinnern-Knopf:
 * die Seite hat den Titel als angekündigt gezeigt (18.11.2026: sechs Titel, alle mit Erinnern-Knopf, Bericht „NICHTS GEMESSEN" war falsch).
 * Störungen, Notausgang („keine Folgenliste in 20 s") und leere Titelfenster bleiben keine Auskunft.
 */
const akNetflixNullGemessen = (zaehlung, erinnern = 0) => zaehlung.besucht > 0 && zaehlung.gemessen === 0 && !zaehlung.nichtDa && !erinnern

/** Die Titel, die dieser Lauf als „nicht bei Netflix“ gemeldet hat (Kennung → Grund); überlebt das Neuladen, `clear()` beim Start. */
let nichtDaMap = null
globalThis.akNetflixNichtDa = () => (nichtDaMap ??= globalThis.akNetflixLaufMap ? new (globalThis.akNetflixLaufMap(globalThis.akNetflixSitzungSpeicher(), 'ak-netflix-nichtda'))() : new Map())

/** Kopfzeile statt Namensliste (~100 Titel): Zahl je Grund, größte zuerst, gleiche Zahl nach Grund sortiert. */
const akNetflixUebersprungenZahlen = (kennungen, gruende) => {
  if (!kennungen.length) return ''
  const je = new Map()
  /* Ohne Klammer: „Erinnern-Knopf mit Datum (19.11.)" und „(25.11.)" sind eine Art (wie `ansichtGrundArt`). */
  for (const k of kennungen) {
    const art = String(gruende.get(k)).replace(/^(Erinnern-Knopf mit Datum) \(.*\)$/, '$1')
    je.set(art, (je.get(art) ?? 0) + 1)
  }
  const teile = [...je].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([g, n]) => `${n}× ${g}`)
  return ` · übersprungen: ${kennungen.length} (${teile.join(', ')})`
}
