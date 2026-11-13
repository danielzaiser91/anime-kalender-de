/**
 * Test für tools/naechster.mjs und .claude/mods/arbeitsliste/hooks/stand-kennzeichen.mjs: Kennzeichen lesen, Rang
 * (Art → Dringlichkeit → Ziel → älterer Eingang), „wartet“ überspringen, fehlendes Kennzeichen mit Zeile,
 * Verdrahtung im Hook (stand-prs.js) und CLI als Prozess. Feste Zeit, Wegwerf-Dateien unter os.tmpdir().
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { jsonVon, text } from './naechster.mjs'

const require = createRequire(import.meta.url)
const K = require(join(import.meta.dirname, '..', '.claude', 'mods', 'arbeitsliste', 'hooks', 'stand-kennzeichen.mjs'))
const h = require(join(import.meta.dirname, '..', '.claude', 'hooks', 'stand-prs.js'))
const JETZT = Date.parse('2026-11-08T12:00:00Z')
const z = (titel, art, dring, ziel, tag, wartet = '') => `- 🔵 **${titel}** {${art} · ${dring} · ${ziel} · ${tag}${wartet ? ` · wartet: ${wartet}` : ''}} Text`
const stand = (arbeit, naechstes) => ['# Stand', '## In Arbeit (Stand 08.11.2026 12:00)', ...arbeit, '## Als Nächstes', ...naechstes, '## Anderes', '- ohne Kennzeichen, anderer Abschnitt'].join('\n')
const titel = (liste) => liste.map((e) => e.titel)

// Kennzeichen lesen: alle Felder, wartet, ungültige Formen mit Grund
const ok = K.parseKennzeichen(z('A', 'auftrag', 'später', 'Live5', '05.11.', 'Daniel'))
assert.deepEqual({ ...ok }, { ok: true, art: 'auftrag', dringlichkeit: 'später', ziel: 'Live5', tag: 5, monat: 11, wartet: 'Daniel' })
assert.equal(K.parseKennzeichen(z('A', 'eigen', 'normal', '-', '31.12.')).wartet, null, 'ohne wartet')
assert.equal(K.parseKennzeichen('- **A** {arbeit-agent} Text').grund, 'Kennzeichen fehlt', 'Status ist kein Kennzeichen')
assert.equal(K.parseKennzeichen('- **A** {kritisch · dringend · Daten · 05.11.}').grund, 'Kennzeichen ungültig: {kritisch · dringend · Daten · 05.11.}', 'Dringlichkeit unbekannt')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten}').grund, 'Kennzeichen ungültig: {eigen · normal · Daten}', 'Eingang fehlt')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten · 5.11.}').ok, false, 'Eingang einstellig')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten · 31.13.}').grund, 'Eingang 31.13. ist kein Datum', 'Monat 13')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten · 00.11.}').grund, 'Eingang 00.11. ist kein Datum', 'Tag 0')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten · 32.11.}').grund, 'Eingang 32.11. ist kein Datum', 'Tag 32')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten · 05.00.}').grund, 'Eingang 05.00. ist kein Datum', 'Monat 0')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten · 31.12.}').ok, true, 'Grenze 31.12. gilt')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten · 01.01.}').ok, true, 'Grenze 01.01. gilt')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten · 05.11. · wartet: }').ok, false, 'wartet leer')
assert.equal(K.parseKennzeichen('- **A** {eigen · normal · Daten · 05.11.} und {eigen · x}').ok, true, 'erste gültige Klammer zählt')

// Rang: Art vor Dringlichkeit vor Ziel vor Eingang; je eine Stufe allein entscheidend
const a = K.auswerten(
  stand(
    [],
    [
      z('eigen-hoch', 'eigen', 'hoch', 'Autonomie', '01.11.'),
      z('auftrag-normal', 'auftrag', 'normal', 'Daten', '02.11.'),
      z('auftrag-hoch-daten', 'auftrag', 'hoch', 'Daten', '03.11.'),
      z('auftrag-hoch-live5', 'auftrag', 'hoch', 'Live5', '04.11.'),
      z('auftrag-hoch-auto-jung', 'auftrag', 'hoch', 'Autonomie', '06.11.'),
      z('auftrag-hoch-auto-alt', 'auftrag', 'hoch', 'Autonomie', '05.11.'),
      z('angefangen-spaeter', 'angefangen', 'später', '-', '07.11.'),
      z('kritisch', 'kritisch', 'normal', '-', '08.11.'),
      z('auftrag-sofort', 'auftrag', 'sofort', '-', '08.11.'),
    ],
  ),
  JETZT,
)
assert.deepEqual(titel(a.rangliste), ['kritisch', 'angefangen-spaeter', 'auftrag-sofort', 'auftrag-hoch-auto-alt', 'auftrag-hoch-auto-jung', 'auftrag-hoch-live5', 'auftrag-hoch-daten', 'auftrag-normal', 'eigen-hoch'])
assert.deepEqual(a.fehler, [], 'anderer Abschnitt zählt nicht')
// Ziel „Code“ hat seit 13.11.2026 Rang 1: bei Gleichstand vor Autonomie, obwohl jünger
const c = K.auswerten(stand([], [z('auto', 'eigen', 'normal', 'Autonomie', '01.11.'), z('code', 'eigen', 'normal', 'Code', '05.11.')]), JETZT)
assert.deepEqual(titel(c.rangliste), ['code', 'auto'], 'Code vor Autonomie')
// Gleichstand in allem: Dateireihenfolge; Jahreswechsel: 30.12. am 05.01. ist älter als 02.01.
const g = K.auswerten(stand([], [z('zwei', 'eigen', 'normal', '-', '02.01.'), z('eins', 'eigen', 'normal', '-', '30.12.'), z('drei', 'eigen', 'normal', '-', '02.01.')]), Date.parse('2027-01-05T12:00:00Z'))
assert.deepEqual(titel(g.rangliste), ['eins', 'zwei', 'drei'], 'Eingang über den Jahreswechsel, Gleichstand nach Reihenfolge')

// Nächster startbarer Punkt überspringt „wartet“; laufend = In Arbeit ohne wartet; In Arbeit startet nie als „nächster“
const n = K.auswerten(
  stand(
    [z('läuft-1', 'auftrag', 'normal', 'Daten', '01.11.'), z('läuft-wartet', 'kritisch', 'hoch', 'Daten', '01.11.', 'Lauf'), z('läuft-2', 'eigen', 'hoch', '-', '02.11.')],
    [z('oben-wartet', 'kritisch', 'sofort', 'Autonomie', '01.11.', 'Daniel'), z('zweiter', 'auftrag', 'normal', '-', '03.11.'), z('dritter', 'eigen', 'normal', '-', '03.11.')],
  ),
  JETZT,
)
assert.equal(n.naechster.titel, 'zweiter', 'wartet überspringen, obwohl höher')
assert.deepEqual(titel(n.laufend), ['läuft-1', 'läuft-2'], 'wartende In-Arbeit-Zeile läuft nicht')
assert.equal(K.auswerten(stand([z('x', 'eigen', 'normal', '-', '01.11.')], []), JETZT).naechster, null, 'nichts Startbares')
assert.equal(K.auswerten(stand([], [z('x', 'eigen', 'normal', '-', '01.11.', 'Daniel')]), JETZT).naechster, null, 'alles wartet')

// {läuft: …} in „Als Nächstes“: Zeile steht unter laufend, vorn im Rang, ist nie der nächste startbare Punkt
const lz = z('begonnen', 'kritisch', 'hoch', 'Daten', '05.11.').replace('Text', '{läuft: Bauer seit 12:53} Text')
const l = K.auswerten(stand([], [z('frei-1', 'eigen', 'normal', '-', '01.11.'), lz, z('frei-2', 'auftrag', 'normal', '-', '02.11.')]), JETZT)
assert.equal(l.rangliste[0].titel, 'begonnen', 'läuft steht vorn im Rang')
assert.equal(l.naechster.titel, 'frei-2', 'nächster ist die nächste freie Zeile')
assert.deepEqual(titel(l.laufend), ['begonnen'], 'läuft zählt als laufend')
assert.deepEqual(titel(K.auswerten(stand([], [lz.replace('{kritisch · hoch · Daten · 05.11.}', '{kritisch · hoch · Daten · 05.11. · wartet: Lauf}')]), JETZT).laufend), [], 'läuft und wartet: nicht laufend')
assert.equal(K.auswerten(stand([], [z('x', 'eigen', 'normal', '-', '01.11.').replace('Text', 'läuft: nichts')]), JETZT).naechster.titel, 'x', 'Wort ohne Klammer ist kein Stempel')

// Fehler mit Zeile; Auto-Block, eingerückte Details, andere Abschnitte und CRLF
const mitFehler = stand(['<!-- pr-zeilen: x -->', '- **PR-Zeile** ohne Kennzeichen', '<!-- /pr-zeilen -->', '  - eingerückt', '- **Ohne** nichts'], [z('ok', 'eigen', 'normal', '-', '01.11.'), '- **Kaputt** {eigen · normal}'])
assert.deepEqual(
  K.pruefeKennzeichen(mitFehler).map((f) => [f.nr, f.grund]),
  [[7, 'Kennzeichen fehlt'], [10, 'Kennzeichen ungültig: {eigen · normal}']],
)
assert.equal(K.kennzeichenMeldung(mitFehler), 'Kennzeichen: 2 Zeilen (Zeile 7 Kennzeichen fehlt: Ohne, Zeile 10 Kennzeichen ungültig: {eigen · normal}: Kaputt)')
assert.equal(K.kennzeichenMeldung(mitFehler.split('\n').join('\r\n')), K.kennzeichenMeldung(mitFehler), 'CRLF')
assert.equal(K.kennzeichenMeldung(stand([], ['- a', '- b', '- c', '- d'])), 'Kennzeichen: 4 Zeilen (Zeile 4 Kennzeichen fehlt: a, Zeile 5 Kennzeichen fehlt: b, Zeile 6 Kennzeichen fehlt: c u. a.)', 'drei genannt')
assert.equal(K.kennzeichenMeldung(stand([], ['- a'])).startsWith('Kennzeichen: 1 Zeile ('), true, 'Einzahl')
assert.equal(K.kennzeichenMeldung(stand([z('ok', 'eigen', 'normal', '-', '01.11.')], [])), '', 'alles gültig')
assert.equal(K.kennzeichenMeldung(''), '', 'leere Datei')

// Ausgabetext und JSON
const t = text(n)
assert.match(t, /^Gerade in Arbeit:\n {2}1\. läuft-1 {2}\[auftrag · normal · Daten · 01\.11\.\] \(Zeile 3\)\n {2}2\. läuft-2/)
assert.match(t, /Nächster startbarer Punkt: 1\. zweiter {2}\[auftrag · normal · - · 03\.11\.\]/)
assert.match(t, /1\. oben-wartet {2}\[kritisch · sofort · Autonomie · 01\.11\. · wartet: Daniel\]/)
assert.match(text(K.auswerten(stand([], []), JETZT)), /Nächster startbarer Punkt: keiner/)
assert.deepEqual(jsonVon(n).laufend.map((e) => e.titel), ['läuft-1', 'läuft-2'])
assert.equal(jsonVon(n).naechster.wartet, null)
assert.deepEqual(jsonVon(mitFehler.length ? K.auswerten(mitFehler, JETZT) : n).fehler.map((f) => f.nr), [7, 10])

// Hook: stand-prs.js meldet fehlende Kennzeichen über die Warnung und bleibt bei gültigen still
const ordner = mkdtempSync(join(tmpdir(), 'naechster-'))
try {
  const datei = join(ordner, 'stand.md')
  const env = { STAND_PRS_DATEI: datei, STAND_PRS_ZUSTAND: join(ordner, 'state', 'stand-prs.json') }
  const leer = JSON.stringify({ data: { repository: { offen: { pageInfo: { hasNextPage: false }, nodes: [] }, gemergt: { pageInfo: { hasNextPage: false }, nodes: [] } } } })
  const lauf = (inhalt) => {
    writeFileSync(datei, inhalt)
    return h.lauf({ jetzt: true }, { env, gh: () => leer, jetzt: JETZT })
  }
  const gut = lauf(stand([z('ok', 'eigen', 'normal', '-', '01.11.')], [z('ok2', 'eigen', 'normal', '-', '01.11.')]).replace('Stand 08.11.2026 12:00', 'Stand 08.11.2026 12:00'))
  assert.equal(gut.warnung, undefined, 'gültige Kennzeichen: still')
  const schlecht = lauf(stand(['- **Alt** {arbeit-agent} x'], [z('ok2', 'eigen', 'normal', '-', '01.11.')]))
  assert.equal(schlecht.warnung, 'Kennzeichen: 1 Zeile (Zeile 3 Kennzeichen fehlt: Alt)')

  // CLI als Prozess: Exit 0 mit Ausgabe, Exit 1 mit Fehlerzeile und Zeilennummer
  const cli = (inhalt, ...opt) => {
    writeFileSync(datei, inhalt)
    return spawnSync(process.execPath, [join(import.meta.dirname, 'naechster.mjs'), '--datei', datei, '--jetzt', '2026-11-08T12:00:00Z', ...opt], { encoding: 'utf8', timeout: 20000 })
  }
  const r0 = cli(stand([z('läuft', 'eigen', 'normal', '-', '01.11.')], [z('als nächstes', 'auftrag', 'normal', '-', '02.11.')]))
  assert.equal(r0.status, 0, r0.stderr)
  assert.match(r0.stdout, /Nächster startbarer Punkt: 1\. als nächstes/)
  const rj = cli(stand([z('läuft', 'eigen', 'normal', '-', '01.11.')], []), '--json')
  assert.equal(rj.status, 0, rj.stderr)
  assert.equal(JSON.parse(rj.stdout).laufend[0].titel, 'läuft')
  const r1 = cli(stand(['- **Ohne** x'], []))
  assert.equal(r1.status, 1, 'fehlendes Kennzeichen: Exit 1')
  assert.match(r1.stdout, /FEHLER Zeile 3: Kennzeichen fehlt — - \*\*Ohne\*\* x/)
  // „## Titel unterwegs“ trägt Zeilen ohne Kennzeichen und ist kein Fehler (wörtliche Zeile aus stand.md, 08.11.2026)
  const unterwegs = '## Titel unterwegs (Zeilen `- [Status TT.MM. HH:MM] Titel SxEy — …`)\n- [Live 08.11. 14:38] Black Clover S2E1 — de Synchro seit 07.11.2026 (Crunchyroll) · im Bestand 07.11. 20:29 · live gemessen 08.11. 14:38\n'
  const mitAbschnitt = stand([z('läuft', 'eigen', 'normal', '-', '01.11.')], []).replace('## In Arbeit', `${unterwegs}## In Arbeit`)
  assert.deepEqual(K.pruefeKennzeichen(mitAbschnitt), [], 'Titel unterwegs: keine Kennzeichen-Fehler')
  assert.deepEqual(titel(K.auswerten(mitAbschnitt, JETZT).laufend), ['läuft'], 'Titel unterwegs zählt nicht als laufend')
  const r2 = cli(mitAbschnitt)
  assert.equal(r2.status, 0, r2.stdout + r2.stderr)
  assert.doesNotMatch(r2.stdout, /FEHLER|Black Clover/)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('naechster.test: ok (Kennzeichen 9 Formen, Rang je Stufe + Gleichstand + Jahreswechsel, wartet überspringt, Fehler mit Zeile, Block/Details/CRLF, Hook-Warnung, CLI Exit 0/1)')
