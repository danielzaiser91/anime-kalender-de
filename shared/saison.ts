import type { PlatformId, Release, StreamLink, Title } from './types.ts'

/** Die vier Anime-Saisons Japans; `jpSeason` am Titel nutzt dieselben Namen wie AniList. */
export type Saison = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
export interface SaisonTag {
  jahr: number
  saison: Saison
}

const FOLGE: Saison[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
export const SAISON_NAME: Record<Saison, string> = { WINTER: 'Winter', SPRING: 'Frühling', SUMMER: 'Sommer', FALL: 'Herbst' }

/** Die Saison eines Datums (`JJJJ-MM-TT`): Januar bis März Winter, April bis Juni Frühling, Juli bis September Sommer, Rest Herbst. */
export function saisonVon(datum: string): SaisonTag {
  const monat = Number(datum.slice(5, 7))
  return { jahr: Number(datum.slice(0, 4)), saison: FOLGE[Math.min(3, Math.floor((monat - 1) / 3))]! }
}

/** Die Saison davor (`-1`) oder danach (`+1`). */
export function versetzt(s: SaisonTag, schritt: -1 | 1): SaisonTag {
  const nr = FOLGE.indexOf(s.saison) + schritt
  return nr < 0 ? { jahr: s.jahr - 1, saison: 'FALL' } : nr > 3 ? { jahr: s.jahr + 1, saison: 'WINTER' } : { jahr: s.jahr, saison: FOLGE[nr]! }
}

export const saisonText = (s: SaisonTag): string => `${SAISON_NAME[s.saison]} ${s.jahr}`

/** Erster und letzter Tag der Saison als `JJJJ-MM-TT`. */
export function saisonZeitraum(s: SaisonTag): [string, string] {
  const von = FOLGE.indexOf(s.saison) * 3 + 1
  const tag = (m: number) => String(m).padStart(2, '0')
  return [`${s.jahr}-${tag(von)}-01`, `${s.jahr}-${tag(von + 2)}-31`]
}

/** Fernseh- und Web-Serien — Filme, OVAs und Specials gehören nicht in den Saison-Überblick. */
export const istSerie = (format: string | undefined): boolean => format === 'TV' || format === 'ONA'

/** Der erste Termin je Titel und ob er geschätzt ist. */
export function ersterTermin(releases: Release[] | undefined): { datum: string; geschaetzt: boolean } | undefined {
  const liste = (releases ?? []).flatMap((r) => (r.schedule?.firstEpisodeDate ? [{ datum: r.schedule.firstEpisodeDate, geschaetzt: Boolean(r.schedule.estimated) }] : []))
  return liste.sort((a, b) => a.datum.localeCompare(b.datum))[0]
}

/** Deutsch belegt: Weg mit Tonspur-Beleg, Erstausgabe mit Synchro oder Sprecherliste. Ein nur abgeleiteter Weg (`dubAbgeleitet`: Joyn pauschal, Prime-Kanal erbt) zählt nicht, das Detail nennt ihn „Deutsch laut Anbieter“. */
export const hatDeutsch = (t: Pick<Title, 'streams' | 'deErstausgabe' | 'hasVoices'>): boolean =>
  Boolean((t.streams ?? []).some((s) => s.dub === true && !s.dubAbgeleitet) || t.deErstausgabe?.synchro || t.hasVoices)

/**
 * Wo die Synchro läuft — oder, wo sie nur angekündigt ist, der Anbieter der Ankündigung (nicht der des Untertitel-Starts allein).
 * Ein sicherer Termin im Kalender nennt seinen Anbieter auch dort, wo der Titel noch keinen Weg trägt (Tokyo Revengers, Tank Chair; Daniel, 11.10.2026).
 */
export function anbieterVon(t: Pick<Title, 'streams' | 'ankuendigung'>, releases?: Release[]): PlatformId[] {
  const angekuendigt = t.ankuendigung?.synchro === 'angekuendigt' ? [t.ankuendigung.platform] : []
  const ausTermin = (releases ?? []).filter((r) => !r.schedule?.estimated).map((r) => r.platform)
  return [...new Set([...(t.streams ?? []).filter((s) => s.dub === true).map((s) => s.platform), ...angekuendigt, ...ausTermin])]
}

/** Ein Tonspur-Weg, dessen Deutsch nur abgeleitet ist (Joyn pauschal, Prime-Kanal erbt): „Deutsch laut Anbieter“. Pille und Chip fragen hier. Ein Termin belegt die Tonspur nicht; nennt ein Artikel die Sprache, wird er als Handbeleg geführt (`data/dub-confirmed.yaml`), und der Weg trägt kein `dubAbgeleitet` mehr. */
export const istLautAnbieter = (s: Pick<StreamLink, 'dub' | 'dubAbgeleitet'>): boolean => s.dub === true && Boolean(s.dubAbgeleitet)

/** Ein Anbieter-Chip; `laut` = Deutsch nur aus abgeleitetem Weg: mindestens ein Tonspur-Weg dieses Anbieters, alle `dubAbgeleitet` (dieselbe Frage wie die Pille am Weg; Termine und Ankündigungen belegen die Tonspur nicht). */
export type AnbieterChip = { platform: PlatformId; laut: boolean }

export function anbieterChips(t: Pick<Title, 'streams' | 'ankuendigung'>, releases?: Release[]): AnbieterChip[] {
  const dub = (t.streams ?? []).filter((s) => s.dub === true)
  return anbieterVon(t, releases).map((platform) => {
    const wege = dub.filter((s) => s.platform === platform)
    return { platform, laut: wege.length > 0 && wege.every(istLautAnbieter) }
  })
}
