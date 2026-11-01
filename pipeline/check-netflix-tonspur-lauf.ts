/**
 * Verdrahtung der Netflix-Tonspur-Lesung in `pipeline/check-links.ts`: der echte Prüflauf als Prozess gegen eine Kulisse im
 * Temp-Ordner (`AK_ROOT`, cwd) mit Abruf-Attrappe, die jede angefragte Adresse in eine Datei schreibt.
 * 1. Offener Film (MOVIE, kein Beleg): seine Titelseite unter /de/title/ wird gelesen, das Ja steht als Handbeleg in dub-confirmed.yaml.
 * 2. Eine Serie (TV) wird nie unter /de/title/ gelesen.
 * 3. Zweiter Lauf am selben Tag: kein neuer Abruf, kein doppelter Beleg.
 * 4. Sperre (403) und Seite ohne Audio-Zeile: Lauf endet mit 0, kein Beleg, kein Nein.
 * Aufruf: npx tsx pipeline/check-netflix-tonspur-lauf.ts
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const wurzel = resolve(import.meta.dirname, '..')
const fehler: string[] = []
let faelle = 0
const pruefe = (name: string, ok: boolean, info?: unknown) => {
  faelle++
  if (!ok) fehler.push(`${name}${info === undefined ? '' : ` (${JSON.stringify(info)})`}`)
}
const nf = (k: string) => `https://www.netflix.com/title/${k}`
const de = (k: string) => `https://www.netflix.com/de/title/${k}`
const JA = readFileSync(join(wurzel, 'pipeline/fixtures/netflix-titelseite-chihiro.html'), 'utf8')

type Antworten = Record<string, [number, string]>
interface Lauf {
  status: number | null
  ausgabe: string
  gefragt: string[]
  dub: string
  bestand: Record<string, { status: unknown; audio?: string; audioAm?: string }>
}

/** Ein oder mehrere Läufe in derselben Kulisse; liefert den Zustand nach dem letzten. */
function laufe(antworten: Antworten, anzahl: number): Lauf {
  const tmp = mkdtempSync(join(process.argv[2] ?? tmpdir(), 'check-netflix-tonspur-'))
  try {
    mkdirSync(join(tmp, 'public/data'), { recursive: true })
    mkdirSync(join(tmp, 'data'), { recursive: true })
    const titel = [
      { id: 900001, format: 'MOVIE', titleDe: 'Testfilm', streams: [{ platform: 'netflix', url: nf('900301') }] },
      { id: 900002, format: 'TV', titleDe: 'Testserie', streams: [{ platform: 'netflix', url: nf('900302') }] },
    ]
    writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify(titel))
    writeFileSync(join(tmp, 'data/dub-confirmed.yaml'), '# Kulisse\n- anilistId: 900099\n  platform: primevideo\n  url: https://www.amazon.de/dp/B0KULISSE1\n  dub: true\n  checkedAt: \'2026-09-01\'\n')
    writeFileSync(join(tmp, 'data/erneut-melden.yaml'), '[]\n')
    const anfragen = join(tmp, 'anfragen.txt')
    appendFileSync(anfragen, '')
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
    let r = { status: 0 as number | null, stdout: '', stderr: '' }
    for (let i = 0; i < anzahl; i++) {
      r = spawnSync(
        process.execPath,
        ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--alter', '0'],
        { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, encoding: 'utf8', timeout: 60_000 },
      )
      if (r.status !== 0) break
    }
    return {
      status: r.status,
      ausgabe: `${r.stdout}${r.stderr}`.slice(-600),
      gefragt: readFileSync(anfragen, 'utf8').split('\n').filter(Boolean),
      dub: readFileSync(join(tmp, 'data/dub-confirmed.yaml'), 'utf8'),
      bestand: JSON.parse(readFileSync(join(tmp, 'data/link-check.json'), 'utf8')),
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
const zaehle = (text: string, teil: string) => text.split(teil).length - 1
const statusSeiten: Antworten = { [nf('900301')]: [200, ''], [nf('900302')]: [200, ''] }

const ja = laufe({ ...statusSeiten, [de('900301')]: [200, JA] }, 1)
pruefe('Lauf endet mit 0', ja.status === 0, ja.ausgabe)
pruefe('offener Film wird unter /de/title/ gelesen', ja.gefragt.includes(de('900301')), ja.gefragt)
pruefe('die Serie wird nie unter /de/title/ gelesen', !ja.gefragt.includes(de('900302')), ja.gefragt)
pruefe('Ja steht als Handbeleg für den Film', /- anilistId: 900001\n {2}title: "Testfilm"\n {2}platform: netflix\n {2}url: https:\/\/www\.netflix\.com\/title\/900301\n {2}dub: true\n/.test(ja.dub), ja.dub.slice(-500))
pruefe('kein Beleg für die Serie', !ja.dub.includes('anilistId: 900002'), ja.dub.slice(-500))
pruefe('der Handbeleg der Kulisse bleibt', ja.dub.includes('anilistId: 900099'))
pruefe('Linkbefund trägt Urteil ja und Datum', ja.bestand[nf('900301')]?.audio === 'ja' && /^\d{4}-\d\d-\d\d$/.test(ja.bestand[nf('900301')]?.audioAm ?? ''), ja.bestand)
pruefe('Linkbefund der Serie ohne Urteil', ja.bestand[nf('900302')]?.audio === undefined, ja.bestand)

const zweimal = laufe({ ...statusSeiten, [de('900301')]: [200, JA] }, 2)
pruefe('zweiter Lauf: Film nur einmal unter /de/title/ gelesen', zweimal.status === 0 && zaehle(zweimal.gefragt.join('\n'), de('900301')) === 1, zweimal.gefragt)
pruefe('zweiter Lauf: Beleg nicht doppelt', zaehle(zweimal.dub, 'anilistId: 900001') === 1, zweimal.dub.slice(-500))

const gesperrt = laufe({ ...statusSeiten, [de('900301')]: [403, ''] }, 1)
pruefe('403: Lauf endet mit 0', gesperrt.status === 0, gesperrt.ausgabe)
pruefe('403: kein Beleg, kein Urteil im Befund', !gesperrt.dub.includes('anilistId: 900001') && gesperrt.bestand[nf('900301')]?.audio === undefined, gesperrt.bestand)
pruefe('403: Befund behält den Status 200 der Linkprüfung', gesperrt.bestand[nf('900301')]?.status === 200, gesperrt.bestand)
pruefe('403: das Log nennt die Sperre', /sperrt \(403\/429\)/.test(gesperrt.ausgabe), gesperrt.ausgabe)

const leer = laufe({ ...statusSeiten, [de('900301')]: [200, '<html>Anmelden</html>'] }, 1)
pruefe('Seite ohne Audio-Zeile: Befund unbekannt, kein Beleg', leer.status === 0 && leer.bestand[nf('900301')]?.audio === 'unbekannt' && !leer.dub.includes('anilistId: 900001'), leer)

if (fehler.length) {
  console.error(`check-netflix-tonspur-lauf: ${fehler.length} von ${faelle} Fällen falsch:\n- ${fehler.join('\n- ')}`)
  process.exit(1)
}
console.log(`check-netflix-tonspur-lauf: ${faelle} Fälle — Film gelesen und belegt, Serie nie gelesen, zweiter Lauf ohne Abruf, 403 und leere Seite ohne Beleg.`)
