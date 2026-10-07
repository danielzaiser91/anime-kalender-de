import type { Release, Title } from '@shared/types.ts'
import { istSerie, saisonZeitraum, type SaisonTag } from '@shared/saison.ts'

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

export interface SaisonZeile {
  /** Ein Titel aus dem Bestand — oder, im Ausblick, ein Katalogtitel hinter dem Schalter. */
  titel?: Title
  katalog?: SaisonKatalogTitel
  id: number
  deutsch: boolean
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
  ausblick = false,
): SaisonZeile[] {
  const [von, bis] = saisonZeitraum(s)
  const zeilen: SaisonZeile[] = []
  for (const t of titles) {
    if (!istSerie(t.format)) continue
    const termin = ersterTermin(releasesByTitle.get(t.id))
    const imJapan = t.jpYear === s.jahr && t.jpSeason === s.saison
    if (imJapan) zeilen.push({ id: t.id, titel: t, deutsch: hatDeutsch(t), jp: datei?.jp[String(t.id)], de: termin?.datum, geschaetzt: termin?.geschaetzt })
  }
  if (ausblick) {
    const bekannt = new Set(zeilen.map((z) => z.id))
    for (const k of datei?.katalog ?? []) if (!bekannt.has(k.id) && k.jpStart >= von && k.jpStart <= bis) zeilen.push({ id: k.id, katalog: k, deutsch: false, jp: k.jpStart })
  }
  return zeilen.sort((a, b) => Number(b.deutsch) - Number(a.deutsch) || (a.de ?? a.jp ?? '9').localeCompare(b.de ?? b.jp ?? '9') || a.id - b.id)
}
