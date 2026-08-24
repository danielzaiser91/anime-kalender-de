/**
 * Ein Gedächtnis für einmal belegte deutsche Tonspuren.
 *
 * ## Der Fall — und die Ursache, die es *nicht* war
 *
 * Daniel prüfte am 24.08.2026 gegen 11:50 „Kill Blue" bei ADN und fand **vier**
 * deutsche Folgen. Unser Archiv kannte nur zwei (Folge 3 und 4), und daraus
 * entstand zunächst die Vermutung, ADN zeige Gästen ein gleitendes Fenster der
 * zuletzt freigegebenen Folgen.
 *
 * **Diese Vermutung war falsch, und die Messung hat sie widerlegt.** Ein
 * Live-Abruf um 12:38 mit exakt unseren Headern lieferte `vde` bei Folge 1, 2,
 * 3 und 4 — anonym, ohne Token. Es fehlte nichts. Das Archiv war nur alt:
 *
 *     21.08.2026, 10:22   keine Folge mit vde
 *     24.08.2026, 08:36   Folge 3 und 4        ← unser Abruf
 *     24.08.2026, 12:38   Folge 1, 2, 3 und 4  ← Live
 *
 * Die Menge wächst, sie schrumpft nicht. Die wahre Ursache war der Takt: Das
 * Archiv wird im Wochenlauf gefüllt, war also vier Stunden bis sieben Tage alt.
 * Behoben wird das dort, wo es entsteht — durch häufigeres Auffrischen der
 * laufenden Serien, nicht durch Rechnen im Bau.
 *
 * ## Warum es diese Datei trotzdem gibt
 *
 * Der Schutz bleibt sinnvoll, aber aus einem anderen Grund als gedacht: Ein
 * Abruf kann **unvollständig** zurückkommen — Netzfehler, Teilausfall, eine
 * abgebrochene Seite. Dann fehlt ein `vde`, das gestern noch da war, und ohne
 * Gedächtnis würde daraus still ein „keine Synchro".
 *
 * **Nur `vde` wird gesammelt, nie sein Fehlen.** Ein Gedächtnis, das auch das
 * Fehlen festhielte, würde einen unvollständigen Abruf zur dauerhaften
 * Behauptung machen — genau der Fehler, den es verhindern soll.
 *
 * Es wird ausdrücklich **nichts geschlossen**: Kein Rückschluss von einer
 * belegten Folge auf die davor, keine Annahme über Staffeln. Hier stand bis zum
 * 24.08.2026 eine solche Regel; sie lieferte beim Testfall zufällig das richtige
 * Ergebnis aus dem falschen Grund und ist deshalb wieder verschwunden. Was diese
 * Datei ausgibt, hat ADN irgendwann selbst gesagt.
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
