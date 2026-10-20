/**
 * Zusicherungen zur Synchron-Forum-Liste (`forumTitel`, 09.10.2026) gegen eine Kulisse (`AK_ROOT`) mit erfundenen Kennungen ab 900001,
 * nie gegen die echten Dateien. Anlass: PR 1151 legte ein Crunchyroll-Nein für Afro Samurai an; Universum Anime synchronisierte die Serie 2007, die Liste belegt sie.
 * Läuft in `check:logic`; die echte Treffer-Datei gegen den Datensatz steht in `check-belegstaerke-bestand.ts`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Title } from '../shared/types.ts'
import type { Belegsignale } from './lib/belegstaerke.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'belegstaerke-forum-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const FORUM = [900001, 900002, 900003, 900004, 900005]
const NEIN_CR = 900005
schreibe('data/synchron-forum-treffer.yaml', FORUM.map((id) => `- anilistId: ${id}\n  liste: "Kulisse ${id}, 2007"\n  sender: "Test"\n`).join(''))
schreibe('data/dub-confirmed.yaml', `- anilistId: ${NEIN_CR}\n  title: "Kulissen-Samurai"\n  platform: crunchyroll\n  dub: false\n  checkedAt: '2026-10-13'\n  note: "Kulisse: kein Deutsch bei Crunchyroll."\n`)
mkdirSync(join(kulisse, 'data/curated'), { recursive: true })

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

try {
  const { belegstaerke, forumTitel } = await import('./lib/belegstaerke.ts')
  const { loadDubChecks } = await import('./lib/dub-confirmed.ts')
  const leer: Belegsignale = { handbelegt: new Set(), kartei: new Set(), tv: new Set(), forum: new Set() }
  const anisearch = { deErstausgabe: { synchro: true } } as Partial<Title>
  const titel = (extra: Partial<Title> = {}) => ({ id: 1, streams: [], ...extra }) as Pick<Title, 'id' | 'streams' | 'deErstausgabe'>
  const check = (anilistId: number, dub: boolean, rest: Partial<DubCheck> = {}) => ({ anilistId, platform: 'netflix', dub, checkedAt: '2026-10-09', ...rest }) as DubCheck

  console.log('\nBelegstärke: Synchron-Forum-Liste gegen die Kulisse')
  const [a, b, c, d] = FORUM
  const gefiltert = forumTitel([check(a!, false, { nichtImBestand: true }), check(b!, false, { nichtImBestand: true }), check(b!, true), check(d!, false)])
  pruefe('Nein zur Synchro selbst (nichtImBestand) schließt den Titel aus', !gefiltert.has(a!))
  pruefe('dasselbe Nein neben einem Ja lässt ihn zu', gefiltert.has(b!) && gefiltert.has(c!))
  pruefe('ein Plattform-Nein (dub:false ohne nichtImBestand) schließt nicht aus', gefiltert.has(d!))
  pruefe('ein Titel außerhalb der Liste kommt nie hinein', !gefiltert.has(900099) && !forumTitel([check(900099, true)]).has(900099))

  const echt = loadDubChecks()
  pruefe('Vorbedingung: ein Crunchyroll-Nein liegt in den Handbelegen der Kulisse', echt.some((x) => x.anilistId === NEIN_CR && x.platform === 'crunchyroll' && x.dub === false), echt)
  pruefe('der Titel bleibt trotz Crunchyroll-Nein in der Forum-Liste', forumTitel(echt).has(NEIN_CR))
  const signale: Belegsignale = { ...leer, forum: forumTitel(echt) }
  pruefe('mit aniSearch-Marke und Forum-Treffer: high (belegt), nicht normal', belegstaerke(titel({ id: NEIN_CR, ...anisearch }), signale) === 'high')
  pruefe('ohne Forum-Treffer bleibt dieselbe Marke bei normal', belegstaerke(titel({ id: NEIN_CR, ...anisearch }), leer) === 'normal')
  schreibe('data/synchron-forum-treffer.yaml', '# leer\n')
  pruefe('leere Treffer-Datei: keine Treffer', forumTitel(echt).size === 0)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nBelegstärke (Forum): alle Zusicherungen halten.')
