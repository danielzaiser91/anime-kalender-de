/**
 * Fast-Doppel aus `data/dub-confirmed.yaml` entfernen (Regel und Ausnahmen: `pipeline/lib/handbeleg-fast-doppel.ts`).
 * Aufruf: `npx tsx tools/handbelege-fast-doppel.ts [--trocken] [Datei]`; ohne Datei die Handbelege im Arbeitsordner.
 * Gegenprobe vor dem Schreiben: `pipeline/lib/handbeleg-fast-doppel-datei.ts`.
 */
import { vereineDatei } from '../pipeline/lib/handbeleg-fast-doppel-datei.ts'

const args = process.argv.slice(2)
const trocken = args.includes('--trocken')
const pfad = args.find((a) => !a.startsWith('--')) ?? 'data/dub-confirmed.yaml'
const { ok, zeilen } = vereineDatei(pfad, trocken)
for (const z of zeilen) (ok ? console.log : console.error)(z)
if (!ok) process.exit(1)
