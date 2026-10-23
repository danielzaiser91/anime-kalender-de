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
import { amazonTitelAdresse } from './amazon-adresse.ts'
import { adressKern, type DubCheck } from './dub-confirmed.ts'
import { hatDeutschenTon } from '../../shared/sprachen-ton.ts'

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

/**
 * Die Schlüssel (Titel und Amazon-Adresse), deren deutsche Tonspur nur Amazons Angabe auf einem Kanal-Titel ist, dazu je Eintrag die gelesene Seite:
 * Ein Weg aus den Rohfolgen trägt die Seite als Adresse, und die kann von der Adresse des Belegs abweichen (153 von 673 Merklisten-Einträgen, 19.10.2026).
 */
export function kanalAdressenOhneBeleg(checks: DubCheck[]): Set<string> {
  const kanal = checks.filter((c) => c.kanalOhneBeleg && c.dub !== true && c.url)
  return new Set(kanal.flatMap((c) => [kanalSchluessel(c.anilistId, c.url), `${c.anilistId}|${belegSeitenKern(c)}`]))
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

/** Die Seite, die die Notiz eines Belegs ausdrücklich nennt („Amazon-Seite <ASIN>“). */
export const notizSeite = (c: Pick<DubCheck, 'note'>): string | undefined => /Amazon-Seite ([A-Za-z0-9]+)/.exec(c.note ?? '')?.[1]

/** Die Amazon-Seite, die ein Beleg beschreibt: die genannte, sonst seine Adresse. */
export function belegSeitenKern(c: Pick<DubCheck, 'note' | 'url'>): string {
  const asin = notizSeite(c)
  if (asin) return adressKern(`https://www.amazon.de/dp/${asin}`)
  return adressKern(c.url)
}

/** Die Schlüssel (Titel und gelesene Seite), deren Deutsch nur Amazons Angabe auf einem Kanal-Titel ist. */
export function kanalSeitenOhneBeleg(checks: DubCheck[]): Set<string> {
  return new Set(checks.filter((c) => c.kanalOhneBeleg && c.dub !== true && c.url).map((c) => `${c.anilistId}|${belegSeitenKern(c)}`))
}

const kanalSeitenMengen = new WeakMap<DubCheck[], Set<string>>()

function kanalSeitenMenge(checks: DubCheck[]): Set<string> {
  if (!kanalSeitenMengen.has(checks)) kanalSeitenMengen.set(checks, kanalSeitenOhneBeleg(checks))
  return kanalSeitenMengen.get(checks)!
}

/** Ist diese Rohfolgen-Gruppe eine Kanal-Seite? Je gelesener Seite; nur ohne gelesene Seite zählt die Prüflisten-Adresse, eine Suchadresse dann nie. */
function istKanalGruppe(titelId: number, gruppe: { seite?: string | null; url: string }, alleChecks: DubCheck[]): boolean {
  if (gruppe.seite) return kanalSeitenMenge(alleChecks).has(`${titelId}|${adressKern(amazonTitelAdresse(gruppe.seite))}`)
  if (/amazon\.[a-z.]+\/s\?/i.test(gruppe.url)) return false
  return kanalMenge(alleChecks).has(kanalSchluessel(titelId, gruppe.url))
}

/**
 * Belegt eine gemeldete Folgenliste (`prime-zugeordnet.json`) Deutsch? `undefined`: keine Folge nennt Deutsch. `false`: Deutsch steht da, aber auf
 * einer Kanal-Seite (`gruppe`, null bei anderen Anbietern) — Amazon führt dort je Folge die Sprachen des Kanals, die Rohmeldung ist dieselbe
 * Angabe wie der Handbeleg. Unter einer Kanal-Adresse liegen auch Seiten ohne Kanal, deshalb zählt die gelesene Seite, nicht die Prüflisten-Adresse.
 * Der Verweis selbst bleibt (Adresse, Kanal), nur das Häkchen entfällt.
 */
export function rohDeutsch(folgen: { sprachen: string[] }[], titelId: number, gruppe: { seite?: string | null; url: string } | null, alleChecks: DubCheck[]): boolean | undefined {
  if (!folgen.some((f) => hatDeutschenTon(f.sprachen))) return undefined
  return !(gruppe && istKanalGruppe(titelId, gruppe, alleChecks))
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

/**
 * Adresskerne, auf denen ein Kanal-Ja steht, das der Lader weggelassen hat: Eine neue Messung dort wird geschrieben, auch ein Nein.
 * Eine jüngere Nein-Messung hat das Ja abgelöst (`verschmelze()` behält `kanalOhneBeleg` des älteren Eintrags): Die Adresse zählt dann
 * nicht mehr, sonst schriebe jede weitere Nein-Meldung einen neuen Block ohne neue Aussage (12.10.2026).
 */
export function kanalJaAdressKerne(checks: DubCheck[]): Set<string> {
  return new Set(checks.filter((c) => c.kanalOhneBeleg && c.url && c.kanalMessung !== 'nein').map((c) => adressKern(c.url)))
}
