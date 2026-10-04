import { toIsoDate } from '../../shared/time.ts'

/**
 * **Was der Anbieter nicht eingehalten hat, steht am Termin.**
 *
 * `pipeline/termine-pruefen.ts` schreibt die Fälle nach
 * `data/termine-verpasst.json`; hier wandern sie an den Sendeplan, damit
 * `expandEvents()` sie an das jeweilige Ereignis hängt. Ein Termin, an dem
 * nichts erschien, verschwindet damit nicht — er sagt es (Daniel, 31.08.2026:
 * „falsche infos auf der webseite sind unbedingt zu vermeiden").
 *
 * Aufsteigend nach Termin: Fällt eine Folge zweimal aus (am alten Tag und am
 * recherchierten Ersatztermin), gilt der jüngere Vermerk.
 *
 * Liegt in einer eigenen Datei, weil `baueReleases` die Längengrenze reißt.
 */
/** Nur die Felder, die am Sendeplan landen — `grundlagen.ts` liest einen schmaleren Typ. */
type Verpasst = {
  slug: string
  episode: number | null
  erwartetAm: string
  bemerktAm?: string
  erschienenAm?: string | null
  verzugStunden?: number | null
  folgenVerfuegbar?: number | null
  neuErwartet?: string | null
  recherche?: string | null
  rechercheQuelle?: string | null
  rechercheAm?: string | null
  geprueftAm?: string | null
  newsGeprueftAm?: string | null; messbeleg?: { bild?: string }; nachgereichtBeleg?: { bild?: string }
  hinweise?: { quelle: string; titel: string; url: string; datum: string }[]
}

export function verpasstAmTermin(slug: string, verpasst: Verpasst[], ab?: string) {
  const hier = verpasst
    /*
      **Ein Termin vor dem heutigen Start ist keine versäumte Folge.** Der
      Apothekerin-Eintrag entstand aus der Schätzung „01.10."; als die
      Ankündigung den 02.10. belegte, beschrieb er einen Tag, den nie jemand
      angekündigt hatte. Gezählt wird nur,
      was **ab** dem geltenden Start liegt.
    */
    .filter((v) => v.slug === slug && v.episode != null && (!ab || v.erwartetAm.slice(0, 10) >= ab))
    .sort((a, b) => a.erwartetAm.localeCompare(b.erwartetAm))
  if (!hier.length) return undefined
  return Object.fromEntries(
    hier.map((v) => [
      v.episode as number,
      {
        erwartetAm: v.erwartetAm,
        ...(v.bemerktAm ? { bemerktAm: v.bemerktAm } : {}),
        ...(v.erschienenAm ? { erschienenAm: v.erschienenAm } : {}),
        ...(v.verzugStunden != null ? { verzugStunden: v.verzugStunden } : {}),
        ...(v.folgenVerfuegbar != null ? { folgenVerfuegbar: v.folgenVerfuegbar } : {}),
        ...(v.neuErwartet ? { neuErwartet: v.neuErwartet } : {}),
        ...(v.recherche ? { recherche: v.recherche } : {}),
        ...(v.recherche && v.rechercheQuelle ? { rechercheQuelle: v.rechercheQuelle } : {}),
        ...(v.rechercheAm ? { rechercheAm: v.rechercheAm } : {}),
        ...(v.geprueftAm ? { geprueftAm: v.geprueftAm } : {}),
        ...(v.newsGeprueftAm ? { newsGeprueftAm: v.newsGeprueftAm } : {}),
        ...(v.messbeleg?.bild ? { messBild: v.messbeleg.bild } : {}),
        ...(v.nachgereichtBeleg?.bild ? { nachBild: v.nachgereichtBeleg.bild } : {}),
        ...(v.hinweise?.length ? { hinweise: v.hinweise } : {}),
      },
    ]),
  )
}

/**
 * Nachgereichte Folgen gelten am Tag des Nachreichens als erschienen.
 *
 * Crunchyrolls Kalender zeigt je Tag nur die neueste Folge; kamen 10–12 gemeinsam,
 * steht nur „12" da, und 10 und 11 blieben ohne Tag (Hana-Kimi Staffel 2, 02.10.2026:
 * „11 von 13"). Der Vermerk weiß es: Er wurde von genau dieser Beobachtung geschlossen.
 */
export function nachgereichteFolgen(verpasst: ReturnType<typeof verpasstAmTermin>): Record<number, string> {
  return Object.fromEntries(
    Object.entries(verpasst ?? {})
      .filter(([, v]) => v.erschienenAm)
      .map(([nr, v]) => [Number(nr), toIsoDate(new Date(v.erschienenAm!))]),
  )
}
