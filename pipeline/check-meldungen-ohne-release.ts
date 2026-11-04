/**
 * Wächter „Meldung mit Termin und deutschem Ton ohne Release“ (Ziel 0), Einheiten- und Prozessprüfung ohne Zugriff auf Bau-Daten:
 * Überfälligkeit, Vergleich mit der Liste der bekannten (Kennungen, keine Anzahl), Warnzeilen und der Bestandsteil
 * `check-meldungen-ohne-release-bestand.ts` als Prozess gegen einen Wegwerf-Ordner. Der Lauf gegen den echten Bestand steht in `check:bestand`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { befundSchluessel, gegenBekannte, ueberfaelligOhneRelease } from './lib/meldungen-ohne-release.ts'
import { zeilenOhneRelease } from './lib/meldungen-ohne-release-zeilen.ts'
import { BEKANNT_OHNE_RELEASE } from './lib/meldungen-ohne-release-bekannt.ts'
import type { NichtZugeordnet } from './lib/sammel-unzugeordnet.ts'

const hier = dirname(fileURLToPath(import.meta.url))
let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const e = (artikel: string, titel = 'T'): NichtZugeordnet => ({ titel, artikel, tag: '2026-11-03', anbieter: ['netflix'], quelle: 'Einzelartikel' })

function ueberfaelligkeit(): void {
  const tage = new Map([['a', '2026-11-01'], ['b', '2026-10-31'], ['c', '2026-11-04']])
  const heute = '2026-11-03'
  const urls = ueberfaelligOhneRelease([e('a'), e('b'), e('c'), e('ohne-datum')], tage, heute).map((b) => b.eintrag.artikel)
  pruefe('genau zwei Tage alt (01.11. bei Stand 03.11.) ist noch nicht überfällig', !urls.includes('a'), urls)
  pruefe('drei Tage alt (31.10.) ist überfällig', urls.includes('b'), urls)
  pruefe('jünger als der Stand (04.11.) ist nicht überfällig', !urls.includes('c'), urls)
  pruefe('ohne bekannten Meldetag gilt als überfällig (fail closed)', urls.includes('ohne-datum'), urls)
  pruefe('leere Liste: nichts überfällig', ueberfaelligOhneRelease([], tage, heute).length === 0)
}

const alt = (artikel: string, titel: string) => ueberfaelligOhneRelease([e(artikel, titel)], new Map([[artikel, '2026-10-01']]), '2026-11-03')[0]!

function vergleich(): void {
  const x = alt('u1', 'X')
  const y = alt('u1', 'Y')
  const kx = befundSchluessel(x)
  pruefe('Schlüssel nennt Artikel und Titel (ein Artikel, zwei Titel: zwei Schlüssel)', kx !== befundSchluessel(y), [kx, befundSchluessel(y)])
  const g = gegenBekannte([x, y], [kx])
  pruefe('Y steht nicht auf der Liste: neu; X bekannt', g.neu.length === 1 && g.neu[0] === befundSchluessel(y) && g.erledigt.length === 0, g)
  const h = gegenBekannte([x], [kx, 'u9 | Z', 'u8 | W'])
  pruefe('Listeneinträge ohne Befund sind erledigt (zwei, neu 0)', h.neu.length === 0 && h.erledigt.length === 2, h)
  const gleich = gegenBekannte([x], [kx])
  pruefe('Befund und Liste gleich: weder neu noch erledigt', gleich.neu.length === 0 && gleich.erledigt.length === 0, gleich)
  const z = zeilenOhneRelease([x, y], [kx], '2026-11-03')
  pruefe('neu: Zählzeile plus genau eine herabgestufte Warnzeile mit dem Schlüssel', z.length === 2 && z[0]!.includes('neu 1') && z[1]!.startsWith('⚠ WARNUNG [vorher rot]') && z[1]!.includes(befundSchluessel(y)), z)
  const w = zeilenOhneRelease([x], [kx, 'u9 | Z'], '2026-11-03')
  pruefe('erledigt: Hinweis zum Streichen, nicht herabgestuft', w.length === 2 && w[1]!.startsWith('⚠ WARNUNG Meldung ohne Release erledigt') && !w[1]!.includes('[vorher rot]') && w[1]!.includes('u9 | Z'), w)
  pruefe('nichts zu melden: nur die Zählzeile', zeilenOhneRelease([x], [kx], '2026-11-03').length === 1)
  pruefe('Liste der bekannten: keine Doppelten', new Set(BEKANNT_OHNE_RELEASE).size === BEKANNT_OHNE_RELEASE.length)
}

/** Der Bestandsteil als Prozess: `eintraege` als nicht-zugeordnet.json, alle Artikel am 01.10. gemeldet, Stand 03.11. */
function lauf(eintraege: NichtZugeordnet[]): { code: number | null; aus: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'ohne-release-'))
  try {
    mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
    writeFileSync(join(wurzel, 'data', 'proposals', 'nicht-zugeordnet.json'), JSON.stringify({ stand: '2026-11-03', eintraege }))
    const proposals = eintraege.map((x) => ({ articleUrl: x.artikel, publishedAt: '2026-10-01' }))
    writeFileSync(join(wurzel, 'data', 'proposals', 'anime2you.json'), JSON.stringify({ proposals }))
    const r = spawnSync(process.execPath, [join(hier, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(hier, 'check-meldungen-ohne-release-bestand.ts')], { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 60_000 })
    return { code: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

function prozess(): void {
  const bekanntes = BEKANNT_OHNE_RELEASE.map((k) => e(k.split(' | ')[0]!, k.split(' | ').slice(1).join(' | ')))
  const gleich = lauf(bekanntes)
  pruefe('Prozess, Liste und Bestand gleich: Exit 0, keine Warnzeile', gleich.code === 0 && !gleich.aus.includes('⚠ WARNUNG') && gleich.aus.includes('neu 0, erledigt 0'), gleich)
  const fremd = lauf([...bekanntes, e('https://fremd.example/artikel', 'Fremder Titel')])
  pruefe('Prozess, fremder Eintrag: Exit 0 (die PR-Kette bleibt grün) und herabgestufte Meldung mit dem Titel', fremd.code === 0 && fremd.aus.includes('⚠ WARNUNG [vorher rot]') && fremd.aus.includes('Fremder Titel') && fremd.aus.includes('neu 1,'), fremd)
  const weg = lauf(bekanntes.slice(1))
  pruefe('Prozess, bekannter Eintrag fehlt im Bestand: Hinweis zum Streichen', weg.code === 0 && weg.aus.includes('⚠ WARNUNG Meldung ohne Release erledigt: 1 ') && weg.aus.includes(BEKANNT_OHNE_RELEASE[0]!), weg)
}

function main(): number {
  ueberfaelligkeit()
  vergleich()
  prozess()
  console.log(fehler ? `✖ ${fehler} Fehler` : '✓ check-meldungen-ohne-release (Überfälligkeit, Vergleich mit der Liste, Zeilen, Prozess gegen Wegwerf-Ordner)')
  return fehler ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) process.exit(main())
