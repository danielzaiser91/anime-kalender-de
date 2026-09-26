import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './util.ts'

/**
 * Der Quelltext des Baus als ein Text: `pipeline/bau/*.ts` in Dateinamen-Reihenfolge, danach
 * `pipeline/build.ts`. Die Phasen tragen ihre Aufrufreihenfolge im Namen (`03-reihen.ts`), damit
 * Zusicherungen, die die Reihenfolge von Marken im Bau prüfen, nach dem Zerlegen weiter gelten.
 */
export function bauQuelltext(): string {
  return [...ordnerText('pipeline/bau', /\.ts$/), readFileSync(join(ROOT, 'pipeline/build.ts'), 'utf8')].join('\n')
}

/** Das Detail-Panel als ein Text: `DetailPanel.tsx` und seine Teile in `components/detail/`. */
export function panelQuelltext(): string {
  const panel = readFileSync(join(ROOT, 'web/src/components/DetailPanel.tsx'), 'utf8')
  return [panel, ...ordnerText('web/src/components/detail', /\.tsx?$/)].join('\n')
}

/** Der Worker als ein Text: `index.ts` und seine Module in `worker/src/`. */
export function workerQuelltext(): string {
  const index = readFileSync(join(ROOT, 'worker/src/index.ts'), 'utf8')
  return [index, ...ordnerText('worker/src', /^(?!index\.ts$).*\.ts$/)].join('\n')
}

function ordnerText(ordner: string, muster: RegExp): string[] {
  const pfad = join(ROOT, ordner)
  if (!existsSync(pfad)) return []
  return readdirSync(pfad)
    .filter((f) => muster.test(f))
    .sort()
    .map((f) => readFileSync(join(pfad, f), 'utf8'))
}
