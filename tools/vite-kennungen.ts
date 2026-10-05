/**
 * **Vite-Baustein: die Seite spricht unsere eigene Kennung** (Stufe 1, `docs/wissen/konzept-eigene-ids.md`).
 *
 * Beim Bau schreibt er `dist/data/` um (`pipeline/lib/ausgabe-kennung.ts`); im Entwicklungsserver liefert er
 * unter `/data/` eine umgeschriebene Kopie aus `node_modules/.cache/ak-data`. `public/data/` selbst bleibt unberührt.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import type { Plugin } from 'vite'
import { uebersetzeVerzeichnis } from '../pipeline/lib/ausgabe-kennung.ts'

const KENNUNGEN = 'data/kennungen.json'
const MARKE = '.eigene-kennungen'

export function eigeneKennungen(): Plugin {
  return {
    name: 'eigene-kennungen',
    configureServer(server) {
      const kopie = join(process.cwd(), 'node_modules/.cache/ak-data')
      rmSync(kopie, { recursive: true, force: true })
      cpSync(join(process.cwd(), 'public/data'), kopie, { recursive: true })
      uebersetzeVerzeichnis(kopie, join(process.cwd(), KENNUNGEN))
      server.middlewares.use('/data', (req, res, next) => {
        const pfad = normalize(join(kopie, decodeURIComponent((req.url ?? '').split('?')[0]!)))
        if (!pfad.startsWith(kopie) || !existsSync(pfad) || extname(pfad) !== '.json') return next()
        res.setHeader('Content-Type', 'application/json')
        res.end(readFileSync(pfad))
      })
    },
    closeBundle() {
      const ziel = join(process.cwd(), 'dist/data')
      if (!existsSync(ziel) || existsSync(join(ziel, MARKE))) return
      uebersetzeVerzeichnis(ziel, join(process.cwd(), KENNUNGEN))
      writeFileSync(join(ziel, MARKE), '')
    },
  }
}
