/**
 * **Lesungen eines Belegs** (Stufe 4 des Datenbank-Plans: Quelle → Lesung → Snapshot).
 *
 * Eine Lesung hält fest, was ein Artikel an einem Tag sagte: Hash des Textes, Veröffentlicht- und
 * Aktualisiert-Datum, dazu Bild und HTML in der privaten R2-Ablage. Erst mit zwei Lesungen lassen
 * sich „zuletzt aktualisiert" und „unverändert seit" belegen statt raten. Hier stehen nur reine
 * Rechnungen — der Abruf liegt in `pipeline/belege-lesen.ts`.
 */
import { createHash } from 'node:crypto'
import type { NewsBeleg, NewsEintrag, Quelle, Release } from '../../shared/types.ts'
import { hostVon } from '../../shared/quelle.ts'
import { releaseStatus } from '../../shared/logic.ts'

/** Artikel, keine Kalender, APIs oder Katalogseiten — nur sie haben einen Text, der sich ändern kann. */
const ARTIKEL = [
  /^https:\/\/www\.crunchyroll\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?news\/[a-z-]+\/\d{4}\//,
  /^https:\/\/www\.anime2you\.de\/news\/\d+\//,
  /^https:\/\/www\.anisearch\.de\/(?:article\/\d+|news\/)/,
  /^https:\/\/news\.animationdigitalnetwork\.com\/de\/\d{4}\//,
  /* Seiten ohne Artikeldatum, deren Domains von Hand geprüft sind (`data/beleg-domains.json`): Hersteller- und Pressebereiche. aniSearch-Katalogseiten (`/anime/…`) und Crunchyroll-Serienseiten bleiben draußen: Dort verdecken Sony-Banner und Nutzungsbedingungen die Seite, die Aufnahme war schwarz (05.10.2026). */
  /^https:\/\/tokyo-revengers-anime\.com\//,
  /^https:\/\/press\.disneyplus\.com\//,
]

export function istArtikel(url: string): boolean {
  return ARTIKEL.some((m) => m.test(url))
}

/**
 * Hat die Seite ein Veröffentlichungsdatum des **Textes**? Eine aniSearch-Produktseite (`/article/…`)
 * nicht: Ihr „Veröffentlicht:" ist der Erscheinungstag der Ausgabe — der Tooltip nannte so „veröffentlicht
 * am 19.11.2026" für einen Artikel vom September (03.10.2026).
 */
export const traegtArtikeldatum = (url: string): boolean =>
  !/anisearch\.de\/article\/|tokyo-revengers-anime\.com\//.test(url)

export interface Lesung {
  /** Tag der Lesung (Europe/Berlin). */
  am: string
  /** SHA-256 des normalisierten Artikeltextes, gekürzt auf 16 Zeichen. */
  hash: string
  veroeffentlicht?: string
  aktualisiert?: string
  /** Produktseite: Erscheinungstag der Ausgabe (aniSearch-Artikel) — eine andere Aussage als ein Veröffentlichungsdatum. */
  ausgabe?: string
  /** Der Hash wechselte, ohne dass sich ein Datum änderte — jedes Mal eine Anomalie, die untersucht wird. */
  aenderungOhneDatum?: true
  /** Schlüssel in der privaten Ablage, falls das Hochladen gelang. */
  bild?: string
  /** Das Datum in der Kopfzeile des Artikels weicht von Veröffentlicht/Aktualisiert laut Seitendaten ab — jedes Mal untersuchen (Daniel, 05.10.2026). */
  datumsabweichung?: string
  /** Qualitätssicherung (05.10.2026): `ok` = mit der Wand-Prüfung fotografiert; `wand` = die Seite war eine Zustimmungswand, das Bild wurde entzogen. Ohne Eintrag: Altbestand, wird neu gelesen. */
  qs?: 'ok' | 'wand'
  /** Wo die Aussage im Bild steht: `[links, oben, Breite, Höhe]` als Anteile von 0 bis 1. */
  markierung?: [number, number, number, number]
  /** Artikeltext, gepackt (seit 03.10.2026; davor die ganze HTML-Seite in `html`). */
  text?: string
  html?: string
}

export interface BelegGedaechtnis {
  [url: string]: { zuletzt: string; lesungen: Lesung[] }
}

/**
 * **Wann ein Artikel nicht mehr gelesen wird:** sobald jeder Termin, den er belegt, erreicht ist
 * (Status `abgeschlossen`). Gelesen wird er trotzdem **einmal**, damit der Beleg existiert (Daniel, 03.10.2026).
 */
export function adressenMitOffenemTermin(releases: Release[], gedaechtnis: BelegGedaechtnis, heute: string): string[] {
  const offen = new Map<string, boolean>()
  for (const r of releases) {
    const unerledigt = releaseStatus(r, heute) !== 'abgeschlossen'
    for (const u of [...(r.quellen ?? []).map((q) => q.url), ...(r.sources ?? [])]) offen.set(u, (offen.get(u) ?? false) || unerledigt)
  }
  return [...offen].filter(([u, o]) => o || !gedaechtnis[u]).map(([u]) => u)
}

/** Leerraum und unsichtbare Zeichen zählen nicht als Änderung. */
export function textHash(text: string): string {
  const norm = text.replace(/[­​]/g, '').replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(norm).digest('hex').slice(0, 16)
}

const MONATE: Record<string, number> = {
  jan: 1, feb: 2, 'mär': 3, mar: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12,
}

/** „15. SEPT. 2026, 18:00 MESZ" → „2026-09-15" (Crunchyrolls Kopfzeile). */
export function crunchyrollDatum(text: string | undefined): string | undefined {
  const m = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]{3,5})\.?\s*(\d{4})/.exec(text ?? '')
  const monat = m && MONATE[m[2]!.toLowerCase().slice(0, 3)]
  return m && monat ? `${m[3]}-${String(monat).padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : undefined
}

/** Das Datum der Kopfzeile mit Uhrzeit („22. Juli 2026 um 19:20 Uhr“, „15. SEPT. 2026, 18:00 MESZ“) — ein Datum im Fließtext („ab 16. April 2027“) zählt nicht. */
export function kopfzeilenDatum(text: string | undefined): string | undefined {
  const m = /(\d{1,2}\.\s*[A-Za-zÄÖÜäöü]{3,9}\.?\s*\d{4})(?:,|\s+um)?\s*\d{1,2}:\d{2}/.exec((text ?? '').slice(0, 800))
  return crunchyrollDatum(m?.[1])
}

/** Nur das Datum einer ISO-Zeitangabe aus `article:published_time` u. ä. */
export function isoTag(wert: string | undefined | null): string | undefined {
  return /^\d{4}-\d{2}-\d{2}/.exec(wert ?? '')?.[0]
}

/** In den ersten drei Tagen nach der ersten Lesung wird täglich gelesen: Frische Artikel werden am ehesten nachbearbeitet. */
const FRISCH_TAGE = 3
function frischUndHeuteNochNicht(e: BelegGedaechtnis[string], heute: string): boolean {
  const erste = e.lesungen[0]?.am
  return Boolean(erste) && e.zuletzt < heute && Date.parse(heute) - Date.parse(erste!) <= FRISCH_TAGE * 86_400_000
}

/**
 * Welche Artikel diesmal gelesen werden: nie gelesene zuerst, dann die am längsten nicht
 * gelesenen, aber keiner öfter als alle `abstandTage` Tage.
 */
export function warteschlange(urls: string[], gedaechtnis: BelegGedaechtnis, heute: string, abstandTage: number, limit: number): string[] {
  const grenze = new Date(Date.parse(heute) - abstandTage * 86_400_000).toISOString().slice(0, 10)
  return [...new Set(urls)]
    .filter(istArtikel)
    .filter((u) => !gedaechtnis[u] || gedaechtnis[u]!.zuletzt <= grenze || frischUndHeuteNochNicht(gedaechtnis[u]!, heute) || bildOhnePruefung(gedaechtnis[u]!))
    .sort((a, b) => Number(bildOhnePruefung(gedaechtnis[b])) - Number(bildOhnePruefung(gedaechtnis[a])) || (gedaechtnis[a]?.zuletzt ?? '').localeCompare(gedaechtnis[b]?.zuletzt ?? ''))
    .slice(0, limit)
}

/** Altbestand ohne Wand-Prüfung (Bild, `qs` fehlt) und Adressen, deren Bild als Wand entzogen wurde — kommen zuerst wieder an die Reihe. */
export const bildOhnePruefung = (e: BelegGedaechtnis[string] | undefined): boolean => Boolean(e?.lesungen.some((l) => (l.bild && !l.qs) || l.qs === 'wand'))

/** Eine Wand hinter dieser Adresse: Alle Bilder der Adresse werden entzogen (sie zeigen die Wand), die Lesungen tragen `qs: wand`. */
export function entzieheBild(gedaechtnis: BelegGedaechtnis, url: string): void {
  for (const l of gedaechtnis[url]?.lesungen ?? []) {
    delete l.bild
    delete l.text
    delete l.html
    delete l.markierung
    l.qs = 'wand'
  }
}

/** Eine neue Lesung kommt nur dazu, wenn sich Text oder Daten geändert haben; sonst rückt `zuletzt` vor. */
export function merkeLesung(gedaechtnis: BelegGedaechtnis, url: string, lesung: Lesung): boolean {
  const eintrag = (gedaechtnis[url] ??= { zuletzt: lesung.am, lesungen: [] })
  eintrag.zuletzt = lesung.am
  const letzte = eintrag.lesungen.at(-1)
  /* Ein Datum, das die Seite nicht mehr nennt, ist keine Änderung — sonst entstünde bei gleichem Text eine zweite Lesung. */
  const gleich =
    letzte &&
    letzte.hash === lesung.hash &&
    (!lesung.veroeffentlicht || letzte.veroeffentlicht === lesung.veroeffentlicht) &&
    (!lesung.aktualisiert || letzte.aktualisiert === lesung.aktualisiert)
  if (gleich) return false
  eintrag.lesungen.push(lesung)
  return true
}

/** Seit wann der Text unverändert ist: Tag der letzten Lesung mit neuem Hash. */
export function unveraendertSeit(eintrag: BelegGedaechtnis[string] | undefined): string | undefined {
  return eintrag?.lesungen.at(-1)?.am
}

/**
 * Veröffentlicht- und Aktualisiert-Datum laut Lesung an die Quellen eines Termins — damit sagt der
 * Tooltip, wann die Quelle es gesagt hat, nicht wann wir sie zuerst sahen (news-plan.md).
 */
export function mitArtikeldaten(quellen: Quelle[], gedaechtnis: BelegGedaechtnis): Quelle[] {
  return quellen.map((q) => {
    const lesungen = gedaechtnis[q.url]?.lesungen ?? []
    if (!traegtArtikeldatum(q.url)) {
      const ausgabe = lesungen.map((l) => l.ausgabe).filter(Boolean).at(-1)
      const jüngste = lesungen.filter((l) => l.bild).at(-1)
      return { ...q, ...(ausgabe ? { ausgabeAm: ausgabe } : {}), ...(jüngste ? { bild: jüngste.bild, ...(jüngste.markierung ? { markierung: jüngste.markierung } : {}) } : {}) }
    }
    const veroeffentlicht = lesungen.map((l) => l.veroeffentlicht).find(Boolean)
    const aktualisiert = lesungen.map((l) => l.aktualisiert).filter(Boolean).at(-1)
    const jüngste = lesungen.filter((l) => l.bild).at(-1)
    return {
      ...q,
      ...(jüngste ? { bild: jüngste.bild, ...(jüngste.markierung ? { markierung: jüngste.markierung } : {}) } : {}),
      ...(veroeffentlicht ? { veroeffentlichtAm: veroeffentlicht } : {}),
      ...(aktualisiert && aktualisiert !== veroeffentlicht ? { aktualisiertAm: aktualisiert } : {}),
    }
  })
}

/** Alle Adressen, auf die die Meldungen als Quelle zeigen — auch die nackte `quelle` ohne Beleg-Eintrag (Folgen, „Neu auf Deutsch"). */
export function adressenAusNews(eintraege: NewsEintrag[]): string[] {
  const urls = new Set<string>()
  for (const e of eintraege)
    for (const m of e.meldungen) {
      for (const b of m.belege ?? []) urls.add(b.url)
      if (typeof m.quelle === 'string' && /^https?:\/\//.test(m.quelle)) urls.add(m.quelle)
    }
  return [...urls]
}

/**
 * **Jede Meldung führt ihre Quellen als Belege, mit Bild, wo eines gesichert ist** (Daniel, 05.10.2026). Eine nackte `quelle` wird zum Beleg-Eintrag, und jeder Beleg
 * bekommt Bild, Fundstelle und Daten aus dem Gedächtnis der Beleg-Lesung, auch wenn er nicht über einen Termin kam.
 */
export function belegeFuerAlle(eintraege: NewsEintrag[], gedaechtnis: BelegGedaechtnis): NewsEintrag[] {
  const ergaenze = (b: NewsBeleg): NewsBeleg => {
    const [mit] = mitArtikeldaten([{ url: b.url, name: b.name, gesehenAm: '' }], gedaechtnis)
    const { bild, markierung, veroeffentlichtAm, aktualisiertAm, ausgabeAm } = mit!
    const eintrag = gedaechtnis[b.url]
    const lesungen = eintrag?.lesungen ?? []
    const bildAm = lesungen.filter((l) => l.bild).at(-1)?.am
    const pruefung = eintrag ? { erstGeprueftAm: lesungen[0]?.am, zuletztGeprueftAm: eintrag.zuletzt, ...(bildAm ? { bildAm } : {}) } : {}
    return { ...b, ...pruefung, ...(b.bild || !bild ? {} : { bild, ...(markierung ? { markierung } : {}) }), ...(b.veroeffentlichtAm || !veroeffentlichtAm ? {} : { veroeffentlichtAm }), ...(b.aktualisiertAm || !aktualisiertAm ? {} : { aktualisiertAm }), ...(b.ausgabeAm || !ausgabeAm ? {} : { ausgabeAm }) }
  }
  return eintraege.map((e) => ({
    ...e,
    meldungen: e.meldungen.map((m) => {
      const roh = m.belege?.length ? m.belege : typeof m.quelle === 'string' && /^https?:\/\//.test(m.quelle) ? [{ url: m.quelle, name: hostVon(m.quelle) }] : []
      return roh.length ? { ...m, belege: roh.map(ergaenze) } : m
    }),
  }))
}
