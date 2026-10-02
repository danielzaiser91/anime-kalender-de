/**
 * **Wie viel von einem Titel kostenlos zu sehen ist**.
 *
 * **Das Etikett gehört auf die Karten nicht** — „kostenlos nur als Filter, kein Etikett auf Karten
 * oder in der Datenbank" (derselbe Durchgang, 19.09.2026; so steht es in `web/src/lib/filters.ts`).
 * Gebraucht wird die Rechnung an zwei Stellen: im Filter und — seit dem 29.09.2026 — im **Bau**,
 * der damit einen Termin als „heute kostenlos schaubar" kennzeichnen kann (Newsletter-Abzeichen).
 * Deshalb liegt sie hier und nicht mehr unter `web/`; sie rechnet mit der Berliner Uhr aus
 * `shared/time.ts`.
 *
 * Gezählt wird je kostenlosem Weg (`zugang: 'kostenlos'`):
 * - TOGGO: die Folgen, deren Fenster **jetzt** offen ist (`toggo`-Blöcke);
 * - ein einzelnes Video (YouTube `watch?v=` ohne Liste, `nurFolge`): eine Folge;
 * - Folgenbereiche mit deutscher Fassung (`dubRanges`): ihre Folgen;
 * - sonst: unbekannt — es gibt den Weg, aber keine Zahl.
 *
 * **Gezählt werden die Folgen, nicht die Wege**. Bis dahin galt der größte Weg allein — aus Sorge, zwei Wege
 * könnten dieselbe Folge zeigen und die Summe „alle" behaupten. Die Sorge löst die Vereinigung
 * sauber: Wo wir Nummern kennen (TOGGO-Fenster, `nurFolge`, `dubRanges`), zählt jede Folge genau
 * einmal, auch wenn zwei Anbieter sie führen. Nur ein Einzelvideo ohne Nummer zählt blind als eine
 * Folge — dort ist die Nummer unbekannt, aber die Menge ist es nicht.
 */
import type { StreamLink, WatchLink } from './types.ts'
import { nowHhMm, todayIso } from './time.ts'

export type Kostenlos = { frei?: number; unbekannt: boolean }

const einVideo = (url: string) => /youtube\.com\/watch\?/.test(url) && !/[?&]list=/.test(url)

/** Jetzt als „YYYY-MM-DDTHH:MM" in Berliner Ortszeit — dieselbe Form wie im Datensatz. */
export function jetztBerlin(): string {
  return `${todayIso()}T${nowHhMm()}`
}

/** Die Folgennummern eines Weges — `'eine'`, wenn es genau eine ist, deren Nummer wir nicht kennen. */
function folgenFuer(w: Partial<WatchLink & StreamLink>, jetzt: string): number[] | 'eine' | undefined {
  if (w.toggo) {
    const offen = w.toggo.filter((b) => b.ab <= jetzt && jetzt < b.ende)
    return offen.flatMap((b) => Array.from({ length: b.bis - b.von + 1 }, (_, i) => b.von + i))
  }
  if (w.nurFolge != null) return [w.nurFolge]
  const deutsch = (w.dubRanges ?? []).filter((r) => r.dub)
  if (deutsch.length) return deutsch.flatMap((r) => Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i))
  if (einVideo(w.url ?? '')) return 'eine'
  return undefined
}

/** `undefined`, wenn es keinen kostenlosen Weg gibt — oder nur TOGGO mit gerade geschlossenem Fenster. */
export function kostenloseFolgen(
  title: { streams?: StreamLink[]; watchLinks?: WatchLink[] },
  jetzt = jetztBerlin(),
): Kostenlos | undefined {
  const wege: Partial<WatchLink & StreamLink>[] = [
    ...(title.watchLinks ?? []).filter((w) => w.kind === 'stream' && w.zugang === 'kostenlos'),
    ...(title.streams ?? []).filter((s) => s.zugang === 'kostenlos' && s.dub !== false),
  ]
  const nummern = new Set<number>()
  let ohneNummer = 0
  let unbekannt = false
  for (const w of wege) {
    const f = folgenFuer(w, jetzt)
    if (f === undefined) unbekannt = true
    else if (f === 'eine') ohneNummer++
    else for (const n of f) nummern.add(n)
  }
  const frei = nummern.size + ohneNummer
  return frei || unbekannt ? { ...(frei ? { frei } : {}), unbekannt } : undefined
}

/**
 * Das Etikett: „kostenlos", wenn die freien Folgen alle deutschen abdecken, sonst
 * „teilweise kostenlos" — und „auch kostenlos", wenn wir die freien nicht zählen können.
 */
export function kostenlosEtikett(k: Kostenlos | undefined, deutsch: number | undefined): 'ganz' | 'teil' | 'auch' | undefined {
  if (!k) return undefined
  if (k.frei && deutsch && k.frei >= deutsch) return 'ganz'
  /* Ein Weg ohne Zahl könnte den Rest abdecken — dann kein „teilweise". */
  if (k.frei && deutsch && !k.unbekannt) return 'teil'
  return 'auch'
}
