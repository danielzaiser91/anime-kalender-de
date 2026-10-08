/**
 * Holt den **gesamten** Anime-Bestand von AniList — auch das, was keine
 * deutsche Synchro hat.
 *
 * Warum ein Kalender für deutsche Synchronfassungen Titel führt, die keine
 * haben: Weil genau dort das Warten stattfindet. „Ich sehe
 * Serien, die großartig sind und keine deutsche Synchro haben, und ich prüfe
 * unablässig nach, immer wieder, und werde immer enttäuscht." Wer so einen
 * Titel merken kann, hört auf, von Hand nachzusehen — die Seite meldet sich,
 * sobald es etwas zu melden gibt. Das ist keine Erweiterung des Projektziels,
 * sondern sein fünfter Punkt („Rechtzeitig Bescheid geben"), angewandt auf die
 * Titel, bei denen das Warten am meisten weh tut.
 *
 * **Nur das Nötigste.** Zu diesen Titeln wissen wir nichts über deutsche
 * Fassungen — es gibt keine. Gespeichert wird deshalb nur, was zum Finden und
 * Wiedererkennen reicht: Kennung, die drei Titel, Format, Jahr, Folgenzahl,
 * Genres, Bewertung, Cover. Keine Beschreibungen, keine Verweise, keine
 * Beziehungen. Sobald eine Synchro auftaucht, wandert der Titel ohnehin in den
 * gepflegten Bestand und wird dort vollständig geholt.
 *
 * **Zerlegt nach Startjahr, plus ein Nachlauf.** AniList lässt je Abfrage nur
 * 5.000 Einträge durchblättern; der Bestand ist größer. Jedes Jahr bleibt weit
 * unter der Grenze. Titel **ohne** Startdatum fallen dabei durch — die sammelt
 * der Nachlauf über die jüngsten Kennungen ein, denn undatiert sind fast
 * ausschließlich frisch angelegte Ankündigungen.
 *
 * Rate Limit: derselbe Client wie überall (`lib/anilist.ts`), 90 Anfragen je
 * Minute laut Doku, mit Auswertung der Header. Rund 600 Abfragen je Volllauf,
 * also etwa zehn Minuten.
 *
 * Aufruf: npm run data:katalog              (setzt fort, überspringt fertige Jahre)
 *         npm run data:katalog -- --neu     (von vorn)
 *         npm run data:katalog -- --frisch  (nur laufendes und kommende Jahre plus die jüngsten
 *                                            10 Seiten Kennungen; läuft täglich, ~30 Abfragen)
 */
import { FRANCHISE_RELATIONS } from '../shared/mappings.ts'
import { katalogSeite, type KatalogEintrag } from './lib/anilist.ts'
import { planeKatalogLauf } from './lib/katalog-plan.ts'
import { log, readJson, warn, writeJson } from './lib/util.ts'

interface Katalog {
  geholtAm: string
  /** Jahre, die vollständig durchgeblättert wurden — für den Wiederaufsatz. */
  fertigeJahre: number[]
  /**
   * Welche Beziehungsarten in `rel` stecken — als Fingerabdruck.
   *
   * Der Cache wusste bisher nicht, dass er veralten kann. Am 03.09.2026 kam
   * `OTHER` zu `FRANCHISE_RELATIONS` hinzu (der Apothekerin-Film hängt genau
   * so an seiner Staffel). Lokal half ein `--neu`; in der CI liegt der Katalog
   * in einem Actions-Cache, und der Wochenlauf setzt darauf auf — er hätte
   * die alten `rel`-Listen bis in alle Ewigkeit weitergereicht, ohne dass
   * etwas rot geworden wäre.
   *
   * Stimmt der Fingerabdruck nicht mehr, gilt **kein** Jahr als fertig: Der
   * nächste Lauf holt alles neu. Das kostet einmalig zehn Minuten und ist der
   * einzige Weg, der ohne einen Menschen auskommt, der daran denkt.
   */
  relFassung?: string
  eintraege: KatalogEintrag[]
}

/**
 * Sortiert, damit die Reihenfolge im Set den Fingerabdruck nicht ändert.
 *
 * Der Zusatz zählt die **Regel** mit, nicht nur die Liste: `OTHER` steht nicht
 * in `FRANCHISE_RELATIONS`, wird aber beim Abruf ausgewertet, wenn die Namen
 * zusammenpassen (`otherZaehlt`). Ändert sich diese Schwelle, muss der Katalog
 * genauso neu geholt werden — ohne den Zusatz wäre der Fingerabdruck derselbe
 * geblieben und der Cache hätte eine Regel weitergereicht, die es nicht mehr
 * gibt.
 */
/**
 * **Der Fingerabdruck des Caches — er zählt die Abfrage mit, nicht nur die Regel.**
 *
 * Am 29.09.2026 kam `idMal` in die Abfrage (der MAL-Absprung im Panel braucht die Kennung, siehe
 * `pipeline/lib/anilist.ts`). Der Cache hätte die alten Einträge ohne `mal` bis in alle Ewigkeit
 * weitergereicht — genau der Fall, für den es diesen Fingerabdruck seit dem 03.09.2026 gibt: Wer die
 * **Frage** ändert, muss den Cache verwerfen. `+mal-1` ist der Zusatz, der das beim nächsten Lauf
 * auslöst (einmalig alles neu, rund zehn Minuten).
 */
const REL_FASSUNG = `${[...FRANCHISE_RELATIONS].sort().join(',')}+other-namen-8-character-10+eltern+mal-1`

const DATEI = 'data/cache/anilist-katalog.json'
/** Erster Jahrgang mit nennenswertem Bestand. Davor gibt es einzelne Kurzfilme. */
const AB_JAHR = 1907

const args = process.argv.slice(2)
const NEU = args.includes('--neu')
const FRISCH = args.includes('--frisch')
/** Seiten à 50 Kennungen im Frischlauf — 500 jüngste Kennungen decken mehrere Wochen Neuanlagen. */
const FRISCH_SEITEN = 10

async function main(): Promise<void> {
  const vorhanden = NEU ? undefined : readJson<Katalog | undefined>(DATEI, undefined)
  const bekannt = new Map<number, KatalogEintrag>((vorhanden?.eintraege ?? []).map((e) => [e.id, e]))
  const plan = planeKatalogLauf({
    vorhanden, frischGewuenscht: FRISCH, relFassung: REL_FASSUNG, jahr: new Date().getFullYear(), abJahr: AB_JAHR, frischSeiten: FRISCH_SEITEN,
  })
  if (plan.ueberspringen) return warn('Frischlauf ohne vorhandenen Katalog übersprungen - der Wochenlauf holt ihn')
  const { frisch, veraltet } = plan
  const fertig = new Set(plan.fertig)
  if (veraltet && !frisch) {
    log(
      'Der Fingerabdruck des Katalogs hat sich geändert - alle Jahre werden neu geholt ' +
        `(Cache: ${vorhanden?.relFassung ?? 'ohne Angabe'})`,
    )
  }
  if (bekannt.size) log(`Katalog: ${bekannt.size} Einträge bekannt, ${fertig.size} Jahre bereits fertig`)

  // Drei Jahre über das laufende hinaus: Angekündigtes hat oft schon ein Datum.
  const bisJahr = new Date().getFullYear() + 3
  let abfragen = 0

  for (let jahr = plan.ersteJahr; jahr <= bisJahr; jahr++) {
    // Das laufende und die kommenden Jahre nie als „fertig" abhaken — dort
    // kommen laufend Titel dazu.
    const dauerhaftFertig = jahr < new Date().getFullYear()
    if (dauerhaftFertig && fertig.has(jahr)) continue

    let seite = 1
    let imJahr = 0
    for (;;) {
      let ergebnis
      try {
        // FuzzyDateInt ist YYYYMMDD. `-1` und der 1. Januar des Folgejahres
        // machen die Grenzen einschließend.
        ergebnis = await katalogSeite(seite, jahr * 10000 - 1, (jahr + 1) * 10000)
      } catch (err) {
        warn(`Jahr ${jahr}, Seite ${seite}: ${(err as Error).message}`)
        break
      }
      abfragen++
      for (const e of ergebnis.eintraege) bekannt.set(e.id, e)
      imJahr += ergebnis.eintraege.length
      if (!ergebnis.weiter) {
        if (dauerhaftFertig) fertig.add(jahr)
        break
      }
      seite++
      if (seite > 100) {
        warn(`Jahr ${jahr} sprengt die Blättergrenze — hier fehlen Titel`)
        break
      }
    }
    if (imJahr) log(`  ${jahr}: ${imJahr} Titel (${bekannt.size} insgesamt)`)
    if (abfragen % 20 < 2) sichern(bekannt, fertig, plan.relFassung)
  }

  const hoechsteId = await nachlauf(bekannt, plan.nachlaufSeiten)

  sichern(bekannt, fertig, plan.relFassung)
  log(`Katalog: ${bekannt.size} Anime insgesamt`)
  await pruefeJuengste(bekannt, hoechsteId)
}

/**
 * Nachlauf über die jüngsten Kennungen; liefert die höchste gesehene Kennung.
 *
 * Titel ohne Startdatum haben keinen Jahrgang und fallen durch die Zerlegung nach Jahren. Ein
 * Filter „Datum ist leer" existiert bei AniList nicht — wohl aber die Sortierung nach Kennung
 * absteigend, und undatierte Einträge sind fast ausschließlich frisch angelegte Ankündigungen.
 * Ohne Formatfilter: Ankündigungen ohne Format (Maiden Blood, 09.10.2026) fielen sonst durch.
 */
async function nachlauf(bekannt: Map<number, KatalogEintrag>, seiten: number): Promise<number> {
  let neu = 0
  let hoechsteId = 0
  for (let seite = 1; seite <= seiten; seite++) {
    let ergebnis
    try {
      ergebnis = await katalogSeite(seite, undefined, undefined, true, true)
    } catch (err) {
      warn(`Nachlauf, Seite ${seite}: ${(err as Error).message}`)
      break
    }
    for (const e of ergebnis.eintraege) {
      hoechsteId = Math.max(hoechsteId, e.id)
      if (!bekannt.has(e.id)) neu++
      bekannt.set(e.id, e)
    }
    if (!ergebnis.weiter) break
  }
  log(`Nachlauf über die jüngsten Kennungen: ${neu} zusätzliche Titel`)
  return hoechsteId
}

/**
 * Zusicherung: Die jüngsten Kennungen bei AniList stehen im Katalog.
 *
 * Stichprobe nach dem Lauf (zwei frische Seiten, 100 Kennungen). Fehlt ein Titel, den
 * `gehoertInKatalog` zulässt, ist der Katalog unvollständig — der Lauf endet rot. Kennungen über
 * `hoechsteId` sind erst während des Laufs entstanden und zählen nicht.
 */
async function pruefeJuengste(bekannt: Map<number, KatalogEintrag>, hoechsteId: number): Promise<void> {
  if (!hoechsteId) {
    warn('Zusicherung nicht prüfbar: der Nachlauf hat keine einzige Kennung geholt')
    process.exitCode = 1
    return
  }
  const fehlend: number[] = []
  for (let seite = 1; seite <= 2; seite++) {
    const { eintraege } = await katalogSeite(seite, undefined, undefined, true, true)
    for (const e of eintraege) if (e.id <= hoechsteId && !bekannt.has(e.id)) fehlend.push(e.id)
  }
  if (fehlend.length) {
    warn(`Zusicherung verletzt: ${fehlend.length} der 100 jüngsten AniList-Kennungen fehlen im Katalog (${fehlend.slice(0, 8).join(', ')})`)
    process.exitCode = 1
  } else {
    log('Stichprobe: die 100 jüngsten AniList-Kennungen stehen im Katalog')
  }
}

function sichern(bekannt: Map<number, KatalogEintrag>, fertig: Set<number>, relFassung: string | undefined): void {
  const katalog: Katalog = {
    geholtAm: new Date().toISOString(),
    fertigeJahre: [...fertig].sort((a, b) => a - b),
    relFassung,
    eintraege: [...bekannt.values()].sort((a, b) => a.id - b.id),
  }
  writeJson(DATEI, katalog, true)
}

await main()
