/**
 * Die Suche — und wie viel Ungenauigkeit sie verzeiht.
 *
 * Anlass (Daniel, 12.08.2026): Anime-Titel sind lang, fremdsprachig und
 * schwer zu tippen. Wer „Aesthetica of a Rogue Hero" sucht, tippt „aesthetic
 * hero" oder gleich „ästhetik" — und bekam bisher nichts, weil die Suche den
 * **gesamten** Suchbegriff als zusammenhängende Zeichenkette im Titel suchte.
 *
 * Deshalb zwei Stufen, und die Reihenfolge ist der ganze Trick:
 *
 *  1. **Wortweise, streng.** Jedes Wort der Eingabe muss irgendwo vorkommen —
 *     als Teilzeichenkette, in irgendeinem Feld. „aesthetic hero" trifft damit,
 *     weil „aesthetic" in „Aesthetica" steckt und „hero" in „Rogue Hero".
 *     Diese Stufe erzeugt **keine** neuen Treffer gegenüber früher, sie löst
 *     nur die Reihenfolge der Wörter auf.
 *  2. **Ähnlichkeit, nachsichtig — aber nur, wenn Stufe 1 nichts fand.**
 *     Erst wenn die Ergebnisliste leer bliebe, wird geraten. Das ist die
 *     wichtigste Einstellung überhaupt: Eine Suche nach „slime" liefert
 *     weiterhin genau die Slime-Titel und nicht zusätzlich alles, was
 *     entfernt so klingt. Ungenauigkeit gibt es nur da, wo Genauigkeit nichts
 *     gebracht hat.
 *
 * Was Stufe 2 verzeiht, hängt an der Wortlänge — kurze Wörter tragen zu wenig
 * Information, um Fehler von Bedeutung zu unterscheiden:
 *
 * | Länge | erlaubte Tippfehler | Ähnlichkeit |
 * |---|---|---|
 * | 1–3 | keine | keine |
 * | 4–6 | 1 | ab 0,60 |
 * | ab 7 | 2 | ab 0,60 |
 *
 * Stufe 2 sieht außerdem **nur Titel an**, nicht Genres, Keywords oder Studios.
 * Ein verrutschtes Genre-Wort träfe sonst hunderte Titel auf einmal.
 */

/**
 * Woher ein Treffer kommt — die Art bestimmt die Beschriftung im Hinweis.
 *
 * Daniel am 29.09.2026: „if search matched not the title, but the alternative title (not visible on
 * the result card) then it should display a small icon … to explain which part of it lead to it
 * being part of the search result … show the attribute that matched". Und: es gilt für **alle**
 * Felder, die die Suche ansieht — welche das sind, ist nirgends sichtbar (siehe `SUCHFELD_ARTEN`).
 */
export type FundstelleArt = 'titel' | 'synonym' | 'studio' | 'genre' | 'keyword' | 'release' | 'verlag' | 'ausgabe'

/** Ein beschriftetes Feld, wie es die Suche durchsieht. */
export interface Suchfeld {
  art: FundstelleArt
  text: string
}

/**
 * **Warum dieser Treffer dasteht — und wo.**
 *
 * `wort` ist die Stelle im Original (Groß-/Kleinschreibung und Umlaute wie dort), `teil` die enge
 * Fundstelle darin, wenn sie sich genau benennen lässt. Bei der unscharfen Stufe bleibt `teil`
 * leer: Dort stimmen die Buchstaben ja gerade **nicht** überein („pice" gegen „Piece"), deshalb
 * wird das tragende Wort hervorgehoben und im Hinweis erklärt (siehe `hebeBuchstaben`).
 */
export interface Fundstelle {
  art: FundstelleArt
  /** Das Feld im Original, z. B. „One Piece" als Romaji-Titel. */
  feld: string
  /** Das Wort im Feld, das den Treffer trägt. */
  wort: string
  /** Das Suchwort, das hier getroffen hat — für den Buchstabenabgleich bei unscharfen Treffern. */
  suchwort: string
  /** Die genaue Fundstelle im Wort — nur bei der strengen Stufe. */
  teil?: string
  /** Die unscharfe Stufe hat getroffen (Tippfehler verziehen). */
  unscharf?: boolean
}

/**
 * **Wie gut ein Treffer sitzt** (Daniel, 29.09.2026: „bau eine sinnvolle priorisierung für
 * trefferart (ganzes wort, teilwort, fuzzy, etc) und die durchsuchten attribute ein. titel hat
 * höchste prio … dabei sind ganze wort-treffer weiter oben zu platzieren, als wortanfang, und
 * wortmitte nach wortanfang, fuzzy noch weiter hinten. Danach folgen die andere Attribute").
 *
 * Kleinere Zahl = weiter vorn. Vier Dimensionen mit **gestaffelten** Gewichten, damit keine die
 * andere aufholt:
 *
 * - **Feld** (× 10000) — was getroffen hat. Der sichtbare Titel zuerst, dann die übrigen Namen des
 *   Werks, dann Werk-, Thema- und Produktangaben (`FELD_RANG`).
 * - **Trefferart** (× 1000) — ganzes Wort, Wortanfang, Wortmitte, unscharf (`ART_RANG`).
 * - **Stelle** (× 100) — das wievielte Wort des Feldes den Treffer trägt (`wortStelle`).
 * - **Vollständigkeit** (× 10 je Wort, das im Titel *nicht* gefunden wurde) — „exiled knight" mit
 *   beiden Wörtern vor einem Treffer mit nur einem.
 */
export type TrefferArt = 'ganz' | 'anfang' | 'mitte' | 'fuzzy'

/** Wie der Treffer im gefundenen Wort sitzt. */
export function trefferArt(f: Fundstelle): TrefferArt {
  if (f.unscharf) return 'fuzzy'
  /* Über das **normalisierte** Wort: Bei Umlauten oder Sonderzeichen gibt es keine enge Fundstelle
     (`teil` fehlt), aber das Wort ist trotzdem genau getroffen. */
  const wort = normalize(f.wort)
  const gesucht = normalize(f.suchwort)
  if (wort === gesucht) return 'ganz'
  return wort.startsWith(gesucht) ? 'anfang' : 'mitte'
}

const ART_RANG: Record<TrefferArt, number> = { ganz: 0, anfang: 1, mitte: 2, fuzzy: 3 }

/**
 * **Wo im Feld der Treffer sitzt — als wievieltes Wort.**
 *
 * Daniel am 29.09.2026: „why is the last item in first line before 2nd item of 2nd line? 2nd item 2nd
 * line has full match at start of title … last item first line also has full word, but it is not at
 * the very start of the title." Bei einer kurzen Suche („a") treffen zwanzig Titel dasselbe Wort in
 * derselben Art — dann entschied bisher die Reihenfolge im Datensatz. Das erste Wort eines Namens
 * meint der Nutzer häufiger als das fünfte, deshalb zählt die Stelle mit.
 */
const STELLE_MAX = 9

function wortStelle(f: Fundstelle): number {
  const i = woerterOriginal(f.feld).indexOf(f.wort)
  return i < 0 ? STELLE_MAX : Math.min(i, STELLE_MAX)
}

/**
 * Die Reihenfolge der Felder — sie ist die eigentliche Entscheidung dieser Rangfolge.
 *
 * `titel` steht zweimal drin: Wer den **sichtbaren** Namen trifft (das, was auf der Karte steht),
 * schlägt jeden anderen Treffer; die übrigen Namen desselben Werks (andere Sprache, Originalschrift,
 * aniSearch-Synonym) kommen direkt danach. Danach Studio, Schlagwort, Genre, Ausgabe-Name, Verlag,
 * Edition — Werk vor Thema vor Produkt.
 */
const FELD_RANG: Record<FundstelleArt, number> = {
  titel: 1,
  synonym: 1,
  studio: 2,
  keyword: 3,
  genre: 4,
  release: 5,
  verlag: 6,
  ausgabe: 7,
}
const FELD_SICHTBAR = 0

/** Der Feld-Rang eines Treffers — 0, wenn er im **sichtbaren** Namen sitzt. */
export function feldRang(f: Fundstelle, sichtbar?: string): number {
  if ((f.art === 'titel' || f.art === 'synonym') && sichtbar && normalize(f.feld) === normalize(sichtbar)) {
    return FELD_SICHTBAR
  }
  return FELD_RANG[f.art]
}

/** Der Platz eines Treffers im Feld — je kleiner, desto weiter vorn. */
export function trefferPunkte(f: Fundstelle, sichtbar?: string, fehlendeWoerter = 0): number {
  return (
    feldRang(f, sichtbar) * 10000 +
    ART_RANG[trefferArt(f)] * 1000 +
    wortStelle(f) * 100 +
    fehlendeWoerter * 10
  )
}

/** Die Punktliste eines Treffers, aufsteigend — der Vergleich liest sie der Reihe nach. */
export function trefferSchluessel(fundstellen: Fundstelle[], sichtbar?: string, fehlendeWoerter = 0): number[] {
  return fundstellen.map((f) => trefferPunkte(f, sichtbar, fehlendeWoerter)).sort((a, b) => a - b)
}

/** Zwei Punktlisten vergleichen: die erste Stelle entscheidet, dann die nächste. */
export function schluesselVergleich(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? Number.POSITIVE_INFINITY) - (b[i] ?? Number.POSITIVE_INFINITY)
    if (d) return d
  }
  return 0
}

/**
 * **Welche Felder durchsucht werden — an einer Stelle.**
 *
 * Die Suche benutzt diese Liste (über die Aufrufer in `filters.ts`), und das Info-Symbol am
 * Suchfeld zeigt sie an. Damit kann sie nicht auseinanderlaufen; `check:logic` hält beide
 * gegeneinander. Daniel am 29.09.2026: „welche felder durchsucht werden nicht ersichtlich ist und
 * gemäß der projekt regel alles offen zu kommunizieren, muss hier in der suche nahe dem such-input
 * ein icon erscheinen, das on hover oder touch erklärt über welche felder gesucht wird (+ fuzzy
 * search)".
 */
export const SUCHFELD_ARTEN: { art: FundstelleArt; label: string }[] = [
  { art: 'titel', label: 'Titel (deutsch, englisch, Romaji, Originalschrift)' },
  { art: 'synonym', label: 'Weitere Namen (aus aniSearch)' },
  { art: 'studio', label: 'Studio' },
  { art: 'genre', label: 'Genre' },
  { art: 'keyword', label: 'Schlagwort' },
  { art: 'release', label: 'Name der Ausgabe' },
  { art: 'verlag', label: 'Verlag' },
  { art: 'ausgabe', label: 'Ausgabe (z. B. „Box 2")' },
]

/** Die Beschriftung einer Fundstelle für den Hinweis. */
export function fundstelleLabel(art: FundstelleArt): string {
  return SUCHFELD_ARTEN.find((s) => s.art === art)?.label ?? art
}

/**
 * **Die Buchstaben, die wirklich übereinstimmen** — für den Hinweis bei unscharfen Treffern.
 *
 * Bei „pice" gegen „Piece" stimmt kein zusammenhängender Teil; die längste gemeinsame
 * Buchstabenfolge (Reihenfolge, nicht Nachbarschaft) zeigt, was der Leser wiedererkennt:
 * p, i, e, c, e. Wird im Hinweis als eigene Zeile gezeigt, damit das hervorgehobene **Wort** nicht
 * als Behauptung dasteht, es stimme buchstabengenau.
 */
export function gemeinsameBuchstaben(eingabe: string, wort: string): string {
  const a = normalize(eingabe)
  const b = normalize(wort)
  let i = 0
  let j = 0
  let treffer = ''
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      treffer += b[j]
      i++
      j++
    } else if (a.length - i > b.length - j) {
      i++
    } else {
      j++
    }
  }
  return treffer
}

/** Ein Suchwort im Wort finden — mit Rücksicht auf ß (aus „ß" wird beim Normalisieren „ss"). */
function fundstelleImWort(wort: string, suchwort: string): string | undefined {
  const nWort = normalize(wort)
  const i = nWort.indexOf(suchwort)
  if (i < 0) return undefined
  /* Nur wenn das Normalisieren nichts verlängert hat, stimmen die Stellen überein. */
  if (nWort.length === wort.length) return wort.slice(i, i + suchwort.length)
  return undefined
}

/** Die Wörter eines Feldes im **Original** — gleich geschnitten wie `woerter()`. */
function woerterOriginal(feld: string): string[] {
  return feld.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[äÄ]/g, 'a')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Zerlegt in Wörter.
 *
 * Nicht-lateinische Schrift bleibt am Stück: Japanisch kennt keine
 * Leerzeichen, „転生したらスライムだった件" ist ein einziges Wort und muss als
 * solches gesucht werden können.
 */
export function woerter(value: string): string[] {
  return normalize(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function bigramme(w: string): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2))
  return out
}

/** Dice-Koeffizient über Buchstabenpaare: 0 = nichts gemein, 1 = gleich. */
function aehnlichkeit(a: string, b: string): number {
  const A = bigramme(a)
  const B = bigramme(b)
  if (!A.size || !B.size) return a === b ? 1 : 0
  let gemeinsam = 0
  for (const g of A) if (B.has(g)) gemeinsam++
  return (2 * gemeinsam) / (A.size + B.size)
}

/**
 * Levenshtein-Abstand, abgebrochen sobald `max` überschritten ist.
 *
 * Der Abbruch ist kein Feinschliff: Die Suche läuft bei jedem Tastendruck über
 * 2.753 Titel mit je einem halben Dutzend Namensfeldern. Ohne Obergrenze wären
 * das Millionen voller Matrixdurchläufe.
 */
function abstand(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let vorige = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const aktuelle = [i]
    let zeilenMin = i
    for (let j = 1; j <= b.length; j++) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1
      const wert = Math.min(aktuelle[j - 1] + 1, vorige[j] + 1, vorige[j - 1] + kosten)
      aktuelle.push(wert)
      if (wert < zeilenMin) zeilenMin = wert
    }
    if (zeilenMin > max) return max + 1
    vorige = aktuelle
  }
  return vorige[b.length]
}

/** Wie viele Tippfehler ein Wort dieser Länge verzeiht. */
function toleranz(laenge: number): number {
  // Zwei Zeichen tragen zu wenig Information: „sa" wäre einen Schritt von „so",
  // „la", „sao" und zwanzig weiteren entfernt.
  if (laenge <= 2) return 0
  if (laenge <= 6) return 1
  return 2
}

const AEHNLICH_AB = 0.6
/**
 * Mindestlänge für den Vergleich gemeinsamer Anfänge — **auf beiden Seiten**.
 *
 * Die Untergrenze stand zunächst nur auf dem Suchwort. Ergebnis: Der sinnlose
 * Begriff „xqzvwkkk" lieferte 33 Titel, weil irgendein Titel ein einbuchstabiges
 * Wort enthielt und „xqzvwkkk".startsWith("x") zutrifft. Ein Präfix ist nur
 * dann ein Hinweis, wenn es selbst etwas aussagt.
 */
const PRAEFIX_AB = 4

/** Trifft ein Suchwort ungefähr auf eines der Wörter im Heuhaufen? */
function wortTrifftUngefaehr(suchwort: string, heuhaufen: string[]): boolean {
  const tol = toleranz(suchwort.length)
  if (!tol) return false
  for (const wort of heuhaufen) {
    // Ein gemeinsamer Anfang ist ein starkes Signal: „aesthetic" gegen
    // „aesthetica".
    if (
      suchwort.length >= PRAEFIX_AB &&
      wort.length >= PRAEFIX_AB &&
      (wort.startsWith(suchwort) || suchwort.startsWith(wort))
    ) {
      return true
    }
    if (abstand(suchwort, wort, tol) <= tol) return true
    if (suchwort.length >= 5 && wort.length >= 5 && aehnlichkeit(suchwort, wort) >= AEHNLICH_AB) return true
  }
  return false
}

/**
 * Stufe 1: Jedes Suchwort muss als Teilzeichenkette vorkommen.
 *
 * `felder` ist alles, was durchsucht werden darf — Titel in allen drei
 * Sprachen, dazu Studio, Genres und Keywords.
 */
export function trifftGenau(suchwoerter: string[], felder: string[]): boolean {
  if (!suchwoerter.length) return true
  const heu = felder.map(normalize)
  return suchwoerter.every((w) => heu.some((h) => h.includes(w)))
}

/** Stufe 2: Jedes Suchwort muss einem Titelwort ähneln. */
export function trifftUngefaehr(suchwoerter: string[], titelFelder: string[]): boolean {
  if (!suchwoerter.length) return false
  const heu = titelFelder.flatMap((f) => woerter(f))
  if (!heu.length) return false
  return suchwoerter.every((w) => heu.some((h) => h.includes(w)) || wortTrifftUngefaehr(w, heu))
}

/**
 * **Die Fundstellen eines Treffers** — welche Felder ihn tragen, und wo darin.
 *
 * Zuerst die strenge Sicht (jedes Suchwort irgendwo im Feld), dann für die übrig gebliebenen Wörter
 * die unscharfe (Tippfehler). Höchstens vier Stellen: Ein Hinweis, der zehn nennt, erklärt nichts.
 */
function fundstellenFuer(suchwoerter: string[], titelFelder: string[], genaueFelder: Suchfeld[]): Fundstelle[] {
  const raus: Fundstelle[] = []
  const alle: Suchfeld[] = [
    ...titelFelder.map((text) => ({ art: 'titel' as FundstelleArt, text })),
    ...genaueFelder,
  ]
  const offen = new Set(suchwoerter)
  for (const feld of alle) {
    for (const wort of woerterOriginal(feld.text)) {
      const nWort = normalize(wort)
      for (const wortTeil of [...offen]) {
        if (!nWort.includes(wortTeil)) continue
        raus.push({ art: feld.art, feld: feld.text, wort, suchwort: wortTeil, teil: fundstelleImWort(wort, wortTeil) })
        offen.delete(wortTeil)
      }
    }
    if (!offen.size) return raus
  }
  /* Unscharf: Was jetzt noch offen ist, hat nur ähnlich getroffen — das tragende Wort benennen. */
  for (const wortTeil of offen) {
    for (const feld of alle) {
      const wort = woerterOriginal(feld.text).find((w) => wortTrifftUngefaehr(wortTeil, [normalize(w)]))
      if (!wort) continue
      raus.push({ art: feld.art, feld: feld.text, wort, suchwort: wortTeil, unscharf: true })
      break
    }
  }
  return raus.slice(0, 4)
}

export function sucheMitFundstellen<T>(
  quelle: T[],
  suchbegriff: string,
  genau: (item: T) => Suchfeld[],
  titel: (item: T) => string[],
  /** Der **sichtbare** Name des Eintrags — Träger der höchsten Trefferklasse (29.09.2026). */
  sichtbarerName?: (item: T) => string,
): { item: T; rang: number; fundstellen: Fundstelle[] }[] {
  /*
    **Füllwörter entscheiden nichts.** „abenteuer von dai" fand „Dais Abenteuer" nicht,
    weil „von" dort nicht vorkommt (Daniel, 16.09.2026). Sie fallen weg, solange etwas
    übrig bleibt — wer nur „the" sucht, bekommt weiter die Treffer dafür.
  */
  const alle = woerter(suchbegriff)
  const ohneFuell = alle.filter((w) => !FUELLWOERTER.has(w))
  const suchwoerter = ohneFuell.length ? ohneFuell : alle
  if (!suchwoerter.length) return quelle.map((item) => ({ item, rang: 0, fundstellen: [] }))
  /*
    **Nach Treffergüte sortiert, und die ungefähre Stufe fragt, wenn kein Titel passt**
    (18.09.2026, gemessen an 22 typischen Eingaben: Platz 1 richtig 16 → 21).

    Vorher stand die strenge Stufe allein, sobald *irgendetwas* passte: „one pice" fand
    „pice" in „S**pice** and Wolf" und kam nie bei One Piece an. Und die Treffer standen
    alphabetisch — „Pokémon" auf Platz 12 von 68, „Naruto" auf Platz 5.

    Rang: 0 Titel exakt · 1 Titel beginnt so · 2 alle Wörter im Titel · 3 ungefähr im Titel
    (nach Tippabstand) · 4 nur in Studio, Genre oder Keyword. Stufe 3 kommt nur hinzu,
    wenn kein Titel wörtlich passt — sonst hinge an „frieren" eine Liste ähnlicher Namen.
  */
  const ganz = suchwoerter.join(' ')
  /*
    **Zusammengeschrieben ist dasselbe wie getrennt** (21.09.2026). „sandland" traf „Sand Land:
    The Series" nicht als Titel, weil dort ein Leerzeichen steht; die unscharfe Stufe füllte die
    Liste dann mit 38 Klangverwandten (Daniel: „wieso so viele treffer wenn ich nach sandland
    suche?"). Verglichen wird deshalb auch ohne Leer- und Satzzeichen — erst ab vier Zeichen,
    darunter steckt ein Begriff in zu vielen Namen.
  */
  const kompakt = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '')
  const ganzKompakt = suchwoerter.join('')
  const kompaktZaehlt = ganzKompakt.length >= 4
  const bewertet: { item: T; rang: number; abstand: number }[] = []
  for (const item of quelle) {
    const namen = titel(item).map(normalize)
    const namenKompakt = kompaktZaehlt ? namen.map(kompakt) : []
    const alleFelder = genau(item)
    const genauTexte = alleFelder.map((f) => f.text)
    if (namen.some((n) => n === ganz) || namenKompakt.some((n) => n === ganzKompakt)) bewertet.push({ item, rang: 0, abstand: 0 })
    else if (namen.some((n) => n.startsWith(ganz)) || namenKompakt.some((n) => n.startsWith(ganzKompakt)))
      bewertet.push({ item, rang: 1, abstand: 0 })
    else if (trifftGenau(suchwoerter, titel(item))) bewertet.push({ item, rang: 2, abstand: keinWortanfang(suchwoerter, titel(item)) * 1000 + kuerzesterName(suchwoerter, titel(item)) })
    else if (trifftUngefaehr(suchwoerter, titel(item))) bewertet.push({ item, rang: 3, abstand: tippAbstand(suchwoerter, titel(item)) })
    else if (trifftGenau(suchwoerter, genauTexte)) bewertet.push({ item, rang: 4, abstand: 0 })
  }
  const titelPasst = bewertet.some((b) => b.rang <= 2)
  return (
    bewertet
      .filter((b) => !titelPasst || b.rang !== 3)
      /*
        **Die Fundstellen erst für die Behaltenen** — nicht für alle 2.753 Titel bei jedem
        Tastendruck. Sie sind die Antwort auf „warum steht das hier", und die braucht nur, was
        auch angezeigt wird. **Seit dem 29.09.2026 tragen sie auch die Rangfolge**: Feld,
        Trefferart und Vollständigkeit (`trefferPunkte`).
      */
      .map((b) => {
        const fundstellen = fundstellenFuer(suchwoerter, titel(b.item), genau(b.item))
        const fehlend = Math.max(0, suchwoerter.length - fundstellen.filter((f) => !f.unscharf).length)
        return { ...b, fundstellen, schluessel: trefferSchluessel(fundstellen, sichtbarerName?.(b.item), fehlend) }
      })
      .sort((a, b) => trefferVergleich(a, b, sichtbarerName))
      .map(({ item, rang, fundstellen }) => ({ item, rang, fundstellen }))
  )
}

/**
 * Der Vergleich zweier Treffer: erst die Punkte, dann Stufe, Tippabstand — und bei Gleichstand
 * **alphabetisch** (29.09.2026).
 *
 * Ohne den letzten Schritt entschied die Reihenfolge im Datensatz, und bei einer kurzen Suche („a")
 * treffen zwanzig Titel dieselbe Stelle in derselben Art: Dann stand „How a Realist Hero …" vor
 * „A Couple of Cuckoos", obwohl dort das Wort ganz am Anfang des Namens steht.
 */
function trefferVergleich<T>(
  a: { schluessel: number[]; rang: number; abstand: number; item: T },
  b: { schluessel: number[]; rang: number; abstand: number; item: T },
  name?: (item: T) => string,
): number {
  const punkte = schluesselVergleich(a.schluessel, b.schluessel)
  if (punkte) return punkte
  if (a.rang !== b.rang) return a.rang - b.rang
  if (a.abstand !== b.abstand) return a.abstand - b.abstand
  return name ? name(a.item).localeCompare(name(b.item), 'de') : 0
}

/**
 * Filtert eine Liste in zwei Stufen — die Kurzfassung ohne Fundstellen.
 *
 * `genau` liefert die Felder für die strenge Stufe, `titel` die für die
 * nachsichtige. Bleibt die strenge Stufe leer, wird die nachsichtige gefragt —
 * sonst nicht.
 */
const FUELLWOERTER = new Set(['von', 'der', 'die', 'das', 'des', 'dem', 'den', 'und', 'ein', 'eine', 'the', 'of', 'and', 'a', 'an', 'no'])

export function sucheZweistufig<T>(
  quelle: T[],
  suchbegriff: string,
  genau: (item: T) => string[],
  titel: (item: T) => string[],
): T[] {
  return sucheMitFundstellen(quelle, suchbegriff, (item) => genau(item).map((text) => ({ art: 'titel' as FundstelleArt, text })), titel).map((t) => t.item)
}


/** Wie viele Suchwörter nur mitten in einem Wort stehen — „dai" in „Samurai" zählt schwächer als „Dai". */
function keinWortanfang(suchwoerter: string[], titelFelder: string[]): number {
  const heu = titelFelder.flatMap((f) => woerter(f))
  return suchwoerter.filter((w) => !heu.some((h) => h.startsWith(w))).length
}

/** Länge des kürzesten Namens, der alle Suchwörter enthält — „Dais Abenteuer" passt dichter als ein 45-Zeichen-Titel. */
function kuerzesterName(suchwoerter: string[], titelFelder: string[]): number {
  const passend = titelFelder.map(normalize).filter((n) => suchwoerter.every((w) => n.includes(w)))
  return passend.length ? Math.min(...passend.map((n) => n.length)) : 999
}

/** Summe der kleinsten Tippabstände je Suchwort zu einem Titelwort — für die Reihenfolge in Stufe 3. */
function tippAbstand(suchwoerter: string[], titelFelder: string[]): number {
  const heu = titelFelder.flatMap((f) => woerter(f))
  return suchwoerter.reduce((summe, w) => summe + Math.min(...heu.map((h) => abstand(w, h, 3))), 0)
}
