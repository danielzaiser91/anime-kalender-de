/**
 * **Welches Werk meint diese Meldung — der Auftrag weiß es, die Adresse nicht.**
 *
 * Disney+ führt dieselbe Serie unter zwei Adressen (`/series/<slug>/<id>` leitet auf
 * `/browse/entity-<uuid>` um), und eine Serienseite trägt alle Staffeln. Ohne die Kennung
 * muss der Bau die Adresse im Datensatz suchen und fällt sonst auf einen Namensvergleich
 * zurück, der kein Beleg ist — am 02.09.2026 warteten so 36 Meldungen auf Daniels
 * Bestätigung.
 *
 * Gesucht wird staffelgenau; ohne Staffelangabe nur, wenn der Auftrag genau ein Werk führt.
 * Eine falsche Kennung wäre schlimmer als keine — sie sieht aus wie ein Beleg.
 *
 * **Und die Nummer allein trägt nicht** (28.09.2026). Disney+ führt „Mission: Yozakura
 * Family" als Staffel 1 (27 Folgen, kein Deutsch) und Staffel 2 (12 Folgen, deutsch);
 * unser Bestand kennt an dieser Adresse nur die zweite — als `nr: 1`, weil die Prüfliste
 * ihre Staffeln als Positionsindex über `titles.json` zählt. Über die Nummer gebucht
 * landeten die 27 Folgen der ersten Staffel auf ihr (Kennungen 8405–8431, verworfen), und
 * die richtigen zwölf bekamen keine Kennung (`titel_id: null`).
 *
 * Deshalb zählt die Folgenzahl mit: Widerspricht sie der Nummer, ist die Zuordnung
 * widerlegt — dann bleibt die Kennung leer, und `fetch-rohfolgen.ts` entscheidet über
 * Folgentitel und Erstausstrahlung. Passt die Nummer gar nicht, kann die Folgenzahl sie
 * belegen, aber nur wenn sie auf **beiden** Seiten genau einmal vorkommt.
 *
 * Eigenes Modul statt in `disney.js`: Die ist über die Dateigrenze gewachsen
 * (`check:umfang`), und diese Rechnung braucht weder DOM noch Worker.
 */
;(() => {
  /**
   * Wie viele Folgen die Staffel der Seite führt — Platz 1 ist Staffel 1.
   *
   * Die Liste des Lesers kommt in der Reihenfolge der Seite, `gesamt` ist die Gesamtzahl
   * ihrer Folgen. Nennt der Name eine andere Nummer als der Platz hergibt, wird die
   * Reihenfolge nicht befragt: lieber keine Zahl als die falsche. Ohne Liste bleibt es bei
   * `null` — dann gilt die Nummer allein wie vor dem 28.09.2026.
   */
  function folgenDerSeite(staffelNr, anbieterStaffeln) {
    const liste = Array.isArray(anbieterStaffeln) ? anbieterStaffeln : []
    const nr = Number(staffelNr)
    if (!Number.isFinite(nr) || nr < 1) return null
    const s = liste[nr - 1]
    if (!s || !Number.isFinite(Number(s.gesamt))) return null
    const imNamen = /(\d+)/.exec(String(s.name ?? ''))
    if (imNamen && Number(imNamen[1]) !== nr) return null
    return Number(s.gesamt)
  }

  function titelIdFuer(staffeln, staffelNr, anbieterStaffeln) {
    try {
      const liste = Array.isArray(staffeln) ? staffeln : []
      if (!liste.length) return null
      if (staffelNr != null) {
        const folgen = folgenDerSeite(staffelNr, anbieterStaffeln)
        const genau = liste.find((st) => Number(st.nr) === Number(staffelNr))
        if (genau) {
          if (folgen == null || genau.folgen == null || Number(genau.folgen) === Number(folgen)) {
            return genau.id ?? null
          }
          return null
        }
        if (folgen == null) return null
        const alleDerSeite = (Array.isArray(anbieterStaffeln) ? anbieterStaffeln : [])
          .map((s) => Number(s.gesamt))
          .filter((n) => Number.isFinite(n))
        if (alleDerSeite.filter((n) => n === Number(folgen)).length !== 1) return null
        const ids = [
          ...new Set(
            liste
              .filter((st) => Number(st.folgen) === Number(folgen))
              .map((st) => st.id)
              .filter((x) => x != null),
          ),
        ]
        return ids.length === 1 ? ids[0] : null
      }
      const ids = [...new Set(liste.map((st) => st.id).filter((x) => x != null))]
      return ids.length === 1 ? ids[0] : null
    } catch {
      return null
    }
  }

  globalThis.AK_DISNEY_STAFFELN = { titelIdFuer }
})()
