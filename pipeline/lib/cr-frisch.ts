/**
 * Ob die gelesene Seite einer Crunchyroll-Serie noch gilt oder neu drankommt (aus `scrape-crunchyroll-dub.ts`, unverändert herausgelöst,
 * damit die Entscheidung ohne Browser und Abruf testbar ist).
 */
import type { CrSerie } from './crunchyroll-dub.ts'

/** Eine gelesene Serie samt den Folgenkennungen aus `data/crunchyroll-neu.json`, die beim Lesen schon vorlagen. */
export type CrSerieMitFolgen = CrSerie & { neuFolgen?: string[] }

/** Je Serienkennung die Kennungen (GUID) ihrer deutschen Folgen aus dem Katalogfund. */
export function neuFolgenJeSerie(folgen: { serieId?: string; guid?: string }[]): Map<string, string[]> {
  const jeSerie = new Map<string, string[]>()
  for (const f of folgen) {
    if (!f.serieId || !f.guid) continue
    jeSerie.set(f.serieId, [...(jeSerie.get(f.serieId) ?? []), f.guid])
  }
  return jeSerie
}

/**
 * Hält fest, welche Folgen beim Lesen schon bekannt waren. Nur bei einer echten Antwort: Eine Nichtauskunft soll die Serie nicht
 * als „auf dem Stand“ ausweisen (sie kommt über die Frist wieder dran).
 */
export function merkeNeuFolgen(serie: CrSerie, guids: string[] | undefined): CrSerieMitFolgen {
  return serie.fehler || !guids?.length ? serie : { ...serie, neuFolgen: guids }
}

/**
 * Legt eine gelesene Serie im Bestand ab (aus `main()` des Dub-Laufs herausgelöst, damit der Speicherpfad ohne Browser läuft).
 * Ein Fehlersatz überschreibt keinen guten Eintrag (17.09.2026): Der alte Stand bleibt samt Prüfdatum, die Serie kommt bald wieder dran.
 * `neuFolgen` ist der Katalogfund je Serienkennung; abgelegt werden die Kennungen dieser Serie.
 */
export function serieAblegen(
  bestand: Map<string, CrSerie>,
  url: string,
  serie: CrSerie,
  seriesId: string,
  neuFolgen: Map<string, string[]>,
): 'abgelegt' | 'behalten' {
  const vorherige = bestand.get(url)
  if (serie.fehler && vorherige && !vorherige.fehler) return 'behalten'
  bestand.set(url, merkeNeuFolgen(serie, neuFolgen.get(seriesId)))
  return 'abgelegt'
}

export interface FrischKontext {
  /** Region des Zugangs, mit dem gerade gefragt wird (`de`), oder keiner. */
  katalogJetzt?: string
  /** Je Serienkennung der Tag, ab dem eine neue deutsche Folge oder eine Kachel vorliegt. */
  neuSeit: Map<string, string>
  /** Je Serienkennung die Folgenkennungen des Katalogfunds (`neuFolgenJeSerie`). */
  neuFolgen: Map<string, string[]>
  nurNeu: boolean
  nurFehler: boolean
  /** Frühester Tag, an dem ein Befund dieser Adresse noch gilt (ihre eigene Frist). */
  befundGrenze: string
  /** Frühester Tag, an dem eine Nichtauskunft noch gilt. */
  fehlerGrenze: string
}

export function crFrisch(s: CrSerieMitFolgen, k: FrischKontext): boolean {
  /**
   * Ein Befund aus einem anderen Katalog ist keiner — egal wie jung er ist.
   *
   * Der Lauf vom 21.08.2026 lief von einem US-Runner und schrieb 172 Serien
   * mit `katalog: "us"` fort. Diese Antworten sind nicht *veraltet*, sie
   * beantworten eine **andere Frage**: „Fairy Tail" hat in Deutschland 277
   * deutsche Folgen und in der US-Antwort keine einzige. Die Frist schützte
   * sie trotzdem — vier Wochen lang wäre die falsche Auskunft stehen
   * geblieben, obwohl ein deutscher Zugang längst da war.
   *
   * Deshalb entscheidet der Katalog **vor** dem Datum: Was aus einer anderen
   * Region stammt als der Zugang, mit dem wir gerade fragen, kommt neu dran.
   */
  if (k.katalogJetzt && s.katalog && s.katalog !== k.katalogJetzt) return false
  /* Seit dem letzten Blick ist dort eine deutsche Folge dazugekommen. */
  const neuAm = s.seriesId ? k.neuSeit.get(s.seriesId) : undefined
  if (neuAm && (s.geprueftAm ?? '') < neuAm) return false
  /*
    Das Datum allein übersieht die zweite Folge desselben Tages (Doppelstart): Ihr Fundtag ist nicht später als der letzte Blick.
    Steht eine Kennung im Katalogfund, die der letzte Blick nicht kannte, kommt die Serie dran. Ohne gemerkte Kennungen
    (Stand vor dieser Regel, oder Nichtauskunft) bleibt es beim Datum.
  */
  const bekannt = s.neuFolgen
  if (bekannt && s.seriesId && k.neuFolgen.get(s.seriesId)?.some((g) => !bekannt.includes(g))) return false
  /*
    Beim täglichen Lauf zählt nur genau das: Alles andere gilt als frisch,
    auch wenn seine Frist längst abgelaufen ist. Der Wochenlauf holt es nach.
  */
  if (k.nurNeu) return true
  if (k.nurFehler) return !s.fehler
  /**
   * „Nicht verfügbar" ist ein Befund, „hat nicht geantwortet" ist keiner.
   *
   * Beide tragen einen `fehler` — bei `nichtVerfuegbar` ist er die Zeile, mit
   * der Crunchyroll selbst sagt, dass es das Angebot nicht mehr gibt. Alles
   * andere mit `fehler` ist eine Nichtauskunft und kommt früher wieder dran.
   */
  const befund = s.nichtVerfuegbar === true || !s.fehler
  return s.geprueftAm >= (befund ? k.befundGrenze : k.fehlerGrenze)
}
