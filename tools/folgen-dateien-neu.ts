/**
 * Schnellweg: schreibt nur `public/data/folgen/*` (Detaildateien, `zaehlung.json`) neu, aus dem gebauten `titles.json`/`releases.json`
 * statt dem ganzen Bau — für Bestandsprüfungen darauf (z. B. `check-horizonte-staffeln-bestand.ts`, Mutationsliste `horizonte-staffeln.json`).
 * Ändert den Arbeitsbaum; danach `git checkout -- public/data/folgen`. Aufruf: `npx tsx tools/folgen-dateien-neu.ts`.
 */
import { readFileSync } from 'node:fs'
import { schreibeFolgenDateien } from '../pipeline/bau/folgen-dateien.ts'

const lies = (pfad: string) => JSON.parse(readFileSync(pfad, 'utf8'))
schreibeFolgenDateien(lies('public/data/titles.json'), lies('public/data/releases.json'))
