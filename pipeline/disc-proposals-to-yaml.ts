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
import { discSlug, log, readJson, warn } from './lib/util.ts'
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
  /**
   * Bekannte Disc-Termine je Anime — als Datumsliste, nicht als Schlüssel.
   *
   * Der erste Anlauf verglich `titleId` **und** Datum. Das ging schief: Wird
   * ein Verkaufsstart verschoben, gilt derselbe Artikel plötzlich als neu, und
   * der Kalender führt dieselbe Ausgabe zweimal mit verschiedenen Terminen.
   * Bei 34 übernommenen Terminen entstanden so 25 Doubletten — „The Café
   * Terrace and Its Goddesses" stand mit dem 07.08. und dem 21.08. da, während
   * der richtige Termin laut Publisher-Meldung der 04.09. war.
   */
  const bekannteTermine = new Map<number, string[]>()
  for (const r of releases.filter((r) => r.releaseType === 'disc')) {
    const liste = bekannteTermine.get(r.titleId)
    if (liste) liste.push(r.schedule.firstEpisodeDate)
    else bekannteTermine.set(r.titleId, [r.schedule.firstEpisodeDate])
  }

  /**
   * Wie nah ein bekannter Termin liegen darf, damit es dieselbe Ausgabe ist.
   *
   * Zwei Monate: Verschiebungen um zwei, drei Wochen sind bei Disc-Terminen
   * die Regel — am 31.07.2026 verschob ein einziger Publisher 21 Titel um
   * genau diese Spanne. Wer enger prüft, sammelt Doubletten; wer weiter prüft,
   * verliert echte Folgebände, die oft im Zweimonatstakt erscheinen.
   */
  const NAH_TAGE = 60
  const tage = (a: string, b: string) =>
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000

  // Nach Anime und Datum bündeln.
  const gebuendelt = new Map<string, DiscProposal[]>()
  let alsDoublette = 0
  for (const v of proposals) {
    if ((bekannteTermine.get(v.titleId) ?? []).some((d) => tage(d, v.date) < NAH_TAGE)) {
      alsDoublette++
      continue
    }
    const key = `${v.titleId}|${v.date}`
    const liste = gebuendelt.get(key)
    if (liste) liste.push(v)
    else gebuendelt.set(key, [v])
  }

  /**
   * Namen der Disc-Ausgaben, die schon im Datensatz stehen.
   *
   * Die Zeitschwelle allein reicht nicht: „DAN DA DAN – Vol. 3" stand mit dem
   * 28.08. im Bestand, der Vorschlag nannte den 30.10. — 63 Tage, also knapp
   * daneben. Dasselbe Produkt bekam so einen zweiten Eintrag. Wo der Name
   * übereinstimmt, ist es dieselbe Ausgabe, egal wie weit die Termine
   * auseinanderliegen.
   */
  const bekannteNamen = new Set(
    releases.filter((r) => r.releaseType === 'disc').map((r) => r.name.toLowerCase()),
  )

  /**
   * Termine, die dieser Lauf selbst schon geschrieben hat — je Ausgabe.
   *
   * `bekannteTermine` prüft gegen den **vorhandenen** Datensatz. Zwei
   * Vorschläge für denselben Anime prüfen sich damit nicht gegeneinander:
   * „My Gift Lvl 9999“ kam als „Complete Series“ zum 08.09. und als
   * „Gesamtausgabe“ zum 24.09. — zwei aniSearch-Artikel für dieselbe
   * ADN-Ausgabe im Abstand von 16 Tagen. Dieselbe Zweimonatsschwelle gilt
   * deshalb auch innerhalb eines Laufs.
   *
   * Geschlüsselt wird über **Anime und Ausgabenname**, nicht über die
   * Anime-Kennung allein: Folgebände erscheinen im Zweimonatstakt und
   * unterscheiden sich genau hier („… – Vol. 1" gegen „… – Vol. 2"). Über die
   * Kennung allein würde die Schwelle sie verschlucken.
   */
  const eigeneTermine = new Map<string, string[]>()

  /**
   * Vergebene Slugs — ein doppelter wäre eine Adresse für zwei Termine.
   *
   * Der Fall ist real: aniSearch führt „The Devil Is a Part-Timer! II" unter
   * einem Artikel (211703, Komplettset Blu-ray), AniList führt dieselbe Staffel
   * unter zwei Kennungen (130592 und 155168) — gleicher Name, je zwölf Folgen,
   * die geteilte Ausstrahlung von 2022 und 2023. Die Bündelung nach
   * `titleId|datum` machte daraus zwei Einträge mit demselben Slug, und
   * `data:validate` brach ab (30.08.2026).
   *
   * **Ein Artikel darf sehr wohl mehrere Einträge erzeugen** — die
   * Naruto-Movie-Collection enthält acht Filme und zwei Specials, jeder mit
   * eigenem Kalendereintrag. Der Riegel gilt dem doppelten *Werk*, nicht der
   * doppelten Quelle.
   */
  const vergebeneSlugs = new Set<string>()

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
    const basis = titel.titleDe ?? titel.titleEn ?? titel.titleRomaji ?? String(titleId)

    /*
     * Die Bandnummer gehört in den Namen, nicht nur in die Edition.
     *
     * Unser Anime-Eintrag heißt manchmal schon „Virgin Road – Vol. 1", weil
     * die erste Ausgabe den Titel geprägt hat. Übernimmt man ihn unverändert
     * für Vol. 2 und Vol. 3, stehen drei Zeilen „Virgin Road – Vol. 1" mit
     * verschiedenen Terminen im Kalender — formal keine Doublette, für den
     * Leser aber genau das.
     */
    const band = /\bVol\.\s*(\d+)\s*\/\s*\d+/i.exec(gruppe[0].edition)?.[1]
    const name = band
      ? `${basis.replace(/\s*[–-]\s*Vol\.\s*\d+\s*$/i, '')} – Vol. ${band}`
      : basis
    if (bekannteNamen.has(name.toLowerCase())) {
      alsDoublette++
      continue
    }

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
    const ausgabe = `${titleId}|${name.toLowerCase()}`
    if ((eigeneTermine.get(ausgabe) ?? []).some((d) => tage(d, datum) < NAH_TAGE)) {
      alsDoublette++
      continue
    }

    const slug = discSlug(name, datum)
    if (vergebeneSlugs.has(slug)) {
      warn(`Slug doppelt: ${slug} — Eintrag ${titleId} zum ${datum} ausgelassen`)
      alsDoublette++
      continue
    }
    vergebeneSlugs.add(slug)
    const eigene = eigeneTermine.get(ausgabe)
    if (eigene) eigene.push(datum)
    else eigeneTermine.set(ausgabe, [datum])

    zeilen.push(
      `- slug: ${slug}`,
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
  log(
    `${anzahl} Disc-Termine nach ${OUT} geschrieben — aus ${proposals.length} Vorschlägen, ` +
      `${alsDoublette} als bereits bekannte Ausgabe übersprungen`,
  )
}

main()
