/**
 * **Ein volles Häkchen bei Prime braucht einen Beleg** (11.10.2026): Handbeleg, Messurteil oder
 * Anbieter-Auskunft. JustWatch allein ist keiner — der Weg trägt dann höchstens den Umriss
 * „Deutsch laut JustWatch" (`jw-vertrauen.ts`), `dub` bleibt offen.
 */
import type { Title } from '../../shared/types.ts'
import type { DubCheck } from './dub-confirmed.ts'

export interface UrteilEintrag {
  urteil?: string
}

export interface MeldungEintrag {
  titleId: number
  plattform: string
  folgen: { sprachen: string[] }[]
}

/** Titel, deren Prime-Weg einen eigenen Beleg für „deutsch" hat: Handbeleg, gemessenes Urteil oder Daniels Meldung aus der angemeldeten Sitzung. */
export function primeTitelMitBeleg(
  alleChecks: DubCheck[],
  urteile: Record<string, UrteilEintrag>,
  meldungen: Record<string, MeldungEintrag>,
): Set<number> {
  const mitBeleg = new Set<number>()
  for (const m of Object.values(meldungen)) {
    if (m.plattform === 'primevideo' && m.folgen.some((f) => f.sprachen.includes('Deutsch'))) mitBeleg.add(m.titleId)
  }
  for (const c of alleChecks) {
    const deutsch = c.dub === true || (c.dubRanges ?? []).some((r) => r.dub)
    if (c.platform === 'primevideo' && deutsch) mitBeleg.add(c.anilistId)
  }
  for (const [schluessel, u] of Object.entries(urteile)) {
    const [id, plattform] = schluessel.split('|')
    if (plattform === 'primevideo' && u.urteil === 'deutsch') mitBeleg.add(Number(id))
  }
  return mitBeleg
}

/** Meldungen zu Prime-Wegen mit vollem Häkchen (`dub: true`), die weder Handbeleg noch Messurteil tragen. */
export function primeHakenOhneBeleg(titles: Iterable<Title>, mitBeleg: Set<number>): string[] {
  const fehler: string[] = []
  for (const t of titles) {
    if (mitBeleg.has(t.id)) continue
    for (const s of t.streams ?? []) {
      if (s.platform === 'primevideo' && s.dub === true) {
        fehler.push(`Anime ${t.id} (${t.titleRomaji ?? '?'}): Prime-Weg ${s.url} trägt „deutsch" ohne Handbeleg und ohne Messurteil`)
      }
    }
  }
  return fehler
}
