import { writeJson, readJson, log } from '../lib/util.ts'
import { pruefeInvarianten, zaehlworteStimmen } from '../lib/invarianten.ts'
import { zaehleBelegte } from '../lib/belegstaerke.ts'
import { OUT } from './grundlagen.ts'
import { auslieferungsInvarianten } from './auslieferung-pruefen.ts'
import { releasesAusNurOriginalton } from '../lib/pruefung.ts'
import { autoReleaseWidersprueche } from '../lib/auto-release-pruefung.ts'
import { vorschlaegeAusAllenSammelartikeln } from '../lib/sammelartikel.ts'
import { baueNews, type NewsHistorie } from '../lib/news.ts'
import { omuTitelAusKatalog } from '../lib/news-omu.ts'
import { belegeFuerAlle, type BelegGedaechtnis } from '../lib/beleg-lesung.ts'
import { entdoppeleUndMelde } from '../lib/beleg-anbieter.ts'
import { messungenFuerFolgen } from '../lib/news-messung.ts'
import { nurOriginaltonMeldungen, type Vorschlag } from '../lib/meldungen.ts'
import { type Release, type ReleaseEvent, type Title, type DataMeta, type NewsEintrag } from '../../shared/types.ts'

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
  bruecheBeiWiderspruchAb(pruefeInvarianten(releases, events, titles))
  bruecheBeiWiderspruchAb({ fehler: [...auslieferungsInvarianten(), ...releasesAusNurOriginalton(releases, nurOriginaltonAdressen()), ...autoReleaseFehler(releases)], warnungen: [] })
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
    const meldungen = entdoppeleUndMelde(messungenFuerFolgen(belegeFuerAlle(baueNews(
      [...titles.values()],
      releases,
      readJson<{ id: number; seit: string }[]>(`${OUT}/neu-mit-synchro.json`, []),
      readJson<{ folgen?: { serieId: string; serie: string; nummer?: number; gesehenAm: string }[] }>(
        'data/crunchyroll-neu.json',
        {},
      ).folgen ?? [],
      newsHistorie,
      /* Das zuvor ausgelieferte `news.json` speist beim ersten Lauf den Verlauf. */
      readJson<NewsEintrag[]>(`${OUT}/news.json`, []), omuTitelAusKatalog(OUT), nurOriginaltonAdressen(),
    ), readJson<BelegGedaechtnis>('data/beleg-lesungen.json', {}))))
    writeJson(`${OUT}/news.json`, meldungen)
    newsFuerRss = meldungen
    writeJson('data/news-historie.json', newsHistorie)
    const jeArt = new Map<string, number>()
    let einzeln = 0
    let abgeloest = 0
    for (const e of meldungen)
      for (const m of e.meldungen) {
        einzeln++
        if (m.ersetzt || m.zurueckgezogen) abgeloest++
        jeArt.set(m.art, (jeArt.get(m.art) ?? 0) + 1)
      }
    log(
      `${meldungen.length} Einträge für die Nachrichtenseite, ${einzeln} Meldungen darin (` +
        [...jeArt].map(([a, n]) => `${a} ${n}`).join(', ') +
        `), davon ${abgeloest} abgelöst und sichtbar geblieben`,
    )
  }
  /* Releases kommen nach `baueMeta` noch hinzu (motn-*, Erstausgaben): gezählt wird, was in der Datei steht. */
  meta.releaseCount = releases.length
  meta.eventCount = events.length
  meta.belegtCount = zaehleBelegte(readJson<Pick<Title, 'dubConfidence'>[]>(`${OUT}/titles.json`, []))
  writeJson(`${OUT}/meta.json`, meta, true)
  bruecheBeiWiderspruchAb({ fehler: zaehlworteAusDateien(), warnungen: [] })
  return { newsFuerRss }
}

/** Die Zählworte der Oberfläche müssen zur Länge der ausgelieferten Dateien passen (B-07). */
function zaehlworteAusDateien(): string[] {
  const laenge = (datei: string) => readJson<unknown[]>(`${OUT}/${datei}`, []).length
  return zaehlworteStimmen(readJson(`${OUT}/meta.json`, { titleCount: -1, releaseCount: -1, eventCount: -1 }), {
    titles: laenge('titles.json'),
    belegt: zaehleBelegte(readJson<Pick<Title, 'dubConfidence'>[]>(`${OUT}/titles.json`, [])),
    releases: laenge('releases.json'),
    events: laenge('events.json'),
  })
}

/** Ein Widerspruch im erzeugten Ergebnis bricht den Bau ab — lieber keine frischen Daten als falsche. */
function bruecheBeiWiderspruchAb({ fehler, warnungen }: { fehler: string[]; warnungen: string[] }): void {
  for (const w of warnungen) log(`  ⚠ ${w}`)
  if (!fehler.length) return
  for (const f of fehler) console.error('  ✖', f)
  console.error(`\n${fehler.length} Widerspruch/Widersprüche im ausgelieferten Ergebnis — Bau abgebrochen.`)
  process.exit(1)
}

/** Adressen der Anime2You-Meldungen, die nur Originalton nennen — der Grund, wenn eine Ankündigung daraus zurückgezogen wird. */
function nurOriginaltonAdressen(): Set<string> {
  const vorschlaege = readJson<{ proposals?: Vorschlag[] }>('data/proposals/anime2you.json', {}).proposals ?? []
  return new Set(nurOriginaltonMeldungen(vorschlaege).map((v) => v.articleUrl))
}

/** Automatische Termine gegen ihre Meldungen (Einzel- und Sammelartikel): Sprachzusage oder Kennzeichnung, kein Wochentakt als „alle Folgen". */
function autoReleaseFehler(releases: Release[]): string[] {
  const roh = readJson<{ proposals?: Vorschlag[] }>('data/proposals/anime2you.json', {}).proposals ?? []
  return autoReleaseWidersprueche(releases, [...roh, ...vorschlaegeAusAllenSammelartikeln(roh)])
}
