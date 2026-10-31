/**
 * Zusicherung (Daniel, 26.10.2026, Magic Knight Rayearth): Jede Zeile `synchro: angekuendigt` in `data/ankuendigungen.yaml`
 * wird zu genau einer News-Meldung am Tag der Quelle (`stand`), mit Quelle — auch wenn der Anbieter schon ein Release hat.
 * Eine Zeile `offen` bleibt ohne Meldung, sobald es ein Release des Anbieters gibt.
 * Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { addDays, todayIso } from '../shared/time.ts'
import { leereListe } from './lib/leere-liste.ts'
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
/* Leer ist grün (alle Ankündigungen erledigt); rot nur, wenn die Datei keine `eintraege`-Liste mehr trägt. */
const roh = yaml.load(readFileSync('data/ankuendigungen.yaml', 'utf8')) as { eintraege?: unknown } | null
const lage = leereListe('Die echte Datei: Zeilen mit angekündigter Synchro', angekuendigt.length, Array.isArray(roh?.eintraege) ? 1 + echte.size : 0)
console.log(`  ${lage.zeile}`)
pruefe(lage.zeile, lage.ok, angekuendigt.length)

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

/*
  Nach dem Beschnitt (PR 2131 R1): Mit voller Liste schnitt die 400er-Grenze die Ankündigungen ab (Rayearth, 15.09., und sechs ältere Meldungen
  fielen heraus). 410 jüngere Füller drücken die Ankündigungen hinter Platz 400; frische bleiben, abgelaufene (60 Tage nach Start) dürfen fallen.
*/
const heute = todayIso()
const fueller = Array.from({ length: 450 }, (_, i) =>
  titel(910000 + i, { ...a('offen'), omuAb: addDays(heute, -70), stand: addDays(heute, -1 - (i % 50)) }),
)
const alt = addDays(heute, -110)
const frisch = [
  titel(920001, { ...a('angekuendigt'), omuAb: addDays(heute, 5), stand: alt }),
  titel(920002, { ...a('angekuendigt'), omuAb: addDays(heute, -60), stand: alt }),
  titel(920004, { ...a('offen'), omuAb: addDays(heute, -30), stand: alt }),
]
const abgelaufen = titel(920003, { ...a('angekuendigt'), omuAb: addDays(heute, -61), stand: alt })
const voll = baueNews([...fueller.slice(0, 410), ...frisch, abgelaufen], [], [], [], { zuerst: {} })
const hat = (id: number): boolean => voll.some((e) => e.meldungen.some((m) => m.omu !== undefined && e.slug === `t-${id}`))
pruefe('Die Liste ist über der Grenze (Wächter nicht blind)', voll.length > 400, voll.length)
pruefe('Beschnitt: frische angekündigte Synchro, Start in der Zukunft, bleibt trotz voller Liste', hat(920001))
pruefe('Beschnitt: frische angekündigte Synchro, Start vor 60 Tagen (letzter Tag), bleibt trotz voller Liste', hat(920002))
pruefe('Beschnitt: frische Ankündigung mit offener Synchro bleibt trotz voller Liste', hat(920004))
pruefe('Beschnitt: abgelaufene Ankündigung (61 Tage nach Start) fällt wie jede andere Meldung', !hat(920003))
const ueberDeckel = baueNews([...fueller, frisch[0]!], [], [], [], { zuerst: {} })
pruefe('Deckel: bei 451 Einträgen passt auch eine frische Ankündigung nicht mehr hinein (höchstens 440)', ueberDeckel.length <= 440 && !ueberDeckel.some((e) => e.slug === 't-920001'), ueberDeckel.length)

console.log(verletzt === 0 ? '\nAnkündigungs-Meldung: alle Zusicherungen halten.' : `\nAnkündigungs-Meldung: ${verletzt} Zusicherung(en) verletzt.`)
process.exit(verletzt === 0 ? 0 : 1)
