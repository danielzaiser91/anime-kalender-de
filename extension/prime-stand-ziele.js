/*
  **Die Prime-Zahl kommt vom Worker, nicht aus dem Paket** (29.10.2026) — eigene Datei, weil `amazon.js` über der
  Zeilengrenze liegt (check:umfang). Lädt laut Manifest nach `prime-titelseite.js` und vor `amazon.js`.

  Anlass (Daniel, 26.10.2026, dritte Wiederholung nach 14./15.09.): Laufstatus „Amazon 62 offen“, Knopf „32 Prime-Titel“.
  `AK_OFFENE_AMAZON` ist beim Packen eingefroren (39 Adressen), der Worker führte 62; die Erweiterung zählte nur die
  Titel, die sie aus dem Paket kannte. Jetzt legt der Stand des Workers (`?stand=1`) für jedes Titel-Ziel ohne Paket-Eintrag
  einen Eintrag an (`ausStand`, Titel und Adresse vom Worker) — Zählung, Liste und Durchgang rechnen dann wie vorher.
  Suchadressen (Ziele mit leerem Titel) bleiben bei `suchOffen()`.
*/

/** Dieselbe Kennung wie `tools/extension-offene-amazon.mjs`: ASIN, GTI oder JustWatchs `?gti=`; sonst die Adresse. */
const primeKennungAusAdresse = (url) =>
  /\/(?:dp|detail)\/([A-Z0-9]{10,32}|amzn1\.dv\.gti\.[a-z0-9-]+)/i.exec(url)?.[1] ??
  /[?&]gti=(amzn1\.dv\.gti\.[a-z0-9-]+)/i.exec(url)?.[1] ??
  url

/** Trägt die Titel-Ziele des Workers nach, die das Paket nicht kennt; gibt die Adressen des Stands zurück. */
globalThis.akPrimeStandEinarbeiten = (ziele, liste, frischGemeldet) => {
  for (const k of Object.keys(liste)) if (liste[k]?.ausStand) delete liste[k]
  const stand = new Set(ziele.map((z) => z.url))
  const bekannt = new Set(Object.values(liste).map((e) => e?.url))
  for (const z of ziele) {
    if (!z.titel || bekannt.has(z.url)) continue
    const kennung = primeKennungAusAdresse(z.url)
    liste[kennung in liste ? z.url : kennung] = { titel: z.titel, url: z.url, ausStand: true, eintraege: [] }
    bekannt.add(z.url)
  }
  for (const u of [...frischGemeldet]) if (!stand.has(u)) frischGemeldet.delete(u)
  return stand
}

/** Holt `?stand=1` und arbeitet den Prime-Anbieter ein; `null` ohne Auskunft (dann gilt die ältere Rechnung in `fertig()`). */
globalThis.akPrimeStandLaden = async (worker, liste, frischGemeldet) => {
  try {
    const stand = await fetch(`${worker}?stand=1`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
    const prime = (stand?.anbieter ?? []).find((a) => a.plattform === 'primevideo')
    return prime && Array.isArray(prime.ziele) ? globalThis.akPrimeStandEinarbeiten(prime.ziele, liste, frischGemeldet) : null
  } catch {
    return null
  }
}

/**
 * Veraltet: der Worker führt Ziele, die das Paket nicht kennt, oder die Seite sagt es — Letzteres nur ohne Antwort des
 * Workers: Mit seinem Stand (`standBekannt`) ist die Liste vollständig, der Stempelvergleich der Paketliste besagt dann nichts.
 */
globalThis.akPrimeListeVeraltet = (lautSeite, liste, standBekannt = false) =>
  (Boolean(lautSeite) && !standBekannt) || Object.values(liste).some((e) => e?.ausStand)

/**
 * Der Text des Übersichtsknopfs: Titel, gewählte Treffer (`karten`) und Suchen getrennt, bei veralteter Liste mit Hinweis.
 * Neuladen der Seite hilft dort nie, die Erweiterung ist die alte. „Alles geprüft“ erst, wenn auch keine gewählte Karte offen ist.
 */
globalThis.akPrimeKnopfText = (offen, suchen, veraltet, karten = 0) => {
  if (!offen && !suchen && !karten) return veraltet ? 'Prime-Liste veraltet — Erweiterung aktualisieren' : 'Prime: alles geprüft'
  const teile = [offen && `${offen} Prime-Titel`, karten && `${karten} gewählte Treffer`, suchen && `${suchen} ${offen || karten ? 'Suchen' : 'Prime-Suchen'}`].filter(Boolean)
  const zahlen = `${teile.join(' · ')} offen`
  return veraltet ? `${zahlen} · Liste veraltet` : zahlen
}

/** Der Kopf der Prüfliste: offene Titel und offene gewählte Treffer, „Alles geprüft“ nur ohne beide. */
globalThis.akPrimeListenKopf = (offen, karten) => {
  const teile = [offen && `${offen} Prime-Titel`, karten && `${karten} gewählte Treffer`].filter(Boolean)
  return teile.length ? `${teile.join(' · ')} zu prüfen` : 'Alles geprüft'
}
