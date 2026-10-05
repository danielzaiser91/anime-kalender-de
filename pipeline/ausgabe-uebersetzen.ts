/**
 * Schreibt `dist/data/` auf unsere eigenen Kennungen um (Stufe 1, `pipeline/lib/ausgabe-kennung.ts`).
 * Aufruf: `tsx pipeline/ausgabe-uebersetzen.ts [Verzeichnis]` — Vorgabe `dist/data`, nach `vite build`.
 */
import { existsSync } from 'node:fs'
import { uebersetzeVerzeichnis } from './lib/ausgabe-kennung.ts'

const wurzel = process.argv[2] ?? 'dist/data'
if (!existsSync(wurzel)) throw new Error(`${wurzel} fehlt — zuerst vite build`)
const { dateien } = uebersetzeVerzeichnis(wurzel, 'data/kennungen.json')
console.log(`${dateien} Dateien in ${wurzel} auf eigene Kennungen umgeschrieben.`)
