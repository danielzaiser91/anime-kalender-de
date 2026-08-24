/**
 * Was einmal deutsch war, bleibt deutsch.
 *
 * ## Der Fall, der das nötig gemacht hat
 *
 * Daniel prüfte am 24.08.2026 „Kill Blue" von Hand und fand **vier** Folgen mit
 * deutscher Tonspur. Unser Datensatz sagte „Folge 1–2 deutsch, 3–12 nicht", das
 * ADN-Archiv desselben Tages sagte „`vde` bei Folge 3 und 4". Drei Antworten,
 * drei verschiedene Wahrheiten.
 *
 * Die Versionsgeschichte löst es auf:
 *
 *     21.08.2026, 10:22   keine einzige Folge mit vde
 *     24.08.2026, 06:44   vde bei Folge 3 und 4
 *
 * Die Automatik **konnte** es also die ganze Zeit — sie hat nur jedes Mal den
 * aktuellen Stand über den vorigen geschrieben. Ein Abruf zeigt, was ADN in
 * diesem Moment als Gast preisgibt; das ist eine **untere Schranke**, keine
 * vollständige Liste. Wer daraus ein `dub: false` ableitet, erfindet ein Nein.
 *
 * Derselbe Fehler ist im Projekt schon einmal teuer geworden: 975 Falschangaben,
 * weil „Deutsch fehlt in der Audio-Zeile" als „keine Synchro" gelesen wurde —
 * ein Gast sieht dort etwas anderes als ein Angemeldeter.
 *
 * ## Was diese Datei macht
 *
 * Sie führt ein Gedächtnis: Jede Folge, die je ein `vde` getragen hat, steht mit
 * dem Datum ihres ersten Fundes in `data/adn-vde-historie.json`. Beim Einlesen
 * des Archivs werden diese Funde wieder eingemischt.
 *
 * **Nur `vde` wird gesammelt, nie sein Fehlen.** Eine Synchro verschwindet
 * nicht: Sie wandert allenfalls hinter eine Bezahlschranke, wo unser Abruf sie
 * nicht mehr sieht. Ein Gedächtnis, das auch das Fehlen festhielte, würde einen
 * unvollständigen Abruf zur dauerhaften Behauptung machen — genau der Fehler,
 * den es verhindern soll.
 *
 * ## Wann ein Eintrag wieder verschwinden darf
 *
 * Wenn ADN eine Serie ganz aus dem Programm nimmt, bleibt der Eintrag stehen und
 * schadet nicht: Er sagt „diese Folge hatte deutschen Ton", nicht „diese Folge
 * ist abrufbar". Die Verfügbarkeit entscheidet an anderer Stelle. Von Hand
 * gelöscht wird ein Eintrag nur, wenn sich ein Fund als Messfehler erweist —
 * dann mit Notiz, warum.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, log } from './util.ts'

const DATEI = resolve(ROOT, 'data', 'adn-vde-historie.json')

/** Serie → Folgenkennung → Datum des ersten Fundes. */
export type VdeHistorie = Record<string, Record<string, string>>

export function ladeVdeHistorie(): VdeHistorie {
  if (!existsSync(DATEI)) return {}
  try {
    const roh = JSON.parse(readFileSync(DATEI, 'utf8'))
    return roh && typeof roh === 'object' && !Array.isArray(roh) ? (roh.serien ?? roh) : {}
  } catch {
    // Lieber ohne Gedächtnis bauen als gar nicht. Der nächste Lauf schreibt neu.
    return {}
  }
}

/**
 * Ein Video aus dem Rohabruf — nur die Felder, auf die es hier ankommt.
 * Die Folgenkennung ist `id`, weil Folgennummern sich bei Staffelwechseln
 * wiederholen und die Kennung nicht.
 */
interface Video {
  id?: number
  languages?: string[]
  shortNumber?: string | number
  order?: number
}

/**
 * Mischt bekannte `vde`-Funde in einen frischen Abruf zurück und nimmt neue auf.
 *
 * Verändert `videos` an Ort und Stelle und meldet, was dazukam. `pflegen: false`
 * liest nur — dafür gibt es die Checks, die nichts schreiben dürfen.
 */
export function ergaenzeAusHistorie(
  historie: VdeHistorie,
  serienId: string,
  videos: Video[],
  heute: string,
  pflegen: boolean,
): { neu: number; wiederhergestellt: number } {
  const bekannt = historie[serienId] ?? {}
  let neu = 0
  let wiederhergestellt = 0

  for (const v of videos) {
    if (v.id === undefined) continue
    const schluessel = String(v.id)
    const hatJetzt = (v.languages ?? []).includes('vde')

    if (hatJetzt) {
      if (!bekannt[schluessel]) {
        bekannt[schluessel] = heute
        neu++
      }
      continue
    }
    // Nicht im aktuellen Abruf, aber früher schon gesehen: wieder einsetzen.
    if (bekannt[schluessel]) {
      v.languages = [...(v.languages ?? []), 'vde']
      wiederhergestellt++
    }
  }

  if (pflegen && Object.keys(bekannt).length) historie[serienId] = bekannt
  return { neu, wiederhergestellt }
}

/**
 * Der hoechste Fund gibt die Anzahl deutscher Folgen an.
 *
 * Eine Synchronisation laeuft von vorne: Wer Folge 4 vertont hat, hat 1 bis 3
 * vertont. ADNs oeffentliche Angabe zeigt aber nur ein gleitendes Fenster der
 * zuletzt freigegebenen Folgen — bei "Kill Blue" am 24.08.2026 genau die Folgen
 * 3 und 4, waehrend 1 und 2 laengst synchronisiert, aber aus dem Fenster
 * gefallen waren. Daniel sah als Angemeldeter vier deutsche Folgen, unser
 * Gast-Abruf zwei.
 *
 * Aus dem hoechsten Fund die Folgen davor zu schliessen, macht aus dieser
 * unteren Schranke die richtige Antwort — und deckt sich hier mit **zwei**
 * unabhaengigen Handpruefungen (Netflix und ADN, beide 4 Folgen).
 *
 * **Die Grenze der Regel:** Sie unterstellt eine luckenlose Synchro. Faellt bei
 * einer Serie ausgerechnet eine mittlere Folge aus, behauptet sie eine Tonspur,
 * die es nicht gibt. Deshalb gilt sie nur bis zum hoechsten *gesehenen* Fund und
 * niemals darueber hinaus: Sie fuellt Luecken, sie sagt nichts ueber die Zukunft.
 */
export function schliesseAufVorherigeFolgen(videos: Video[]): number {
  const mitVde = videos.filter((v) => (v.languages ?? []).includes('vde'))
  if (!mitVde.length) return 0
  const hoechste = Math.max(...mitVde.map((v) => nummerVon(v)).filter((n) => n > 0))
  if (!Number.isFinite(hoechste) || hoechste <= 0) return 0
  let ergaenzt = 0
  for (const v of videos) {
    const n = nummerVon(v)
    if (n <= 0 || n > hoechste) continue
    if ((v.languages ?? []).includes('vde')) continue
    v.languages = [...(v.languages ?? []), 'vde']
    ergaenzt++
  }
  return ergaenzt
}

/**
 * Die Folgennummer, so wie ADN sie fuehrt: `shortNumber` ist die Nummer als Text
 * ("12"), `order` die Position in der Staffel. `number` ist ausgeschrieben
 * ("Episode 12") und taugt nicht zum Rechnen.
 */
function nummerVon(v: Video): number {
  const roh = v.shortNumber ?? v.order
  const n = Number(roh)
  return Number.isFinite(n) ? n : 0
}

export function schreibeVdeHistorie(historie: VdeHistorie, neu: number, wieder: number): void {
  const serien = Object.keys(historie).length
  const folgen = Object.values(historie).reduce((n, s) => n + Object.keys(s).length, 0)
  writeFileSync(
    DATEI,
    `${JSON.stringify({ hinweis: 'Jede Folge, die je eine deutsche Tonspur trug. Wird nur ergaenzt, nie gekuerzt — siehe pipeline/lib/adn-vde-historie.ts.', serien: historie }, null, 1)}\n`,
  )
  log(
    `ADN-Gedaechtnis: ${folgen} Folgen aus ${serien} Serien mit deutscher Tonspur` +
      (neu ? `, ${neu} neu` : '') +
      (wieder ? `, ${wieder} aus dem Gedaechtnis wiederhergestellt` : ''),
  )
}
