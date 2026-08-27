/**
 * **Aus einer Suchadresse wird die echte Titelseite.**
 *
 * 118 unserer Prime-Verweise sind Suchen statt Titelseiten — weder AniList noch
 * aniSearch führen für diese Titel eine Produktseite, und weder MOTN noch TMDB
 * kennen eine (beides am 27.08.2026 gemessen, beides null Treffer). Die
 * Erweiterung zeigt auf der Suchseite, welcher Titel gemeint ist; der Klick auf
 * den richtigen Treffer trägt ihn auf die Titelseite, wo die gewohnte Prüfung
 * läuft.
 *
 * Gemeldet wird trotzdem unter der **Suchadresse** — nur die kennt unser
 * Datensatz, und nur über sie findet die Übernahme den Titel wieder. Die echte
 * Seite steht in der Notiz, die jede Amazon-Meldung seit jeher mit ihrer
 * Kennung eröffnet (`Amazon-Seite B0B8MTPWRN: …`). Hier wird daraus der
 * Verweis, der künftig im Kalender steht.
 *
 * Ohne diesen Schritt bliebe der Befund richtig und der Verweis eine Suche —
 * der nächste Mensch, der ihn öffnet, stünde wieder vor einer Trefferliste.
 */
export function echteAmazonAdresse(p: {
  plattform: string
  url: string
  notiz: string | null
}): string | null {
  if (p.plattform !== 'primevideo' || !/\/s\?/.test(p.url)) return null
  /*
    Zehn Zeichen sind eine ASIN, sechsundzwanzig eine GTI. Beide führt Prime
    Video, und ein Muster auf `{10}` schnitt die lange Form ab — genau der
    Fehler, der am 25.08.2026 „Babylon" und „Akame ga Kill" unlesbar machte.
  */
  const kennung = /^Amazon-Seite ([A-Z0-9]{10,26})/.exec(p.notiz ?? '')?.[1]
  return kennung ? `https://www.amazon.de/dp/${kennung}` : null
}
