/**
 * **Folgen einer RTL+-Serie: Staffel, Nummer, deutscher Titel, RTL+-Start** (19.09.2026).
 *
 * Drei Stellen, jede kann nur einen Teil:
 *
 * - **Video-Sitemap** (`videos.N.sitemap.xml`): je Folge Adresse, Titel und
 *   `publication_date` — keine Staffel, keine Nummer.
 * - **Staffelseite** (`…/season-3-s_39848`): „Staffel 3 • Folge 15 • Wechseln oder
 *   auflösen" — aber nur die ersten 24 Folgen einer Staffel, und ohne Adresse.
 * - **Folgenseite**: schema.org `TVEpisode` mit `seasonNumber`, `episodeNumber`, `name`,
 *   `uploadDate` — je Folge ein Abruf.
 *
 * Verbunden wird über den Folgentitel (`folgenKern`); nur was keine Staffelseite
 * nennt, holt die Folgenseite, und das einmal.
 *
 * Gemessen an Beyblade X (19.09.2026): Staffel 1 hat 50 Adressen bei 51 Folgen (Folge 37
 * fehlt bei RTL+), Staffel 2 49 von 49, Staffel 3 läuft wöchentlich freitags (Folge 1 am
 * 05.06.2026 bis Folge 17 am 18.09.). Die Staffeln decken sich mit Disney+ (51/49).
 * Zu jeder Folge gibt es zusätzlich eine `…/video/embed/…`-Adresse ohne Daten — sie zählt nicht.
 */
import { folgenKern } from '../../shared/folgen-zuordnung.ts'

export type RtlVideo = { video: string; titel: string; ab?: string; staffel?: number; folge?: number }
export type RtlFolge = { nr: number; st: number; staffel: number; dt: string; ab?: string }

const entities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

/** Folgen aus einer Video-Teilkarte, nur für die gefragten Programme (Slug → Titel-ID). */
export function videosAusSitemap(xml: string, programme: Map<string, number>): (RtlVideo & { titleId: number })[] {
  const aus: (RtlVideo & { titleId: number })[] = []
  for (const m of xml.matchAll(/<url>(.*?)<\/url>/gs)) {
    const loc = /<loc>https:\/\/plus\.rtl\.de\/([^/<]+)\/video\/(?!embed\/)([^<]+)<\/loc>/.exec(m[1]!)
    const titleId = loc && programme.get(loc[1]!)
    if (!loc || !titleId) continue
    const ab = /<video:publication_date>([^<]+)/.exec(m[1]!)?.[1]
    aus.push({
      titleId,
      video: loc[2]!,
      titel: entities(/<video:title>([^<]*)/.exec(m[1]!)?.[1] ?? '').trim(),
      ...(ab ? { ab: ab.slice(0, 10) } : {}),
    })
  }
  return aus
}

/** „Staffel N • Folge M • Titel" aus einer Staffelseite. */
export function staffelEintraege(html: string): { staffel: number; folge: number; titel: string }[] {
  const gesehen = new Map<string, { staffel: number; folge: number; titel: string }>()
  for (const m of html.matchAll(/Staffel (\d+) • Folge (\d+) • ([^"\\<]+)/g)) {
    const e = { staffel: Number(m[1]), folge: Number(m[2]), titel: entities(m[3]!).trim() }
    gesehen.set(`${e.staffel}|${e.folge}`, e)
  }
  return [...gesehen.values()]
}

/** Staffel und Nummer aus der schema.org-Angabe einer Folgenseite. */
export function folgeAusSeite(html: string): { staffel: number; folge: number } | undefined {
  const folge = /"@type":"TVEpisode".*?"episodeNumber":(\d+)/s.exec(html)?.[1]
  const staffel = /"partOfSeason":\{"@type":"TVSeason","seasonNumber":(\d+)/.exec(html)?.[1]
  return folge && staffel ? { staffel: Number(staffel), folge: Number(folge) } : undefined
}

/** Staffelnummer und Folge je Video eintragen, soweit eine Staffelseite sie nennt. */
export function zuordnen(videos: RtlVideo[], eintraege: { staffel: number; folge: number; titel: string }[]): void {
  const jeTitel = new Map<string, { staffel: number; folge: number }[]>()
  for (const e of eintraege) jeTitel.set(folgenKern(e.titel), [...(jeTitel.get(folgenKern(e.titel)) ?? []), e])
  for (const v of videos) {
    if (v.staffel) continue
    const treffer = jeTitel.get(folgenKern(v.titel))
    /* Ein Titel, der zweimal vorkommt, ordnet nichts zu. */
    if (treffer?.length === 1) Object.assign(v, { staffel: treffer[0]!.staffel, folge: treffer[0]!.folge })
  }
}

/**
 * **Durchgezählt über alle Staffeln.** Unser Bestand führt Beyblade X als einen Titel;
 * Staffel 3 Folge 15 ist dort Folge 115. Die Länge einer Staffel ist ihre höchste
 * bekannte Nummer, nicht die Zahl der Adressen — bei RTL+ fehlt S1 F37, die Staffel hat
 * trotzdem 51 Folgen. Fehlt eine Staffel ganz, bricht die Zählung dort ab: ohne ihre
 * Länge wäre jede spätere Nummer geraten.
 */
export function durchzaehlen(videos: RtlVideo[]): RtlFolge[] {
  const staffeln = new Map<number, RtlVideo[]>()
  for (const v of videos) if (v.staffel && v.folge) staffeln.set(v.staffel, [...(staffeln.get(v.staffel) ?? []), v])
  const aus: RtlFolge[] = []
  let versatz = 0
  for (let s = 1; staffeln.has(s); s++) {
    const liste = staffeln.get(s)!
    for (const v of liste) aus.push({ nr: versatz + v.folge!, st: v.folge!, staffel: s, dt: v.titel, ...(v.ab ? { ab: v.ab } : {}) })
    versatz += Math.max(...liste.map((v) => v.folge!))
  }
  return aus.sort((a, b) => a.nr - b.nr)
}
