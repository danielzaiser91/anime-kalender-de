/**
 * **Das Format der Titelzeile** (13.10.2026, Migration 055): Eine Folge ist ein Feld ohne Schlüsselnamen,
 * die Konstanten des Titels (Staffelstruktur, Titel, Serientitel) stehen einmal im Kopf. Rein, ohne Datenbank.
 *
 * Gemessen an den 45 Titeln der Stichprobe vom 13.10.2026 (`daniel-zum-abarbeiten/berichte/durchgaenge-2026-10-13.md`):
 * die Konstanten je Folge waren der größte Posten (Staffelstruktur rund 750 Byte je Zeile). Komprimiert wird
 * nicht, weil D1 nach Zeilen rechnet und die Sicht `pruefung_titel` den Text mit `json_each` lesen können muss.
 */

/** Ids der abgeleiteten Zeilen beginnen hier; darunter liegen `prime_folge` (< 10^9) und `pruefung.rohfolge`. */
export const TITEL_ID_AB = 2_000_000_000
const JE_TITEL = 10_000_000_000
const JE_FASSUNG = 100_000_000
const JE_STAFFEL = 100_000

/**
 * Eine Folge: [staffel, nummer, folgentitel, gti, sprachen, vorhanden, ton_de, art, titel_id, gemeldet_am,
 * meldung_uebernommen, rohfolge_uebernommen, notiz, fassung, folgen?, roh_titel?]. Die beiden letzten nur, wo belegt (Netflix, 14.10.2026):
 * `folgen` = Folgenzahl der Seite (Hand-Meldung), `roh_titel` = Titel der Rohfolge, wo er von `folge` abweicht (Netflix meldet
 * als `folge` die Kennung). `fassung` zählt (0..99, danach von vorn; 100 Änderungen einer Folge zwischen Lesen und Abhaken sind praktisch
 * ausgeschlossen) jede inhaltliche Änderung und steckt in
 * der Id: Eine Id, die der Bau vor einer Änderung gelesen hat, hakt die geänderte Folge nicht ab (wie eine neue Zeile in `pruefung`).
 */
export type Eintrag = [
  number | null,
  number | null,
  string | null,
  string | null,
  string[] | null,
  string,
  string,
  string,
  number | null,
  string,
  0 | 1,
  0 | 1,
  string | null,
  number,
  (number | null)?,
  (string | null)?,
]

/** Stellen im Eintrag, wo mehr als eine Zahl gelesen wird. */
export const STAFFEL = 0
export const NUMMER = 1
export const AM = 9
export const MELDUNG_UEBERNOMMEN = 10
export const ROHFOLGE_UEBERNOMMEN = 11
export const FASSUNG = 13
export const FOLGEN = 14
export const ROH_TITEL = 15

export type TitelDaten = {
  /** Die Aufteilung des Anbieters, wie die Erweiterung sie meldet. */
  s: unknown
  t: string | null
  st: string | null
  f: Eintrag[]
}

/** Id einer Folge für die Leser; `null`, wenn Staffel oder Nummer nicht in die Id passen. */
export function eintragsId(nr: number, e: Eintrag): number | null {
  const staffel = e[STAFFEL] ?? 0
  const nummer = e[NUMMER] ?? 0
  if (!Number.isInteger(staffel) || !Number.isInteger(nummer) || staffel < 0 || staffel >= 1000 || nummer < 0 || nummer >= JE_STAFFEL) return null
  return TITEL_ID_AB + nr * JE_TITEL + (e[FASSUNG] ?? 0) * JE_FASSUNG + staffel * JE_STAFFEL + nummer
}

/** Titelnummer, Fassung und (Staffel, Nummer) einer abgeleiteten Id. */
export function ausId(id: number): { nr: number; fassung: number; staffel: number; nummer: number } {
  const rest = id - TITEL_ID_AB
  const imTitel = rest % JE_TITEL
  return { nr: Math.floor(rest / JE_TITEL), fassung: Math.floor(imTitel / JE_FASSUNG), staffel: Math.floor((imTitel % JE_FASSUNG) / JE_STAFFEL), nummer: imTitel % JE_STAFFEL }
}

/** Zwei Folgen sind dieselbe, wenn Staffel und Nummer gleich sind (beide auch leer). */
export const gleicheFolge = (a: Eintrag, b: Eintrag) => a[STAFFEL] === b[STAFFEL] && a[NUMMER] === b[NUMMER]

/** Gleicher Inhalt: alles bis auf Zeitpunkt, Abhak-Marken und Fassung. */
export function gleicherInhalt(a: Eintrag, b: Eintrag): boolean {
  const inhalt = (e: Eintrag) => JSON.stringify([e.slice(0, AM), e[12], e[FOLGEN] ?? null, e[ROH_TITEL] ?? null])
  return inhalt(a) === inhalt(b)
}

/**
 * Wie viele Folgen der Bau (Meldung) und der Zuordner (Rohfolge) noch holen müssen. Die Rohfolge einer gesperrten Folge
 * (`vorhanden = nein`) liest erst Stufe 2, wie in `rohfolgen-seiten.ts`.
 */
export function zaehleOffene(daten: TitelDaten): { meldung: number; rohfolge: number } {
  return {
    meldung: daten.f.filter((e) => e[MELDUNG_UEBERNOMMEN] === 0).length,
    rohfolge: daten.f.filter((e) => e[ROHFOLGE_UEBERNOMMEN] === 0 && e[3] !== null && e[5] !== 'nein').length,
  }
}

/**
 * `titel_zeile.gemeldet_am`: die jüngste Meldung unter den Folgen, nicht der Zeitpunkt des Schreibens (17.10.2026). Abhaken
 * schrieb sonst „jetzt“ hinein, und `staffelnSeit` packte jeden abgehakten Titel mit `json_each` aus (Ø 13.268 Lesezeilen
 * je `?stand=1`); dieselbe Regel wie in `pruefung`, wo Abhaken `gemeldet_am` nicht anfasst.
 */
export function juengsteMeldung(daten: TitelDaten): string {
  return daten.f.reduce((am, e) => (e[AM] > am ? e[AM] : am), '')
}

export function leereDaten(): TitelDaten {
  return { s: null, t: null, st: null, f: [] }
}

export function lies(text: string): TitelDaten {
  const d = JSON.parse(text) as Partial<TitelDaten>
  return { s: d.s ?? null, t: d.t ?? null, st: d.st ?? null, f: Array.isArray(d.f) ? d.f : [] }
}

/** Der Kopf des Titels aus der Meldung: Staffelstruktur, Titel, Serientitel. */
export function kopfAusMeldung(daten: Record<string, unknown>): Pick<TitelDaten, 's' | 't' | 'st'> {
  return {
    s: daten.staffeln ?? null,
    t: daten.titel ? String(daten.titel).slice(0, 200) : null,
    st: daten.serientitel ? String(daten.serientitel).slice(0, 200) : null,
  }
}

const zahl = (w: unknown): number | null => (w === null || w === undefined || w === '' || !Number.isFinite(Number(w)) ? null : Number(w))

/** Die Folge einer Meldung als Eintrag (offen für Bau und Zuordner). */
export function eintragAusMeldung(
  daten: Record<string, unknown>,
  abgeleitet: { vorhanden: string; tonDe: string; art: string },
  am: string,
): Eintrag {
  const roh = Array.isArray(daten.rohfolgen) && daten.rohfolgen.length === 1 ? (daten.rohfolgen[0] as Record<string, unknown>) : null
  const sprachen = Array.isArray(daten.sprachen) ? (daten.sprachen as string[]) : null
  const e: Eintrag = [
    zahl(daten.staffel),
    zahl(daten.folge_nr),
    daten.folge ? String(daten.folge).slice(0, 200) : null,
    roh?.gti ? String(roh.gti).slice(0, 60) : null,
    sprachen,
    abgeleitet.vorhanden,
    abgeleitet.tonDe,
    abgeleitet.art,
    zahl(daten.titelId ?? daten.titel_id),
    am,
    0,
    roh ? 0 : 1,
    daten.notiz ? String(daten.notiz).slice(0, 500) : null,
    0,
  ]
  const rohTitel = roh?.titel ? String(roh.titel).slice(0, 200) : null
  return mitZusatz(e, zahl(daten.folgen), rohTitel === e[2] ? null : rohTitel)
}

/** Hängt `folgen` und `roh_titel` nur an, wo belegt: Disney+-Einträge bleiben 14 Felder lang. */
function mitZusatz(e: Eintrag, folgen: number | null, rohTitel: string | null): Eintrag {
  if (folgen === null && rohTitel === null) return e
  const neu: Eintrag = [...e]
  neu[FOLGEN] = folgen
  if (rohTitel !== null) neu[ROH_TITEL] = rohTitel
  return neu
}

export type Aenderung = 'neu' | 'geaendert' | 'gleich'

/**
 * Den Eintrag in die Titeldaten setzen. `neu`/`geaendert`: die Folge ist offen für Bau und Zuordner;
 * `gleich`: nichts außer, dass der Kopf des Titels sich ändern kann (Staffelstruktur, Titel) — der öffnet keine Folge.
 */
export function setzeEin(
  alt: TitelDaten,
  eintrag: Eintrag,
  kopf: Pick<TitelDaten, 's' | 't' | 'st'>,
): { daten: TitelDaten; art: Aenderung; kopfNeu: boolean; vorher: Eintrag | undefined } {
  const vorher = alt.f.find((e) => gleicheFolge(e, eintrag))
  /* Eine Meldung ohne Staffelstruktur oder Titel (Gebietssperre) lässt den bekannten Kopf stehen. */
  const neuerKopf = { s: kopf.s ?? alt.s, t: kopf.t ?? alt.t, st: kopf.st ?? alt.st }
  const kopfNeu = JSON.stringify([alt.s, alt.t, alt.st]) !== JSON.stringify([neuerKopf.s, neuerKopf.t, neuerKopf.st])
  const art: Aenderung = !vorher ? 'neu' : gleicherInhalt(vorher, eintrag) ? 'gleich' : 'geaendert'
  if (vorher && art === 'geaendert') eintrag[FASSUNG] = (vorher[FASSUNG] + 1) % 100
  const f = art === 'gleich' ? alt.f : [...alt.f.filter((e) => !gleicheFolge(e, eintrag)), eintrag]
  return { daten: { ...neuerKopf, f }, art, kopfNeu, vorher }
}
