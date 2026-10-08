/**
 * Regeln über Termine und Sendepläne: der Datensatz gegen sich selbst.
 * Jede Funktion ist eine Regel; die Kennungen D-xx stehen in `docs/wissen/daten-detektiv.md`.
 */
import type { Release, ReleaseEvent } from '../../shared/types.ts'
import { releaseStatus } from '../../shared/logic.ts'
import { addDays } from '../../shared/time.ts'
import type { Bestand } from './laden.ts'
import { titelName } from './laden.ts'
import { regel, type Regel, type Treffer } from './regel.ts'

const TAGE_OHNE_LEBENSZEICHEN = 60

function eventsJeRelease(events: ReleaseEvent[]): Map<string, ReleaseEvent[]> {
  const m = new Map<string, ReleaseEvent[]>()
  for (const e of events) (m.get(e.releaseSlug) ?? m.set(e.releaseSlug, []).get(e.releaseSlug)!).push(e)
  return m
}

/** D-01: Eine spätere Folge liegt vor einer früheren (B-05, Lycoris Recoil). */
export function datumMonoton(b: Bestand): Regel {
  const treffer: Treffer[] = []
  const je = eventsJeRelease(b.events)
  for (const r of b.releases) {
    /* Eine TV-Sichtung zeigt Wiederholungen in beliebiger Reihenfolge — dort ist Folge 5 nach Folge 78 kein Widerspruch. */
    if (r.releaseType === 'disc' || r.tvLetzteSichtung) continue
    const s = (je.get(r.slug) ?? []).filter((e) => e.episode != null).sort((a, c) => a.episode! - c.episode! || a.date.localeCompare(c.date))
    for (let i = 1; i < s.length; i++) {
      if (s[i].episode !== s[i - 1].episode && s[i].date < s[i - 1].date) {
        const quelle = r.schedule.observed?.[s[i - 1].episode!] ? 'beobachtet' : 'gerechnet'
        treffer.push({ schluessel: r.slug, text: `${r.name}: Folge ${s[i - 1].episode} am ${s[i - 1].date} (${quelle}), Folge ${s[i].episode} am ${s[i].date}`, ort: `/r/${r.slug}/` })
        break
      }
    }
  }
  return regel('D-01', 'Datum steigt nicht mit der Folgennummer', 'Kalender zeigt eine spätere Folge vor einer früheren', je.size, treffer)
}

/** D-04: Ein fortgeschriebener Termin ist verstrichen, der Anbieter-Kalender wird gelesen, aber die Folge wurde nie gesehen. */
export function vergangenOhneBeobachtung(b: Bestand): Regel {
  const treffer: Treffer[] = []
  const je = eventsJeRelease(b.events)
  let geprueft = 0
  for (const r of b.releases) {
    const obs = r.schedule.observed ?? {}
    if (!Object.keys(obs).length || r.releaseType !== 'weekly') continue
    const letzteBeobachtung = Object.values(obs).sort().at(-1) ?? ''
    const offen = (je.get(r.slug) ?? []).filter((e) => e.estimated && e.date < b.heute && e.date < letzteBeobachtung && !e.verpasst && e.episode != null && !obs[e.episode])
    geprueft++
    if (offen.length) treffer.push({ schluessel: r.slug, text: `${r.name}: ${offen.length} vergangene Termine ohne Beobachtung (Folge ${offen.map((e) => e.episode).join(', ')}), obwohl Folge ${Object.keys(obs).sort((x, y) => Number(x) - Number(y)).at(-1)} am ${letzteBeobachtung} gesehen wurde`, ort: `/r/${r.slug}/` })
  }
  return regel('D-04', 'Vergangener Termin ohne gesehene Folge', 'Panel zählt eine Folge als erschienen, die kein Abruf je gesehen hat', geprueft, treffer)
}

/** D-09: Beobachtete Folgen ohne Wochentakt — Abstand weder 0 noch 7 Tage, ohne Sendetage. */
export function wochentaktAbweichung(b: Bestand): Regel {
  const treffer: Treffer[] = []
  let geprueft = 0
  for (const r of b.releases) {
    const s = r.schedule
    if (r.releaseType !== 'weekly' || s.wochentage?.length || r.platform === 'tv') continue
    const obs = Object.entries(s.observed ?? {}).map(([n, d]) => ({ n: Number(n), d })).filter((x) => x.d).sort((x, y) => x.n - y.n)
    if (obs.length < 2) continue
    geprueft++
    const abweichungen: string[] = []
    for (let i = 1; i < obs.length; i++) {
      if (obs[i].n !== obs[i - 1].n + 1) continue
      const tage = Math.round((Date.parse(obs[i].d) - Date.parse(obs[i - 1].d)) / 86400000)
      if (tage !== 0 && tage !== 7 && !(s.skipDates?.length && tage % 7 === 0)) abweichungen.push(`${obs[i - 1].n}→${obs[i].n}: ${tage} Tage`)
    }
    if (abweichungen.length) treffer.push({ schluessel: r.slug, text: `${r.name}: ${abweichungen.slice(0, 4).join(', ')}${abweichungen.length > 4 ? ` (+${abweichungen.length - 4})` : ''}`, ort: `/r/${r.slug}/` })
  }
  return regel('D-09', 'Wochentakt-Abweichung zwischen beobachteten Folgen', 'Fortschreibung ab dem letzten Stützpunkt kann einen falschen Wochentag treffen', geprueft, treffer)
}

/** D-10: „Läuft", aber seit über 60 Tagen keine Beobachtung — der Sendeplan lebt nur noch in der Rechnung. */
export function laeuftOhneLebenszeichen(b: Bestand): Regel {
  const treffer: Treffer[] = []
  const grenze = addDays(b.heute, -TAGE_OHNE_LEBENSZEICHEN)
  let geprueft = 0
  for (const r of b.releases) {
    if (r.releaseType !== 'weekly' || releaseStatus(r, b.heute) !== 'airing') continue
    geprueft++
    const obs = Object.values(r.schedule.observed ?? {}).filter(Boolean).sort()
    const letztes = obs.at(-1) ?? r.tvLetzteSichtung ?? r.schedule.belegtBis?.am
    if (letztes && letztes >= grenze) continue
    if (!letztes && r.schedule.firstEpisodeDate >= grenze) continue
    treffer.push({ schluessel: r.slug, text: `${r.name} (${r.platform}): Status „läuft", letzte Beobachtung ${letztes ?? 'nie'}, Start ${r.schedule.firstEpisodeDate}, ${r.schedule.episodeCount ?? '?'} Folgen${r.schedule.estimated ? ', geschätzt' : ''}`, ort: `/r/${r.slug}/` })
  }
  return regel('D-10', '„Läuft" ohne Lebenszeichen seit 60 Tagen', 'Kalender kündigt Woche für Woche Folgen an, die niemand belegt', geprueft, treffer)
}

/** D-13: Ein Film mit mehreren Folgen oder ein Einzelwerk mit Folgenzahl > 1. */
export function filmMitFolgen(b: Bestand): Regel {
  const treffer: Treffer[] = []
  const titel = new Map(b.titles.map((t) => [t.id, t]))
  for (const r of b.releases) {
    const t = titel.get(r.titleId)
    const n = r.schedule.episodeCount ?? 0
    if (n <= 1 || r.releaseType === 'disc') continue
    if (r.releaseType === 'movie' || t?.format === 'MOVIE' || t?.episodes === 1)
      treffer.push({ schluessel: r.slug, text: `${r.name} (${r.sender ?? r.platform}, ${r.slug}): ${n} Folgen, aber ${r.releaseType === 'movie' ? 'Release-Typ Film' : `Titel ist ${t?.format} mit ${t?.episodes} Folge(n)`}${r.herkunft ? ` — ${r.herkunft.slice(0, 80)}` : ''}`, ort: `/r/${r.slug}/` })
  }
  return regel('D-13', 'Film oder Einzelwerk mit mehreren Folgen', 'Panel zählt „x von n Folgen" für einen Film', b.releases.length, treffer)
}

/** D-14: Deutsche Veröffentlichung vor der japanischen Erstausstrahlung. */
export function deutschVorJapan(b: Bestand): Regel {
  const treffer: Treffer[] = []
  const titel = new Map(b.titles.map((t) => [t.id, t]))
  let geprueft = 0
  for (const r of b.releases) {
    const t = titel.get(r.titleId)
    if (!t?.jpYear || t.westlich || r.titleId < 0) continue
    geprueft++
    if (r.year < t.jpYear) treffer.push({ schluessel: r.slug, text: `${r.name}: deutsch ${r.schedule.firstEpisodeDate}, Japan erst ${t.jpYear} (${titelName(t)})`, ort: `/r/${r.slug}/` })
  }
  return regel('D-14', 'Deutscher Termin vor der japanischen Erstausstrahlung', 'Das Datum oder die Titelzuordnung ist falsch', geprueft, treffer)
}

/** D-20: Angekündigter Termin, dessen einzige Quelle älter als 90 Tage ist, ohne „aktuell"-Stand. */
export function ankuendigungOhneFrischeQuelle(b: Bestand): Regel {
  const treffer: Treffer[] = []
  const grenze = addDays(b.heute, -90)
  let geprueft = 0
  for (const r of b.releases) {
    if (r.schedule.firstEpisodeDate <= b.heute || r.widerlegt) continue
    geprueft++
    const juengste = (r.quellen ?? []).map((q) => q.aktualisiertAm ?? q.veroeffentlichtAm ?? q.gesehenAm).sort().at(-1)
    if (juengste && juengste >= grenze) continue
    if ((r.quellen ?? []).some((q) => q.stand === 'aktuell' && q.gesehenAm >= grenze)) continue
    treffer.push({ schluessel: r.slug, text: `${r.name} (${r.platform}): Termin ${r.schedule.firstEpisodeDate}, jüngste Quelle ${juengste ?? 'ohne Datum'} (${r.sources.length} Quelle(n))`, ort: `/r/${r.slug}/` })
  }
  return regel('D-20', 'Künftiger Termin ohne Quelle der letzten 90 Tage', 'Eine verschobene Ankündigung bleibt als Termin stehen', geprueft, treffer)
}

/** D-21: Event-Kennungen doppelt — zwei Kalendereinträge verschmelzen im ICS-Abo. */
export function eventIdsEindeutig(b: Bestand): Regel {
  const zahl = new Map<string, number>()
  for (const e of b.events) zahl.set(e.id, (zahl.get(e.id) ?? 0) + 1)
  const treffer = [...zahl].filter(([, n]) => n > 1).map(([id, n]) => ({ schluessel: id, text: `${id} ${n}×` }))
  return regel('D-21', 'Event-Kennung doppelt', 'Im Kalender-Abo verschmelzen zwei Termine zu einem', b.events.length, treffer)
}

/** D-23: Termin in der Zukunft, aber der Titel ist hinter dem Toggle oder fehlt — oder der Release ist widerlegt und hat trotzdem Termine. */
export function termineWiderlegter(b: Bestand): Regel {
  const je = eventsJeRelease(b.events)
  const treffer: Treffer[] = []
  for (const r of b.releases) if (r.widerlegt && je.get(r.slug)?.length) treffer.push({ schluessel: r.slug, text: `${r.name}: widerlegt am ${r.widerlegt.am}, trotzdem ${je.get(r.slug)!.length} Termine`, ort: `/r/${r.slug}/` })
  return regel('D-23', 'Widerlegter Termin mit Kalendereinträgen', 'Ein widerlegter Termin steht im Kalender', b.releases.length, treffer)
}

export const regelnTermine = (b: Bestand): Regel[] => [
  datumMonoton(b), vergangenOhneBeobachtung(b), wochentaktAbweichung(b), laeuftOhneLebenszeichen(b),
  filmMitFolgen(b), deutschVorJapan(b), ankuendigungOhneFrischeQuelle(b), eventIdsEindeutig(b), termineWiderlegter(b),
]

export type { Release }
