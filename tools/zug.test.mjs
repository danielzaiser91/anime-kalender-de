/**
 * Tests für tools/zug.mjs und tools/zug-trocken.mjs. Erwartete Werte (Zug-Größe 16, Ratschen-Zahlen, Befehle) stehen fest hier, nicht aus dem Modul.
 * Ratschen-Zeilen wörtlich aus den roten Läufen vom 05./06.11.2026 (daniel-zum-abarbeiten/berichte/rot-nach-gruen-2026-11-06.md).
 * Kreislauf: Fahrt rot → Schuldsuche → Revert → nächste Fahrt, mit einem Orakel statt echter Ketten.
 */
import { basisGrenzen, basisRef, bauUndDeployBefehle, fahrtLog, fahrtSchritt, ketteArt, ratschenZustand, ffEntscheidung, halbierungVersuch, halbierungWeiter, ratschenFall, ratschenMeldung, revertPlan, schuldsuche, sperrGruende, verdaechtige, zugEintraege, zugPlan, zurueckholen } from './zug.mjs'
import { logJobs, trocken } from './zug-trocken.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const T0 = Date.parse('2026-11-06T10:00:00Z')
const min = (m) => new Date(T0 + m * 60000).toISOString()
const kopfVon = (nr) => `${String(nr).padStart(2, '0')}b2c3d4e5f60718293a4b5c6d7e8f9012345678`.slice(0, 40)
const GRUEN = [{ name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: min(0) }]
const ROT = [{ name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'FAILURE', completedAt: min(0) }]
const OFFEN = [{ name: 'PR-Prüfkette', status: 'IN_PROGRESS', conclusion: '', completedAt: '0001-01-01T00:00:00Z', startedAt: min(0) }]
const urteil = (nr, minute, art = 'ok') => ({ author: { login: 'github-actions' }, createdAt: min(minute), body: `**Prüfer-Review** für ${kopfVon(nr).slice(0, 9)} - Urteil: **${art}**\n\nText` })
const pr = (nr, minute, extra = {}) => ({ number: nr, title: `PR ${nr}`, headRefOid: kopfVon(nr), kopfZeit: T0 - 3600000, isDraft: false, mergeable: 'MERGEABLE', statusCheckRollup: GRUEN, comments: [urteil(nr, minute)], ...extra })

console.log('sperrGruende: jede Sperre allein')
pruefe('freigegeben → keine Gründe', gleich(sperrGruende(pr(1, 5)), []))
pruefe('Entwurf', gleich(sperrGruende(pr(1, 5, { isDraft: true })), ['Entwurf']))
pruefe('Konflikt', gleich(sperrGruende(pr(1, 5, { mergeable: 'CONFLICTING' })), ['Konflikt']))
pruefe('UNKNOWN zählt nicht als Konflikt', gleich(sperrGruende(pr(1, 5, { mergeable: 'UNKNOWN' })), []))
pruefe('Kette rot', gleich(sperrGruende(pr(1, 5, { statusCheckRollup: ROT })), ['Kette rot']))
pruefe('Kette offen (Lauf läuft, completedAt 0001-01-01)', gleich(sperrGruende(pr(1, 5, { statusCheckRollup: OFFEN })), ['Kette offen']))
pruefe('kein Urteil', gleich(sperrGruende(pr(1, 5, { comments: [] })), ['kein Urteil auf dem Kopf']))
pruefe('Urteil für einen alten Kopf zählt nicht', gleich(sperrGruende(pr(1, 5, { comments: [urteil(2, 5)] })), ['kein Urteil auf dem Kopf']))
pruefe('Prüfer: ändern', gleich(sperrGruende(pr(1, 5, { comments: [urteil(1, 5, 'aendern')] })), ['Prüfer: ändern']))
pruefe('Ändern, danach Ok auf demselben Kopf (Nachtrag-Ablauf) → frei', gleich(sperrGruende(pr(1, 5, { comments: [urteil(1, 5, 'aendern'), urteil(1, 9)] })), []))
pruefe('Ok, danach Ändern auf demselben Kopf → gesperrt', gleich(sperrGruende(pr(1, 5, { comments: [urteil(1, 5), urteil(1, 9, 'aendern')] })), ['Prüfer: ändern']))
pruefe('zwei Gründe zugleich', gleich(sperrGruende(pr(1, 5, { isDraft: true, statusCheckRollup: ROT })), ['Entwurf', 'Kette rot']))

console.log('zugPlan: Reihenfolge, Größe, schon im Zug')
const frei = [pr(30, 20), pr(10, 20), pr(20, 5), pr(40, 50)]
pruefe('früheste Freigabe zuerst, bei Gleichstand die kleinere Nummer', gleich(zugPlan(frei).aufnehmen.map((a) => a.nr), [20, 10, 30, 40]))
const viele = Array.from({ length: 18 }, (_, i) => pr(100 + i, i))
const p16 = zugPlan(viele)
pruefe('Standardgröße 16: genau 16 aufgenommen, 2 warten', p16.aufnehmen.length === 16 && gleich(p16.zurueck.map((z) => z.nr), [116, 117]) && p16.zurueck[0].gruende[0] === 'Zug voll', p16)
pruefe('max 17: 17 aufgenommen, einer wartet', zugPlan(viele, { max: 17 }).aufnehmen.length === 17 && zugPlan(viele, { max: 17 }).zurueck.length === 1)
pruefe('max 18: alle', zugPlan(viele, { max: 18 }).zurueck.length === 0)
pruefe('Zug schon über max (4 drin, max 3): nichts aufnehmen, alle warten', zugPlan([pr(1, 1), pr(2, 2)], { max: 3, imZug: [7, 8, 9, 10] }).aufnehmen.length === 0 && zugPlan([pr(1, 1), pr(2, 2)], { max: 3, imZug: [7, 8, 9, 10] }).zurueck.length === 2)
const mitZug = zugPlan(viele, { max: 16, imZug: [100, 101, 102] })
pruefe('im Zug: zählt gegen max, kommt nicht doppelt', mitZug.aufnehmen.length === 13 && !mitZug.aufnehmen.some((a) => [100, 101, 102].includes(a.nr)) && !mitZug.zurueck.some((z) => [100, 101, 102].includes(z.nr)), mitZug.aufnehmen.length)
pruefe('voller Zug: nichts aufnehmen', zugPlan(viele, { max: 3, imZug: [100, 101, 102] }).aufnehmen.length === 0)
pruefe('gesperrte PRs stehen mit Grund unter zurueck', gleich(zugPlan([pr(5, 1, { isDraft: true }), pr(6, 2)]).zurueck, [{ nr: 5, gruende: ['Entwurf'] }]))
pruefe('Freigabe zählt vom jüngsten Ok (spätes Ok nach frühem Ok)', gleich(zugPlan([pr(7, 1, { comments: [urteil(7, 1), urteil(7, 90)] }), pr(8, 50)]).aufnehmen.map((a) => a.nr), [8, 7]))
pruefe('Freigabe zählt vom Ok nach dem Ändern, nicht vom ersten Urteil', gleich(zugPlan([pr(7, 1, { comments: [urteil(7, 1, 'aendern'), urteil(7, 90)] }), pr(8, 50)]).aufnehmen.map((a) => a.nr), [8, 7]))

console.log('zugEintraege: echte Betreffzeilen')
const LOG = [
  '\x01aaaa111\tbbbb222 cccc333\tMerge pull request #2757 from danielzaiser91/ci/workflows-pruefung\ntools/a.mjs\n.github/workflows/pr-pruefung.yml\n',
  '\x01dddd444\teeee555\tCI: Tests der Workflows-Prüfung auf zwei Kettenjobs teilen (#2764)\ntools/b.mjs\n',
  "\x01ffff666\tgggg777 hhhh888\tMerge branch 'main' into zug\n",
].join('')
const eint = zugEintraege(LOG)
pruefe('drei Einträge, neuester zuerst', eint.length === 3 && eint[0].sha === 'aaaa111')
pruefe('Merge-Commit: Nummer, zwei Eltern, Dateien', eint[0].nr === 2757 && eint[0].eltern === 2 && gleich(eint[0].dateien, ['tools/a.mjs', '.github/workflows/pr-pruefung.yml']), eint[0])
pruefe('Squash-Commit: Nummer aus (#N), ein Elternteil', eint[1].nr === 2764 && eint[1].eltern === 1 && gleich(eint[1].dateien, ['tools/b.mjs']), eint[1])
pruefe('Main-Merge ohne Nummer: nr null, keine Dateien', eint[2].nr === null && eint[2].eltern === 2 && eint[2].dateien.length === 0, eint[2])
pruefe('leeres Log → keine Einträge', zugEintraege('').length === 0)

console.log('revertPlan')
const ZUG = [
  { sha: 'c3', eltern: 2, nr: 3, titel: 't3', dateien: ['x.ts', 'z.ts'] },
  { sha: 'c2', eltern: 1, nr: 2, titel: 't2', dateien: ['y.ts'] },
  { sha: 'm1', eltern: 2, nr: null, titel: "Merge branch 'main' into zug", dateien: [] },
  { sha: 'c1', eltern: 2, nr: 1, titel: 't1', dateien: ['x.ts'] },
]
const rp = revertPlan(ZUG, [1, 3])
pruefe('neuester zuerst, Merge-Commits mit -m 1', gleich(rp.befehle.map((b) => b.befehl), ['git revert --no-edit -m 1 c3', 'git revert --no-edit -m 1 c1']), rp.befehle)
pruefe('Risiko: PR 1 wird von PR 3 überlagert (gleiche Datei x.ts), PR 3 nicht', gleich(rp.befehle.map((b) => b.risiko), [[], [3]]), rp.befehle)
pruefe('Squash-Commit ohne -m', revertPlan(ZUG, [2]).befehle[0].befehl === 'git revert --no-edit c2')
pruefe('Nummer nicht im Zug → fehlt, kein Befehl', gleich(revertPlan(ZUG, [2, 99]).fehlt, [99]) && revertPlan(ZUG, [99]).befehle.length === 0)
pruefe('Main-Merge wird nie zurückgenommen', revertPlan(ZUG, [1, 2, 3]).befehle.length === 3)

console.log('Ratschen: wörtliche Meldungen')
const COVER = '471 Titel mit Cover zeigen das Standardbild, erlaubt höchstens 449'
const UMFANG = '  pipeline: Überlänge der funktionen 8986 statt höchstens 8964'
const BUDGET = 'start-budget: 250.2 KB gzip, 0.2 KB über der Grenze von 250.0 KB (index 120.1)'
pruefe('Cover', gleich(ratschenMeldung(COVER), { name: 'cover-standardbild', wert: 471, grenze: 449 }))
pruefe('Umfang', gleich(ratschenMeldung(UMFANG), { name: 'umfang', wert: 8986, grenze: 8964, schluessel: 'umfang:pipeline:funktionen' }))
pruefe('Umfang je Bereich und Art: web/src dateien', gleich(ratschenMeldung('web/src: Überlänge der dateien 300 statt höchstens 295'), { name: 'umfang', wert: 300, grenze: 295, schluessel: 'umfang:web/src:dateien' }))
pruefe('Umfang Ketten', gleich(ratschenMeldung('shared: Ketten (mehrere Anweisungen/Felder/Einträge in einer Zeile) 37 statt höchstens 36'), { name: 'umfang', wert: 37, grenze: 36, schluessel: 'umfang:shared:ketten' }))
pruefe('Cover aus der Bestandsprüfung („als Link-Vorschau“)', gleich(ratschenMeldung('171 Titel mit Cover zeigen das Standardbild als Link-Vorschau, erlaubt höchstens 170 (jüngste Kennungen: 9)'), { name: 'cover-standardbild', wert: 171, grenze: 170 }))
pruefe('Start-Budget', gleich(ratschenMeldung(BUDGET), { name: 'start-budget', wert: 250.2, grenze: 250 }))
pruefe('andere Meldung → null', ratschenMeldung('FEHL Fortsetzungsseite (nach > 0): auch ohne COUNT(*)') === null && ratschenMeldung('') === null)
pruefe('wert ≤ Grenze → ok', ratschenFall({ wert: 449, grenze: 449 }, 500) === 'ok')
pruefe('eins über der Grenze, Basisgrenze hält → ratsche', ratschenFall({ wert: 450, grenze: 449 }, 450) === 'ratsche')
pruefe('eins über der Basisgrenze → zug', ratschenFall({ wert: 451, grenze: 449 }, 450) === 'zug')
pruefe('Basisgrenze unbekannt → ratsche-pruefen', ratschenFall({ wert: 450, grenze: 449 }, null) === 'ratsche-pruefen' && ratschenFall({ wert: 450, grenze: 449 }, undefined) === 'ratsche-pruefen')

console.log('verdaechtige: Job und Dateien')
const PRS = [
  { nr: 1, dateien: ['.github/workflows/a.yml'] },
  { nr: 2, dateien: ['web/src/App.tsx'] },
  { nr: 3, dateien: [['data', 'x.yaml'].join('/')] },
  { nr: 4, dateien: ['docs/wissen/betrieb.md'] },
]
pruefe('Workflows-Job → Workflow- und Tools-Dateien', gleich(verdaechtige(PRS, [{ name: 'Kette – Workflows 2' }]), [1]))
pruefe('Aussehen-Job → web/', gleich(verdaechtige(PRS, [{ name: 'PR-Aussehen – Panel' }]), [2]))
pruefe('Daten-Job → Datenordner', gleich(verdaechtige(PRS, [{ name: 'Kette – Daten, Erweiterung, Belege' }]), [3]))
pruefe('Job ohne Eingrenzung (Bau) → alle', gleich(verdaechtige(PRS, [{ name: 'Kette – Bau und Installation' }]), [1, 2, 3, 4]))
pruefe('zwei Jobs, einer ohne Eingrenzung → alle', gleich(verdaechtige(PRS, [{ name: 'Kette – Workflows' }, { name: 'Kette – Logik' }]), [1, 2, 3, 4]))
pruefe('zwei eingegrenzte Jobs → Vereinigung', gleich(verdaechtige(PRS, [{ name: 'Kette – Workflows' }, { name: 'PR-Aussehen – x' }]), [1, 2]))
pruefe('kein Job → alle', gleich(verdaechtige(PRS, []), [1, 2, 3, 4]))
pruefe('ein PR mit zwei Dateien, nur eine passt → Verdächtiger', gleich(verdaechtige([{ nr: 1, dateien: ['docs/a.md', 'tools/a.mjs'] }], [{ name: 'Kette – Workflows' }]), [1]))
// Tabelle: Job → Dateien, die ihn färben können (Ja) bzw. nicht (Nein); jede Alternative der Heuristik hat einen Fall.
const DATEN = ['data', 'x.yaml'].join('/')
const TABELLE = [
  ['Kette – Workflows', ['.github/workflows/a.yml', 'tools/a.mjs'], ['web/src/a.tsx', DATEN, 'docs/a.md']],
  ['Kette – Workflows 2', ['.github/actions/a.yml', 'tools/a.test.mjs'], ['worker/a.ts', 'docs/a.md']],
  ['Kette – Typen und Worker', ['worker/a.ts', 'shared/a.ts', 'tools/a.ts', 'pipeline/a.ts', 'web/src/a.tsx', 'tsconfig.json'], ['docs/a.md', DATEN, 'extension/a.js']],
  ['PR-Aussehen – Panel', ['web/a.tsx', 'tools/ansicht-bild.mjs', 'docs/ansicht-a.png'], ['pipeline/a.ts', 'docs/wissen/a.md', 'worker/a.ts']],
  ['Kette – Daten, Erweiterung, Belege', [DATEN, 'extension/a.js', 'pipeline/a.ts', 'tools/a.mjs'], ['web/src/a.tsx', 'docs/a.md', 'worker/a.ts']],
]
for (const [job, ja, nein] of TABELLE) {
  for (const d of ja) pruefe(`${job}: ${d} kommt in Frage`, gleich(verdaechtige([{ nr: 1, dateien: [d] }], [{ name: job }]), [1]))
  for (const d of nein) pruefe(`${job}: ${d} kommt nicht in Frage`, gleich(verdaechtige([{ nr: 1, dateien: [d] }], [{ name: job }]), []))
}

console.log('schuldsuche: Reihenfolge der Prüfungen')
const jobBau = (meldung) => ({ name: 'Kette – Bau und Installation', meldung })
const JOBS_ROT = { jobs: [{ name: 'Kette – Workflows', meldung: 'FEHL irgendwas' }] }
const s0 = (extra) => schuldsuche({ zugPrs: PRS, fehlschlag: JOBS_ROT, mainAllein: 'gruen', ...extra })
pruefe('main allein rot → main, nichts zurücknehmen', gleich(s0({ mainAllein: 'rot' }), { art: 'main' }))
pruefe('main rot schlägt auch eine Ratsche', s0({ mainAllein: 'rot', fehlschlag: { jobs: [jobBau(UMFANG)] } }).art === 'main')
pruefe('Ratsche, Basisgrenze hält → ratsche (Anlass 4 von 7 Rot-nach-Grün-Köpfen)', gleich(s0({ fehlschlag: { jobs: [jobBau(UMFANG)] }, grenzeBasis: { umfang: 8986 } }), { art: 'ratsche', ratsche: 'umfang', fall: 'ratsche', job: 'Kette – Bau und Installation' }))
pruefe('Ratsche, Basisgrenze unbekannt → ratsche, fall ratsche-pruefen', s0({ fehlschlag: { jobs: [jobBau(COVER)] } }).fall === 'ratsche-pruefen')
pruefe('Ratsche eingehalten (Wert = Grenze) → keine Ratsche, weiter zur Suche', s0({ fehlschlag: { jobs: [jobBau('pipeline: Überlänge der funktionen 8964 statt höchstens 8964')] }, grenzeBasis: { umfang: 9000 } }).art === 'halbieren')
pruefe('Ratsche vom Zug selbst gerissen → keine Ratsche, weiter zur Suche', s0({ fehlschlag: { jobs: [jobBau(UMFANG)] }, grenzeBasis: { umfang: 8970 } }).art === 'halbieren')
pruefe('Ratsche steht in einem von zwei Jobs → trotzdem ratsche', s0({ fehlschlag: { jobs: [{ name: 'Kette – Workflows', meldung: 'x' }, jobBau(COVER)] }, grenzeBasis: { 'cover-standardbild': 480 } }).art === 'ratsche')
pruefe('genau ein Verdächtiger nach Job und Dateien → pr', gleich(s0({}), { art: 'pr', nr: 1, wie: 'job+dateien' }))
pruefe('mehrere Verdächtige → halbieren über sie, der Rest bleibt', gleich(s0({ fehlschlag: { jobs: [{ name: 'Kette – Typen und Worker', meldung: 'x' }, { name: 'PR-Aussehen – a', meldung: 'y' }] }, zugPrs: [{ nr: 1, dateien: ['worker/a.ts'] }, { nr: 2, dateien: ['web/src/b.tsx'] }, { nr: 3, dateien: ['docs/c.md'] }] }).zustand, { bleibt: [3], verdacht: [1, 2], draussen: [] }))
pruefe('kein Verdächtiger passt → alle werden halbiert', gleich(s0({ fehlschlag: JOBS_ROT, zugPrs: [{ nr: 4, dateien: ['docs/a.md'] }, { nr: 5, dateien: ['docs/b.md'] }] }).zustand, { bleibt: [], verdacht: [4, 5], draussen: [] }))
pruefe('ausgeschlossen: vergeblich zurückgenommener PR kommt nicht wieder in Frage, Eingrenzung entfällt', gleich(s0({ ausgeschlossen: [1] }).zustand, { bleibt: [], verdacht: [2, 3, 4], draussen: [] }))
const DREI = [{ nr: 1, dateien: ['tools/a.mjs'] }, { nr: 2, dateien: ['tools/b.mjs'] }, { nr: 3, dateien: ['docs/c.md'] }]
pruefe('Eingrenzung vor dem Verdacht: Workflows-Job nennt 1 und 2 → Halbierung nur über sie', gleich(s0({ zugPrs: DREI }).zustand, { bleibt: [3], verdacht: [1, 2], draussen: [] }))
pruefe('nach vergeblichem Verdacht auf 1 gilt die Eingrenzung nicht mehr: Halbierung über 2 und 3', gleich(s0({ zugPrs: DREI, ausgeschlossen: [1] }).zustand, { bleibt: [], verdacht: [2, 3], draussen: [] }))
pruefe('ausgeschlossen: bleibt nur einer übrig → er wird zum Verdächtigen', gleich(s0({ ausgeschlossen: [1, 2, 3] }), { art: 'pr', nr: 4, wie: 'job+dateien' }))

console.log('Halbierung: jeder Schuldige, jede Zuggröße')
function suche(n, schuldig) {
  let z = { bleibt: [], verdacht: Array.from({ length: n }, (_, i) => i + 1), draussen: [] }
  let versuche = 0
  for (;;) {
    const v = halbierungVersuch(z)
    if (v.schuldig !== undefined) return { schuldig: v.schuldig, versuche }
    versuche += 1
    z = halbierungWeiter(z, !v.zug.includes(schuldig))
  }
}
let allesRichtig = true
let zuViele = null
for (let n = 1; n <= 16; n++) {
  for (let s = 1; s <= n; s++) {
    const r = suche(n, s)
    if (r.schuldig !== s) allesRichtig = false
    if (r.versuche > Math.ceil(Math.log2(n))) zuViele = { n, s, r }
  }
}
pruefe('Schuldiger wird immer gefunden (n = 1…16)', allesRichtig)
pruefe('höchstens ceil(log2 n) Versuche', zuViele === null, zuViele)
pruefe('16 PRs, Schuldiger Nr. 11: genau 4 Versuche', suche(16, 11).versuche === 4)
pruefe('Versuchs-Zug nimmt die erste Hälfte (abgerundet) mit', gleich(halbierungVersuch({ bleibt: [9], verdacht: [1, 2, 3], draussen: [] }), { zug: [9, 1] }))
pruefe('ein Verdächtiger → schuldig; Zug danach ohne ihn, zurückgestellte wieder dabei', gleich(halbierungVersuch({ bleibt: [9], verdacht: [3], draussen: [5, 6] }), { schuldig: 3, zug: [9, 5, 6] }))
pruefe('grün → zweite Hälfte verdächtig, erste bleibt', gleich(halbierungWeiter({ bleibt: [], verdacht: [1, 2, 3, 4], draussen: [] }, true), { bleibt: [1, 2], verdacht: [3, 4], draussen: [] }))
pruefe('rot → erste Hälfte verdächtig, zweite zurückgestellt', gleich(halbierungWeiter({ bleibt: [], verdacht: [1, 2, 3, 4], draussen: [7] }, false), { bleibt: [], verdacht: [1, 2], draussen: [7, 3, 4] }))

console.log('Kreislauf: Fahrt → Schuldsuche → Revert → Fahrt (Orakel)')
const nrn = [11, 12, 13, 14, 15]
const zugVon = (nr) => ({ nr, dateien: nr === 13 ? ['.github/workflows/x.yml'] : [nr === 12 ? 'web/src/y.tsx' : 'docs/z.md'] })
function fahre(schuldig, jobName, ratscheVor = null) {
  let imZug = [...nrn]
  const ausgeschlossen = []
  let fahrten = 0
  let halb = null
  for (;;) {
    fahrten += 1
    if (fahrten > 10) return { fehler: 'Endlosschleife', imZug }
    if (!imZug.includes(schuldig)) return { imZug, ausgeschlossen, fahrten, zurueckholen: zurueckholen(ausgeschlossen, schuldig) }
    const s = schuldsuche({ zugPrs: imZug.map(zugVon), fehlschlag: { jobs: [{ name: jobName, meldung: ratscheVor ?? 'rot' }] }, mainAllein: 'gruen', ausgeschlossen })
    if (s.art === 'pr') { imZug = imZug.filter((n) => n !== s.nr); ausgeschlossen.push(s.nr) }
    else if (s.art === 'halbieren') {
      halb = s.zustand
      for (;;) {
        const v = halbierungVersuch(halb)
        if (v.schuldig !== undefined) { imZug = imZug.filter((n) => n !== v.schuldig); ausgeschlossen.push(v.schuldig); break }
        fahrten += 1
        halb = halbierungWeiter(halb, !v.zug.includes(schuldig))
      }
    } else return { art: s.art, imZug, fahrten }
  }
}
const k1 = fahre(13, 'Kette – Workflows')
pruefe('Job nennt den richtigen PR: eine Rot-Fahrt, Revert, grün → 2 Fahrten, nichts zurückzuholen', k1.fahrten === 2 && gleich(k1.imZug, [11, 12, 14, 15]) && k1.zurueckholen.length === 0, k1)
const k2 = fahre(12, 'Kette – Workflows')
pruefe('falscher Verdacht (13) bleibt rot → Halbierung findet 12, 13 muss zurück', gleich(k2.imZug, [11, 14, 15]) && gleich(k2.zurueckholen, [13]), k2)
const k3 = fahre(14, 'Kette – Logik')
pruefe('Job ohne Eingrenzung → Halbierung über alle fünf findet 14', gleich(k3.imZug, [11, 12, 13, 15]) && k3.ausgeschlossen.length === 1, k3)
const k4 = fahre(13, 'Kette – Bau und Installation', UMFANG)
pruefe('Ratsche: nichts wird zurückgenommen (keine Basisgrenze → ratsche-pruefen)', k4.art === 'ratsche' && k4.imZug.length === 5, k4)

console.log('ffEntscheidung')
pruefe('alles passt → ff', ffEntscheidung({ mainImZug: true, kettenKopf: 'a', zugKopf: 'a' }).art === 'ff')
pruefe('main weitergelaufen → main-holen', ffEntscheidung({ mainImZug: false, kettenKopf: 'a', zugKopf: 'a' }).art === 'main-holen')
pruefe('Zug hat sich bewegt → neu-fahren, auch wenn main fehlt', ffEntscheidung({ mainImZug: false, kettenKopf: 'a', zugKopf: 'b' }).art === 'neu-fahren')
pruefe('Zug hat sich bewegt, main drin → neu-fahren', ffEntscheidung({ mainImZug: true, kettenKopf: 'a', zugKopf: 'b' }).art === 'neu-fahren')

console.log('Trockenlauf: Verdrahtung, nichts wird geschrieben')
// Echte Zeile aus `gh run view 42176593329 --log-failed` (Tabulatoren): Job, Schritt, Zeit + Text.
const LOG_ECHT = 'Kette – Bau und Installation\tUNKNOWN STEP\t2026-11-06T07:00:38.2159533Z   pipeline: Überlänge der funktionen 8986 statt höchstens 8964\nKette – Bau und Installation\tUNKNOWN STEP\t2026-11-06T07:00:39.0000000Z ##[error]Process completed with exit code 1.\nKopfzeile ohne Tabulator\n'
const jl = logJobs(LOG_ECHT)
pruefe('logJobs: ein Job, beide Zeilen, Ratsche darin lesbar', jl.length === 1 && jl[0].name === 'Kette – Bau und Installation' && ratschenMeldung(jl[0].meldung)?.wert === 8986, jl)
pruefe('logJobs: Meldung beginnt bei der Zeit, ohne Schrittname', jl[0].meldung.startsWith('2026-11-06T07:00:38.2159533Z   pipeline: Überlänge') && !jl[0].meldung.includes('UNKNOWN STEP'), jl[0].meldung)
pruefe('logJobs: Zeile mit nur einem Tabulator zählt nicht', logJobs('Job\tnur zwei Spalten\n').length === 0)
pruefe('logJobs: zwei Jobs getrennt', gleich(logJobs('A\ts\tz eins\nB\ts\tz zwei\nA\ts\tz drei\n').map((j) => [j.name, j.meldung]), [['A', 'z eins\nz drei\n'], ['B', 'z zwei\n']]))

function attrappen(zugLog, mainFehlt = false) {
  const aufrufe = []
  const ghFn = (a) => {
    aufrufe.push(['gh', ...a])
    const f = a[a.indexOf('--json') + 1]
    if (a[0] === 'pr' && a.includes('--base')) return JSON.stringify([{ number: 1 }, { number: 2 }, { number: 4 }])
    if (a[0] === 'pr' && f?.startsWith('number,title')) return JSON.stringify([1, 2, 3, 4].map((n) => ({ number: n, title: `T${n}`, headRefOid: kopfVon(n), createdAt: min(0), mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', isDraft: false, body: '' })))
    if (a[0] === 'pr' && f?.includes('statusCheckRollup')) return JSON.stringify([1, 2, 3, 4].map((n) => ({ number: n, reviews: [], statusCheckRollup: GRUEN })))
    if (a[0] === 'pr' && f?.includes('comments')) return JSON.stringify([1, 2, 3, 4].map((n) => ({ number: n, comments: [n === 4 ? { author: { login: 'danielzaiser91' }, createdAt: min(-120), body: 'Prüfer: freigeben' } : urteil(n, n * 10)] })))
    if (a[0] === 'api' && a[1] === 'graphql') throw new Error('keine Karte')
    if (a[0] === 'api') return min(-60)
    if (a[0] === 'run') return LOG_ECHT
    throw new Error(`unerwarteter gh-Aufruf ${a.join(' ')}`)
  }
  const gitFn = (a) => {
    aufrufe.push(['git', ...a])
    if (a[0] === 'rev-parse') {
      if (zugLog === null) throw new Error('unknown revision')
      return 'kopf1\n'
    }
    if (a[0] === 'merge-base') {
      if (mainFehlt) throw new Error('kein Vorfahr')
      return ''
    }
    if (a[0] === 'log') return a.includes('origin/main..origin/zug') ? zugLog : '\x01s1\tp1\tUmbau (#2757)\ntools/umfang-grenzen.json\n\x01s2\tp2\tPlan (#2764)\ntools/b.mjs\n'
    throw new Error(`unerwarteter git-Aufruf ${a.join(' ')}`)
  }
  return { aufrufe, ghFn, gitFn }
}
const LESEND_GIT = new Set(['rev-parse', 'log', 'merge-base'])
const LESEND_GH = new Set(['pr list', 'api', 'run view'])
function nurLesend(aufrufe) {
  return aufrufe.every(([w, ...a]) => (w === 'git' ? LESEND_GIT.has(a[0]) : LESEND_GH.has(a[0] === 'api' ? 'api' : `${a[0]} ${a[1]}`)))
}

const a1 = attrappen(null)
const aus1 = []
const exit1 = await trocken(['trocken'], (z) => aus1.push(z), { ghFn: a1.ghFn, gitFn: a1.gitFn })
const text1 = aus1.join('\n')
pruefe('ohne Zug: Exit 0, Plan nur aus der Basis (PR 1 und 2 frei, PR 4 mit altem Daniel-Urteil gesperrt, nicht 3)', exit1 === 0 && /ZUG-PLAN: 2 PRs aufnehmen, 1 bleiben/.test(text1) && /#4 kein Urteil auf dem Kopf/.test(text1) && !/#3 /.test(text1), text1)
pruefe('ohne Zug: Übung mit Schuldsuche (Ratsche, Basisgrenze 8986) und Revert-Befehl', /"art":"ratsche","ratsche":"umfang","fall":"ratsche","job":"Kette – Bau und Installation"/.test(text1) && /REVERT #2757: git revert --no-edit s1/.test(text1), text1)
pruefe('Schlusszeile „nichts geschrieben“', /zug trocken: nichts geschrieben$/.test(text1))
pruefe('nur lesende gh-/git-Aufrufe', nurLesend(a1.aufrufe), a1.aufrufe.map((x) => x.slice(0, 3).join(' ')))

const a2 = attrappen('\x01z1\tp1 p2\tMerge pull request #1 from d/x\ntools/a.mjs\n')
const aus2 = []
const exit2 = await trocken(['trocken', '--max', '1'], (z) => aus2.push(z), { ghFn: a2.ghFn, gitFn: a2.gitFn })
const text2 = aus2.join('\n')
pruefe('mit Zug: Zugstand und Fast-Forward-Lage; PR 1 liegt drin, max 1 → PR 2 wartet', exit2 === 0 && /ZUG: 1 PR-Commits, 1 Commits seit main/.test(text2) && /"art":"ff"/.test(text2) && /ZUG-PLAN: 0 PRs aufnehmen, 2 bleiben/.test(text2) && /#2 Zug voll/.test(text2) && !/UEBUNG/.test(text2), text2)
pruefe('mit Zug: nur lesende Aufrufe', nurLesend(a2.aufrufe))
const a6 = attrappen('\x01z1\tp1 p2\tMerge pull request #1 from d/x\ntools/a.mjs\n', true)
const aus6 = []
await trocken(['trocken'], (z) => aus6.push(z), { ghFn: a6.ghFn, gitFn: a6.gitFn })
pruefe('mit Zug, main nicht im Zug → main-holen', /"art":"main-holen"/.test(aus6.join('\n')))
const a7 = attrappen(null)
await trocken(['trocken', '--basis', 'zug'], () => {}, { ghFn: a7.ghFn, gitFn: a7.gitFn })
const basisAufruf = a7.aufrufe.find((x) => x[0] === 'gh' && x.includes('--base'))
pruefe('--basis zug wird an gh weitergegeben, Standard ist main', basisAufruf?.[basisAufruf.indexOf('--base') + 1] === 'zug' && a1.aufrufe.find((x) => x.includes('--base'))[a1.aufrufe.find((x) => x.includes('--base')).indexOf('--base') + 1] === 'main')

const aus3 = []
const exit3 = await trocken(['trocken'], (z) => aus3.push(z), { ghFn: () => { throw new Error('HTTP 502') }, gitFn: a1.gitFn })
pruefe('Abruffehler → Exit 2 mit Fehlerzeile, kein Plan', exit3 === 2 && /FEHLER HTTP 502/.test(aus3.join('\n')) && !/ZUG-PLAN/.test(aus3.join('\n')))
const aus4 = []
pruefe('falscher Aufruf → Exit 2', (await trocken(['los'], (z) => aus4.push(z), { ghFn: a1.ghFn, gitFn: a1.gitFn })) === 2 && /Aufruf:/.test(aus4[0]))

console.log('basisGrenzen: Grenzen am Basisstand aus den Dateitexten')
const DATEIEN = {
  'pipeline/check-cover-vorschau-bestand.ts': 'import x\nexport const HOECHSTENS = 170\n',
  'pipeline/check-teilseiten.ts': 'const STANDARD_TROTZ_COVER_HOECHSTENS = 168\n',
  'tools/start-budget.mjs': 'const KB = 1024\nexport const GRENZE = 190 * KB\n',
  'tools/umfang-grenzen.json': JSON.stringify({ ueberlaenge: { pipeline: { funktionen: 8907, dateien: 1030, ketten: 285 }, 'web/src': { funktionen: 3333 } } }),
}
const bg = basisGrenzen((d) => DATEIEN[d] ?? null)
pruefe('Cover: die strengere der zwei Grenzen', bg['cover-standardbild'] === 168)
pruefe('Start-Budget in KB', bg['start-budget'] === 190)
pruefe('Umfang je Bereich und Art', bg['umfang:pipeline:funktionen'] === 8907 && bg['umfang:pipeline:ketten'] === 285 && bg['umfang:web/src:funktionen'] === 3333)
pruefe('Umfang: nichts erfunden', Object.keys(bg).length === 6, Object.keys(bg))
pruefe('Datei fehlt am Basisstand → Schlüssel fehlt (kein Raten)', gleich(basisGrenzen(() => null), {}))
pruefe('nur eine der Cover-Dateien da → deren Wert', basisGrenzen((d) => (d === 'pipeline/check-teilseiten.ts' ? DATEIEN[d] : null))['cover-standardbild'] === 168)
const UMF2 = 'web/src: Überlänge der funktionen 3340 statt höchstens 3333'
pruefe('schuldsuche: Basisgrenze je Bereich, hält → ratsche', s0({ fehlschlag: { jobs: [jobBau(UMF2)] }, grenzeBasis: { 'umfang:web/src:funktionen': 3340, 'umfang:pipeline:funktionen': 1 } }).art === 'ratsche')
pruefe('schuldsuche: Basisgrenze des anderen Bereichs zählt nicht → Zug', s0({ fehlschlag: { jobs: [jobBau(UMF2)] }, grenzeBasis: { 'umfang:web/src:funktionen': 3335, 'umfang:pipeline:funktionen': 9999 } }).art === 'halbieren')

console.log('Fahrt: reine Regeln')
for (const [status, conclusion, soll] of [['completed', 'success', 'gruen'], ['completed', 'failure', 'rot'], ['completed', 'timed_out', 'rot'], ['completed', 'cancelled', 'offen'], ['completed', 'skipped', 'offen'], ['in_progress', '', 'offen'], ['queued', 'success', 'offen']]) {
  pruefe(`ketteArt ${status}/${conclusion || '-'} → ${soll}`, ketteArt({ status, conclusion }) === soll)
}
pruefe('Fahrt: Kette offen → abwarten', fahrtSchritt({ kette: 'offen' }).art === 'abwarten')
pruefe('Fahrt: grün und ff → ff-pruefen', fahrtSchritt({ kette: 'gruen', ff: { art: 'ff', grund: 'x' } }).art === 'ff-pruefen')
pruefe('Fahrt: grün, main weitergelaufen → main-holen mit Grund', gleich(fahrtSchritt({ kette: 'gruen', ff: { art: 'main-holen', grund: 'g' } }), { art: 'main-holen', grund: 'g' }))
pruefe('Fahrt: rot ohne Probe → probe-starten, mit Probe (auch gruen) → schuldsuche', fahrtSchritt({ kette: 'rot' }).art === 'probe-starten' && fahrtSchritt({ kette: 'rot', mainAllein: 'gruen' }).art === 'schuldsuche' && fahrtSchritt({ kette: 'rot', mainAllein: 'rot' }).art === 'schuldsuche')
pruefe('basisRef: Merge-Commit → Zug vor main, sonst main', basisRef(2) === 'origin/zug-fahrt^1' && basisRef(1) === 'origin/main')
const ZST = ratschenZustand([{ name: 'Kette – Bau', meldung: UMFANG }, { name: 'Kette – Logik', meldung: 'FEHL anderes' }, { name: 'Kette – Aussehen', meldung: BUDGET }], { 'umfang:pipeline:funktionen': 8986, 'start-budget': 240 })
pruefe('ratschenZustand: nur Jobs mit Ratsche, Basis je Schlüssel', ZST.length === 2 && gleich(ZST[0], { job: 'Kette – Bau', name: 'umfang:pipeline:funktionen', wert: 8986, grenze: 8964, basis: 8986, fall: 'ratsche' }) && ZST[1].fall === 'zug' && ZST[1].basis === 240, ZST)
pruefe('ratschenZustand: Basisgrenze fehlt → null und ratsche-pruefen', gleich(ratschenZustand([{ name: 'j', meldung: UMFANG }], {}).map((z) => [z.basis, z.fall]), [[null, 'ratsche-pruefen']]))
const FLOG = fahrtLog({ kopf: 'abcdef0123456789', kette: 'rot', schritt: { art: 'schuldsuche' }, ratschen: ZST, grenzeBasis: { 'start-budget': 240 }, urteil: { art: 'main' } })
pruefe('fahrtLog: Kopf, Urteil, Ratschen-Stand und je Ratsche eine Zeile', FLOG[0] === '## Fahrt abcdef012: Kette rot, Schritt schuldsuche' && FLOG[1] === 'Schuldsuche: {"art":"main"}' && FLOG[2] === 'Ratschen am Basisstand: start-budget=240' && FLOG.length === 5 && /Wert 8986, Grenze main 8964, Basis 8986 → Senkung auf main/.test(FLOG[3]) && /→ vom Zug gerissen/.test(FLOG[4]), FLOG)
pruefe('fahrtLog: ohne Grenzen und Ratschen sagt es beides', fahrtLog({ kopf: 'a', kette: 'grün', schritt: { art: 'ff-pruefen', grund: 'ok' } }).join('|') === '## Fahrt a: Kette grün, Schritt ff-pruefen (ok)|Ratschen am Basisstand: keine gelesen|Ratschen im Fehlschlag: keine gemeldet')
pruefe('bauUndDeployBefehle: erst Bau, dann Deploy, beide auf main', gleich(bauUndDeployBefehle(), [['workflow', 'run', 'bestand-bauen.yml', '--ref', 'main'], ['workflow', 'run', 'deploy.yml', '--ref', 'main']]))

if (fehler.length > 0) {
  console.error(`zug.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('zug.test: alle Fälle grün')
