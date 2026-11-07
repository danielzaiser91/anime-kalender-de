/**
 * Zusicherungen zum Synchro-Widerspruch (Devils' Crest, 07.11.2026): `lib/synchro-widerspruch.ts` und die Bestandswache
 * `check-synchro-widerspruch-bestand.ts` als Prozess gegen einen Wegwerf-Ordner (`AK_ROOT`), je Beleg ein roter Fall.
 * Aufruf: npx tsx pipeline/check-synchro-widerspruch.ts
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import { widerspruechlich, widerspruchText, type SynchroBelege } from './lib/synchro-widerspruch.ts'

let fehler = 0
const pruefe = (ok: boolean, text: string) => {
  if (ok) return void console.log(`  ✓ ${text}`)
  fehler++
  console.error(`  ✖ ${text}`)
}
const titel = (id: number, anisearchId?: number) => ({ id, anisearchId, titleRomaji: `Probe ${id}` }) as unknown as Title
const belege = (b: Partial<SynchroBelege>): SynchroBelege => ({ nachAnisearch: {}, nachTitel: {}, handJa: new Set(), ...b })
const ids = (t: Title[], b: SynchroBelege) => widerspruechlich(t, b).map((x) => x.titel.id).join()

console.log('\nSynchro-Widerspruch: reine Regel')
pruefe(ids([titel(900001, 800001)], belege({ nachAnisearch: { '800001': 'd' } })) === '900001', 'aniSearch-Marke d (Schlüssel aniSearch-Kennung) → Widerspruch')
pruefe(ids([titel(900002, 800002)], belege({ nachAnisearch: { '800002': 'c' } })) === '900002', 'aniSearch-Marke c → Widerspruch')
pruefe(ids([titel(900003, 800003)], belege({ nachAnisearch: { '800003': 'p' } })) === '', 'Marke p (geplant) → kein Widerspruch')
pruefe(ids([titel(900004, 800004)], belege({ nachAnisearch: { '900004': 'd' } })) === '', 'Schlüssel ist die aniSearch-Kennung, nicht die Titel-Kennung')
pruefe(ids([titel(900005)], belege({ nachTitel: { '900005': 'd' } })) === '900005', 'Marke über die Titel-Kennung (Auszug) → Widerspruch')
pruefe(ids([titel(900006)], belege({ nachTitel: { '900007': 'd' } })) === '', 'Marke eines anderen Titels → kein Widerspruch')
pruefe(ids([titel(900008)], belege({ handJa: new Set([900008]) })) === '900008', 'Handbeleg dub: true → Widerspruch')
pruefe(ids([titel(900009), titel(900010, 800010), titel(900011, 800011)], belege({ nachAnisearch: { '800011': 'd' } })) === '900011', 'nur der betroffene Titel unter mehreren')
const text = widerspruchText(titel(900012, 800012), 'aniSearch-Marke „d“')
pruefe(['Probe 900012', '900012', '800012', 'aniSearch-Marke „d“', 'Zu tun'].every((s) => text.includes(s)), 'Meldung nennt Titel, beide Kennungen, Beleg und Handlung')

console.log('\nSynchro-Widerspruch: Bestandswache als Prozess')
const wurzel = join(import.meta.dirname, '..')
const ordner = mkdtempSync(join(tmpdir(), 'synchro-widerspruch-'))
mkdirSync(join(ordner, 'public', 'data'), { recursive: true })
mkdirSync(join(ordner, 'data'), { recursive: true })
writeFileSync(join(ordner, 'data', 'anisearch-dub-ids.json'), JSON.stringify({ '800001': 'd', '800003': 'p' }))
writeFileSync(join(ordner, 'data', 'anisearch-ids-hand.yaml'), '')
const lauf = (ohne: Title[]) => {
  writeFileSync(join(ordner, 'public', 'data', 'ohne-synchro.json'), JSON.stringify(ohne))
  return spawnSync(process.execPath, ['--import', 'tsx', join(wurzel, 'pipeline', 'check-synchro-widerspruch-bestand.ts')], { cwd: wurzel, encoding: 'utf8', timeout: 60000, env: { ...process.env, AK_ROOT: ordner } })
}
const rot = lauf([titel(900001, 800001), titel(900003, 800003)])
pruefe(rot.status === 1 && rot.stdout.includes('VERSTÖSSE: 1') && rot.stderr.includes('Titel 900001') && !rot.stderr.includes('Titel 900003'), `Prozess: Titel mit Marke d → Exit 1, nur dieser genannt — ${rot.stderr.trim().slice(0, 100)}`)
pruefe(rot.stdout.includes('"titleId":900001') && rot.stdout.includes('QUARANTAENE'), 'Prozess: Titel wird zur Quarantäne gemeldet')
const gruen = lauf([titel(900003, 800003), titel(900099)])
pruefe(gruen.status === 0 && gruen.stdout.includes('VERSTÖSSE: 0') && gruen.stdout.includes('keiner der 2 Titel'), `Prozess: nur p und ohne Marke → Exit 0 — ${gruen.stderr.trim().slice(0, 100)}`)
pruefe(lauf([]).status === 0, 'Prozess: leere Datei → Exit 0')
writeFileSync(join(ordner, 'data', 'dub-confirmed.yaml'), ['- anilistId: 900099', '  platform: crunchyroll', '  dub: true', '  checkedAt: "2026-11-07"', ''].join('\n'))
const hand = lauf([titel(900099)])
pruefe(hand.status === 1 && hand.stderr.includes('Handbeleg dub: true'), `Prozess: Handbeleg dub: true → Exit 1 — ${hand.stderr.trim().slice(0, 100)}`)
rmSync(ordner, { recursive: true, force: true })

console.log(`Synchro-Widerspruch: ${fehler ? fehler + ' Fall/Fälle rot' : 'alle Fälle grün'}`)
if (fehler) process.exit(1)
