import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { bekanntZeile } from './zuordnung-fremd-bestand.ts'
import { findeFremdZugeordnete, type FremdZugeordnet, type ZuordnungEintrag } from './zuordnung-fremd.ts'
import { leseZugeordnet } from './prime-meldung-riegel.ts'
import type { BelegAdresse } from './handbeleg-fremde-adresse.ts'
import { liegenGeblieben, type OhneZuordnung } from './meldungen-liste.ts'
import { baueBesitz, type BesitzTitel, type Besitz as NotizBesitz } from './handbeleg-notizseite.ts'
import { verschiebeFremdeNotizseite } from './beleg-notizseite-zurueck.ts'

const KEINE_STREAMS: ReadonlyMap<string, string[]> = new Map()

/** Ein Zeitpunkt als Datum in Ortszeit Europe/Berlin (aus `fetch-pruefungen.ts` herausgelöst, damit die Datei nicht wächst). */
export function berlinDatum(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(iso))
}

/** Der Besitz an Adressen, gegen den ein neuer Handbeleg geprüft wird (einmal je Lauf geladen). */
export interface Besitz {
  zugeordnet: [string, ZuordnungEintrag][]
  belege: BelegAdresse[]
  /** Zahl der Belege, die dieser Lauf wegen fremder Adresse nicht geschrieben hat. */
  verschoben: number
  /** Meldungen (erste ID je Gruppe), bei denen mindestens ein Beleg ausfiel: der Schluss der Schleife meldet sie nicht noch einmal. */
  gruppen: Set<number>
  /** Besitz der Prime-Seiten (Titelliste + Zuordnung) für die Notizseite der Blöcke; fehlt ohne Titelliste. */
  notizseiten?: NotizBesitz
}

/**
 * Besitz aus Zuordnung und Handbelegen. Die Stream-Adressen der Cartoons und Titel ohne Synchro (`streamAdressen`) gehören nicht
 * dazu: der Schritt liest `public/data` nur über die Attrappen der Prüfungen (Bestandssperre in `check:logic`), diese Besitzer
 * bleiben bei `check-zuordnung-fremd-bestand` (Folgearbeit, siehe PR-Beschreibung).
 */
export function ladeBesitz(wurzel: string, titel?: BesitzTitel[]): Besitz {
  const datei = resolve(wurzel, 'data/dub-confirmed.yaml')
  const belege = (existsSync(datei) ? (yaml.load(readFileSync(datei, 'utf8')) as BelegAdresse[] | null) : null) ?? []
  // Über `leseZugeordnet` (einziger Zugang): ohne gesperrte Seiten. Der Wächter liest roh; nur bei gesperrten Seiten weicht das Urteil ab (der Einleser sperrt dort mal mehr, mal weniger).
  const zugeordnet = Object.entries(leseZugeordnet<ZuordnungEintrag>())
  const notizseiten = titel && baueBesitz(titel, Object.fromEntries(zugeordnet))
  return { zugeordnet, belege, verschoben: 0, gruppen: new Set(), notizseiten }
}

/**
 * **Ein neuer Handbeleg an einer Adresse, die schon einem anderen Titel gehört** (12.11.2026, Anlass: Beleg 143277 an der
 * Prime-Seite von 155645 machte `check-zuordnung-fremd-bestand` und damit den Bestandsbau rot). Dieselbe Besitz-Logik wie die
 * Prüfung (`findeFremdZugeordnete`): gesucht sind die Treffer, die erst durch den Beleg entstehen. Ist die Kennung selbst
 * Besitzerin der Adresse, entsteht keiner. Teilt die Meldung die Seite mit dem Besitzer (`mitBeteiligte`: alle Titel der
 * Meldung, z. B. die JoJo-Staffeln an einer ADN-Seite), schreibt der Lauf dessen Beleg selbst: kein Treffer.
 */
export function fremdeBesitzer(besitz: Besitz, kennung: number, mitBeteiligte: readonly number[], url: string): FremdZugeordnet[] {
  const vorher = new Set(findeFremdZugeordnete(besitz.zugeordnet, KEINE_STREAMS, besitz.belege).map(bekanntZeile))
  const mit = findeFremdZugeordnete(besitz.zugeordnet, KEINE_STREAMS, [...besitz.belege, { anilistId: kennung, url }])
  return mit.filter((t) => !vorher.has(bekanntZeile(t)) && !mitBeteiligte.includes(t.titleId))
}

/** Die Zeile für Lauf-Log und Arbeitsliste: wem die Adresse gehört (Titel der Zuordnung), der Beleg wird nicht geschrieben. */
export const fremdBesitzText = (t: FremdZugeordnet): string => `Adresse gehört schon Titel ${t.titleId}`

/**
 * Schützt vor dem Schreiben: gehört die Adresse schon einem anderen Titel, wird kein Beleg geschrieben. Die Meldung bleibt im
 * Briefkasten (verschoben, nicht gelöscht), steht in Warnungen und Arbeitsliste und zählt in `besitz.verschoben`.
 * Gibt `true` zurück, wenn der Beleg ausfällt.
 */
export function verschiebeFremdenBeleg(
  besitz: Besitz,
  kennung: number,
  ids: readonly number[],
  url: string,
  gruppe: readonly { id: number }[],
  p: { url: string; plattform: string; befund: string; serientitel: string | null; titel: string | null },
  warnungen: string[],
  liste: OhneZuordnung[],
): boolean {
  const fremd = fremdeBesitzer(besitz, kennung, ids, url)
  if (!fremd.length) return false
  besitz.verschoben++
  besitz.gruppen.add(gruppe[0]!.id)
  const grund = `Beleg für Titel ${kennung} (Meldung ${gruppe.map((x) => x.id).join(', ')}) nicht geschrieben: ${[...new Set(fremd.map(fremdBesitzText))].join(', ')}`
  liegenGeblieben(warnungen, liste, p, grund, [kennung], `Seite ${url} gehört schon einem anderen Titel: Zuordnung klären (Beleg wird nicht geschrieben)`)
  return true
}

/** Ein geschriebener Beleg in `zeilen`: Kennung, Adresse (fehlt beim „nicht geführt“-Eintrag) und seine Zeilen. */
export interface BelegBlock {
  id: number
  platform: string | undefined
  url: string | undefined
  note: string | undefined
  zeilen: string[]
}

function zerlegeBloecke(zeilen: readonly string[]): BelegBlock[] {
  const bloecke: BelegBlock[] = []
  for (const z of zeilen) {
    if (z === '') bloecke.push({ id: 0, platform: undefined, url: undefined, note: undefined, zeilen: [] })
    const b = bloecke[bloecke.length - 1]
    if (!b) continue
    b.zeilen.push(z)
    b.id ||= Number(/^- anilistId: (\d+)$/.exec(z)?.[1] ?? 0)
    b.platform ??= /^ {2}platform: (.+)$/.exec(z)?.[1]
    b.url ??= /^ {2}url: (.+)$/.exec(z)?.[1]
    const note = /^ {2}note: ("(?:[^"\\]|\\.)*")$/.exec(z)?.[1] // von `fetch-pruefungen` als JSON-String geschrieben
    if (note) b.note ??= JSON.parse(note) as string
  }
  return bloecke
}

/**
 * Nach der Schleife über die Titel einer Meldung: zieht jeden Beleg zurück, der an der Adresse eines anderen Titels hängt.
 * Mitbeteiligt (ausgenommen) ist nur ein Titel, dessen Beleg wirklich in `zeilen` steht: fiel er aus (keine Folge der Meldung
 * in seiner Staffel), bleibt der Treffer bestehen und der Bestandsbau würde rot. Der Besitzer, dessen Beleg selbst wegfällt (mehrere
 * Besitzer an einer Adresse), nimmt den anderen die Ausnahme nicht mehr: ein Durchgang, keine Wiederholung. `von` ist die Länge von `zeilen` vor der Schleife; gibt die Zahl
 * der zurückgezogenen Belege zurück.
 */
export function zieheFremdeBelegeZurueck(
  besitz: Besitz,
  zeilen: string[],
  von: number,
  gruppe: readonly { id: number }[],
  p: { url: string; plattform: string; befund: string; serientitel: string | null; titel: string | null },
  warnungen: string[],
  liste: OhneZuordnung[],
): number {
  const bloecke = zerlegeBloecke(zeilen.slice(von))
  const mit = bloecke.map((b) => b.id)
  let weg = 0
  for (const b of bloecke) {
    const fremdeAdresse = b.url !== undefined && verschiebeFremdenBeleg(besitz, b.id, mit, b.url, gruppe, p, warnungen, liste)
    if (!fremdeAdresse && !verschiebeFremdeNotizseite(besitz, b, gruppe, p, warnungen, liste)) continue
    b.zeilen = []
    weg++
  }
  zeilen.splice(von, zeilen.length - von, ...bloecke.flatMap((b) => b.zeilen))
  return weg
}
