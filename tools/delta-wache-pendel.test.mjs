/**
 * Pendelnder Bestandsbau (18./19.10.2026): Die Delta-Wache meldet das Pendeln zwischen zwei Ständen als EINE Zeile, nicht als
 * Verlust/Gewinn je Zeile; danach zählt nur der Netto-Unterschied gegen den Stand davor. Dazu das Tagebuch der Wache:
 * gleicher Befund-Wortlaut wird nicht erneut angehängt. Echter Anlassfall: `tools/testdaten/bestand-historie-pendel.jsonl`
 * (Zeilen 1291–1311 der Historie, 18.10. 19:17Z bis 19.10. 14:35Z).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ereignisse, findePendel } from '../pipeline/lib/bestand-pendel.ts'
import { tagebuchZeilen } from './wache-tagebuch.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.TZ = 'UTC' // Uhrzeiten im Wortlaut der Wache sind Ortszeit des Prozesses
const echt = readFileSync(join(wurzel, 'tools/testdaten/bestand-historie-pendel.jsonl'), 'utf8')
const echteZeilen = echt.trimEnd().split('\n').map((z) => JSON.parse(z))
const GRUND = Date.parse('2026-10-19T00:00:00Z')

/** Zeile mit Kennzahlen; `u` = Urteile (und Prime-Synchro-Belege), `t` = Titel mit Synchro. */
function zeile(nr, u, t = 80, extra = {}) {
  return {
    zeitpunkt: new Date(GRUND + nr * 3600000).toISOString(),
    lauf: 'test',
    titel: 100,
    titelMitVerweis: 90,
    verweise: 200,
    mitUrteil: u,
    ohneUrteil: 50,
    titelMitSynchro: t,
    entferntProtokolliert: 10,
    releases: 10,
    termine: 100,
    jeAnbieter: { primevideo: u - 90 },
    ...extra,
  }
}
const folge = (...urteile) => urteile.map((u, i) => zeile(i, u))
const arten = (zeilen) => ereignisse(zeilen).map((e) => e.art)

// --- Anlassfall: vorher n Befunde, nachher eine Pendel-Zeile ---------------------------------------------------------------
{
  const vorher = echteZeilen.filter((z) => z.auffaellig?.length).length
  assert.equal(vorher, 18, 'gespeichert: 18 Zeilen mit Auffälligkeit, 16 davon aus dem Pendeln')
  const e = ereignisse(echteZeilen)
  const pendel = e.filter((x) => x.art === 'pendel')
  assert.equal(pendel.length, 1, 'ein Pendel-Ereignis')
  assert.equal(pendel[0].pendel.wechsel, 16)
  assert.equal(pendel[0].laufend, false, 'danach kamen echte Änderungen: beendet')
  assert.match(pendel[0].text, /^pendelte von 18.10., 19:56 bis 19.10., 09:12 zwischen 2039 Urteile/, 'Anfang vor Ende')
  const rot = e.filter((x) => x.art === 'zeile' && x.auffaellig.length)
  assert.equal(rot.length, 2, 'nach dem Pendeln nur noch die zwei echten Verluste (Netto-Zeile und 13:16)')
  assert.equal(rot[0].netto, true, 'die Zeile direkt nach dem Pendeln ist Netto gegen den Stand davor')
  assert.match(rot[0].auffaellig[0], /^24 Urteile verloren/, 'Netto: 2039 -> 2013 bei 2 begründet entfernten, nicht -37 des Pendelns')
  assert.equal(rot[1].netto, false)
}

// --- Die Wache als Prozess: Zeilenzahl der Meldung -------------------------------------------------------------------------
function wache(text, jetzt, tage = 2) {
  const ordner = mkdtempSync(join(tmpdir(), 'delta-wache-pendel-'))
  try {
    mkdirSync(join(ordner, 'data'))
    writeFileSync(join(ordner, 'data/bestand-historie.jsonl'), text)
    const r = spawnSync(process.execPath, [join(wurzel, 'tools/delta-pruefen.mjs'), '--tage', String(tage), '--jetzt', jetzt], { cwd: ordner, encoding: 'utf8', windowsHide: true })
    return { code: r.status, zeilen: (r.stdout + r.stderr).split('\n') }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
const mit = (z, muster) => z.filter((l) => muster.test(l))
{
  const w = wache(echt, '2026-10-19T16:00:00Z')
  assert.equal(w.code, 1, 'echte Verluste danach bleiben rot')
  assert.equal(mit(w.zeilen, /pendelte von/).length, 1, 'genau eine Pendel-Zeile')
  assert.equal(mit(w.zeilen, /Urteile verloren/).length, 2, 'statt 16 Pendelzeilen nur Netto und 13:16')
  assert.equal(mit(w.zeilen, /netto gegen den Stand vor dem Pendeln: 24 Urteile verloren/).length, 1)
  assert.equal(mit(w.zeilen, /4 Synchro-Belege weniger/).length, 0, 'keine Pendel-Zeile je Wechsel')
  assert.equal(mit(w.zeilen, /zwischen 2039 Urteile, 1498 Titel mit Synchro und 1999 Urteile, 1491 Titel mit Synchro \(16 Wechsel\)/).length, 1, 'beide Stände genannt')

  // Fenster: zählt das Ende des Pendelns (19.10. 09:12Z), nicht der Anfang (18.10. 19:56Z).
  assert.equal(mit(wache(echt, '2026-10-20T08:00:00Z', 1).zeilen, /pendelte von/).length, 1, 'Ende im Fenster, Anfang davor: gezeigt')
  assert.equal(mit(wache(echt, '2026-10-21T08:00:00Z', 1).zeilen, /pendelte von/).length, 0, 'Ende vor dem Fenster: nicht gezeigt')

  assert.equal(mit(w.zeilen, /ℹ\s+pendelte von/).length, 1, 'beendetes Pendeln ist keine Warnung')
  assert.equal(mit(w.zeilen, /⚠\s+pendelte/).length, 0)

  // Beendetes Pendeln, danach zurück auf den Stand davor: nichts mehr rot.
  const zurueck = echteZeilen.slice(0, 18).concat({ ...echteZeilen[0], zeitpunkt: '2026-10-19T10:00:00.000Z', delta: undefined, auffaellig: undefined })
  const z0 = wache(zurueck.map((z) => JSON.stringify(z)).join('\n') + '\n', '2026-10-19T12:00:00Z')
  assert.equal(z0.code, 0, `Rückkehr auf den Stand davor: ${z0.zeilen.join('\n')}`)
  assert.equal(mit(z0.zeilen, /pendelte von/).length, 1)

  // Pendeln läuft noch (Datei endet im Pendeln): eine rote Zeile "pendelt seit".
  const noch = echteZeilen.slice(0, 18).map((z) => JSON.stringify(z)).join('\n') + '\n'
  const n = wache(noch, '2026-10-19T10:00:00Z')
  assert.equal(n.code, 1, 'laufendes Pendeln ist rot')
  assert.equal(mit(n.zeilen, /⚠\s+pendelt seit .* \(16 Wechsel\)/).length, 1)
  assert.equal(mit(n.zeilen, /⚠/).length, 2, 'eine Befundzeile plus die Schlusszeile "N Lauf/Läufe"')
}

// --- Zeile nach dem Pendeln bleibt auf dem Pendelstand (delta 0) und ist trotzdem sichtbar rot ------------------------------
{
  const still = { titel: 0, verweise: 0, mitUrteil: 0, ohneUrteil: 0, titelMitSynchro: 0, releases: 0, termine: 0 }
  const zeilen = folge(120, 100, 60, 100, 60, 60)
  zeilen[5].delta = still
  const w = wache(zeilen.map((z) => JSON.stringify(z)).join('\n') + '\n', '2026-10-19T12:00:00Z')
  assert.equal(w.code, 1, w.zeilen.join('\n'))
  assert.equal(mit(w.zeilen, /netto gegen den Stand vor dem Pendeln: 60 Urteile verloren/).length, 1, 'Exit 1 hat eine Zeile, die ihn erklärt')

  // Gewollt: eine eigene Auffälligkeit mitten im Pendeln erscheint nicht einzeln; ein beendetes A,B,A ist nur eine Info-Zeile.
  const mitten = folge(100, 100, 60, 100, 100)
  mitten[2].auffaellig = ['crunchyroll: 1 Synchro-Belege weniger']
  const m = wache(mitten.map((z) => JSON.stringify(z)).join('\n') + '\n', '2026-10-19T12:00:00Z')
  assert.equal(mit(m.zeilen, /crunchyroll/).length, 0)
  assert.equal(m.code, 0)
  assert.equal(mit(m.zeilen, /ℹ\s+pendelte von/).length, 1)
}

// --- Gegenfälle ---------------------------------------------------------------------------------------------------------
{
  // Einmaliger echter Verlust bleibt gemeldet (eigene Auffälligkeit der Zeile, kein Pendeln).
  const z = folge(100, 100, 60)
  z[2].auffaellig = ['40 Urteile verloren']
  assert.deepEqual(arten(z), ['zeile', 'zeile', 'zeile'])
  assert.deepEqual(ereignisse(z)[2].auffaellig, ['40 Urteile verloren'])
  z[2].erklaert = ['Kanal-Titel']
  assert.deepEqual(ereignisse(z)[2].erklaert, ['Kanal-Titel'])
  const e1 = wache(JSON.stringify(zeile(2, 100, 80, { erklaert: ['Kanal-Titel'] })) + '\n', '2026-10-19T12:00:00Z')
  assert.equal(e1.code, 0)
  assert.equal(mit(e1.zeilen, /ℹ\s+erklärt, nicht rot: Kanal-Titel/).length, 1)

  // Drei Stände A,B,C,A,B,C: kein Pendeln zwischen zwei Ständen, nichts wird verschluckt.
  const drei = folge(100, 60, 80, 100, 60, 80)
  assert.deepEqual(findePendel(drei), [])
  assert.equal(ereignisse(drei).every((x) => x.art === 'zeile'), true)

  // Mindestumfang: A,B ist kein Pendeln, A,B,A schon (genau 2 Wechsel).
  assert.deepEqual(findePendel(folge(100, 60)), [])
  assert.deepEqual(findePendel(folge(100, 60, 100)).map((p) => p.wechsel), [2])

  // Toleranz: Rückkehr um genau 5 gilt als derselbe Stand, um 6 nicht.
  assert.equal(findePendel(folge(100, 60, 105)).length, 1)
  assert.equal(findePendel(folge(100, 60, 106)).length, 0)
  // Schwingung: Nachbarn 5 auseinander sind keine Schwingung, 6 schon.
  assert.equal(findePendel(folge(100, 105, 100)).length, 0)
  assert.equal(findePendel(folge(100, 106, 100)).length, 1)

  // Netto nach dem Pendeln: Rückkehr auf den alten Stand = nichts; echter Rest wird netto gemeldet.
  const ende = folge(100, 100, 60, 100, 60, 100, 100)
  ende[2].auffaellig = ['40 Urteile verloren']
  ende[3].auffaellig = ['40 Urteile mehr']
  const gleich = ereignisse(ende)
  assert.deepEqual(gleich.map((x) => x.art), ['zeile', 'pendel', 'zeile'], 'Zeile 0 davor, Zeilen 1–5 Pendeln, Zeile 6 danach')
  assert.deepEqual(gleich[1].pendel.wechsel, 4)
  assert.deepEqual(gleich[2].auffaellig, [], 'zurück auf 100: netto nichts, obwohl 5 -> 6 gespeichert anders stünde')
  const rest = folge(120, 100, 60, 100, 60, 90)
  rest[5].auffaellig = ['30 Urteile mehr']
  const netto = ereignisse(rest)
  assert.equal(netto[2].netto, true)
  assert.deepEqual(netto[2].auffaellig, ['30 Urteile verloren', 'primevideo: 30 Synchro-Belege weniger'], 'netto gegen 120 (vor dem Pendeln), weder gegen 60 noch gegen den ersten Pendelstand 100')

  // Pendeln am Dateianfang: keine Zeile davor, die Zeile danach behält ihre gespeicherten Werte.
  const anfang = folge(100, 60, 100, 60, 90)
  anfang[4].auffaellig = ['x']
  const a = ereignisse(anfang)
  assert.equal(a[0].art, 'pendel')
  assert.equal(a[0].pendel.davor, -1)
  assert.equal(a[1].netto, false)
  assert.deepEqual(a[1].auffaellig, ['x'])

  // Laufend nur, wenn die letzte Zeile zum Pendeln gehört.
  assert.equal(ereignisse(folge(100, 60, 100, 60))[0].laufend, true)
  assert.equal(ereignisse(folge(100, 60, 100, 60, 10))[0].laufend, false)

  // Ein Pendel endet, die nächste Rückkehr beginnt nicht in dessen letzter Zeile.
  assert.deepEqual(findePendel(folge(100, 60, 100, 60, 100, 200, 100)).map((p) => [p.von, p.bis]), [[0, 4]])

  // Drift (je Zyklus -5) ist kein einziges Pendeln: es bricht ab, sobald ein Stand mehr als die Toleranz von seinem Anfangsstand abweicht.
  const drift = folge(2000, 2000, 2036, 1995, 2031, 1990, 2026, 1985, 2021, 1980)
  assert.deepEqual(findePendel(drift).map((p) => [p.von, p.bis]), [[1, 4], [5, 8]])
  // Genau an der Grenze (Abweichung 5 vom Anfangsstand) bleibt es ein Pendeln.
  assert.deepEqual(findePendel(folge(2000, 2036, 1995, 2031, 1995, 2031)).map((p) => [p.von, p.bis]), [[0, 5]])
  assert.deepEqual(findePendel(folge(2000, 2036, 1995, 2031, 1994, 2031)).map((p) => [p.von, p.bis]), [[0, 3]])

  // Die Schwingung endet, sobald der Nachbar nur noch 5 entfernt ist, auch wenn der Stand nahe am Anfangsstand liegt.
  assert.deepEqual(findePendel(folge(100, 106, 100, 103)).map((p) => [p.von, p.bis]), [[0, 2]])

  // Zwei Pendel hintereinander überlappen nicht.
  const zwei = findePendel(folge(100, 60, 100, 60, 100, 200, 140, 200, 140, 200))
  assert.deepEqual(zwei.map((p) => [p.von, p.bis]), [[0, 4], [5, 9]])

  // Leer und eine Zeile.
  assert.deepEqual(ereignisse([]), [])
  assert.deepEqual(arten(folge(100)), ['zeile'])
}

// --- Drift: Kette aus Teilpendeln, Gesamtverlust in einer Zeile --------------------------------------------------------------
{
  const drift = folge(2000, 2000, 2036, 1995, 2031, 1990, 2026, 1985, 2021, 1980)
  const e = ereignisse(drift)
  assert.deepEqual(e.map((x) => x.art), ['zeile', 'pendel', 'pendel', 'zeile'])
  assert.doesNotMatch(e[1].text, /Kette/, 'das erste Glied kennt den Gesamtverlust noch nicht')
  assert.match(e[2].text, /; Kette aus 2 Teilpendeln seit 19.10., 01:00: 2000 -> 1980 Urteile \(-20\) gegen den Stand davor$/, 'Summe über beide Glieder, nicht 2031 -> 1980')
  assert.equal(e[3].netto, true)
  assert.deepEqual(e[3].auffaellig, ['20 Urteile verloren', 'primevideo: 20 Synchro-Belege weniger'], 'netto gegen den Stand vor der Kette (2000), nicht gegen das Ende des ersten Glieds (2031)')

  // Laufende Kette: bis zur letzten Zeile gerechnet, Gewinn mit Plus.
  const laufend = ereignisse(folge(2000, 2000, 2036, 1995, 2031, 1990, 2026, 1985, 2021))
  assert.match(laufend[2].text, /^pendelt seit .*: 2000 -> 2021 Urteile \(\+21\) gegen den Stand davor$/)

  // Gesamtverlust genau 0: ohne Vorzeichen.
  const null0 = ereignisse(folge(2000, 2000, 2036, 1995, 2031, 1990, 2026, 1985, 2021, 2000))
  assert.match(null0[2].text, /2000 -> 2000 Urteile \(0\) gegen/)

  // Kette aus einem Teilpendel (Grenze): keine Kettenzeile, Netto wie bisher gegen die Zeile davor.
  const einzeln = ereignisse(folge(100, 60, 100, 60, 90))
  assert.doesNotMatch(einzeln[0].text, /Kette/)
  const eins = ereignisse(folge(2000, 2000, 2036, 1995, 2031, 1990, 1700))
  assert.doesNotMatch(eins[1].text, /Kette/)
  assert.equal(eins[2].netto, true)

  // Kette ab Dateianfang: kein Stand davor, keine Summe.
  const ohneDavor = ereignisse(folge(100, 60, 100, 60, 100, 200, 140, 200, 140, 200, 90))
  assert.doesNotMatch(ohneDavor[1].text, /Kette/)
  assert.equal(ohneDavor[2].netto, false)

  // Zwei Pendel mit einer Zeile dazwischen sind keine Kette.
  const luecke = ereignisse(folge(100, 60, 100, 60, 100, 500, 300, 260, 300, 260, 300, 50))
  assert.deepEqual(luecke.map((x) => x.art), ['pendel', 'zeile', 'pendel', 'zeile'])
  assert.doesNotMatch(luecke[2].text, /Kette/)
  assert.equal(luecke[3].netto, true)

  // Als Prozess: die Zeile steht im Wortlaut der Wache.
  const w = wache(drift.map((z) => JSON.stringify(z)).join('\n') + '\n', '2026-10-19T16:00:00Z')
  assert.equal(mit(w.zeilen, /Kette aus 2 Teilpendeln seit 19.10., 01:00: 2000 -> 1980 Urteile \(-20\)/).length, 1)
  console.log('Drift-Kette: Gesamtverlust in der Info-Zeile, Kette aus 1 ohne Zeile, Lücke keine Kette: ok')
}

// --- Tagebuch: gleicher Befund-Wortlaut nicht erneut ---------------------------------------------------------------------
{
  const z = (zeit, zahlen, aend, befund) => `| ${zeit} | ${zahlen} | ${aend} | ${befund} |`
  const alt = [z('19.10.2026 11:00', '2922 / 2036 / 211', 'Urteile -37', 'netto'), z('19.10.2026 10:00', '2922 / 1999 / 246', '—', 'andere')]
  const gleich = z('20.10.2026 09:20', '2922 / 2036 / 211', 'Urteile -37', 'netto')
  assert.deepEqual(tagebuchZeilen(gleich, alt, true), alt, 'gleicher Wortlaut an anderer Stelle: nicht erneut')
const ok = z('19.10.2026 09:00', '2922 / 2036 / 211', 'Urteile -37', 'unauffällig')
  assert.deepEqual(tagebuchZeilen(gleich, [ok, ok, gleich], true), [gleich, ok, ok, gleich], 'nach unauffälligen Läufen kehrt derselbe Befund wieder: angehängt')
  assert.deepEqual(tagebuchZeilen(gleich, [gleich, ok], true), [gleich, ok], 'Befund direkt davor, unauffällige Zeile älter: nicht erneut')
  const andere = z('20.10.2026 09:20', '2922 / 2036 / 211', 'Urteile -37', 'netto; neu')
  assert.deepEqual(tagebuchZeilen(andere, alt, true), [andere, ...alt], 'anderer Befund: angehängt')
  assert.deepEqual(tagebuchZeilen(gleich, alt, false), [gleich, ...alt], 'unauffällige Zeile wird immer angehängt')
  assert.deepEqual(tagebuchZeilen(gleich, [], true), [gleich], 'leere Datei')
  assert.deepEqual(tagebuchZeilen(z('x', 'a', 'b', 'c'), [z('y', 'a', 'b', 'd')], true).length, 2, 'nur die letzte Spalte verschieden')
  assert.deepEqual(tagebuchZeilen(z('x', 'a', 'b', 'c'), [z('y', 'a', 'z', 'c')], true).length, 2, 'nur die mittlere Spalte verschieden')
  assert.deepEqual(tagebuchZeilen(z('x', 'a', 'b', 'c'), [z('y', 'z', 'b', 'c')], true).length, 2, 'nur die erste Spalte verschieden')
}

// --- Der Schreiber als Prozess, zwei Läufe hintereinander -----------------------------------------------------------------
{
  const ordner = mkdtempSync(join(tmpdir(), 'wache-schreiben-'))
  try {
    writeFileSync(join(ordner, 'delta.txt'), 'x\nStand jetzt: 1 Titel, 2 Urteile, 3 offen\n            ⚠  pendelt seit 18.10., 21:56 zwischen A und B (16 Wechsel)\n')
    const lauf = (lage = 'befund') => spawnSync(process.execPath, [join(wurzel, 'tools/wache-schreiben.mjs'), 'delta.txt', 'fehlt.txt', lage], { cwd: ordner, encoding: 'utf8', windowsHide: true })
    const zaehle = () => readFileSync(join(ordner, 'daniel-zum-abarbeiten/00-wache.md'), 'utf8').split('\n').filter((l) => /^\| \d{2}\.\d{2}\.\d{4} /.test(l)).length
    assert.equal(lauf().status, 0)
    assert.equal(zaehle(), 1)
    assert.equal(lauf().status, 0)
    assert.equal(zaehle(), 1, 'zweiter Lauf mit gleichem Befund: keine zweite Zeile')
    writeFileSync(join(ordner, 'delta.txt'), 'x\nStand jetzt: 1 Titel, 2 Urteile, 3 offen\n            ⚠  anderer Befund\n')
    assert.equal(lauf().status, 0)
    assert.equal(zaehle(), 2, 'anderer Wortlaut: neue Zeile')
    assert.equal(lauf('ok').status, 0)
    assert.equal(lauf('ok').status, 0)
    assert.equal(zaehle(), 4, 'unauffällige Läufe werden jedes Mal angehängt')
    assert.equal(lauf().status, 0)
    assert.equal(zaehle(), 5,'derselbe Befund nach unauffälligen Läufen kehrt wieder: neue Zeile')
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

console.log('delta-wache-pendel.test: echter Anlassfall (16 Pendelzeilen -> 1, Netto 24), laufend/beendet, Gegenfälle (Einzelverlust, drei Stände, Toleranz 5/6, Anfang, zwei Pendel), Tagebuch ohne Wiederholung (Funktion und Schreiber, zwei Läufe) grün')
