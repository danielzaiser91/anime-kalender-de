/**
 * Ein Kanal-Titel belegt keine deutsche Synchro (Daniel, 11.10.2026: Hell Mode stand mit „Auf Deutsch, Prime Video
 * ✓ Deutsch“ da, bei ADN gibt es den Titel nur mit Untertiteln).
 *
 * Bei einem Kanal-Abo (ADN, aniverse, Crunchyroll über Prime) zeigt Amazon die Sprachen des Kanals, nicht die der Folge
 * (Kill Blue: Amazon 12 deutsche Folgen, ADN und Netflix je 4). Die Erweiterung schreibt solche Meldungen mit der Warnung
 * „Kanal-Titel“ in die Notiz. Das Urteil `dub: true` darin ist Amazons Angabe und damit kein Beleg; es wird beim Lesen
 * weggelassen und die Zeile mit `kanalOhneBeleg` gekennzeichnet. Sie bleibt als Adressbeleg (Seite, Kanal, Zugang) und
 * damit die Pille auf „🇩🇪 ?“ stehen. Auch jede andere Stelle, die aus derselben Amazon-Angabe ein Ja ableitet
 * (Urteil aus Stufe 3), lässt diese Adressen aus.
 *
 * Eine zweite, unabhängige Quelle hebt das auf: das Feld `zweiteQuelle` (dasselbe wie beim Nein).
 */
import { adressKern, type DubCheck } from './dub-confirmed.ts'

/** Trägt der Beleg die Kanal-Warnung der Erweiterung? */
export const istKanalTitel = (c: Pick<DubCheck, 'note'>): boolean => /Kanal-Titel/.test(c.note ?? '')

/** Der Beleg ohne Amazons Sprachangabe, wenn sie auf einem Kanal-Titel ohne zweite Quelle steht; sonst unverändert. */
export function ohneKanalSprache(c: DubCheck): DubCheck {
  if (!istKanalTitel(c) || c.zweiteQuelle) return c
  const sagtDeutsch = c.dub === true || Boolean(c.dubRanges?.some((r) => r.dub))
  if (!sagtDeutsch) return c
  const { dub: _dub, dubRanges: _bereiche, ...rest } = c
  return { ...rest, kanalOhneBeleg: true }
}

/** Die Amazon-Adressen (Kern), deren deutsche Tonspur nur Amazons Angabe auf einem Kanal-Titel ist. */
export function kanalAdressenOhneBeleg(checks: DubCheck[]): Set<string> {
  return new Set(checks.filter((c) => c.kanalOhneBeleg && c.dub !== true && c.url).map((c) => adressKern(c.url)))
}
