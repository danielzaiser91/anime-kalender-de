import { writeJson, readJson, log } from '../lib/util.ts'
import { OUT } from './grundlagen.ts'
import { baueNews, type NewsHistorie } from '../lib/news.ts'
import { type Release, type ReleaseEvent, type Title, type DataMeta } from '../../shared/types.ts'

export function schreibeKernUndNews({ releases, events, titles, meta }: {
  releases: Release[]
  events: ReleaseEvent[]
  titles: Map<number, Title>
  meta: DataMeta
}) {
  /*
    **Prime-Verweise gehen unter die Video-Adresse — einmal für alle, zum Schluss.**

    Die Adressen kommen aus sechs Quellen (AniList, JustWatch, MOTN, Meldungen,
    Handpflege, Kanal-Gegenprobe), und jede hat ihre eigene Schreibweise. Eine
    Stichprobe am 20.09.2026 zeigte, was das kostet: Sieben von fünfzehn
    `/dp/`-Verweisen mit Befund „lebt" antworteten selbst mit 404, weil die
    Prüfung bei einem 404 still auf die Video-Adresse ausweicht und den Erfolg
    unter der alten bucht. Fünfzehn von fünfzehn lebten unter
    `/gp/video/detail/`.

    Deshalb hier, hinter allen Quellen: Was als Prime-Video-Weg im Datensatz
    steht, trägt die Video-Adresse. Discs und Shop-Artikel laufen über
    `watchLinks` mit eigener Plattform und bleiben unberührt.
  */
  writeJson(`${OUT}/releases.json`, releases)
  writeJson(`${OUT}/events.json`, events)

  /*
    **Die Nachrichten — aus dem, was ohnehin dasteht.** Kein neuer Abruf: neue
    Synchros, neue Folgen, Termine und verpasste Termine stehen bereits im
    Datensatz. Das Gedächtnis daneben hält fest, wann eine Meldung zum ersten
    Mal wahr war; ohne das rutschte bei jedem Bau alles auf heute.
  */
  let newsFuerRss: ReturnType<typeof baueNews> | undefined
  {
    const newsHistorie = readJson<NewsHistorie>('data/news-historie.json', { zuerst: {} })
    const meldungen = baueNews(
      [...titles.values()],
      releases,
      readJson<{ id: number; seit: string }[]>(`${OUT}/neu-mit-synchro.json`, []),
      readJson<{ folgen?: { serieId: string; serie: string; nummer?: number; gesehenAm: string }[] }>(
        'data/crunchyroll-neu.json',
        {},
      ).folgen ?? [],
      newsHistorie,
    )
    writeJson(`${OUT}/news.json`, meldungen)
    newsFuerRss = meldungen
    writeJson('data/news-historie.json', newsHistorie)
    const jeArt = new Map<string, number>()
    let einzeln = 0
    for (const e of meldungen)
      for (const m of e.meldungen) {
        einzeln++
        jeArt.set(m.art, (jeArt.get(m.art) ?? 0) + 1)
      }
    log(
      `${meldungen.length} Einträge für die Nachrichtenseite, ${einzeln} Meldungen darin (` +
        [...jeArt].map(([a, n]) => `${a} ${n}`).join(', ') +
        ')',
    )
  }
  writeJson(`${OUT}/meta.json`, meta, true)
  return { newsFuerRss }
}
