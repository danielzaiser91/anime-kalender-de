import { cpSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

/** Die Anbieter-Zeichen liegen auf der Seite in `public/anbieter/`; die Bühne hat eine eigene `publicDir` und kopiert sie dazu. */
export function anbieterZeichen(): Plugin {
  let ziel = ''
  return {
    name: 'buehne-anbieter-zeichen',
    configResolved(c) {
      ziel = `${c.root}/${c.build.outDir}/anbieter`
    },
    closeBundle() {
      cpSync(fileURLToPath(new URL('../../public/anbieter', import.meta.url)), ziel, { recursive: true })
    },
  }
}
