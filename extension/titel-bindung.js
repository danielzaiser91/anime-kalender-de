/*
  **Das Panel gehört zu dem Titel, den die Adresse nennt — verlässt die Seite ihn, ist es leer** (19.11.2026).

  Anlass: Meldung 27504 sagte „weg“ für Landei II und nannte selbst 12 deutsche Folgen. Das Panel trug noch den Titel der
  verlassenen Seite (Prime-Startseite), und ein Klick meldete ihn. Jeder Anbieter hat eine Adresswache; sie fragt
  hier einmal je Takt `pruefen()`. Das Zurücksetzen selbst bleibt beim Anbieter (`beiWechsel`), die Regel „wann“ und die
  Sperre für laufende Klicks (`karte` / `gueltig`) sind für alle dieselben.
  Ohne Browser-Zustand, damit `titel-bindung.test.cjs` es im Sandkasten spielen kann.
*/
globalThis.akTitelBindung = (() => {
  /**
   * `kennung()` nennt den Titel der Adresse (null: keine Titelseite). `beiWechsel(alt, neu)` (optional) läuft einmal je
   * Wechsel. Eine Karte verfällt beim Verlassen und bei der Rückkehr; den Wechsel von Titel zu Titel prüft der Anbieter selbst.
   */
  function fuer({ kennung, beiWechsel }) {
    let an = kennung()
    let zaehler = 0
    return {
      /** Aus der Adresswache des Anbieters; nennt, ob die Seite einen Titel zeigt. */
      pruefen() {
        const jetzt = kennung()
        if (jetzt !== an) {
          const alt = an
          an = jetzt
          if (alt === null || jetzt === null) zaehler++
          beiWechsel?.(alt, jetzt)
        }
        return jetzt !== null
      },
      /** Zu Beginn eines Klicks: Marke der Seite, auf der er entstand; null ohne Titelseite. */
      karte() {
        return this.pruefen() ? { an, zaehler } : null
      },
      /** Vor jedem Senden: gilt die Seite des Klicks noch? */
      gueltig(karte) {
        return Boolean(karte) && this.pruefen() && karte.zaehler === zaehler
      },
    }
  }
  return { fuer }
})()
