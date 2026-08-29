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
  /**
   * Warum dieser Vorschlag unsicher ist — leer, wenn er es nicht ist.
   *
   * Er wird deshalb **nicht** weggelassen: Ein Vorfilter verschiebt, er löscht
   * nicht (CLAUDE.md). Aber er steht hinten und sagt selbst, woran es liegt.
   */
  unsicher?: string
}

function main(): void {
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const tmdb = readJson<Record<string, { providers?: PlatformId[]; kind?: string; jahr?: number }>>(
    'data/tmdb-titles.json',
    {},
  )

  /*
    Wer in `dub-confirmed.yaml` steht, wurde bereits angesehen — dort steht auch
    das Nein. Ein Vorschlag für ihn wäre die Bitte, dieselbe Arbeit noch einmal
    zu machen.
  */
  const yaml = readFileSync('data/dub-confirmed.yaml', 'utf8')
  /*
    **Geprüft wird ein Titel bei einem Anbieter, nicht ein Titel.**

    Der Filter las bis zum 29.08.2026 nur die `anilistId` und sperrte damit
    jeden Vorschlag zu diesem Titel, egal für welche Plattform. Gemessen: 27 von
    83 Titeln mit belegten deutschen Sprechrollen und ganz ohne Weg fielen so
    heraus.

    „Fullmetal Alchemist" ist der Fall zum Anfassen: geprüft wurde **Netflix**
    (Titelseite ohne abspielbare Folge), TMDB nennt **Prime**. Der Beleg für den
    einen Anbieter sagt über den anderen nichts — und der Titel zeigt seit der
    Crunchyroll-Bereinigung gar keinen Weg mehr.

    Gesperrt wird deshalb das Paar aus Kennung und Plattform.
  */
  const geprueft = new Set()
  for (const block of yaml.split(/\n(?=- anilistId:)/)) {
    const id = /anilistId:\s*(\d+)/.exec(block)?.[1]
    const plattform = /\n\s*platform:\s*(\S+)/.exec(block)?.[1]
    if (id && plattform) geprueft.add(`${id}|${plattform}`)
  }

  const vorschlaege: Vorschlag[] = []
  for (const t of titles) {
    if ((t.streams ?? []).length > 0) continue
    /* Nur die Anbieter, zu denen es noch keine Handpruefung gibt. */
    const anbieter = (tmdb[String(t.id)]?.providers ?? []).filter(
      (p) => !geprueft.has(`${t.id}|${p}`),
    )
    if (!anbieter.length) continue
    /*
      **Passt der TMDB-Treffer überhaupt zu unserem Eintrag?**

      Gemessen am 29.08.2026: Unsere OVA 20779 („Beyond the Boundary —
      Morgendämmerung", 1 Folge, 2014) wurde auf die **TV-Serie** TMDB 61695
      abgebildet. Deren Anbieter — ADN und Prime — landeten damit als Vorschlag
      in der Prüfliste, und Daniel suchte bei Prime nach einer OVA, für die dort
      nie etwas stand. Dreizehn der 185 Vorschläge sind von dieser Art.

      Zwei Prüfungen, beide einfach und beide gegen einen belegten Fall:

      - **Format:** Ein Film bei uns, eine Serie bei TMDB (oder umgekehrt) — dann
        gelten die Anbieter nicht dem, was wir suchen.
      - **Jahr:** Fünf Jahre Abstand oder mehr. „Elysium" ist bei uns ein
        koreanischer Film von 2003, die Suche führt auf den Hollywood-Film von
        2013 (Daniel, 28.08.2026).

      Der Vorschlag bleibt trotzdem in der Liste, nur hinten und mit Vermerk. Ein
      TMDB-Treffer auf die Serie ist ein schwacher Hinweis, aber kein Unsinn:
      Läuft die Serie bei Prime, liegt die OVA vielleicht daneben.
    */
    const e = tmdb[String(t.id)]
    const unsFilm = t.format === 'MOVIE'
    const unsNeben = t.format === 'OVA' || t.format === 'SPECIAL' || t.format === 'ONA'
    const gruende: string[] = []
    if (e?.kind && ((unsFilm && e.kind !== 'movie') || (unsNeben && e.kind === 'tv'))) {
      gruende.push(`TMDB kennt nur die Serie, wir führen ${t.format}`)
    }
    if (e?.jahr && t.jpYear && Math.abs(e.jahr - t.jpYear) >= 5) {
      gruende.push(`TMDB-Treffer von ${e.jahr}, unser Eintrag von ${t.jpYear}`)
    }

    vorschlaege.push({
      id: t.id,
      titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
      folgen: t.episodes ?? null,
      format: t.format ?? null,
      jahr: t.jpYear ?? null,
      anbieter,
      sprechrollen: Boolean(t.hasVoices),
      ...(gruende.length ? { unsicher: gruende.join('; ') } : {}),
    })
  }

  /*
    Nach Aussicht sortiert: Wo ANN deutsche Sprecher belegt, ist die Suche
    lohnender als dort, wo nur ein Anbieter vermutet wird. Innerhalb dessen
    zuerst die Serien — eine gefundene Serie bringt mehr Folgen als ein Film.
  */
  vorschlaege.sort((a, b) => {
    /* Unsichere ganz nach hinten — sie kosten dieselbe Zeit und bringen weniger. */
    if (Boolean(a.unsicher) !== Boolean(b.unsicher)) return a.unsicher ? 1 : -1
    if (a.sprechrollen !== b.sprechrollen) return a.sprechrollen ? -1 : 1
    return (b.folgen ?? 0) - (a.folgen ?? 0)
  })

  writeJson('data/anbieter-vorschlaege.json', vorschlaege)

  const jeAnbieter: Record<string, number> = {}
  for (const v of vorschlaege) for (const a of v.anbieter) jeAnbieter[a] = (jeAnbieter[a] ?? 0) + 1
  const mitRollen = vorschlaege.filter((v) => v.sprechrollen).length
  const unsichere = vorschlaege.filter((v) => v.unsicher).length

  log(
    `${vorschlaege.length} Vorschläge (${mitRollen} mit belegten Sprechrollen, ${unsichere} unsicher): ` +
      Object.entries(jeAnbieter)
        .sort((a, b) => b[1] - a[1])
        .map(([a, n]) => `${a} ${n}`)
        .join(', '),
  )
}

main()
