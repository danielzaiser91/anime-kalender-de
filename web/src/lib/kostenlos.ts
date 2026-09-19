/**
 * **Wie viel von einem Titel kostenlos zu sehen ist** (Daniel, 19.09.2026: „toggo (nicht
 * toggo plus) und youtube links sind beispiele für kostenlose streaming services, sie
 * sollten ein label beim anime ‚kostenlos' oder ‚teilweise kostenlos' hinzufügen, je nach
 * verfügbarkeit und anzahl der kostenlos schaubaren episoden im vergleich zum gesamt
 * bestand an existierenden folgen mit deutscher synchro").
 *
 * Gezählt wird je kostenlosem Weg (`zugang: 'kostenlos'`):
 * - TOGGO: die Folgen, deren Fenster **jetzt** offen ist (`toggo`-Blöcke);
 * - ein einzelnes Video (YouTube `watch?v=` ohne Liste, `nurFolge`): eine Folge;
 * - Folgenbereiche mit deutscher Fassung (`dubRanges`): ihre Folgen;
 * - sonst: unbekannt — es gibt den Weg, aber keine Zahl.
 *
 * Wege werden nicht addiert, sondern der größte gilt: Ob TOGGO und YouTube dieselben
 * Folgen zeigen, wissen wir nicht, und eine Summe könnte „alle" behaupten, wo es nicht
 * stimmt.
 */
import type { StreamLink, WatchLink } from '@shared/types.ts'
import { jetztBerlin } from './toggo.ts'

export type Kostenlos = { frei?: number; unbekannt: boolean }

const einVideo = (url: string) => /youtube\.com\/watch\?/.test(url) && !/[?&]list=/.test(url)

function zahlFuer(w: Partial<WatchLink & StreamLink>, jetzt: string): number | undefined {
  if (w.toggo) return w.toggo.filter((b) => b.ab <= jetzt && jetzt < b.ende).reduce((n, b) => n + b.bis - b.von + 1, 0)
  if (w.nurFolge != null || einVideo(w.url ?? '')) return 1
  const deutsch = (w.dubRanges ?? []).filter((r) => r.dub)
  if (deutsch.length) return deutsch.reduce((n, r) => n + r.to - r.from + 1, 0)
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
  let frei: number | undefined
  let unbekannt = false
  for (const w of wege) {
    const n = zahlFuer(w, jetzt)
    if (n === undefined) unbekannt = true
    else if (n > 0) frei = Math.max(frei ?? 0, n)
  }
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
