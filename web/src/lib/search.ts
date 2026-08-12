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

/** Vereinheitlicht Groß-/Kleinschreibung und deutsche Umlaute. */
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
 * Filtert eine Liste in zwei Stufen.
 *
 * `genau` liefert die Felder für die strenge Stufe, `titel` die für die
 * nachsichtige. Bleibt die strenge Stufe leer, wird die nachsichtige gefragt —
 * sonst nicht.
 */
export function sucheZweistufig<T>(
  quelle: T[],
  suchbegriff: string,
  genau: (item: T) => string[],
  titel: (item: T) => string[],
): T[] {
  const suchwoerter = woerter(suchbegriff)
  if (!suchwoerter.length) return quelle
  const streng = quelle.filter((item) => trifftGenau(suchwoerter, genau(item)))
  if (streng.length) return streng
  return quelle.filter((item) => trifftUngefaehr(suchwoerter, titel(item)))
}
