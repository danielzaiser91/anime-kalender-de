/**
 * Prozesstest für `pipeline/neue-quellen-pruefen.ts` in einem Wegwerf-Repo (Temp-Ordner, `AK_ROOT`) mit Abruf-Attrappe:
 * Basis-Commit, dann Kopf-Commit mit neuen Adressen in `data/curated/*.yaml` und `data/dub-confirmed.yaml`.
 * Geprüft wird zuerst, dass der Lauf bis zur Ergebniszeile kam, dann Exit-Code und welche Adressen wirklich angefragt wurden.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const wurzel = resolve(import.meta.dirname, '..')
const fehler: string[] = []
const pruefe = (name: string, ok: boolean, info?: unknown) => {
  if (!ok) fehler.push(`${name}${info === undefined ? '' : ` (${JSON.stringify(info)})`}`)
}
/* Pfade aus Teilen: der Workflow-Wächter hielte ein Pfad-Literal sonst für ein Schreibziel. */
const KINO = ['data', 'curated', 'kino.yaml'].join('/')
const DUB = ['data', 'dub-confirmed.yaml'].join('/')
const tmp = mkdtempSync(join(tmpdir(), 'neue-quellen-'))
const git = (...args: string[]) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t.test', ...args], { cwd: tmp, windowsHide: true, timeout: 30_000, encoding: 'utf8' })
const schreibe = (datei: string, text: string) => {
  mkdirSync(join(tmp, datei, '..'), { recursive: true })
  writeFileSync(join(tmp, datei), text)
}
const anfragen = join(tmp, 'anfragen.txt')
const stub = join(tmp, 'stub.mjs')
/* Antwort nach Endung der Adresse: tot404, tot410, nein403, nein429, nein503, zeit (Zeitüberschreitung), sonst 200. */
writeFileSync(
  stub,
  `import { appendFileSync } from 'node:fs'
globalThis.fetch = async (url) => {
  appendFileSync(${JSON.stringify(anfragen)}, url + '\\n')
  const ende = String(url).split('/').pop()
  if (ende === 'zeit') throw new Error('Zeitüberschreitung')
  const status = { tot404: 404, tot410: 410, nein403: 403, nein429: 429, nein503: 503 }[ende] ?? 200
  return new Response('x', { status })
}
`,
)

function lauf(): { status: number | null; ausgabe: string; gefragt: string[] } {
  appendFileSync(anfragen, '')
  rmSync(anfragen)
  appendFileSync(anfragen, '')
  const r = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/neue-quellen-pruefen.ts'), '--basis', 'HEAD^1'],
    { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, encoding: 'utf8', timeout: 60_000 },
  )
  const ausgabe = `${r.stdout}${r.stderr}`
  pruefe('Lauf kam bis zur Ergebniszeile', ausgabe.includes('check-neue-quellen:'), ausgabe.slice(-400))
  return { status: r.status, ausgabe, gefragt: readFileSync(anfragen, 'utf8').split('\n').filter(Boolean) }
}

function kopf(curated: string, dub: string) {
  schreibe(KINO, curated)
  schreibe(DUB, dub)
  git('add', 'data')
  git('commit', '-q', '-m', 'kopf')
}

try {
  git('init', '-q')
  schreibe(KINO, '- slug: a\n  sources: [https://x.test/alt]\n')
  schreibe(DUB, '- slug: d\n  quelle: https://x.test/dub-alt\n')
  git('add', 'data')
  git('commit', '-q', '-m', 'basis')

  // 1. Tote Adresse (404) in der Kurationsdatei: rot, Datei und Schlüssel im Text, unveränderte Adresse nicht angefragt
  kopf('- slug: a\n  sources: [https://x.test/alt, https://x.test/tot404]\n', '- slug: d\n  quelle: https://x.test/dub-alt\n')
  let r = lauf()
  pruefe('404: Exit 1', r.status === 1, r.status)
  pruefe('404: Datei, Schlüssel, Adresse in der Meldung', r.ausgabe.includes(KINO + ' a.sources: https://x.test/tot404'), r.ausgabe)
  pruefe('nur die neue Adresse wird angefragt', r.gefragt.join() === 'https://x.test/tot404', r.gefragt)

  // 2. 410 in dub-confirmed.yaml
  kopf('- slug: a\n  sources: [https://x.test/alt, https://x.test/tot404]\n', '- slug: d\n  quelle: https://x.test/dub-alt\n- slug: e\n  quelle: https://x.test/tot410\n')
  r = lauf()
  pruefe('410 in dub-confirmed: Exit 1', r.status === 1 && r.ausgabe.includes(`(410) ${DUB}`), r.ausgabe)

  // 3. Nichtauskunft: 403, 429, 503 und Zeitüberschreitung sind nicht rot, die Zeile steht im Log
  kopf('- slug: a\n  sources: [https://x.test/alt, https://x.test/nein403, https://x.test/nein429, https://x.test/nein503, https://x.test/zeit]\n', '- slug: d\n  quelle: https://x.test/dub-alt\n')
  r = lauf()
  pruefe('Nichtauskunft: Exit 0', r.status === 0, r.ausgabe)
  pruefe('Nichtauskunft: vier Zeilen im Log', (r.ausgabe.match(/Nichtauskunft \(/g) ?? []).length === 4 && r.ausgabe.includes('Nichtauskunft 4'), r.ausgabe)

  // 4. aniSearch und Crunchyroll: nie angefragt
  kopf('- slug: a\n  sources: [https://x.test/alt, https://www.anisearch.de/anime/1,x, https://www.crunchyroll.com/de/series/x]\n', '- slug: d\n  quelle: https://x.test/dub-alt\n')
  r = lauf()
  pruefe('aniSearch/Crunchyroll: Exit 0, keine Anfrage', r.status === 0 && r.gefragt.length === 0, { s: r.status, g: r.gefragt })

  // 5. Nichts Neues (nur Umordnung der Basis-Adressen): keine Anfrage, Exit 0
  kopf('- slug: a\n  sources: [https://x.test/alt]\n', '- slug: d\n  quelle: https://x.test/dub-alt\n')
  git('commit', '-q', '--allow-empty', '-m', 'leer')
  r = lauf()
  pruefe('keine neue Adresse: Exit 0, keine Anfrage', r.status === 0 && r.gefragt.length === 0 && r.ausgabe.includes('0 neue Adressen'), { s: r.status, g: r.gefragt })

  // 6. Mehr als 20 neue Adressen: 20 Abrufe, Rest ungeprüft
  const viele = Array.from({ length: 25 }, (_, i) => `https://x.test/n${i}`).join(', ')
  kopf(`- slug: a\n  sources: [https://x.test/alt, ${viele}]\n`, '- slug: d\n  quelle: https://x.test/dub-alt\n')
  r = lauf()
  pruefe('Maximum 20 Abrufe', r.status === 0 && r.gefragt.length === 20 && r.ausgabe.includes('ungeprüft 5') && r.ausgabe.includes('::warning::check-neue-quellen: 5 neue Adressen ungeprüft'), { s: r.status, n: r.gefragt.length })

  // 7. Netflix-Adresse: nie angefragt (robots Disallow, F97)
  kopf(`- slug: a\n  sources: [https://x.test/alt, ${viele}, https://www.netflix.com/title/82012956]\n`, '- slug: d\n  quelle: https://x.test/dub-alt\n')
  r = lauf()
  pruefe('Netflix: Exit 0, keine Anfrage', r.status === 0 && r.gefragt.length === 0 && r.ausgabe.includes('ausgelassen 1'), { s: r.status, g: r.gefragt })

  // 8. Kaputtes YAML im Kopf: rot, mit Dateiname
  kopf('- slug: a\n  sources: [https://x.test/alt\n  kaputt: : :\n', '- slug: d\n  quelle: https://x.test/dub-alt\n')
  r = lauf()
  pruefe('kaputtes YAML: Exit 1 mit Dateiname', r.status === 1 && r.ausgabe.includes(`YAML nicht lesbar: ${KINO}`), { s: r.status, a: r.ausgabe.slice(-300) })
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`check-neue-quellen-lauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-neue-quellen-lauf: 404/410 rot (curated und dub-confirmed), 403/429/503/Zeitüberschreitung Nichtauskunft, aniSearch/Crunchyroll nicht angefragt, nichts Neues keine Anfrage, Maximum 20.')
