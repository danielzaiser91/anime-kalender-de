import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { DubConfidence, Release, Title } from '../../shared/types.ts'
import { loadDubChecks } from './dub-confirmed.ts'
import { loadSynchroVonHand } from './curated.ts'
import { ROOT } from './util.ts'

/**
 * **Belegstärke statt Quellenzahl** (Daniel, 09.10.2026): `dubConfidence` war die Zahl der MyDubList-Stimmen. Jetzt zählt die beste Quelle.
 * Stark: Synchronkartei-Eintrag, Anbieter-Tonspur (darin der Handbeleg aus `dub-confirmed.yaml`). Mittel: TV-Programmdaten, aniSearch-Marke
 * „Synchronisiert". Schwach (MyDubList, AniList-Sprecher, Händler) hebt nie über `low`.
 */
export type Belegsignale = { handbelegt: ReadonlySet<number>; kartei: ReadonlySet<number>; tv: ReadonlySet<number> }

type Kette = Pick<Title, 'id' | 'streams' | 'deErstausgabe'>

/** high = eine starke oder zwei mittlere; very-high = starke plus eine zweite, unabhängige starke oder mittlere. */
export function belegstaerke(t: Kette, s: Belegsignale): DubConfidence {
  const anbieter = Boolean(t.streams?.some((st) => st.dub === true)) || s.handbelegt.has(t.id)
  const stark = Number(anbieter) + Number(s.kartei.has(t.id))
  const mittel = Number(s.tv.has(t.id)) + Number(Boolean(t.deErstausgabe?.synchro))
  if (stark && stark + mittel > 1) return 'very-high'
  if (stark || mittel > 1) return 'high'
  return mittel ? 'normal' : 'low'
}

/** Die Titel mit einer Synchronkartei-Adresse in den Handdateien (kein Abruf: die Kartei untersagt automatisiertes Auslesen). */
function karteiTitel(): Set<number> {
  const ids = new Set<number>()
  const eintraege = [...loadSynchroVonHand()]
  try {
    eintraege.push(...((yaml.load(readFileSync(resolve(ROOT, 'data/erstausgabe-von-hand.yaml'), 'utf8')) as typeof eintraege | null) ?? []))
  } catch { /* Datei fehlt: keine Handbelege */ }
  for (const e of eintraege) if (e.sources?.some((u) => /synchronkartei\.de/.test(u))) ids.add(e.anilistId)
  return ids
}

export function ladeBelegsignale(releases: Release[]): Belegsignale {
  return {
    /* `nichtImBestand`: bewusst nicht geführter Titel, kein Beleg für den Bestand. */
    handbelegt: new Set(loadDubChecks().filter((c) => c.dub === true && !c.nichtImBestand).map((c) => c.anilistId)),
    kartei: karteiTitel(),
    tv: new Set(releases.filter((r) => r.platform === 'tv').map((r) => r.titleId)),
  }
}

/**
 * Zusicherung für die ausgelieferten Titel: high oder very-high braucht eine starke Quelle oder (ohne sie) die aniSearch-Marke als eine der
 * zwei mittleren. Die TV-Termine stehen zu diesem Zeitpunkt des Baus noch nicht in `releases.json`, deshalb prüft das nur die Untergrenze.
 */
export function hochOhneBeleg(titel: Title[], s: Pick<Belegsignale, 'handbelegt' | 'kartei'>): number[] {
  return titel
    .filter((t) => t.dubConfidence === 'high' || t.dubConfidence === 'very-high')
    .filter((t) => !t.streams?.some((st) => st.dub === true) && !s.handbelegt.has(t.id) && !s.kartei.has(t.id) && !t.deErstausgabe?.synchro)
    .map((t) => t.id)
}

/** Alle Titel mit der Stufe aus ihren Quellen; die Eingabe bleibt unverändert. */
export function mitBelegstaerke<T extends Kette>(titel: T[], releases: Release[]): (T & { dubConfidence: DubConfidence })[] {
  const signale = ladeBelegsignale(releases)
  return titel.map((t) => ({ ...t, dubConfidence: belegstaerke(t, signale) }))
}
