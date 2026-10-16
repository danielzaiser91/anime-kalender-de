/**
 * **Netflix führt alle Staffeln unter einer Adresse — wir führen jede als eigenen Titel** (16.10.2026).
 *
 * Die Erweiterung meldet je Folge `staffelNr` und `staffelText` („Staffel 2 (13 Folgen)", so steht es im
 * Auswahlfeld; `extension/netflix-staffel.js`). Hier wird daraus der Titel: Netflix-Staffel N ist unser N-ter
 * Titel an der Adresse (nach Erstausstrahlung), wenn dessen Folgenzahl genau die des Menüeintrags ist.
 * Das ist keine Zuordnung nach Reihenfolge allein (28.08.2026 gestrichen), sondern Reihenfolge **und** Folgenzahl
 * je Staffel, und jede Abweichung lässt die Adresse unberührt. Zusätzlich müssen unsere Folgenzahlen **Position für Position**
 * Netflix' Staffelliste gleichen (`data/anbieter-staffeln.json`): Devil May Cry (bei uns [12, 8], Netflix [8, 8]) hat gleich
 * viele Serien wie das Menü Staffeln, und Netflix-Staffel 2 (8 Folgen) träfe sonst die 2025er Serie, unsere Staffel 1.
 */
import type { Title } from '../../shared/types.ts'

type Zeile = {
  url: string
  plattform?: string | null
  nummer: number | null
  staffel_nr: number | null
  staffel_text: string | null
  titel_id: number | null
}

/** Die Folgenzahl, die der Menütext nennt („(13 Folgen)"); das Altersfreigabe-Kästchen steht ohne dieses Wort. */
export function folgenzahlAusMenue(text: string | null): number | null {
  const treffer = /(\d+)\s*(?:Folgen|Folge|Episoden|Episode|Episodes)\b/i.exec(text ?? '')
  return treffer ? Number(treffer[1]) : null
}

/** Netflix' Staffelliste je Kennung (`data/anbieter-staffeln.json`): Folgenzahl je Staffel. */
export type StaffelListen = Record<string, { staffeln?: { seq: number; folgen: number }[] } | undefined>

/** Netflix' Folgenzahlen in Staffelreihenfolge; `null`, wo die Liste fehlt oder nicht von 1 an lückenlos zählt. */
function netflixFolgenliste(url: string, listen: StaffelListen): number[] | null {
  const id = /netflix\.com\/(?:[a-z-]+\/)?title\/(\d+)/i.exec(url)?.[1]
  const staffeln = id ? listen[id]?.staffeln : undefined
  if (!staffeln?.length) return null
  const geordnet = [...staffeln].sort((a, b) => a.seq - b.seq)
  return geordnet.every((s, i) => s.seq === i + 1) ? geordnet.map((s) => s.folgen) : null
}

const KEINE_SERIE = new Set(['MOVIE', 'SPECIAL', 'MUSIC'])

/** Unsere Serien-Titel an einer Netflix-Adresse in Reihenfolge der Erstausstrahlung; leer, wenn die Reihenfolge nicht eindeutig ist. */
function titelAnDerAdresse(url: string, titles: Title[]): Title[] {
  const serien = titles
    .filter((t) => (t.streams ?? []).some((s) => s.url === url || s.seite === url))
    .filter((t) => !KEINE_SERIE.has(String(t.format ?? '')))
  const jahre = serien.map((t) => t.jpYear)
  if (jahre.some((j) => !j) || new Set(jahre).size !== serien.length) return []
  return serien.sort((a, b) => (a.jpYear as number) - (b.jpYear as number))
}

/** Wie viele Staffeln das Menü führt („· von 7"); die Erweiterung hängt es an den Menütext. */
export function menuelaengeAusText(text: string | null): number | null {
  const treffer = /·\s*von\s*(\d+)\s*$/.exec(text ?? '')
  return treffer ? Number(treffer[1]) : null
}

/**
 * Folgenzahl je Staffelnummer, samt Länge des Menüs; `null`, wo etwas fehlt oder widerspricht: Nummer, Zahl oder Menülänge
 * fehlen, eine Staffel nennt zwei Zahlen, die Zeilen nennen zwei Menülängen, oder eine Staffel hat mehr Zeilen oder eine
 * höhere Folgennummer als ihre Folgenzahl (dann stammt Text oder Nummer aus einer anderen Staffel).
 */
function folgenzahlJeStaffel(zeilen: Zeile[]): { je: Map<number, number>; menue: number } | null {
  const je = new Map<number, number>()
  const laengen = new Set(zeilen.map((z) => menuelaengeAusText(z.staffel_text)))
  const menue = [...laengen][0]
  if (laengen.size !== 1 || menue == null) return null
  for (const z of zeilen) {
    const n = folgenzahlAusMenue(z.staffel_text)
    if (z.staffel_nr == null || n == null || (je.has(z.staffel_nr) && je.get(z.staffel_nr) !== n)) return null
    je.set(z.staffel_nr, n)
  }
  for (const [nr, n] of je) {
    const dieser = zeilen.filter((z) => z.staffel_nr === nr)
    if (dieser.length > n || dieser.some((z) => (z.nummer ?? 0) > n)) return null
  }
  return { je, menue }
}

/**
 * Staffelnummer → unser Titel, nur wo jede gemeldete Staffel Platz und Folgenzahl trifft **und** wir genau so viele
 * Serien an der Adresse führen wie das Netflix-Menü Staffeln: bei einer Lücke (My Hero Academia: bei uns Staffel 1 und 6
 * an der Adresse, Netflix führt sieben) wäre Netflix-Staffel 2 sonst unsere Staffel 6.
 */
function ordneStaffelnZu(
  gemeldet: { je: Map<number, number>; menue: number },
  titel: Title[],
  netflix: number[] | null,
): Map<number, Title> | null {
  if (titel.length < 2 || titel.length !== gemeldet.menue) return null
  if (!netflix || netflix.length !== titel.length || titel.some((t, i) => t.episodes !== netflix[i])) return null
  const ziel = new Map<number, Title>()
  for (const [nr, anzahl] of gemeldet.je) {
    const t = titel[nr - 1]
    if (!t || t.episodes !== anzahl) return null
    ziel.set(nr, t)
  }
  return ziel
}

/**
 * Teilt jede Netflix-Adresse nach Staffel und vergibt `titel_id`. Schlüssel: `<Schlüssel der Adresse>#s<N>`;
 * Adressen, die nicht ganz aufgehen, bleiben wie sie waren.
 */
export function teileNachNetflixStaffel<R extends Zeile>(gruppen: Map<string, R[]>, titles: Title[], listen: StaffelListen): Map<string, R[]> {
  const jeAdresse = new Map<string, [string, R[]][]>()
  for (const [schluessel, liste] of gruppen) {
    const url = liste[0]!.url
    jeAdresse.set(url, [...(jeAdresse.get(url) ?? []), [schluessel, liste]])
  }
  const neu = new Map<string, R[]>()
  for (const [url, teile] of jeAdresse) {
    const zeilen = teile.flatMap(([, l]) => l)
    const gemeldet = zeilen[0]!.plattform === 'netflix' ? folgenzahlJeStaffel(zeilen) : null
    const ziel = gemeldet && ordneStaffelnZu(gemeldet, titelAnDerAdresse(url, titles), netflixFolgenliste(url, listen))
    if (!ziel) {
      for (const [schluessel, liste] of teile) neu.set(schluessel, liste)
      continue
    }
    for (const [nr, t] of ziel) {
      neu.set(`${url}#s${nr}`, zeilen.filter((z) => z.staffel_nr === nr).map((z) => ({ ...z, titel_id: t.id })))
    }
  }
  return neu
}

/**
 * Eine Netflix-Staffel, die nach Nummer und Folgenzahl ihrem Titel zugeordnet ist (Schlüssel `…#s<N>`), belegt die Sprache
 * für diesen Titel, auch wo kein Anker (aniSearch, TMDB) die einzelnen Folgen legt: Die Folgenzahl der Staffel stimmt, die
 * Tonspuren sind einheitlich. Eine Folgennummer wird nicht erfunden (`unsere: null`).
 */
export function belegtDurchStaffel<E extends { art: string }>(schluessel: string, belastbar: boolean, wahl: E): E | { art: 'titel' } {
  return wahl.art === 'offen' && belastbar && /#s\d+$/.test(schluessel) ? { art: 'titel' } : wahl
}
