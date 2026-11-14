/**
 * Prozesstest der Bestandswache `check-prime-seite-ohne-weg-bestand.ts` (13.11.2026): Das Skript läuft als eigener Prozess gegen einen
 * Wegwerf-Bestand (`AK_ROOT`). Grenze 290 fest eingetragen; Ausnahmen (gleiche Seite, Weg unter `url` oder `seite`, Titel außerhalb des
 * Bestands, andere Plattform, keine `seite`, Ablage-Weg deckt die deutschen Folgen) und die Rechnung als reine Funktion. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { meldungenSeiteOhneWeg, seiteOhneWegMangel, type TitelMitWegen, type ZugeordneteMeldung } from './lib/prime-seite-ohne-weg.ts'

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
const kuerzel = (treffer: string[]) => treffer.map((k) => k.split('/').pop()).join()

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
pruefe('Rechnung: drei Treffer in Reihenfolge', kuerzel(meldungenSeiteOhneWeg(z, titel)) === 'B0ABLAGE01,B0ABLAGE04,B0ABLAGE05')
pruefe('Meldung: an der Grenze nichts', seiteOhneWegMangel(3, 3) === undefined)
pruefe('Meldung: eins darüber nennt beide Zahlen', seiteOhneWegMangel(4, 3) === '4 Prime-Meldungen mit abweichender Seite ohne Weg im Datensatz, erlaubt höchstens 3')

/* Nur ein Prime-Weg zählt als Weg: ein Weg einer anderen Plattform mit derselben Kennung (Seite oder Ablage) versorgt nichts. */
const fremdPlattform: TitelMitWegen[] = [{ id: 5, streams: [{ platform: 'crunchyroll', url: adresse('B0FREMD006') }, { platform: 'adn', url: adresse('B0ABLAGE09'), dub: true }] }]
const deutsch1 = [{ unsere: 1, sprachen: ['Deutsch'] }]
pruefe('Weg anderer Plattform mit gleicher Kennung zählt als ohne Weg', meldungenSeiteOhneWeg({ [adresse('B0ABLAGE09')]: { ...meldung(5, adresse('B0FREMD006')), folgen: deutsch1 } }, fremdPlattform).length === 1)

/* Ablage deckt die Meldung (Dirigent 13.11.2026, Hyouka-Gegenprobe): Weg an der Ablage-Adresse mit passenden Bereichen oder als Haken. */
const ablageWeg = (zusatz: object) => [{ id: 6, streams: [{ platform: 'primevideo', url: adresse('B0ABLAGE10'), ...zusatz }] }]
const zweite = (folgen: ZugeordneteMeldung['folgen']) => ({ [`${adresse('B0ABLAGE10')}#1`]: { ...meldung(6, 'B0ZWEITE01'), folgen } })
const de = (...n: (number | null)[]) => n.map((unsere) => ({ unsere, sprachen: ['Deutsch', 'Japanisch'] }))
const bereiche = { dub: true, dubRanges: [{ from: 1, to: 3, dub: true }, { from: 5, to: 22, dub: true }] }
const zaehlt = (folgen: ZugeordneteMeldung['folgen'], zusatz: object) => meldungenSeiteOhneWeg(zweite(folgen), ablageWeg(zusatz)).length
pruefe('Hyouka: Bereiche 1–3, 5–22 decken die Folgen 13–22 der zweiten Seite', zaehlt(de(13, 14, 22), bereiche) === 0)
pruefe('Bereichsanfang (5) und -ende (3) decken', zaehlt(de(3, 5), bereiche) === 0)
pruefe('Bereiche decken eine Folge nicht (4): zählt', zaehlt(de(4, 13), bereiche) === 1)
pruefe('Bereich über das Ende hinaus (23): zählt', zaehlt(de(22, 23), bereiche) === 1)
pruefe('Bereich mit dub false deckt nicht', zaehlt(de(2), { dubRanges: [{ from: 1, to: 3, dub: false }] }) === 1)
pruefe('Haken-Weg (dub true, ohne Bereiche) deckt', zaehlt(de(30), { dub: true }) === 0)
pruefe('Weg ohne Ton-Angabe und ohne Bereiche deckt nicht', zaehlt(de(1), {}) === 1)
pruefe('Haken-Weg mit dub false deckt nicht', zaehlt(de(1), { dub: false }) === 1)
pruefe('Meldung ohne deutsche Folge: zählt auch am Haken-Weg', zaehlt([{ unsere: 1, sprachen: ['Japanisch'] }], { dub: true }) === 1)
pruefe('Meldung ohne Folgen: zählt auch am Haken-Weg', zaehlt(undefined, { dub: true }) === 1)
pruefe('Deutsche Folge ohne unsere Nummer: zählt auch am Haken-Weg', zaehlt(de(1, null), { dub: true }) === 1)
pruefe('Japanische Folge außerhalb der Bereiche stört nicht', zaehlt([...de(13), { unsere: 4, sprachen: ['Japanisch'] }], bereiche) === 0)
pruefe('Haken-Weg an anderer Adresse deckt nicht', meldungenSeiteOhneWeg(zweite(de(1)), [{ id: 6, streams: [{ platform: 'primevideo', url: adresse('B0WOANDERS'), dub: true }] }]).length === 1)

/* Prozess: Wegwerf-Bestand mit n Meldungen ohne Weg; `gesperrt` Meldungen stehen in der Sperrliste, `ohneTitel` leert titles.json. */
interface Kulisse {
  leer?: boolean
  ohneTitel?: boolean
  gesperrt?: number
}
function lauf(n: number, k: Kulisse = {}): { code: number | null; out: string; err: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'prime-seite-ohne-weg-'))
  try {
    mkdirSync(join(wurzel, 'public/data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    const meldungen: Record<string, ZugeordneteMeldung> = {}
    for (let i = 0; i < n; i++) meldungen[adresse(`B0M${String(i).padStart(7, '0')}`)] = meldung(900001, adresse(`B0S${String(i).padStart(7, '0')}`))
    writeFileSync(join(wurzel, 'data', ['prime', 'zugeordnet.json'].join('-')), JSON.stringify(k.leer ? {} : meldungen))
    const sperre = Object.keys(meldungen).slice(0, k.gesperrt ?? 0).map((url) => `- anilistId: 900001\n  url: ${url}\n  grund: 'Test'\n  entferntAm: '2026-11-13'\n`)
    writeFileSync(join(wurzel, 'data', ['belege', 'entfernt.yaml'].join('-')), sperre.join(''))
    writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(k.ohneTitel ? [] : [{ id: 900001, streams: [] }]))
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'pipeline/check-prime-seite-ohne-weg-bestand.ts'], { encoding: 'utf8', windowsHide: true, timeout: 60_000, env: { ...process.env, AK_ROOT: wurzel } })
    return { code: r.status, out: r.stdout, err: r.stderr }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}
const ok = lauf(290)
pruefe('Prozess: 290 (Grenze) grün, Schlusszeile da', ok.code === 0 && ok.out.includes('290 Meldungen') && ok.out.includes('VERSTÖSSE: 0'), ok.out + ok.err)
const rot = lauf(291)
pruefe('Prozess: 291 rot mit beiden Zahlen', rot.code === 1 && rot.err.includes('291 Prime-Meldungen mit abweichender Seite ohne Weg im Datensatz, erlaubt höchstens 290') && rot.err.includes('VERSTÖSSE: 1'), rot.err)
const leerLauf = lauf(0, { leer: true })
pruefe('Prozess: leere Ablage ist rot (die Wache prüfte nichts)', leerLauf.code === 1 && leerLauf.err.includes('prüft nichts'), leerLauf.err)
const ohneTitel = lauf(3, { ohneTitel: true })
pruefe('Prozess: gefüllte Ablage, leere titles.json ist rot (die Wache prüfte nichts)', ohneTitel.code === 1 && ohneTitel.err.includes('prüft nichts'), ohneTitel.out + ohneTitel.err)
const gesperrt = lauf(291, { gesperrt: 1 })
pruefe('Prozess: eine von 291 Meldungen gesperrt (belege-entfernt) zählt nicht, 290 grün', gesperrt.code === 0 && gesperrt.out.includes('290 Meldungen'), gesperrt.out + gesperrt.err)

if (fehler) {
  console.error(`[prime-seite-ohne-weg-bestand-lauf] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[prime-seite-ohne-weg-bestand-lauf] ${faelle} Fälle grün (Grenze 290 als Prozess, Ausnahmen und Ablage-Deckung zählen nicht, Sperrliste wirkt, leere Ablage oder leerer Bestand rot)`)
