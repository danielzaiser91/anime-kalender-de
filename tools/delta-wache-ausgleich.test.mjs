/**
 * Ausgeglichener Rückgang (Wache 03.11.2026, Lauf 41660748172): Der Bau vom 02.11. 16:04Z verlor 12 Urteile und 13 Netflix-Belege, der Bau
 * 20:43Z holte sie zurück, die Wache blieb im Zeitfenster trotzdem rot. Jetzt zählt, ob eine spätere Zeile wieder den Stand vor der Zeile erreicht:
 * ausgeglichen -> kein Befund, bestehender oder teilweise ausgeglichener Rückgang -> rot. Echter Anlassfall:
 * `tools/testdaten/bestand-historie-ausgleich.jsonl` (Läufe 02.11.2026 04:53Z, 16:04Z, 16:35Z, 20:43Z und 21:12Z der Historie).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ereignisse } from '../pipeline/lib/bestand-pendel.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.TZ = 'UTC'
const GRUND = Date.parse('2026-10-19T00:00:00Z')

/** Zeile mit Kennzahlen; `u` = Urteile (und Prime-Synchro-Belege). */
function zeile(nr, u, extra = {}) {
  return {
    zeitpunkt: new Date(GRUND + nr * 3600000).toISOString(),
    lauf: 'test',
    titel: 100,
    titelMitVerweis: 90,
    verweise: 200,
    mitUrteil: u,
    ohneUrteil: 50,
    titelMitSynchro: 80,
    entferntProtokolliert: 10,
    releases: 10,
    termine: 100,
    jeAnbieter: { primevideo: u - 90 },
    ...extra,
  }
}
/** Folge von Ständen; die Zeile `rueck` trägt die gespeicherte Auffälligkeit ihres Rückgangs. */
function folge(urteile, rueck) {
  const zeilen = urteile.map((u, i) => zeile(i, u))
  if (rueck !== undefined) zeilen[rueck].auffaellig = ['40 Urteile verloren']
  return zeilen
}
const rot = (zeilen) => ereignisse(zeilen).filter((e) => e.art === 'zeile' && e.auffaellig.length)

// --- Vier Fälle der Rechenregel (kein Pendeln: Stände wiederholen sich nicht im Wechsel) ---------------------------------------
{
  const ausgeglichen = ereignisse(folge([100, 100, 60, 60, 100, 100], 2))
  assert.equal(ausgeglichen[2].auffaellig.length, 0, 'Rückgang, danach Ausgleich im Fenster: grün')
  assert.match(ausgeglichen[2].erklaert[0], /^später ausgeglichen \(Stand 19\.10\., 04:00 gegen Stand davor ohne Verlust\): 40 Urteile verloren$/, 'die Zeile bleibt als Info sichtbar')

  assert.equal(rot(folge([100, 100, 60, 60, 60, 60], 2)).length, 1, 'Rückgang ohne Ausgleich: rot')
  assert.deepEqual(rot(folge([100, 100, 60, 60, 60, 60], 2))[0].auffaellig, ['40 Urteile verloren'], 'gespeicherter Text bleibt')
  assert.equal(rot(folge([100, 100, 60, 60, 80, 80], 2)).length, 1, 'Teilausgleich (60 -> 80 von 100): rot')
  assert.equal(rot(folge([100, 100, 100, 100, 100, 100])).length, 0, 'Kontrolle ohne Rückgang: grün')
  assert.equal(rot(folge([100, 100, 60, 60, 100, 100])).length, 0, 'ohne gespeicherte Auffälligkeit nichts zu erklären')

  // Grenzen: letzte Zeile selbst und erste Zeile haben keinen Ausgleich; Überausgleich ist kein Verlust.
  assert.equal(rot(folge([100, 100, 60], 2)).length, 1, 'die jüngste Zeile ist nie ausgeglichen')
  assert.equal(rot(folge([60, 100, 100], 0)).length, 1, 'die erste Zeile hat keinen Stand davor: bleibt wie gespeichert')
  assert.equal(rot(folge([100, 100, 60, 60, 130, 130], 2)).length, 0, 'mehr als ausgeglichen: kein Verlust')

  // Bezug ist der Stand unmittelbar vor der Zeile, nicht der Dateianfang (130 am Anfang, 100 davor).
  assert.equal(rot(folge([130, 100, 100, 60, 60, 100, 100], 3)).length, 0, 'Ausgleich gegen den Stand davor, nicht gegen die erste Zeile')

  // Bereits gespeicherte Erklärungen der Zeile bleiben neben dem Ausgleichsvermerk stehen.
  const mitErklaerung = folge([100, 100, 60, 60, 100, 100], 2)
  mitErklaerung[2].erklaert = ['Kanal-Titel']
  assert.deepEqual(ereignisse(mitErklaerung)[2].erklaert.length, 2)
  assert.equal(ereignisse(mitErklaerung)[2].erklaert[0], 'Kanal-Titel')
}

// --- Lage des Ausgleichs: gleich die nächste Zeile zählt, auch sechs Zeilen später (B1, B2) --------------------------------------
{
  assert.equal(rot(folge([100, 100, 60, 110, 70, 70], 2)).length, 0, 'Ausgleich in der nächsten Zeile: grün')
  assert.equal(rot(folge([100, 100, 60, 60, 60, 60, 60, 60, 100, 100], 2)).length, 0, 'Ausgleich sechs Zeilen später: grün')
}

// --- Streng (B3): Termine, Verweise und Urteile müssen den Stand vor dem Rückgang erreichen, keine Toleranz ----------------------
/** Sechs Zeilen, Rückgang in Zeile 2; `feld` läuft über `werte`, die Urteile bleiben gleich. */
function mitFeld(feld, werte) {
  const zeilen = folge([100, 100, 100, 100, 100, 100], 2)
  werte.forEach((w, i) => (zeilen[i][feld] = w))
  return zeilen
}
{
  assert.equal(rot(mitFeld('termine', [100, 100, 40, 40, 81, 81])).length, 1, 'Termine 100 -> 40 -> 81 bleibt rot')
  assert.equal(rot(mitFeld('termine', [100, 100, 40, 40, 100, 100])).length, 0, 'Termine wieder bei 100: grün')
  assert.equal(rot(mitFeld('verweise', [300, 300, 200, 200, 251, 251])).length, 1, 'Verweise 300 -> 200 -> 251 bleibt rot')
  assert.equal(rot(mitFeld('verweise', [300, 300, 200, 200, 300, 300])).length, 0, 'Verweise wieder bei 300: grün')
  assert.equal(rot(folge([100, 100, 60, 60, 99, 99], 2)).length, 1, 'Urteile 99 von 100 bleibt rot (kein Spielraum)')
}

// --- Zwei Rückgänge: nur der ausgeglichene verschwindet --------------------------------------------------------------------------
{
  const zeilen = folge([100, 100, 60, 60, 100, 100, 70, 70], 2)
  zeilen[6].auffaellig = ['30 Urteile verloren']
  const r = rot(zeilen)
  assert.equal(r.length, 1)
  assert.deepEqual(r[0].auffaellig, ['30 Urteile verloren'], 'der zweite Rückgang besteht (70 gegen 100)')
}

// --- Anlassfall wörtlich: Netflix 02.11.2026 ----------------------------------------------------------------------------------------
const echt = readFileSync(join(wurzel, 'tools/testdaten/bestand-historie-ausgleich.jsonl'), 'utf8')
{
  const zeilen = echt.trimEnd().split('\n').map((z) => JSON.parse(z))
  assert.match(zeilen[1].auffaellig[0], /^12 Urteile verloren/, 'Fixture: gespeicherter Befund vom 02.11. 16:04Z')
  const e = ereignisse(zeilen)
  assert.equal(e[1].auffaellig.length, 0, 'Verlust vom 02.11. ist durch den Bau 20:43Z ausgeglichen')
  assert.equal(e[1].erklaert.filter((t) => /netflix: 13 Synchro-Belege weniger/.test(t)).length, 1, 'der Netflix-Befund bleibt als Info lesbar')
}

// --- Die Wache als Prozess: Exit-Code ----------------------------------------------------------------------------------------------
function wache(text, jetzt) {
  const ordner = mkdtempSync(join(tmpdir(), 'delta-wache-ausgleich-'))
  try {
    mkdirSync(join(ordner, 'data'))
    writeFileSync(join(ordner, 'data/bestand-historie.jsonl'), text)
    const r = spawnSync(process.execPath, [join(wurzel, 'tools/delta-pruefen.mjs'), '--tage', '2', '--jetzt', jetzt], { cwd: ordner, encoding: 'utf8', windowsHide: true, timeout: 60000 })
    assert.equal(r.error, undefined, 'Prozess lief bis zum Ende')
    return { code: r.status, text: r.stdout + r.stderr }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
const jsonl = (zeilen) => zeilen.map((z) => JSON.stringify(z)).join('\n') + '\n'
{
  const w = wache(echt, '2026-11-03T15:09:00Z')
  assert.equal(w.code, 0, `Anlassfall: Wache grün\n${w.text}`)
  assert.match(w.text, /ℹ\s+erklärt, nicht rot: .*später ausgeglichen \(Stand 02\.11\., 20:43 .*/, 'Info-Zeile statt Warnung')
  assert.match(w.text, /^ℹ {2}1 Rückgang ausgeglichen$/m, 'Schlusszeile zählt den ausgeglichenen Rückgang')

  const nah = wache(jsonl(folge([100, 100, 60, 110, 70, 70], 2)), '2026-10-20T00:00:00Z')
  assert.equal(nah.code, 0, `Ausgleich in der nächsten Zeile: grün\n${nah.text}`)
  const knapp = wache(jsonl(mitFeld('termine', [100, 100, 40, 40, 81, 81])), '2026-10-20T00:00:00Z')
  assert.equal(knapp.code, 1, 'Termine 81 von 100 bleibt rot')
  assert.doesNotMatch(knapp.text, /Rückgang ausgeglichen/, 'nichts ausgeglichen, nichts gezählt')

  const offen = wache(jsonl(folge([100, 100, 60, 60, 60, 60], 2)), '2026-10-20T00:00:00Z')
  assert.equal(offen.code, 1, 'bestehender Rückgang bleibt rot')
  assert.match(offen.text, /⚠\s+40 Urteile verloren/)
  const teil = wache(jsonl(folge([100, 100, 60, 60, 80, 80], 2)), '2026-10-20T00:00:00Z')
  assert.equal(teil.code, 1, 'Teilausgleich bleibt rot')
  assert.equal(wache(jsonl(folge([100, 100, 100, 100])), '2026-10-20T00:00:00Z').code, 0, 'Kontrolle ohne Rückgang')
}
console.log('delta-wache-ausgleich: 4 Regelfälle, 3 Grenzen, 2 Lagen, 5 strenge Fälle, 2 Rückgänge, Anlassfall 02.11.2026, 6 Prozessfälle ok')
