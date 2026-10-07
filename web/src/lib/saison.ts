import type { Release, Title } from '@shared/types.ts'
import { istSerie, saisonZeitraum, type SaisonTag } from '@shared/saison.ts'
import { todayIso } from '@shared/time.ts'

export { saisonText, saisonVon, versetzt } from '@shared/saison.ts'

/** Die Titel, die `saison.json` für den Ausblick mitbringt: Katalogtitel hinter dem Schalter mit angekündigtem Japan-Start. */
export interface SaisonKatalogTitel {
  id: number
  titleRomaji?: string
  titleEn?: string
  titleDe?: string
  coverImage?: string
  episodes?: number
  jpStart: string
  /** Die deutsche Fassung ist angekündigt (Anbieter-Lineup), ein Termin fehlt noch. */
  angekuendigt?: boolean
  /** Die Saison laut AniList: gilt vor dem Starttag (ein Start Ende September kann zur Herbst-Saison zählen). */
  jpSeason?: string
  jpYear?: number
}
export interface SaisonDatei {
  /** Titel-Kennung → japanischer Starttag (Hauptbestand, Serien im Fenster Vorjahr bis Ausblick). */
  jp: Record<string, string>
  katalog: SaisonKatalogTitel[]
}

/** Der erste Termin je Titel und ob er geschätzt ist. */
function ersterTermin(releases: Release[] | undefined): { datum: string; geschaetzt: boolean } | undefined {
  const liste = (releases ?? []).flatMap((r) => (r.schedule?.firstEpisodeDate ? [{ datum: r.schedule.firstEpisodeDate, geschaetzt: Boolean(r.schedule.estimated) }] : []))
  return liste.sort((a, b) => a.datum.localeCompare(b.datum))[0]
}

export const hatDeutsch = (t: Title): boolean => Boolean((t.streams ?? []).some((s) => s.dub === true) || t.deErstausgabe?.synchro || t.hasVoices)

/** Wie weit wir die deutsche Fassung kennen — vom sichersten zum offensten Zustand. */
export type Stufe = 'auf-deutsch' | 'bestaetigt' | 'angekuendigt' | 'termin' | 'ungeklaert' | 'offen'

/**
 * Die Stufe aus unserem Wissensstand (Daniel, 07.10.2026: „deutsch bestätigt oder deutsch angekündigt, je nach Wissensstand"; Tank Chair stand schon im Kalender und war doch „noch offen"):
 * **Ein Termin im Kalender ist ein deutscher Termin** — der Kalender führt nur Veröffentlichungen mit deutscher Fassung (Untertitel allein gehören nicht hinein). Ein abgeleiteter Termin
 * (`geschaetzt`: Simulcast-Datum statt Ankündigung der Synchro) zählt nicht. **Auf Deutsch** = erschienen; **bestätigt** = noch nicht erschienen, Tonspur belegt; **angekündigt** = noch nicht
 * erschienen, Termin ohne Tonspur-Beleg; **Termin** = nur ein abgeleiteter Termin; **ungeklärt** = abgeleiteter Termin schon verstrichen; **offen** = kein Termin.
 */
export function stufeVon(t: Title, termin: { datum: string; geschaetzt: boolean } | undefined, heute: string): Stufe {
  /* Der Anbieter hat eine Synchro angekündigt, ohne Tag: unser Urteil ist „angekündigt“ — ein abgeleiteter Termin (Simulcast) ändert daran nichts (Daniel, 08.10.2026: Black Clover, Apothekerin). */
  const synchroAngekuendigt = t.ankuendigung?.synchro === 'angekuendigt'
  if (!termin) return hatDeutsch(t) ? 'bestaetigt' : synchroAngekuendigt ? 'angekuendigt' : 'offen'
  const erschienen = termin.datum <= heute
  if (hatDeutsch(t) || !termin.geschaetzt) return erschienen ? 'auf-deutsch' : hatDeutsch(t) ? 'bestaetigt' : 'angekuendigt'
  return synchroAngekuendigt ? 'angekuendigt' : erschienen ? 'ungeklaert' : 'termin'
}

export interface SaisonZeile {
  /** Ein Titel aus dem Bestand — oder, im Ausblick, ein Katalogtitel hinter dem Schalter. */
  titel?: Title
  katalog?: SaisonKatalogTitel
  id: number
  deutsch: boolean
  stufe: Stufe
  /** Der erste deutsche Termin liegt in der Vergangenheit oder heute. */
  erschienen: boolean
  /** Japanischer Starttag, wo bekannt. */
  jp?: string
  /** Erster deutscher Termin, wo einer belegt oder angekündigt ist; `geschaetzt`, wenn er abgeleitet ist. */
  de?: string
  geschaetzt?: boolean
}

/**
 * **Die Fernseh- und Web-Serien einer Saison** (Daniel, 07.10.2026: Saison-Überblick). Titel mit japanischem Start in dieser Saison, Deutsch zuerst, dann nach
 * erstem deutschen Termin. Der Ausblick (`ausblick`) nimmt zusätzlich die Katalogtitel mit angekündigtem Japan-Start aus `saison.json` auf. **Ein deutscher Termin allein macht keinen Titel zur
 * Serie der Saison** (07.10.2026: „Afro Samurai", 2007, stand wegen einer Disc-Neuausgabe im März 2027 als Serie des Winters 2027 da) — lieber „noch nichts bekannt" als ein alter Titel als neuer.
 */
export function zeilenDerSaison(
  titles: Title[],
  releasesByTitle: Map<number, Release[]>,
  s: SaisonTag,
  datei: SaisonDatei | undefined,
  heute = todayIso(),
): SaisonZeile[] {
  const [von, bis] = saisonZeitraum(s)
  const zeilen: SaisonZeile[] = []
  for (const t of titles) {
    if (!istSerie(t.format)) continue
    const termin = ersterTermin(releasesByTitle.get(t.id))
    /* Ein verstrichener, nur abgeleiteter Termin (Simulcast-Tag) ist kein deutscher Erscheinungstag — die Zeile sagt dann „noch kein deutscher Termin“ statt „erschienen am“. */
    const verstrichen = Boolean(termin?.geschaetzt && termin.datum <= heute && !hatDeutsch(t))
    if (t.jpYear === s.jahr && t.jpSeason === s.saison) zeilen.push({ id: t.id, titel: t, deutsch: hatDeutsch(t), stufe: stufeVon(t, termin, heute), erschienen: termin !== undefined && termin.datum <= heute && !verstrichen, jp: datei?.jp[String(t.id)], de: verstrichen ? undefined : termin?.datum, geschaetzt: termin?.geschaetzt })
  }
  {
    const bekannt = new Set(zeilen.map((z) => z.id))
    for (const k of datei?.katalog ?? []) if (!bekannt.has(k.id) && (k.jpSeason ? k.jpYear === s.jahr && k.jpSeason === s.saison : k.jpStart >= von && k.jpStart <= bis)) zeilen.push({ id: k.id, katalog: k, deutsch: false, stufe: k.angekuendigt ? 'angekuendigt' : 'offen', erschienen: false, jp: k.jpStart })
  }
  return zeilen.sort((a, b) => Number(b.erschienen) - Number(a.erschienen) || Number(b.deutsch) - Number(a.deutsch) || (a.de ?? a.jp ?? '9').localeCompare(b.de ?? b.jp ?? '9') || a.id - b.id)
}
