/**
 * Ablauftest von tools/schritte-auswerten.sh und seiner Verdrahtung. Anlass (04.11.2026, PR 2728, Lauf 41843390499 von
 * adn-laufende.yml): `schritt.sh` meldete „Zeitgrenze 15m erreicht“ nur als Anmerkung, der Schritt und der Lauf blieben grün,
 * `laeufe-aufraeumen.mjs` (liest nur rote Schritte in grünen Jobs) sah nichts. Jetzt endet die Auswertung mit Fehlschlag rot
 * (`continue-on-error: true`, Job bleibt grün) und druckt eine „FEHLER:“-Zeile, die `wache-weicher-schritt.mjs` findet.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { spawnMitLimit } from './kind-mit-limit.mjs'
import { ersteFehlerZeile } from './wache-weicher-schritt.mjs'

const tools = import.meta.dirname
const ordner = mkdtempSync(join(tmpdir(), 'schritte-auswerten-'))

function lauf(protokoll, nr) {
  const temp = join(ordner, `temp${nr}`)
  mkdirSync(temp)
  if (protokoll !== null) writeFileSync(join(temp, 'schritte.tsv'), protokoll)
  const ausgabe = join(ordner, `ausgabe${nr}`)
  writeFileSync(ausgabe, '')
  const r = spawnMitLimit('bash', [join(tools, 'schritte-auswerten.sh')], {
    encoding: 'utf8',
    env: { ...process.env, RUNNER_TEMP: temp, GITHUB_OUTPUT: ausgabe },
  })
  return { status: r.status, stdout: r.stdout, ausgabe: readFileSync(ausgabe, 'utf8') }
}

try {
  const gut = lauf('A\t0\t5\nB\t0\t7\n', 1)
  assert.equal(gut.status, 0, 'alle Schritte gelungen: Exit 0')
  assert.equal(ersteFehlerZeile(gut.stdout), undefined, 'keine FEHLER-Zeile ohne Fehlschlag')
  assert.equal(gut.ausgabe, 'fehler=\n')

  const keins = lauf(null, 2)
  assert.equal(keins.status, 0, 'ohne Protokoll: Exit 0')
  assert.equal(keins.ausgabe, 'fehler=\n')

  const eins = lauf('Laufende Serien holen\t124\t900\nZusicherungen prüfen\t0\t1\n', 3)
  assert.equal(eins.status, 1, 'ein Fehlschlag (Zeitgrenze, Exit 124): Exit 1')
  assert.equal(ersteFehlerZeile(eins.stdout), 'FEHLER: Schritte fehlgeschlagen: Laufende Serien holen')
  assert.equal(eins.ausgabe, 'fehler=Laufende Serien holen\n', 'Job-Ausgabe bleibt für die Statusanzeige erhalten')

  const zwei = lauf('X\t1\t3\nY\t0\t2\nZ\t7\t4\n', 4)
  assert.equal(zwei.status, 1)
  assert.equal(ersteFehlerZeile(zwei.stdout), 'FEHLER: Schritte fehlgeschlagen: X · Z')
  assert.equal(zwei.ausgabe, 'fehler=X · Z\n')

  // Verdrahtung: Jeder Auswertungsschritt ist weich (sonst würde der Fehlschlag den Job rot machen); jeder Job mit schritt.sh hat einen.
  const wf = join(tools, '..', '.github', 'workflows')
  let jobsMitSchritt = 0
  for (const datei of readdirSync(wf).filter((f) => f.endsWith('.yml'))) {
    for (const [name, job] of Object.entries(parse(readFileSync(join(wf, datei), 'utf8')).jobs ?? {})) {
      const schritte = job.steps ?? []
      const auswerten = schritte.filter((s) => /tools\/schritte-auswerten\.sh/.test(s.run ?? ''))
      for (const s of auswerten) {
        assert.equal(s['continue-on-error'], true, `${datei} ${name}: Auswertung muss continue-on-error sein`)
        assert.equal(s.if, 'always()', `${datei} ${name}: Auswertung läuft auch nach einem Fehler`)
      }
      if (schritte.some((s) => /tools\/schritt\.sh/.test(s.run ?? ''))) {
        jobsMitSchritt++
        assert.equal(auswerten.length, 1, `${datei} ${name}: Job mit schritt.sh braucht genau eine Auswertung`)
      }
    }
  }
  assert.ok(jobsMitSchritt >= 10, `Jobs mit schritt.sh gefunden: ${jobsMitSchritt}`)
  console.log(`schritte-auswerten.test: 4 Läufe und ${jobsMitSchritt} Jobs mit schritt.sh, Auswertung überall weich und rot bei Fehlschlag.`)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
