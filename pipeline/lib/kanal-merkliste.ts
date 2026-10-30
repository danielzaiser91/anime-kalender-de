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
import type { DubCheck } from './dub-confirmed.ts'
import { istEntfernt, ladeBelegeEntfernt } from './belege-entfernt.ts'
import { belegSeitenKern, notizSeite } from './kanal-titel.ts'
import { ROOT } from './util.ts'

export const MERKLISTE = 'data/kanal-seiten.json'

/** Aus geladenen Belegen (nach `ladeHandbelege()`): die Kanal-Seiten ohne eigenes Ja, nur Titel, Adresse, gelesene Seite. Sortiert, damit die Datei ruhig bleibt. */
export function merkEintraege(checks: DubCheck[]): DubCheck[] {
  const kanal = checks.filter((c) => c.kanalOhneBeleg && c.dub !== true && c.url)
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

/**
 * Die Handbelege und, wo kein Handbeleg mit eigener Aussage (`dub` oder `available`) dieselbe Seite des Titels nennt, die Einträge der Merkliste.
 * Eine Messung ohne Aussage deckt nicht: Im vollen Bau (V2, 19.10.2026) hielt sie die Kanal-Seite von Railgun S offen für das Urteil aus Stufe 3.
 */
export function mitMerkliste(checks: DubCheck[], merkliste: DubCheck[]): DubCheck[] {
  const gedeckt = (m: DubCheck): boolean =>
    checks.some((c) => c.anilistId === m.anilistId && (c.dub !== undefined || c.available !== undefined) && belegSeitenKern(c) === belegSeitenKern(m))
  return [...checks, ...merkliste.filter((m) => !gedeckt(m))]
}

export function ladeMerkliste(wurzel = ROOT): DubCheck[] {
  const datei = resolve(wurzel, MERKLISTE)
  return existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as DubCheck[]) : []
}

/** Hängt die Kanal-Belege aus `neu` an die Merkliste, jeden einmal, ohne Seiten, die `data/belege-entfernt.yaml` für denselben Titel sperrt (wie der Leser in `kanal-wissen.ts`). Ohne Neues bleibt die Datei unberührt. */
export function ergaenzeMerkliste(neu: DubCheck[], wurzel = ROOT): number {
  const bisher = ladeMerkliste(wurzel)
  const entfernt = ladeBelegeEntfernt(resolve(wurzel, 'data/belege-entfernt.yaml'))
  const erlaubt = neu.filter((c) => !istEntfernt(entfernt, c.anilistId, c.url))
  const alle = merkEintraege([...bisher, ...erlaubt])
  const einmal = alle.filter((e, i) => alle.findIndex((x) => JSON.stringify(x) === JSON.stringify(e)) === i)
  if (einmal.length === bisher.length) return 0
  writeFileSync(resolve(wurzel, MERKLISTE), '[\n' + einmal.map((e) => JSON.stringify(e)).join(',\n') + '\n]\n')
  return einmal.length - bisher.length
}
