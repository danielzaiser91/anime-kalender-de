/**
 * Wo ein Titel ohne Verweis vermutlich läuft — als Vorschlag, nicht als Beleg.
 *
 * **Der Fall.** 1.331 Titel im Bestand haben keinen einzigen Verweis, und 884
 * davon tragen belegte deutsche Sprechrollen aus ANN. Es gibt sie also auf
 * Deutsch; wir wissen nur nicht, wo. Für 224 davon nennt TMDB einen deutschen
 * Anbieter, und keiner dieser 224 steht in `data/dub-confirmed.yaml` — sie sind
 * ungeprüft, nicht abgelehnt.
 *
 * **Warum daraus kein Verweis wird.** Ein Titel ohne Verweis ist nicht dasselbe
 * wie ein Titel ohne geprüften Verweis (CLAUDE.md). Am 25.08.2026 gab ein Lauf
 * 14 Titeln einen Verweis, weil TMDB einen Anbieter nannte — bei fünf davon
 * hatte Daniel vorher geprüft und „keine deutsche Tonspur" eingetragen. Der
 * Deploy wurde zu Recht rot.
 *
 * TMDB sagt außerdem nur, **dass** ein Titel dort läuft, nicht in welcher
 * Sprache. Für dieses Projekt ist das die halbe Auskunft.
 *
 * **Also eine Vorschlagsdatei.** `data/anbieter-vorschlaege.json` wird von
 * `build.ts` nie gelesen — dieselbe Bauweise wie bei `data/tmdb-kino.json`. Die
 * Prüflisten der Erweiterung lesen sie und machen daraus Suchadressen; was
 * Daniel dort meldet, wird zum Beleg.
 *
 * Aufruf: `npx tsx pipeline/vorschlaege-anbieter.ts`
 */
import { readFileSync } from 'node:fs'
import { log, readJson, writeJson } from './lib/util.ts'
import type { PlatformId, Title } from '../shared/types.ts'

interface Vorschlag {
  id: number
  titel: string
  folgen: number | null
  format: string | null
  jahr: number | null
  /** Anbieter laut TMDB, in TMDBs Reihenfolge — die ist nach Relevanz sortiert. */
  anbieter: PlatformId[]
  /** Hat ANN deutsche Sprechrollen belegt? Dann ist die Suche besonders lohnend. */
  sprechrollen: boolean
}

function main(): void {
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const tmdb = readJson<Record<string, { providers?: PlatformId[] }>>('data/tmdb-titles.json', {})

  /*
    Wer in `dub-confirmed.yaml` steht, wurde bereits angesehen — dort steht auch
    das Nein. Ein Vorschlag für ihn wäre die Bitte, dieselbe Arbeit noch einmal
    zu machen.
  */
  const yaml = readFileSync('data/dub-confirmed.yaml', 'utf8')
  const geprueft = new Set([...yaml.matchAll(/anilistId:\s*(\d+)/g)].map((m) => m[1]))

  const vorschlaege: Vorschlag[] = []
  for (const t of titles) {
    if ((t.streams ?? []).length > 0) continue
    if (geprueft.has(String(t.id))) continue
    const anbieter = tmdb[String(t.id)]?.providers ?? []
    if (!anbieter.length) continue
    vorschlaege.push({
      id: t.id,
      titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
      folgen: t.episodes ?? null,
      format: t.format ?? null,
      jahr: t.jpYear ?? null,
      anbieter,
      sprechrollen: Boolean(t.hasVoices),
    })
  }

  /*
    Nach Aussicht sortiert: Wo ANN deutsche Sprecher belegt, ist die Suche
    lohnender als dort, wo nur ein Anbieter vermutet wird. Innerhalb dessen
    zuerst die Serien — eine gefundene Serie bringt mehr Folgen als ein Film.
  */
  vorschlaege.sort((a, b) => {
    if (a.sprechrollen !== b.sprechrollen) return a.sprechrollen ? -1 : 1
    return (b.folgen ?? 0) - (a.folgen ?? 0)
  })

  writeJson('data/anbieter-vorschlaege.json', vorschlaege)

  const jeAnbieter: Record<string, number> = {}
  for (const v of vorschlaege) for (const a of v.anbieter) jeAnbieter[a] = (jeAnbieter[a] ?? 0) + 1
  const mitRollen = vorschlaege.filter((v) => v.sprechrollen).length

  log(
    `${vorschlaege.length} Vorschläge (${mitRollen} mit belegten Sprechrollen): ` +
      Object.entries(jeAnbieter)
        .sort((a, b) => b[1] - a[1])
        .map(([a, n]) => `${a} ${n}`)
        .join(', '),
  )
}

main()
