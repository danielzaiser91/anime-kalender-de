/**
 * **Vorschlagslauf für Sammelartikel — reine Teile** (Fahrplan Schritte 6–7, `docs/wissen/sammelartikel-poc.md`).
 *
 * Der Lauf `fetch-sammelartikel.ts` liest Anime2You-Artikel seit seinem letzten Stand, macht daraus Aussagen und
 * hält sie als **Vorschläge** fest. Hier steht, was kein Netz braucht: Kennung, Fingerabdruck, Zusammenführen,
 * Pausen und die Schutzregel „nie in Handdaten schreiben". Nichts davon erreicht `data/curated/` oder die Seite.
 */
import { createHash } from 'node:crypto'
import type { Ergebnis } from './aussagen-abgleich.ts'

/** Die einzigen Dateien, die der Lauf schreibt. Alles andere verweigert `schreibeNurVorschlag`. */
export const VORSCHLAG_DATEI = 'data/proposals/aussagen.json'
export const STAND_DATEI = 'data/sammelartikel-stand.json'

/** Wie lange ein Vorschlag im Protokoll bleibt, gerechnet ab dem Veröffentlichungstag seines Artikels. */
export const BEHALTEN_TAGE = 60
/** Erster Lauf ohne Stand: so weit zurück wird gelesen. */
export const ERSTER_LAUF_TAGE = 21

export interface Vorschlag {
  id: string
  erstGesehen: string
  /** Gesetzt, wenn sich die Aussage nach dem ersten Sehen geändert hat (Artikel nachgepflegt). */
  geaendert?: string
  fingerabdruck: string
  /** Offen (nicht zugeordnet), Vorbehalt an der Zuordnung oder `deutsch: unklar` — braucht einen Menschen. Die Konfidenz steht getrennt am Ergebnis. */
  offenOderUnklar: boolean
  /** Ohne Handlungstext: fremde Sprachwerke gehören nicht ins Repo (nur ihre Länge). */
  ergebnis: Omit<Ergebnis, 'inhalt'> & { inhaltZeichen?: number }
}

export interface Stand {
  /** `modified_gmt` des jüngsten vollständig verarbeiteten Artikels, ISO mit „Z". */
  stand?: string
  letzterLauf?: string
  /** Bis dahin ruft der Lauf nichts ab (Sperre oder Zeitüberschreitung bei der Quelle). */
  pauseBis?: string
  /** Wie der letzte Lauf endete: `ok`, `pause`, `ausweichweg`, `robots`, `fehler`. */
  letzterAusgang?: string
}

/** Eine Aussage ist durch Artikel, Titel, Zusatz, Art und Anbieter bestimmt — ein Artikel nennt sie genau einmal. */
export function aussageId(a: { quelle: { url: string }; titel: string; zusatz?: string; art: string; plattformen: string[] }): string {
  return [a.quelle.url, a.titel, a.zusatz ?? '', a.art, [...a.plattformen].sort().join('+')].join('|')
}

/** Alles, was eine Aussage inhaltlich trägt — ohne Zeitstempel des Artikels, damit ein bloßes Nachspeichern nichts ändert. */
export function fingerabdruck(e: Vorschlag['ergebnis']): string {
  const { quelle, bestand: _bestand, ...rest } = e
  return createHash('sha1').update(JSON.stringify({ ...rest, quelle: { url: quelle.url, leser: quelle.leser } })).digest('hex').slice(0, 12)
}

export function brauchtMenschen(e: Ergebnis): boolean {
  return Boolean(e.offen) || e.deutsch === 'unklar' || Boolean(e.zuordnung?.vorbehalt)
}

function ohneInhalt(e: Ergebnis): Vorschlag['ergebnis'] {
  const { inhalt, ...rest } = e
  return { ...rest, ...(inhalt ? { inhaltZeichen: inhalt.length } : {}) }
}

export interface Zusammenfuehrung {
  liste: Vorschlag[]
  neu: Vorschlag[]
  geaendert: Vorschlag[]
}

/** Neue Aussagen kommen dazu, geänderte ersetzen ihre alte, Unverändertes bleibt bytegleich stehen. */
export function fuehreZusammen(alt: Vorschlag[], gelesen: Ergebnis[], heute: string): Zusammenfuehrung {
  const nachId = new Map(alt.map((v) => [v.id, v]))
  const neu: Vorschlag[] = []
  const geaendert: Vorschlag[] = []
  for (const e of gelesen) {
    const id = aussageId(e)
    const ergebnis = ohneInhalt(e)
    const abdruck = fingerabdruck(ergebnis)
    const vorher = nachId.get(id)
    if (!vorher) {
      const v: Vorschlag = { id, erstGesehen: heute, fingerabdruck: abdruck, offenOderUnklar: brauchtMenschen(e), ergebnis }
      nachId.set(id, v)
      neu.push(v)
    } else if (vorher.fingerabdruck !== abdruck) {
      const v: Vorschlag = { ...vorher, geaendert: heute, fingerabdruck: abdruck, offenOderUnklar: brauchtMenschen(e), ergebnis }
      nachId.set(id, v)
      geaendert.push(v)
    }
  }
  return { liste: [...nachId.values()], neu, geaendert }
}

/** Vorschläge, deren Artikel länger als `BEHALTEN_TAGE` zurückliegt, fallen aus dem Protokoll. */
export function beschneide(liste: Vorschlag[], heute: string): Vorschlag[] {
  const grenze = new Date(Date.parse(heute) - BEHALTEN_TAGE * 86_400_000).toISOString().slice(0, 10)
  return liste.filter((v) => v.ergebnis.quelle.veroeffentlicht >= grenze)
}

/** ISO-Zeitpunkt, ab dem der nächste Lauf liest: der Stand, sonst `ERSTER_LAUF_TAGE` zurück. */
export function leseAb(stand: Stand, jetzt: Date): string {
  if (stand.stand) return stand.stand.endsWith('Z') ? stand.stand : `${stand.stand}Z`
  return new Date(jetzt.getTime() - ERSTER_LAUF_TAGE * 86_400_000).toISOString().replace(/\.\d+Z$/, 'Z')
}

export function inPause(stand: Stand, jetzt: Date): boolean {
  return Boolean(stand.pauseBis) && Date.parse(stand.pauseBis!) > jetzt.getTime()
}

/** Pause nach Sperre oder Zeitüberschreitung: `Retry-After` der Quelle, mindestens eine Stunde, höchstens ein Tag. */
export function pauseBis(jetzt: Date, retryAfterSekunden?: number): string {
  const s = Math.min(Math.max(retryAfterSekunden ?? 0, 3600), 86_400)
  return new Date(jetzt.getTime() + s * 1000).toISOString().replace(/\.\d+Z$/, 'Z')
}

/** Die Zusicherung: Dieser Lauf schreibt nur seine beiden Dateien — nie `data/curated/`, nie `ankuendigungen.yaml`. */
export function schreibeNurVorschlag(pfad: string): void {
  const p = pfad.replace(/\\/g, '/')
  if (p !== VORSCHLAG_DATEI && p !== STAND_DATEI) throw new Error(`Sammelartikel-Lauf darf ${p} nicht schreiben (nur ${VORSCHLAG_DATEI}, ${STAND_DATEI})`)
}

/** robots.txt: ist `pfad` für unsere Kennung erlaubt? Genauste Gruppe gewinnt, `Allow` schlägt bei gleicher Länge. */
export function robotsErlaubt(robots: string, pfad: string, agent = 'anime-kalender'): boolean {
  const gruppen: { agenten: string[]; regeln: { erlaubt: boolean; pfad: string }[] }[] = []
  let aktuell: (typeof gruppen)[number] | undefined
  let letzteWarAgent = false
  for (const roh of robots.split(/\r?\n/)) {
    const z = roh.replace(/#.*/, '').trim()
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(z)
    if (!m) continue
    const feld = m[1]!.toLowerCase()
    const wert = m[2]!.trim()
    if (feld === 'user-agent') {
      if (!aktuell || !letzteWarAgent) { aktuell = { agenten: [], regeln: [] }; gruppen.push(aktuell) }
      aktuell.agenten.push(wert.toLowerCase())
      letzteWarAgent = true
    } else if ((feld === 'allow' || feld === 'disallow') && aktuell) {
      letzteWarAgent = false
      if (wert) aktuell.regeln.push({ erlaubt: feld === 'allow', pfad: wert })
    } else letzteWarAgent = false
  }
  const a = agent.toLowerCase()
  const eigene = gruppen.filter((g) => g.agenten.some((x) => x !== '*' && a.includes(x)))
  const gruppe = eigene.length ? eigene : gruppen.filter((g) => g.agenten.includes('*'))
  let beste: { erlaubt: boolean; laenge: number } | undefined
  for (const r of gruppen.length ? gruppe.flatMap((g) => g.regeln) : []) {
    if (!pfad.startsWith(r.pfad)) continue
    if (!beste || r.pfad.length > beste.laenge || (r.pfad.length === beste.laenge && r.erlaubt)) beste = { erlaubt: r.erlaubt, laenge: r.pfad.length }
  }
  return beste ? beste.erlaubt : true
}

/** Die Zeile für die Wochenwache: neue Vorschläge der letzten `tage` Tage, davon offen oder unklar. */
export function wachezeile(liste: Vorschlag[], heute: string, tage = 7): { neu: number; offenUnklar: number; text: string } {
  const grenze = new Date(Date.parse(heute) - tage * 86_400_000).toISOString().slice(0, 10)
  const neu = liste.filter((v) => v.erstGesehen > grenze)
  const offenUnklar = neu.filter((v) => v.offenOderUnklar).length
  return { neu: neu.length, offenUnklar, text: `Sammelartikel: ${neu.length} neue Aussagen, davon ${offenUnklar} offen/unklar` }
}

/** Abgangsmeldungen („verlassen bald den Katalog", „entfernt …"): „Verfügbar bis" ist kein Start, der Leser kennt es nicht. */
export const ABGANG = /\b(?:verlassen|verlässt|entfernt|entfernen|abgänge?|verschwinden|verschwindet|läuft aus)\b/i
