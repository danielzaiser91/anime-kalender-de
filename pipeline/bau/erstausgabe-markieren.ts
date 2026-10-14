import { type Release, type Title } from '../../shared/types.ts'
import { log } from '../lib/util.ts'
import { wegVerneint } from '../lib/dub-confirmed.ts'
import { istNahAmJapanStart } from '../lib/nah-am-japan-start.ts'

/** Anbieter, Sender oder Disc, die den Titel schon vor dem Termin führten (eine frühere Disc zählt: „kein Anbieter vorher deutsch“). */
function fruehererAnbieter(release: Release, geschwister: Release[]): boolean {
  const tag = release.schedule.firstEpisodeDate
  return geschwister.some((o) => !o.widerlegt &&o.schedule.firstEpisodeDate < tag)
}

/** Der Tag, ISO oder fehlend, als UTC-Millisekunden. */
const tagMs = (iso: string | undefined): number | undefined => (iso ? Date.parse(iso) : undefined)

/**
 * Trägt ein Beleg, dass die Synchro an diesem Tag begann? `deErstausgabe.synchro` allein tut es nicht, es ist nur das „dubbed“-Kennzeichen der
 * deutschen aniSearch-Zeile: 13 von 17 Terminen lagen 0–1 Tage nach dem japanischen Start, dem Tag des OmU-Simulcasts. Ein Beleg ist
 * (a) ein Termin mehr als 30 Tage nach Japan (`istNahAmJapanStart`; fehlt der japanische Starttag, ist es kein Beleg),
 * (b) ein Handbeleg „Premiere“ am Release (`Release.premiere`, Weg Streaming, ohne frühere Ausgabe) oder (c) eine Netflix-Eigenproduktion.
 */
function synchroAnDiesemTagBelegt(release: Release, title: Title): boolean {
  const jpTag = tagMs(title.jpStartTag)
  const spaeterAlsJapan = jpTag !== undefined && !istNahAmJapanStart(tagMs(release.schedule.firstEpisodeDate), jpTag, title.format)
  const handbeleg = release.premiere?.weg === 'stream' && !release.premiere.vorher
  return spaeterAlsJapan || handbeleg || (release.platform === 'netflix' && release.netflixOriginal === true)
}

/**
 * Ist dieses Katalogdatum (`available-from`) zugleich der erste Tag der deutschen Fassung? Das heißt es, wenn aniSearch die Synchro-Erstausgabe genau
 * auf diesen Tag legt, kein Anbieter und keine Disc des Titels früher liegt, kein Handbeleg „nur Untertitel“ (`dub: false`) dem Anbieter widerspricht
 * und die Synchro an diesem Tag belegt ist (F9, Daniel 14.10.2026; Prüfer-Befund Bleach „The Calamity“, Disney+ 25.07.2026: Handbeleg „nur mit Untertiteln“).
 * `handNein`: die Schlüssel aus `neinHandbelege`.
 */
export function istErstausgabe(release: Release, title: Title | undefined, geschwister: Release[], handNein: ReadonlySet<string>): boolean {
  if (release.dateMeaning !== 'available-from' || release.platform === 'disc' || release.platform === 'tv') return false
  const erst = title?.deErstausgabe
  if (!title || !erst?.synchro || erst.von !== release.schedule.firstEpisodeDate) return false
  if (wegVerneint(handNein, release.titleId, release.platform, release.platformUrl)) return false
  return !fruehererAnbieter(release, geschwister) && synchroAnDiesemTagBelegt(release, title)
}

/** Setzt `erstausgabe` an die Katalog-Releases unter `pruefen`, die den ersten Tag der deutschen Fassung tragen; liefert deren Zahl. */
export function markiereErstausgabe({ alle, pruefen, titles, handNein }: { alle: Release[]; pruefen: Release[]; titles: Map<number, Title>; handNein: ReadonlySet<string> }): number {
  const jeTitel = new Map<number, Release[]>()
  for (const r of alle) jeTitel.set(r.titleId, [...(jeTitel.get(r.titleId) ?? []), r])
  let anzahl = 0
  for (const r of pruefen) {
    if (r.erstausgabe || !istErstausgabe(r, titles.get(r.titleId), jeTitel.get(r.titleId) ?? [], handNein)) continue
    r.erstausgabe = true
    anzahl++
  }
  if (anzahl) log(`${anzahl} Katalogtermine sind laut aniSearch die deutsche Erstveröffentlichung („Erstveröffentlichung“ statt „Neu bei“)`)
  return anzahl
}

/** Die Releases mit `erstausgabe`, obwohl ein Nein-Handbeleg ihren Anbieter verneint — das darf nie vorkommen (`check:handbelege`). */
export function erstausgabeTrotzNein(releases: Release[], handNein: ReadonlySet<string>): string[] {
  return releases.filter((r) => r.erstausgabe && wegVerneint(handNein, r.titleId, r.platform, r.platformUrl)).map((r) => r.slug)
}
