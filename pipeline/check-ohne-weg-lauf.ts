/**
 * Der ganze Bauschritt `bau/13-13-ohne-weg.ts` als eigener Prozess über eine Kulisse (`AK_ROOT` im Temp-Ordner): liest die fertigen Dateien,
 * schreibt `ohne-weg.json`, zweiter Lauf byte-gleich; ein kaputter Bauer bricht ab (Exit 1, nichts geschrieben); zu viele `offen` warnen nur;
 * und `liefereAus` in `build.ts` ruft ihn auf. Die Regeln selbst prüft `check-ohne-weg.ts`. Aufruf: `npm run check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, extra: Record<string, unknown> = {}) => ({ id, format: 'TV', streams: [], ...extra })
/* 2999: der Befund ist in jedem Lauf jünger als 28 Tage, ohne dass der Test die Uhr liest. */
const jw = (jwId: string, tmdbId: number, art: string[]) => ({ geprueftAm: '2999-12-31', jwId, tmdbId, angebote: art.map((a) => ({ anbieter: 'X', art: a, audio: [] })) })

const wurzel = mkdtempSync(join(tmpdir(), 'ohne-weg-'))
try {
  for (const o of ['public/data', 'data']) mkdirSync(join(wurzel, o), { recursive: true })
  const dateien: Record<string, unknown> = {
    'titles.json': [titel(900101), titel(900102, { streams: [{ platform: 'netflix' }] }), titel(900103, { format: 'MOVIE' }), titel(900105)],
    'cartoons.json': [titel(-900104)],
    /* 2999: der Starttag liegt in jedem Lauf in der Zukunft, ohne dass der Test die Uhr liest. */
    'events.json': [{ titleId: 900101, platform: 'netflix', date: '2999-01-01' }],
  }
  for (const [n, d] of Object.entries(dateien)) writeFileSync(join(wurzel, 'public', 'data', n), JSON.stringify(d))
  writeFileSync(join(wurzel, 'data', ['justwatch', 'audio.json'].join('-')), JSON.stringify({ 900103: jw('k1', 21, []), '-900104': jw('k2', 22, ['RENT']) }))
  const modul = new URL('./bau/13-13-ohne-weg.ts', import.meta.url).href
  const skript = join(wurzel, 'lauf.ts')
  writeFileSync(
    skript,
    [
      `import { schreibeOhneWeg } from '${modul}'`,
      `const modus = process.argv[2]`,
      `if (modus === 'kaputt') schreibeOhneWeg({ bauer: () => ({}) })`,
      `else if (modus === 'grenze0') schreibeOhneWeg({ grenze: 0 })`,
      `else schreibeOhneWeg()`,
      '',
    ].join('\n'),
  )
  const lauf = (modus: string) => spawnSync(process.execPath, ['--import', 'tsx', skript, modus], { encoding: 'utf8', windowsHide: true, timeout: 60_000, env: { ...process.env, AK_ROOT: wurzel } })
  const datei = join(wurzel, 'public', 'data', 'ohne-weg.json')

  const kaputt = lauf('kaputt')
  pruefe('Kaputter Bauer (Titel ohne Eintrag): Exit 1, Fehlerzeile, nichts geschrieben', kaputt.status === 1 && kaputt.stderr.includes('ohne Eintrag in ohne-weg.json') && !existsSync(datei), { status: kaputt.status, stderr: kaputt.stderr.slice(0, 300) })

  const eins = lauf('normal')
  pruefe('Lauf: Exit 0 und Logzeile mit Zahl und Gründen je Art', eins.status === 0 && eins.stdout.includes('ohne-weg.json: 4 Titel ohne Streaming-Weg (angekuendigt 1, film-ohne-abo 1, nur-kauf 1, offen 1)'), { status: eins.status, stdout: eins.stdout, stderr: eins.stderr.slice(0, 300) })
  const erst = JSON.parse(readFileSync(datei, 'utf8')) as Record<string, { reason: string }>
  pruefe('Lauf: je ein Eintrag für die vier Titel ohne Weg, keiner für den mit Stream', Object.keys(erst).sort().join() === '-900104,900101,900103,900105', Object.keys(erst))
  pruefe('Lauf: Gründe aus Termin, JustWatch-Film, JustWatch-Cartoon, offen', erst['900101']?.reason === 'angekuendigt' && erst['900103']?.reason === 'film-ohne-abo' && erst['-900104']?.reason === 'nur-kauf' && erst['900105']?.reason === 'offen', erst)
  pruefe('Lauf mit der Vorgabegrenze: keine Warnung', !eins.stderr.includes('WARNUNG'), eins.stderr)
  const text = readFileSync(datei, 'utf8')
  const zwei = lauf('normal')
  pruefe('Zweiter Lauf: Exit 0 und Datei byte-gleich', zwei.status === 0 && readFileSync(datei, 'utf8') === text)

  const warnt = lauf('grenze0')
  pruefe('Mehr „offen“ als die Grenze: Warnzeile, Exit 0, Datei trotzdem geschrieben', warnt.status === 0 && warnt.stderr.includes('⚠ WARNUNG ohne-weg.json: 1 Titel „offen“, mehr als die Grenze 0'), { status: warnt.status, stderr: warnt.stderr.slice(0, 300) })
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

/* Der Aufrufer: `liefereAus` in build.ts ruft schreibeOhneWeg() unbedingt auf der obersten Ebene seines Rumpfs (Vorbild: check-cover-luecken-bau.ts). */
const quelle = ts.createSourceFile('build.ts', readFileSync(new URL('./build.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const aufrufer = quelle.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'liefereAus')
const oberste = (aufrufer?.body?.statements ?? []).flatMap((s) => (ts.isExpressionStatement(s) ? [s.expression] : []))
pruefe('build.ts: liefereAus ruft schreibeOhneWeg() auf', oberste.some((e) => ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'schreibeOhneWeg' && e.arguments.length === 0))

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ ohne-weg-lauf: Bauschritt schreibt je Titel ohne Weg einen Grund, bricht bei Widerspruch ab, warnt bei zu vielen offen, build.ts ruft ihn auf')
