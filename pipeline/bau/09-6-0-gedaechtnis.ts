import { addDays, todayIso } from '../../shared/time.ts'
import { NEIN_GILT_TAGE, NUR_DIESER_TITEL, type EntfernterVerweis } from './grundlagen.ts'
import { readJson } from '../lib/util.ts'

export function frueherEntfernteWege({ adressKern, verweiseEntfernt }: {
  adressKern: (u: string) => string
  verweiseEntfernt: EntfernterVerweis[]
}) {
  /*
    **Das Gedächtnis reicht bis in diesen Lauf hinein.**

    `data/verweise-entfernt.json` trägt den Stand des **letzten** Laufs; was
    wenige Zeilen weiter oben gerade als belegtes Nein entfernt wurde, steht
    dort noch nicht. Ohne `verweiseEntfernt` legte derselbe Lauf also wieder
    an, was er selbst eben verworfen hat — das Flattern, gegen das dieser
    Riegel gebaut ist, entstünde innerhalb einer einzigen Ausführung.
  */
  /**
   * **Ein belegtes Nein gilt 28 Tage, nicht für immer.**
   *
   * Der Riegel hielt einen einmal entfernten Verweis dauerhaft draußen. Das
   * ist gegen das Flattern zwischen zwei Läufen richtig — und gegen die
   * Wirklichkeit falsch, denn ein Anbieter nimmt eine deutsche Fassung auch
   * **auf**.
   *
   * Belegt an „Kill Blue" (07.09.2026, von Daniel gemeldet): Am 24.08. führte
   * Crunchyroll dort null deutsche Folgen, der Verweis flog zu Recht heraus.
   * Am **06.09.** erschienen die Folgen 1–8 auf Deutsch — und der Kalender
   * zeigte weiter keinen Crunchyroll-Weg. Das ist die schlimmste Art Fehler,
   * die diese Seite machen kann: Sie behauptet nicht zu wenig, sondern das
   * Gegenteil.
   *
   * **Dieselbe Regel steht seit dem 15.08.2026 in `CLAUDE.md`**, nur für
   * Warteschlangen: „Jede Warteschlange wird nach dem Alter gebildet, nie
   * nach ‚schon beantwortet'." Das Gedächtnis war die Stelle, an der sie nie
   * angewandt wurde — und es ist dieselbe Begründung: Verliert ein Dienst die
   * Lizenz, verschwindet die Fassung; bekommt er sie, erscheint sie.
   *
   * **28 Tage** sind dieselbe Frist, die `scrape-crunchyroll-dub.ts` für die
   * Wiedervorlage nutzt. Sie ist lang genug, dass kein Lauf gegen den
   * nächsten flattert, und kurz genug, dass eine neue Synchro binnen eines
   * Monats ankommt.
   *
   * **Einträge ohne Datum gelten als alt** — sie stammen aus der Zeit vor
   * diesem Feld, und ihr Nein ist entsprechend ungeprüft. Sie kommen damit
   * beim nächsten Bau alle einmal zurück in die Prüfung; das ist gewollt.
   */
  const neinGrenze = addDays(todayIso(), -NEIN_GILT_TAGE)
  /**
   * **Manche Gründe gelten der Adresse, manche nur einem Titel an ihr.**
   *
   * Eine tote Adresse ist für jeden Titel tot. „Beim Anbieter ist kein Platz"
   * und „die Adresse zeigt auf eine andere Reihe" betreffen dagegen genau den
   * Titel, der entfernt wurde. Bis zum 11.09.2026 merkte sich das Gedächtnis
   * nur die Adresse, und bei Sword Art Online flatterte die Prüfliste deshalb
   * von Bau zu Bau: Ein Lauf legte SAO II den Netflix-Weg an, die Platzprüfung
   * warf War of Underworld und Part 2 unter derselben Adresse zu Recht hinaus
   * — und der nächste Lauf hielt die Adresse für entfernt und legte SAO II
   * nicht mehr an. Ohne SAO II war kein Platz voll, War of Underworld blieb,
   * und die Liste fragte wieder nach Folgen, die Daniel am 06.09. gemessen hat.
   */
  /*
    „belegtes Nein" gehört seit dem 17.09.2026 dazu: Das Urteil gilt einem
    Titel, nicht der Adresse. Princess Principal: Kapitel 3 und 4 sind an der
    Serienadresse nicht deutsch, Kapitel 1 und 2 schon — die Sperre für die
    Adresse nahm den beiden deutschen Filmen ihren Weg. Ein Geschwister, das
    die Adresse bekommt, wird selbst beurteilt und bei einem Nein wieder
    entfernt. Gemessen: außer diesen Filmen kein weiterer Titel betroffen
    (nach dem YouTube-Fix in `adressKern()`).
  */
  const merkeSchluessel = (e: { titleId?: number; url?: string; grund?: string }) =>
    NUR_DIESER_TITEL.test(e.grund ?? '') ? `${e.titleId}|${adressKern(e.url ?? '')}` : adressKern(e.url ?? '')
  const frueherEntferntRoh = new Set([
    ...(readJson<{ verweise?: { titleId?: number; url?: string; grund?: string; entferntAm?: string | null }[] }>(
      'data/verweise-entfernt.json',
      {},
    ).verweise?.filter((e) => (e.entferntAm ?? '') >= neinGrenze).map(merkeSchluessel) ?? []),
    /* Was dieser Lauf selbst gerade verworfen hat, bleibt ohne Frist draußen. */
    ...verweiseEntfernt.map(merkeSchluessel),
  ])
  const frueherEntfernt = {
    has: (kern: string, titleId: number) => frueherEntferntRoh.has(kern) || frueherEntferntRoh.has(`${titleId}|${kern}`),
  }
  return { frueherEntfernt }
}
