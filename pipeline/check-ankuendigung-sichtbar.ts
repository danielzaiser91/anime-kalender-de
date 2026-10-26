/**
 * **Prüfung: Eine frische Synchro-Ankündigung wird nicht hinter den Toggle verschoben** (26.10.2026, Iceblade Sorcerer Staffel 2:
 * Crunchyroll kündigte die Synchro an, der Katalog meldete „0 von 3 deutsch“, die Staffel wanderte hinter den Toggle). Regel:
 * `frischAngekuendigt` / `ausgestrahltOhneBeleg` in `bau/ohne-beleg.ts`, 60 Tage nach `omuAb`. Dazu die Bestandswache
 * `check-ankuendigung-versteckt-bestand.ts` als Prozess gegen einen Wegwerf-Ordner.
 *
 * Aufruf: npx tsx pipeline/check-ankuendigung-sichtbar.ts
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Title } from '../shared/types.ts'
import { ankuendigungenLaden } from './lib/ankuendigungen.ts'
import { setzeMarkenFuerPruefung } from './lib/anisearch-marke.ts'
import { ANKUENDIGUNG_FRIST_TAGE, ausgestrahltOhneBeleg, frischAngekuendigt } from './bau/ohne-beleg.ts'
import { rolleTermineAus } from './bau/10-termine.ts'
import { versteckteFrischeAnkuendigungen, versteckteWarnzeile } from './lib/ankuendigung-versteckt.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
const wurzel = fileURLToPath(new URL('..', import.meta.url))

const titel = (id: number, ank: Title['ankuendigung'] | undefined, extra: Partial<Title> = {}): Title =>
  ({ id, jpYear: 2026, streams: [{ platform: 'crunchyroll' }], ankuendigung: ank, ...extra }) as unknown as Title
const ank = (omuAb: string, synchro: 'angekuendigt' | 'offen' = 'angekuendigt') => ({ platform: 'crunchyroll', omuAb, synchro, quellen: [], stand: '2026-09-15' }) as Title['ankuendigung']

console.log('Frist')
{
  pruefe(ANKUENDIGUNG_FRIST_TAGE === 60, '60 Tage')
  const t = titel(900001, ank('2026-10-08'))
  pruefe(frischAngekuendigt(t, '2026-10-08'), 'am Starttag frisch')
  pruefe(frischAngekuendigt(t, '2026-12-07'), 'Tag 60 (07.12.): frisch')
  pruefe(!frischAngekuendigt(t, '2026-12-08'), 'Tag 61 (08.12.): abgelaufen')
  pruefe(frischAngekuendigt(t, '2026-10-01'), 'vor dem Start (Ankündigung gilt schon): frisch')
  const monat = titel(900002, ank('2026-10'))
  pruefe(frischAngekuendigt(monat, '2026-11-30'), 'nur Monat: zählt ab dem 1. — Tag 60 (30.11.) frisch')
  pruefe(!frischAngekuendigt(monat, '2026-12-01'), 'nur Monat: Tag 61 (01.12.) abgelaufen')
  pruefe(!frischAngekuendigt(titel(900003, ank('2026-10-08', 'offen')), '2026-10-09'), 'Synchro „offen“ ist keine Ankündigung der Synchro')
  pruefe(!frischAngekuendigt(titel(900004, undefined), '2026-10-09'), 'ohne Ankündigung: nie frisch')
}

console.log('ausgestrahltOhneBeleg: Ankündigung schlägt den Katalog, bis sie abläuft')
{
  /* Iceblade Sorcerer II: der Eintrag steht wörtlich in data/ankuendigungen.yaml, aniSearch führt Deutsch als „geplant“ (p), der Weg ist ein Crunchyroll-Weg ohne Beleg. */
  const echt = ankuendigungenLaden(wurzel).get(212503)
  pruefe(echt?.omuAb === '2026-10-08' && echt.synchro === 'angekuendigt', `echter Eintrag 212503: ${echt?.omuAb} / ${echt?.synchro}`)
  setzeMarkenFuerPruefung({ 212503: 'p', 900010: 'p' })
  const iceblade = titel(212503, echt)
  pruefe(!ausgestrahltOhneBeleg(iceblade, '2026-10-26'), 'Iceblade am Bau-Tag 26.10.2026: bleibt im Hauptbestand')
  pruefe(!ausgestrahltOhneBeleg(iceblade, '2026-12-07'), 'Iceblade Tag 60: bleibt')
  pruefe(ausgestrahltOhneBeleg(iceblade, '2026-12-08'), 'Iceblade Tag 61: die bisherige Regel gilt wieder (zweiter Bau, wieder hinter dem Toggle)')
  const ohne = titel(900010, undefined)
  pruefe(ausgestrahltOhneBeleg(ohne, '2026-10-26'), 'Gegenprobe: gleicher Titel ohne Ankündigung wird verschoben')
  pruefe(ausgestrahltOhneBeleg(titel(900010, ank('2026-10-08', 'offen')), '2026-10-26'), 'Gegenprobe: Ankündigung ohne Synchro-Aussage schützt nicht')
  pruefe(!ausgestrahltOhneBeleg(titel(900010, ank('2026-10-08'), { streams: [] } as Partial<Title>), '2026-12-08'), 'bisherige Regeln bleiben: ohne Weg nie verschoben')
  pruefe(!ausgestrahltOhneBeleg(titel(900010, ank('2026-10-08'), { jpYear: 2019 } as Partial<Title>), '2026-12-08'), 'bisherige Regeln bleiben: vor 2023 nie verschoben')
  setzeMarkenFuerPruefung(undefined)
}

console.log('Verdrahtung im Bau (rolleTermineAus, Bau-Zeitpunkt = heute)')
{
  /* Start in ferner Zukunft = immer frisch, Start im Jahr 2000 = immer abgelaufen: unabhängig von der Uhr des Laufs. */
  setzeMarkenFuerPruefung({ 900031: 'p', 900032: 'p', 900033: 'p' })
  const titles = new Map<number, Title>([
    [900031, titel(900031, ank('2999-01-01'))],
    [900032, titel(900032, ank('2000-01-01'))],
    [900033, titel(900033, undefined)],
  ])
  const { verschoben } = rolleTermineAus({ releases: [], titles, jpStart: new Map() })
  pruefe(verschoben.map((t) => t.id).sort().join() === '900032,900033', `verschoben: ${verschoben.map((t) => t.id).sort().join()} (abgelaufene und fehlende Ankündigung; die frische bleibt)`)
  pruefe(titles.has(900031) && !titles.has(900032) && !titles.has(900033), 'frische Ankündigung bleibt im Bestand')
  setzeMarkenFuerPruefung(undefined)
}

console.log('Bestandswache')
{
  const a = titel(900021, ank('2026-10-08'), { titleEn: 'Frisch' } as Partial<Title>)
  const b = titel(900022, ank('2026-08-01'), { titleEn: 'Abgelaufen' } as Partial<Title>)
  const c = titel(900023, undefined, { titleEn: 'Ohne' } as Partial<Title>)
  const treffer = versteckteFrischeAnkuendigungen([a, b, c], '2026-10-26')
  pruefe(treffer.length === 1 && treffer[0]!.id === 900021, 'nur der frische Titel')
  pruefe(versteckteWarnzeile([]) === undefined, 'keine Warnzeile ohne Treffer')
  pruefe(/^ {2}⚠ WARNUNG Ankündigung: 1 Titel .*: 900021 Frisch$/.test(versteckteWarnzeile(treffer) ?? ''), versteckteWarnzeile(treffer) ?? '')

  // Als Prozess gegen einen Wegwerf-Ordner (Datei unter dem Namen, den die Wache liest).
  const ordner = mkdtempSync(join(tmpdir(), 'ankuendigung-versteckt-'))
  const daten = join(ordner, 'public', 'data')
  mkdirSync(daten, { recursive: true })
  writeFileSync(join(daten, 'ohne-synchro.json'), JSON.stringify([a, b, c]))
  const lauf = (heute: string) =>
    spawnSync(process.execPath, ['--import', 'tsx', join(wurzel, 'pipeline', 'check-ankuendigung-versteckt-bestand.ts'), ordner, heute], { cwd: wurzel, encoding: 'utf8' })
  const warnt = lauf('2026-10-26')
  pruefe(warnt.status === 0 && /⚠ WARNUNG Ankündigung: 1 Titel/.test(warnt.stdout) && warnt.stdout.includes('VERSTÖSSE: 0'), `Prozess heute 26.10.: Warnung, Exit 0 — ${warnt.stdout.trim().slice(0, 120)}`)
  const still = lauf('2027-03-01')
  pruefe(still.status === 0 && !/WARNUNG/.test(still.stdout) && /✓ Ankündigung/.test(still.stdout), 'Prozess später: keine Warnung (Frist abgelaufen), Exit 0')
  rmSync(ordner, { recursive: true, force: true })
}

if (fehler) {
  console.error(`${fehler} Fall/Fälle rot`)
  process.exit(1)
}
console.log('check-ankuendigung-sichtbar: alle Fälle grün')
