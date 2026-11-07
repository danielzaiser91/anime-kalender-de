/**
 * **Beobachtungsliste: angekündigter Start bei einem Anbieter, aber noch kein Synchro-Beleg** (Devils' Crest, 07.11.2026).
 * Reine Regel; das Skript `pipeline/synchro-beobachtung.ts` liest den Bestand und schreibt `data/proposals/synchro-beobachtung.json`
 * (kein Eingang des Baus, nur Blick auf das, was bald belegt sein müsste).
 *
 * Zweite Quelle: Titel aus `ohne-synchro.json` mit `jpStart` (voller Tag) im selben Fenster, Anbieter „unbekannt“, gleiche Entnahme.
 * Aufnahme: Release mit Start in −7…+30 Tagen, Titel ohne Stream `dub: true`, ohne Synchro-Beleg (aniSearch `d`/`c`, Handbeleg).
 * Der Beleg ist derselbe wie im Widerspruchswächter (`synchroBeleg`). Entnahme: sobald ein Beleg da ist oder der Start mehr als 14 Tage zurückliegt.
 * Einträge sind je Titel und Anbieter einmalig; `seit` ist der Tag der ersten Aufnahme und bleibt erhalten.
 */
import type { Release, Title } from '../../shared/types.ts'
import { addDays } from '../../shared/time.ts'
import { anzeigeName } from '../../shared/titles.ts'
import { synchroBeleg, type SynchroBelege } from './synchro-widerspruch.ts'

export interface BeobachtungsEintrag {
  titel: string
  id: number
  anbieter: string
  start: string
  seit: string
}

/** Fenster der Neuaufnahme (Tage um den Start) und Frist bis zur Entnahme eines Eintrags nach dem Start. */
const VOR = 7
const NACH = 30
const FRIST_NACH_START = 14

/** Anbieter der zweiten Quelle: Titel hinter dem Toggle „ohne Synchro“ haben keinen Release (Devils' Crest stand dort, ohne dass ihn die Liste sah). */
const UNBEKANNT = 'unbekannt'

/** Titel aus `ohne-synchro.json` als Start-Einträge; nur volle Tage zählen (bei „2026-12“ ist der Start unbekannt, kein erfundener Tag). */
export function ohneSynchroStarts(ohneSynchro: Title[]): Release[] {
  return ohneSynchro
    .filter((t) => t.jpStart?.length === 10)
    .map((t) => ({ slug: `ohne-synchro-${t.id}`, titleId: t.id, platform: UNBEKANNT, schedule: { firstEpisodeDate: t.jpStart } }) as unknown as Release)
}

const schluessel = (id: number, anbieter: string): string => `${id}|${anbieter}`
const anbieterVon = (r: Release): string => (r.platform === 'tv' && r.sender ? `tv: ${r.sender}` : r.platform)

export function beobachtungsListe(
  titel: Title[],
  releases: Release[],
  alt: BeobachtungsEintrag[],
  heute: string,
  belege: SynchroBelege,
): BeobachtungsEintrag[] {
  const nachId = new Map(titel.map((t) => [t.id, t]))
  const seitAlt = new Map(alt.map((e) => [schluessel(e.id, e.anbieter), e.seit]))
  const neuAb = addDays(heute, -VOR)
  const altAb = addDays(heute, -FRIST_NACH_START)
  const bis = addDays(heute, NACH)
  const je = new Map<string, BeobachtungsEintrag>()
  for (const r of releases) {
    const start = r.schedule?.firstEpisodeDate
    const t = nachId.get(r.titleId)
    if (!start || !t || start > bis) continue
    const anbieter = anbieterVon(r)
    const seit = seitAlt.get(schluessel(t.id, anbieter))
    if (start < (seit ? altAb : neuAb)) continue
    if (t.streams?.some((s) => s.dub === true) || synchroBeleg(t, belege)) continue
    const k = schluessel(t.id, anbieter)
    const da = je.get(k)
    if (da && da.start <= start) continue
    je.set(k, { titel: anzeigeName(t), id: t.id, anbieter, start, seit: seit ?? heute })
  }
  return [...je.values()].sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id || a.anbieter.localeCompare(b.anbieter))
}
