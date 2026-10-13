/**
 * **„Die ersten N Folgen sind ab sofort auf Deutsch“ — ein Teil-Termin** (Snowball Earth, Disney+, Anime2You 24.09.2026).
 *
 * Eine Disney+-Meldung nannte „Episode 1 bis 6“ mit deutschem Ton, die Folgen 7–13 kamen später. Der Sammelartikel-Leser
 * kannte nur „(komplett)“ als Folgenzahl, also blieb die Aussage ohne Termin und der Disney+-Start fehlte im Kalender.
 * Hier wird sie zu `SammelEintrag.erste`: Folge 1–N, im Angebot spätestens am Tag der Meldung. Kein Wochentakt, keine Uhrzeit.
 *
 * Gelesen werden Zeilen eines Titelblocks (Feld `Episoden:`, `Sprache:`, `Hinweis:`) und Fließtextzeilen mit genau einem »Titel«.
 * Die Zeile muss die deutsche Fassung selbst nennen; „Episoden: 1 bis 6“ neben „Sprache: Deutsch, Japanisch (UT)“ genügt nicht,
 * denn ob der deutsche Ton alle Folgen trägt, sagt das nicht.
 */
import type { SammelEintrag } from './sammelartikel.ts'

const ZAHLWORT: Record<string, number> = { zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12 }
const ZAHL = `${Object.keys(ZAHLWORT).join('|')}|\\d{1,3}`

const ERSTE = new RegExp(`\\bersten\\s+(${ZAHL})\\s+(?:Folgen|Episoden)\\b`, 'i')
const BEREICH = /\b(?:Folgen?|Episoden?)\s+1\s*(?:bis|-|–)\s*(\d{1,3})\b/i
const VON_GESAMT = /\b(\d{1,3})\s+von\s+\d{1,3}\s+(?:Folgen|Episoden)?\s*(?:auf Deutsch|deutsch)/i

const DEUTSCH = /\bdeutsch\b|synchron|\bdub\b/i
/** Wer verneint oder von einer Disc, einem Kinostart spricht, meldet keinen Streaming-Teiltermin. */
const AUSSCHLUSS = /\b(?:nicht|kein\w*|ohne)\b|Blu-?ray|\bDVD\b|\bDisc\b|Volume|Steelbook|Kino/i
const AB_SOFORT = /\bab sofort\b|\bseit heute\b|\bab heute\b/i
const BLOCKFELD = /^(?:Episoden|Sprache|Hinweis):/
const TITEL_IM_SATZ = /»([^«]+)«/g

export interface ErsteFolgen {
  anzahl: number
  abSofort: boolean
}

/** Was eine Zeile zu „Folge 1 bis N auf Deutsch“ sagt; `undefined`, wenn sie es nicht (oder nicht deutlich) sagt. */
export function ersteFolgenAusZeile(zeile: string): ErsteFolgen | undefined {
  if (!DEUTSCH.test(zeile) || AUSSCHLUSS.test(zeile)) return undefined
  const roh = ERSTE.exec(zeile)?.[1] ?? BEREICH.exec(zeile)?.[1] ?? VON_GESAMT.exec(zeile)?.[1]
  const anzahl = roh === undefined ? 0 : (ZAHLWORT[roh.toLowerCase()] ?? Number(roh))
  return anzahl >= 2 ? { anzahl, abSofort: AB_SOFORT.test(zeile) } : undefined
}

/** Der einzige Titel in »…« der Zeile samt „Staffel N“ davor oder dahinter; bei keinem oder mehreren `undefined`. */
function titelImSatz(zeile: string): { titel: string; zusatz?: string } | undefined {
  const titel = [...new Set([...zeile.matchAll(TITEL_IM_SATZ)].map((m) => m[1]!.trim()))]
  if (titel.length !== 1) return undefined
  const staffel = /\bStaffel\s+(\d+)\b/i.exec(zeile)?.[1]
  return { titel: titel[0]!, ...(staffel ? { zusatz: `Staffel ${staffel}` } : {}) }
}

/** Setzt die Aussage in den Eintrag: deutsch, Folge 1–N, am Meldetag „spätestens“ (geschätzt); ein belegter Starttag bleibt. */
export function mitErstenFolgen(e: SammelEintrag, erste: ErsteFolgen, veroeffentlicht: string): SammelEintrag {
  /* „Synchronisation noch nicht bestätigt“ (Hinweis) oder eine Sprache ohne Deutsch widerspricht dem Satz: dann bleibt der Eintrag, wie er ist. */
  if (!e.deutsch) return e
  /* Nennt der Titelblock schon „N (komplett)“, ist ein „die ersten N Folgen“ im Fließtext dieselbe Menge (One Piece, Staffel 1–3 = 92 Folgen, 03.09.2026). */
  if (e.folgen) return e
  const { folgen: _komplett, ...rest } = e
  const festerTag = e.datum && !e.datumGeschaetzt
  const tag = erste.abSofort ? { datum: veroeffentlicht.slice(0, 10), datumGeschaetzt: true } : {}
  return { ...rest, ...(festerTag ? {} : tag), erste: erste.anzahl, woechentlich: false }
}

/** Die Anbieter, die die Zeile als eigenes Wort nennt („adn“ in „Madness“ zählt nicht). */
const anbieterImSatz = (zeile: string, anbieter: string[]): string[] =>
  anbieter.filter((a) => new RegExp(`(?<![\\p{L}])${a.replace(/[+.]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(zeile))

const passt = (e: SammelEintrag, k: { titel: string; zusatz?: string }): boolean =>
  e.titel.toLowerCase() === k.titel.toLowerCase() && (!k.zusatz || !e.zusatz || e.zusatz === k.zusatz)

/**
 * Wendet jede passende Zeile auf ihren Eintrag an; eine Fließtextzeile mit unbekanntem Titel wird ein neuer Eintrag.
 * `koepfe[i]` ist die Kopfzeile von `zeilen[i]` (oder `undefined`), `anbieter` die bekannten Anbieternamen (kleingeschrieben).
 */
export function fuegeErsteFolgenAn(
  liste: SammelEintrag[],
  zeilen: string[],
  koepfe: ({ titel: string; zusatz?: string } | undefined)[],
  veroeffentlicht: string,
  anbieter: string[],
): SammelEintrag[] {
  const raus = [...liste]
  let block: { titel: string; zusatz?: string } | undefined
  zeilen.forEach((zeile, i) => {
    if (koepfe[i]) {
      block = koepfe[i]
      return
    }
    const erste = ersteFolgenAusZeile(zeile)
    if (!erste) return
    const inline = titelImSatz(zeile)
    const ziel = inline ?? (BLOCKFELD.test(zeile) ? block : undefined)
    if (!ziel) return
    const idx = raus.findIndex((e) => passt(e, ziel))
    if (idx >= 0) {
      raus[idx] = mitErstenFolgen(raus[idx]!, erste, veroeffentlicht)
      return
    }
    const neu: SammelEintrag = { titel: ziel.titel, ...(ziel.zusatz ? { zusatz: ziel.zusatz } : {}), deutsch: true, stream: anbieterImSatz(zeile, anbieter) }
    raus.push(mitErstenFolgen(neu, erste, veroeffentlicht))
  })
  return raus
}
