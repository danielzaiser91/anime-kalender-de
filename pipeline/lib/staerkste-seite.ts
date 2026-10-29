import { adressGleich, type DubCheck } from './dub-confirmed.ts'

/**
 * Wie viele Folgen ein Ja-Beleg geprüft hat („alle 14 Folgen geprüft" in der Notiz der Erweiterung); Neins und Belege ohne Zahl zählen 0.
 * Maßstab für gleich alte Belege verschiedener Seiten desselben Titels: Die Seite mit den meisten geprüften Folgen steht vorn.
 */
export function gepruefteFolgen(c: DubCheck): number {
  if (c.dub !== true) return 0
  return Number(/alle (\d+) Folgen geprüft/.exec(c.note ?? '')?.[1] ?? 0)
}

/** Sortierfolge der Belege einer Plattform: jüngster zuerst, bei gleichem Datum die Seite mit den meisten geprüften Folgen; sonst bleibt die Reihenfolge der Datei. */
export function vergleicheBelege(a: DubCheck, b: DubCheck): number {
  const nachDatum = (b.checkedAt ?? '').localeCompare(a.checkedAt ?? '')
  return nachDatum || gepruefteFolgen(b) - gepruefteFolgen(a)
}

/** Beim Ablegen je Titel und Plattform: Bei gleichem Datum ersetzt eine Seite mit weniger geprüften Folgen die bisherige nicht (Gleichstand oder fehlende Zahl: die spätere Zeile, wie zuvor). */
export function ersetztBeleg(bisher: DubCheck | undefined, neu: DubCheck): boolean {
  if (!bisher) return true
  if ((bisher.checkedAt ?? '') !== (neu.checkedAt ?? '')) return true
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
  if (!a || !b || (a.checkedAt ?? '') !== (b.checkedAt ?? '')) return false
  return gepruefteFolgen(b) < gepruefteFolgen(a)
}
