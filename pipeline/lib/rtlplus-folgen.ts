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
import { addDays } from '../../shared/time.ts'
import type { Release, Title } from '../../shared/types.ts'

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

/**
 * **Eine RTL+-Staffel, die gerade wöchentlich wächst, wird ein Termin** (19.09.2026).
 *
 * Beyblade X Staffel 3 kam freitags auf RTL+ auf Deutsch, Folge 1 am 05.06.2026 bis
 * Folge 17 am 18.09. — der Kalender wusste davon nichts. Ein Termin entsteht nur, wenn
 * alles davon gemessen ist:
 *
 * - die jüngste Staffel hat mindestens drei Folgen, jede an einem eigenen Tag, im
 *   Abstand ganzer Wochen (± 1 Tag) — ein Wochentakt, keine Paketlieferung; eine
 *   fehlende Folge (RTL+ führt S3 F2 nicht) darf eine Woche Lücke lassen;
 * - die letzte Folge ist höchstens 14 Tage alt (die Staffel läuft noch);
 * - der RTL+-Weg des Titels trägt `dub: true` (Synchro belegt);
 * - es gibt noch keinen RTL+-Termin für den Titel (ein gepflegter gewinnt).
 *
 * Das Ende kennt RTL+ nicht. Wie bei einer TV-Sichtung (`tvLetzteSichtung`) gilt die Reihe
 * bis sieben Tage nach der letzten Folge als laufend, und Termine gibt es nur für
 * erschienene Folgen — keine Folge 18 am 25.09., solange sie niemand gesehen hat.
 */
export function rtlplusWochentermine(
  listen: Record<string, { programm: string; folgen: RtlFolge[] }>,
  titles: Map<number, Title>,
  vorhanden: Release[],
  heute: string,
): Release[] {
  const aus: Release[] = []
  for (const [id, { programm, folgen }] of Object.entries(listen)) {
    const title = titles.get(Number(id))
    if (!title || vorhanden.some((r) => r.titleId === title.id && r.platform === 'rtlplus')) continue
    if (!title.streams?.some((s) => s.platform === 'rtlplus' && s.dub === true)) continue
    const staffel = Math.max(0, ...folgen.map((f) => f.staffel))
    const reihe = folgen.filter((f) => f.staffel === staffel && f.ab).sort((a, b) => a.nr - b.nr)
    const tage = reihe.map((f) => f.ab!)
    const woechentlich =
      reihe.length >= 3 &&
      tage.every((d, i) => {
        if (i === 0) return true
        const abstand = (Date.parse(d) - Date.parse(tage[i - 1]!)) / 864e5
        /* Eine fehlende Folge (bei RTL+ S3 F2) verdoppelt den Abstand — erlaubt sind ganze Wochen. */
        const wochen = Math.round(abstand / 7)
        return wochen >= 1 && Math.abs(abstand - 7 * wochen) <= 1
      })
    const letzte = tage.at(-1)
    if (!woechentlich || !letzte || letzte < addDays(heute, -14)) continue
    const erste = reihe[0]!
    const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? programm
    aus.push({
      slug: `auto-${title.id}-rtlplus-staffel-${staffel}`,
      titleId: title.id,
      name: `${name} Staffel ${staffel}`,
      platform: 'rtlplus',
      platformUrl: `https://plus.rtl.de/${programm}`,
      releaseType: 'weekly',
      schedule: {
        firstEpisodeDate: erste.ab!,
        ...(erste.nr > 1 ? { firstEpisodeNumber: erste.nr } : {}),
        episodeCount: reihe.at(-1)!.nr - erste.nr + 1,
        observed: Object.fromEntries(reihe.map((f) => [f.nr, f.ab!])),
      },
      tvLetzteSichtung: letzte,
      folgenBelegt: true,
      year: Number(erste.ab!.slice(0, 4)),
      herkunft: `Automatisch aus den Folgenseiten von RTL+: Staffel ${staffel}, ${reihe.length} Folgen im Wochentakt, zuletzt am ${letzte}. Ein Ende nennt RTL+ nicht.`,
      sources: [`https://plus.rtl.de/${programm}`],
      automatisch: true,
    })
  }
  return aus
}
