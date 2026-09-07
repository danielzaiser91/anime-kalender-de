/**
 * Von Hand geprüfte Synchro-Angaben je Anbieter.
 *
 * Die Pipeline kann eine deutsche Synchro nur dort belegen, wo eine Quelle sie
 * selbst nennt — ADN über den Sprachcode `vde`, Crunchyroll über „(Deutsch)"
 * im Kalender. Für YouTube, Netflix, Prime Video, RTL+ und Joyn gibt es keine
 * maschinenlesbare Auskunft; dort steht in der Oberfläche „🇩🇪 ?".
 *
 * `data/dub-confirmed.yaml` ist der Weg, aus einem Fragezeichen ein Häkchen zu
 * machen — durch tatsächliches Nachsehen, nicht durch Vermutung.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'
import { PLATFORMS, type PlatformId } from '../../shared/types.ts'
import { warn } from './util.ts'

export interface DubCheck {
  anilistId: number
  title?: string
  platform: PlatformId
  /** Deutsche Synchro dort vorhanden. Fehlt, wenn `available: false` gilt. */
  dub?: boolean
  /**
   * false, wenn der Titel dort gar nicht (mehr) zu haben ist.
   *
   * Der Unterschied zu `dub: false` ist keine Feinheit. „Videos nicht
   * verfügbar" oder eine Weiterleitung auf die Startseite heißt: Es gibt dort
   * **kein Angebot**. Ein „🇩🇪 ✕" behauptete dagegen ein Angebot ohne deutsche
   * Fassung — also etwas, das es nicht gibt. Solche Verweise werden entfernt
   * (Daniels Rückmeldung zu Batch 1, 12.08.2026: sechs von zehn geprüften
   * Verweisen waren tot, nicht untertitelt).
   */
  available?: boolean
  /**
   * Die richtige Adresse, falls die im Datensatz danebenliegt.
   *
   * Bei Prime Video ist das der Regelfall: Dort steht meist eine Suche, weil
   * weder AniList noch aniSearch eine belastbare Produktseite liefern. Wer
   * beim Prüfen die echte Seite offen hatte, trägt sie hier ein.
   */
  url?: string
  checkedAt: string
  note?: string

  /**
   * Wo in der Reihe der deutsche Ton liegt — wenn er nicht überall liegt.
   *
   * Bei Black Clover auf Netflix sind die Folgen 1 bis 155 deutsch, 156 bis 171
   * nicht. `dub` allein kann das nicht sagen; es steht dann auf `true` und
   * bedeutet „irgendwo in dieser Reihe gibt es deutschen Ton", die Bereiche
   * sagen, wo genau. Erzeugt aus Daniels Einzelmeldungen, siehe
   * `pipeline/lib/folgenbereiche.ts`.
   *
   * `checked` nennt die Folgen, für die eine echte Meldung vorliegt — alles
   * dazwischen ist gefolgert, und zwar nur zwischen **gleichen** Befunden.
   */
  dubRanges?: Array<{ from: number; to: number; dub: boolean; checked?: number[] }>
  /**
   * **Welchen Teil der Anbieter-Liste dieser Eintrag meint.**
   *
   * In den Nummern des Anbieters, nicht in unseren: Prime führt „Captain
   * Tsubasa (2018)" als 91 durchlaufende Folgen; unser Eintrag „Staffel 2 —
   * Die Junioren" sind davon 53 bis 91. Ohne die Angabe zählt jede Prüfung
   * 91 Folgen für eine Staffel, die 39 hat.
   */
  teilBereich?: { von: number; bis: number }
  /**
   * Der Titel steht **bewusst** nicht in unserem Bestand.
   *
   * Ein Beleg ohne Titel ist normalerweise ein Fehler — eine falsche Kennung
   * oder ein Titel, der herausgefallen ist. Genau dafür gibt es die Zusicherung
   * in `check-handbelege`.
   *
   * Es gibt aber den umgekehrten Fall: Daniel prüft einen Titel und stellt fest,
   * dass es **keine** deutsche Fassung gibt. Dann gehört er nicht in einen
   * Synchro-Kalender — der Beleg bleibt trotzdem wertvoll, weil er eine zweite
   * Prüfung derselben Sache verhindert und sofort gilt, falls der Titel später
   * dazukommt.
   *
   * Erste Fälle am 26.08.2026: „GTO: Great Teacher Onizuka" (43 Folgen auf drei
   * Anbietern, überall ohne Deutsch) und „Shonan Junai Gumi!" (fünf Teile).
   *
   * Das Feld wird von Hand gesetzt, nie von einem Lauf. Wer es setzt, sagt
   * damit: Ich weiß, dass der Titel fehlt, und das ist die Antwort.
   */
  nichtImBestand?: boolean
  /**
   * **Die zweite, unabhängige Quelle — nur damit wird aus einer Kanal-Meldung
   * ein Nein.**
   *
   * Bei einem Kanal-Titel zeigt Amazon die Tonspuren, die dem Betrachter
   * zugänglich sind; ohne das Abo fehlt die deutsche. Gemessen am 07.09.2026:
   * 45 solcher Meldungen ohne Deutsch, und bei **14** ist Deutsch anderweitig
   * belegt. Ein Nein allein daraus wäre in fast jedem dritten Fall falsch, und
   * `check:logic` verbietet es deshalb seit dem 29.08.2026.
   *
   * Es gibt aber den Fall, in dem eine zweite Quelle unabhängig dasselbe sagt —
   * bei „7th Time Loop" nennt JustWatch `audio: ja, pt` und führt Deutsch nur
   * unter den Untertiteln. Dann trägt das Nein.
   *
   * Wer dieses Feld setzt, sagt: **Ich habe eine zweite Quelle angesehen, und
   * hier steht, welche.** Freitext, aber nicht leer — die Zusicherung prüft nur
   * das Dasein, den Wert liest ein Mensch.
   */
  zweiteQuelle?: string
}

const DATEI = resolve(ROOT, 'data', 'dub-confirmed.yaml')

/**
 * Adressen vergleichen sich nur ohne Protokoll, Parameter und Schrägstrich —
 * und bei Amazon zusätzlich ohne den Pfadteil vor der Kennung: Dieselbe Ausgabe
 * steht dort als `/dp/<ASIN>` und als `/gp/video/detail/<ASIN>`.
 */
export function adressKern(u: string | undefined): string {
  if (!u) return ''
  const ohne = u
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('?')[0]!
    .replace(/\/$/, '')
    .toLowerCase()
  const asin = /\/(?:dp|gp\/video\/detail)\/([a-z0-9]{10,26})/.exec(ohne)?.[1]
  return asin ? `amazon:${asin}` : ohne
}

export function loadDubChecks(): DubCheck[] {
  if (!existsSync(DATEI)) return []
  const raw = yaml.load(readFileSync(DATEI, 'utf8'))
  if (!Array.isArray(raw)) return []
  const out: DubCheck[] = []
  for (const item of raw as DubCheck[]) {
    /**
     * Ein halb ausgefüllter Eintrag ist gefährlicher als keiner: Er nimmt den
     * Verweis aus der Prüfliste, ohne etwas zu belegen. Deshalb hier laut
     * meckern statt still überspringen.
     *
     * **Ein Eintrag, der nur eine Adresse trägt, ist aber nicht halb** — er
     * beantwortet eine andere Frage: *wo* die Staffel läuft, nicht *ob* sie
     * deutschen Ton hat. Bei My Hero Academia meldete Netflix seine sieben
     * Staffeln samt Längen, unser Datensatz kannte für fünf davon keinen
     * Verweis (22.08.2026). Diese fünf Adressen zu verwerfen, weil niemand die
     * Tonspur geprüft hat, hätte die Auskunft weggeworfen, die tatsächlich
     * vorlag. Die Synchro bleibt dann schlicht ungeprüft — wie vorher.
     */
    const traegtEtwas =
      typeof item?.dub === 'boolean' || item?.available === false || Boolean(item?.url)
    if (!item?.anilistId || !traegtEtwas) {
      warn(
        `dub-confirmed.yaml: Eintrag braucht dub: true/false, available: false oder eine url — übersprungen (${JSON.stringify(item)})`,
      )
      continue
    }
    if (!(item.platform in PLATFORMS)) {
      warn(`dub-confirmed.yaml: unbekannte Plattform "${item.platform}" bei ${item.anilistId}`)
      continue
    }
    if (!item.checkedAt) {
      warn(`dub-confirmed.yaml: ${item.anilistId}/${item.platform} ohne checkedAt`)
      continue
    }
    /**
     * **Zwei Ausgaben sind zwei Belege — verschmolzen wird nur, was dieselbe
     * Adresse meint.**
     *
     * Bis zum 07.09.2026 lief der Schlüssel über Titel und Plattform allein.
     * Prime führt denselben Anime aber regelmäßig zweimal, und die beiden
     * Ausgaben haben verschiedene Tonspuren:
     *
     * | Adresse | was sie ist | Deutsch |
     * |---|---|---|
     * | `B0CK5N448R` | Date a Live IV im Prime-Abo | ja |
     * | `B0CJJF26WZ` | derselbe Titel über den Crunchyroll-Kanal | nein |
     *
     * Beide Zeilen wurden zu einer verschmolzen, das `dub: true` gewann — und
     * färbte den Verweis, der auf die **Kanal**-Adresse zeigt. Daniel am
     * 07.09.2026: „staffel 4 und 5 wurden von mir gemeldet auf prime, und beide
     * haben dort keine synchro, also wieso steht da DE ✅??? … schlimmer
     * fehler". Er hatte recht, und die Meldung war seit dem 28.08. da.
     *
     * Dieselbe Lehre steht seit dem 25.08.2026 in `CLAUDE.md`, nur für die
     * andere Richtung: „Eine Amazon-Kennung zeigt auf eine Staffel, unsere
     * Titel-Kennung auf einen Anime." Wer zwei Angaben zu „derselben Serie"
     * zusammenlegt, muss zuerst prüfen, ob sie dieselbe Ausgabe meinen.
     *
     * **Ein Eintrag ohne Adresse gilt weiter für die ganze Plattform** — das
     * ist der Normalfall und die Mehrheit der 3.000 Belege.
     */
    const schluessel = `${dubKey(item.anilistId, item.platform)}|${adressKern(item.url)}`
    const vorhanden = out.findIndex(
      (x) => `${dubKey(x.anilistId, x.platform)}|${adressKern(x.url)}` === schluessel,
    )
    if (vorhanden >= 0) out[vorhanden] = verschmelze(out[vorhanden]!, item)
    else out.push(item)
  }
  return out
}

/** Schlüssel für den Abgleich: ein Anime auf einer Plattform. */
/**
 * Mehrere Zeilen zu demselben Verweis sind **Ergänzungen**, keine Konkurrenten.
 *
 * `build.ts` legt die Prüfungen in eine Map nach Titel und Plattform — dabei
 * überschrieb der letzte Eintrag alle früheren **vollständig**. Bei My Hero
 * Academia Staffel 7 standen am 22.08.2026 drei Zeilen: eine mit dem Befund aus
 * einer früheren Prüfung, eine mit der erschlossenen Netflix-Adresse, eine mit
 * Daniels Meldung samt Folgenbereich. Übrig blieb die letzte — und mit ihr
 * verschwand die Adresse, ohne die der Verweis gar nicht erst entsteht.
 *
 * Verschmolzen wird feldweise: Ein Wert ersetzt einen anderen, ein **fehlender**
 * Wert löscht nichts.
 *
 * **Welcher Wert gewinnt, entscheidet `checkedAt` — nicht die Reihenfolge in der
 * Datei.** Hier stand bis zum 24.08.2026 das Gegenteil, und es hat eine
 * Handprüfung verschluckt: Bei „Kill Ao"/Netflix trug Zeile 17740 Daniels
 * Prüfung vom 24.08. (Folge 1–4 deutsch), Zeile 17774 eine Meldung aus der
 * Erweiterung vom 23.08. (1–2 ja, 3–12 nein). Der ältere Befund stand weiter
 * hinten und gewann; der Datensatz zeigte hartnäckig den Stand vom Vortag,
 * obwohl der neuere Beleg unmittelbar darüber stand.
 *
 * Das ist kein Sonderfall, sondern der Normalfall: Die Datei wächst von zwei
 * Seiten — Meldungen aus der Erweiterung werden **angehängt**, Daniels
 * Prüfungen kommen an die Stelle des Titels. Die Reihenfolge in der Datei sagt
 * deshalb nichts über das Alter aus.
 *
 * `check-handbelege` schlug nicht an, weil es alle Zeilen eines Verweises
 * zusammen betrachtet und die Frage „welche gewinnt" gar nicht stellt.
 */
function verschmelze(a: DubCheck, b: DubCheck): DubCheck {
  // Ohne Datum verliert: Ein undatierter Eintrag verdrängt keinen datierten.
  const [alt, neu] = (a.checkedAt ?? '') <= (b.checkedAt ?? '') ? [a, b] : [b, a]
  return {
    ...alt,
    ...Object.fromEntries(Object.entries(neu).filter(([, v]) => v !== undefined && v !== null)),
  } as DubCheck
}

export function dubKey(anilistId: number, platform: string): string {
  return `${anilistId}|${platform}`
}

/** Meinen zwei Adressen dieselbe Ausgabe? */
export function adressGleich(a: string | undefined, b: string | undefined): boolean {
  const ka = adressKern(a)
  return Boolean(ka) && ka === adressKern(b)
}
