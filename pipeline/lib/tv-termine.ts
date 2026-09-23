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

const JAHRESZEIT: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }

/**
 * **Eine Nummer jenseits der Staffel gehört in die nächste** (19.09.2026). ProSieben MAXX
 * zeigt „Solo Leveling" mit „Das war dir wohl nicht bewusst" — bei TMDB Folge 14 einer
 * durchgezählten Liste, unser Titel „Solo Leveling" hat aber 12 Folgen: Es ist Staffel 2
 * („Arise from the Shadow"), Folge 2. Gesucht wird in den TV-Staffeln derselben Reihe
 * (`franchiseId`), nach Ausstrahlung sortiert. Passen nicht alle Nummern in eine Staffel,
 * gibt es keine Zuordnung — lieber zählen als eine Staffel raten.
 */
function spaetereStaffel(
  title: Title,
  von: number,
  bis: number,
  titles: Map<number, Title>,
): { title: Title; versatz: number } | undefined {
  const reihe = [...titles.values()]
    .filter((t) => t.franchiseId === title.franchiseId && t.format === 'TV' && t.episodes)
    .sort((a, b) => (a.jpYear ?? 0) - (b.jpYear ?? 0) || (JAHRESZEIT[a.jpSeason ?? ''] ?? 0) - (JAHRESZEIT[b.jpSeason ?? ''] ?? 0))
  const start = reihe.findIndex((t) => t.id === title.id)
  if (start < 0) return undefined
  let versatz = 0
  for (const t of reihe.slice(start)) {
    if (von - versatz <= t.episodes!) return bis - versatz <= t.episodes! ? { title: t, versatz } : undefined
    versatz += t.episodes!
  }
  return undefined
}

/**
 * Hängt jedem TV-Termin seine Sendungen ab gestern an — auch den von Hand gepflegten, denn die
 * Frage „läuft das gerade, bis wann?" beantwortet nur das Programm (22.09.2026).
 */
export function sendungenAnhaengen(
  releases: Release[],
  sendungen: (TvSendung & { kennung?: string })[],
  gestern: string,
  wiki: WikiListen = {},
): void {
  const jeTermin = new Map<string, (TvSendung & { kennung?: string })[]>()
  for (const s of sendungen) {
    if (berlinTag(s.ende) < gestern) continue
    const k = `${s.titleId}|${s.sender.toLowerCase()}`
    jeTermin.set(k, [...(jeTermin.get(k) ?? []), s])
  }
  for (const r of releases) {
    if (r.platform !== 'tv') continue
    const liste = jeTermin.get(`${r.titleId}|${(r.sender ?? '').toLowerCase()}`)
    if (!liste?.length) continue
    /*
      Die Folgennummer je Sendung über den Folgentitel — auch dort, wo nicht jede Sendung in der
      Liste steht und der Termin deshalb nur zählt (One Piece 22.09.2026: 12 von 14 gefunden).
      Ein Titel ohne Treffer bleibt ohne Nummer; geraten wird nicht.
    */
    const eigene = wiki[String(r.titleId)]
    const nummern = eigene?.folgen.length ? nummernNachTitel(eigene.folgen, !eigene.url) : undefined
    r.sendungen = liste
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((s) => {
        const nr = s.folge ? nummern?.get(folgenKern(s.folge)) : undefined
        /*
          Die Detailseite der Sendung bei tv.de. `/sendung/r/s,<kennung>/` leitet per 301 auf die
          sprechende Adresse weiter — gemessen am 22.09.2026 an One Piece 23.09. 18:20
          („Zou muss verteidigt werden!"), Ziel mit Titel, Sendezeit und Sender.
        */
        const url = s.kennung ? `https://tv.de/sendung/r/s,${s.kennung}/` : undefined
        return {
          start: s.start.slice(0, 16),
          ende: s.ende.slice(0, 16),
          ...(s.folge ? { folge: s.folge } : {}),
          ...(nr ? { nr } : {}),
          ...(url ? { url } : {}),
        }
      })
  }
}

/**
 * **Eine Sendung gehört dem Titel, dessen Folgenliste ihren Folgentitel führt** (23.09.2026).
 *
 * tv.de nennt die Reihe, nicht die Ausgabe: Am 28./29.09.2026 liefen vier Folgen unter
 * „One Piece", deren Folgentitel mit „Fish-Man Island Saga: …" beginnen. Das ist die Neuauflage
 * (AniList 183423, 21 Folgen, 2024), nicht die durchlaufende Serie. Gemessen: Alle vier
 * Folgentitel stehen wortgleich in der Liste von 183423 und in keiner Folge von One Piece.
 *
 * Umgehängt wird nur, wenn es eindeutig ist: Die Liste des gemeldeten Titels kennt den Titel
 * **nicht**, genau ein anderer Titel derselben Reihe kennt ihn, und beide haben eine Liste.
 * Sonst bleibt die Sendung, wo sie ist — eine geratene Zuordnung ist schlimmer als keine.
 */
export function sendungNeuZuordnen(
  sendungen: TvSendung[],
  titles: Map<number, Title>,
  wiki: WikiListen = {},
): TvSendung[] {
  const kerne = new Map<number, Set<string>>()
  const kern = (id: number) => {
    if (!kerne.has(id)) kerne.set(id, new Set((wiki[String(id)]?.folgen ?? []).map((f) => folgenKern(f.dt)).filter((k) => k.length >= 6)))
    return kerne.get(id)!
  }
  /* Reihe → ihre Titel, damit nur Geschwister als Kandidaten in Frage kommen. */
  const reihe = new Map<number, number[]>()
  for (const t of titles.values()) {
    const f = t.franchiseId ?? t.id
    reihe.set(f, [...(reihe.get(f) ?? []), t.id])
  }
  return sendungen.map((s) => {
    const folge = s.folge ? folgenKern(s.folge.replace(/^[^:]{3,60}:\s*/, '')) : ''
    if (!folge || folge.length < 6) return s
    const eigene = kern(s.titleId)
    if (!eigene.size || eigene.has(folge)) return s
    const t = titles.get(s.titleId)
    const geschwister = (reihe.get(t?.franchiseId ?? s.titleId) ?? []).filter((id) => id !== s.titleId && kern(id).has(folge))
    return geschwister.length === 1 ? { ...s, titleId: geschwister[0]! } : s
  })
}

export function releasesAusTvProgramm(
  sendungen: TvSendung[],
  titles: Map<number, Title>,
  vorhanden: Release[],
  wiki: WikiListen = {},
): Release[] {
  sendungen = sendungNeuZuordnen(sendungen, titles, wiki)
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
    let title = titles.get(erste.titleId)!
    /* Nummern aus der Episodenliste — nur wenn jede Sichtung darin steht. */
    const wikiListe = wiki[String(erste.titleId)]
    const nummern = wikiListe?.folgen.length ? nummernNachTitel(wikiListe.folgen, !wikiListe.url) : undefined
    const zugeordnet = liste.map((s) => (s.folge ? nummern?.get(folgenKern(s.folge)) : undefined))
    /* Erste deutsche Veröffentlichung je Folgentitel (EAD bzw. RTL+-Start) — für „Premiere/Wiederholung". */
    const erstJeKern = new Map(
      (wikiListe?.folgen ?? []).flatMap((f) => {
        const d = f.ead ?? (f as { ab?: string }).ab
        return d ? [[folgenKern(f.dt), d.slice(0, 10)] as const] : []
      }),
    )
    const ersteDeutsch: Record<number, string> = {}
    let mitWiki = zugeordnet.every((x) => x !== undefined)
    let versatz = 0
    if (mitWiki && title.episodes && Math.max(...(zugeordnet as number[])) > title.episodes) {
      const platz = spaetereStaffel(title, Math.min(...(zugeordnet as number[])), Math.max(...(zugeordnet as number[])), titles)
      if (platz && !belegt.has(`${platz.title.id}|${erste.sender.toLowerCase()}`)) {
        title = platz.title
        versatz = platz.versatz
      } else mitWiki = false
    }
    const observed: Record<number, string> = {}
    const zeitJeFolge: Record<number, string> = {}
    let n = 0
    let ab = 1
    if (mitWiki) {
      liste.forEach((s, i) => {
        const nr = zugeordnet[i]! - versatz
        if (observed[nr]) return
        observed[nr] = berlinTag(s.start)
        zeitJeFolge[nr] = berlinZeit(s.start)
        const erst = s.folge ? erstJeKern.get(folgenKern(s.folge)) : undefined
        if (erst) ersteDeutsch[nr] = erst
      })
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
        zeitJeFolge[n] = berlinZeit(s.start)
      }
    }
    /* Die Uhrzeit nur, wenn alle Sendungen um dieselbe liefen. */
    const zeiten = new Set(liste.map((s) => berlinZeit(s.start)))
    const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? erste.titel
    aus.push({
      slug: `auto-${title.id}-tv-${slugTeil(erste.sender)}`,
      titleId: title.id,
      name,
      platform: 'tv',
      sender: erste.sender,
      releaseType: 'weekly',
      schedule: {
        firstEpisodeDate: berlinTag(erste.start),
        /* Eine Uhrzeit für alle, sonst je Folge (Daniel, 19.09.2026: „uhrzeit ist wichtig"). */
        ...(zeiten.size === 1 ? { time: [...zeiten][0] } : { zeiten: zeitJeFolge }),
        ...(ab > 1 ? { firstEpisodeNumber: ab } : {}),
        episodeCount: n,
        observed,
      },
      tvLetzteSichtung: berlinTag(liste[liste.length - 1]!.start),
      ...(mitWiki ? { folgenBelegt: true } : {}),
      ...(mitWiki && Object.keys(ersteDeutsch).length ? { ersteDeutsch } : {}),
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
