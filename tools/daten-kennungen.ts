import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const kurz = (hash: ReturnType<typeof createHash>) => hash.digest('hex').slice(0, 8)

/** Alle Dateien unter `ordner` in fester Reihenfolge, Pfade relativ mit `/`. */
function dateienUnter(ordner: string, vorsatz = ''): string[] {
  const eintraege = readdirSync(join(ordner, vorsatz), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))
  return eintraege.flatMap((e) => (e.isDirectory() ? dateienUnter(ordner, `${vorsatz}${e.name}/`) : [`${vorsatz}${e.name}`]))
}

/**
 * Inhalts-Kennung je Datendatei: jede `*.json` direkt in `ordner` einzeln (`titles.json`), jeder Unterordner als Ganzes (`voices/`).
 * `ausgenommen`: Dateien, die der Bau nach dem Kopieren noch umschreibt (`patchnotes.json`, `meta.json`); ihr Inhalt in `public/data` sagt nichts über die ausgelieferte Fassung.
 * `ordner` ist die ausgelieferte (übersetzte) Fassung, nicht `public/data`: So hängt die Kennung am Inhalt, den der Browser bekommt,
 * und eine neue Zeile in `data/kennungen.json` ändert nur die Dateien, deren Übersetzung sich ändert.
 * Ein Unterordner trägt einen Hash, weil `voices/` und `folgen/` je Tausende Dateien haben — einzeln sprengten sie `meta.json`.
 */
export function dateiKennungen(ordner: string, ausgenommen: string[] = []): Record<string, string> {
  const ergebnis: Record<string, string> = {}
  for (const e of readdirSync(ordner, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.isDirectory()) {
      const hash = createHash('sha256')
      for (const pfad of dateienUnter(ordner, `${e.name}/`)) hash.update(pfad).update(readFileSync(join(ordner, pfad)))
      ergebnis[`${e.name}/`] = kurz(hash)
    } else if (e.name.endsWith('.json') && !ausgenommen.includes(e.name)) {
      ergebnis[e.name] = kurz(createHash('sha256').update(readFileSync(join(ordner, e.name))))
    }
  }
  return ergebnis
}

/** Dateien, die `vite build` kopiert und danach noch ändert (`pipeline/patchnotes-ausliefern.ts` trägt `patchnotesStand` und die Patch-Notes ein, `schreibeDateienInMeta` die Kennungen). */
export const NACH_DEM_BAU_UMGESCHRIEBEN = ['meta.json', 'patchnotes.json']

/** Trägt die Kennungen als `dateien` in die ausgelieferte `meta.json` ein. */
export function schreibeDateienInMeta(metaPfad: string, kennungen: Record<string, string>): void {
  const meta = JSON.parse(readFileSync(metaPfad, 'utf8'))
  writeFileSync(metaPfad, JSON.stringify({ ...meta, dateien: kennungen }))
}
