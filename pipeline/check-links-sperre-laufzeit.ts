/**
 * Laufzeittest statt Quelltext-Zusicherung für `check-links.ts` (Muster 2472): der Prüflauf als Prozess gegen eine Kulisse im Temp-Ordner
 * (`AK_ROOT`, cwd) mit Abruf-Attrappe, die jede angefragte Adresse in eine Datei schreibt; der Bestand ist vorbelegt.
 * 1. „unklar“ überschreibt keinen echten Befund (404 bleibt samt Datum), ersetzt aber ein altes „unklar“ (neues Datum) und steht bei neuer Adresse.
 * 2. Sperr-Schwelle: Amazon fragt genau 20 Adressen in Folge, dann ist Schluss (`--sperren 0`); die übrigen Amazon-Adressen bleiben ungefragt.
 * 3. Die Sperre hält andere Anbieter nicht auf: Netflix-Adressen hinter den Amazon-Adressen werden trotzdem geprüft.
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const wurzel = resolve(import.meta.dirname, '..')
const fehler: string[] = []
const pruefe = (name: string, ok: boolean, info?: unknown) => {
  if (!ok) fehler.push(`${name}${info === undefined ? '' : ` (${JSON.stringify(info)})`}`)
}
type Befund = { status: unknown; geprueftAm?: string }

const video = (k: string) => `https://www.amazon.de/gp/video/detail/${k}`
const netflix = (n: number) => `https://www.netflix.com/title/${n}`
const ALT = '2000-01-01'
const NETFLIX_ALT = '2001-01-01'

/* Ein Lauf gegen vorbelegten Bestand; Amazon-Video-Seiten liefern 200 ohne Produktmerkmal (= unklar), alles andere 200. */
function lauf(vorher: Record<string, Befund>, extra: string[], wurzelOrdner?: string, streams: { platform: string; url: string }[] = []) {
  const tmp = mkdtempSync(join(wurzelOrdner ?? tmpdir(), 'check-links-sperre-'))
  try {
    mkdirSync(join(tmp, 'public/data'), { recursive: true })
    mkdirSync(join(tmp, 'data'), { recursive: true })
    writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify([{ id: 900001, streams }]))
    writeFileSync(join(tmp, 'data/link-check.json'), JSON.stringify(vorher))
    const anfragen = join(tmp, 'anfragen.txt')
    appendFileSync(anfragen, '')
    const stub = join(tmp, 'fetch-stub.mjs')
    writeFileSync(
      stub,
      `import { appendFileSync } from 'node:fs'
globalThis.fetch = async (url) => {
  appendFileSync(${JSON.stringify(anfragen)}, String(url) + '\\n')
  return new Response(String(url).includes('amazon') ? '<html>nichts Brauchbares</html>' : '', { status: 200 })
}
`,
    )
    const r = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', ...extra],
      { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, encoding: 'utf8', timeout: 60_000 },
    )
    pruefe(`Lauf ${extra.join(' ')} endet mit 0`, r.status === 0, `${r.stdout}${r.stderr}`.slice(-400))
    return {
      bestand: JSON.parse(readFileSync(join(tmp, 'data/link-check.json'), 'utf8')) as Record<string, Befund>,
      gefragt: readFileSync(anfragen, 'utf8').split('\n').filter(Boolean),
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

{
  const echt = video('B0ECHT0404')
  const altUnklar = video('B0ALTUNKLA')
  const neuUnklar = video('B0NEUUNKLA')
  const { bestand } = lauf({ [echt]: { status: 404, geprueftAm: ALT }, [altUnklar]: { status: 'unklar', geprueftAm: ALT } }, ['--limit', '0'], process.argv[2], [{ platform: 'primevideo', url: neuUnklar }])
  pruefe('unklar lässt den echten Befund 404 samt Datum stehen', bestand[echt]?.status === 404 && bestand[echt]?.geprueftAm === ALT, bestand[echt])
  pruefe('unklar ersetzt ein altes unklar (neues Datum)', bestand[altUnklar]?.status === 'unklar' && bestand[altUnklar]?.geprueftAm !== ALT, bestand[altUnklar])
  pruefe('neue Adresse bekommt unklar', bestand[neuUnklar]?.status === 'unklar', bestand[neuUnklar])
}
{
  const amazon = Array.from({ length: 25 }, (_, i) => video(`B0SPERR${String(i).padStart(3, '0')}`))
  const andere = [netflix(7001), netflix(7002), netflix(7003)]
  const vorher: Record<string, Befund> = {}
  for (const u of amazon) vorher[u] = { status: 'unklar', geprueftAm: ALT }
  for (const u of andere) vorher[u] = { status: 404, geprueftAm: NETFLIX_ALT }
  const { bestand, gefragt } = lauf(vorher, ['--sperren', '0', '--sperrpause', '1'], process.argv[2])
  const amazonGefragt = gefragt.filter((u) => u.includes('amazon'))
  pruefe('Sperr-Schwelle: genau 20 Amazon-Adressen in Folge, dann keine mehr', amazonGefragt.length === 20, amazonGefragt.length)
  pruefe('die fünf übrigen Amazon-Adressen bleiben ungefragt und im Bestand fällig', amazon.slice(20).every((u) => !gefragt.includes(u) && bestand[u]?.geprueftAm === ALT), amazon.slice(20))
  pruefe('Amazon-Sperre hält Netflix nicht auf: alle drei Adressen geprüft', andere.every((u) => gefragt.includes(u) && bestand[u]?.status === 200), { gefragt: gefragt.length })
}

if (fehler.length) {
  console.error(`check-links-sperre-laufzeit: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-links-sperre-laufzeit: unklar überschreibt keinen Befund, Sperre nach genau 20 Amazon-unklar, Netflix danach weiter geprüft.')
