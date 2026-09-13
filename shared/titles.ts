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

      Dieselbe Reihe zeigte „Staffel 3 - Teil 1" neben „Staffel 3 Teil 2"
      (Daniel, 12.09.2026: „außerdem fehlt der bindestrich bei teil 2"). Der
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
export function hauptstaffeln<T extends { format?: string; beiwerk?: boolean }>(teile: T[]): T[] {
  const hatTv = teile.some((m) => m.format === 'TV')
  return teile.filter((m) => (hatTv ? m.format === 'TV' : istStaffel(m.format) && !m.beiwerk))
}

/**
 * **Welche Staffel und welcher Teil ein Eintrag ist — gezählt, nicht an der Position abgelesen.**
 *
 * Daniel am 13.09.2026 an Mushoku Tensei, mit zwei Bildern: Im Kopf stand
 * „Staffel 5" über der dritten Staffel, und der erste Eintrag der Liste hieß
 * wie die Reihe statt „Staffel 1". AniList führt die zweite Hälfte einer
 * geteilten Staffel als eigenen Eintrag („Cour 2"); gezählt wurde nach
 * Position, und so wurden aus drei Staffeln fünf. Seine Vorgabe: „teil 2 …
 * ist eig teil von der 1. staffel … unter staffel 1 gebündelt (teil 1 - teil 2)".
 *
 * Die Regeln, der Reihe nach über die Ausstrahlung:
 *
 * - Nennt der Name eine Staffel („Staffel 2", „Staffel 2 - Teil 2"), gilt sie.
 * - Nennt er **nur** einen Teil ab 2, gehört er zur Staffel davor.
 * - Nennt er nichts, ist er die nächste Staffel. Trägt er einen eigenen Namen
 *   („Log: Fish-Man Island Saga"), behält er ihn und bekommt keine Beschriftung.
 *
 * Nummern gibt es nur, wo sie etwas unterscheiden: bei **mindestens zwei**
 * Staffeln ohne eigenen Namen — sonst hieße One Piece wieder „Staffel 1"
 * (Daniel, 03.09.2026). Hat eine Staffel Teile, heißen alle ihre Einträge
 * „Staffel N - Teil M", der erste also „Teil 1".
 *
 * Zurück kommt nur, was eine Beschriftung bekommt; alles andere zeigt weiter
 * seinen Namen.
 */
export function staffelBeschriftungen<T extends { id: number; name: string; jpYear?: number; jpStart?: string }>(
  staffeln: T[],
  reihenName: string,
): Map<number, string> {
  const zeit = (m: T) => m.jpStart ?? String(m.jpYear ?? 9999)
  const sortiert = staffeln.slice().sort((a, b) => zeit(a).localeCompare(zeit(b)) || a.id - b.id)
  const eintraege: { id: number; staffel: number; teil?: number; eigenerName: boolean }[] = []
  let aktuell = 0
  for (const m of sortiert) {
    const voll = eindeutschenStaffel(m.name)
    const rest = voll.toLowerCase().startsWith(reihenName.toLowerCase())
      ? voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim()
      : voll
    const mitStaffel = /(?:^|\s)Staffel\s+(\d+)(?:\s*-\s*Teil\s+(\d+))?\s*$/i.exec(rest)
    const nurTeil = /^Teil\s+(\d+)$/i.exec(rest)
    if (mitStaffel) {
      aktuell = Number(mitStaffel[1])
      eintraege.push({ id: m.id, staffel: aktuell, teil: mitStaffel[2] ? Number(mitStaffel[2]) : undefined, eigenerName: false })
    } else if (nurTeil) {
      const teil = Number(nurTeil[1])
      if (teil === 1 || aktuell === 0) aktuell += 1
      eintraege.push({ id: m.id, staffel: aktuell, teil, eigenerName: false })
    } else {
      aktuell += 1
      eintraege.push({ id: m.id, staffel: aktuell, eigenerName: rest !== '' })
    }
  }
  const ohneNamen = new Set(eintraege.filter((e) => !e.eigenerName).map((e) => e.staffel))
  const mitTeilen = new Set(eintraege.filter((e) => (e.teil ?? 1) >= 2).map((e) => e.staffel))
  const beschriftung = new Map<number, string>()
  for (const e of eintraege) {
    if (e.eigenerName) continue
    const teil = mitTeilen.has(e.staffel) ? (e.teil ?? 1) : undefined
    if (ohneNamen.size < 2) {
      if (teil) beschriftung.set(e.id, `Teil ${teil}`)
      continue
    }
    beschriftung.set(e.id, teil ? `Staffel ${e.staffel} - Teil ${teil}` : `Staffel ${e.staffel}`)
  }
  return beschriftung
}

const JAHRESZEIT: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }

/** Reihenfolge innerhalb einer Reihe: nach japanischer Ausstrahlung. */
export function nachAusstrahlung<T extends Pick<Title, 'jpYear' | 'jpSeason' | 'id'>>(a: T, b: T): number {
  return (
    (a.jpYear ?? 9999) - (b.jpYear ?? 9999) ||
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
 * früheste Eintrag überhaupt.
 */
export function reihenVertreter<T extends Pick<Title, 'jpYear' | 'jpSeason' | 'id' | 'format'>>(
  mitglieder: T[],
): T {
  const sortiert = mitglieder.slice().sort(nachAusstrahlung)
  return sortiert.find((m) => istStaffel(m.format)) ?? sortiert[0]
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
