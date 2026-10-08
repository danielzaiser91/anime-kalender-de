/**
 * Daten-Detektiv (PoC, 08.10.2026): kämmt den veröffentlichten Datensatz gegen sich selbst und
 * gegen Zweitquellen aus `data/` auf Widersprüche, Unplausibles und Lücken durch und sortiert die
 * Funde nach Hebel (Nutzerwirkung × Sicherheit). Liest nur, schreibt nur den Bericht.
 *
 *   npx tsx tools/daten-detektiv.ts                      Bericht nach daniel-zum-abarbeiten/
 *   npx tsx tools/daten-detektiv.ts --aus <ordner>       anderer Zielordner
 *   npx tsx tools/daten-detektiv.ts --heute 2026-10-08   Stichtag festlegen (Vergleichbarkeit)
 *   npx tsx tools/daten-detektiv.ts --nur D-01,D-11      nur diese Regeln, Treffer vollständig auf stdout
 *
 * Endet mit Exit 0 (Messlauf). Regeln, Einstufung und Zahlen: docs/wissen/daten-detektiv.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { delta, json, markdown, sortiertNachHebel } from './daten-detektiv/bericht.ts'
import { hebel } from './daten-detektiv/einstufung.ts'
import { ladeBestand, WURZEL } from './daten-detektiv/laden.ts'
import type { Regel } from './daten-detektiv/regel.ts'
import { regelnQuellen } from './daten-detektiv/regeln-quellen.ts'
import { regelnTermine } from './daten-detektiv/regeln-termine.ts'
import { regelnTitel } from './daten-detektiv/regeln-titel.ts'

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function main(): void {
  const heute = argument('--heute') ?? new Date().toISOString().slice(0, 10)
  const ziel = resolve(WURZEL, argument('--aus') ?? 'daniel-zum-abarbeiten')
  const nur = argument('--nur')?.split(',')
  const b = ladeBestand(heute)
  let regeln: Regel[] = [...regelnTermine(b), ...regelnTitel(b), ...regelnQuellen(b)]
  if (nur) regeln = regeln.filter((r) => nur.includes(r.id))

  for (const r of sortiertNachHebel(regeln)) {
    console.log(`${r.id} ${r.name}: ${r.treffer.length} / ${r.geprueft} (Hebel ${hebel(r.id).toFixed(1)})`)
    for (const t of r.treffer.slice(0, nur ? 500 : 3)) console.log(`    ${t.text}`)
  }
  if (nur) return

  mkdirSync(ziel, { recursive: true })
  const jsonPfad = resolve(ziel, 'daten-detektiv.json')
  const alt = existsSync(jsonPfad) ? (JSON.parse(readFileSync(jsonPfad, 'utf8')) as { regeln: Regel[] }) : undefined
  const unterschiede = delta(alt, regeln)
  writeFileSync(jsonPfad, json(regeln, b.meta.generatedAt, heute))
  const md = markdown(regeln, b.meta.generatedAt, heute) + (unterschiede.length ? `\n## Gegenüber dem vorigen Lauf\n\n${unterschiede.map((z) => `- ${z}`).join('\n')}\n` : '')
  writeFileSync(resolve(ziel, 'daten-detektiv.md'), md)
  console.log(`\nBericht: ${resolve(ziel, 'daten-detektiv.md')}${unterschiede.length ? `\nDelta: ${unterschiede.join(' · ')}` : ''}`)
}

main()
