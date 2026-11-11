import { type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { dubKey, urteilVon, type DubCheck } from '../lib/dub-confirmed.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

/** Grund eines entfernten Verweises mit belegtem Nein; der Anfang „belegtes Nein“ ist der Schlüssel des Gedächtnisses (`NUR_DIESER_TITEL`, `GRUND_KEIN_TON`). */
export const GRUND_KEIN_TON = 'belegtes Nein: dort gibt es keine deutsche Tonspur'
export const GRUND_REGION = 'belegtes Nein: laut Seite in dieser Region nicht mehr im Angebot (keine Aussage zur Tonspur)'

/** Schlüssel (`dubKey`) der Wege, deren jüngstes Urteil ein Nein mit gemessener Regionssperre der Seite ist (`regionsperre=` in der Notiz). */
export function regionGesperrteWege(checks: DubCheck[]): Set<string> {
  return new Set(
    checks.filter((c) => urteilVon(c) === 'nein' && (c.note ?? '').includes('regionsperre=')).map((c) => dubKey(c.anilistId, c.platform)),
  )
}

/** Entfernt die Verweise mit belegtem Nein (`dub: false`) vom Titel, trägt sie ins Gedächtnis ein und nennt ihre Zahl; eine Regionssperre heißt nicht „keine deutsche Tonspur“. */
export function entferneVerweiseMitNein(title: Title, verweiseEntfernt: EntfernterVerweis[], regionGesperrt: ReadonlySet<string>): number {
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
      grund: regionGesperrt.has(dubKey(title.id, s.platform)) ? GRUND_REGION : GRUND_KEIN_TON,
      geprueftAm: null,
      entferntAm: todayIso(),
      letzterWeg: title.streams.length === 0,
    })
  }
  return raus.length
}
