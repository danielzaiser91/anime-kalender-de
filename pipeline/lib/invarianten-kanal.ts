/**
 * Invariante D-25 (11.10.2026): Ein Prime-Verweis auf einem Kanal-Titel trägt kein „✓ Deutsch“, das nur auf Amazons Sprachangabe beruht.
 *
 * Anlass: Hell Mode. Der Handbeleg vom 30.08. trug `dub: true` samt der eigenen Warnung „Kanal-Titel, Amazons Sprachangabe ist hier kein
 * Beleg“; die Seite zeigte „Auf Deutsch, Prime Video ✓ Deutsch“, bei ADN gibt es den Titel nur mit Untertiteln (Daniel). 790 Belege trugen
 * Widerspruch und Urteil zugleich. Der Lader lässt Amazons Angabe weg (`lib/kanal-titel.ts`); diese Prüfung hält auch jeden anderen Weg
 * dorthin zu. Eine zweite Quelle steht als `zweiteQuelle` im Handbeleg. Gegenprobe: `pipeline/check-invarianten.ts`.
 */
import type { Title } from '../../shared/types.ts'
import { adressKern } from './dub-confirmed.ts'

/** `kanal`: die Adresskerne aus `kanalAdressenOhneBeleg()`. Meldet jeden Prime-Verweis mit `dub: true` auf einer davon. */
export function kanalTitelOhneBeleg(titles: Iterable<Title>, kanal: ReadonlySet<string>): string[] {
  const fehler: string[] = []
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      if (s.platform !== 'primevideo' || s.dub !== true || !kanal.has(adressKern(s.url))) continue
      fehler.push(`Titel ${t.id} (${t.titleRomaji}): Prime-Verweis ${s.url} trägt „✓ Deutsch“, aber der Beleg ist ein Kanal-Titel (Amazons Sprachangabe, keine zweite Quelle)`)
    }
  }
  return fehler
}
