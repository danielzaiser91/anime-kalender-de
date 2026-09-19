/**
 * **Aus gesichteten TV-Sendungen werden Termine** (16.09.2026).
 *
 * `fetch-tv-programm.ts` sammelt täglich, was bei den Sendern der RTL-Gruppe
 * läuft. Die Quelle nennt je Sendung Tag, Uhrzeit und Folgentitel — **keine
 * Folgennummer und kein Ende**. Deshalb:
 *
 * - Steht die Reihe in einer **Wikipedia-Episodenliste** und findet sich dort jeder
 *   gesichtete Folgentitel wieder, gilt deren Nummer (19.09.2026; gemessen: 32 von 32
 *   Titeln wörtlich gleich). Gezählt wird ab der ersten Folge der Seite — die
 *   Pokémon-Liste zählt über das ganze Franchise (Horizonte beginnt bei 1235).
 * - Sonst zählt jeder **neue Folgentitel** als nächste Folge; eine Wiederholung
 *   desselben Titels zählt nicht noch einmal. Eine halbe Zuordnung gibt es nicht:
 *   Fehlt ein Titel in der Liste, wird für die ganze Reihe gezählt.
 * - Kein Termin wird fortgeschrieben. Die Reihe gilt als laufend, solange die
 *   letzte Sichtung höchstens sieben Tage zurückliegt (`tvLetzteSichtung`,
 *   ausgewertet in `releaseStatus()`).
 * - Ein von Hand gepflegter TV-Termin desselben Titels beim selben Sender
 *   gewinnt; er kennt die Folgennummern.
 */
import type { Release, Title } from '../../shared/types.ts'
import { TVDE_SENDER, type TvSendung } from '../fetch-tv-programm.ts'
import type { WikiFolge } from './wikipedia-folgen.ts'
import { folgenKern } from '../../shared/folgen-zuordnung.ts'

/**
 * Folgenlisten je Titel. Ohne `url` ist `seite` eine Wikipedia-Seite; mit `url` stammt die
 * Liste von anderswo (RTL+, 19.09.2026) und `seite` ist der Name, unter dem sie genannt wird.
 */
export type WikiListen = Record<string, { seite: string; url?: string; folgen: WikiFolge[] }>

/**
 * Folgentitel → Nummer in der Serie; ein Titel, der zweimal vorkommt, ordnet nichts zu.
 * `relativ`: gezählt ab der ersten Folge der Liste (Wikipedia-Seiten zählen teils
 * franchiseweit); eine RTL+-Liste zählt schon selbst ab Staffel 1 Folge 1.
 */
function nummernNachTitel(folgen: WikiFolge[], relativ: boolean): Map<string, number> {
  const erste = relativ ? Math.min(...folgen.map((f) => f.nr)) : 1
  const aus = new Map<string, number>()
  const doppelt = new Set<string>()
  for (const f of folgen) {
    const k = folgenKern(f.dt)
    if (aus.has(k)) doppelt.add(k)
    aus.set(k, f.nr - erste + 1)
  }
  for (const k of doppelt) aus.delete(k)
  return aus
}

/* Quelle je Sender: die RTL-Gruppe aus dem RTL+-Programm, alle übrigen aus tv.de (19.09.2026). */
const TVDE_NACH_NAME = new Map(Object.entries(TVDE_SENDER).map(([slug, name]) => [name.toLowerCase(), slug]))

const berlinTag = (iso: string) => iso.slice(0, 10)
const berlinZeit = (iso: string) => iso.slice(11, 16)
const slugTeil = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function releasesAusTvProgramm(
  sendungen: TvSendung[],
  titles: Map<number, Title>,
  vorhanden: Release[],
  wiki: WikiListen = {},
): Release[] {
  const belegt = new Set(
    vorhanden.filter((r) => r.platform === 'tv').map((r) => `${r.titleId}|${(r.sender ?? '').toLowerCase()}`),
  )
  const gruppen = new Map<string, TvSendung[]>()
  for (const s of sendungen) {
    const k = `${s.titleId}|${s.sender.toLowerCase()}`
    if (belegt.has(k) || !titles.has(s.titleId)) continue
    gruppen.set(k, [...(gruppen.get(k) ?? []), s])
  }
  const aus: Release[] = []
  for (const liste of gruppen.values()) {
    liste.sort((a, b) => a.start.localeCompare(b.start))
    const erste = liste[0]!
    const title = titles.get(erste.titleId)!
    /* Nummern aus der Episodenliste — nur wenn jede Sichtung darin steht. */
    const wikiListe = wiki[String(erste.titleId)]
    const nummern = wikiListe?.folgen.length ? nummernNachTitel(wikiListe.folgen, !wikiListe.url) : undefined
    const zugeordnet = liste.map((s) => (s.folge ? nummern?.get(folgenKern(s.folge)) : undefined))
    const mitWiki = zugeordnet.every((x) => x !== undefined)
    const observed: Record<number, string> = {}
    let n = 0
    let ab = 1
    if (mitWiki) {
      liste.forEach((s, i) => (observed[zugeordnet[i]!] ??= berlinTag(s.start)))
      const nrn = Object.keys(observed).map(Number)
      ab = Math.min(...nrn)
      n = Math.max(...nrn) - ab + 1
    } else {
      /* Neue Folgentitel in Sendereihenfolge; ohne Folgentitel zählt jeder Sendetag. */
      const gesehen = new Set<string>()
      for (const s of liste) {
        const schluessel = s.folge ?? `tag:${berlinTag(s.start)}`
        if (gesehen.has(schluessel)) continue
        gesehen.add(schluessel)
        observed[++n] = berlinTag(s.start)
      }
    }
    /* Die Uhrzeit nur, wenn alle Sendungen um dieselbe liefen. */
    const zeiten = new Set(liste.map((s) => berlinZeit(s.start)))
    const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? erste.titel
    aus.push({
      slug: `auto-${erste.titleId}-tv-${slugTeil(erste.sender)}`,
      titleId: erste.titleId,
      name,
      platform: 'tv',
      sender: erste.sender,
      releaseType: 'weekly',
      schedule: {
        firstEpisodeDate: berlinTag(erste.start),
        ...(zeiten.size === 1 ? { time: [...zeiten][0] } : {}),
        ...(ab > 1 ? { firstEpisodeNumber: ab } : {}),
        episodeCount: n,
        observed,
      },
      tvLetzteSichtung: berlinTag(liste[liste.length - 1]!.start),
      year: Number(erste.start.slice(0, 4)),
      ...(() => {
        const tvde = TVDE_NACH_NAME.get(erste.sender.toLowerCase())
        const nr = !mitWiki ? '' : ` Folgennummern aus ${wikiListe!.url ? wikiListe!.seite : 'der Episodenliste der Wikipedia'}.`
        const wikiQuelle = !mitWiki
          ? []
          : [wikiListe!.url ?? `https://de.wikipedia.org/wiki/${encodeURI(wikiListe!.seite.replace(/ /g, '_'))}`]
        return tvde
          ? {
              herkunft: `Automatisch aus dem TV-Programm von tv.de (${liste.length} Sendungen gesichtet).${nr}`,
              sources: [`https://tv.de/sender/${tvde}/`, ...wikiQuelle],
            }
          : {
              herkunft: `Automatisch aus dem TV-Programm von RTL+ (${liste.length} Sendungen gesichtet).${nr}`,
              sources: ['https://plus.rtl.de/tv-programm', ...wikiQuelle],
            }
      })(),
      automatisch: true,
    })
  }
  return aus
}
