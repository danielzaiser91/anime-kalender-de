import type { PlatformId, Release, Title } from '../../shared/types.ts'
import { anbieterVon, ersterTermin, hatDeutsch } from '../../shared/saison.ts'
import { mitAnkuendigung } from './grundlagen.ts'

/** Die deutsche Fassung eines Katalogtitels der Saison-Datei; leer, wo wir keine belegen. */
export interface DeutschAngabe {
  deutsch?: true
  /** Tag der frühesten belegten deutschen Folge (`JJJJ-MM-TT`); fehlt, wo keine Folge belegt ist (dann ist Deutsch bestätigt, aber nicht „erschienen“). */
  deVon?: string
  anbieter?: PlatformId[]
}

const ganzerTag = (tag: string | undefined): string | undefined => (tag && /^\d{4}-\d{2}-\d{2}$/.test(tag) && !tag.includes('-00') ? tag : undefined)

/** Tonspur-Beleg mit belegter Folge auf einem nicht abgeleiteten Weg (Maßstab von `check-saison-deutsch-bestand.ts`). */
export const tonspurBeleg = (t: Title | undefined): boolean =>
  (t?.streams ?? []).some((s) => s.dub === true && !s.dubAbgeleitet && (s.dubRanges?.length ?? 0) > 0)

/** Der Tag, an dem eine belegte deutsche Folge auf dem Weg mit Tonbeleg erschien: Folge 1 am ersten sicheren Termin der Plattform, sonst der beobachtete Tag der Folge. */
function tagDerBelegtenFolge(t: Title, releases: Release[]): string | undefined {
  const tage: string[] = []
  for (const s of (t.streams ?? []).filter((x) => x.dub === true && !x.dubAbgeleitet)) {
    const termine = releases.filter((r) => r.platform === s.platform && !r.schedule?.estimated)
    for (const bereich of (s.dubRanges ?? []).filter((b) => b.dub)) {
      const tag = bereich.from === 1 ? ersterTermin(termine)?.datum : termine.map((r) => r.schedule?.observed?.[bereich.from]).find(Boolean)
      if (tag) tage.push(tag)
    }
  }
  return tage.sort()[0]
}

/**
 * Hat der Titel einen belegten deutschen Weg (Tonspur-Beleg, Erstausgabe mit Synchro), steht das in der Saison-Datei:
 * die Seite hält die Titel außerhalb des Kerns sonst für „noch offen“ (Chainsmoker Cat, Sparks of Tomorrow; Daniel, 11.10.2026).
 * `deVon` nennt nur einen Tag, der die deutsche Fassung betrifft (Erstausgabe mit Synchro oder belegte Folge auf dem Weg mit Tonbeleg),
 * nie den Start mit Untertiteln auf einem anderen Weg; ohne ihn bleibt es bei „Deutsch bestätigt“ (Edgerunners 2, Fool Night: `dub` ohne Folge).
 */
export function deutscheAngabe(t: Title, releases: Release[] | undefined): DeutschAngabe {
  if (!hatDeutsch(t)) return {}
  const erstausgabe = t.deErstausgabe?.synchro ? ganzerTag(t.deErstausgabe.von) : undefined
  const deVon = [erstausgabe, tagDerBelegtenFolge(t, releases ?? [])].filter(Boolean).sort()[0]
  const anbieter = anbieterVon(t, releases)
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
