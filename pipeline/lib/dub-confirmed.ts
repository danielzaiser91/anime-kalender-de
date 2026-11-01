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
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { vereinigeBereiche, vereinigeGleichzeitige } from './dub-bereiche.ts'
import { ROOT } from './util.ts'
import { adressKern, adressGleich, istSammelKern } from '../../shared/adresse-kern.ts'
import { PLATFORMS, type PlatformId } from '../../shared/types.ts'
import type { CartoonStaffel } from '../../shared/cartoon-staffeln-typ.ts'
import { warn } from './util.ts'
import { loadCurated } from './curated.ts'
import { dubChecksAusTerminen } from './dub-aus-terminen.ts'
import { ohneKanalSprache } from './kanal-titel.ts'
import { ergaenzeMerkliste, MERKLISTE } from './kanal-merkliste.ts'

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
  /** Nur in verschmolzenen Zeilen (`verschmelze`), nie in der Datei: das Urteil der jüngeren von zwei widersprüchlichen Zeilen derselben Adresse. */
  juengstesUrteil?: 'ja' | 'nein'
  /**
   * **Welchen Teil der Anbieter-Liste dieser Eintrag meint.**
   *
   * In den Nummern des Anbieters, nicht in unseren: Prime führt „Captain
   * Tsubasa (2018)" als 91 durchlaufende Folgen; unser Eintrag „Staffel 2 —
   * Die Junioren" sind davon 53 bis 91. Ohne die Angabe zählt jede Prüfung
   * 91 Folgen für eine Staffel, die 39 hat.
   */
  teilBereich?: { von: number; bis: number }
  /** Folgen der Anbieter-Liste, die keine Folgen unseres Titels sind (Bonusfolge nur OmU): Die Prüfung „über der Folgenzahl“ zählt sie nicht. */
  sonderfolgen?: number[]
  /**
   * Nur Cartoons (negative Kennung): die Staffeln der Serie beim Anbieter, wie Daniel sie gezählt hat (Jack der
   * Monsterschreck: Buch 1 = 1 Folge, Buch 2 = 10, Buch 3 = 10). Gewinnt gegen JustWatch und TMDB
   * (`lib/cartoon-staffeln.ts`); `dubRanges` zählen dann durchlaufend über alle Staffeln.
   */
  staffeln?: CartoonStaffel[]
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
   *
   * Zweiter Fall seit dem 16.09.2026: ein Beleg, der vom Reihenkopf an die
   * Staffel umgehängt wurde, die seine Adresse nennt — und diese Staffel steht
   * (noch) nicht im Bestand. Die Notiz sagt dann, ob und wie sie hineinkommt.
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
   * Dasselbe gilt für das Ja: Ohne dieses Feld lässt `ohneKanalSprache()` (kanal-titel.ts) `dub: true` und
   * `dubRanges` eines Kanal-Titels beim Lesen weg (11.10.2026).
   *
   * Wer dieses Feld setzt, sagt: **Ich habe eine zweite Quelle angesehen, und
   * hier steht, welche.** Freitext, aber nicht leer — die Zusicherung prüft nur
   * das Dasein, den Wert liest ein Mensch.
   */
  zweiteQuelle?: string
  /** Vom Lader gesetzt, nie in der Datei: Amazons Sprachangabe dieses Kanal-Titels wurde weggelassen (`kanal-titel.ts`). */
  kanalOhneBeleg?: boolean
  /**
   * Was eine Kanal-Meldung der Erweiterung ab 12.10.2026 gelesen hat: `ja` = in mindestens einer Folge Deutsch, `nein` = in keiner.
   * Steht in der Datei, zählt aber nicht als Urteil (die Kanal-Regel bleibt). Die jüngere Messung derselben Adresse ersetzt die ältere
   * (`verschmelze()`); wer die Regel lockert, liest das Urteil aus diesem Feld und nicht aus einem alten `dub: true` darunter.
   */
  kanalMessung?: 'ja' | 'nein'
}

/** Zuhause ist `shared/adresse-kern.ts` (das Panel vergleicht Adressen ebenso); hier bleibt der Name für die Bau-Importe. */
export { adressKern, adressGleich }

const DATEI = resolve(ROOT, 'data', 'dub-confirmed.yaml')

/** Alle Synchro-Belege: die Handbelege und, wo keiner steht, die am kuratierten Termin (`dub-aus-terminen.ts`). */
export function loadDubChecks(): DubCheck[] {
  const hand = ladeHandbelege()
  return [...hand, ...dubChecksAusTerminen(loadCurated(), hand)]
}

/** Die Schlüssel `anilistId|platform` aller Handbelege mit deutsch (ohne Kanal-Lücken ohne Beleg). */
export function handJaSchluessel(checks: DubCheck[]): Set<string> {
  return new Set(checks.filter((c) => c.dub === true && !c.kanalOhneBeleg).map((c) => `${c.anilistId}|${c.platform}`))
}

export function ladeHandbelege(): DubCheck[] {
  if (!existsSync(DATEI)) return []
  const raw = yaml.load(readFileSync(DATEI, 'utf8'))
  if (!Array.isArray(raw)) return []
  const out: DubCheck[] = []
  for (const eintrag of (raw as DubCheck[]).map(ohneKanalSprache)) {
    /**
     * **Eine Lücke aus einer Kanal-Meldung ist ein Nein aus einem Kanal — und das
     * belegt nichts** (17.09.2026).
     *
     * `fetch-pruefungen.ts` lässt eine Kanal-Meldung ohne jedes Deutsch aus, eine
     * gemischte schreibt es mit allen Bereichen. Auf Prime-Seiten über den
     * Crunchyroll-Kanal entstanden so Zickzack-Belege: Mob Psycho 100 III „ohne
     * Deutsch 1, 6, 8, 10", One Punch Man „4, 9", Haikyu!! „18–19, 21, 24–25",
     * während Crunchyroll und Netflix dieselben Staffeln vollständig deutsch
     * führen. Gemessen: 10 Belege mit Lücken zwischen deutschen Folgen, 8 davon
     * Kanal-Titel. Die Lücken fallen hier weg; die Folgen gelten als nicht
     * erfasst, das Ja bleibt. Die Rohmeldung steht unverändert in der Datei.
     */
    const kanalMitLuecken =
      /Kanal-Titel/.test(eintrag?.note ?? '') &&
      Boolean(eintrag?.dubRanges?.some((r) => r.dub)) &&
      Boolean(eintrag?.dubRanges?.some((r) => !r.dub))
    const item = kanalMitLuecken ? { ...eintrag, dubRanges: eintrag.dubRanges!.filter((r) => r.dub) } : eintrag
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
export function verschmelze(a: DubCheck, b: DubCheck): DubCheck {
  // Ohne Datum verliert: Ein undatierter Eintrag verdrängt keinen datierten.
  const [alt, neu] = (a.checkedAt ?? '') <= (b.checkedAt ?? '') ? [a, b] : [b, a]
  const verschmolzen = {
    ...alt,
    ...Object.fromEntries(Object.entries(neu).filter(([, v]) => v !== undefined && v !== null)),
  } as DubCheck
  /*
    Meldungen sind oft Teilmeldungen (Cartoon je Staffel, Anime aus der Erweiterung): Die Bereiche ergänzen sich,
    ein Urteil der jüngeren Meldung gilt nur für die Folgen, die sie nennt.
  */
  if (Number.isFinite(a.anilistId) && a.anilistId === b.anilistId && alt.dubRanges?.length && neu.dubRanges?.length) {
    const gleichAlt = (a.checkedAt ?? '') === (b.checkedAt ?? '')
    verschmolzen.dubRanges = (gleichAlt ? vereinigeGleichzeitige : vereinigeBereiche)(alt.dubRanges, neu.dubRanges)
  }
  delete verschmolzen.juengstesUrteil
  const urteil = juengeresUrteil(alt, neu)
  if (urteil) verschmolzen.juengstesUrteil = urteil
  // Ein jüngeres Ja hebt das ältere „nicht verfügbar“ auf (Spy × Family, Disney+: sonst fiel der Weg live weg).
  if (urteil === 'ja' && verschmolzen.available === false) delete verschmolzen.available
  return verschmolzen
}

type Urteil = Pick<DubCheck, 'dub' | 'available' | 'dubRanges' | 'juengstesUrteil'>

/** Das Urteil einer Zeile: Nein (`dub: false`, `available: false`), Ja (`dub: true` oder deutscher Bereich, sofern verfügbar) oder keins. */
export function urteilVon(c: Urteil): 'ja' | 'nein' | undefined {
  if (c.juengstesUrteil) return c.juengstesUrteil
  const nein = c.dub === false || c.available === false
  const ja = c.available !== false && (c.dub === true || Boolean(c.dubRanges?.some((r) => r.dub)))
  if (nein === ja) return undefined
  return nein ? 'nein' : 'ja'
}

/** Das Urteil der jüngeren Zeile, solange die Daten verschieden sind (hat sie keins, gilt das der älteren weiter); bei Gleichstand keins: Ja und Nein bleiben nebeneinander. */
function juengeresUrteil(alt: DubCheck, neu: DubCheck): 'ja' | 'nein' | undefined {
  if ((alt.checkedAt ?? '') === (neu.checkedAt ?? '')) return undefined
  return urteilVon(neu) ?? alt.juengstesUrteil
}

export function dubKey(anilistId: number, platform: string): string {
  return `${anilistId}|${platform}`
}

/**
 * Schlüssel aller Handbelege, die einen Weg verneinen (`available: false` oder `dub: false`), ausgewertet je Adresse (`adressKern`):
 * Ein Ja derselben Adresse (`dub: true` oder ein deutscher Bereich) hebt das Nein auf, außer die verschmolzene Zeile trägt selbst
 * `available: false` (jüngeres „nicht verfügbar“ zum selben Ja, `verschmelze`; wie in `handbelegteJaWege` gilt dann das Nein), ein Ja einer anderen Adresse nicht; ohne Adresse ist
 * „dieselbe" nicht belegt, Ja und Nein bleiben dann uneindeutig und das Nein gilt (Kuroko's Basketball 3, 20725, bei Netflix: altes Ja, jüngeres „nicht verfügbar").
 * Das Nein gilt der ganzen Plattform (`dubKey`), wenn es keine Adresse trägt oder die Plattform keine Ausgabe mit Ja führt: Eine neue Adresse
 * kann dieselbe Ausgabe in anderer Schreibweise sein (JustWatch-gti statt ASIN). Erst eine belegte zweite Ausgabe (ein Ja mit eigener Adresse) beschränkt es auf seine Adresse
 * (`dubKey|adressKern`; Digimon 552 bei Prime: B0CGRJGJX1 ja, Crunchyroll-Kanal B0CHHNJJW3 nein). Abgefragt wird mit `wegVerneint`.
 * Widersprechen sich Ja und Nein derselben Adresse, gilt das jüngere (`juengstesUrteil`, gesetzt von `verschmelze`).
 * Such-, Start- und Länderseiten (`istSammelKern`) sind keine Ausgabe: Ihr Ja belegt keine zweite, ihr Nein gilt der ganzen Plattform
 * und entfällt, sobald der Titel dort ein Ja an echter Adresse hat (eine Suche, die ihn nicht zeigt, widerlegt die Seite nicht; Jormungand: Perfect Order, 13331).
 */
export function neinHandbelege(checks: Pick<DubCheck, 'anilistId' | 'platform' | 'url' | 'dub' | 'available' | 'dubRanges' | 'juengstesUrteil'>[]): Set<string> {
  const adressen = new Map<string, { titel: string; kern: string; sammel: boolean; nein: boolean; ja: boolean }>()
  for (const c of checks) {
    const titel = dubKey(c.anilistId, c.platform)
    const roh = adressKern(c.url)
    const sammel = istSammelKern(roh)
    const kern = sammel ? '' : roh
    const a = adressen.get(`${titel}|${roh}`) ?? { titel, kern, sammel, nein: false, ja: false }
    /* Haben zwei Zeilen derselben Adresse verschiedene Daten, gilt das Urteil der jüngeren (`verschmelze`). */
    a.nein ||= c.juengstesUrteil ? c.juengstesUrteil === 'nein' : c.dub === false || c.available === false
    a.ja ||= c.juengstesUrteil ? c.juengstesUrteil === 'ja' : c.available !== false && (c.dub === true || Boolean(c.dubRanges?.some((r) => r.dub)))
    adressen.set(`${titel}|${roh}`, a)
  }
  const mitJa = new Set([...adressen.values()].filter((a) => a.ja && a.kern).map((a) => a.titel))
  const nein = new Set<string>()
  for (const a of adressen.values()) {
    if (!a.nein || (a.ja && a.kern) || (a.sammel && mitJa.has(a.titel))) continue
    nein.add(a.kern && mitJa.has(a.titel) ? `${a.titel}|${a.kern}` : a.titel)
  }
  return nein
}

/** Verneint ein Handbeleg aus `neinHandbelege` den Weg zu `url`? */
export function wegVerneint(nein: ReadonlySet<string>, anilistId: number, platform: string, url: string | undefined): boolean {
  const titel = dubKey(anilistId, platform)
  return nein.has(titel) || nein.has(`${titel}|${adressKern(url)}`)
}

type BelegFolgen = {
  anilistId?: number
  platform?: string
  url?: string
  dubRanges?: { from?: number; to?: number }[]
  sonderfolgen?: number[]
}

/** Die höchste Folge einer Spanne, die keine Sonderfolge ist (0, wenn nur Sonderfolgen am oberen Ende stehen). */
function hoechsteEchteFolge(r: { from?: number; to?: number }, sonder: number[]): number {
  let bis = r.to ?? 0
  while (bis >= (r.from ?? 1) && sonder.includes(bis)) bis--
  return bis >= (r.from ?? 1) ? bis : 0
}

/** Belege, deren höchste dubRanges-Folge (ohne `sonderfolgen`) die Folgenzahl ihres Titels übersteigt, je als Zeile mit Titel, Plattform, Adresse und Zahlen. */
export function belegeUeberFolgenzahl(liste: BelegFolgen[], folgenJeTitel: ReadonlyMap<number, number>): string[] {
  return liste.flatMap((b) => {
    const n = folgenJeTitel.get(b.anilistId ?? -1) ?? 0
    const bis = Math.max(0, ...(b.dubRanges ?? []).map((r) => hoechsteEchteFolge(r, b.sonderfolgen ?? [])))
    return n > 0 && bis > n ? [`${b.anilistId} ${b.platform ?? '?'} ${b.url ?? 'ohne Adresse'}: bis Folge ${bis} bei ${n}`] : []
  })
}

/** Vergleichsschlüssel eines Belegs: das Prüfdatum zählt nicht, sonst hängt jede Wiederholmeldung mit neuem Datum denselben Beleg erneut an. */
export function belegSchluessel(eintrag: unknown): string {
  if (eintrag === null || typeof eintrag !== 'object') return JSON.stringify(eintrag)
  const { checkedAt: _checkedAt, ...rest } = eintrag as Record<string, unknown>
  return JSON.stringify(rest)
}

/**
 * Teilt neu erzeugte YAML-Zeilen in Belege und liefert nur die, die weder in `alt` noch weiter
 * vorn unter den neuen stehen. Verglichen wird das gelesene Objekt, nicht der Text: Kommentare
 * und Anführungszeichen dürfen sich unterscheiden. Die Zusicherung „kein Beleg steht zweimal in
 * der Datei" hält sonst den ganzen Abruf zurück.
 */
export function neueBelegBloecke(alt: string, zeilen: string[]): { bloecke: string[][]; neu: string[][] } {
  const vorhanden = new Set(((yaml.load(alt) as unknown[] | null) ?? []).map((b) => belegSchluessel(b)))
  const bloecke: string[][] = []
  for (const z of zeilen) {
    if (z.startsWith('- ')) bloecke.push([z])
    else if (bloecke.length) bloecke[bloecke.length - 1]!.push(z)
  }
  const neu = bloecke.filter((b) => {
    try {
      const eintrag = belegSchluessel((yaml.load(b.join('\n')) as unknown[] | null)?.[0])
      if (vorhanden.has(eintrag)) return false
      vorhanden.add(eintrag)
      return true
    } catch {
      return true
    }
  })
  return { bloecke, neu }
}

/**
 * Entfernt Belege, die in derselben Fassung schon stehen — verglichen am gelesenen Objekt.
 *
 * `neueBelegBloecke()` prüft dasselbe beim Anhängen, kann eine Dopplung aber übersehen: Lässt
 * sich ein Block **allein** nicht lesen, wird er dort ungeprüft übernommen (`catch` → behalten)
 * — in der fertigen Datei steht er trotzdem als eigener Eintrag, und `check:logic` vergleicht
 * dort die gelesenen Objekte. Am 28.09.2026 hielt genau das einen ganzen Datenlauf zurück
 * („Erzeugnisse und neue Meldungen werden nicht übernommen", Lauf 36417274445), und 242
 * Meldungen aus Daniels Prime-Durchgang kamen nicht in die Datei. Diese Funktion ist der letzte
 * Riegel **vor dem Schreiben** und stellt dieselbe Frage wie die Zusicherung.
 *
 * Der erste Beleg gewinnt; die Textgestalt bleibt sonst unangetastet (Kommentare, Reihenfolge,
 * Anführungszeichen).
 */
export function entdoppleBelege(text: string, melde?: (text: string) => void): string {
  const zeilen = text.split('\n')
  const gesehen = new Set<string>()
  const raus: string[] = []
  let entfernt = 0
  let i = 0
  while (i < zeilen.length) {
    const z = zeilen[i] ?? ''
    if (!z.startsWith('- ')) {
      raus.push(z)
      i++
      continue
    }
    let j = i + 1
    while (j < zeilen.length) {
      const w = zeilen[j] ?? ''
      if (w.startsWith(' ') || w.trim() === '') j++
      else break
    }
    /* Leerzeilen am Blockende gehören zum Abstand, nicht zum Beleg. */
    let ende = j
    while (ende > i && (zeilen[ende - 1] ?? '').trim() === '') ende--
    const block = zeilen.slice(i, ende)
    let schluessel: string | null = null
    try {
      const gelesen = yaml.load(block.join('\n')) as unknown[] | null
      schluessel = JSON.stringify(gelesen?.[0])
    } catch {
      schluessel = null
    }
    if (schluessel && gesehen.has(schluessel)) {
      entfernt++
      /* Auch den Abstand vor dem entfernten Beleg zurücknehmen. */
      while (raus.length && (raus[raus.length - 1] ?? '').trim() === '') raus.pop()
      i = j
      continue
    }
    if (schluessel) gesehen.add(schluessel)
    raus.push(...block)
    i = j
  }
  /* Der Abschluss der Datei bleibt, wie er war (der Block-Schnitt frisst ihn sonst). */
  const schwanz = /\n+$/.exec(text)?.[0] ?? ''
  if (entfernt && melde) melde(`${entfernt} Beleg(e) standen doppelt — nicht geschrieben`)
  return raus.join('\n').replace(/\n+$/, '') + schwanz
}

/** Schreibt die Handbelege durch den Riegel `entdoppleBelege` und merkt dabei alle Kanal-Seiten (aus dem geladenen Stand, also nach dem Verschmelzen; holt bei einer fehlenden Merkliste alles nach). */
export function schreibeBelege(datei: string, text: string, melde: (text: string) => void): void {
  writeFileSync(datei, entdoppleBelege(text, melde))
  const dazu = ergaenzeMerkliste(ladeHandbelege())
  if (dazu) melde(`${dazu} Kanal-Seite(n) in ${MERKLISTE} gemerkt`)
}
