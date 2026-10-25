/**
 * Die fetch-Attrappen der Meldungs-Prüfungen reichen nichts an das echte Netz durch: eine nicht vorgesehene Adresse wirft
 * einen Fehler mit der Adresse (Kontingent, fremde Dienste, D1). Je Attrappe ein Kindprozess mit Vorlader; das Netz ist
 * hier nie erreichbar, weil `example.invalid` nicht auflösbar ist und der Test den Fehlertext prüft.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { baueFetchAttrappe, istMeldungsabruf, meldungsAntwort } from './fetch-attrappe.mjs'

const aufrufe = []
const bekannt = baueFetchAttrappe((url, opt) => {
  aufrufe.push(`${opt?.method ?? 'GET'} ${url}`)
  return String(url) === 'https://a.invalid/ja' ? new Response('ja') : undefined
})
assert.equal(await (await bekannt('https://a.invalid/ja')).text(), 'ja')
await assert.rejects(() => bekannt('https://a.invalid/nein', { method: 'POST' }), /unerwarteter Aufruf POST https:\/\/a\.invalid\/nein/)
await assert.rejects(() => bekannt('https://a.invalid/nein'), /unerwarteter Aufruf GET https:\/\/a\.invalid\/nein/)

assert.equal(istMeldungsabruf('https://w.invalid/pruefung', undefined), true)
assert.equal(istMeldungsabruf('https://w.invalid/pruefung', { method: 'POST' }), false)
assert.equal(istMeldungsabruf('https://w.invalid/andere', undefined), false)
assert.deepEqual((await meldungsAntwort([{ id: 1 }]).json()).pruefungen, [{ id: 1 }])

const wurzel = mkdtempSync(join(tmpdir(), 'fetch-attrappe-'))
const probe = [
  "const r = await fetch('https://nicht-vorgesehen.invalid/x', { method: 'POST' }).then(() => 'durchgelassen', (e) => String(e.message))",
  'console.log(r)',
].join('\n')
try {
  for (const mock of ['kanal-abgehakt', 'meldung-gti', 'meldung-netflix-umleitung', 'meldung-summenseite']) {
    const lauf = spawnSync(process.execPath, ['--import', new URL(`./${mock}-mock.mjs`, import.meta.url).href, '--input-type=module', '-e', probe], {
      env: { ...process.env, AK_ROOT: wurzel },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20000,
    })
    assert.match(lauf.stdout, /unerwarteter Aufruf POST https:\/\/nicht-vorgesehen\.invalid\/x/, `${mock}: ${lauf.stdout}${lauf.stderr}`)
  }
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('fetch-attrappe.test: Attrappen werfen bei nicht vorgesehener Adresse (4 Mocks + Helfer).')
