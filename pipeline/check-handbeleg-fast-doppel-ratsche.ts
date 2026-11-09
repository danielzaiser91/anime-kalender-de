/**
 * Zusicherung: Die Zahl blockierter Fast-Doppel-Gruppen in den Handbelegen darf nur sinken
 * (`pipeline/lib/handbeleg-fast-doppel-ratsche.ts`, Grenze 4 am 07.11.2026). Wächter als Prozess in einer Wegwerf-Wurzel.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-handbeleg-fast-doppel-ratsche.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ratschenZeilen } from './lib/handbeleg-fast-doppel-ratsche.ts'
import { ROOT } from './lib/util.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* Grenze fest eingetragen (nicht aus dem Modul): 4. */
const falt = (n: number) => Array.from({ length: n }, (_, i) => `g${i}`)
pruefe('5 blockierte Gruppen: Warnung mit allen Gruppen', ratschenZeilen({ blockiert: 5, blockiertFalt: falt(5) }).join().includes('5 blockierte') && ratschenZeilen({ blockiert: 5, blockiertFalt: falt(5) }).join().includes('g4'))
pruefe('4 blockierte Gruppen (Grenze): keine Zeile', ratschenZeilen({ blockiert: 4, blockiertFalt: falt(4) }).length === 0)
pruefe('3 blockierte Gruppen: Hinweis, die Grenze auf 3 zu senken', /auf 3 senken/.test(ratschenZeilen({ blockiert: 3, blockiertFalt: falt(3) }).join()))
pruefe('0 blockierte Gruppen: Hinweis, die Grenze auf 0 zu senken', /auf 0 senken/.test(ratschenZeilen({ blockiert: 0, blockiertFalt: [] }).join()))

/* Verdrahtung: der Bestandswächter als Prozess gegen N blockierte Gruppen (je ein Kommentar am überzähligen Beleg). */
const beleg = (id: number, datum: string) => `- anilistId: ${id}\n  platform: netflix\n  dub: true\n  checkedAt: '${datum}'\n  note: Tonspuren Deutsch`
const blockiert = (n: number) => Array.from({ length: n }, (_, i) => `${beleg(i + 1, '2026-09-01')}\n\n# Info ${i}\n${beleg(i + 1, '2026-08-01')}`).join('\n\n') + '\n'
const wurzel = mkdtempSync(join(tmpdir(), 'fast-doppel-ratsche-'))
try {
  mkdirSync(join(wurzel, 'data'))
  const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
  const lauf = (n: number) => {
    writeFileSync(join(wurzel, 'data', 'dub-confirmed.yaml'), blockiert(n))
    return spawnSync(process.execPath, ['--import', tsx, resolve(ROOT, 'pipeline', 'check-handbeleg-fast-doppel-bestand.ts')], { cwd: wurzel, encoding: 'utf8', timeout: 120_000 })
  }
  const fuenf = lauf(5)
  pruefe('Wächter bei 5 blockierten Gruppen: Exit 0, Ratschen-Warnzeile', fuenf.status === 0 && /^⚠ WARNUNG Handbelege-Ratsche: 5 blockierte/m.test(fuenf.stdout) && /5 blockiert,/.test(fuenf.stdout), fuenf.stdout + fuenf.stderr)
  const vier = lauf(4)
  pruefe('Wächter bei 4 blockierten Gruppen: Exit 0, keine Ratschen-Zeile', vier.status === 0 && !/Ratsche/.test(vier.stdout) && /4 blockiert,/.test(vier.stdout), vier.stdout + vier.stderr)
  const drei = lauf(3)
  pruefe('Wächter bei 3 blockierten Gruppen: Exit 0, Senk-Hinweis', drei.status === 0 && /auf 3 senken/.test(drei.stdout), drei.stdout + drei.stderr)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) process.exit(1)
console.log('✓ Handbelege-Ratsche: blockierte Fast-Doppel-Gruppen über 4 warnen mit Gruppen, darunter Hinweis zum Senken (Funktion und Prozess).')
