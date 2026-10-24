import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { auslieferbarePatchnotes } from '../shared/patchnotes.ts'
import { leseAuslieferbarePatchnotes, lesePatchnotesDateien, leseUeberarbeitetBis, STEMPEL_DATEI } from './lib/patchnotes.ts'
import { tageVon } from '../web/src/lib/patchnotes-tage.ts'

// Unabhängig vom Arbeitsordner (ein flacher Wegwerf-Klon hat kein node_modules).
const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm')).href

/**
 * Der Stift im Dialog hängt am Stempel `data/patchnotes/_ueberarbeitet-bis.txt`, nicht am Kalendertag
 * (Fehler 17.10.2026: der 16.10. verlor den Stift, obwohl seine Texte noch nicht überarbeitet waren).
 */
let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const eintrag = (datum: string, text: string) => ({ datum, kategorie: 'bugfix', text })
// Der überarbeitete Tag steht in der Mitte: Tage davor und danach müssen sich unterscheiden.
const roh = [eintrag('2026-10-14', 'A'), eintrag('2026-10-15', 'B'), eintrag('2026-10-16', 'C'), eintrag('2026-10-17', 'D')]
const aus = auslieferbarePatchnotes(roh, '2026-10-15')
const entwurfTage = aus.filter((n) => n.entwurf).map((n) => n.datum).sort().join()
pruefe('Stempel: nur Tage nach dem Stempel sind Entwurf (der Stempeltag selbst nicht)', entwurfTage === '2026-10-16,2026-10-17', aus)
pruefe('Stempel: ohne Stempel gibt es keine Entwürfe', auslieferbarePatchnotes(roh).every((n) => n.entwurf === undefined))
pruefe('Stempel: ein Stempel am jüngsten Tag macht nichts zum Entwurf', auslieferbarePatchnotes(roh, '2026-10-17').every((n) => n.entwurf === undefined))

const tage = tageVon(aus, 'alles')
const stift = (tag: string) => tage.find((t) => t.datum === tag)?.entwurf
pruefe('Stift: Tag nach dem Stempel zeigt ihn, auch wenn er nicht heute ist', stift('2026-10-16') === true && stift('2026-10-17') === true, tage)
pruefe('Stift: Tag bis zum Stempel zeigt ihn nicht', stift('2026-10-14') === false && stift('2026-10-15') === false, tage)
const gemischt = tageVon(auslieferbarePatchnotes([eintrag('2026-10-16', 'E'), { ...eintrag('2026-10-16', 'F'), highlight: true }], '2026-10-15'), 'alles')
pruefe('Stift: ein Tag mit Highlight und Zeile zeigt ihn einmal', gemischt.length === 1 && gemischt[0]?.entwurf === true, gemischt)

const echt = leseUeberarbeitetBis()
pruefe('Stempel: die echte Datei im Ordner ist ein gültiger Tag', echt !== undefined, echt)
// Nur Einträge mit eigenem `datum`: Die Datumsauflösung der übrigen braucht git und damit `git fetch` (Wettlauf um shallow.lock in check:logic, PR 1433).
const echteMitDatum = lesePatchnotesDateien().map((d) => d.eintrag).filter((e) => e.datum !== undefined)
const mitDatumInDatei = !existsSync('data/patchnotes') ? 0 : readdirSync('data/patchnotes').filter((n) => n.endsWith('.yaml') && /^datum:/m.test(readFileSync(`data/patchnotes/${n}`, 'utf8'))).length
pruefe('Stempel: die geprüfte Liste enthält alle Dateien mit eigenem datum (Anzahl gezählt am Dateitext)', echteMitDatum.length === mitDatumInDatei, { liste: echteMitDatum.length, dateien: mitDatumInDatei })
pruefe('Stempel: die echte Liste (Einträge mit datum) trägt Entwürfe genau hinter dem Stempel', auslieferbarePatchnotes(echteMitDatum, echt).every((n) => (n.entwurf === true) === (n.datum > (echt ?? ''))))

function mitOrdner<T>(stempel: string | undefined, tun: (ordner: string) => T): T {
  const ordner = mkdtempSync(`${tmpdir()}/patchnotes-stempel-`)
  try {
    if (stempel !== undefined) writeFileSync(`${ordner}/${STEMPEL_DATEI}`, stempel)
    for (const e of roh) writeFileSync(`${ordner}/${e.text}.yaml`, `datum: '${e.datum}'\nkategorie: bugfix\ntext: Eintrag ${e.text}\n`)
    return tun(ordner)
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
const aufgeloest = mitOrdner('2026-10-16\n', (o) => leseAuslieferbarePatchnotes(o).filter((n) => n.entwurf).map((n) => n.datum).sort().join())
pruefe('Verdrahtung: Auslieferung aus einem Ordner liest den Stempel dieses Ordners, nicht den echten', aufgeloest === '2026-10-17', aufgeloest)
pruefe('Stempel: Ordner ohne Datei liefert keinen Stempel', mitOrdner(undefined, (o) => leseUeberarbeitetBis(o)) === undefined)

const modul = new URL('./lib/patchnotes.ts', import.meta.url).href
const kaputt = mitOrdner('gestern', (o) => {
  const code = `import { leseUeberarbeitetBis } from ${JSON.stringify(modul)}\nleseUeberarbeitetBis(${JSON.stringify(o)})`
  const r = spawnSync(process.execPath, ['--import', tsx, '--input-type=module', '--eval', code], { encoding: 'utf8', timeout: 60_000 })
  return { status: r.status, aus: `${r.stdout}${r.stderr}` }
})
pruefe('Stempel: ein ungültiger Inhalt bricht den Bau ab', kaputt.status === 1 && kaputt.aus.includes('kein Tag'), kaputt)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
