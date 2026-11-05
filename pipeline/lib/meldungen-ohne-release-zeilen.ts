import { HERABGESTUFT } from './bestand-warnzeile.ts'
import { gegenBekannte, type OhneReleaseBefund } from './meldungen-ohne-release.ts'
import type { Verluste } from './meldungen.ts'

/** Die Ausgabezeilen des Bestandswächters: eine Zählzeile, dazu je Abweichung von der Liste eine `⚠ WARNUNG`-Zeile (`bestand_warnungen`). */
export function zeilenOhneRelease(befunde: OhneReleaseBefund[], bekannt: readonly string[], stand: string): string[] {
  const { neu, erledigt } = gegenBekannte(befunde, bekannt)
  const zeilen = [`Meldungen mit Termin und deutschem Ton ohne Release, älter als 2 Tage: ${befunde.length} (Stand ${stand}, bekannt ${bekannt.length}, neu ${neu.length}, erledigt ${erledigt.length}, Ziel 0)`]
  if (neu.length) zeilen.push(`⚠ WARNUNG ${HERABGESTUFT} Meldung mit Termin und deutschem Ton ohne Release, nicht auf der Liste: ${neu.length} neu — Ursache suchen, nicht auf die Liste setzen: ${neu.join(' ;; ')}`)
  if (erledigt.length) zeilen.push(`⚠ WARNUNG Meldung ohne Release erledigt: ${erledigt.length} von der Liste pipeline/lib/meldungen-ohne-release-bekannt.ts streichen: ${erledigt.join(' ;; ')}`)
  return zeilen
}

/** Die Logzeile des Baus (`bau/08-news-tv.ts`): Meldungen mit Termin ohne Release nach Grund; die letzten beiden zählen mit, sind aber kein Verlust. */
export function verlustZeile(v: Verluste): string {
  const gezaehlt = `${v.nurStart.length} nur Sammelartikel-Start, ${v.schonBelegt.length} schon belegt`
  return `Meldungen mit Termin ohne Release: ${v.ohneTitel.length} ohne Titel, ${v.ohneTeil.length} mit unklarem Teil, ${v.ohneAnbieter.length} ohne Anbieter; gezählt, kein Verlust: ${gezaehlt} (Streaming mit deutschem Ton: data/proposals/nicht-zugeordnet.json)`
}
