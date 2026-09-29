import { type Release, type Title } from '@shared/types.ts'
import { folgenOhneAnbieter } from '@shared/dub-grenze.ts'
import { releaseStatus } from '@shared/logic.ts'
import type { berechneAntwort } from './antwort-berechnen.ts'

/**
 * **Welche Folgen bei keinem bekannten Anbieter liegen** (Zerlegung 29.09.2026).
 *
 * Die Dai-DVD-Box enthält 1–75, die Serie hat 100 Folgen; ohne diese Zeile blieb offen, wo
 * 76–100 zu sehen sind (Daniel, 16.09.2026). Gezählt werden **alle** Wege; einer ohne Bereiche —
 * eine aniSearch-Ausgabe, ein Stream mit „DE ?" — kann die fehlenden Folgen enthalten und gilt
 * deshalb als vollständig. So stand „76–100 bei keinem Anbieter", während aniSearch vier
 * Blu-ray-Boxen und ein Komplettset führte (Daniel, mit Bild).
 */
export function lueckeOhneAnbieter({ title, antwort, releaseJePlattform, today }: {
  title: Title | undefined
  antwort: ReturnType<typeof berechneAntwort> | undefined
  releaseJePlattform: Map<string, Release>
  today: string
}): string | null {
  if (!title || title.format === 'MOVIE') return null
  /*
    Ein Anbieter mit laufendem deutschen Wochenplan führt jede erschienene Folge — sein
    Dub-Bestand hinkt nur hinterher. Black Torch: Bestand „1–10", Folge 11 seit dem
    12.09. im Plan, und im Kasten stand „Für Folgen 11 kennen wir keinen deutschen
    Anbieter" (Stichprobe 17.09.2026). Ein solcher Weg gilt wie einer ohne Bereiche.
  */
  const laufendBei = (plattform: string): boolean => {
    const r = releaseJePlattform.get(plattform)
    return r?.releaseType === 'weekly' && releaseStatus(r, today) === 'airing'
  }
  const wege = [
    ...(title.streams ?? []).map((s) => (s.dub === true && !laufendBei(s.platform) ? s.dubRanges : undefined)),
    ...(title.watchLinks ?? []).map((w) => w.dubRanges),
  ]
  /*
    Bei einer laufenden Serie zählt nur, was erschienen ist — „Folgen 11–12 führt kein
    Anbieter" stand über „Vom Landei zum Schwertheiligen II", deren Folge 11 heute kommt
    (Daniel, 16.09.2026).
  */
  /* Im Teilweise-Zustand sagt der Kasten es schon („Für die übrigen fehlt uns eine Angabe"). */
  if (antwort?.art === 'teilweise') return null
  const gesamt = antwort?.art === 'laeuft' ? antwort.raus : title.episodes
  return folgenOhneAnbieter(wege, gesamt)
}
