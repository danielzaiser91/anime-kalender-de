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

/** Schlüssel „Titel|Adresskern": eine Seite kann mehreren Titeln gehören, betroffen ist nur der Titel mit dem Kanal-Beleg. */
export const kanalSchluessel = (titelId: number, url: string | undefined): string => `${titelId}|${adressKern(url)}`

/** Die Schlüssel (Titel und Amazon-Adresse), deren deutsche Tonspur nur Amazons Angabe auf einem Kanal-Titel ist. */
export function kanalAdressenOhneBeleg(checks: DubCheck[]): Set<string> {
  return new Set(checks.filter((c) => c.kanalOhneBeleg && c.dub !== true && c.url).map((c) => kanalSchluessel(c.anilistId, c.url)))
}

/** Wie `kanalAdressenOhneBeleg`, aber nur Seiten ohne jede eigene Aussage zu genau dieser Adresse (weder Ja noch Nein noch „nicht verfügbar“). */
export function kanalAdressenOhneAussage(checks: DubCheck[]): Set<string> {
  const stumm = checks.filter((c) => c.kanalOhneBeleg && c.dub === undefined && c.available === undefined && c.url)
  return new Set(stumm.map((c) => kanalSchluessel(c.anilistId, c.url)))
}

const kanalMengen = new WeakMap<DubCheck[], Set<string>>()

/** `kanalAdressenOhneBeleg()` einmal je Belegliste: Der Bau fragt es je Weg und je Rohmeldung. */
function kanalMenge(checks: DubCheck[]): Set<string> {
  if (!kanalMengen.has(checks)) kanalMengen.set(checks, kanalAdressenOhneBeleg(checks))
  return kanalMengen.get(checks)!
}

/**
 * Rückfall von `belegFuer()` (09-1-belege.ts), wenn kein Beleg die Adresse nennt: bei einem einzigen Weg der jüngste Beleg als Korrektur,
 * ab zwei Wegen keiner. Eine Kanal-Zeile ohne Aussage hält ihre Adresse: Das Nein einer fremden Adresse gilt für sie nicht
 * (Goblin Slayer II, JoJo Diamond is Unbreakable, 12.10.2026).
 */
export function belegOhneGenaueAdresse(liste: DubCheck[], anzahlWege: number, alleChecks: DubCheck[], titelId: number, url: string | undefined): DubCheck | undefined {
  if (url && kanalMenge(alleChecks).has(kanalSchluessel(titelId, url))) return undefined
  return anzahlWege > 1 ? undefined : liste[0]
}

/**
 * Belegt eine gemeldete Folgenliste (`prime-zugeordnet.json`) Deutsch? `undefined`: keine Folge nennt Deutsch. `false`: Deutsch steht da, aber auf
 * einer Kanal-Seite (`seite`, sonst null) — Amazon führt dort je Folge die Sprachen des Kanals, die Rohmeldung ist dieselbe Angabe wie der Handbeleg.
 * Der Verweis selbst bleibt (Adresse, Kanal), nur das Häkchen entfällt.
 */
export function rohDeutsch(folgen: { sprachen: string[] }[], titelId: number, seite: string | null, alleChecks: DubCheck[]): boolean | undefined {
  if (!folgen.some((f) => f.sprachen.includes('Deutsch'))) return undefined
  return !(seite && kanalMenge(alleChecks).has(kanalSchluessel(titelId, seite)))
}

/**
 * Sagt eine Kanal-Meldung nichts Neues? Ohne Ja, ohne Folgenbefund (`eigene` = Zahl der Bereiche), auf einer bekannten Adresse ohne eigene
 * Amazon-Kennung: `fetch-pruefungen.ts` lässt sie aus, sie würde nur einen jüngeren Beleg verdecken.
 */
export function kanalOhneAussage(
  weg: unknown,
  gruppe: { befund?: string; notiz?: string | null }[],
  echteAdresse: unknown,
  bekannt: boolean,
  eigene: number,
): boolean {
  return (
    !weg &&
    !gruppe.some((x) => x.befund === 'dub') &&
    !echteAdresse &&
    bekannt &&
    !eigene &&
    gruppe.some((x) => /Kanal-Titel/.test(x.notiz ?? ''))
  )
}

/** Adresskerne, auf denen ein Kanal-Ja steht, das der Lader weggelassen hat: Eine neue Messung dort wird geschrieben, auch ein Nein. */
export function kanalJaAdressKerne(checks: DubCheck[]): Set<string> {
  return new Set(checks.filter((c) => c.kanalOhneBeleg && c.url).map((c) => adressKern(c.url)))
}
