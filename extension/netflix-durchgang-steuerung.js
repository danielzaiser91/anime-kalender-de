/*
  **Netflix-Durchgang: Anzeige und Auftragswahl, die `melder.js` nicht vergrößern** — eigene Datei, weil
  `melder.js` über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`.
*/

/**
 * Zeichnet (oder entfernt) die Zeile „Durchgang fertig / abgebrochen" im Kasten.
 * `zeile()`: liefert `.ak-z-melden` oder `null`; `ende`: `durchgangEnde` oder `null`; `zurueck`: Text der zurückgestellten Titel.
 */
globalThis.akNetflixEndeZeigen = (zeileHolen, ende, zurueck) => {
  try {
    const zeile = zeileHolen()
    if (!zeile) return
    let el = zeile.querySelector('.ak-durchgang-ende')
    if (!ende) return el?.remove()
    if (!el) {
      el = document.createElement('div')
      el.className = 'ak-hinweis ak-durchgang-ende'
      zeile.appendChild(el)
    }
    el.classList.toggle('ak-durchgang-rot', Boolean(ende.rot))
    el.textContent =
      (ende.grund === 'kein offener Auftrag mehr' ? 'Durchgang fertig' : `Durchgang abgebrochen · ${ende.grund}`) +
      ende.uebersprungenText +
      (zurueck + ende.text)
    el.title = ende.grund
  } catch {
    /* Eine Anzeige darf den Takt nicht aufhalten. */
  }
}

/**
 * Der Auftrag, den ein Klick aus der Liste auf `/browse` hinterlassen hat (höchstens eine Minute alt,
 * noch nicht gemeldet, auf der Prüfliste), sonst `null`. `z`: `zuletztGeoeffnet`; `offen`: `offeneTitel`.
 */
globalThis.akNetflixBrowseAuftrag = (z, offen, jetzt) => {
  try {
    return z?.id && !z.verbraucht && offen[z.id] !== undefined && jetzt - (z.zeit ?? 0) < 60 * 1000 ? z : null
  } catch {
    return null
  }
}
