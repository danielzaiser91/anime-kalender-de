import { DIENSTE, type MotnDaten } from '../lib/motn.ts'
import { STICHTAG_AB, stichtagSchluessel } from './angebot-stichtag.ts'

type Meldung = { art?: 'new' | 'removed'; imdbId?: string; dienst?: string; am?: string; deutsch?: boolean; deutschBeiDienst?: boolean }
// `deutsch` zählt jeden Dienst in DE und ist kein Beleg für diesen Anbieter; maßgeblich ist deutschBeiDienst.
export type MotnChanges = { gesehen?: Record<string, Meldung> }

/** Anbietertage (`stichtagSchluessel`), an denen der Feed mindestens `STICHTAG_AB` „new"-Meldungen mit deutschem Ton beim Dienst führt. */
export function feedWellen(meldungen: Meldung[]): Set<string> {
  const jeTag = new Map<string, number>()
  for (const m of meldungen) {
    const anbieter = DIENSTE[m.dienst ?? '']
    if (m.art !== 'new' || m.deutschBeiDienst !== true || !anbieter || !m.am) continue
    const schluessel = stichtagSchluessel(anbieter, m.am)
    jeTag.set(schluessel, (jeTag.get(schluessel) ?? 0) + 1)
  }
  return new Set([...jeTag].filter(([, n]) => n >= STICHTAG_AB).map(([schluessel]) => schluessel))
}

/**
 * Tagesfeed `data/motn-changes.json` in den Monatsbestand einrechnen: Eine
 * „new"-Meldung mit deutscher Tonspur setzt `seit` für den Anbieter, wenn
 * `motn.json` die Serie schon kennt und dort für den Anbieter noch kein `seit`
 * steht. Ein belegtes `seit` bleibt, eine spätere „removed"-Meldung des
 * Anbieters sperrt, ohne API-Anfrage. Ein Feed-Tag mit mindestens `STICHTAG_AB`
 * solcher Meldungen eines Anbieters ist ein Erfassungsstichtag (Prime 26.09.2026: 14)
 * und setzt kein `seit`. Gibt eine Kopie zurück.
 */
export function mitFeedSeit(motn: MotnDaten, changes: MotnChanges): MotnDaten {
  const meldungen = Object.values(changes.gesehen ?? {})
  const entfernt = (m: Meldung): boolean =>
    meldungen.some((x) => x.art === 'removed' && x.imdbId === m.imdbId && x.dienst === m.dienst && (x.am ?? '') >= (m.am ?? ''))
  const wellen = feedWellen(meldungen)
  const shows = { ...motn.shows }
  for (const m of meldungen) {
    const anbieter = DIENSTE[m.dienst ?? '']
    const eintrag = m.imdbId ? Object.entries(shows).find(([k, s]) => (s.imdbId ?? k) === m.imdbId) : undefined
    const show = eintrag?.[1]
    if (m.art !== 'new' || m.deutschBeiDienst !== true || !anbieter || !m.am || !show) continue
    if (show.dienste?.[anbieter]?.seit || entfernt(m) || wellen.has(stichtagSchluessel(anbieter, m.am))) continue
    const alt = show.dienste?.[anbieter]
    const dienste = { ...show.dienste, [anbieter]: { gelistet: [], deutsch: [], ...alt, seit: m.am } }
    shows[eintrag![0]] = { ...show, dienste }
  }
  return { ...motn, shows }
}

type Option = { service?: { id?: string }; audios?: { language?: string }[] }

/** Deutscher Ton in DE überhaupt (`deutsch`) und bei genau diesem Dienst (`deutschBeiDienst`, ohne Dienstkennung nie wahr). */
export function tonspuren(optionen: Option[], dienst: string | undefined): { deutsch: boolean; deutschBeiDienst: boolean } {
  const deu = (o: Option): boolean => (o.audios ?? []).some((a) => a.language === 'deu')
  return { deutsch: optionen.some(deu), deutschBeiDienst: !!dienst && optionen.some((o) => o.service?.id === dienst && deu(o)) }
}

type FeedShow = { title?: string; originalTitle?: string; imdbId?: string; tmdbId?: string }
type FeedAenderung = { timestamp?: number; service?: { id?: string } }
type FeedEintrag = Meldung & { titel?: string; originalTitel?: string; tmdbId?: string }

/** Eintrag für `data/motn-changes.json` aus einer Änderung der Quelle; der Ton kommt aus den Optionen des Dienstes der Änderung. */
export function feedEintrag(art: 'new' | 'removed', show: FeedShow, c: FeedAenderung, optionen: Option[]): FeedEintrag {
  return {
    art,
    titel: show.title,
    originalTitel: show.originalTitle,
    imdbId: show.imdbId,
    tmdbId: show.tmdbId,
    dienst: c.service?.id,
    am: c.timestamp ? new Date(c.timestamp * 1000).toISOString().slice(0, 10) : undefined,
    ...tonspuren(optionen, c.service?.id),
  }
}
