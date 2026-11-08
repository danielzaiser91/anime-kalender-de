/**
 * Prozesstest der Bestandswache `check-cover-vorschau-bestand.ts` (06.11.2026): Das Skript läuft als eigener Prozess gegen einen Wegwerf-Bestand
 * (`AK_ROOT`). Geprüft werden Exit-Code und Meldung an der Grenze 170 (Wert fest eingetragen), die Ausnahmen (Termin, Plakat, Cover mit Maßen,
 * Titel ohne Seite) und die Rechnung als reine Funktion. Anlass: PR 2872 verschob den Bestand von 449 auf 471, die Kette blieb grün.
 * Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import { coverVorschauBestandMangel, standardTrotzCoverTitel } from './lib/cover-vorschau-bestand.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const BASIS = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/'
const OHNE_MASSE = `${BASIS}large/ohne-masse.jpg`
const MIT_MASSE = `${BASIS}large/mit-masse.jpg`
const ZU_GROSS = `${BASIS}large/zu-gross.png`
const PLAKAT = 'https://image.tmdb.org/t/p/w500/plakat.jpg'
const titel = (id: number, extra: Partial<Title> = {}): Title => ({ id, slug: `t${id}`, titleDe: `T${id}`, format: 'TV', episodes: 12, coverImage: OHNE_MASSE, ...extra }) as Title

/* Reine Rechnung: nur Cover ohne Maße, ohne Termin, mit Seite zählt. */
const masse = new Map<string, readonly [number, number]>([['anilist:large/mit-masse.jpg', [460, 649]], ['/plakat.jpg', [1000, 1500]]])
const alle = [
  titel(1),
  titel(2, { coverImage: MIT_MASSE }),
  titel(3, { coverImage: PLAKAT }),
  titel(4),
  titel(5, { coverImage: ZU_GROSS }),
  titel(6, { coverImage: undefined }),
  titel(7, { ohneSynchro: true }),
  titel(8, { slug: undefined }),
  titel(9, { bannerImage: 'https://image.tmdb.org/t/p/w1280/b.jpg' }),
]
pruefe('Rechnung: 1 (ohne Maße), 4 (mit Termin ausgenommen), 5 (zu groß)', standardTrotzCoverTitel(alle, new Set([4]), masse).map((t) => t.id).join() === '1,5')
pruefe('Rechnung: ohne Termine zählt 4 mit', standardTrotzCoverTitel(alle, new Set(), masse).map((t) => t.id).join() === '1,4,5')
pruefe('Rechnung: ohne Maße zählt 2 und 3 mit', standardTrotzCoverTitel(alle, new Set([4]), new Map()).map((t) => t.id).join() === '1,2,3,5')
const drei = [titel(10), titel(30), titel(20)]
pruefe('Meldung: an der Grenze nichts', coverVorschauBestandMangel(drei, 3) === undefined)
pruefe('Meldung: eins darüber nennt beide Zahlen und die jüngste Kennung', coverVorschauBestandMangel(drei, 2) === '3 Titel mit Cover zeigen das Standardbild als Link-Vorschau, erlaubt höchstens 2 (jüngste Kennungen: 30)')
pruefe('Meldung: zwei darüber nennt die zwei jüngsten', coverVorschauBestandMangel(drei, 1)?.endsWith('(jüngste Kennungen: 30, 20)') === true)

/* Prozess: Wegwerf-Bestand mit n Titeln, die das Standardbild bekämen. */
function lauf(n: number, extra: Title[] = [], releases: unknown[] = [], ohneCover = false): { code: number | null; out: string; err: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'cover-vorschau-bestand-'))
  try {
    mkdirSync(join(wurzel, 'public/data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    const standard = Array.from({ length: n }, (_, i) => titel(1000 + i, ohneCover ? { coverImage: undefined } : {}))
    writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify([...standard, ...extra]))
    writeFileSync(join(wurzel, 'public/data/releases.json'), JSON.stringify(releases))
    writeFileSync(join(wurzel, 'data/tmdb-poster.json'), JSON.stringify({ '1': { p: '/plakat.jpg', w: 1000, h: 1500 } }))
    writeFileSync(join(wurzel, 'data/anilist-cover-masse.json'), JSON.stringify({ 'large/mit-masse.jpg': [460, 649, 100_000], 'large/zu-gross.png': [460, 667, 412_397] }))
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'pipeline/check-cover-vorschau-bestand.ts'], { encoding: 'utf8', windowsHide: true, timeout: 60_000, env: { ...process.env, AK_ROOT: wurzel } })
    return { code: r.status, out: r.stdout, err: r.stderr }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}
const ok = lauf(170)
pruefe('Prozess: 170 Titel (Grenze) grün, Schlusszeile da', ok.code === 0 && ok.out.includes('170 mit Standardbild') && ok.out.includes('VERSTÖSSE: 0'), ok.out + ok.err)
const rot = lauf(171)
pruefe('Prozess: 171 rot mit beiden Zahlen und der jüngsten Kennung', rot.code === 1 && rot.err.includes('171 Titel mit Cover zeigen das Standardbild als Link-Vorschau, erlaubt höchstens 170 (jüngste Kennungen: 1170)') && rot.err.includes('VERSTÖSSE: 1'), rot.err)
const ausnahmen = lauf(170, [titel(2000, { coverImage: MIT_MASSE }), titel(2001, { coverImage: PLAKAT }), titel(2002), titel(2003, { ohneSynchro: true })], [{ slug: 'x', titleId: 2002 }, { titleId: 2003 }])
pruefe('Prozess: Cover mit Maßen, Plakat, Titel mit Termin und Titel ohne Seite zählen nicht (170 grün)', ausnahmen.code === 0 && ausnahmen.out.includes('170 mit Standardbild'), ausnahmen.out + ausnahmen.err)
const ohneTerminSlug = lauf(170, [titel(2002)], [{ titleId: 2002 }])
pruefe('Prozess: Release ohne Seite (kein slug) nimmt dem Titel das Standardbild nicht ab (171 rot)', ohneTerminSlug.code === 1, ohneTerminSlug.out + ohneTerminSlug.err)
const leer = lauf(5, [], [], true)
pruefe('Prozess: kein Titel mit Cover ist rot (die Wache prüfte nichts)', leer.code === 1 && leer.err.includes('prüft nichts'), leer.err)

if (fehler) {
  console.error(`[cover-vorschau-bestand-lauf] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[cover-vorschau-bestand-lauf] ${faelle} Fälle grün (Grenze 170 als Prozess, Termin/Plakat/Cover mit Maßen/ohne Seite zählen nicht, leerer Bestand rot)`)
