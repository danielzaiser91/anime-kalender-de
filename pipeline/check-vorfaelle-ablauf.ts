/**
 * Der Ablauf von `fetch-vorfaelle.ts` gegen eine Kulisse (17.10.2026): Der Abruf schreibt den Bericht und merkt sich die
 * Kennungen, gelöscht wird erst mit `--nur-loeschen` (Schritt nach „Änderungen committen"). Ein Fehlschlag beim Worker
 * lässt den Merker stehen, ein Erfolg räumt ihn weg. Attrappe: `tools/vorfaelle-ablauf-mock.mjs`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/vorfaelle-ablauf-mock.mjs')).href
const MERKER = 'data/cache/vorfaelle-loeschen.json'

const vorfall = (id: number, art: string) => ({
  id,
  plattform: 'netflix',
  art,
  url: null,
  reihe: `Kulissen-Reihe ${id}`,
  folge_nr: id,
  staffel: 1,
  text: `Kulisse ${id}`,
  version: '4.31.7',
  gemeldet_am: '2026-10-16T19:30:00Z',
})

const kulisse = mkdtempSync(join(tmpdir(), 'vorfaelle-ablauf-'))
writeFileSync(join(kulisse, 'vorfaelle.json'), JSON.stringify({ vorfaelle: [vorfall(11, 'ohne_tonspur'), vorfall(12, 'stoerung'), vorfall(13, 'ohne_tonspur')] }))

const lauf = (argumente: string[], status = 200) =>
  spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-vorfaelle.ts'), ...argumente], {
    cwd: wurzel,
    encoding: 'utf8',
    env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: 'test', AK_DELETE_STATUS: String(status) },
  })
const da = (pfad: string) => existsSync(join(kulisse, pfad))
const lies = (pfad: string) => JSON.parse(readFileSync(join(kulisse, pfad), 'utf8'))

const fehler: string[] = []
try {
  const abruf = lauf([])
  if (abruf.status !== 0) fehler.push(`Abruf endete mit ${abruf.status}: ${abruf.stderr.slice(-300)}`)
  if (!da('daniel-zum-abarbeiten/listen/17-vorfaelle.md')) fehler.push('kein Bericht geschrieben')
  if (da('delete.json')) fehler.push('der Abruf hat selbst gelöscht — das darf erst nach dem Commit geschehen')
  if (JSON.stringify(lies(MERKER)) !== '[11,12,13]') fehler.push(`gemerkt: ${JSON.stringify(lies(MERKER))}, erwartet [11,12,13]`)
  lauf(['--nur-loeschen'], 500)
  if (!da(MERKER)) fehler.push('HTTP 500 beim Löschen hat den Merker gelöscht')
  lauf(['--nur-loeschen'])
  if (JSON.stringify(lies('delete.json')) !== '{"ids":[11,12,13]}') fehler.push(`gelöscht: ${JSON.stringify(lies('delete.json'))}`)
  if (da(MERKER)) fehler.push('der Merker bleibt nach erfolgreichem Löschen liegen')
  // Eine leere Liste räumt einen alten Merker weg: Sonst quittierte der Schritt danach Kennungen eines früheren Laufs.
  process.env.AK_ROOT = kulisse
  const { merkeZumQuittieren } = await import('./lib/spaeter-quittieren.ts')
  merkeZumQuittieren(MERKER, [21, 22])
  merkeZumQuittieren(MERKER, [])
  if (da(MERKER)) fehler.push('eine leere Liste lässt den alten Merker stehen')
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-vorfaelle-ablauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-vorfaelle-ablauf: Bericht geschrieben, gelöscht erst mit --nur-loeschen, Fehlschlag behält den Merker.')
