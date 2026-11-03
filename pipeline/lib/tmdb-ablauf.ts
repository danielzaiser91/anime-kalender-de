/**
 * **TMDB darf nur sechs Monate zwischengespeichert werden** (API-Bedingungen 1.C, Wortlaut in `docs/wissen/quellen.md`, 12.10.2026).
 *
 * Wir fassen bei 150 Tagen an, damit zwischen Streichung und Frist (180 Tage) Läufe liegen. Was TMDB-Inhalt ist (Handlung, Name,
 * Anbieter, FSK), verfällt; die Zuordnung (`tmdbId`, `kind`, `jahr`) ist unser Urteil, welches Werk gemeint ist, und bleibt.
 */
export const STREICH_TAGE = 150
export const FRIST_TAGE = 180

/** Felder von `data/tmdb-titles.json`, die TMDB-Inhalt tragen. */
export const INHALTSFELDER = ['overviewDe', 'nameDe', 'fsk', 'providers', 'offers', 'justwatchUrl', 'kinoDe'] as const

export interface MitInhaltsstand {
  fetchedAt?: string
  /** Wann der Inhalt zuletzt von TMDB kam; `fetchedAt` auch dann, wenn ein Fehltreffer den Inhalt stehen ließ. */
  inhaltAm?: string
}

type Feld = Record<string, unknown>

export const hatInhalt = (e: MitInhaltsstand): boolean => INHALTSFELDER.some((f) => (e as Feld)[f] !== undefined)

/** Volle Tage seit einem Stand (ISO-Datum); ohne Datum unbekannt (`undefined`). */
export function tageSeit(stand: string | undefined, jetzt: Date): number | undefined {
  const t = stand ? Date.parse(stand) : NaN
  return Number.isNaN(t) ? undefined : Math.floor((jetzt.getTime() - t) / 86_400_000)
}

/** Das Datum, ab dem die Frist zählt. */
export const inhaltsStand = (e: MitInhaltsstand): string | undefined => e.inhaltAm ?? e.fetchedAt

/** Der Eintrag nach einem Abruf; ein Fehltreffer lässt den Inhalt stehen und trägt dessen echtes Alter (`inhaltAm`) mit. */
export function nachAbruf<T extends MitInhaltsstand & { miss?: boolean; tmdbId?: number; nameDe?: string; overviewDe?: string }>(vorher: T | undefined, neu: T, jetzt: string): T {
  if (neu.miss && vorher?.tmdbId) return { ...vorher, inhaltAm: inhaltsStand(vorher), fetchedAt: jetzt }
  return { ...neu, ...handlungDerselbenSerie(vorher, neu, jetzt), inhaltAm: jetzt, fetchedAt: jetzt }
}

type MitHandlung = { tmdbId?: number; nameDe?: string; overviewDe?: string }

/** Ersetzt eine neue Kennung dieselbe Serie (gleicher Name, Neusuche nach 404), bleibt die deutsche Handlung, die der neue Eintrag nicht hat; abgelaufene nie (Frist 150 Tage). */
function handlungDerselbenSerie(vorher: (MitInhaltsstand & MitHandlung) | undefined, neu: MitHandlung, jetzt: string): { overviewDe?: string } {
  if (!vorher?.overviewDe || neu.overviewDe || !neu.tmdbId || neu.tmdbId === vorher.tmdbId) return {}
  if (!neu.nameDe || neu.nameDe !== vorher.nameDe || istAbgelaufen(inhaltsStand(vorher), new Date(jetzt))) return {}
  return { overviewDe: vorher.overviewDe }
}

/** Entfernt den TMDB-Inhalt jedes Eintrags, dessen Stand älter als `grenze` Tage ist (oder fehlt); gibt die Kennungen zurück. */
export function streicheAbgelaufenes(cache: Record<string, MitInhaltsstand>, jetzt: Date, grenze = STREICH_TAGE): string[] {
  const gestrichen: string[] = []
  for (const [id, e] of Object.entries(cache)) {
    if (!hatInhalt(e)) continue
    const alter = tageSeit(inhaltsStand(e), jetzt)
    if (alter !== undefined && alter <= grenze) continue
    for (const f of INHALTSFELDER) delete (e as Feld)[f]
    gestrichen.push(id)
  }
  return gestrichen
}

/** Ob ein Stand die Erneuerungsgrenze (`STREICH_TAGE`) überschritten hat; ohne Datum gilt er als abgelaufen. */
export function istAbgelaufen(stand: string | undefined, jetzt: Date): boolean {
  const alter = tageSeit(stand, jetzt)
  return alter === undefined || alter > STREICH_TAGE
}

/** Der Tag eines Abrufs (`inhaltAm` der Bild-Einträge), ohne Uhrzeit. */
export const abrufTag = (jetzt: Date = new Date()): string => jetzt.toISOString().slice(0, 10)

/**
 * **Bilder (Plakat, Hintergrund) erneuern.** Je Wochenlauf höchstens so viele: der Altbestand (rund 2.300 Plakate, 2.000 Hintergründe) wurde
 * innerhalb von sechs Tagen geholt und läuft deshalb fast gleichzeitig ab; in den 30 Tagen zwischen Grenze und Frist liegen vier Wochenläufe,
 * 800 je Lauf schaffen den Bestand auch dann, wenn ein Lauf ausfällt (Stand 13.10.2026).
 */
export const ERNEUERN_JE_LAUF = 800

/**
 * **Titel ohne Eintrag (neu oder nach der Frist gestrichen) je Lauf und Art.** Ohne Deckel fragt ein Lauf ohne `--limit` jeden an: nach einer TMDB-Störung von
 * 30 Tagen rund 2.300 Plakate und 2.000 Hintergründe. 400 ist der `--limit` des Wochenlaufs (`refresh-weekly.yml`); der Bedarf an echten Neuzugängen liegt
 * darunter (Stand 13.10.2026: 0 Titel ohne Eintrag bei 2.094 abfragbaren). Mit `ERNEUERN_JE_LAUF` höchstens 1.200 Abfragen je Lauf und Art, unter 10 Minuten.
 * Neue Titel stehen vor den Erneuerungen; die Erneuerung hat ihre eigene Quote und verhungert nicht. `--alle` (von Hand) fragt weiter alle an.
 * Grenze: Die Titel ohne Eintrag stehen in der Reihenfolge von `tmdb-titles.json`, nicht nach Neuheit. Nach einer Störung mit n solchen Titeln wartet
 * ein echter Neuzugang deshalb bis zu ceil(n/400) Läufe (bis dahin steht das AniList-Cover).
 */
export const NEU_JE_LAUF = 400

type Bild = { inhaltAm?: string } | null

/**
 * Was am Bildbestand fällig ist: `erneuern` (hat eine Zuordnung, wird neu abgefragt) und `entfernen` (keine Zuordnung, die der Lauf neu abfragen könnte:
 * die Namens- und Staffelsuche holt es wieder). Beides nur für Einträge über der Grenze, die älteste zuerst; `null` („TMDB hat keins") trägt kein Bild.
 */
export function bilderFaellig(bestand: Record<string, Bild>, hatZuordnung: (id: string) => boolean, jetzt: Date): { erneuern: string[]; entfernen: string[] } {
  const alt = Object.entries(bestand)
    .filter((e): e is [string, { inhaltAm?: string }] => e[1] !== null && istAbgelaufen(e[1].inhaltAm, jetzt))
    .sort(([, a], [, b]) => (a.inhaltAm ?? '').localeCompare(b.inhaltAm ?? ''))
    .map(([id]) => id)
  return { erneuern: alt.filter(hatZuordnung).slice(0, ERNEUERN_JE_LAUF), entfernen: alt.filter((id) => !hatZuordnung(id)) }
}

type Zuordnung = Record<string, { tmdbId?: number; kind?: string }>

const abfragbar = (z: Zuordnung[string] | undefined): boolean => Boolean(z?.tmdbId) && (z?.kind === 'tv' || z?.kind === 'movie')

/**
 * Welche Titel ein Bildlauf bei TMDB abfragt: Titel ohne Eintrag (höchstens `limit` und `NEU_JE_LAUF`, mit `alle` jeder), dazu die fälligen Erneuerungen (`bilderFaellig`).
 * `entfernt` sind abgelaufene Einträge ohne Zuordnung; der Aufrufer löscht sie aus dem Bestand.
 */
export function bilderAbzufragen(zuordnung: Zuordnung, bestand: Record<string, Bild>, alle: boolean, limit: number, jetzt: Date) {
  const faellig = bilderFaellig(bestand, (id) => abfragbar(zuordnung[id]), jetzt)
  const entfernt = new Set(faellig.entfernen)
  const neu = Object.keys(zuordnung).filter((id) => abfragbar(zuordnung[id]) && (alle || !(id in bestand)) && !entfernt.has(id)).slice(0, alle ? limit : Math.min(limit, NEU_JE_LAUF))
  const erneuern = faellig.erneuern.filter((id) => !neu.includes(id))
  return { offen: [...neu, ...erneuern].map((id) => [id, zuordnung[id]!] as const), entfernt: faellig.entfernen }
}

/** Ob der Eintrag in `data/tmdb.json` (FSK, Anbieter) bei TMDB neu zu holen ist: fehlt, `force` oder Inhalt über 150 Tage alt. */
export function tmdbJsonFaellig<T extends MitInhaltsstand>(vorher: T | undefined, force: boolean, jetzt: Date): boolean {
  if (force || vorher === undefined) return true
  /* Ein über der Frist gestrichener Eintrag (Datum da, Inhalt weg) wird wieder geholt. */
  if (!hatInhalt(vorher) && vorher.inhaltAm === undefined) return false
  return istAbgelaufen(inhaltsStand(vorher), jetzt)
}

/**
 * Der Eintrag nach dem Abruf; ein Inhalt bekommt den Tag des Abrufs. Findet ein erneuter Abruf nichts (Suche gescheitert), bleibt
 * der abgelaufene Eintrag stehen (`undefined` = nicht überschreiben), damit der nächste Lauf es noch einmal versucht.
 */
export function tmdbJsonEintrag<T extends MitInhaltsstand & { tmdbId?: number }>(vorher: T | undefined, neu: T, jetzt: Date): T | undefined {
  if (vorher && !neu.tmdbId) return undefined
  return hatInhalt(neu) ? { ...neu, inhaltAm: abrufTag(jetzt) } : neu
}

/**
 * Nimmt Bilder, die auch nach den Erneuerungsversuchen älter als `FRIST_TAGE` sind (Abruf gescheitert), aus dem Bestand; die Titel gelten dann wieder
 * als neu und werden im nächsten Lauf abgefragt. Gibt die Kennungen zurück. `null` und Einträge unter der Frist bleiben.
 */
export function streicheBilderUeberFrist(bestand: Record<string, Bild>, jetzt: Date): string[] {
  const weg = Object.entries(bestand)
    .filter(([, e]) => e !== null && (tageSeit(e.inhaltAm, jetzt) ?? Infinity) > FRIST_TAGE)
    .map(([id]) => id)
  for (const id of weg) delete bestand[id]
  return weg
}
