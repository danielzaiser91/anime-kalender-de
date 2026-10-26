/**
 * Wie ein Anime heißt und wie eine Reihe geordnet wird.
 *
 * Steht in `shared/`, weil dieselbe Antwort an vier Stellen gebraucht wird:
 * Web-App, Teilen-Seiten, ICS-Feeds und Pipeline. Zwei Fassungen derselben
 * Regel laufen auseinander — hier ist der eine Ort.
 */
import type { Title } from './types.ts'

/**
 * „Season" kommt nicht auf die Seite.
 *
 * Die Seite heißt anime-kalender.de und ist auf Deutsch. Daniel am 12.08.2026:
 * Im Kopf des Detail-Panels stand „That Time I Got Reincarnated as a Slime
 * Season 4", vier Zeilen darunter „Meine Wiedergeburt als Schleim in einer
 * anderen Welt Staffel 4" — dasselbe Wort in zwei Sprachen, in einem Blickfeld.
 *
 * Ersetzt wird nur die **Staffelmarkierung**, nicht jedes Vorkommen: „Season"
 * mit Zahl davor oder dahinter, und „Final Season". Der Rest des Titels ist ein
 * Eigenname und bleibt unangetastet — „That Time I Got Reincarnated as a Slime
 * the Movie: Scarlet Bond" heißt so und wird nicht übersetzt.
 */
export function eindeutschenStaffel(name: string): string {
  return name
    .replace(/\bThe Final Season\b/gi, 'Die finale Staffel')
    .replace(/\bFinal Season\b/gi, 'Finale Staffel')
    // Mehrzahl zuerst, sonst greift die Einzahl-Regel nicht: AniList führt
    // „Urusei Yatsura (2022) Seasons 1 & 2" als einen Titel.
    .replace(/\bSeasons\s+(\d+)\s*(?:&|and|\+|–|-)\s*(\d+)/gi, 'Staffeln $1 & $2')
    .replace(/\b(\d+)(?:st|nd|rd|th)\s+Season\b/gi, 'Staffel $1')
    .replace(/\bSeason\s+(\d+)\b/gi, 'Staffel $1')
    // Auch „Part.2" — so heißt der zweite Teil von „Kengan Ashura: Staffel 2" bei
    // AniList; ohne Punkt-Variante blieb er ungezählt (13.09.2026).
    .replace(/\bPart\.?\s*(\d+)\b/gi, 'Teil $1')
    /*
      **„Cour" und „Part" meinen dasselbe — dann heißen sie auch gleich.**

      Daniel am 03.09.2026, mit zwei Bildern derselben Reihe: „Staffel 3 - Cour 1"
      neben „Staffel 3 Teil 2". Der eine Name stammt aus aniSearchs deutschem
      Titel, der andere entsteht hier aus „Part 2" — zwei Wege, zwei Wörter, eine
      Reihe. Sein Urteil: „Es sollte einheitlich sein."

      Gewählt ist „Teil", weil die Eindeutschung es ohnehin schon setzt: Im
      Bestand tragen 149 Titel ein „Part N", nur 26 ein „Cour". Die Mehrheit
      zurückzudrehen wäre der teurere Weg zum selben Ergebnis.

      Ein Cour ist genau genommen ein Sendequartal und nicht jeder beliebige
      Teil. Für diese Seite zählt aber, was ein deutscher Leser wiedererkennt —
      und in der Klammerform wie ohne meint es hier immer dieselbe Sache: die
      zweite Hälfte einer geteilten Staffel.
    */
    .replace(/\bCour\s+(\d+)\b/gi, 'Teil $1')
    /*
      **Und zwischen Staffel und Teil steht immer derselbe Strich.**

      Dieselbe Reihe zeigte „Staffel 3 - Teil 1" neben „Staffel 3 Teil 2".
      Der
      erste Name stammt aus aniSearchs deutschem Titel und bringt den Strich
      mit, der zweite entsteht zwei Zeilen höher aus „Part 2" und hat keinen.
      Die Regel darüber hat die Wörter vereinheitlicht, nicht ihre Fügung.
    */
    .replace(/\b(Staffel\s+\d+)\s*[-–—]?\s+(Teil\s+\d+)/gi, '$1 - $2')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Der Name, unter dem ein Titel angezeigt wird — deutsch, wo vorhanden. */
export function anzeigeName(title: Pick<Title, 'titleDe' | 'titleEn' | 'titleRomaji' | 'id'>): string {
  return eindeutschenStaffel(title.titleDe ?? title.titleEn ?? title.titleRomaji ?? `#${title.id}`)
}

/**
 * Die Hauptstaffeln einer Reihe — **eine** Regel für Kopf und Liste des Panels.
 *
 * Gibt es echte Fernsehstaffeln, zählen nur die; sonst die ONAs, ohne Beiwerk.
 * Die Begründung (Kurzformate, chinesische ONA-Specials) steht an der
 * Reihenliste in `DetailPanel.tsx`.
 */
export function hauptstaffeln<T extends { format?: string; beiwerk?: boolean; eigenesWerk?: boolean; episodes?: number; name?: string }>(teile: T[]): T[] {
  /* Eine eigene Serie der Reihe (Korra neben „Der Herr der Elemente") ist keine Staffel. */
  return hauptstaffelnAllerTeile(teile.filter((m) => !m.eigenesWerk))
}

function hauptstaffelnAllerTeile<T extends { format?: string; beiwerk?: boolean; episodes?: number; name?: string }>(teile: T[]): T[] {
  const hatTv = teile.some((m) => m.format === 'TV')
  /*
    **Eine Streaming-Staffel ist eine Staffel.** „Stone Ocean" und „Steel Ball Run" liefen
    als Netflix-Serien (ONA) und standen deshalb unter den Nebenausgaben, während die
    übrigen JoJo-Teile Hauptserie waren. Neben Fernsehstaffeln zählt
    ein ONA mit mindestens zehn Folgen, das kein Beiwerk ist — gemessen 62 Fälle, darunter
    Dorohedoro Staffel 2, Rent-a-Girlfriend Staffel 4 und 5, Beastars, Baki.
  */
  if (!hatTv) return teile.filter((m) => istStaffel(m.format) && !m.beiwerk && !istWerbeEintrag(m))
  const langeOna = teile.filter((m) => m.format === 'ONA' && !m.beiwerk && (m.episodes ?? 0) >= 10)
  /*
    Und ein kurzes ONA, das wie eine dieser Staffeln anfängt: „Steel Ball Run" führt AniList
    mit einer Folge, weil bisher nur Folge 1 erschienen ist — es ist trotzdem der Anfang der
    Staffel „STEEL BALL RUN … 2nd - 3rd STAGE". Verlangt wird, dass sein **ganzer** Name der
    Anfang einer solchen Staffel ist — zwei gemeinsame Wörter holten „Gundam Build Divers:
    Prolog" neben „Gundam Build Divers Re:Rise" mit herein.
  */
  const woerter = (name: unknown) =>
    ' ' +
    String(name ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .join(' ') +
    ' '
  const lange = langeOna.map((m) => woerter((m as { name?: string }).name))
  return teile.filter((m) => {
    if (m.format === 'TV' || langeOna.includes(m)) return true
    if (m.format !== 'ONA' || m.beiwerk) return false
    const eigen = woerter((m as { name?: string }).name)
    return eigen.trim().includes(' ') && lange.some((l) => l !== eigen && l.startsWith(eigen))
  })
}

/**
 * **Der Platz jedes Eintrags innerhalb seiner Staffel** (1-basiert, in Reihenfolge) — von hier
 * kommt der „Teil N" (02.10.2026). Ein fremder Name zählt anders (AniList Cours, MAL Teile);
 * unsere Liste zählt ihre eigenen Glieder.
 */
function plaetzeInStaffel(eintraege: { id: number; staffel: number }[]): Map<number, number> {
  const platz = new Map<number, number>()
  const gezaehlt = new Map<number, number>()
  for (const e of eintraege) {
    const n = (gezaehlt.get(e.staffel) ?? 0) + 1
    gezaehlt.set(e.staffel, n)
    platz.set(e.id, n)
  }
  return platz
}

type StaffelEintrag = { id: number; staffel: number; teil?: number; eigenerName: boolean }
type StaffelFeld = {
  id: number
  name: string
  jpYear?: number
  jpStart?: string
  staffelQuelle?: number
  /** Kennung des Originals, wenn dieser Eintrag eine Neuverfilmung ist (`zaehlgruppen`). */
  remakeVon?: number
}

/** Sortierschlüssel der Ausstrahlung: Start, sonst Jahr (`jahrZumSortieren`). */
export function ausstrahlungsZeit(m: { jpYear?: number; jpStart?: string }): string {
  return m.jpStart ?? String(jahrZumSortieren(m.jpYear))
}

/**
 * **Welche Staffel und welcher Teil ein Eintrag ist — gezählt, nicht an der Position abgelesen.**
 *
 * Daniel am 13.09.2026 an Mushoku Tensei: Im Kopf stand „Staffel 5" über der
 * dritten Staffel, der erste Listeneintrag hieß wie die Reihe. AniList führt die
 * zweite Hälfte einer geteilten Staffel als eigenen Eintrag („Cour 2"), gezählt
 * wurde nach Position — aus drei Staffeln wurden fünf („teil 2 … ist eig teil
 * von der 1. staffel … unter staffel 1 gebündelt").
 *
 * Die Regeln, der Reihe nach über die Ausstrahlung:
 *
 * - Nennt der Name eine Staffel („Staffel 2", „Staffel 2 - Teil 2"), gilt sie.
 * - Nennt er **nur** einen Teil ab 2, gehört er zur Staffel davor.
 * - Nennt er nichts, ist er die nächste Staffel. Trägt er einen eigenen Namen
 *   („Log: Fish-Man Island Saga"), behält er ihn und bekommt keine Beschriftung.
 *
 * Nummern gibt es nur, wo sie etwas unterscheiden: bei **mindestens zwei**
 * Staffeln ohne eigenen Namen — sonst hieße One Piece wieder „Staffel 1". Hat
 * eine Staffel Teile, heißen alle ihre Einträge „Staffel N - Teil M".
 *
 * Zurück kommt nur, was eine Beschriftung bekommt; alles andere zeigt weiter
 * seinen Namen.
 */
/** Ordnet jeden Eintrag einer Staffel zu (Regeln: siehe oben); `staffelBeschriftungen()` und `staffelStaende()` lesen daraus. */
function zaehleStaffeln<T extends StaffelFeld>(staffeln: T[], reihenName: string): StaffelEintrag[] {
  const sortiert = staffeln.slice().sort((a, b) => ausstrahlungsZeit(a).localeCompare(ausstrahlungsZeit(b)) || a.id - b.id)
  const eintraege: StaffelEintrag[] = []
  let aktuell = 0
  for (const m of sortiert) {
    /* Nennt die belegte deutsche Quelle eine Staffel, gilt sie (86: Eighty Six, 01.10.2026). */
    if (m.staffelQuelle) {
      eintraege.push({ id: m.id, staffel: (aktuell = m.staffelQuelle), eigenerName: false })
      continue
    }
    const voll = eindeutschenStaffel(m.name)
    const rest = voll.toLowerCase().startsWith(reihenName.toLowerCase())
      ? voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim()
      : voll
    /*
      Steht nach dem Reihennamen noch ein eigener Name vor „Staffel N", zählt die
      Nummer zu diesem Namen, nicht zur Reihe: „Pokémon: Schwarz & Weiß Staffel 2"
      ist nicht Pokémon Staffel 2.
    */
    const kern = (x: string) => x.normalize('NFD').replace(/\p{M}|[^\p{L}\p{N}]/gu, '').toLowerCase()
    const vorStaffel = kern(rest.replace(/Staffel\s+\d+[\s\S]*$/i, ''))
    const reihenKern = kern(reihenName)
    /*
      Beginnt der Name mit dem Reihennamen, darf danach nur „Staffel" stehen („Pokémon:
      Schwarz & Weiß Staffel 2" ist nicht Pokémon Staffel 2, Daniel 17.09.2026). Beginnt
      er anders, gilt die Nummer weiter (andere Sprache: „Sousou no Frieren 3rd Season") —
      außer ein kurzer Name fängt gleich an und ist doch ein anderer („PokéOki SEASON 2").
    */
    const eigenerVorsatz =
      rest !== voll
        ? vorStaffel !== ''
        : vorStaffel !== '' &&
          !vorStaffel.includes(reihenKern) &&
          !reihenKern.includes(vorStaffel) &&
          vorStaffel.length <= 10 &&
          vorStaffel.slice(0, 3) === reihenKern.slice(0, 3)
    /* „Staffel 2 - Teil 2" und die Klammer-Form „Staffel 2 (Teil 2)" (Hanako) meinen dasselbe. */
    const mitStaffel = eigenerVorsatz ? null : /(?:^|\s)Staffel\s+(\d+)(?:\s*-\s*Teil\s+(\d+)|\s*\(Teil\s+(\d+)\))?\s*$/i.exec(rest)
    const nurTeil = /^Teil\s+(\d+)$/i.exec(rest)
    if (mitStaffel) {
      aktuell = Number(mitStaffel[1])
      const teil = mitStaffel[2] ?? mitStaffel[3]
      eintraege.push({ id: m.id, staffel: aktuell, teil: teil ? Number(teil) : undefined, eigenerName: false })
    } else if (nurTeil) {
      const teil = Number(nurTeil[1])
      if (teil === 1 || aktuell === 0) aktuell += 1
      eintraege.push({ id: m.id, staffel: aktuell, teil, eigenerName: false })
    } else {
      aktuell += 1
      /* „Reihe (Teil 2)" ist die deutsche Marke der nächsten Staffel, kein eigener Name: Staffel 2 statt „Staffel 2 · (Teil 2)" (Bookworm, Daniel 11.10.2026). Nur im Originalnamen: „(Cour 2)" wird erst durch das Eindeutschen zu „(Teil 2)", ist aber die Hälfte einer Staffel (Spy × Family). */
      const staffelMarke = /^\(Teil\s+\d+\)$/i.test(rest) && /\(Teil\s+\d+\)\s*$/i.test(m.name)
      eintraege.push({ id: m.id, staffel: aktuell, eigenerName: rest !== '' && !staffelMarke })
    }
  }
  return eintraege
}

/**
 * **Zählgruppen einer Reihe: das Original und je Neuverfilmung eine eigene Linie** (Daniel, 26.10.2026: Yaiba 2025
 * ist ein Remake von Staffel 1 und stand als „Staffel 2"). Eine Neuverfilmung (`remakeVon`) und alles, was danach
 * startet, zählt für sich von 1; was davor liegt, bleibt in der Gruppe des Originals. Ohne Neuverfilmung kommt die
 * Liste unverändert als eine Gruppe zurück. Reihenfolge: Original-Linie zuerst, dann nach Start der Neuverfilmung.
 */
export function zaehlgruppen<T extends Pick<StaffelFeld, 'id' | 'jpYear' | 'jpStart' | 'remakeVon'>>(teile: T[]): T[][] {
  const frueher = (a: T, b: T) => ausstrahlungsZeit(a).localeCompare(ausstrahlungsZeit(b)) || a.id - b.id
  const wurzeln = teile.filter((m) => m.remakeVon !== undefined).sort(frueher)
  if (!wurzeln.length) return [teile]
  const gruppen: T[][] = [[], ...wurzeln.map((): T[] => [])]
  for (const m of teile) {
    const nummer = wurzeln.filter((w) => frueher(w, m) <= 0).length
    gruppen[nummer]!.push(m)
  }
  return gruppen.filter((g) => g.length > 0)
}

/** Die Zählgruppe, in der `id` liegt (leer, wenn die Kennung nicht in `teile` steht). */
export function zaehlgruppeVon<T extends Pick<StaffelFeld, 'id' | 'jpYear' | 'jpStart' | 'remakeVon'>>(teile: T[], id: number): T[] {
  return zaehlgruppen(teile).find((g) => g.some((m) => m.id === id)) ?? []
}

/** Rechnet je Zählgruppe für sich; eine einzige Gruppe läuft unverändert mit dem übergebenen Reihennamen. */
function jeZaehlgruppe<T extends StaffelFeld, R>(
  staffeln: T[],
  reihenName: string,
  rechne: (gruppe: T[], name: string) => Map<number, R>,
): Map<number, R> {
  const gruppen = zaehlgruppen(staffeln)
  if (gruppen.length < 2) return rechne(staffeln, reihenName)
  const klein = (x: string) => x.toLowerCase()
  const ergebnis = new Map<number, R>()
  for (const gruppe of gruppen) {
    /* Der übergebene Name gilt für die Gruppe, die ihn trägt; die anderen heißen nach ihrem ersten Teil. */
    const traegt = gruppe.some((m) => klein(m.name).startsWith(klein(reihenName)))
    const erster = gruppe.slice().sort((a, b) => ausstrahlungsZeit(a).localeCompare(ausstrahlungsZeit(b)) || a.id - b.id)[0]!
    const name = traegt ? reihenName : reihenAnfang(ohneStaffelEins(erster.name), gruppe.map((m) => m.name))
    for (const [id, wert] of rechne(gruppe, name)) ergebnis.set(id, wert)
  }
  return ergebnis
}

export function staffelBeschriftungen<T extends StaffelFeld>(staffeln: T[], reihenName: string): Map<number, string> {
  return jeZaehlgruppe(staffeln, reihenName, beschrifteGruppe)
}

function beschrifteGruppe<T extends StaffelFeld>(staffeln: T[], reihenName: string): Map<number, string> {
  const eintraege = zaehleStaffeln(staffeln, reihenName)
  const ohneNamen = new Set(eintraege.filter((e) => !e.eigenerName).map((e) => e.staffel))
  const mitTeilen = new Set(eintraege.filter((e) => (e.teil ?? 1) >= 2).map((e) => e.staffel))
  /*
    **Der „Teil N" zählt innerhalb der Staffel, nicht nach dem fremden Namen** (02.10.2026).
    AniList führt Slime S4 als „Part 1 & 2" plus „Part 3" (`第3クール`), MAL als „4th Season" plus
    „Part 2"; wir hatten den fremden Namen wörtlich genommen („Staffel 4 - Teil 3" neben einem
    MAL-Link mit „Teil 2", Daniel). Gezählt wird deshalb die Reihenfolge — der Name entscheidet
    weiterhin nur, **ob** eine Staffel Teile hat.
  */
  const platz = plaetzeInStaffel(eintraege)
  const beschriftung = new Map<number, string>()
  for (const e of eintraege) {
    if (e.eigenerName) continue
    const teil = mitTeilen.has(e.staffel) ? (platz.get(e.id) ?? 1) : undefined
    if (ohneNamen.size < 2) {
      if (teil) beschriftung.set(e.id, `Teil ${teil}`)
      continue
    }
    beschriftung.set(e.id, teil ? `Staffel ${e.staffel} - Teil ${teil}` : `Staffel ${e.staffel}`)
  }
  return beschriftung
}

export type StaffelNummer = { staffel: number; teil?: number; von: number; eigenerName: boolean }

/**
 * **Die Staffelnummer jedes Eintrags, auch bei eigenem Namen** (09.10.2026: „Staffel 4 von 4" für „War of the
 * Three Titans"). `staffelBeschriftungen()` nummeriert nur Teile ohne Namen; hier zählt dieselbe Rechnung alle.
 * Leer bei einer einzigen Staffel — dort unterscheidet die Nummer nichts (One Piece).
 */
export function staffelStaende<T extends StaffelFeld>(staffeln: T[], reihenName: string): Map<number, StaffelNummer> {
  return jeZaehlgruppe(staffeln, reihenName, staendeGruppe)
}

function staendeGruppe<T extends StaffelFeld>(staffeln: T[], reihenName: string): Map<number, StaffelNummer> {
  const eintraege = zaehleStaffeln(staffeln, reihenName)
  const von = Math.max(0, ...eintraege.map((e) => e.staffel))
  if (von < 2) return new Map()
  const mitTeilen = new Set(eintraege.filter((e) => (e.teil ?? 1) >= 2).map((e) => e.staffel))
  const platz = plaetzeInStaffel(eintraege)
  return new Map(
    eintraege.map((e) => [e.id, { staffel: e.staffel, teil: mitTeilen.has(e.staffel) ? (platz.get(e.id) ?? 1) : undefined, von, eigenerName: e.eigenerName }]),
  )
}

const JAHRESZEIT: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }

/** Das Jahr als Sortierwert: Jahr 0 (aniSearch: Jahr unbekannt) und fehlend heißen „noch offen" und stehen hinten. */
export function jahrZumSortieren(jpYear: number | undefined): number {
  return jpYear || 9999
}

/** Reihenfolge nach Jahr, bei Gleichstand nach Kennung. */
export function nachJahrUndId(a: { jpYear?: number; id: number }, b: { jpYear?: number; id: number }): number {
  return jahrZumSortieren(a.jpYear) - jahrZumSortieren(b.jpYear) || a.id - b.id
}

/** Reihenfolge innerhalb einer Reihe: nach japanischer Ausstrahlung. */
export function nachAusstrahlung<T extends Pick<Title, 'jpYear' | 'jpSeason' | 'id'>>(a: T, b: T): number {
  return (
    jahrZumSortieren(a.jpYear) - jahrZumSortieren(b.jpYear) ||
    (JAHRESZEIT[a.jpSeason ?? ''] ?? 9) - (JAHRESZEIT[b.jpSeason ?? ''] ?? 9) ||
    a.id - b.id
  )
}

/** Reguläre Staffel oder Beiwerk (Film, OVA, Special)? */
/**
 * **Zwei Reihenteile dürfen nicht gleich heißen.**
 *
 * Gemessen am 03.09.2026 an `franchises.json`: In **74 Reihen** tragen zwei oder
 * mehr Einträge genau dieselbe Beschriftung — dreimal „Bleach: Thousand-Year
 * Blood War", zweimal „Fruits Basket", und bei „Meine Wiedergeburt als Schleim"
 * zweimal „Staffel 2". Wer die Liste öffnet, kann nicht sehen, was er anklickt;
 * genau das hat Daniel am 02.09.2026 gemeldet: „es ist total unklar was man dort
 * anklickt".
 *
 * Der Unterschied steht im **Originaltitel**, nur nicht im deutschen: AniList
 * führt „2nd Season" und „2nd Season Part 2", die deutsche Fassung nennt beide
 * „Staffel 2". Diese Funktion holt den Zusatz von dort zurück.
 *
 * **Gezählt wird ab dem ersten abweichenden Wort**, nicht ab einem festen
 * Muster: „Part 2", „Part 3 - The Conflict", „Season 2 Part 2" — die Formen sind
 * zu verschieden für eine Wortliste, und eine Wortliste wäre genau das, was
 * dieses Projekt bei Folgenzuordnungen ausdrücklich nicht will.
 *
 * Gibt das Original nichts her (beide Originale gleich), bleibt der Name wie er
 * ist — eine erfundene Unterscheidung wäre schlimmer als eine fehlende.
 */
export function unterscheidenderZusatz(
  original: string | undefined,
  geschwisterOriginal: string | undefined,
): string | undefined {
  if (!original || !geschwisterOriginal || original === geschwisterOriginal) return undefined
  const worte = (x: string) => x.split(/\s+/).filter(Boolean)
  const a = worte(original)
  const b = worte(geschwisterOriginal)
  /*
    **Ein Doppelpunkt macht aus zwei gleichen Wörtern keine verschiedenen.**

    Verglichen wurde Wort gegen Wort, mitsamt der Interpunktion — und
    „Clover:" ist nicht „Clover". Bei „Black Clover" gegen „Black Clover:
    Jump Festa 2016 Special" endete der gemeinsame Teil damit nach „Black",
    und die Serie hieß in der Reihenliste **„Black Clover — Clover"** (Daniel,
    04.09.2026: „woher kommt das? — entfernen").

    Der Zusatz soll sagen, was **nach** dem gemeinsamen Namen kommt. Ein
    Trennzeichen gehört zum Namen davor, nicht zum Unterschied dahinter — es
    wird beim Vergleich abgeschnitten, nicht beim Ausgeben.
  */
  const kern = (w: string) => w.toLowerCase().replace(/^[\s:–—\-.,!?]+|[\s:–—\-.,!?]+$/g, '')
  let i = 0
  while (i < a.length && i < b.length && kern(a[i]!) === kern(b[i]!)) i++
  const rest = a.slice(i).join(' ').replace(/^[\s:–—-]+/, '').trim()
  if (!rest) return undefined
  /* „Part 2" heißt auf Deutsch „Teil 2" — dieselbe Ersetzung wie in `werkTitel`. */
  return rest.replace(/\b(?:Part|Cour)\s+(\d+)\b/gi, 'Teil $1')
}

export function istStaffel(format: string | undefined): boolean {
  return format === 'TV' || format === 'TV_SHORT' || format === 'ONA'
}

/* AniList führt Werbung als eigene ONA/Special („Jujutsu Kaisen PV", „Violet Evergarden CM"). */
const WERBE_KUERZEL = /\b(?:PV|CM)\b/
const WERBE_WORT = /\b(?:trailer|teaser|promo|promotion|commercial)\b|opening movie/i

type Namensfelder = { name?: string; titleDe?: string; titleEn?: string; titleRomaji?: string }

/**
 * Ist der Eintrag Werbung (PV, Trailer, CM, Opening Movie) und keine Staffel?
 * Die Kürzel nur groß: „5 cm" (Maßangabe) ist keine Werbung.
 * Gemessen 12.10.2026: 30 solcher Namen in 899 Reihen, alle echte Werbung, kein Fehltreffer.
 */
export function istWerbeEintrag(m: Namensfelder): boolean {
  return [m.name, m.titleDe, m.titleEn, m.titleRomaji].some((s) => s !== undefined && (WERBE_KUERZEL.test(s) || WERBE_WORT.test(s)))
}

/**
 * Wer eine Reihe auf einer einzigen Kachel vertritt.
 *
 * Bis zum 12.08.2026 war das schlicht der **neueste** Eintrag — mit der
 * Begründung, ältere Staffeln lägen ohnehin in der Vergangenheit. Das Ergebnis
 * sah Daniel bei einer Suche nach „slime": Vertreter waren
 * „I've Been Killing Slimes … Season 2" und „That Time I Got Reincarnated as a
 * Slime the Movie: Tears of the Azure Sea" — eine Fortsetzung und ein Film,
 * während die beiden gesuchten Serien selbst nirgends auftauchten.
 *
 * Wer eine Reihe sucht, meint ihren Anfang. Vertreter ist deshalb die **erste
 * reguläre Staffel**; gibt es keine (eine Reihe aus lauter Filmen), der
 * früheste Eintrag überhaupt. Werbung (PV, CM, Trailer) ist keins von beidem, solange
 * es etwas anderes gibt: „Jujutsu Kaisen PV" (ONA 2018) vertrat die Serie von 2020.
 */
export function reihenVertreter<T extends Pick<Title, 'jpYear' | 'jpSeason' | 'id' | 'format'> & Namensfelder>(
  mitglieder: T[],
): T {
  const sortiert = mitglieder.slice().sort(nachAusstrahlung)
  return sortiert.find((m) => istStaffel(m.format) && !istWerbeEintrag(m)) ?? sortiert.find((m) => !istWerbeEintrag(m)) ?? sortiert[0]
}

/**
 * **Wie die Reihe heißt, wenn der Name ihres ersten Teils einen Teil-Untertitel trägt.**
 *
 * Über „Code Geass: Akito the Exiled - The Brightness Falls" stand als Reihenname
 * „Code Geass: Akito the Exiled - Der zerrissene Wyvern — Arrives" — der Name des
 * ersten Films. Die Teile-Box darunter konnte deshalb den gemeinsamen Anfang nicht
 * abziehen, und jeder Eintrag begann mit „Code Geass: Akito the Exiled - …" (Daniel,
 * 16.09.2026: „titel ganz oben muss nur code geass: Akito the Exiled sein, und unten
 * … kann dieser teil überall entfernt werden").
 *
 * **Gewählt wird der längste Anfang des Kopfnamens, den die Mehrheit der Teile
 * trägt** — erst der volle Name, dann an jeder Trennstelle kürzer. Drei Riegel, jeder
 * aus einem Fehlgriff beim Durchmessen über alle 467 Reihen:
 *
 * - **Der volle Name ist der erste Kandidat.** Ohne ihn wurde „Demon Slayer: Kimetsu
 *   no Yaiba" zu „Demon Slayer" — der Untertitel gehört dort zum Werk, nicht zu einem Teil.
 * - **Die Mehrheit, nicht alle.** Ein einziger Teil mit abweichendem Namen („Code Geass:
 *   Boukoku no Akito 2 - …", ohne deutschen Titel) hätte sonst „Code Geass" erzwungen.
 * - **Trennzeichen sind gleichwertig, und ein Wort darf direkt folgen.** „Cat’s Eye –
 *   Ein Supertrio" und „Cat’s Eye: Ein Supertrio" sind derselbe Name; „Star Wars:
 *   Visionen Volume 3" trägt „Star Wars: Visionen" ohne Trennzeichen dazwischen. Ohne
 *   diese beiden Regeln hieß die Anthologie nur noch „Star Wars".
 *
 * Gemessen danach: 38 von 467 Reihen bekommen einen kürzeren Namen, alle in der Form
 * „Reihe: Teil" → „Reihe" (Rurouni Kenshin, Sailor Moon, City Hunter, Resident Evil …).
 */
export function reihenAnfang(kopf: string, namen: string[], kopfIstDeutsch = false): string {
  const vereinheitlicht = (x: string) =>
    x
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/\s*[:–—]\s+|\s+-\s+/g, ' | ')
      .replace(/\s+/g, ' ')
      .trim()
  const traegt = (name: string, anfang: string) => {
    const a = vereinheitlicht(name)
    const b = vereinheitlicht(anfang)
    return a === b || a.startsWith(b + ' ')
  }
  const anfaenge = (name: string) => [
    name,
    ...[...name.matchAll(/\s*[:–—]\s|\s-\s/g)].map((m) => name.slice(0, m.index).trim()).reverse(),
  ]
  const traeger = (anfang: string) => namen.filter((n) => traegt(n, anfang)).length
  /* Ein gekürzter Anfang braucht zwei Wörter („Code" ist keine Reihe); ein ganzer Name
     darf eines haben („Berserk", „K"). */
  const zuKurz = (anfang: string) => !namen.includes(anfang) && anfang !== kopf && anfang.split(/\s+/).length < 2
  for (const anfang of anfaenge(kopf)) {
    if (zuKurz(anfang)) continue
    if (traeger(anfang) * 2 > namen.length) return anfang
  }
  /* Kein Anfang des Kopfes trägt die Mehrheit: Der erste Teil heißt anders als die Reihe
     („Jujutsu Kaisen PV", „Dragon Warrior" über „Dragon Quest: …"). Dann gilt der Anfang,
     den die meisten Teile teilen. Ein deutscher Kopfname bleibt aber stehen — „Mila
     Superstar" kennt hier jeder, „Attack No.1" niemand. Bei Gleichstand gewinnt ein
     gemeinsamer Anfang gegen den vollen Namen eines einzelnen Teils („Management of
     Novice Alchemist" statt „…: Mini Anime"), sonst der längere. */
  if (kopfIstDeutsch) return kopf
  let bester = ''
  let besteZahl = 0
  let besterIstTeil = true
  for (const anfang of new Set(namen.flatMap(anfaenge))) {
    if (zuKurz(anfang)) continue
    const zahl = traeger(anfang)
    if (zahl * 2 <= namen.length) continue
    const istTeil = namen.includes(anfang)
    const besser =
      zahl > besteZahl ||
      (zahl === besteZahl && besterIstTeil && !istTeil) ||
      (zahl === besteZahl && besterIstTeil === istTeil && anfang.length > bester.length)
    if (besser) {
      bester = anfang
      besteZahl = zahl
      besterIstTeil = istTeil
    }
  }
  return bester || kopf
}

/**
 * Name einer Reihe — ohne den Staffelzusatz der ersten Staffel.
 *
 * Der deutsche Name der ersten Staffel heißt oft schon „… – Staffel 1", weil er
 * aus einer Disc-Ausgabe stammt. Als Überschrift einer Reihe, unter der dann
 * „Staffel 1" und „Staffel 2" zur Auswahl stehen, wäre das eine Zählung zu
 * viel.
 */
export function ohneStaffelEins(name: string): string {
  return eindeutschenStaffel(name)
    .replace(/\s*[–—-]?\s*\(?(Staffel|Season)\s*1\)?\s*$/i, '')
    .trim()
}

/**
 * Ist die deutsche Synchro belegt? Anime: Stufe „stark“ oder höher (dieselbe Schwelle wie die Zahl „belegt“ in der Fußzeile);
 * Cartoons: ein Weg mit `dub: true` (nicht schon „laut JustWatch“). Darunter heißt es „angekündigt oder wahrscheinlich“.
 */
export function synchroBelegt(t: Pick<Title, 'dubConfidence' | 'westlich' | 'streams'>): boolean {
  if (t.westlich) return (t.streams ?? []).some((s) => s.dub === true)
  return t.dubConfidence === 'high' || t.dubConfidence === 'very-high'
}
