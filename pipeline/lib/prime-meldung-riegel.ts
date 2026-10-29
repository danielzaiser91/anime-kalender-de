import { resolve } from 'node:path'
import { ROOT, readJson } from './util.ts'
import { istEntfernt, ladeBelegeEntfernt, type BelegEntfernt } from './belege-entfernt.ts'
import { adressGleich, type DubCheck } from './dub-confirmed.ts'

/** Führt ein Handbeleg eines **anderen** Titels diese Adresse auf dieser Plattform? Dann gilt die Meldung nicht ihr. */
export function adresseFremdBelegt(alleChecks: DubCheck[], titleId: number, plattform: string, adresse: string | null): boolean {
  if (!adresse) return false
  return alleChecks.some((c) => c.platform === plattform && c.url && c.anilistId !== titleId && adressGleich(c.url, adresse))
}

/**
 * Verneint ein Handbeleg dieses Titels genau diese Adresse (`available: false` oder `dub: false`)?
 * Wie `check:handbelege`: Es zählt die Adresse jedes Nein-Belegs, nicht nur der zusammengeführte Beleg je Titel und Plattform (`checks`).
 * Bewusst nicht `wegVerneint`: Das sperrt die ganze Plattform und würde 11 Wege entfernen, die der Datensatz heute führt (Messung 19.10.2026).
 */
export function adresseVerneint(alleChecks: DubCheck[], titleId: number, plattform: string, adresse: string | null): boolean {
  if (!adresse) return false
  return alleChecks.some(
    (c) =>
      c.anilistId === titleId && c.platform === plattform && c.url && adressGleich(c.url, adresse) && (c.available === false || c.dub === false),
  )
}

/** Der eine Zugang zu `data/prime-zugeordnet.json`: Meldungen ohne die in `data/belege-entfernt.yaml` gesperrten Seiten, für jeden Leser und den Zuordner-Schreibweg. */
export function leseZugeordnet<T extends { titleId: number; seite?: string | null }>(roh?: Record<string, T>): Record<string, T> {
  return Object.fromEntries(ohneGesperrteSeiten(roh ?? readJson<Record<string, T>>('data/prime-zugeordnet.json', {})))
}

/** Die Meldungen aus `prime-zugeordnet.json` ohne die Seiten, die `data/belege-entfernt.yaml` sperrt (Kennung + Adresse; die einzige Sperrliste). */
export function ohneGesperrteSeiten<T extends { titleId: number; seite?: string | null }>(roh: Record<string, T>): [string, T][] {
  const entfernt = ladeBelegeEntfernt(resolve(ROOT, 'data/belege-entfernt.yaml'))
  return Object.entries(roh).filter(
    ([schluessel, e]) =>
      !seiteEntfernt(entfernt, e.titleId, asinAusSchluessel(schluessel)) &&
      !istEntfernt(entfernt, e.titleId, schluessel.split('#')[0]) &&
      !seiteEntfernt(entfernt, e.titleId, e.seite),
  )
}

/** Container-Schlüssel (`…?gti=…#0`) tragen die Seite nur in `seite` (eine Kennung): sie steht in `belege-entfernt.yaml` als Amazon-Adresse (`adressKern` kennt dp und gp/video/detail gleich). */
function seiteEntfernt(entfernt: readonly BelegEntfernt[], titleId: number, seite: string | null | undefined): boolean {
  if (!seite) return false
  return istEntfernt(entfernt, titleId, `https://www.amazon.de/dp/${seite}`)
}

/** Die Seitenkennung im Schlüssel einer Meldung (`…/B0D188KVH4#4`): auch ein Container, dessen Teilseite anders heißt, ist sperrbar. */
function asinAusSchluessel(schluessel: string): string | undefined {
  return /\/(?:dp|gp\/video\/detail)\/([A-Za-z0-9]{10})/.exec(schluessel)?.[1]
}
