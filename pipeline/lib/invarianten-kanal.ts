/**
 * Invariante D-25 (11.10.2026): Ein Prime-Verweis auf einem Kanal-Titel trägt kein „✓ Deutsch“, das nur auf Amazons Sprachangabe beruht.
 *
 * Anlass: Hell Mode. Der Handbeleg vom 30.08. trug `dub: true` samt der eigenen Warnung „Kanal-Titel, Amazons Sprachangabe ist hier kein
 * Beleg“; die Seite zeigte „Auf Deutsch, Prime Video ✓ Deutsch“, bei ADN gibt es den Titel nur mit Untertiteln (Daniel). 790 Belege trugen
 * Widerspruch und Urteil zugleich. Der Lader lässt Amazons Angabe weg (`lib/kanal-titel.ts`); diese Prüfung hält auch jeden anderen Weg
 * dorthin zu. Eine zweite Quelle steht als `zweiteQuelle` im Handbeleg; der Bau kennt außerdem einen Termin bei Prime (Anime2You u. a.)
 * und aniSearch (`anderweitig`) — der Verweis trägt das Häkchen dann nicht allein auf Amazons Angabe. Gegenprobe: `pipeline/check-invarianten.ts`.
 */
import type { Title } from '../../shared/types.ts'
import { kanalSchluessel } from './kanal-titel.ts'

/** Trägt der Titel eine deutsche Fassung auch ohne den Kanal-Verweis (anderer Weg mit Beleg, Erstausgabe, Sprecher, `anderweitig`)? */
function hatAndereQuelle(t: Title, kanal: ReadonlySet<string>, anderweitig: (t: Title) => boolean): boolean {
  const andererWeg = (t.streams ?? []).some((s) => s.dub === true && !(s.platform === 'primevideo' && kanal.has(kanalSchluessel(t.id, s.url))))
  return andererWeg || Boolean(t.deErstausgabe) || Boolean(t.hasVoices) || anderweitig(t)
}

/**
 * `kanal`: die Schlüssel aus `kanalAdressenOhneBeleg()`; `anderweitig`: Termin bei Prime oder aniSearch „deutsch“.
 * Meldet jeden Prime-Verweis mit `dub: true` auf einer Kanal-Adresse, wenn der Titel sonst nichts Deutsches trägt.
 */
export function kanalTitelOhneBeleg(titles: Iterable<Title>, kanal: ReadonlySet<string>, anderweitig: (t: Title) => boolean): string[] {
  const fehler: string[] = []
  for (const t of titles) {
    const verweise = (t.streams ?? []).filter((s) => s.platform === 'primevideo' && s.dub === true && kanal.has(kanalSchluessel(t.id, s.url)))
    if (!verweise.length || hatAndereQuelle(t, kanal, anderweitig)) continue
    for (const s of verweise) {
      fehler.push(`Titel ${t.id} (${t.titleRomaji}): Prime-Verweis ${s.url} trägt „✓ Deutsch“, aber der Beleg ist ein Kanal-Titel (Amazons Sprachangabe, keine zweite Quelle)`)
    }
  }
  return fehler
}

/**
 * D-26: Ein Kanal-Weg ohne eigene Aussage (`stumm`, Schlüssel aus `kanalAdressenOhneAussage()`) wird nie als „entfernt“ geführt. Ein Nein oder
 * „nicht verfügbar“ zu einer anderen Adresse desselben Titels gilt für ihn nicht (Goblin Slayer II, JoJo Diamond is Unbreakable, 12.10.2026).
 */
export function kanalWegEntfernt(entfernt: { titleId: number; plattform: string; url: string; grund?: string }[], stumm: ReadonlySet<string>): string[] {
  return entfernt
    .filter((e) => e.plattform === 'primevideo' && stumm.has(kanalSchluessel(e.titleId, e.url)))
    .map((e) => `Titel ${e.titleId}: Prime-Weg ${e.url} steht in verweise-entfernt.json (${e.grund ?? 'ohne Grund'}), aber zu dieser Adresse gibt es nur eine Kanal-Zeile ohne Aussage`)
}
