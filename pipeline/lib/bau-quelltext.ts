import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './util.ts'

/**
 * Der Quelltext des Baus als ein Text: `pipeline/bau/*.ts` in Dateinamen-Reihenfolge, danach
 * `pipeline/build.ts`. Die Phasen tragen ihre Aufrufreihenfolge im Namen (`03-reihen.ts`), damit
 * Zusicherungen, die die Reihenfolge von Marken im Bau prüfen, nach dem Zerlegen weiter gelten.
 */
export function bauQuelltext(): string {
  const ordner = join(ROOT, 'pipeline/bau')
  const phasen = readdirSync(ordner)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => readFileSync(join(ordner, f), 'utf8'))
  return [...phasen, readFileSync(join(ROOT, 'pipeline/build.ts'), 'utf8')].join('\n')
}
