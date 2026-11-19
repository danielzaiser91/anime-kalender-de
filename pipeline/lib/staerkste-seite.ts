import { adressGleich, type DubCheck } from './dub-confirmed.ts'
import { istKanalTitel } from './kanal-titel.ts'

/**
 * Wie viele Folgen ein Ja-Beleg geprüft hat („alle 14 Folgen geprüft" in der Notiz der Erweiterung); Neins und Belege ohne Zahl zählen 0.
 * Maßstab für gleich alte Belege verschiedener Seiten desselben Titels: Die Seite mit den meisten geprüften Folgen steht vorn.
 */
export function gepruefteFolgen(c: DubCheck): number {
  if (c.dub !== true) return 0
  return Number(/alle (\d+) Folgen geprüft/.exec(c.note ?? '')?.[1] ?? 0)
}

/**
 * Sortierfolge der Belege einer Plattform: jüngster zuerst, bei gleichem Datum die Abo-Ausgabe vor der Kanal-Ausgabe, innerhalb einer Ausgabe die Seite
 * mit den meisten geprüften Folgen; sonst bleibt die Reihenfolge der Datei. Kanal und Abo zählen ihre Folgen nicht gegeneinander (Yu-Gi-Oh! 481:
 * 40 Kanal-Folgen verdrängten die 25 der Abo-Seite); die feste Ausgabe-Reihenfolge hält den Vergleich widerspruchsfrei.
 */
export function vergleicheBelege(a: DubCheck, b: DubCheck): number {
  const nachDatum = (b.checkedAt ?? '').localeCompare(a.checkedAt ?? '')
  return nachDatum || Number(istKanalTitel(a)) - Number(istKanalTitel(b)) || gepruefteFolgen(b) - gepruefteFolgen(a)
}

/** Ein Ja und ein Nein an verschiedenen Adressen (beide mit Adresse). */
function nurEinJaAnAndererAdresse(a: DubCheck, b: DubCheck): boolean {
  return Boolean(a.url && b.url && !adressGleich(a.url, b.url)) && [a.dub, b.dub].includes(true) && [a.dub, b.dub].includes(false)
}

/** Beim Ablegen je Titel und Plattform: Ein älteres Datum ersetzt nie ein jüngeres (Shana 355, 19.11.2026). Bei gleichem Datum ersetzt eine Seite mit weniger geprüften Folgen die bisherige nicht, solange beide zur selben Ausgabe (Kanal oder Abo) gehören (Gleichstand oder fehlende Zahl: die spätere Zeile, wie zuvor). */
export function ersetztBeleg(bisher: DubCheck | undefined, neu: DubCheck): boolean {
  if (!bisher) return true
  const nachDatum = (neu.checkedAt ?? '').localeCompare(bisher.checkedAt ?? '')
  /* Bei verschiedenem Datum widerlegt ein Nein einer anderen Adresse ein Ja nicht (My First Girlfriend 97863: Kanal-Seite B0GV5SHH5P gegen Kauf-Seite B0GPD4GNLL). */
  if (nachDatum && nurEinJaAnAndererAdresse(bisher, neu)) return neu.dub === true
  if (nachDatum) return nachDatum > 0
  if (istKanalTitel(bisher) !== istKanalTitel(neu)) return true
  const alt = gepruefteFolgen(bisher)
  const jetzt = gepruefteFolgen(neu)
  /* Ohne Zahl an einer der beiden Seiten gibt es nichts zu vergleichen: wie zuvor gewinnt die spätere Zeile. */
  return !(alt > 0 && jetzt > 0 && jetzt < alt)
}

/**
 * Ist `seite` die schwächere Schwester der vorhandenen Seite: gleich alter Handbeleg, weniger geprüfte Folgen? Dann hat der Beleg-Weg die
 * stärkere gewählt (`vergleicheBelege`), und die gemeldete schwächere legt keinen zweiten Weg daneben an (Naruto Shippuden: 33 gegen 7 Folgen).
 */
export function istSchwaechereSchwester(belege: DubCheck[], vorhandeneUrl: string, seite: string): boolean {
  const a = belege.find((c) => c.url && adressGleich(c.url, vorhandeneUrl))
  const b = belege.find((c) => c.url && adressGleich(c.url, seite))
  /* Kanal-Adresse und Prime-Abo-Adresse sind verschiedene Ausgaben, nie Schwestern (Yu-Gi-Oh! 481, 18.11.2026). */
  if (!a || !b || istKanalTitel(a) !== istKanalTitel(b) || (a.checkedAt ?? '') !== (b.checkedAt ?? '')) return false
  return gepruefteFolgen(b) < gepruefteFolgen(a)
}
