/**
 * **Prüfung: Zuordnung und Urteile werden höchstens alle 6 Stunden vom Worker geholt** (12.10.2026,
 * `pipeline/lib/abruf-stempel.ts`). Kein Netz: Der Worker-Abruf zeigt auf einen geschlossenen Port.
 *
 * Aufruf: npx tsx pipeline/check-abruf-stempel.ts
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { abrufMitStempel, istFrisch } from './lib/abruf-stempel.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const ordner = mkdtempSync(join(tmpdir(), 'abruf-stempel-'))
const stempel = join(ordner, 'stempel.json')
process.env.ABRUF_STEMPEL = stempel
const JETZT = Date.parse('2026-10-12T12:00:00Z')
const vor = (stunden: number) => new Date(JETZT - stunden * 3_600_000).toISOString()
const setze = (inhalt: unknown) => writeFileSync(stempel, typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
const gestempelt = () => (existsSync(stempel) ? (JSON.parse(readFileSync(stempel, 'utf8')) as Record<string, string>) : {})
const argv = process.argv.slice()

console.log('Stempel lesen')
{
  pruefe(!istFrisch('urteile', JETZT), 'ohne Datei: alt')
  setze({ urteile: vor(1) })
  pruefe(istFrisch('urteile', JETZT), '1 Stunde alt: frisch')
  pruefe(!istFrisch('folgen-zuordnung', JETZT), 'ein anderer Name hat keinen Stempel: alt')
  setze({ urteile: vor(7) })
  pruefe(!istFrisch('urteile', JETZT), '7 Stunden alt: alt')
  setze({ urteile: new Date(JETZT + 3_600_000).toISOString() })
  pruefe(!istFrisch('urteile', JETZT), 'ein Stempel aus der Zukunft gilt als alt')
  setze('kein json')
  pruefe(!istFrisch('urteile', JETZT), 'eine kaputte Stempeldatei gilt als alt (der Abruf läuft, statt still zu unterbleiben)')
  setze({ urteile: 'gestern' })
  pruefe(!istFrisch('urteile', JETZT), 'ein unlesbares Datum gilt als alt')
}

console.log('Abruf überspringen')
{
  const ziel = join(ordner, 'ziel.json')
  let aufrufe = 0
  const abruf = async () => {
    aufrufe++
    writeFileSync(ziel, '{}')
  }
  setze({ urteile: vor(1) })
  process.argv = [...argv]
  await abrufMitStempel('urteile', ziel, abruf, JETZT)
  pruefe(aufrufe === 0, 'frischer Stempel: der Abruf unterbleibt')
  process.argv = [...argv, '--voll']
  await abrufMitStempel('urteile', ziel, abruf, JETZT)
  pruefe(aufrufe === 1, '--voll erzwingt den Abruf trotz frischem Stempel')
  pruefe(gestempelt().urteile === new Date(JETZT).toISOString(), '... und stempelt neu')
  setze({ urteile: vor(7) })
  process.argv = [...argv]
  await abrufMitStempel('urteile', ziel, abruf, JETZT)
  pruefe(aufrufe === 2 && gestempelt().urteile === new Date(JETZT).toISOString(), 'alter Stempel: Abruf und neuer Stempel')
  setze({ urteile: vor(7), andere: vor(2) })
  await abrufMitStempel('urteile', ziel, abruf, JETZT)
  pruefe(gestempelt().andere === vor(2), 'der Stempel der anderen Datei bleibt erhalten')
  setze({ urteile: vor(7) })
  await abrufMitStempel('urteile', ziel, async () => void aufrufe++, JETZT)
  pruefe(gestempelt().urteile === vor(7), 'schreibt der Abruf die Ergebnisdatei nicht (Worker gestört), bleibt der Stempel alt')
  process.argv = [...argv, '--aus', 'x.json']
  setze({ urteile: vor(1) })
  const vorher = aufrufe
  await abrufMitStempel('urteile', ziel, abruf, JETZT)
  pruefe(aufrufe === vorher + 1 && gestempelt().urteile === vor(1), '--aus (lokale Eingabe) wird nie übersprungen und nie gestempelt')
  process.argv = [...argv]
}

console.log('Die beiden Skripte benutzen es')
{
  const lauf = (skript: string, stempelInhalt: unknown, ...optionen: string[]) => {
    setze(stempelInhalt)
    const r = spawnSync(process.execPath, ['--import', 'tsx', skript, ...optionen], {
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, LAUF_TOKEN: 'x', LAUF_WORKER: 'http://127.0.0.1:9' },
    })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  }
  const jetzt = new Date().toISOString()
  for (const [skript, name] of [
    ['pipeline/fetch-urteile.ts', 'urteile'],
    ['pipeline/fetch-folgen-zuordnung.ts', 'folgen-zuordnung'],
  ] as const) {
    const frisch = lauf(skript, { [name]: jetzt })
    pruefe(frisch.status === 0 && frisch.aus.includes('Abruf übersprungen'), `${skript}: frischer Stempel, kein Abruf (Exit ${frisch.status})`)
    const voll = lauf(skript, { [name]: jetzt }, '--voll')
    pruefe(!voll.aus.includes('Abruf übersprungen') && /fetch failed|ECONNREFUSED/.test(voll.aus), `${skript} --voll: der Abruf wird versucht`)
    const alt = lauf(skript, { [name]: new Date(Date.now() - 7 * 3_600_000).toISOString() })
    pruefe(!alt.aus.includes('Abruf übersprungen') && /fetch failed|ECONNREFUSED/.test(alt.aus), `${skript}: alter Stempel, der Abruf wird versucht`)
  }
}

rmSync(ordner, { recursive: true, force: true })
if (fehler) {
  console.log(`${fehler} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('Alles in Ordnung.')
process.exit(0)
