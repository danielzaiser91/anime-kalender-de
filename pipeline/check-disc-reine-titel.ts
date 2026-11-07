/**
 * Reine aniSearch-Titel (Kennung ab 10 Mio.) bekommen Disc-Ausgaben aus ihrer archivierten Seite, obwohl sie nie in
 * `data/anisearch.json` stehen (06.11.2026: 0 von 163 hatten eine Disc, Beispiel 10017058 „Miraculous World: New York“).
 * Prüft die Zuordnung Seite → Titel, den Disc-Auszug als echten Prozess in einem Wegwerf-Ordner und den Bestandswächter
 * (Regel, Skript, Luft-Grenze).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { seiteZuTitel } from './lib/anisearch-seite-zu-titel.ts'
import { titelOhneDisc } from './lib/disc-ohne-zuordnung.ts'
import { bilanz } from './check-disc-anisearch-bestand.ts'

const REPO = join(import.meta.dirname, '..')
let fehler = 0
let pruefungen = 0
function erwarte(name: string, gefunden: unknown, soll: unknown): void {
  pruefungen++
  if (JSON.stringify(gefunden) === JSON.stringify(soll)) return
  fehler++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}, erwartet: ${JSON.stringify(soll)}`)
}

/* Aufbau wie auf der Seite 17058, Abschnitt „Neuerscheinungen“: Blu-ray-Artikel 129240, dazu eine ausländische Ausgabe und ein Manga-Band (kein Bildträger). */
const SEITE_MIT_DISC =
  '<section id="items"><h2>Neuerscheinungen</h2><div><ul><li class="merch129240 swiper-slide" data-date="2022-11-25"><a class="merchandise-item pointer" data-id="129240" data-href="article/129240,miraculous-blu-ray" title="x"><span class="title">Miraculous World: New York [Blu-ray]</span></a><div class="rank">Blu-ray</div></li>' +
  '<li class="merch1 swiper-slide" data-date="2022-01-01"><a class="merchandise-item pointer" data-href="article/1,us-disc"><img class="flag" src="" alt="us"><span class="title">Miraculous US [Blu-ray]</span></a></li>' +
  '<li class="merch2 swiper-slide" data-date=""><a class="merchandise-item pointer" data-href="article/2,manga"><span class="title">Miraculous Manga Bd. 3</span></a></li></ul></div></section>'
const SEITE_LEER = '<section id="items" class="empty"></section>'

/* 1. Zuordnung Seite → Titel */
const z = seiteZuTitel({ 123: { anisearchId: 456 } }, [123, 10_017_058, 77])
erwarte('AniList-Titel über die Brücke', z.get(456), 123)
erwarte('reiner aniSearch-Titel über die Kennung', z.get(17058), 10_017_058)
erwarte('Titel unter 10 Mio. ohne Brücke bekommt keine Seite', [...z.keys()].sort((a, b) => a - b), [456, 17058])
erwarte('reiner Titel steht nie über einen Brückeneintrag allein', seiteZuTitel({}, [10_000_001]).get(1), 10_000_001)

/* 2. Regel des Wächters: mit Zeile oder ohne Ausgabe auf der Seite fehlt nichts */
const anzahl: Record<number, number> = { 1: 2, 2: 1, 3: 0, 4: 1 }
erwarte('fehlt nur, wer Ausgaben auf der Seite hat und keine Zeile', titelOhneDisc([4, 3, 2, 1], (id) => anzahl[id] ?? 0, { 2: [{}], 4: [] }), [1, 4])

/* 3. Auszug und Wächter als Prozess (Wegwerf-Wurzel, `AK_ROOT` und cwd) */
const wurzel = mkdtempSync(join(tmpdir(), 'reine-wege-'))
function lauf(skript: string, args: string[] = []): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(REPO, 'pipeline', skript), ...args], {
    cwd: wurzel,
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  return { status: r.status, out: String(r.stdout) + String(r.stderr) }
}
/* Eine Wurzel mit n reinen Titeln samt Archivseite mit Disc-Ausgabe, aber ohne `disc-ausgaben.json`; `fuerWurzel` liest sie, danach wird sie entfernt. */
function wurzelMitTiteln<T>(n: number, fuerWurzel: (w: string) => T): T {
  const w = mkdtempSync(join(tmpdir(), 'reine-luft-'))
  try {
    mkdirSync(join(w, 'data', 'anisearch-raw'), { recursive: true })
    mkdirSync(join(w, 'public', 'data'), { recursive: true })
    const ids = Array.from({ length: n }, (_, i) => 10_000_100 + i)
    for (const id of ids) writeFileSync(join(w, 'data', 'anisearch-raw', `${id - 10_000_000}.html.gz`), gzipSync(SEITE_MIT_DISC))
    writeFileSync(join(w, 'public', 'data', 'titles.json'), JSON.stringify(ids.map((id) => ({ id }))))
    return fuerWurzel(w)
  } finally {
    rmSync(w, { recursive: true, force: true })
  }
}
try {
  mkdirSync(join(wurzel, 'data', 'anisearch-raw'), { recursive: true })
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'anisearch-raw', '17058.html.gz'), gzipSync(SEITE_MIT_DISC))
  writeFileSync(join(wurzel, 'data', 'anisearch-raw', '456.html.gz'), gzipSync(SEITE_MIT_DISC))
  writeFileSync(join(wurzel, 'data', 'anisearch-raw', '2.html.gz'), gzipSync(SEITE_LEER))
  /* Titel 999 steht in der Brücke, aber nicht in titles.json (z. B. hinter dem Toggle): seine Seite mit Disc darf nicht in den Auszug. */
  writeFileSync(join(wurzel, 'data', 'anisearch-raw', '789.html.gz'), gzipSync(SEITE_MIT_DISC))
  writeFileSync(join(wurzel, 'data', 'anisearch.json'), JSON.stringify({ 123: { anisearchId: 456 }, 999: { anisearchId: 789 } }))
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify([{ id: 123 }, { id: 10_017_058 }, { id: 10_000_002 }]))
  const disc = lauf('extract-disc-ausgaben.ts')
  erwarte('Disc-Auszug lief durch', disc.status, 0)
  const ausgaben = JSON.parse(readFileSync(join(wurzel, 'data', 'disc-ausgaben.json'), 'utf8')) as Record<string, { url?: string; format?: string }[]>
  erwarte('Disc-Titel', Object.keys(ausgaben).sort(), ['10017058', '123'])
  erwarte('Disc-Zählzeile: Blöcke, ausländisch, kein Bildträger', disc.out.includes('2 Titel mit deutscher Ausgabe (6 Blöcke geprüft, 2 ausländisch, 2 kein Bildträger)'), true)
  erwarte('reiner Titel: Artikel 129240 als Blu-ray', [ausgaben['10017058']?.[0]?.url, ausgaben['10017058']?.[0]?.format], ['https://www.anisearch.de/article/129240,miraculous-blu-ray', 'Blu-ray'])
  /* Wächter am selben Stand: mit Auszug keine Warnung, ohne die Zeile des reinen Titels genau eine (Titel 123 ist über die Brücke zugeordnet). */
  erwarte('Wächter: mit Auszug keine Warnung', bilanz(wurzel).some((z) => z.includes('WARNUNG')), false)
  const voll = readFileSync(join(wurzel, 'data', 'disc-ausgaben.json'), 'utf8')
  writeFileSync(join(wurzel, 'data', 'disc-ausgaben.json'), JSON.stringify({ 123: ausgaben['123'] }))
  const ohne = bilanz(wurzel).filter((z) => z.includes('WARNUNG'))
  erwarte('Wächter: ohne Zeile des reinen Titels eine Warnung mit seiner Kennung', [ohne.length, ohne[0]?.includes('1 Titel ohne Zeile'), ohne[0]?.endsWith(': 10017058')], [1, true, true])
  writeFileSync(join(wurzel, 'data', 'disc-ausgaben.json'), '{}')
  const beide = bilanz(wurzel).filter((z) => z.includes('WARNUNG'))
  erwarte('Wächter: ohne Datei fehlen der AniList-Titel (Brücke) und der reine Titel, sortiert', [beide.length, beide[0]?.includes('2 Titel ohne Zeile'), beide[0]?.endsWith(': 123, 10017058')], [1, true, true])
  writeFileSync(join(wurzel, 'data', 'disc-ausgaben.json'), JSON.stringify({ 123: ausgaben['123'] }))
  const alsSkript = lauf('check-disc-anisearch-bestand.ts', [wurzel])
  erwarte('Wächter als Skript: Exit 0, Warnung für 10017058, VERSTÖSSE: 0', [alsSkript.status, alsSkript.out.includes('⚠ WARNUNG Disc-Zuordnung: 1 Titel ohne Zeile'), alsSkript.out.includes('VERSTÖSSE: 0')], [0, true, true])
  writeFileSync(join(wurzel, 'data', 'disc-ausgaben.json'), voll)
  erwarte('Wächter als Skript: mit Auszug keine Warnung', lauf('check-disc-anisearch-bestand.ts', [wurzel]).out.includes('WARNUNG'), false)
  for (const [n, mehrAlsEinTag] of [[10, false], [11, true]] as const) {
    const meldung = wurzelMitTiteln(n, (w) => bilanz(w).join('\n'))
    erwarte(`Wächter bei ${n} fehlenden Titeln: "mehr als ein Tag" ${mehrAlsEinTag}`, meldung.includes('mehr als ein Tag'), mehrAlsEinTag)
    /* Die Warnung nennt höchstens zehn Kennungen; bei mehr steht „, …“ statt der elften. */
    erwarte(`Wächter bei ${n} fehlenden Titeln: Kennungsliste`, [meldung.includes('10000109'), meldung.includes('10000110'), meldung.includes('10000109, …')], [true, false, mehrAlsEinTag])
  }
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`FEHL check-disc-reine-titel: ${fehler} von ${pruefungen}`)
  process.exit(1)
}
console.log(`check-disc-reine-titel: ${pruefungen} Prüfungen ok (Zuordnung, Disc-Auszug als Prozess, Bestandswächter als Regel, Skript und Luft-Grenze).`)
