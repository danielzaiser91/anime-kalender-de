/**
 * Prozess-Test für tools/cr-zugang-holen.mjs (claude-auftrag.yml, crunchyroll-nachholen.yml): holt ein
 * Zugangspaket. Netz und gh ersetzt der Vorlader `cr-zugang-stub.mjs`; echte Secrets kommen nie vor.
 * Gut = Exit 0 und Paket, kaputt (HTTP-Fehler, falsche Region, fehlender CMS-Block) = Exit ≠ 0 ohne Paket.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const tools = resolve(fileURLToPath(new URL('.', import.meta.url)))
const ordner = mkdtempSync(join(tmpdir(), 'cr-zugang-'))
const CMS = { bucket: '/DE/M2/-', policy: 'POL-1', signature: 'SIG-1', key_pair_id: 'KEY-1', expires: '2999-12-31T00:00:00Z' }
const INDEX_OK = { status: 200, body: { cms: CMS } }
const TOKEN_DE = { status: 200, body: { access_token: 'AT-1', country: 'DE' } }
const PAKET = { land: 'DE', bucket: CMS.bucket, policy: CMS.policy, signature: CMS.signature, key_pair_id: CMS.key_pair_id, gueltig_bis: CMS.expires }

let nr = 0
function lauf(antworten, args = [], env = {}) {
  const stub = join(ordner, `stub-${++nr}.json`)
  const log = join(ordner, `log-${nr}.jsonl`)
  const githubEnv = join(ordner, `env-${nr}.txt`)
  writeFileSync(stub, JSON.stringify(antworten))
  writeFileSync(log, '')
  writeFileSync(githubEnv, '')
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(join(tools, 'cr-zugang-stub.mjs')).href, join(tools, 'cr-zugang-holen.mjs'), ...args], {
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, CR_WEICHE_TOKEN: '', CR_STUB: stub, CR_STUB_LOG: log, GITHUB_ENV: githubEnv, ...env },
  })
  assert.ok(r.status !== null, `Prozess lief nicht bis zum Ende: ${r.error ?? r.stderr}`)
  const aufrufe = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z))
  return { r, aufrufe, githubEnv: readFileSync(githubEnv, 'utf8') }
}

try {
  // (1) Standardweg: direkt zur beta-api, Paket als JSON auf der letzten Zeile.
  const a = lauf({ token: TOKEN_DE, index: INDEX_OK })
  assert.equal(a.r.status, 0, a.r.stderr)
  const zeilen = a.r.stdout.trim().split('\n')
  assert.match(zeilen[0], /Zugangspaket für DE, Bucket \/DE\/M2\/-, gültig bis 2999-12-31T00:00:00Z/)
  assert.deepEqual(JSON.parse(zeilen[1]), PAKET)
  assert.equal(zeilen.length, 2, 'Standardweg gibt nur Kopfzeile und Paket aus')
  assert.deepEqual(a.aufrufe.map((x) => x.url), ['https://beta-api.crunchyroll.com/auth/v1/token', 'https://beta-api.crunchyroll.com/index/v2'])
  assert.equal(a.aufrufe[0].methode, 'POST')
  assert.equal(a.aufrufe[0].body, 'grant_type=client_id')
  assert.equal(a.aufrufe[1].headers.authorization, 'Bearer AT-1', 'der zweite Abruf trägt das Token aus dem ersten')
  assert.equal(a.githubEnv, '', 'ohne --github-env bleibt GITHUB_ENV unberührt')

  // (2) Mit Weichen-Token gehen beide Abrufe über die Weiche (Ziel kodiert, Token im Kopf).
  const w = lauf({ token: TOKEN_DE, index: INDEX_OK }, [], { CR_WEICHE_TOKEN: 'WT-1', CR_WEICHE: 'https://weiche.test/api/cr' })
  assert.equal(w.r.status, 0, w.r.stderr)
  assert.deepEqual(w.aufrufe.map((x) => x.url), [
    `https://weiche.test/api/cr?ziel=${encodeURIComponent('https://beta-api.crunchyroll.com/auth/v1/token')}`,
    `https://weiche.test/api/cr?ziel=${encodeURIComponent('https://beta-api.crunchyroll.com/index/v2')}`,
  ])
  assert.ok(w.aufrufe.every((x) => x.headers['x-weiche-token'] === 'WT-1'))
  assert.equal(w.aufrufe[1].headers.authorization, 'Bearer AT-1', 'Kopf der Anfrage bleibt neben dem Weichen-Token erhalten')

  // (3) Falsche Region: Exit 1, kein Paket.
  const us = lauf({ token: { status: 200, body: { access_token: 'AT-1', country: 'US' } }, index: INDEX_OK })
  assert.equal(us.r.status, 1)
  assert.match(us.r.stderr, /gilt Crunchyroll als "US", nicht als DE/)
  assert.equal(us.r.stdout, '', 'kein Paket bei falscher Region')
  assert.equal(us.aufrufe.length, 1, 'nach der Regionsprüfung kein zweiter Abruf')

  // (4) HTTP-Fehler beim Token und beim Index: Exit ≠ 0 mit Status im Text, nichts ausgegeben.
  const t403 = lauf({ token: { status: 403, body: {} }, index: INDEX_OK })
  assert.notEqual(t403.r.status, 0)
  assert.match(t403.r.stderr, /Token: HTTP 403/)
  assert.equal(t403.r.stdout, '')
  const i500 = lauf({ token: TOKEN_DE, index: { status: 500, body: {} } })
  assert.notEqual(i500.r.status, 0)
  assert.match(i500.r.stderr, /index\/v2: HTTP 500/)
  assert.equal(i500.r.stdout, '')

  // (5) cms_web als Rückfall; weder cms noch cms_web: Exit ≠ 0, kein Paket.
  const web = lauf({ token: TOKEN_DE, index: { status: 200, body: { cms_web: { ...CMS, bucket: '/DE/WEB/-' } } } })
  assert.equal(web.r.status, 0, web.r.stderr)
  assert.equal(JSON.parse(web.r.stdout.trim().split('\n')[1]).bucket, '/DE/WEB/-')
  const keinCms = lauf({ token: TOKEN_DE, index: { status: 200, body: {} } })
  assert.notEqual(keinCms.r.status, 0)
  assert.equal(keinCms.r.stdout, '')

  // (6) --github-env: Paket nur in GITHUB_ENV, Signatur und Policy maskiert, nicht im Klartext ausgegeben.
  const g = lauf({ token: TOKEN_DE, index: INDEX_OK }, ['--github-env'])
  assert.equal(g.r.status, 0, g.r.stderr)
  assert.equal(g.githubEnv, `CR_ZUGANG_FRISCH=${JSON.stringify(PAKET)}\n`)
  assert.ok(g.r.stdout.includes('::add-mask::SIG-1') && g.r.stdout.includes('::add-mask::POL-1'))
  assert.ok(!g.r.stdout.includes(JSON.stringify(PAKET)), 'Paket darf nicht im Log stehen')
  assert.ok(g.r.stdout.indexOf('::add-mask::SIG-1') < g.r.stdout.indexOf('Als CR_ZUGANG_FRISCH'), 'Maskierung vor dem Ablegen')

  // (7) --secret: gh secret set CR_ZUGANG mit dem Paket als Body; GITHUB_ENV bleibt leer.
  const s = lauf({ token: TOKEN_DE, index: INDEX_OK }, ['--secret'])
  assert.equal(s.r.status, 0, s.r.stderr)
  const ex = s.aufrufe.filter((x) => x.art === 'exec')
  assert.equal(ex.length, 1)
  assert.deepEqual([ex[0].befehl, ...ex[0].args], ['gh', 'secret', 'set', 'CR_ZUGANG', '--body', JSON.stringify(PAKET)])
  assert.equal(s.githubEnv, '')
  assert.match(s.r.stdout, /Als Repo-Secret CR_ZUGANG abgelegt/)

  // (8) Fehlerfälle legen nie ein Secret an, auch mit --secret / --github-env.
  const sUs = lauf({ token: { status: 200, body: { country: 'US' } }, index: INDEX_OK }, ['--secret'])
  assert.equal(sUs.r.status, 1)
  assert.equal(sUs.aufrufe.filter((x) => x.art === 'exec').length, 0)
  const gUs = lauf({ token: { status: 200, body: { country: 'US' } }, index: INDEX_OK }, ['--github-env'])
  assert.equal(gUs.githubEnv, '')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log(`cr-zugang-holen.test: ${nr} Läufe grün (Standard, Weiche, Region, HTTP-Fehler, cms_web, --github-env, --secret)`)
