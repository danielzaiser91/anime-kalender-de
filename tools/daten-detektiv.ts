/**
 * Daten-Detektiv (PoC, 08.10.2026): kämmt den veröffentlichten Datensatz gegen sich selbst und
 * gegen Zweitquellen aus `data/` auf Widersprüche, Unplausibles und Lücken durch und sortiert die
 * Funde nach Hebel (Nutzerwirkung × Sicherheit). Liest nur, schreibt nur den Bericht.
 *
 *   npx tsx tools/daten-detektiv.ts                      Bericht nach daniel-zum-abarbeiten/
 *   npx tsx tools/daten-detektiv.ts --aus <ordner>       anderer Zielordner
 *   npx tsx tools/daten-detektiv.ts --heute 2026-10-08   Stichtag festlegen (Vergleichbarkeit)
 *   npx tsx tools/daten-detektiv.ts --nur D-01,D-11      nur diese Regeln, Treffer vollständig auf stdout
 *   npx tsx tools/daten-detektiv.ts --wache              neue Schlüssel der weichen Regeln als JSON-Zeile (Wochenwache)
 *   npx tsx tools/daten-detektiv.ts --bekannt-schreiben [--neue-aufnehmen]   data/detektiv-bekannt.json neu schreiben
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
import { festzuschreiben, ladeBekannt, neueFunde, schreibeBekannt } from './daten-detektiv/wache.ts'

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** `--wache`: eine JSON-Zeile mit den neuen Schlüsseln der weichen Regeln (für `tools/wache-woechentlich.mjs`); `--bekannt-schreiben [--neue-aufnehmen]` schreibt `data/detektiv-bekannt.json`. */
function wache(regeln: Regel[]): void {
  const bekannt = ladeBekannt()
  if (process.argv.includes('--bekannt-schreiben')) {
    const neu = festzuschreiben(regeln, bekannt, process.argv.includes('--neue-aufnehmen'))
    schreibeBekannt(neu)
    console.log(`Bekannt: ${Object.values(neu).reduce((n, l) => n + l.length, 0)} Schlüssel in ${Object.keys(neu).length} Regeln geschrieben`)
    return
  }
  console.log(JSON.stringify({ neu: neueFunde(regeln, bekannt) }))
}

function main(): void {
  const heute = argument('--heute') ?? new Date().toISOString().slice(0, 10)
  const ziel = resolve(WURZEL, argument('--aus') ?? 'daniel-zum-abarbeiten')
  const nur = argument('--nur')?.split(',')
  const b = ladeBestand(heute)
  let regeln: Regel[] = [...regelnTermine(b), ...regelnTitel(b), ...regelnQuellen(b)]
  if (nur) regeln = regeln.filter((r) => nur.includes(r.id))
  if (process.argv.includes('--wache') || process.argv.includes('--bekannt-schreiben')) return wache(regeln)

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
