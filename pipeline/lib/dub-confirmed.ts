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
}

const DATEI = resolve(ROOT, 'data', 'dub-confirmed.yaml')

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
    const schluessel = dubKey(item.anilistId, item.platform)
    const vorhanden = out.findIndex((x) => dubKey(x.anilistId, x.platform) === schluessel)
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
