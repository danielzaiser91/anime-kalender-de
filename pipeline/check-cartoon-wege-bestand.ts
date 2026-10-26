/**
 * Bestandsteil von `check-cartoon-wege.ts`: Teilbereiche, Häkchen und Prüfliste der Cartoon-Wege in `cartoons.json`.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-cartoon-wege.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { loadDubChecks } from './lib/dub-confirmed.ts'
import { summe } from './lib/cartoon-staffeln.ts'
import { PRUEFLISTE, type StaffelPruefung } from './bau/cartoon-staffeln.ts'
import { jwKennzeichnungFehler } from './lib/jw-seite.ts'
import type { StreamLink, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

/** Echter Bestand (nach einem Bau): Teilbereiche, Häkchen und Prüfliste stimmen zusammen. */
function pruefeBestand(titelListe: Title[]): void {
  const liste = new Set(readJson<StaffelPruefung[]>(PRUEFLISTE, []).map((p) => p.titleId))
  const belegt = new Set(loadDubChecks().filter((c) => c.anilistId < 0 && c.dub === true).map((c) => `${c.anilistId}|${c.platform}`))
  const verteilt = titelListe.filter((t) => t.streams.some((s) => s.teilBereich))
  pruefe('Bestand: Titel auf der Prüfliste behalten ihren ganzen Weg', verteilt.every((t) => !liste.has(t.id)))
  for (const t of verteilt) {
    const jeWeg = new Map<string, StreamLink[]>()
    for (const s of t.streams) jeWeg.set(`${s.platform}|${s.url}`, [...(jeWeg.get(`${s.platform}|${s.url}`) ?? []), s])
    for (const [weg, ss] of jeWeg) {
      if (!ss.some((s) => s.teilBereich)) continue
      const ende = ss.reduce((bisher, s) => (s.teilBereich && s.teilBereich.von === bisher + 1 ? s.teilBereich.bis : -1), 0)
      pruefe('Bestand: Teilbereiche eines Wegs sind lückenlos und ergeben die Staffelsumme', ende === summe(t.staffeln ?? []), `${t.id} ${weg}`)
      pruefe('Bestand: ein verteilter Weg trägt in mindestens einer Staffel Haken oder JustWatch-Hinweis', ss.some((s) => s.dub === true || s.dubQuelle), `${t.id} ${weg}`)
    }
  }
  const alleWege = titelListe.flatMap((t) => t.streams.map((s) => ({ t, s })))
  const ohneBeleg = alleWege.filter(({ t, s }) => s.dub === true && !belegt.has(`${t.id}|${s.platform}`))
  pruefe('Bestand: kein Cartoon-Häkchen ohne Handbeleg', ohneBeleg.length === 0, ohneBeleg.map(({ t }) => t.id).slice(0, 5).join())
  const teilHaken = alleWege.filter(({ s }) => s.teilBereich && s.dub === true)
  pruefe('Bestand: Häkchen je Staffel nennt Folgenbereiche, die in der Staffel liegen', teilHaken.every(({ s }) => s.dubRanges?.length && s.dubRanges.every((r) => r.from >= s.teilBereich!.von && r.to <= s.teilBereich!.bis)))
  const falsch = alleWege.filter(({ t, s }) => jwKennzeichnungFehler(t.staffelnQuelle, s))
  pruefe('Bestand: JustWatch-Kennzeichnung (Flagge an der Seite, Staffel-Hinweis nur bei JustWatch-Staffeln)', falsch.length === 0, falsch.slice(0, 5).map(({ t, s }) => `${t.id} ${s.platform}: ${jwKennzeichnungFehler(t.staffelnQuelle, s)}`).join('; '))
}

const OUT = 'public/data/cartoons.json'
if (existsSync(OUT)) pruefeBestand(readJson<Title[]>(OUT, []))

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu den Cartoon-Wegen am Bestand verletzt`)
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('Cartoon-Wege (Bestand): Zusicherungen erfüllt')
console.log('VERSTÖSSE: 0')
