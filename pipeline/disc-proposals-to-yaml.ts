/**
 * Macht aus den Disc-Vorschlägen einen kuratierten Datensatz.
 *
 * Der Zwischenschritt ist Absicht: `extract-disc-dates.ts` liest das Archiv und
 * schlägt vor, dieses Skript gießt das Ergebnis in die Form, die `data/curated/`
 * erwartet. Wer die Vorschläge vorher durchsehen will, tut es dazwischen.
 *
 * Zusammengefasst wird nach **Anime und Datum**: „Standard", „Limited" und
 * „Steelcase" erscheinen am selben Tag und sind für einen Kalender ein einziger
 * Termin. Die Editionsnamen wandern in ein Feld, nicht in drei Einträge.
 *
 * Aufruf: npx tsx pipeline/disc-proposals-to-yaml.ts [--out datei.yaml]
 */
import { writeFileSync } from 'node:fs'
import { log, readJson, slugify, warn } from './lib/util.ts'
import type { Release, Title } from '../shared/types.ts'
import type { DiscProposal } from './extract-disc-dates.ts'

const args = process.argv.slice(2)
const OUT = args[args.indexOf('--out') + 1] ?? 'data/curated/disc-anisearch.yaml'

/** YAML-sicher: Anführungszeichen verdoppeln, alles in Doppelhochkommas. */
function q(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

function main(): void {
  const { proposals } = readJson<{ proposals: DiscProposal[] }>(
    'data/proposals/disc-anisearch.json',
    { proposals: [] },
  )
  if (!proposals.length) {
    warn('Keine Vorschläge — erst "npm run data:disc-proposals" laufen lassen.')
    return
  }
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const titelNach = new Map(titles.map((t) => [t.id, t]))
  const vorhanden = new Set(
    releases
      .filter((r) => r.releaseType === 'disc')
      .map((r) => `${r.titleId}|${r.schedule.firstEpisodeDate}`),
  )

  // Nach Anime und Datum bündeln.
  const gebuendelt = new Map<string, DiscProposal[]>()
  for (const v of proposals) {
    const key = `${v.titleId}|${v.date}`
    if (vorhanden.has(key)) continue
    const liste = gebuendelt.get(key)
    if (liste) liste.push(v)
    else gebuendelt.set(key, [v])
  }

  const zeilen: string[] = [
    '# Disc-Termine aus dem archivierten aniSearch-Bestand.',
    '#',
    '# Erzeugt von pipeline/disc-proposals-to-yaml.ts aus data/proposals/disc-anisearch.json.',
    '# Grundlage ist der Abschnitt „Neuerscheinungen" der jeweiligen aniSearch-Seite; das Datum',
    '# steht dort maschinenlesbar als data-date. Alle Termine sind angekündigte Verkaufsstarts,',
    '# deshalb kein `estimated`. Eine Uhrzeit gibt es bei Disc-Veröffentlichungen nicht.',
    '#',
    '# Mehrere Editionen am selben Tag sind ein Eintrag — sie stehen zusammengefasst in `edition`.',
    '',
  ]

  let anzahl = 0
  for (const [key, gruppe] of [...gebuendelt.entries()].sort()) {
    const [titleIdStr, datum] = key.split('|')
    const titleId = Number(titleIdStr)
    const titel = titelNach.get(titleId)
    if (!titel) continue
    const name = titel.titleDe ?? titel.titleEn ?? titel.titleRomaji ?? String(titleId)

    // Editionsnamen: den gemeinsamen Titelteil abschneiden, damit nicht dreimal
    // der Serienname in der Zeile steht.
    const editionen = [
      ...new Set(
        gruppe.map((g) =>
          g.edition
            .replace(/^.*? - /, '')
            .replace(/\[|\]/g, '')
            .trim(),
        ),
      ),
    ]
    zeilen.push(
      `- slug: ${slugify(`${name}-${datum}`)}`,
      `  anilistId: ${titleId}`,
      `  titleDe: ${q(name)}`,
      '  platform: disc',
      '  releaseType: disc',
      ...(gruppe[0].publisher ? [`  publisher: ${q(gruppe[0].publisher)}`] : []),
      `  edition: ${q(editionen.join(' · '))}`,
      `  schedule: { firstEpisodeDate: ${q(datum)} }`,
      `  sources: [${gruppe[0].url}]`,
      '',
    )
    anzahl++
  }

  writeFileSync(OUT, zeilen.join('\n'), 'utf8')
  log(`${anzahl} Disc-Termine nach ${OUT} geschrieben (aus ${proposals.length} Vorschlägen)`)
}

main()
