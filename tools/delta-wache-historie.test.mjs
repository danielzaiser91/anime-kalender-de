/**
 * Die Delta-Wache meldet nur echte Verluste (19.10.2026): verworfene Historie-Zeilen zählen nicht, und Herabstufungen durch die
 * Kanal-Titel-Regel (11.10.2026) stehen als erklärt da, nicht als Verlust. Vier Fälle der Wache selbst (`tools/delta-pruefen.mjs`
 * als eigener Prozess, feste Uhr über `--jetzt`), dazu Vergleich und Zeilenhilfen einzeln.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findeAuffaelliges, kanalTitelMenge, kanalTitelSchluessel, messen } from '../pipeline/lib/bestand-delta.ts'
import { geltendeZeilen, letzteGeltende, letzteVerwerfen } from '../pipeline/lib/historie-zeilen.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const JETZT = '2026-10-20T08:00:00.000Z'
const STUNDE = (h) => new Date(Date.parse(JETZT) - h * 3600000).toISOString()

/** Kennzahlen mit Vorgaben; Prime-Ja zählt in `mitUrteil`, `verweise` und `jeAnbieter` mit. */
function kz(ueber = {}) {
  return {
    titel: 100,
    titelMitVerweis: 90,
    verweise: 200,
    mitUrteil: 150,
    ohneUrteil: 50,
    titelMitSynchro: 80,
    entferntProtokolliert: 10,
    entferntJeAnbieter: { primevideo: 4 },
    releases: 10,
    termine: 100,
    jeAnbieter: { primevideo: 60, netflix: 20 },
    kanalOhneUrteil: { primevideo: 5 },
    kanalTitelOhneSynchro: 2,
    ...ueber,
  }
}

// --- Vergleich einzeln ---------------------------------------------------------------------------------------------
{
  const a = findeAuffaelliges(kz(), kz())
  assert.deepEqual(a, { auffaellig: [], erklaert: [] }, 'gleiche Kennzahlen: nichts')

  // (ii) echte Abnahme ohne Erklärung: rot, mit der vollen Zahl.
  const verlust = findeAuffaelliges(kz({ mitUrteil: 144, jeAnbieter: { primevideo: 54, netflix: 20 }, titelMitSynchro: 77 }), kz())
  assert.deepEqual(verlust.auffaellig, ['6 Urteile verloren', '3 Titel ohne Synchro-Beleg', 'primevideo: 6 Synchro-Belege weniger'])
  assert.deepEqual(verlust.erklaert, [])

  // (iii) Abnahme nur durch Kanal-Titel: nicht rot, aber genannt (Verweise, Urteile, Titel je mit eigener Zahl).
  const nurKanal = findeAuffaelliges(
    kz({ mitUrteil: 143, jeAnbieter: { primevideo: 53, netflix: 20 }, titelMitSynchro: 77, kanalOhneUrteil: { primevideo: 12 }, kanalTitelOhneSynchro: 5 }),
    kz(),
  )
  assert.deepEqual(nurKanal.auffaellig, [])
  assert.deepEqual(nurKanal.erklaert, [
    '3 Titel ohne Synchro-Beleg, weil ihr Ja nur Amazons Sprachangabe auf einem Kanal-Titel war',
    'primevideo: 7 Synchro-Belege herabgestuft (Kanal-Titel, Amazons Sprachangabe)',
  ])

  // (iv) Mischung: 7 durch Kanal erklärt, 2 mehr weg -> rot mit genau 2; Titel: 1 erklärt (Zuwachs 1), 2 offen.
  const mix = findeAuffaelliges(
    kz({ mitUrteil: 141, jeAnbieter: { primevideo: 51, netflix: 20 }, titelMitSynchro: 77, kanalOhneUrteil: { primevideo: 12 }, kanalTitelOhneSynchro: 3 }),
    kz(),
  )
  assert.deepEqual(mix.auffaellig, [
    '2 Urteile verloren (7 weitere durch Kanal-Titel herabgestuft)',
    '2 Titel ohne Synchro-Beleg (1 weitere durch Kanal-Titel herabgestuft)',
    'primevideo: 2 Synchro-Belege weniger (7 weitere durch Kanal-Titel herabgestuft)',
  ])

  // Alte Vorgänger-Zeile ohne Kanal-Kennzahlen: nichts wird erklärt (sonst stünde der ganze Bestand als Zuwachs da).
  const alt = kz()
  delete alt.kanalOhneUrteil
  delete alt.kanalTitelOhneSynchro
  const ohneKennzahl = findeAuffaelliges(kz({ mitUrteil: 143, jeAnbieter: { primevideo: 53, netflix: 20 }, kanalOhneUrteil: { primevideo: 50 } }), alt)
  assert.deepEqual(ohneKennzahl.erklaert, [])
  assert.equal(ohneKennzahl.auffaellig.length, 2)

  // Genau 1 erklärt, Abnahme 1: kein Rot (Schwelle N > 0 mit N = 1).
  const eins = findeAuffaelliges(kz({ mitUrteil: 149, jeAnbieter: { primevideo: 59, netflix: 20 }, kanalOhneUrteil: { primevideo: 6 } }), kz())
  assert.deepEqual(eins.auffaellig, [])
  assert.deepEqual(eins.erklaert, ['primevideo: 1 Synchro-Belege herabgestuft (Kanal-Titel, Amazons Sprachangabe)'])

  // Kanal erklärt nur den eigenen Anbieter: Netflix-Abnahme bleibt rot.
  const fremd = findeAuffaelliges(kz({ mitUrteil: 148, jeAnbieter: { primevideo: 60, netflix: 18 }, kanalOhneUrteil: { primevideo: 9 } }), kz())
  assert.deepEqual(fremd.auffaellig, ['2 Urteile verloren', 'netflix: 2 Synchro-Belege weniger'])

  // Erste Zeile überhaupt: kein Vorgänger, kein Befund.
  assert.deepEqual(findeAuffaelliges(kz({ mitUrteil: 1 }), null), { auffaellig: [], erklaert: [] })

  // Altzeile ohne Kanal-Kennzahl und ein Titel weg: die Titelzeile bleibt rot (Kennzahl fehlt = nichts erklärt).
  const altTitel = findeAuffaelliges(kz({ titelMitSynchro: 79 }), alt)
  assert.deepEqual(altTitel.auffaellig, ['1 Titel ohne Synchro-Beleg'])

  // Genau 1 unerklärter Rest je Zeile bleibt rot (Schwelle N > 0 mit N = 1): Urteile, Titel, Anbieter.
  const rest1 = findeAuffaelliges(
    kz({ mitUrteil: 144, jeAnbieter: { primevideo: 54, netflix: 20 }, titelMitSynchro: 76, kanalOhneUrteil: { primevideo: 10 }, kanalTitelOhneSynchro: 5 }),
    kz(),
  )
  assert.deepEqual(rest1.auffaellig, [
    '1 Urteile verloren (5 weitere durch Kanal-Titel herabgestuft)',
    '1 Titel ohne Synchro-Beleg (3 weitere durch Kanal-Titel herabgestuft)',
    'primevideo: 1 Synchro-Belege weniger (5 weitere durch Kanal-Titel herabgestuft)',
  ])

  // Begründet entfernte Verweise (Gedächtnis) sind weiter kein Verlust, im Gesamten wie je Anbieter.
  const entfernt = findeAuffaelliges(
    kz({ mitUrteil: 145, entferntProtokolliert: 15, jeAnbieter: { primevideo: 55, netflix: 20 }, entferntJeAnbieter: { primevideo: 9 } }),
    kz(),
  )
  assert.deepEqual(entfernt, { auffaellig: [], erklaert: [] })
}

// --- messen: der Zähler, den der Vergleich braucht -----------------------------------------------------------------------
{
  const s = (platform, dub) => ({ platform, url: `https://example.test/${platform}`, ...(dub === undefined ? {} : { dub }) })
  const titel = [
    // 900001: kein Ja, Kanal-Beleg auf Prime -> Verweis und Titel zählen (die Adresse spielt keine Rolle: JustWatch ersetzt sie).
    { id: 900001, streams: [s('primevideo')] },
    // 900002: Kanal-Prime-Verweis ohne Ja, aber ein Ja bei Netflix -> nur der Verweis zählt, nicht der Titel.
    { id: 900002, streams: [s('primevideo'), s('netflix', true)] },
    // 900003: Prime-Ja trotz Kanal-Beleg (zweite Quelle) -> zählt nicht.
    { id: 900003, streams: [s('primevideo', true)] },
    // 900004: Kanal-Beleg gilt für Prime, der Netflix-Verweis ohne Ja bleibt unberührt.
    { id: 900004, streams: [s('netflix')] },
    // 900005: Prime-Nein (dub false) bei einem Kanal-Titel ohne Ja zählt wie jeder Verweis ohne Ja.
    { id: 900005, streams: [s('primevideo', false)] },
  ]
  const kanal = new Set([900001, 900002, 900003, 900004, 900005].map((id) => kanalTitelSchluessel(id, 'primevideo')))
  const ohne = messen({ titel, releases: [], termine: [], entfernt: {}, kanal: new Set() })
  assert.deepEqual(ohne.kanalOhneUrteil, {})
  assert.equal(ohne.kanalTitelOhneSynchro, 0)
  const mit = messen({ titel, releases: [], termine: [], entfernt: {}, kanal })
  assert.deepEqual(mit.kanalOhneUrteil, { primevideo: 3 })
  assert.equal(mit.kanalTitelOhneSynchro, 2)

  const beleg = (anilistId, platform, extra = {}) => ({ anilistId, platform, ...extra })
  assert.deepEqual(
    [...kanalTitelMenge([beleg(1, 'primevideo', { kanalOhneBeleg: true }), beleg(2, 'primevideo', { kanalOhneBeleg: true, dub: true }), beleg(3, 'primevideo'), beleg(4, 'netflix', { kanalOhneBeleg: true })])],
    ['1|primevideo', '4|netflix'],
    'nur Belege mit weggelassener Kanal-Angabe und ohne Ja',
  )
}

// --- Zeilenhilfen: Fallliste für eine geteilte Handdatei (nie Zeilen löschen) -------------------------------------------
{
  const z = (n, extra = {}) => JSON.stringify({ n, ...extra })
  const text = [z(1), 'kaputt {', z(2, { laufId: 'A' })].join('\n') + '\n'

  assert.equal(letzteVerwerfen('', 'A'), '', 'leere Datei bleibt leer')
  assert.equal(letzteVerwerfen('\n\n'), '\n\n', 'nur Leerzeilen')
  assert.equal(letzteVerwerfen('nur kaputt\n', 'A'), 'nur kaputt\n', 'nichts Lesbares')
  assert.equal(letzteVerwerfen('[1]\n"text"\n', 'A'), '[1]\n"text"\n', 'JSON ohne Objekt ist keine Historie-Zeile')
  assert.equal(letzteVerwerfen('[1]\n"text"\n'), '[1]\n"text"\n', 'auch ohne Lauf-Kennung')
  const bereits = '{"n": 1,   "verworfen": true}\n'
  assert.equal(letzteVerwerfen(bereits), bereits, 'schon verworfene Zeile bleibt Byte für Byte, auch mit fremder Formatierung')

  const neu = letzteVerwerfen(text, 'A')
  assert.deepEqual(neu.split('\n'), [z(1), 'kaputt {', z(2, { laufId: 'A', verworfen: true }), ''], 'nur die letzte lesbare Zeile; Unlesbares bleibt Byte für Byte')
  assert.equal(letzteVerwerfen(neu, 'A'), neu, 'zweiter Lauf: schon verworfen, keine weitere Zeile')
  assert.equal(letzteVerwerfen(text, 'B'), text, 'Zeile eines anderen Laufs bleibt (data:historie war gescheitert)')
  assert.equal(letzteVerwerfen(z(3, { verworfen: false }) + '\n', undefined).includes('"verworfen":true'), true, 'ohne Lauf-Kennung gilt die letzte Zeile')

  assert.deepEqual(geltendeZeilen(neu).map((x) => x.n), [1], 'verworfene und kaputte Zeilen zählen nicht')
  assert.equal(letzteGeltende(neu).n, 1, 'Vorgänger ist die letzte geltende Zeile')
  assert.equal(letzteGeltende(''), null)
}

// --- Die Wache selbst (eigener Prozess, feste Uhr) -----------------------------------------------------------------------
function wache(zeilen) {
  const ordner = mkdtempSync(join(tmpdir(), 'delta-wache-historie-'))
  try {
    mkdirSync(join(ordner, 'data'))
    writeFileSync(join(ordner, 'data/bestand-historie.jsonl'), zeilen.map((x) => JSON.stringify(x)).join('\n') + '\n')
    const r = spawnSync(process.execPath, [join(wurzel, 'tools/delta-pruefen.mjs'), '--tage', '1', '--jetzt', JETZT], { cwd: ordner, encoding: 'utf8', windowsHide: true })
    return { code: r.status, text: r.stdout + r.stderr }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
const zeile = (h, kennzahlen, extra = {}) => ({ zeitpunkt: STUNDE(h), lauf: 'test', ...kennzahlen, ...extra })
const rotAus = (v) => findeAuffaelliges(v, kz()).auffaellig

{
  const stand = kz()
  const niedrig = kz({ mitUrteil: 100, titelMitSynchro: 60, jeAnbieter: { primevideo: 20, netflix: 20 } })
  // (i) Verworfene Zeile dazwischen: Ihre Auffälligkeit (und die Rückkehr danach) darf die Wache nicht rot machen.
  const i = wache([zeile(5, stand), zeile(4, niedrig, { verworfen: true, auffaellig: ['50 Urteile verloren'] }), zeile(3, stand)])
  assert.equal(i.code, 0, `(i) verworfene Zeile dazwischen: ${i.text}`)
  assert.match(i.text, /2 Läufe in den letzten 1 Tagen/, '(i) die verworfene Zeile ist nicht mitgezählt')

  // Gegenprobe zu (i): dieselbe Zeile ohne Markierung ist rot.
  const i2 = wache([zeile(5, stand), zeile(4, niedrig, { auffaellig: ['50 Urteile verloren'] }), zeile(3, stand)])
  assert.equal(i2.code, 1, '(i) ohne Markierung rot')

  // (ii) echte Abnahme ohne Erklärung: rot.
  const ii = wache([zeile(2, kz({ mitUrteil: 144 }), { auffaellig: rotAus(kz({ mitUrteil: 144 })) })])
  assert.equal(ii.code, 1, `(ii) ${ii.text}`)
  assert.match(ii.text, /6 Urteile verloren/)

  // (iii) nur Kanal-Titel: Zeile mit erklaert, ohne auffaellig -> Exit 0, aber genannt.
  const nurKanal = kz({ mitUrteil: 143, jeAnbieter: { primevideo: 53, netflix: 20 }, kanalOhneUrteil: { primevideo: 12 } })
  const b = findeAuffaelliges(nurKanal, kz())
  const iii = wache([zeile(2, nurKanal, { auffaellig: b.auffaellig.length ? b.auffaellig : undefined, erklaert: b.erklaert })])
  assert.equal(iii.code, 0, `(iii) ${iii.text}`)
  assert.match(iii.text, /erklärt, nicht rot: primevideo: 7 Synchro-Belege herabgestuft/)

  // (iv) Mischung: rot mit genau dem unerklärten Rest, die Erklärung steht daneben.
  const gemischt = kz({ mitUrteil: 141, jeAnbieter: { primevideo: 51, netflix: 20 }, kanalOhneUrteil: { primevideo: 12 } })
  const m = findeAuffaelliges(gemischt, kz())
  const iv = wache([zeile(2, gemischt, { auffaellig: m.auffaellig, erklaert: m.erklaert })])
  assert.equal(iv.code, 1, `(iv) ${iv.text}`)
  assert.match(iv.text, /2 Urteile verloren \(7 weitere durch Kanal-Titel herabgestuft\)/)
  assert.match(iv.text, /primevideo: 2 Synchro-Belege weniger/)

  // Eine Auffälligkeit außerhalb der 24 Stunden (30 h vor `--jetzt`) färbt nicht mehr rot.
  const alt = wache([zeile(30, niedrig, { auffaellig: ['50 Urteile verloren'] }), zeile(2, stand)])
  assert.equal(alt.code, 0, `30 h alte Auffälligkeit: ${alt.text}`)

  // Alles verworfen: kein Absturz, kein Rot.
  const leer = wache([zeile(2, niedrig, { verworfen: true, auffaellig: ['x'] })])
  assert.equal(leer.code, 0, `alles verworfen: ${leer.text}`)
}

// --- Der Schreiber `pipeline/bestand-historie.ts` als Prozess gegen eine Kulisse (AK_ROOT) --------------------------------------
const EIN_TITEL = [{ id: 900001, streams: [{ platform: 'netflix', url: 'https://example.test/n', dub: true }] }]
function schreiber(vorher, modus, env = {}, { titel = EIN_TITEL, belege = '' } = {}) {
  const ordner = mkdtempSync(join(tmpdir(), 'bestand-historie-'))
  try {
    mkdirSync(join(ordner, 'data'))
    mkdirSync(join(ordner, 'public/data'), { recursive: true })
    if (belege) writeFileSync(join(ordner, 'data/dub-confirmed.yaml'), belege)
    writeFileSync(join(ordner, 'public/data/titles.json'), JSON.stringify(titel))
    writeFileSync(join(ordner, 'public/data/releases.json'), '[]')
    writeFileSync(join(ordner, 'public/data/events.json'), '[]')
    const datei = join(ordner, 'data/bestand-historie.jsonl')
    writeFileSync(datei, vorher.map((x) => JSON.stringify(x)).join('\n') + (vorher.length ? '\n' : ''))
    const r = spawnSync(process.execPath, [join(wurzel, 'pipeline/bestand-historie.ts'), ...modus], {
      env: { ...process.env, AK_ROOT: ordner, GITHUB_RUN_ID: '', ...env },
      encoding: 'utf8',
      windowsHide: true,
    })
    assert.equal(r.status, 0, r.stderr)
    return readFileSync(datei, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
{
  const stand = { zeitpunkt: STUNDE(9), titel: 1, titelMitVerweis: 1, verweise: 1, mitUrteil: 1, ohneUrteil: 0, titelMitSynchro: 1, entferntProtokolliert: 0, releases: 0, termine: 0, jeAnbieter: { netflix: 1 } }
  const meins = { ...stand, zeitpunkt: STUNDE(8), laufId: 'R1', titel: 5, verweise: 5, mitUrteil: 5, titelMitSynchro: 5, jeAnbieter: { netflix: 5 } }

  const normal = schreiber([stand], [])
  assert.equal(normal.length, 2)
  assert.equal(normal[1].verworfen, undefined)
  assert.equal(normal[1].delta.titel, 0, 'Vergleich gegen die geltende Vorzeile')

  // Verworfene Vorzeile ist kein Vorgänger: Der Vergleich geht gegen `stand`, nicht gegen die 5 Titel der verworfenen Zeile.
  const nachVerworfener = schreiber([stand, { ...meins, verworfen: true }], [])
  assert.equal(nachVerworfener.length, 3)
  assert.equal(nachVerworfener[2].delta.titel, 0)
  assert.equal(nachVerworfener[2].auffaellig, undefined)

  // --ersetzen: die eigene Zeile (gleiche Lauf-Kennung) wird verworfen, die neue Zeile vergleicht gegen die Zeile davor.
  const ersetzt = schreiber([stand, meins], ['--ersetzen'], { GITHUB_RUN_ID: 'R1' })
  assert.equal(ersetzt.length, 3)
  assert.equal(ersetzt[1].verworfen, true)
  assert.equal(ersetzt[2].verworfen, undefined)
  assert.equal(ersetzt[2].delta.titel, 0)
  assert.equal(ersetzt[2].auffaellig, undefined, 'der verworfene Stand erzeugt keine Auffälligkeit in der neuen Zeile')

  // --verwerfen: nur markieren, nichts anhängen.
  const verworfen = schreiber([stand, meins], ['--verwerfen'], { GITHUB_RUN_ID: 'R1' })
  assert.equal(verworfen.length, 2)
  assert.equal(verworfen[1].verworfen, true)
  assert.equal(verworfen[0].verworfen, undefined)

  // Zeile eines anderen Laufs bleibt, auch bei --ersetzen (data:historie war in diesem Lauf gescheitert): neue Zeile kommt trotzdem.
  const fremd = schreiber([stand, meins], ['--ersetzen'], { GITHUB_RUN_ID: 'R2' })
  assert.equal(fremd.length, 3)
  assert.equal(fremd[1].verworfen, undefined)
  assert.ok(fremd[2].auffaellig?.length, 'gegen die fremde, geltende Zeile gemessen: Abnahme steht da')

  // Die Lauf-Kennung wandert in die Zeile, und derselbe Lauf kann sie danach verwerfen.
  const gemessen = schreiber([stand], [], { GITHUB_RUN_ID: 'R7' })
  assert.equal(gemessen[1].laufId, 'R7')
  assert.equal(schreiber(gemessen, ['--verwerfen'], { GITHUB_RUN_ID: 'R7' })[1].verworfen, true)

  // Kanal-Titel-Beleg aus data/dub-confirmed.yaml: Zähler und Erklärung kommen durch den echten Lader bis in die Zeile.
  const beleg = [
    '- anilistId: 900001',
    '  title: "Kanal-Probe"',
    '  platform: primevideo',
    '  url: https://www.amazon.de/gp/video/detail/B0KANAL001',
    '  dub: true',
    "  checkedAt: '2026-10-19'",
    '  note: "Tonspuren: Deutsch — Amazon-Seite B0KANAL001: Film geprüft — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg"',
    '',
  ].join('\n')
  const prime = (id, dub) => ({ id, streams: [{ platform: 'primevideo', url: `https://www.amazon.de/gp/video/detail/B0KANAL00${id % 10}`, ...(dub ? { dub: true } : {}) }] })
  const vorKanal = { ...stand, titel: 2, verweise: 2, mitUrteil: 2, titelMitSynchro: 2, jeAnbieter: { primevideo: 2 }, kanalOhneUrteil: { primevideo: 0 }, kanalTitelOhneSynchro: 0 }
  const kanal = schreiber([vorKanal], [], {}, { titel: [prime(900001, false), prime(900002, true)], belege: beleg })
  assert.deepEqual(kanal[1].kanalOhneUrteil, { primevideo: 1 })
  assert.equal(kanal[1].kanalTitelOhneSynchro, 1)
  assert.equal(kanal[1].auffaellig, undefined)
  assert.deepEqual(kanal[1].erklaert, [
    '1 Titel ohne Synchro-Beleg, weil ihr Ja nur Amazons Sprachangabe auf einem Kanal-Titel war',
    'primevideo: 1 Synchro-Belege herabgestuft (Kanal-Titel, Amazons Sprachangabe)',
  ])
  const ohneBeleg = schreiber([vorKanal], [], {}, { titel: [prime(900001, false), prime(900002, true)] })
  assert.ok(ohneBeleg[1].auffaellig?.length, 'ohne den Kanal-Beleg steht dieselbe Abnahme als Verlust da')

  // Leere Historie: --verwerfen legt nichts an.
  assert.deepEqual(schreiber([], ['--verwerfen']), [])
}

console.log('delta-wache-historie.test: Vergleich (4 Fälle, erste Zeile, Altzeile ohne Kennzahl, Rest 1, Gedächtnis, Fremdanbieter), messen, Zeilenhilfen (9 Fälle), Wache als Prozess (i)–(iv), 30 h alt, alles verworfen, Schreiber als Prozess (9 Fälle mit Kanal-Lader und Lauf-Kennung) grün')
