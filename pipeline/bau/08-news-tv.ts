import { readJson, log } from '../lib/util.ts'
import { type Vorschlag, releasesAus } from '../lib/meldungen.ts'
import { todayIso, addDays } from '../../shared/time.ts'
import { type TvSendung } from '../fetch-tv-programm.ts'
import { type WikiListen, sendungNeuZuordnen, releasesAusTvProgramm, sendungenAnhaengen } from '../lib/tv-termine.ts'
import { quellenPflegen } from './nebendateien.ts'
import { type Title, type Release } from '../../shared/types.ts'

export function ergaenzeTermineAusNewsUndTv({ titles, releases }: {
  titles: Map<number, Title>
  releases: Release[]
}) {
  // Der letzte Schritt vor der Auswertung, und mit Absicht der letzte: Was aus
  // `data/curated/`, Crunchyroll oder ADN schon da ist, gewinnt gegen den Bot.
  const rohVorschlaege = readJson<{ proposals?: Vorschlag[] }>('data/proposals/anime2you.json', {})
  const ausMeldungen = releasesAus(
    rohVorschlaege.proposals ?? [],
    [...titles.values()],
    releases,
    todayIso(),
  )
  releases.push(...ausMeldungen)
  if (ausMeldungen.length)
    log(
      `${ausMeldungen.length} Termine automatisch aus Anime2You übernommen: ` +
        ausMeldungen.map((r) => `${r.name} (${r.platform}, ${r.schedule.firstEpisodeDate})`).join(', '),
    )

  // --- Termine aus dem TV-Programm (RTL+) -------------------------------------
  // Nach den Handeinträgen: Ein gepflegter TV-Termin kennt die Folgennummern und gewinnt.
  /* Der Schlüssel „tvde_<sender>+<kennung>" trägt die tv.de-Kennung der Sendung — für den Link zum Programm. */
  const tvProgramm = Object.entries(
    readJson<{ sendungen?: Record<string, TvSendung> }>('data/tv-programm.json', {}).sendungen ?? {},
  ).map(([k, s]) => ({ ...s, kennung: /^tvde_[^+]+\+(\d+)$/.exec(k)?.[1] }))
  const tvFolgenListen: WikiListen = {
    /*
      **aniSearch-Folgentitel als Grundstock** (23.09.2026). Ohne sie hat ein Titel ohne
      Wikipedia-Liste gar keine Folgennamen — „One Piece Log: Fish-Man Island Saga" (183423)
      zum Beispiel, dessen vier Sendungen am 28./29.09.2026 unter One Piece liefen. Steht
      weiter unten eine bessere Liste (TMDB, RTL+, Wikipedia), gewinnt sie: Sie kommt später.
    */
    ...Object.fromEntries(
      Object.entries(readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {})).flatMap(([id, x]) => {
        const folgen = x.anisearchId
          ? (readJson<Record<string, { folgen?: { nr: number; de?: string; datum?: string }[] }>>('data/anisearch-folgen.json', {})[
              String(x.anisearchId)
            ]?.folgen ?? [])
          : []
        const mit = folgen.filter((f) => f.de).map((f) => ({ nr: f.nr, dt: f.de!, ...(f.datum ? { ead: f.datum.slice(0, 10) } : {}) }))
        return mit.length ? [[id, { seite: 'aniSearch', url: `https://www.anisearch.de/anime/${x.anisearchId}/episodes`, folgen: mit }] as const] : []
      }),
    ),
      /*
        TMDB zuletzt: deutsche Folgentitel, über Staffeln durchgezählt (Staffel 0 = Specials
        zählt nicht). Bei Solo Leveling die einzige Liste; bei Eyeshield 21 passten 0 von 5
        TV-Titeln — dann bleibt es beim Zählen (19.09.2026).
      */
      ...Object.fromEntries(
        Object.entries(
          readJson<Record<string, { tmdbId: number; folgen: { s: number; e: number; titel?: string }[] }>>('data/tmdb-folgen.json', {}),
        ).map(([id, x]) => [
          id,
          {
            seite: 'TMDB',
            url: `https://www.themoviedb.org/tv/${x.tmdbId}`,
            folgen: x.folgen
              .filter((f) => f.s >= 1)
              .sort((a, b) => a.s - b.s || a.e - b.e)
              .map((f, i) => ({ nr: i + 1, dt: f.titel ?? '' }))
              .filter((f) => f.dt && !/^(folge|episode) \d+$/i.test(f.dt)),
          },
        ]),
      ),
      /* RTL+ nur, wo die Wikipedia keine Liste hat (Beyblade X, 19.09.2026). */
      ...Object.fromEntries(
        Object.entries(
          readJson<{ titel?: Record<string, { programm: string; folgen: WikiListen[string]['folgen'] }> }>(
            'data/rtlplus-folgen.json',
            {},
          ).titel ?? {},
        ).map(([id, x]) => [id, { seite: 'den Folgenseiten von RTL+', url: `https://plus.rtl.de/${x.programm}`, folgen: x.folgen }]),
      ),
      ...(readJson<{ titel?: WikiListen }>('data/wikipedia-folgen.json', {}).titel ?? {}),
  }
  /*
    Erst umhängen, dann beides füttern: Die Termine entstehen aus den zugeordneten Sendungen, und
    dieselben Sendungen hängen danach an den Terminen. Mit den Rohdaten bekam „One Piece Log:
    Fish-Man Island Saga" am 23.09.2026 zwar ein Release, aber keine einzige Sendung.
  */
  const tvZugeordnet = sendungNeuZuordnen(tvProgramm, titles, tvFolgenListen)
  const ausTv = releasesAusTvProgramm(tvZugeordnet, titles, releases, tvFolgenListen)
  releases.push(...ausTv)
  sendungenAnhaengen(releases, tvZugeordnet, addDays(todayIso(), -1), tvFolgenListen)
  if (ausTv.length) log(`${ausTv.length} TV-Termine aus dem RTL+-Programm: ${ausTv.map((r) => `${r.name} (${r.sender})`).join(', ')}`)

  quellenPflegen(releases)
}
