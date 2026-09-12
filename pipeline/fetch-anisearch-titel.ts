/**
 * **Deutsche Titel für Anime ohne belegte Synchro.**
 *
 * Anlass (Daniel, 31.08.2026): „Ein Landei aus dem Dorf vor dem letzten Dungeon
 * sucht das Abenteuer in der Stadt" läuft bei Prime, war in unserer Datenbank
 * aber nicht zu finden. Der Titel steht als AniList 112649 in
 * `ohne-synchro.json` — ohne deutschen Namen, denn AniList führt keine, und
 * geholt wurden sie bisher nur für die rund 2.700 kuratierten Titel.
 *
 * Sein Urteil: „anilist ist müll, die bessere quelle ist anisearch."
 *
 * **Gemessen, bevor umgestellt wurde** (die Zahlen stehen in `status.md`):
 *
 * - aniSearch 14694 führt exakt den Titel, den auch Prime zeigt.
 * - Die ID-Brücke aus `data/anime-ids.json` deckt 11.609 der 15.119 Titel ab.
 * - TMDB kennt denselben Titel und wäre mit 28 Abrufen je Sekunde viel
 *   schneller — hat aber **keine** ID-Brücke. Über die Namenssuche blieben 28
 *   von 50 Stichproben ohne Treffer, und „Dream" wurde zu „Traum Studios".
 *   Ein Falschtreffer bringt einen erfundenen deutschen Titel in den Bestand.
 *
 * Deshalb aniSearch über die Kennung, im Takt von zwei Sekunden: Am 09.08.2026
 * hat ein zu schneller Lauf die IP gesperrt, und das traf auch Daniel selbst.
 *
 * Aufruf: `tsx pipeline/fetch-anisearch-titel.ts [--limit N] [--alle]`
 * Ohne `--alle` kommen nur TV/ONA ab 2015 dran — dort laufen die Titel, die bei
 * einem Anbieter zu sehen sind und deshalb überhaupt einen deutschen Namen
 * tragen (Daniel: „erstmal alle ab 2015, danach den rest").
 */
import { titelAus, type Titelherkunft } from './lib/anisearch-titel.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'

const UA = 'anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)'
const TAKT_MS = 2000
/* `--limit` heißt es in allen anderen Läufen — dieselbe Schreibweise spart eine Fehlerquelle. */
const GRENZE = Number(/--limit[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 2500)
const ALLE = process.argv.includes('--alle')

interface OhneSynchro {
  id: number
  titleRomaji?: string
  titleEn?: string
  titleDe?: string
  format?: string
  jpYear?: number
}
interface Titeleintrag {
  /** Wie der Titel bei aniSearch heißt — der deutsche Name, wo es einen gibt. */
  titel: string
  /**
   * **Woher der Name stammt — und ob er überhaupt deutsch ist.**
   *
   * `sprachblock` und `synonym` sind belegt deutsch, `ueberschrift` ist es
   * nicht: Die `<h1 id="htitle">` trägt keine Sprachkennzeichnung und nennt bei
   * einem Titel ohne deutsche Veröffentlichung schlicht den japanischen Namen.
   *
   * Fehlt das Feld ganz, stammt der Eintrag aus einem Lauf vor dem 08.09.2026
   * und ist von unbekannter Herkunft.
   */
  quelle?: Titelherkunft
  /** Der englische Name laut aniSearch — nur gesetzt, wo die Seite einen führt. */
  englisch?: string
  /**
   * **Die Synonyme der Seite, roh.**
   *
   * aniSearch kennzeichnet sie nicht nach Sprache: Beim Apothekerin-Film
   * stehen dort „Die Tagebücher der Apothekerin: Der Film", „Les Carnets de
   * l'Apothicaire : Le Film" und „Los diarios de la boticaria: La película"
   * nebeneinander. Hier entsteht deshalb kein Urteil — der Bau erkennt den
   * deutschen daran, dass er mit dem belegten deutschen Reihennamen beginnt.
   *
   * Der Titel fiel bis zum 12.09.2026 durch alle drei Maschen: kein deutscher
   * Sprachblock, und der Synonym-Zweig sucht Staffelnamen („Staffel" plus
   * Ziffer), was einen Filmtitel nie trifft.
   */
  synonyme?: string[]
  anisearchId: number
  fetchedAt: string
  /**
   * **Mit welchem Stand des Auslesers dieser Eintrag entstanden ist.**
   *
   * Ein Eintrag ohne Feld, das der Ausleser heute kennt, ist von einem
   * Eintrag, dessen Seite dieses Feld nicht führt, nicht zu unterscheiden —
   * und weil die Frist 180 Tage beträgt, kommt er bis dahin nicht wieder
   * dran. Genau das ist am 12.09.2026 passiert: Der Lauf holte 1.200 Seiten,
   * und keine einzige trug den englischen Namen, den der Ausleser seit
   * demselben Vormittag mitliest.
   *
   * Ein Stand, der hinter dem aktuellen liegt, macht fällig. Das ist derselbe
   * Hebel wie „ein bekannter Fund wird ergänzt, nicht übersprungen" bei den
   * Crunchyroll-Neuzugängen, nur für einen Lauf, der ganze Seiten neu holen
   * muss statt ein Feld nachzutragen.
   */
  stand?: number
}

/** Hochzählen, sobald `titelAus()` ein Feld mehr liest. 2 = englischer Sprachblock. */
/*
  **3 seit dem 12.09.2026: Der Ausleser liest jetzt die Synonyme mit.**

  Ohne diese Erhöhung bliebe der Einbau wirkungslos: Alle 979 Katalogtitel in
  Reihen mit deutschem Namen sind längst geholt — nur eben von einem Ausleser,
  der das Feld noch nicht kannte. Bei einer Frist von 180 Tagen kämen sie erst
  im März wieder dran.

  Das ist derselbe Fall, den der Kommentar am Feld `stand` schon beschreibt,
  und das zweite Mal an einem Tag: vormittags für den englischen Namen,
  abends für die Synonyme.
*/
const PARSER_STAND = 3

const bruecke = readJson<{ anisearch: Record<string, number> }>('data/anime-ids.json', {
  anisearch: {},
}).anisearch
const bestand = readJson<Record<string, Titeleintrag>>('data/anisearch-titel.json', {})
const ohne = readJson<OhneSynchro[]>('public/data/ohne-synchro.json', [])
/*
  **Warum der Hauptbestand hier NICHT drinsteht — am 01.09.2026 versucht und
  widerlegt.**

  Naheliegend war: 139 Titel mit belegter Synchro tragen keinen deutschen Namen,
  56 davon haben eine aniSearch-Kennung, also holen wir sie. Der Lauf ist
  durchgelaufen, der Bau hat 30 davon übernommen — und das Ergebnis war
  schlechter als die Lücke:

      Yu☆Gi☆Oh!                       ->  „Yuu Gi Ou"
      Mobile Suit Gundam Wing          ->  „Gundam Wing Endless Waltz OVA"
      Pocket Monsters Diamond & Pearl  ->  „Pocket Monsters: Diamond &amp; Pearl …"

  Romaji, englische Namen, HTML-Entities. **Die `<h1 id="htitle">` einer
  aniSearch-Seite ist der Haupttitel, nicht der deutsche** — sie trägt keine
  Sprachkennzeichnung, und aniSearch wählt dort die gebräuchlichste Schreibweise.

  Für den Katalog hinter dem Toggle ist das trotzdem ein Gewinn: Dort steht
  sonst gar nichts, und ein Romaji-Titel ist besser als keiner. Im Hauptbestand
  überschreibt er die Suche mit einem Namen, unter dem niemand sucht.

  Wer einen deutschen Titel für den Hauptbestand will, nimmt `info.languages`
  aus dem großen aniSearch-Abruf (dort steht die Sprache dabei) oder TMDB mit
  `language=de-DE` — beides liest `build.ts` bereits.
*/

if (!Object.keys(bruecke).length) {
  warn('Keine aniSearch-Kennungen in data/anime-ids.json — erst `data:anisearch` laufen lassen.')
  process.exit(0)
}

/**
 * **Die Reihenfolge ist die Entscheidung.**
 *
 * Neuere Serien zuerst, denn ein deutscher Titel entsteht, wenn ein Anbieter
 * den Anime hierzulande zeigt. Bei einer Serie von 1979 gibt es meistens keinen,
 * und der Abruf kostet trotzdem zwei Sekunden.
 */
/*
  **Der Jahresfilter gilt dem Katalog, nicht dem Hauptbestand.**

  „Erstmal alle ab 2015, danach den rest" galt fuer 15.000 Katalogtitel, von
  denen die meisten nie in Deutschland liefen — dort spart die Regel Stunden.
  Ein Titel mit belegter deutscher Synchro ist der andere Fall: Er laeuft hier,
  er steht im Kalender, und sein Jahr sagt darueber nichts. „Hunter x Hunter"
  (1999) und „Yu☆Gi☆Oh!" (1998) waeren sonst nie an der Reihe.
*/
/*
  **Wer in einer Reihenliste steht, ist sichtbar — egal welches Format, egal
  welches Jahr.**

  Der Jahresfilter darüber spart Stunden bei Titeln, die niemand zu Gesicht
  bekommt. Reihenmitglieder sind der Gegenfall: Sie stehen im Detail-Panel eines
  Titels **mit** deutscher Synchro, unter „Teile in dieser Reihe", und dort las
  ein Besucher am 03.09.2026 „Tensei Shitara Slime datta Ken: Sukuwareru
  Ramiris" — mitten in einer Liste, die sonst „Staffel 3", „Staffel 4" sagt.

  Gemessen am selben Tag: **2.158 Reihenmitglieder stammen aus dem Katalog, 1.964
  von ihnen ohne deutschen Namen.** Es sind fast alles Specials, OVAs und Filme
  — genau die Formate, die der Filter aussortiert („Cowboy Bebop: Yoseatsume
  Blues", „NARUTO: Akaki Yotsuba no Clover wo Sagase").

  Sie kommen deshalb ohne Ansehen von Format und Jahr in die Warteschlange, und
  zwar **vorn**: Ein sichtbarer Titel wiegt mehr als ein neuer, den niemand
  öffnet.
*/
const inReihe = new Set<number>()
for (const teile of Object.values(
  readJson<Record<string, { id: number }[]>>('public/data/franchises.json', {}),
)) {
  for (const teil of teile) inReihe.add(teil.id)
}

/**
 * **Fällig wird über das Alter, nicht über „steht noch nicht da".**
 *
 * Ein Filter der Form „hole, was fehlt" macht jede Antwort endgültig — die
 * Regel steht in CLAUDE.md, und dieser Lauf hat sie bis zum 08.09.2026
 * verletzt. Sie hat genau das gekostet, was sie verhindern soll: Die 3.531
 * Einträge aus der alten Überschriften-Lesung wären nie wieder drangekommen,
 * und mit ihnen die 715 japanischen Namen, die dort als deutsche stehen.
 *
 * Ein Eintrag ist fällig, wenn er
 *   - keine Herkunft trägt (Altbestand, Sprache unbekannt),
 *   - nur die Überschrift kennt (ein Sprachblock kann inzwischen da sein —
 *     eine Staffel erscheint hier später), oder
 *   - älter ist als `--alter` Tage.
 *
 * Ein belegter deutscher Sprachblock ändert sich dagegen praktisch nie; er
 * kommt nur über die Frist wieder dran.
 */
const ALTER_TAGE = Number(/--alter[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 180)
const faellig = (t: { id: number }): boolean => {
  const e = bestand[String(t.id)]
  if (!e) return true
  if ((e.stand ?? 1) < PARSER_STAND) return true
  if (!e.quelle || e.quelle === 'ueberschrift') return true
  const alter = (Date.now() - Date.parse(e.fetchedAt)) / 86_400_000
  return !(alter < ALTER_TAGE)
}

const warteschlange = ohne
  .filter((t) => bruecke[String(t.id)] && faellig(t))
  .filter(
    (t) => ALLE || inReihe.has(t.id) || (['TV', 'ONA'].includes(t.format ?? '') && (t.jpYear ?? 0) >= 2015),
  )
  .sort((a, b) => {
    const r = Number(inReihe.has(b.id)) - Number(inReihe.has(a.id))
    return r !== 0 ? r : (b.jpYear ?? 0) - (a.jpYear ?? 0)
  })

log(`${warteschlange.length} Titel offen, davon kommen ${Math.min(GRENZE, warteschlange.length)} dran`)

let geholt = 0
let neu = 0
let deutsch = 0
for (const t of warteschlange.slice(0, GRENZE)) {
  const asId = bruecke[String(t.id)]!
  try {
    const antwort = await fetch(`https://www.anisearch.de/anime/${asId}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
      redirect: 'follow',
    })
    if (!antwort.ok) {
      warn(`aniSearch ${asId} (AniList ${t.id}): HTTP ${antwort.status}`)
      /* Eine Sperre erkennt man daran, dass sie nicht aufhört — dann abbrechen. */
      if (antwort.status === 403 || antwort.status === 429) {
        warn('Abbruch: aniSearch weist ab. Der Rest kommt im nächsten Lauf.')
        break
      }
      continue
    }
    const fund = titelAus(await antwort.text())
    if (fund) {
      bestand[String(t.id)] = {
        titel: fund.titel,
        quelle: fund.quelle,
        englisch: fund.englisch,
        /*
          **Die Synonyme, weil der deutsche Name oft nur dort steht.** Für den
          Apothekerin-Film führt aniSearch keinen deutschen Sprachblock, aber
          ein Synonym „Die Tagebücher der Apothekerin: Der Film". Welches davon
          deutsch ist, entscheidet der Bau am belegten Reihennamen — hier wird
          nur aufgehoben, was er dafür braucht.
        */
        synonyme: fund.synonyme?.length ? fund.synonyme.slice(0, 12) : undefined,
        anisearchId: asId,
        fetchedAt: new Date().toISOString(),
        stand: PARSER_STAND,
      }
      neu++
      if (fund.quelle !== 'ueberschrift') deutsch++
    }
    geholt++
    if (geholt % 100 === 0)
      log(`  ${geholt}/${Math.min(GRENZE, warteschlange.length)} — zuletzt „${fund?.titel ?? '—'}"`)
  } catch (err) {
    warn(`aniSearch ${asId}: ${(err as Error).message}`)
  }
  await sleep(TAKT_MS)
}

writeJson('data/anisearch-titel.json', bestand, true)
log(
  `${geholt} Seiten geholt, ${neu} Titel gesichert (${deutsch} davon belegt deutsch), ` +
    `${Object.keys(bestand).length} insgesamt`,
)
