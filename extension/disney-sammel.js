/**
 * **Disney+: „schon gemeldet" für alle Adressen der Übersicht in einer Anfrage** (`?gemeldet-liste=`, Worker
 * `pruefung-gemeldet-sammel.ts`; 16.11.2026, Folge von Issue 4058). Vorher fragte die Übersicht je Adresse einzeln, sobald
 * das Gedächtnis (`disney-netz.js`, 30 Minuten) sie nicht kannte.
 *
 * Die Anfrage geht erst beim ersten Bedarf hinaus: kennt das Gedächtnis alles, fällt keine an. `null`: die Route fehlt oder
 * ist nicht zu lesen — dann gilt der Einzelabruf. Keine Auskunft (429, 5xx, Netz) wirft, damit die Ablage kein „nichts" merkt.
 */
globalThis.akDisneySammel = (worker, adressen, holen = fetch) => {
  let antwort
  return async (url) => {
    /* 250 = `SAMMEL_MAX` des Workers; darüber lehnt er ab. */
    antwort ??= adressen().length > 250 ? Promise.resolve(null) : globalThis.akGemeldetSammel(worker, adressen(), holen)
    const je = await antwort
    if (je === false) throw new Error('keine Auskunft')
    return je ? je.get(url) : null
  }
}

/** Die Antwort des Workers für eine Adresse: aus der Sammelanfrage, sonst einzeln (`?gemeldet=`, nicht zwischengespeichert). */
globalThis.akDisneyGemeldet = async (worker, url, sammel = null) => {
  const aus = await sammel?.(url)
  if (aus) return aus
  const antwort = await fetch(`${worker}?gemeldet=${encodeURIComponent(url)}`, { cache: 'no-store' })
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`)
  return antwort.json()
}
