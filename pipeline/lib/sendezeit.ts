/**
 * Liest Sendezeiten aus dem Fließtext einer Meldung.
 *
 * **Die Uhrzeit steht im Artikeltext, und nur mit Wochentag ist sie eine.**
 *
 * Gemessen am 16.09.2026, weil 13 künftige Netflix-Termine ohne Uhrzeit im
 * Kalender standen und die Frage war, ob es dafür überhaupt eine Quelle gibt.
 * Es gibt sie — in den „Simulcast gestartet"-Meldungen von Anime2You, drei von
 * drei geprüften nennen sie im Klartext:
 *
 * > „Weitere Episoden erscheinen jeden Samstag um 18:00 Uhr."
 * > „Fortan erscheint jeden Mittwoch um 16:00 Uhr jeweils eine neue Folge."
 *
 * Ankündigungen, Monatsübersichten und Season-Vorschauen nennen keine (drei von
 * drei ohne), und die 25 Anime2You-Artikel, die in `data/curated/` als Quelle
 * stehen, ebenfalls nicht — null von 25. Rückwirkend ist hier also nichts zu
 * holen; der Gewinn liegt beim nächsten Start.
 *
 * Der Feed-Auszug hilft nicht: Er bricht nach rund 2 KB ab, vor dem Ablaufteil,
 * und enthält über 75 Artikel **keine** einzige Sendezeit.
 *
 * **Der Wochentag ist der Riegel, nicht der Zierrat.** Eine nackte Uhrzeit
 * trifft die Zeitstempel der Seitenleiste („Neueste News … 19:45 Uhr"): elf
 * Fehlalarme je Seite, gemessen an acht Artikeln. Mit Wochentag davor: null.
 */
const SENDEZEIT = /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)s?\s*(?:um|ab)\s+(\d{1,2})[:.](\d{2})\s*Uhr/gi

/** Eine im Artikel genannte Sendezeit, mit dem Satz, der sie belegt. */
export interface Sendezeit {
  tag: string
  /** `HH:MM`, wie `schedule.time` — damit sich beides ohne Umrechnung vergleichen lässt. */
  zeit: string
  /** Der Satz drumherum. Ohne ihn ist nicht erkennbar, welche Serie gemeint ist. */
  satz: string
}

export function sendezeiten(text: string): Sendezeit[] {
  const gefunden: Sendezeit[] = []
  for (const treffer of text.matchAll(SENDEZEIT)) {
    const stelle = treffer.index ?? 0
    gefunden.push({
      tag: treffer[1],
      zeit: `${treffer[2].padStart(2, '0')}:${treffer[3]}`,
      satz: text.slice(Math.max(0, stelle - 180), stelle + treffer[0].length + 40).trim(),
    })
  }
  return gefunden
}
