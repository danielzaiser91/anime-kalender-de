/**
 * Bestandswache: `public/data/eingabe-stand.json` (Abrufzeitpunkt je Eingabe des Baus, `lib/eingabe-stand.ts`). Hat der Bau auf älteren
 * Eingaben gebaut als der vorige, steht je Rückschritt eine Zeile „⚠ WARNUNG Eingabestand zurück …“: `bestand_warnungen` in
 * `tools/commit-data.sh` macht sie zur Annotation des Laufs. Immer Exit 0: ein zurückgenommener Sammler-Stand ist legitim, und
 * Rot würde den Bestandsbau stoppen. Auch eine fehlende, kaputte oder leere Datei ist nur eine Warnzeile (der Bau schreibt sie
 * bei jedem Lauf; fehlt sie vor dem ersten Bau mit diesem Schritt, steht nur eine Hinweiszeile). Test: `check-eingabe-stand.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rueckschrittZeile, type EingabeStandDatei } from './lib/eingabe-stand.ts'

/** Ausgabezeilen für den Inhalt der Datei; `undefined` = Datei fehlt. */
export function bewerteEingabeStand(inhalt: string | undefined): string[] {
  if (inhalt === undefined) return ['  ℹ Eingabestand: eingabe-stand.json fehlt (noch kein Bau mit diesem Schritt)']
  let datei: Partial<EingabeStandDatei>
  try {
    datei = JSON.parse(inhalt) as Partial<EingabeStandDatei>
  } catch {
    return ['  ⚠ WARNUNG Eingabestand: eingabe-stand.json nicht lesbar']
  }
  const eintraege = Object.keys(datei.stand ?? {}).length
  if (eintraege === 0 || !Array.isArray(datei.zurueck)) return ['  ⚠ WARNUNG Eingabestand: kein Eintrag im Stand oder kein „zurueck“ in eingabe-stand.json']
  const warnungen = datei.zurueck.map(rueckschrittZeile)
  return warnungen.length ? warnungen : [`  ✓ Eingabestand: ${eintraege} Eingaben, kein Rückschritt`]
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wurzel = process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const pfad = `${wurzel}/public/data/eingabe-stand.json`
  for (const z of bewerteEingabeStand(existsSync(pfad) ? readFileSync(pfad, 'utf8') : undefined)) console.log(z)
  console.log('VERSTÖSSE: 0')
}
