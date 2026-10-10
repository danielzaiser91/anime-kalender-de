/**
 * **Je Aussage und Anbieter nur der stärkste Beleg** (Daniel, 10.10.2026, Fall YAIBA: zwei anime2you.de-Artikel unter „Quellen 2",
 * der zweite nennt den Titel nur im Nebensatz). Verschiedene Typen desselben Anbieters (Artikel, Kalender, Katalog, Feed; siehe
 * `shared/beleg-anbieter.ts`) bleiben getrennt: Ein Artikel und ein Kalender desselben Hauses belegen unterschiedlich.
 *
 * Stärke, in dieser Reihenfolge:
 *  1. dem Titel gewidmet: Titelname (oder der Teil vor dem Doppelpunkt, ab 5 Zeichen) steht im Adresspfad;
 *  2. mehr Nachweisfelder: Fundstelle, Bild, Veröffentlichungsdatum, Ausgabedatum, Messung (der Artikeltext selbst liegt nur in der
 *     privaten Ablage, welche Angaben der Artikel im Einzelnen trägt, ist hier nicht bekannt);
 *  3. der ältere (Erstmeldung); ohne Datum zuletzt, dann die Reihenfolge in der Meldung.
 */
import type { NewsBeleg, NewsEintrag } from '../../shared/types.ts'
import { anbieterVon, belegTyp } from '../../shared/beleg-anbieter.ts'
import { log } from './util.ts'

export interface Entfallen {
  titel: string
  am: string
  behalten: string
  entfallen: string
}

/** Adresspfad und Namen vergleichbar machen: klein, Umlaute aufgelöst, alles außer a–z/0–9 wird zu einem Bindestrich. */
const glatt = (s: string): string =>
  `-${s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-')}-`.replace(/-+/g, '-')

/** Die Namen, unter denen ein Artikel dem Titel gewidmet sein kann: Anzeigename, Kennung ohne Nummer, jeweils auch der Teil vor dem Doppelpunkt. */
function namenVon(e: Pick<NewsEintrag, 'titel' | 'slug'>): string[] {
  const roh = [e.titel, e.titel.split(':')[0]!, e.slug.replace(/-\d+$/, '')]
  return [...new Set(roh.map(glatt))].filter((n) => n.length >= 7)
}

function gewidmet(url: string, namen: string[]): boolean {
  let pfad = url
  try {
    pfad = decodeURIComponent(new URL(url).pathname)
  } catch {
    /* unlesbar: die ganze Zeichenkette */
  }
  const g = glatt(pfad)
  return namen.some((n) => g.includes(n))
}

const nachweise = (b: NewsBeleg): number => [b.markierung, b.bild, b.veroeffentlichtAm, b.ausgabeAm, b.messung ?? b.gemessenAm].filter(Boolean).length

/** Negativ, wenn `a` der stärkere Beleg ist. */
function vergleiche(a: NewsBeleg, b: NewsBeleg, namen: string[]): number {
  const widmung = Number(gewidmet(b.url, namen)) - Number(gewidmet(a.url, namen))
  if (widmung) return widmung
  const felder = nachweise(b) - nachweise(a)
  if (felder) return felder
  const da = a.veroeffentlichtAm ?? '9999'
  const db = b.veroeffentlichtAm ?? '9999'
  return da < db ? -1 : da > db ? 1 : 0
}

/** Der stärkste Beleg je Anbieter und Typ; die Reihenfolge der Behaltenen bleibt die der Meldung. */
export function staerksteJeAnbieter(belege: NewsBeleg[], namen: string[]): { behalten: NewsBeleg[]; entfallen: [NewsBeleg, NewsBeleg][] } {
  const sieger = new Map<string, NewsBeleg>()
  for (const b of belege) {
    const schluessel = `${anbieterVon(b.url)}|${belegTyp(b.url)}`
    const bisher = sieger.get(schluessel)
    if (!bisher || vergleiche(b, bisher, namen) < 0) sieger.set(schluessel, b)
  }
  const behalten = belege.filter((b) => sieger.get(`${anbieterVon(b.url)}|${belegTyp(b.url)}`) === b)
  const entfallen = belege.filter((b) => !behalten.includes(b)).map((b): [NewsBeleg, NewsBeleg] => [b, sieger.get(`${anbieterVon(b.url)}|${belegTyp(b.url)}`)!])
  return { behalten, entfallen }
}

export function entdoppeleBelege(eintraege: NewsEintrag[]): { eintraege: NewsEintrag[]; entfallen: Entfallen[]; vorher: number } {
  const entfallen: Entfallen[] = []
  let vorher = 0
  const neu = eintraege.map((e) => {
    const namen = namenVon(e)
    return {
      ...e,
      meldungen: e.meldungen.map((m) => {
        if (!m.belege?.length) return m
        vorher += m.belege.length
        const r = staerksteJeAnbieter(m.belege, namen)
        for (const [weg, bleibt] of r.entfallen) entfallen.push({ titel: e.titel, am: e.am, behalten: bleibt.url, entfallen: weg.url })
        return r.entfallen.length ? { ...m, belege: r.behalten } : m
      }),
    }
  })
  return { eintraege: neu, entfallen, vorher }
}

/** Obergrenze für den Anteil entfallener Belege; am 10.10.2026 liegt er unter 5 %. Darüber stimmt etwas an der Regel nicht. */
const ANTEIL_MAX = 0.3

/** Zusicherung: nichts doppelt, keine Meldung verliert alle Belege, Zahlen stimmen, Anteil bleibt plausibel. */
export function belegFehler(vorher: NewsEintrag[], r: ReturnType<typeof entdoppeleBelege>): string[] {
  const fehler: string[] = []
  const anzahl = (es: NewsEintrag[]) => es.flatMap((e) => e.meldungen).reduce((s, m) => s + (m.belege?.length ?? 0), 0)
  const jeMeldung = (es: NewsEintrag[]) => es.flatMap((e) => e.meldungen.map((m) => ({ e, m })))
  const nachher = jeMeldung(r.eintraege)
  jeMeldung(vorher).forEach(({ e, m }, i) => {
    if (m.belege?.length && !nachher[i]!.m.belege?.length) fehler.push(`Belege: ${e.titel} (${e.am}) verlor alle Belege`)
  })
  for (const { e, m } of nachher) {
    const schluessel = (m.belege ?? []).map((b) => `${anbieterVon(b.url)}|${belegTyp(b.url)}`)
    if (new Set(schluessel).size !== schluessel.length) fehler.push(`Belege: ${e.titel} (${e.am}) führt einen Anbieter und Typ doppelt`)
  }
  if (anzahl(vorher) - anzahl(r.eintraege) !== r.entfallen.length) fehler.push('Belege: gezählte und tatsächlich entfallene Belege weichen ab')
  if (r.entfallen.length > ANTEIL_MAX * Math.max(1, r.vorher)) fehler.push(`Belege: ${r.entfallen.length} von ${r.vorher} entfallen, mehr als ${ANTEIL_MAX * 100} %`)
  return fehler
}

/** Der Bau-Schritt: entdoppeln, Zahl und Beispiele ins Protokoll, bei verletzter Zusicherung abbrechen. */
export function entdoppeleUndMelde(eintraege: NewsEintrag[]): NewsEintrag[] {
  const r = entdoppeleBelege(eintraege)
  log(`Belege je Anbieter: ${r.entfallen.length} von ${r.vorher} entfallen (stärkster je Anbieter und Typ bleibt)`)
  for (const x of r.entfallen.slice(0, 5)) log(`  ${x.titel} (${x.am}): bleibt ${x.behalten}, entfällt ${x.entfallen}`)
  const fehler = belegFehler(eintraege, r)
  if (fehler.length) throw new Error(fehler.join('\n'))
  return r.eintraege
}
