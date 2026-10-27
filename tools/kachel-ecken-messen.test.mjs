/**
 * Die Bewertung von `kachel-ecken-messen.mjs` (Daniel, 17.10.2026): Jeder Fehler der Anbieter-Leiste wird gefunden, jedes Gutes bleibt still.
 * Die Kulisse hat drei Kacheln, die schadhafte steht in der Mitte (nicht am Rand), und je Stelle (Ecken, Seitenrand, Raum unter der Leiste,
 * Unterkante) ein eigener Fall; die Pixel sind Zahlen, kein Browser nötig. Der Lauf im Browser steht in `check:ansichten-desktop`.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ansichtErgebnis, bewerte, fehlendeZeilen, kandidatenWochen, kennungsWochen, kulisseAntwort, main, messeMitWahl, messwocheAbbruch, saalFehler, saalKulisse, sammleFehler, setzeSichtbarkeitSchwebender, tagePlus, waehleMesswoche } from './kachel-ecken-messen.mjs'

const LEISTE = [200, 20, 20]
const COVER = [70, 90, 130]
const GRUND = [13, 15, 20]
const GOLD = [245, 197, 66]

/** Pixel einer gesunden Kachel in der Reihenfolge von `stellen`: Ecken, innen, drei unter der Leiste, Seitenränder oben, Referenz oben, die Zeile gleich unter der Leiste (Index 11). */
const gesund = () => [LEISTE, LEISTE, LEISTE, LEISTE, GRUND, GRUND, GRUND, COVER, COVER, COVER, COVER, GRUND]
const kachel = (x, favorit = false) => ({ x, w: 100, oben: 100, unten: 250, favorit })
const lauf = (kacheln, farben) => ({ kacheln, farben: farben.flat() })

function basis() {
  const kacheln = [kachel(0), kachel(200), kachel(400)]
  return { ohne: lauf(kacheln, [gesund(), gesund(), gesund()]), mit: lauf(kacheln.map((k) => ({ ...k, favorit: true })), [gesund(), gesund(), gesund()]) }
}

/** Setzt Pixel `n` der mittleren Kachel (Index 1) im Lauf `art`. */
function mitFehler(art, n, farbe) {
  const b = basis()
  const farben = [gesund(), gesund(), gesund()]
  farben[1][n] = farbe
  b[art] = lauf(b[art].kacheln, farben)
  return bewerte('t', b.ohne, b.mit, 1)
}

assert.deepEqual(bewerte('t', basis().ohne, basis().mit, 1), [], 'gesunde Kacheln bleiben still')

for (const art of ['ohne', 'mit']) {
  assert.match(mitFehler(art, 0, GRUND).join('\n'), /Kachel 1: untere Ecke links/, `runde Ecke links (${art})`)
  assert.match(mitFehler(art, 1, GRUND).join('\n'), /Kachel 1: untere Ecke rechts/, `runde Ecke rechts (${art})`)
  assert.match(mitFehler(art, 7, GRUND).join('\n'), /Kachel 1: Seitenrand links/, `Seitenrand links eingezogen (${art})`)
  assert.match(mitFehler(art, 8, GRUND).join('\n'), /Kachel 1: Seitenrand rechts/, `Seitenrand rechts eingezogen (${art})`)
}
for (const [n, px] of [[11, 1], [4, 2], [5, 3], [6, 4]]) {
  assert.match(mitFehler('mit', n, GOLD).join('\n'), new RegExp(`Kachel 1: ${px} px unter der Leiste`), `Goldstreifen ${px} px unter der Leiste`)
}
assert.equal(mitFehler('mit', 0, GRUND).filter((f) => /Kachel [02]/.test(f)).length, 0, 'nur die schadhafte Kachel wird gemeldet')

const tiefer = basis()
tiefer.mit.kacheln[1] = { ...tiefer.mit.kacheln[1], unten: 251 }
assert.match(bewerte('t', tiefer.ohne, tiefer.mit, 1).join('\n'), /Kachel 1: Leiste sitzt mit Favorit 1.00 px tiefer/, 'Leiste 1 px tiefer')
const hoeher = basis()
hoeher.mit.kacheln[1] = { ...hoeher.mit.kacheln[1], unten: 249 }
assert.match(bewerte('t', hoeher.ohne, hoeher.mit, 1).join('\n'), /Kachel 1: Leiste sitzt mit Favorit -1.00 px tiefer/, 'Leiste 1 px höher')

// Eine Kachel direkt darunter zeigt mit Favorit ihren eigenen Rand an dieser Stelle: kein Fehler; steht sie weiter weg, wohl.
const darunter = basis()
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], x: 250, oben: 252 }
darunter.ohne.kacheln[2] = darunter.mit.kacheln[2]
const farbenDarunter = [gesund(), gesund(), gesund()]
farbenDarunter[1][5] = GOLD
darunter.mit.farben = farbenDarunter.flat()
assert.deepEqual(bewerte('t', darunter.ohne, darunter.mit, 1), [], 'Nachbarkachel darunter erklärt den Streifen')
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], oben: 270 }
assert.match(bewerte('t', darunter.ohne, darunter.mit, 1).join('\n'), /2 px unter der Leiste|3 px unter der Leiste/, 'Nachbar 20 px tiefer erklärt nichts')
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], oben: 252, x: 500 }
assert.match(bewerte('t', darunter.ohne, darunter.mit, 1).join('\n'), /px unter der Leiste/, 'Nachbar daneben erklärt nichts')
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], oben: 252, x: 50 }
assert.match(bewerte('t', darunter.ohne, darunter.mit, 1).join('\n'), /px unter der Leiste/, 'Nachbar links daneben (endet vor der Kachel) erklärt nichts')
darunter.mit.kacheln[2] = { ...darunter.mit.kacheln[2], oben: 200, x: 250 }
assert.match(bewerte('t', darunter.ohne, darunter.mit, 1).join('\n'), /px unter der Leiste/, 'Nachbar, der mitten in der Kachel beginnt, erklärt nichts')

// Seitenpixel über der Leiste dürfen sich zwischen den Läufen unterscheiden (Rand ist Sache der Seitenprüfung), solange Rand und Referenz gleich bleiben.
const seiten = basis()
const farbenSeiten = [gesund(), gesund(), gesund()]
for (const n of [7, 8, 9, 10]) farbenSeiten[1][n] = GOLD
seiten.mit.farben = farbenSeiten.flat()
assert.deepEqual(bewerte('t', seiten.ohne, seiten.mit, 1), [], 'Seitenpixel gelten nicht als Streifen unter der Leiste')

// Leerer Vergleich: zu wenige Favoriten oder verschiedene Kachelzahl.
const leer = basis()
leer.mit.kacheln = leer.mit.kacheln.map((k) => ({ ...k, favorit: false }))
assert.match(bewerte('t', leer.ohne, leer.mit, 1).join('\n'), /nur 0 Kacheln mit Favoritenrand/, 'ohne Favoriten kein Vergleich')
const zuWenig = basis()
assert.match(bewerte('t', zuWenig.ohne, zuWenig.mit, 4).join('\n'), /nur 3 Kacheln mit Favoritenrand \(mindestens 4\)/, 'Mindestzahl gilt')
assert.match(bewerte('t', basis().ohne, { kacheln: [kachel(0, true)], farben: gesund() }, 1).join('\n'), /Kachelzahl 3 → 1/, 'Kachelzahl ungleich')
assert.match(bewerte('t', { kacheln: [], farben: [] }, { kacheln: [], farben: [] }, 0).join('\n'), /Kachelzahl 0 → 0/, 'keine Kacheln')

// Eine halbtransparente Ringzeile gleich unter der Leiste (Clip rundet nicht auf ganze Pixel) wird gefunden, auch wenn sie nur schwach ist.
assert.match(mitFehler('mit', 11, [129, 106, 43]).join('\n'), /Kachel 1: 1 px unter der Leiste/, 'halber Ring 1 px unter der Leiste')
assert.match(mitFehler('mit', 11, [67, 60, 31]).join('\n'), /Kachel 1: 1 px unter der Leiste/, 'schwacher Ring 1 px unter der Leiste')

// Kino-Saal: Eine Woche ohne Saal-Kachel misst dessen Unterkante nicht und ist ein Fehler; der Saal steht mitten in der Liste.
const mitSaal = [kachel(0), { ...kachel(200), saal: true }, kachel(400)]
assert.deepEqual(saalFehler('t', mitSaal, 1), [], 'Saal vorhanden')
assert.match(saalFehler('t', [kachel(0), kachel(200)], 1).join('\n'), /nur 0 Kino-Saal-Kacheln \(mindestens 1\)/, 'ohne Saal kein Beleg')
assert.match(saalFehler('t', mitSaal, 2).join('\n'), /nur 1 Kino-Saal-Kacheln \(mindestens 2\)/, 'Mindestzahl gilt')
assert.deepEqual(saalFehler('t', [kachel(0), { ...kachel(200), saal: true }, { ...kachel(400), saal: true }]), [], 'Standardmindestzahl 1 genügt bei zwei')
assert.equal(saalFehler('t', [kachel(0), kachel(200)]).length, 1, 'Standardmindestzahl verlangt mindestens einen Saal')

// Verdrahtung der Ansicht: Die Woche prüft den Saal und nennt die Zahl in der Zeile, der Monat prüft ihn nicht.
const fuenf = [0, 1, 2, 3, 4].map((i) => kachel(i * 200))
const ohneSaal = { ohne: lauf(fuenf, fuenf.map(gesund)), mit: lauf(fuenf.map((k) => ({ ...k, favorit: true })), fuenf.map(gesund)) }
const mitSaalLauf = { ohne: ohneSaal.ohne, mit: { ...ohneSaal.mit, kacheln: ohneSaal.mit.kacheln.map((k, i) => ({ ...k, saal: i === 2 })) } }
const woche = ansichtErgebnis('dunkel', 'woche', mitSaalLauf)
assert.deepEqual(woche.fehler, [], 'Woche mit Saal: kein Fehler')
assert.equal(woche.zeile, 'dunkel/woche: 5 Kacheln (1 Saal), 0 Fehler', 'Zeile nennt die Saalzahl')
const wocheOhneSaal = ansichtErgebnis('hell', 'woche', ohneSaal)
assert.match(wocheOhneSaal.fehler.join('\n'), /hell\/woche: nur 0 Kino-Saal-Kacheln/, 'Woche ohne Saal ist ein Fehler')
assert.equal(wocheOhneSaal.zeile, 'hell/woche: 5 Kacheln (0 Saal), 1 Fehler', 'Fehlerzahl in der Zeile')
const monat = ansichtErgebnis('hell', 'monat', ohneSaal)
assert.deepEqual(monat.fehler, [], 'Monat braucht keinen Saal')
assert.equal(monat.zeile, 'hell/monat: 5 Kacheln, 0 Fehler', 'Monat ohne Saalangabe')

// Messwoche aus den Daten statt fester Tag: Montage ab der Woche des Datenstands, erste Woche mit Saal; ohne Saal in allen Wochen ein Fehler.
assert.equal(tagePlus('2026-12-30', 3), '2027-01-02', 'Jahreswechsel')
assert.equal(tagePlus('2026-10-26', -1), '2026-10-25', 'zurück')
assert.deepEqual(kandidatenWochen('2026-10-21T23:30:00.000Z', 3), ['2026-10-19', '2026-10-26', '2026-11-02'], 'Mittwoch: Montag derselben Woche')
assert.equal(kandidatenWochen('2026-10-25T10:00:00.000Z', 1)[0], '2026-10-19', 'Sonntag gehört zur Woche davor')
assert.equal(kandidatenWochen('2026-10-26T00:10:00.000Z', 1)[0], '2026-10-26', 'Montag ist sein eigener Montag')
assert.equal(kandidatenWochen('2026-10-19T11:16:01.165Z').length, 9, 'Standard: 9 Wochen')
const saalProWoche = { '2026-10-19': 0, '2026-10-26': 0, '2026-11-02': 2, '2026-11-09': 5 }
const gefragt = []
const zaehle = async (d) => {
  gefragt.push(d)
  return saalProWoche[d] ?? 0
}
const woche3 = await waehleMesswoche(Object.keys(saalProWoche), zaehle)
assert.deepEqual(woche3, { datum: '2026-11-02', saal: 2 }, 'erste Woche mit Saal, nicht die letzte und nicht die erste')
assert.deepEqual(gefragt, ['2026-10-19', '2026-10-26', '2026-11-02'], 'danach wird nicht weitergesucht')
const keine = await waehleMesswoche(['2026-10-19', '2026-10-26'], async () => 0)
assert.match(keine.fehler, /keine der 2 Wochen ab 2026-10-19 hat 1 Kino-Saal-Kacheln/, 'keine Woche mit Saal: laut rot')
assert.equal(keine.datum, undefined, 'ohne Saal keine Messwoche')
assert.deepEqual(kennungsWochen('2026-11-02'), ['2026-11-02', '2026-11-09', '2026-11-16'], 'Kennungen aus der Messwoche und den zwei folgenden')
// Verdrahtung von Wahl und Messung: ohne Messwoche läuft die Messung nicht, mit ihr bekommt sie Browser und Datum der Wahl.
{
  const aufrufe = []
  const browser = { name: 'browser' }
  const messe = async (...args) => {
    aufrufe.push(args)
    return [{ fehler: [], zeile: 'gemessen' }]
  }
  const stillLog = console.log
  console.log = () => {}
  try {
    const ohne = await messeMitWahl(browser, async () => keine, messe)
    assert.deepEqual(ohne, messwocheAbbruch(keine), 'ohne Messwoche kommt der Abbruch')
    assert.equal(aufrufe.length, 0, 'ohne Messwoche wird nicht gemessen')
    const mit = await messeMitWahl(browser, async (b) => (b === browser ? woche3 : keine), messe)
    assert.deepEqual(mit, [{ fehler: [], zeile: 'gemessen' }], 'mit Messwoche kommt das Ergebnis der Messung')
    assert.deepEqual(aufrufe, [[browser, '2026-11-02']], 'Messung bekommt Browser und Datum der Wahl')
  } finally {
    console.log = stillLog
  }
}
// Fehlt die Messwoche, endet der Lauf mit Exit 1 (Ergebnis wie von messeAlles geliefert).
process.argv.push('--dist', 'dist')
assert.equal(messwocheAbbruch(woche3), null, 'mit Messwoche kein Abbruch')
assert.deepEqual(await waehleMesswoche(['2026-10-19', '2026-10-26'], async (d) => (d === '2026-10-26' ? 1 : 0)), { datum: '2026-10-26', saal: 1 }, 'genau ein Saal genügt')
assert.match(messwocheAbbruch(keine)[0].fehler[0], /keine der 2 Wochen/, 'Abbruch trägt den Fehlertext der Wahl')
const keineWoche = async () => messwocheAbbruch(keine)
assert.equal(await (async () => { const l = console.error; console.error = () => {}; try { return await main(keineWoche) } finally { console.error = l } })(), 1, 'keine Messwoche: Exit 1')

// `ansichtErgebnis` reicht die Fehler von `bewerte` durch (Leiste einer mittleren Kachel mit Favorit 1 px tiefer) und zählt sie in der Zeile.
const tieferMit = { ohne: ohneSaal.ohne, mit: { ...mitSaalLauf.mit, kacheln: mitSaalLauf.mit.kacheln.map((k, i) => (i === 2 ? { ...k, unten: k.unten + 1 } : k)) } }
const monatTiefer = ansichtErgebnis('hell', 'monat', tieferMit)
assert.equal(monatTiefer.fehler.length, 1, 'Monat: ein Fehler aus bewerte')
assert.match(monatTiefer.fehler[0], /^hell\/monat Kachel 2: Leiste sitzt mit Favorit 1.00 px tiefer$/, 'Monat: Fehlertext von bewerte')
assert.equal(monatTiefer.zeile, 'hell/monat: 5 Kacheln, 1 Fehler', 'Monat: Fehlerzahl in der Zeile')
const wocheTiefer = ansichtErgebnis('dunkel', 'woche', tieferMit)
assert.match(wocheTiefer.fehler.join('\n'), /dunkel\/woche Kachel 2: Leiste sitzt/, 'Woche: Fehler von bewerte')
assert.equal(wocheTiefer.zeile, 'dunkel/woche: 5 Kacheln (1 Saal), 1 Fehler', 'Woche: Fehlerzahl in der Zeile')

// Vollständigkeitssperre: Jede der 8 Ergebniszeilen {dunkel,hell}×{woche,monat,fenster,handy} muss da sein; eine nicht aufgerufene Ansicht endet rot.
const alleZeilen = ['dunkel', 'hell'].flatMap((t) => ['woche', 'monat', 'fenster', 'handy'].map((a) => `${t}/${a}: 21 Kacheln, 0 Fehler`))
assert.deepEqual(fehlendeZeilen(alleZeilen), [], 'alle 8 Zeilen: nichts fehlt')
for (let i = 0; i < alleZeilen.length; i++) {
  const ohneEine = alleZeilen.filter((_, j) => j !== i)
  assert.deepEqual(fehlendeZeilen(ohneEine), [alleZeilen[i].split(':')[0]], `fehlt allein: ${alleZeilen[i]}`)
}
assert.deepEqual(fehlendeZeilen(alleZeilen.filter((z) => !z.includes('/handy'))), ['dunkel/handy', 'hell/handy'], 'Handy in beiden Themen fehlt')
assert.equal(fehlendeZeilen([]).length, 8, 'ohne Zeilen fehlen alle 8')
assert.deepEqual(fehlendeZeilen([...alleZeilen.slice(0, 3), ...alleZeilen.slice(4)]), ['dunkel/handy'], 'Lücke mitten in der Liste')
assert.deepEqual(fehlendeZeilen(alleZeilen.map((z) => z.replace('/handy: ', '/handy-x: '))), ['dunkel/handy', 'hell/handy'], 'Name muss ganz stimmen')
assert.deepEqual(fehlendeZeilen(alleZeilen.map((z) => (z.startsWith('hell/handy') ? `Meldung ${z}` : z))), ['hell/handy'], 'Name steht am Zeilenanfang, nicht irgendwo')
assert.deepEqual(fehlendeZeilen([...alleZeilen, 'dunkel/sonst: 1 Kacheln, 0 Fehler']), [], 'eine zusätzliche Zeile stört nicht')

// `sammleFehler`: Fehler der Ansichten in Reihenfolge, dazu die Meldung über fehlende Zeilen (das Werkzeug endet dann mit Exit 1).
const gemessen = alleZeilen.map((zeile, i) => ({ zeile, fehler: i === 2 || i === 5 ? [`F${i}`] : [] }))
assert.deepEqual(sammleFehler(gemessen), ['F2', 'F5'], 'vollständig: nur die Fehler der Ansichten')
assert.deepEqual(sammleFehler(gemessen.map((e) => ({ ...e, fehler: [] }))), [], 'vollständig und sauber: kein Fehler')
assert.deepEqual(sammleFehler(gemessen.filter((_, i) => i !== 3 && i !== 7)), ['F2', 'F5', 'Ergebniszeilen fehlen: dunkel/handy, hell/handy'], 'fehlende Zeilen sind ein Fehler')
assert.deepEqual(sammleFehler(gemessen.filter((_, i) => i !== 3)), ['F2', 'F5', 'Ergebniszeilen fehlen: dunkel/handy'], 'eine fehlende Zeile')
assert.deepEqual(sammleFehler([]), ['Ergebniszeilen fehlen: ' + fehlendeZeilen([]).join(', ')], 'ohne Ergebnisse fehlen alle')

// Exit-Code als eigener Prozess: Fehlt dist/, endet das Werkzeug rot (Kopie in einer Wegwerf-Wurzel ohne dist/, node_modules per Verknüpfung).
const wurzel = mkdtempSync(path.join(os.tmpdir(), 'kachel-ecken-'))
try {
  const quelle = path.dirname(fileURLToPath(import.meta.url))
  mkdirSync(path.join(wurzel, 'tools'))
  mkdirSync(path.join(wurzel, 'web', 'src'), { recursive: true })
  for (const datei of ['kachel-ecken-messen.mjs', 'dist-frisch.mjs']) copyFileSync(path.join(quelle, datei), path.join(wurzel, 'tools', datei))
  symlinkSync(path.join(quelle, '..', 'node_modules'), path.join(wurzel, 'node_modules'), 'junction')
  const lauf = spawnSync(process.execPath, [path.join(wurzel, 'tools', 'kachel-ecken-messen.mjs')], { encoding: 'utf8', timeout: 60000 })
  assert.equal(lauf.status, 1, `ohne dist/ Exit 1 (stderr: ${lauf.stderr})`)
  assert.match(lauf.stderr, /dist\/ fehlt/, 'Meldung nennt dist/')
} finally {
  unlinkSync(path.join(wurzel, 'node_modules'))
  rmSync(wurzel, { recursive: true, force: true })
}

// Ende von main: Exit-Code aus der (eingespeisten) Messung, ohne Browser; --dist umgeht die Frische-Prüfung von dist/.
process.argv.push('--dist', 'dist')
const alleOk = () => fehlendeZeilen([]).map((name) => ({ fehler: [], zeile: `${name}: 3 Kacheln, 0 Fehler` }))
const stumm = async (messe) => {
  const log = console.log
  const err = console.error
  console.log = () => {}
  console.error = () => {}
  try {
    return await main(messe)
  } finally {
    console.log = log
    console.error = err
  }
}
assert.equal(await stumm(async () => alleOk()), 0, 'alles ok: Exit 0')
const mitFehlerErgebnis = alleOk()
mitFehlerErgebnis[1] = { fehler: ['hell/woche: Ecke zu rund'], zeile: mitFehlerErgebnis[1].zeile }
assert.equal(await stumm(async () => mitFehlerErgebnis), 1, 'ein Fehler: Exit 1')
assert.equal(await stumm(async () => alleOk().slice(1)), 1, 'fehlende Ergebniszeile: Exit 1')

// Startzeile als eigener Prozess in der echten Aufrufform: Liefert main 1 wegen eines Messfehlers (--dist umgeht distPruefen, kein exitCode gesetzt), muss der Prozess mit 1 enden.
const messDir = mkdtempSync(path.join(os.tmpdir(), 'kachel-messung-'))
try {
  const skript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'kachel-ecken-messen.mjs')
  const startMit = (ergebnisse) => {
    const datei = path.join(messDir, 'messung.json')
    writeFileSync(datei, JSON.stringify(ergebnisse))
    return spawnSync(process.execPath, [skript, '--dist', messDir, '--messung', datei], { cwd: messDir, encoding: 'utf8', timeout: 60000 })
  }
  const lauf1 = startMit(mitFehlerErgebnis)
  assert.equal(lauf1.status, 1, `Messfehler: Prozess endet mit 1 (stderr: ${lauf1.stderr})`)
  assert.match(lauf1.stderr, /1 Fehler/, 'Messfehler wird gemeldet')
  const lauf0 = startMit(alleOk())
  assert.equal(lauf0.status, 0, `sauber: Prozess endet mit 0 (stderr: ${lauf0.stderr})`)
  assert.match(lauf0.stdout, /Kachel-Ecken: Leiste sitzt/, 'Erfolgszeile')
} finally {
  rmSync(messDir, { recursive: true, force: true })
}

// Saal-Kulisse (21.10.2026): Der Datensatz hat keinen Kinofilm in den nächsten Wochen, die Messung bekommt ihren Saal trotzdem.
const tv = (id, extra = {}) => ({ releaseSlug: `s${id}`, titleId: id, releaseType: 'weekly', platform: 'adn', name: `T${id}`, id: `s${id}@2026-10-19`, date: '2026-10-19', ...extra })
const ohneKino = [tv(1, { staffelstart: true, episode: 1, time: '10:00' }), tv(2, { time: '11:00', episode: 5, episodeCount: 12 }), tv(3)]
const wochen3 = ['2026-10-19', '2026-10-26', '2026-11-02']
const mitKulisse = saalKulisse(ohneKino, wochen3)
assert.deepEqual(mitKulisse.slice(0, 3), ohneKino, 'echte Termine bleiben unverändert und vorn')
const saele = mitKulisse.slice(3)
assert.deepEqual(saele.map((e) => e.date), ['2026-10-21', '2026-10-28', '2026-11-04'], 'je Woche ein Termin am Mittwoch')
assert.ok(saele.every((e) => e.platform === 'kino' && e.releaseType === 'movie'), 'Kino-Film')
assert.equal(new Set(mitKulisse.map((e) => e.id)).size, 6, 'Kennungen eindeutig')
assert.ok(saele.every((e) => e.releaseSlug === 's2' && e.titleId === 2), 'Vorlage ist der erste Termin ohne Staffelstart (nicht der erste, nicht der letzte)')
assert.ok(saele.every((e) => !('staffelstart' in e) && !('episode' in e) && !('episodeCount' in e) && !('time' in e)), 'kein Ring, keine Folge, keine Uhrzeit')
assert.deepEqual(saalKulisse([], wochen3), [], 'leerer Datensatz bleibt leer')
const nurStart = saalKulisse([tv(7, { staffelstart: true })], ['2026-10-19'])
assert.equal(nurStart.length, 2, 'nur Staffelstarts: der erste dient trotzdem als Vorlage')
assert.ok(!('staffelstart' in nurStart[1]), 'auch dann ohne Ring')
assert.equal(saalKulisse([tv(7, { releaseType: 'movie', platform: 'kino' })], ['2026-10-19', '2026-10-26']).length, 3, 'nur Filme: Vorlage ist der erste')

assert.equal(JSON.parse(kulisseAntwort('events.json', JSON.stringify(ohneKino), wochen3)).length, 6, 'events.json bekommt die Termine')
const fremd = Buffer.from(JSON.stringify([{ platform: 'adn' }]))
assert.equal(kulisseAntwort('titles-core.json', fremd, wochen3), fremd, 'andere Dateien bleiben unberührt')

// Schwebende Elemente (27.10.2026): fixed und sticky (der Kopf lag nach dem Sprung zu „heute“ im Ganzseitenbild über einer Kachelecke) werden versteckt und wieder gezeigt, Fließendes bleibt.
const lagen = ['fixed', 'sticky', 'static', 'relative', 'absolute'].map((position) => ({ position, style: { visibility: 'start' } }))
globalThis.document = { querySelectorAll: () => lagen }
globalThis.getComputedStyle = (el) => ({ position: el.position })
setzeSichtbarkeitSchwebender('hidden')
assert.deepEqual(lagen.map((e) => e.style.visibility), ['hidden', 'hidden', 'start', 'start', 'start'], 'fixed und sticky versteckt, sonst unberührt')
setzeSichtbarkeitSchwebender('')
assert.deepEqual(lagen.map((e) => e.style.visibility), ['', '', 'start', 'start', 'start'], 'beide wieder gezeigt')
delete globalThis.document
delete globalThis.getComputedStyle

console.log('kachel-ecken-messen.test: ok')
