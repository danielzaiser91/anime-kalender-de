import { type Release, type Title } from '../../shared/types.ts'
import { log } from '../lib/util.ts'

/** Anbieter, die den Titel schon vor dem Datum dieses Katalogtermins führten (Disc zählt nicht, das ist ein anderer Weg). */
function fruehererAnbieter(release: Release, geschwister: Release[]): boolean {
  const tag = release.schedule.firstEpisodeDate
  return geschwister.some((o) => o.slug !== release.slug && o.platform !== 'disc' && !o.widerlegt && o.schedule.firstEpisodeDate < tag)
}

/**
 * Ist dieses Katalogdatum (`available-from`) zugleich der erste Tag der deutschen Fassung? Das heißt es, wenn aniSearch die belegte
 * Synchro-Erstausgabe genau auf diesen Tag legt und kein anderer Anbieter des Titels früher einen Termin hat (F9, Daniel 14.10.2026:
 * „Erstveröffentlichung“ nur, wenn kein Anbieter vorher die deutsche Fassung hatte; sonst „Neu bei X“).
 */
export function istErstausgabe(release: Release, title: Title | undefined, geschwister: Release[]): boolean {
  if (release.dateMeaning !== 'available-from' || release.platform === 'disc' || release.platform === 'tv') return false
  const erst = title?.deErstausgabe
  if (!erst?.synchro || erst.von !== release.schedule.firstEpisodeDate) return false
  return !fruehererAnbieter(release, geschwister)
}

/** Setzt `erstausgabe` an die Katalog-Releases unter `pruefen`, die den ersten Tag der deutschen Fassung tragen; liefert deren Zahl. */
export function markiereErstausgabe({ alle, pruefen, titles }: { alle: Release[]; pruefen: Release[]; titles: Map<number, Title> }): number {
  const jeTitel = new Map<number, Release[]>()
  for (const r of alle) jeTitel.set(r.titleId, [...(jeTitel.get(r.titleId) ?? []), r])
  let anzahl = 0
  for (const r of pruefen) {
    if (r.erstausgabe || !istErstausgabe(r, titles.get(r.titleId), jeTitel.get(r.titleId) ?? [])) continue
    r.erstausgabe = true
    anzahl++
  }
  if (anzahl) log(`${anzahl} Katalogtermine sind laut aniSearch die deutsche Erstveröffentlichung („Erstveröffentlichung“ statt „Neu bei“)`)
  return anzahl
}
