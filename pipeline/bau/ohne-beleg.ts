import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { Title } from '../../shared/types.ts'
import { ANKUENDIGUNG_FRIST_TAGE, ankuendigungFrisch } from '../../shared/ankuendigung.ts'
import { ROOT } from '../lib/util.ts'
import { deutschMarke } from '../lib/anisearch-marke.ts'

/**
 * **Ein ausgestrahlter Titel, für den kein einziger Beleg einer deutschen Fassung vorliegt, gehört hinter „Anime ohne deutsche Synchro"**
 * (Daniel, 04.10.2026, Ranma 1/2 Staffel 3: Netflix führt Folge 1 seit gestern, aber ohne deutschen Ton — die Staffel stand mit
 * „Noch keine deutsche Fassung" im Hauptbestand).
 *
 * Gemeint sind die Titel ab 2023, deren Wege alle ungeprüft sind: kein Stream mit belegter Synchro, keine Erstausgabe-Marke
 * (die der Aufrufer schon ausgeschlossen hat: kein Release, keine deutschen Sprechrollen). Ältere Fernsehtitel ohne Streams
 * bleiben, wo sie sind — ihre Synchro ist real, nur nicht in Wegen belegt (gemessen 04.10.2026: 213 Titel ohne Beleg, davon
 * etwa 25 ab 2024 mit Weg). Wie überall gilt: ein Vorfilter verschiebt, er löscht nicht (`schreibeOhneSynchro`).
 */
export function ausgestrahltOhneBeleg(t: Title, heuteIso: string): boolean {
  if (!t.streams.length || t.deErstausgabe || t.streams.some((s) => s.dub === true) || deutschLautAnisearch(t)) return false
  if (frischAngekuendigt(t, heuteIso)) return false
  return (t.jpYear ?? 0) >= 2023
}

export { ANKUENDIGUNG_FRIST_TAGE }

/**
 * **Ein Katalog ohne deutsche Tonspur widerlegt die Ankündigung desselben Anbieters nicht, solange sie frisch ist** (Dirigent, 26.10.2026,
 * Iceblade Sorcerer Staffel 2: Crunchyroll kündigte die Synchro an, der Katalog-Durchlauf meldete „0 von 3 deutsch“ — noch nicht erschienen, nicht „keine Synchro“;
 * Projektziel: Unsicheres kennzeichnen statt weglassen, gestrichen wird nur, was eine Quelle widerlegt). Frisch heißt bis 60 Tage nach `omuAb`;
 * bei nur genanntem Monat (`JJJJ-MM`) zählt dessen erster Tag. Danach gilt die Regel wie bisher. `heuteIso` ist der Bau-Zeitpunkt.
 */
export function frischAngekuendigt(t: Title, heuteIso: string): boolean {
  const a = t.ankuendigung
  if (a?.synchro !== 'angekuendigt') return false
  return ankuendigungFrisch(a.omuAb, heuteIso)
}

/**
 * aniSearchs Dub-Liste führt Deutsch als vertont (`d`) oder abgebrochen (`c`, Teilsynchro): Das ist ein Beleg, wie ihn `keineSynchroLautAnisearch` für das Gegenteil gelten lässt.
 * Geplant (`p`) ist eine Ankündigung, kein Beleg. Ohne diesen Beleg wanderte Scott Pilgrim hebt ab (170206) hinter den Toggle (Lauf 37832745133).
 */
export function deutschLautAnisearch(t: Title): boolean {
  const k = deutschMarke(t.id)
  return k === 'd' || k === 'c'
}

/**
 * aniSearch führt Deutsch als „Geplant“ (`p`): Die deutsche Fassung gilt als noch nicht veröffentlicht, auch wo der Block Datum und „Abgeschlossen“ trägt
 * (Daniel, 11.10.2026; Reincarnated as a Dragon Hatchling: der Block wiederholte den Japan-Zeitraum, ADN zeigte nur Untertitel).
 */
export function deutschGeplantLautAnisearch(titelId: number): boolean {
  return deutschMarke(titelId) === 'p'
}

/**
 * **Eine deutsche Ausgabe ohne deutsche Vertonung ist keine Synchro** (Daniel, 06.10.2026, Handprüfung E: 10 von 10 Titeln, bei denen
 * aniSearch eine deutsche Ausgabe führt, hatten keine deutsche Tonspur; der Dub-Endpunkt hatte alle vorher richtig). Gemeint sind Titel
 * mit deutscher Erstausgabe (Kazé, peppermint, Crunchyroll …), deren Kennzeichen in `data/anisearch-dubs.json` „nicht genannt" lautet
 * (`-`, auch nicht geplant oder abgebrochen — ein abgebrochener Dub ist eine Teilsynchro und bleibt). Seit 07.10.2026 gilt das auch ohne Ausgabe
 * (21 Titel im Hauptbestand ohne jeden eigenen Beleg, deren Kennzeichen `-` ist). Ein Stream mit belegter Synchro
 * schlägt das, die Aufrufer schließen Releases und deutsche Sprecher davor aus. Ohne Datei gilt die Regel nie.
 */
export function keineSynchroLautAnisearch(t: Title): boolean {
  return deutschMarke(t.id) === '-' && !t.streams.some((s) => s.dub === true)
}

type HandUrteil = { anilistId?: number; sources?: string[]; keinAnime?: boolean }

function leseHandUrteile(): HandUrteil[] {
  return (yaml.load(readFileSync(resolve(ROOT, 'data/ohne-synchro-von-hand.yaml'), 'utf8')) ?? []) as HandUrteil[]
}

/** Titel, für die eine Quelle ausdrücklich „keine deutsche Synchronfassung" sagt (`data/ohne-synchro-von-hand.yaml`); ohne Quelle zählt ein Eintrag nicht. */
export function ohneSynchroVonHand(): Set<number> {
  return new Set(leseHandUrteile().filter((e) => e.anilistId && e.sources?.length).map((e) => e.anilistId!))
}

/** Die Einträge daraus, die eine Quelle als „kein Anime" einstuft (Diashow statt Animation, aniSearch 08.10.2026). */
export function keinAnimeVonHand(): Set<number> {
  return new Set(leseHandUrteile().filter((e) => e.keinAnime && e.anilistId && e.sources?.length).map((e) => e.anilistId!))
}

/**
 * Zusicherung zu „kein Anime": keiner steht im Hauptbestand, jeder liegt hinter dem Toggle (verschoben, nicht gelöscht).
 * Gibt die Fehlermeldungen zurück; leer heißt in Ordnung.
 */
export function keinAnimeFehler(keinAnime: Iterable<number>, hauptbestand: { has(id: number): boolean }, hinterToggle: Set<number>): string[] {
  const fehler: string[] = []
  for (const id of keinAnime) {
    if (hauptbestand.has(id)) fehler.push(`Anime ${id}: als „kein Anime" von Hand eingestuft, steht aber im Hauptbestand`)
    else if (!hinterToggle.has(id)) fehler.push(`Anime ${id}: als „kein Anime" von Hand eingestuft, fehlt aber hinter dem Toggle`)
  }
  return fehler
}
