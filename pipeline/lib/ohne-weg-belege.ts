/**
 * Die Belege der Gründe `abo-ohne-ton`, `nur-disc` und `kein-angebot` in `ohne-weg.ts` (19.11.2026): reine Funktionen über einen JustWatch-Befund,
 * die Disc-Ausgaben (`data/disc-ausgaben.json`) und die Termine eines Titels.
 */
import { BEFUND_MAX_TAGE, type JwBefund } from './jw-vertrauen.ts'
import { alleAngebote, befundGilt } from './jw-seite.ts'

export const KAUF = new Set<string | undefined>(['BUY', 'RENT'])
/** Arten, die ein Streaming-Angebot ohne Kauf sind (Abo, werbefinanziert, gratis); `CINEMA` ist keins davon. */
const ABO = new Set<string | undefined>(['FLATRATE', 'ADS', 'FREE', 'FAST'])
const ISO_TAG = /^\d{4}-\d\d-\d\d$/
/** Ein voller Tag; aniSearch führt unbekannte Tage als `-00` (z. B. 2019-12-00), die zählen nicht. */
const VOLLER_TAG = /^\d{4}-\d\d-(0[1-9]|[12]\d|3[01])$/

/**
 * Der Ton ist an **jedem** Abo-Angebot des Befunds (auch der Staffeln) belegt und nennt kein Deutsch. Eine leere Tonliste heißt „unbekannt“, nicht „kein Deutsch“:
 * sie trägt den Grund nicht, auch nicht neben einer Liste ohne `de`.
 */
export function aboOhneDeutsch(b: JwBefund): boolean {
  const abo = alleAngebote(b).filter((a) => ABO.has(a.art))
  return abo.length > 0 && abo.every((a) => (a.audio ?? []).length > 0 && !a.audio!.includes('de'))
}

/** Eine Disc ist erschienen: eine Ausgabe oder ein Disc-Termin mit vollem Tag am Stichtag oder davor (eine künftige oder datumslose zählt nicht). */
export function discErschienen(ausgaben: readonly { datum?: string }[], termine: readonly { platform: string; date: string }[], heute: string): boolean {
  const vorbei = (tag: string | undefined) => !!tag && VOLLER_TAG.test(tag) && tag <= heute
  return ausgaben.some((a) => vorbei(a.datum)) || termine.some((e) => e.platform === 'disc' && vorbei(e.date))
}

/**
 * Der frische JustWatch-Befund, der den Titel nicht gefunden hat (`ohneTreffer`, Ursache `jw-kein-treffer`): Beleg für „kein Angebot gefunden“, nicht für „gibt es nicht“.
 * Ein gleichnamiger Kandidat mit anderer Kennung (`namenTreffer.gleicherName`) ist eine Zuordnungsfrage und trägt nichts; ein verfehlter oder ab `BEFUND_MAX_TAGE` alter Befund auch nicht.
 */
export function jwKeinTreffer(b: JwBefund | undefined, heute: string): b is JwBefund {
  if (!b?.ohneTreffer || b.verfehltAm || b.namenTreffer?.gleicherName || !ISO_TAG.test(b.geprueftAm)) return false
  return (Date.parse(heute) - Date.parse(b.geprueftAm)) / 86_400_000 < BEFUND_MAX_TAGE
}

/**
 * Der JustWatch-Eintrag, der zu einer erschienenen Disc „Streaming bisher nicht gefunden“ trägt: jünger als `BEFUND_MAX_TAGE`, nicht verfehlt,
 * kein Angebot außer Kauf/Leihe (auch kein veraltetes Abo), und entweder `ohneTreffer` oder ein gefundener Titel, dessen Kennung keinem zweiten gehört.
 * Kennt JustWatch einen Namensvetter (`namenTreffer`), kann der Stream beim Elternwerk liegen: kein Beleg.
 */
export function jwOhneStream(b: JwBefund | undefined, geteilt: ReadonlySet<string>, heute: string): b is JwBefund {
  if (!b || b.verfehltAm || b.namenTreffer || !ISO_TAG.test(b.geprueftAm)) return false
  if (alleAngebote(b).some((a) => !KAUF.has(a.art))) return false
  if (b.ohneTreffer) return (Date.parse(heute) - Date.parse(b.geprueftAm)) / 86_400_000 < BEFUND_MAX_TAGE
  return befundGilt(b, heute) && !geteilt.has(b.jwId!)
}
