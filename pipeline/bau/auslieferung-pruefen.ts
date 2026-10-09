import { readJson } from '../lib/util.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { hochOhneBeleg, ladeBelegsignale } from '../lib/belegstaerke.ts'
import { keinAnisearchSuchlink, reihenVerweiseAufgeloest, synchroNichtHinterToggle } from '../lib/invarianten-auslieferung.ts'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import { OUT } from './grundlagen.ts'
import { ohneSynchroVonHand } from './ohne-beleg.ts'
import { alle as anisearchEintraege } from './anisearch-titel.ts'
import { anisearchZeilenDoppelt } from './anisearch-dubletten.ts'

/** Die Dateien, in denen aniSearch-Wege stehen und die zu diesem Zeitpunkt des Baus schon frisch geschrieben sind (`releases.json` folgt erst danach; `check:logic` prüft sie nach). */
function auslieferungstexte(): { datei: string; text: string }[] {
  const dateien = ['titles.json', 'titles-core.json', 'ohne-synchro.json', 'cartoons.json']
  const synopsenOrdner = resolve(ROOT, OUT, 'synopses')
  const synopses = existsSync(synopsenOrdner) ? readdirSync(synopsenOrdner).map((f) => `synopses/${f}`) : []
  return [...dateien, ...synopses].filter((d) => existsSync(resolve(ROOT, OUT, d))).map((datei) => ({ datei, text: readFileSync(resolve(ROOT, OUT, datei), 'utf8') }))
}

/** D-06 und D-15 an den geschriebenen Dateien (`lib/invarianten-auslieferung.ts`): Fehlermeldungen, leer heißt in Ordnung. */
export function auslieferungsInvarianten(): string[] {
  const lies = <T>(datei: string, leer: T): T => readJson<T>(`${OUT}/${datei}`, leer)
  const auslieferung = {
    titles: lies<Title[]>('titles.json', []),
    ohneSynchro: lies<Title[]>('ohne-synchro.json', []),
    cartoons: lies<Title[]>('cartoons.json', []),
    franchises: lies<Record<string, { id: number; name: string }[]>>('franchises.json', {}),
  }
  /* `nichtImBestand` ist ein bewusst nicht geführter Titel (Amazon-Kanal-Angabe ohne Beleg): kein Handbeleg für den Bestand. */
  const handbelegteIds = new Set(loadDubChecks().filter((c) => c.dub === true && !c.nichtImBestand).map((c) => c.anilistId))
  return [
    ...synchroNichtHinterToggle(auslieferung, {
      dubsAnilist: readJson<Record<string, string>>('data/anisearch-dubs.json', {}),
      dubIds: readJson<Record<string, string>>('data/anisearch-dub-ids.json', {}),
      handbelegteIds,
      handKeine: ohneSynchroVonHand(),
      heute: todayIso(),
    }),
    ...anisearchZeilenDoppelt([...auslieferung.titles, ...auslieferung.ohneSynchro], anisearchEintraege()),
    ...reihenVerweiseAufgeloest(auslieferung),
    ...keinAnisearchSuchlink(auslieferungstexte()),
    ...hochOhneBeleg(auslieferung.titles, ladeBelegsignale([])).map((id) => `Titel ${id}: Belegstärke high ohne starke oder zwei mittlere Quellen`),
  ]
}
