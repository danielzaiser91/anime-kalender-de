/**
 * Verdrahtung: `schreibeFolgenDateien` lässt die englischen Crunchyroll-Titel von Burn the Witch (116673) weg (Kulisse über `AK_ROOT`, echter Aufrufer).
 * Titel wörtlich aus `data/kitsu-folgen.json` und der deutschen Crunchyroll-Antwort; Kontrolllauf ohne Kitsu/TMDB behält sie.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const wurzelRepo = join(import.meta.dirname, '..')
const tsx = createRequire(join(wurzelRepo, 'package.json')).resolve('tsx/cli')
const titel = ['Witches Blow a New Pipe', 'Ghillie Suit / She Makes Me Special', 'If a lion could speak, we couldn’t understand']

function lauf(mitEnglisch: boolean): { status: number | null; zeilen: [number, string][]; fehler: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'folgentitel-englisch-bau-'))
  try {
    for (const d of ['data/crunchyroll-raw', 'public/data']) mkdirSync(join(wurzel, d), { recursive: true })
    const schreibe = (pfad: string, inhalt: unknown) => writeFileSync(join(wurzel, pfad), JSON.stringify(inhalt))
    const guids = titel.map((_, i) => `g${i + 1}`)
    schreibe('data/crunchyroll-dub.json', { serien: [{ url: 'https://www.crunchyroll.com/burn-the-witch', katalog: 'de', seriesId: 'S1', staffeln: [{ deutscheFolgen: guids.map((guid, i) => ({ nummer: i + 1, guid })) }] }] })
    writeFileSync(join(wurzel, 'data/crunchyroll-raw/S1.de.json.gz'), gzipSync(JSON.stringify({ episodes: { s1: { items: titel.map((title, i) => ({ id: guids[i], title })) } } })))
    schreibe('data/kitsu-folgen.json', mitEnglisch ? { 116673: { k: 43146, f: titel.map((t, i) => [i + 1, t.replace('’', "'"), 21]) } } : {})
    schreibe('data/tmdb-folgen.json', {})
    writeFileSync(join(wurzel, 'data/folgen-hinweise.yaml'), '[]\n')
    for (const yamlDatei of ['kino-ankuendigungen', 'ankuendigungen']) writeFileSync(join(wurzel, `data/${yamlDatei}.yaml`), '[]\n')
    const r = spawnSync(process.execPath, [tsx, join(wurzelRepo, 'pipeline/lib/kulisse-folgen-englisch.ts')], { cwd: wurzel, env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', windowsHide: true, timeout: 120_000 })
    return { status: r.status, zeilen: r.status === 0 ? JSON.parse(r.stdout.trim().split('\n').pop()!) : [], fehler: r.stderr.slice(-400) }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const kontrolle = lauf(false)
assert.equal(kontrolle.status, 0, kontrolle.fehler)
assert.deepEqual(kontrolle.zeilen.map(([, t]) => t), titel, 'Kontrolle: ohne englische Vergleichstitel bleiben die Crunchyroll-Titel stehen')
const mit = lauf(true)
assert.equal(mit.status, 0, mit.fehler)
assert.deepEqual(mit.zeilen.map(([nr, t]) => [nr, t]), [[1, ''], [2, ''], [3, '']], 'Bau lässt die englischen Titel weg, die Nummern bleiben')
console.log('check-folgentitel-englisch-bau: ok (Bau lässt 3 englische Titel von 116673 weg, Kontrolle behält sie)')
