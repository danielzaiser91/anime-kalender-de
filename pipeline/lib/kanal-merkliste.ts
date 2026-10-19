/**
 * Die Kanal-Seiten, die der Bau auch ohne ihren Handbeleg kennt (19.10.2026, Issue #1601).
 *
 * Der Kanal-Hinweis steht nur in der Notiz des Handbelegs. Stellt „Neue Handbelege prüfen“ (`bestand-bauen.yml`) eine Meldung zurück,
 * fehlt der Beleg im Lauf, die Rohfolgen derselben Seite liegen aber vor: `rohDeutsch()` gab ein Ja, der Bestand pendelte um 63 Prime-Wege.
 * `fetch-pruefungen.ts` schreibt deshalb jeden Kanal-Beleg ohne zweite Quelle auch hierher; diese Datei wird beim Zurückstellen nicht zurückgesetzt.
 * Ein Handbeleg zur selben Seite gilt vor der Merkliste (zweite Quelle, Korrektur).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { adressKern, entdoppleBelege, type DubCheck } from './dub-confirmed.ts'
import { belegSeitenKern, notizSeite, ohneKanalSprache } from './kanal-titel.ts'
import { ROOT } from './util.ts'

export const MERKLISTE = 'data/kanal-seiten.json'

/** Nur das, was die Kanal-Erkennung liest: Titel, Adresse, gelesene Seite. Sortiert, damit die Datei ruhig bleibt. */
export function merkEintraege(checks: DubCheck[]): DubCheck[] {
  const kanal = checks.map(ohneKanalSprache).filter((c) => c.kanalOhneBeleg && c.url)
  const eintraege = kanal.map((c) => {
    const seite = notizSeite(c)
    return {
      anilistId: c.anilistId,
      platform: c.platform,
      url: c.url,
      checkedAt: '',
      note: seite ? `Amazon-Seite ${seite} — ACHTUNG: Kanal-Titel` : 'ACHTUNG: Kanal-Titel',
      kanalOhneBeleg: true,
    } satisfies DubCheck
  })
  return eintraege.sort((a, b) => a.anilistId - b.anilistId || (a.note ?? '').localeCompare(b.note ?? '') || (a.url ?? '').localeCompare(b.url ?? ''))
}

/** Die Handbelege und, wo kein Handbeleg dieselbe Seite oder Adresse des Titels nennt, die Einträge der Merkliste. */
export function mitMerkliste(checks: DubCheck[], merkliste: DubCheck[]): DubCheck[] {
  const gedeckt = (m: DubCheck): boolean =>
    checks.some((c) => c.anilistId === m.anilistId && (belegSeitenKern(c) === belegSeitenKern(m) || adressKern(c.url) === adressKern(m.url)))
  return [...checks, ...merkliste.filter((m) => !gedeckt(m))]
}

export function ladeMerkliste(wurzel = ROOT): DubCheck[] {
  const datei = resolve(wurzel, MERKLISTE)
  return existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as DubCheck[]) : []
}

const wissen = new WeakMap<DubCheck[], DubCheck[]>()

/** Was der Bau über Kanal-Seiten weiß: die Belegliste samt Merkliste, einmal je Belegliste (`rohDeutsch()` merkt sich seine Mengen je Liste). */
export function kanalWissen(checks: DubCheck[]): DubCheck[] {
  if (!wissen.has(checks)) wissen.set(checks, mitMerkliste(checks, ladeMerkliste()))
  return wissen.get(checks)!
}

/** Hängt die Kanal-Belege aus `neu` an die Merkliste, jeden einmal. Ohne Neues bleibt die Datei unberührt. */
export function ergaenzeMerkliste(neu: DubCheck[], wurzel = ROOT): number {
  const bisher = ladeMerkliste(wurzel)
  const alle = merkEintraege([...bisher, ...neu])
  const einmal = alle.filter((e, i) => alle.findIndex((x) => JSON.stringify(x) === JSON.stringify(e)) === i)
  if (einmal.length === bisher.length) return 0
  writeFileSync(resolve(wurzel, MERKLISTE), '[\n' + einmal.map((e) => JSON.stringify(e)).join(',\n') + '\n]\n')
  return einmal.length - bisher.length
}

/** Schreibt die Handbelege und merkt sich dabei alle Kanal-Seiten aus dem geschriebenen Text (holt bei einer fehlenden Merkliste alles nach). */
export function schreibeBelege(datei: string, text: string, melde: (text: string) => void, wurzel = ROOT): void {
  const geschrieben = entdoppleBelege(text, melde)
  writeFileSync(datei, geschrieben)
  const roh = yaml.load(geschrieben)
  const dazu = ergaenzeMerkliste(Array.isArray(roh) ? (roh as DubCheck[]) : [], wurzel)
  if (dazu) melde(`${dazu} Kanal-Seite(n) in ${MERKLISTE} gemerkt`)
}
