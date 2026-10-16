/*
  **ADN: senden und die Antwort je Zeile auswerten** (4.31.5).

  Ein Stapel an `/pruefung` antwortet mit HTTP 200 und `ergebnisse[i]` je Meldung (`{ ok }` oder
  `{ ok: false, grund }`). Gemeldet ist nur, was dort `ok` ist — der HTTP-Status allein sagt es nicht.
  Ohne Browser-Zustand, damit `adn.test.cjs` es im Sandkasten spielen kann.
*/
globalThis.AK_ADN_SENDEN = (() => {
  /** Ein POST samt Antwortkörper: `sende` (disney-netz.js) nennt nur ok/Fehler. */
  async function sendeMitKoerper({ sende, holen, url, token, body }) {
    let daten = null
    const mitKoerper = async (...a) => {
      const r = await holen(...a)
      daten = await r.clone().json().catch(() => null)
      return r
    }
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token }, body: JSON.stringify(body) }
    const antwort = await sende(url, init, { holen: mitKoerper })
    return { ...antwort, daten }
  }

  /** Je Zeile: angenommen (gemerkt) oder abgelehnt (Grund des Servers; bleibt offen und erneut sendbar). */
  function ergebnisseEintragen(S, schluessel, teil, ergebnisse) {
    teil.forEach((z, i) => {
      const e = Array.isArray(ergebnisse) ? ergebnisse[i] : null
      if (e?.ok) {
        S.gemeldet.add(schluessel(z))
        S.neuGemeldet++
      } else {
        S.abgelehnt.set(schluessel(z), e?.grund ?? 'Server nannte kein Ergebnis')
      }
    })
  }

  /** Zeile für den Kasten, wenn offene Zeilen abgelehnt wurden; sonst null. */
  function abgelehntText(S, schluessel, offen) {
    const abgelehnt = offen.filter((z) => S.abgelehnt.has(schluessel(z)))
    if (!abgelehnt.length) return null
    const gruende = [...new Set(abgelehnt.map((z) => S.abgelehnt.get(schluessel(z))))].join(' / ')
    return `✗ ${abgelehnt.length} abgelehnt: ${gruende}\n▸ ${offen.length} erneut melden`
  }

  return { sendeMitKoerper, ergebnisseEintragen, abgelehntText }
})()
