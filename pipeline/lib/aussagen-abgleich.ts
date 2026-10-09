/**
 * **Aussagen dem Bestand zuordnen und abgleichen** — geteilt von PoC (`sammelartikel-poc.ts`) und Vorschlagslauf
 * (`fetch-sammelartikel.ts`). Liest nur `public/data/*`, schreibt nichts.
 */
import { Katalog, ordneZu, type KatalogTitel, type Offen, type Zuordnung } from './aussagen-zuordnung.ts'
import type { Aussage } from './aussagen.ts'
import { readJson } from './util.ts'

export interface Bestand {
  /** Was der Kalender zu diesem Titel und Anbieter schon führt. */
  status: 'neu' | 'bekannt' | 'abweichend' | 'ohne-zuordnung'
  release?: { slug: string; firstEpisodeDate?: string }
  ankuendigung?: { omuAb: string; synchro: string }
  hatSynchroBelege?: boolean
}

export interface Ergebnis extends Aussage {
  zuordnung?: Zuordnung
  offen?: Offen
  bestand: Bestand
}

export interface AusgabeTitel extends KatalogTitel { ankuendigung?: { omuAb: string; synchro: string }; ohneSynchro?: boolean }

/**
 * Katalog aus den veröffentlichten Dateien: Titel mit Synchro plus Katalog ohne. `jpStart` trägt nur der
 * Katalog; für Titel mit Synchro steht er in `franchises.json` (Reihen-Sortierung). Im Bau selbst läge
 * beides in der `jpStart`-Karte aus `bau/02-titel.ts`.
 */
export function katalogLaden(): { katalog: Katalog; titel: Map<number, AusgabeTitel> } {
  const mit = Object.values(readJson<Record<string, AusgabeTitel>>('public/data/titles.json', {}))
  const ohne = readJson<AusgabeTitel[]>('public/data/ohne-synchro.json', [])
  const synonyme = readJson<Record<string, string[]>>('public/data/synonyme.json', {})
  const reihen = readJson<Record<string, { id: number; jpStart?: string }[]>>('public/data/franchises.json', {})
  const startAusReihe = new Map<number, string>()
  for (const glieder of Object.values(reihen)) for (const g of glieder) if (g.jpStart && g.jpStart.length === 10) startAusReihe.set(g.id, g.jpStart)
  const titel = new Map<number, AusgabeTitel>()
  for (const t of [...mit, ...ohne]) {
    const alt = titel.get(t.id)
    const jpStart = t.jpStart ?? alt?.jpStart ?? startAusReihe.get(t.id)
    titel.set(t.id, { ...alt, ...t, ...(jpStart ? { jpStart } : {}), ohneSynchro: alt ? alt.ohneSynchro && t.ohneSynchro : t.ohneSynchro, synonyme: synonyme[String(t.id)] ?? [] })
  }
  return { katalog: new Katalog([...titel.values()]), titel }
}

/**
 * Was der Kalender schon weiß: Ein Start mit Tag ist `bekannt`, wenn ein Release des Titels beim Anbieter
 * denselben Tag trägt, `abweichend` bei anderem Tag. Eine Synchro-Ankündigung und ein OmU-Start sind
 * `bekannt`, wenn der Titel eine Ankündigung, ein Crunchyroll-Release oder Synchro-Belege hat.
 */
export function bestandZu(a: Aussage, z: Zuordnung | undefined, titel: Map<number, AusgabeTitel>, releases: { slug: string; titleId: number; platform: string; schedule?: { firstEpisodeDate?: string } }[]): Bestand {
  if (!z) return { status: 'ohne-zuordnung' }
  const t = titel.get(z.anilistId)
  const passend = releases.filter((r) => r.titleId === z.anilistId && a.plattformen.includes(r.platform))
  const gleich = passend.find((r) => !a.datum || r.schedule?.firstEpisodeDate === a.datum)
  const r = gleich ?? passend[0]
  const hatSynchroBelege = Boolean(t && !t.ohneSynchro)
  const status: Bestand['status'] =
    a.art === 'synchro-angekuendigt' || a.art === 'omu-start'
      ? t?.ankuendigung || passend.length || (a.deutsch !== 'nein' && hatSynchroBelege) ? 'bekannt' : 'neu'
      : gleich ? 'bekannt' : passend.length ? 'abweichend' : 'neu'
  return {
    status,
    ...(r ? { release: { slug: r.slug, ...(r.schedule?.firstEpisodeDate ? { firstEpisodeDate: r.schedule.firstEpisodeDate } : {}) } } : {}),
    ...(t?.ankuendigung ? { ankuendigung: { omuAb: t.ankuendigung.omuAb, synchro: t.ankuendigung.synchro } } : {}),
    hatSynchroBelege,
  }
}


export type BestandRelease = Parameters<typeof bestandZu>[3]

/** Aussagen → Ergebnisse (Zuordnung oder Grund fürs Offenbleiben, dazu Abgleich mit dem Bestand). */
export function ergebnisseZu(aussagen: Aussage[], katalog: Katalog, titel: Map<number, AusgabeTitel>, releases: BestandRelease): Ergebnis[] {
  return aussagen.map((a): Ergebnis => {
    const { zuordnung, offen } = ordneZu(a, katalog)
    return { ...a, ...(zuordnung ? { zuordnung } : {}), ...(offen ? { offen } : {}), bestand: bestandZu(a, zuordnung, titel, releases) }
  })
}

/** Die veröffentlichten Releases, wie `bestandZu` sie braucht. */
export function releasesLaden(): BestandRelease {
  return readJson<BestandRelease>('public/data/releases.json', [])
}
