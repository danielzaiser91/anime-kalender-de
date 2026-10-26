/**
 * Zusicherung (Daniel, 26.10.2026, Magic Knight Rayearth): Jede Zeile `synchro: angekuendigt` in `data/ankuendigungen.yaml`
 * wird zu genau einer News-Meldung am Tag der Quelle (`stand`), mit Quelle — auch wenn der Anbieter schon ein Release hat.
 * Eine Zeile `offen` bleibt ohne Meldung, sobald es ein Release des Anbieters gibt.
 * Aufruf: `npm run check:logic`.
 */
import { addDays, todayIso } from '../shared/time.ts'
import type { Release, Title } from '../shared/types.ts'
import { ankuendigungenLaden, type Ankuendigung } from './lib/ankuendigungen.ts'
import { baueNews } from './lib/news.ts'
import { omuMeldungen } from './lib/news-omu.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, ankuendigung?: Ankuendigung): Title =>
  ({ id, slug: `t-${id}`, titleEn: `Titel ${id}`, streams: [], ...(ankuendigung ? { ankuendigung } : {}) }) as unknown as Title
const release = (titleId: number, platform: string, extra: Partial<Release> = {}): Release =>
  ({ titleId, platform, ...extra }) as unknown as Release

console.log('\nAnkündigungs-Meldung:')
const echte = ankuendigungenLaden(process.cwd())
const angekuendigt = [...echte].filter(([, a]) => a.synchro === 'angekuendigt')
pruefe('Die echte Datei führt Zeilen mit angekündigter Synchro (Wächter nicht blind)', angekuendigt.length > 0, angekuendigt.length)

/* Schlimmster Fall: zu jeder Zeile gibt es schon ein Release desselben Anbieters. */
const titles = angekuendigt.map(([id]) => titel(id))
const mitRelease = angekuendigt.map(([id, a]) => release(id, a.platform))
const meldungen = omuMeldungen(titles, mitRelease, echte)
const fehlt = angekuendigt.filter(([id]) => meldungen.filter((m) => m.titel.id === id).length !== 1).map(([id]) => id)
pruefe('Jede angekündigte Zeile hat genau eine Meldung, auch mit Release desselben Anbieters', fehlt.length === 0, fehlt)
const schief = angekuendigt
  .filter(([id, a]) => {
    const m = meldungen.find((x) => x.titel.id === id)
    return !m || m.fallback !== a.stand || !m.quelle || !m.belege?.length || m.omu !== 'synchro-angekuendigt'
  })
  .map(([id]) => id)
pruefe('Die Meldung steht am Tag der Quelle, trägt Quelle und Beleg und das Kennzeichen „Synchro angekündigt"', schief.length === 0, schief)

const a = (synchro: 'angekuendigt' | 'offen', platform = 'crunchyroll'): Ankuendigung =>
  ({ platform, omuAb: '2026-10-11', synchro, quellen: ['https://x.example/a'], stand: '2026-09-15' }) as Ankuendigung
const ohneEchte = new Map<number, Ankuendigung>()
pruefe('Synchro angekündigt: Release eines anderen Anbieters ändert nichts', omuMeldungen([titel(900001, a('angekuendigt'))], [release(900001, 'primevideo')], ohneEchte).length === 1)
pruefe('Synchro angekündigt: widerlegtes Release desselben Anbieters ändert nichts', omuMeldungen([titel(900001, a('angekuendigt'))], [release(900001, 'crunchyroll', { widerlegt: { am: '2026-09-20', grund: 'x', gemeldet: true } })], ohneEchte).length === 1)
pruefe('Synchro offen: Release desselben Anbieters unterdrückt die Meldung weiter', omuMeldungen([titel(900002, a('offen'))], [release(900002, 'crunchyroll')], ohneEchte).length === 0)
pruefe('Synchro offen: Release eines anderen Anbieters unterdrückt nichts', omuMeldungen([titel(900002, a('offen'))], [release(900002, 'primevideo')], ohneEchte).length === 1)
pruefe('Synchro offen: ohne Release gibt es die Meldung', omuMeldungen([titel(900002, a('offen'))], [], ohneEchte).length === 1)
pruefe('Release eines anderen Titels desselben Anbieters ändert nichts', omuMeldungen([titel(900003, a('angekuendigt'))], [release(900004, 'crunchyroll')], ohneEchte).length === 1)

/* Durch den echten Aufrufer: `baueNews` mit Release desselben Anbieters liefert die Meldung am Tag der Quelle. */
const stand = addDays(todayIso(), -3)
const t = titel(900005, { ...a('angekuendigt'), omuAb: addDays(todayIso(), 5), stand })
const news = baueNews([t], [release(900005, 'crunchyroll')], [], [], { zuerst: {} })
const omu = news.flatMap((e) => e.meldungen.filter((m) => m.omu).map((m) => ({ am: e.am, quelle: m.quelle })))
pruefe('baueNews: Meldung „Synchro angekündigt" am Tag der Quelle trotz Release des Anbieters', omu.length === 1 && omu[0]!.am === stand && !!omu[0]!.quelle, omu)

console.log(verletzt === 0 ? '\nAnkündigungs-Meldung: alle Zusicherungen halten.' : `\nAnkündigungs-Meldung: ${verletzt} Zusicherung(en) verletzt.`)
process.exit(verletzt === 0 ? 0 : 1)
