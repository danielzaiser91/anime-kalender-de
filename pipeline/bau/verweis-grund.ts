import { type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

/** Grund eines entfernten Verweises mit belegtem Nein; der Anfang „belegtes Nein“ ist der Schlüssel des Gedächtnisses (`NUR_DIESER_TITEL`, `GRUND_KEIN_TON`). */
export const GRUND_KEIN_TON = 'belegtes Nein: dort gibt es keine deutsche Tonspur'

/** Entfernt die Verweise mit belegtem Nein (`dub: false`) vom Titel, trägt sie ins Gedächtnis ein und nennt ihre Zahl. */
export function entferneVerweiseMitNein(title: Title, verweiseEntfernt: EntfernterVerweis[]): number {
  const raus = title.streams.filter((s) => s.dub === false)
  if (!raus.length) return 0
  title.streams = title.streams.filter((s) => s.dub !== false)
  for (const s of raus) {
    verweiseEntfernt.push({
      titleId: title.id,
      titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
      plattform: s.platform,
      url: s.url,
      seriesId: null,
      grund: GRUND_KEIN_TON,
      geprueftAm: null,
      entferntAm: todayIso(),
      letzterWeg: title.streams.length === 0,
    })
  }
  return raus.length
}
