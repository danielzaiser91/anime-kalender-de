/**
 * Invariante D-25 (11.10.2026): Ein Prime-Verweis auf einem Kanal-Titel trägt kein „✓ Deutsch“, das nur auf Amazons Sprachangabe beruht.
 *
 * Anlass: Hell Mode. Der Handbeleg vom 30.08. trug `dub: true` samt der eigenen Warnung „Kanal-Titel, Amazons Sprachangabe ist hier kein
 * Beleg“; die Seite zeigte „Auf Deutsch, Prime Video ✓ Deutsch“, bei ADN gibt es den Titel nur mit Untertiteln (Daniel). 790 Belege trugen
 * Widerspruch und Urteil zugleich. Der Lader lässt Amazons Angabe weg (`lib/kanal-titel.ts`); diese Prüfung hält auch jeden anderen Weg
 * dorthin zu. Eine zweite Quelle steht als `zweiteQuelle` im Handbeleg; der Bau kennt außerdem einen Termin bei Prime (Anime2You u. a.)
 * und aniSearch (`anderweitig`) — der Verweis trägt das Häkchen dann nicht allein auf Amazons Angabe. Gegenprobe: `pipeline/check-invarianten.ts`.
 */
import type { StreamLink, Title } from '../../shared/types.ts'
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

/** Die Adressen eines Wegs: die ausgelieferte und, wo die gti-Brücke sie umgestellt hat, die Amazon-Seite dahinter. */
const adressenVon = (s: StreamLink): string[] => [s.url, s.seite].filter((u): u is string => Boolean(u))

/**
 * D-27: Ein Titel, dessen Prime-Wege im vorigen Bestand auf Kanal-Adressen standen (`kanal`, Schlüssel aus `kanalAdressenOhneBeleg()`), trägt jetzt noch
 * einen Prime-Weg oder hat für jeden verlorenen einen Grund (`begruendet`: Abgang am Titel, Eintrag in `verweise-entfernt.json`, gemessen tote
 * Adresse, „nicht verfügbar“). Ein anderer Prime-Weg zählt als Ersatz: Wechselt ein Beleg die Ausgabe (neue ASIN), ist das kein Verlust.
 * Anlass: 16 Titel verloren ihren Prime-Weg ohne Spur, weil eine Amazon-Suche am Ende wegfiel (One Piece Film: Strong World u. a., 12.10.2026).
 * Ein Titel, der in `jetzt` fehlt, prüft der Titelschwund-Riegel in 13-2.
 */
export function kanalWegVerloren(
  vorher: readonly Title[],
  jetzt: readonly Title[],
  kanal: ReadonlySet<string>,
  begruendet: (t: Title, urls: string[]) => boolean,
): string[] {
  const jetztJeId = new Map(jetzt.map((t) => [t.id, t]))
  const fehler: string[] = []
  for (const alt of vorher) {
    const neu = jetztJeId.get(alt.id)
    if (!neu || (neu.streams ?? []).some((s) => s.platform === 'primevideo')) continue
    for (const weg of (alt.streams ?? []).filter((s) => s.platform === 'primevideo' && kanal.has(kanalSchluessel(alt.id, s.url)))) {
      if (begruendet(neu, adressenVon(weg))) continue
      fehler.push(`Titel ${alt.id} (${alt.titleRomaji}): Prime-Weg ${weg.url} (Kanal) stand im vorigen Bestand, der Titel hat jetzt keinen Prime-Weg mehr und keinen Protokolleintrag`)
    }
  }
  return fehler
}
