import type { PlatformId, Release, Title } from '../../shared/types.ts'
import { anbieterVon, ersterTermin, hatDeutsch } from '../../shared/saison.ts'
import { mitAnkuendigung } from './grundlagen.ts'

/** Die deutsche Fassung eines Katalogtitels der Saison-Datei; leer, wo wir keine belegen. */
export interface DeutschAngabe {
  deutsch?: true
  /** Früheste belegte deutsche Folge (`JJJJ-MM-TT`), wo ein sicherer Termin oder ein ganzer Tag der Erstausgabe vorliegt. */
  deVon?: string
  anbieter?: PlatformId[]
}

const ganzerTag = (tag: string | undefined): string | undefined => (tag && /^\d{4}-\d{2}-\d{2}$/.test(tag) && !tag.includes('-00') ? tag : undefined)

/**
 * Hat der Titel einen belegten deutschen Weg (Tonspur-Beleg, Erstausgabe mit Synchro), steht das in der Saison-Datei:
 * die Seite hält die Titel außerhalb des Kerns sonst für „noch offen“ (Chainsmoker Cat, Sparks of Tomorrow; Daniel, 11.10.2026).
 * Ein geschätzter Termin (Simulcast-Tag) ist kein deutscher Tag und zählt nicht.
 */
export function deutscheAngabe(t: Title, releases: Release[] | undefined): DeutschAngabe {
  if (!hatDeutsch(t)) return {}
  const deVon = ersterTermin((releases ?? []).filter((r) => !r.schedule?.estimated))?.datum ?? ganzerTag(t.deErstausgabe?.von)
  const anbieter = anbieterVon(t)
  return {
    deutsch: true,
    ...(deVon ? { deVon } : {}),
    ...(anbieter.length > 0 ? { anbieter } : {}),
  }
}

export const releasesNachTitel = (releases: Release[]): Map<number, Release[]> => {
  const karte = new Map<number, Release[]>()
  for (const r of releases) {
    const liste = karte.get(r.titleId) ?? []
    liste.push(r)
    karte.set(r.titleId, liste)
  }
  return karte
}

/** Ein Titel des Hauptbestands außerhalb des Kerns als Eintrag der Saison-Datei. */
export function katalogAusBestand(t: Title, releases: Release[] | undefined) {
  return {
    id: t.id,
    titleRomaji: t.titleRomaji,
    titleEn: t.titleEn,
    titleDe: t.titleDe,
    coverImage: t.coverImage,
    episodes: t.episodes,
    jpStart: t.jpStartTag!,
    jpSeason: t.jpSeason,
    jpYear: t.jpYear,
    ...(mitAnkuendigung(t).ankuendigung?.synchro === 'angekuendigt' ? { angekuendigt: true } : {}),
    ...deutscheAngabe(t, releases),
  }
}
