/**
 * Laufzeittest statt Quelltext-Zusicherung für `check-links.ts` (Muster 2472): der Prüflauf als Prozess gegen eine Kulisse im Temp-Ordner
 * (`AK_ROOT`, cwd) mit Abruf-Attrappe, die jede angefragte Adresse in eine Datei schreibt.
 * 1. Amazon-404 unter `/dp/`: die Video-Adresse derselben Kennung wird gegengeprüft; lebt sie, gilt der Befund 200 unter der `/dp/`-Adresse.
 * 2. Ein Amazon-200 ohne Produktmerkmal ist `unklar`, nicht 200; mit Produktmerkmal ist es 200.
 * 3. Ein 404 bei einer Nicht-Amazon-Adresse wird nicht zweimal gefragt.
 * 4. Geprüft wird die Amazon-Seite (`seite`) eines Wegs, nicht JustWatchs Adresse (`url`); ohne `seite` die `url`.
 * 5. `unklar` ist beim nächsten Lauf wieder fällig, auch bei frischem Datum (`istFaellig`).
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { istFaellig } from './lib/link-befund.ts'

const wurzel = resolve(import.meta.dirname, '..')
const fehler: string[] = []
const pruefe = (name: string, ok: boolean, info?: unknown) => {
  if (!ok) fehler.push(`${name}${info === undefined ? '' : ` (${JSON.stringify(info)})`}`)
}

const video = (k: string) => `https://www.amazon.de/gp/video/detail/${k}`
const dp = (k: string) => `https://www.amazon.de/dp/${k}`
const NETFLIX = 'https://www.netflix.com/title/404404'
const JW = 'https://www.justwatch.com/de/serie/weg-ueber-justwatch'
const SEITE = video('B0SEITE001')
/* Antworten je Adresse: [Status, Text]. */
const antworten: Record<string, [number, string]> = {
  [dp('B0DPLEBT01')]: [404, 'Seite wurde nicht gefunden'],
  [video('B0DPLEBT01')]: [200, '<title>Serie | Prime Video</title> productTitle'],
  [dp('B0DPTOT001')]: [404, 'Seite wurde nicht gefunden'],
  [video('B0DPTOT001')]: [404, 'Seite wurde nicht gefunden'],
  [video('B0LEER0001')]: [200, '<html>nichts Brauchbares</html>'],
  [SEITE]: [200, 'productTitle'],
  [NETFLIX]: [404, ''],
}

const tmp = mkdtempSync(join(process.argv[2] ?? tmpdir(), 'check-links-laufzeit-'))
try {
  mkdirSync(join(tmp, 'public/data'), { recursive: true })
  mkdirSync(join(tmp, 'data'), { recursive: true })
  const wege = [
    { platform: 'primevideo', url: dp('B0DPLEBT01') },
    { platform: 'primevideo', url: dp('B0DPTOT001') },
    { platform: 'primevideo', url: video('B0LEER0001') },
    { platform: 'primevideo', url: JW, seite: SEITE },
    { platform: 'netflix', url: NETFLIX },
  ]
  writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify([{ id: 900001, streams: wege }]))
  const anfragen = join(tmp, 'anfragen.txt')
  const stub = join(tmp, 'fetch-stub.mjs')
  writeFileSync(
    stub,
    `import { appendFileSync } from 'node:fs'
const antworten = ${JSON.stringify(antworten)}
globalThis.fetch = async (url) => {
  appendFileSync(${JSON.stringify(anfragen)}, String(url) + '\\n')
  const a = antworten[String(url)]
  if (!a) throw new Error('Attrappe: unerwartet ' + url)
  return new Response(a[1], { status: a[0] })
}
`,
  )
  appendFileSync(anfragen, '')
  const r = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1'],
    { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, encoding: 'utf8', timeout: 60_000 },
  )
  pruefe('Lauf endet mit 0', r.status === 0, `${r.stdout}${r.stderr}`.slice(-400))
  const bestand = JSON.parse(readFileSync(join(tmp, 'data/link-check.json'), 'utf8')) as Record<string, { status: unknown }>
  const gefragt = readFileSync(anfragen, 'utf8').split('\n').filter(Boolean)

  pruefe('404 unter /dp/ wird an der Video-Seite gegengeprüft', gefragt.includes(video('B0DPLEBT01')), gefragt)
  pruefe('lebende Video-Seite: Befund 200 unter der /dp/-Adresse', bestand[dp('B0DPLEBT01')]?.status === 200, bestand[dp('B0DPLEBT01')])
  pruefe('auch die Video-Seite 404: bleibt 404', bestand[dp('B0DPTOT001')]?.status === 404, bestand[dp('B0DPTOT001')])
  pruefe('Amazon-200 ohne Produktseite ist unklar', bestand[video('B0LEER0001')]?.status === 'unklar', bestand[video('B0LEER0001')])
  pruefe('Amazon-200 mit Produktseite ist 200', bestand[SEITE]?.status === 200, bestand[SEITE])
  pruefe('Netflix-404 wird nur einmal gefragt', gefragt.filter((a) => a === NETFLIX).length === 1, gefragt)
  pruefe('geprüft wird `seite`, nicht JustWatchs `url`', gefragt.includes(SEITE) && !gefragt.includes(JW) && !(JW in bestand), gefragt)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

pruefe('unklar ist bei frischem Datum wieder fällig', istFaellig({ status: 'unklar', geprueftAm: '2999-12-31' }, '2026-01-01') === true)
pruefe('200 mit frischem Datum ist nicht fällig', istFaellig({ status: 200, geprueftAm: '2999-12-31' }, '2026-01-01') === false)

if (fehler.length) {
  console.error(`check-links-laufzeit: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-links-laufzeit: Video-Gegenprobe nach /dp/-404, 200 ohne Produktseite unklar und wieder fällig, seite statt JustWatch-Adresse geprüft.')
