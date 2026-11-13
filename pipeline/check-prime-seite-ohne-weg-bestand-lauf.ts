/**
 * Prozesstest der Bestandswache `check-prime-seite-ohne-weg-bestand.ts` (13.11.2026): Das Skript läuft als eigener Prozess gegen einen
 * Wegwerf-Bestand (`AK_ROOT`). Grenze 450 fest eingetragen; Ausnahmen (gleiche Seite, Weg unter `url` oder `seite`, Titel außerhalb des
 * Bestands, andere Plattform, keine `seite`) und die Rechnung als reine Funktion. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { meldungenSeiteOhneWeg, seiteOhneWegMangel, type ZugeordneteMeldung } from './lib/prime-seite-ohne-weg.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const adresse = (asin: string) => `https://www.amazon.de/dp/${asin}`
const meldung = (titleId: number, seite: string | null, plattform = 'primevideo'): ZugeordneteMeldung => ({ titleId, plattform, seite })
const weg = (asin: string, feld: 'url' | 'seite' = 'url') => ({ platform: 'primevideo', url: feld === 'url' ? adresse(asin) : adresse('B0ANDERE00'), seite: feld === 'seite' ? adresse(asin) : undefined })

/* Reine Rechnung. */
const titel = [{ id: 1, streams: [weg('B0AAAAAAA1')] }, { id: 2, streams: [weg('B0BBBBBBB2', 'seite')] }, { id: 3, streams: [] }, { id: 4 }]
const z: Record<string, ZugeordneteMeldung> = {
  [adresse('B0ABLAGE01')]: meldung(1, adresse('B0FREMD001')), // Seite fremd, Titel führt sie nicht: zählt
  [`${adresse('B0ABLAGE02')}#a`]: meldung(1, adresse('B0AAAAAAA1')), // Weg unter url
  [adresse('B0ABLAGE03')]: meldung(2, adresse('B0BBBBBBB2')), // Weg unter seite
  [adresse('B0ABLAGE04')]: meldung(3, adresse('B0FREMD002')), // Titel ohne Wege: zählt
  [adresse('B0ABLAGE05')]: meldung(4, adresse('B0FREMD003')), // Titel ohne streams-Feld: zählt
  [adresse('B0SELBE001')]: meldung(1, adresse('B0SELBE001')), // Seite = Ablage: zählt nicht
  [adresse('B0ABLAGE06')]: meldung(999, adresse('B0FREMD004')), // Titel nicht im Bestand
  [adresse('B0ABLAGE07')]: meldung(1, adresse('B0FREMD005'), 'netflix'), // andere Plattform
  [adresse('B0ABLAGE08')]: meldung(1, null), // keine Seite
}
pruefe('Rechnung: drei Treffer in Reihenfolge', meldungenSeiteOhneWeg(z, titel).map((k) => k.split('/').pop()).join() === 'B0ABLAGE01,B0ABLAGE04,B0ABLAGE05')
pruefe('Meldung: an der Grenze nichts', seiteOhneWegMangel(3, 3) === undefined)
pruefe('Meldung: eins darüber nennt beide Zahlen', seiteOhneWegMangel(4, 3) === '4 Prime-Meldungen mit abweichender Seite ohne Weg im Datensatz, erlaubt höchstens 3')

/* Prozess: Wegwerf-Bestand mit n Meldungen ohne Weg. */
function lauf(n: number, leer = false): { code: number | null; out: string; err: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'prime-seite-ohne-weg-'))
  try {
    mkdirSync(join(wurzel, 'public/data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    const meldungen: Record<string, ZugeordneteMeldung> = {}
    for (let i = 0; i < n; i++) meldungen[adresse(`B0M${String(i).padStart(7, '0')}`)] = meldung(900001, adresse(`B0S${String(i).padStart(7, '0')}`))
    writeFileSync(join(wurzel, 'data', ['prime', 'zugeordnet.json'].join('-')), JSON.stringify(leer ? {} : meldungen))
    writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify([{ id: 900001, streams: [] }]))
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'pipeline/check-prime-seite-ohne-weg-bestand.ts'], { encoding: 'utf8', windowsHide: true, timeout: 60_000, env: { ...process.env, AK_ROOT: wurzel } })
    return { code: r.status, out: r.stdout, err: r.stderr }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}
const ok = lauf(450)
pruefe('Prozess: 450 (Grenze) grün, Schlusszeile da', ok.code === 0 && ok.out.includes('450 Meldungen') && ok.out.includes('VERSTÖSSE: 0'), ok.out + ok.err)
const rot = lauf(451)
pruefe('Prozess: 451 rot mit beiden Zahlen', rot.code === 1 && rot.err.includes('451 Prime-Meldungen mit abweichender Seite ohne Weg im Datensatz, erlaubt höchstens 450') && rot.err.includes('VERSTÖSSE: 1'), rot.err)
const leerLauf = lauf(0, true)
pruefe('Prozess: leere Ablage ist rot (die Wache prüfte nichts)', leerLauf.code === 1 && leerLauf.err.includes('prüft nichts'), leerLauf.err)

if (fehler) {
  console.error(`[prime-seite-ohne-weg-bestand-lauf] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[prime-seite-ohne-weg-bestand-lauf] ${faelle} Fälle grün (Grenze 450 als Prozess, Ausnahmen zählen nicht, leere Ablage rot)`)
