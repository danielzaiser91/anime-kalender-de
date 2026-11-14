/**
 * Test zu tools/cloud-auftraege.mjs (Logik, Unterbefehle) und tools/cloud-auftraege-welt.mjs (gh-Anschluss).
 * REST-Beispiele (`gh api repos/…/pulls`) sind echte Antworten vom 14.11.2026, auf die genutzten Felder und kurze Beschreibungen gekürzt;
 * die Zeile `Auftrag: …` ist das vereinbarte Format und an echte Beschreibungen angehängt. Die GraphQL-Form des Mergers
 * (`gh pr list --json`) war in der Bau-Sitzung gesperrt: dafür gilt die Form aus nacht-merger-welt.mjs / nacht-merger.test.mjs.
 * Läuft mit `node tools/cloud-auftraege.test.mjs`, Exit ≠ 0 bei Fehlern.
 */
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { kontingentVon, kontingentZeile, lauf, median, mitEintrag, prZuAuftrag, sitzungVon, traegtAuftrag, vergebenZeile, vorabUrteil, vorratMitVergeben } from './cloud-auftraege.mjs'
import { echteWelt, listePrs, prVonRest } from './cloud-auftraege-welt.mjs'

let fehler = 0
function pruefe(name, ok, info = '') {
  if (!ok) {
    fehler++
    console.error(`✗ ${name} ${info}`)
  }
}
const gleich = (name, ist, soll) => pruefe(name, JSON.stringify(ist) === JSON.stringify(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`)

// --- echte REST-Antworten (gekürzt) ---------------------------------------------------------------------------------
const rest = (p) => ({ url: '', ...p })
const DATEN_BOT = rest({ number: 3829, title: 'chore(data): Sendezeiten gesammelt', user: { login: 'anime-kalender-daten[bot]' }, draft: false, state: 'closed', merged_at: '2026-11-14T09:09:18Z', closed_at: '2026-11-14T09:09:18Z', created_at: '2026-11-14T09:09:10Z', updated_at: '2026-11-14T09:09:19Z', head: { ref: 'daten/43578417969-sendezeiten-20261114-0903' }, body: 'Automatisch eingereicht von **Stündlich — Sendezeiten** (Lauf 43578417969).' })
const PATCHNOTES = rest({ number: 3811, title: 'Patch Notes 14.11.: Texte (Einträge vom 12. und 13.11.)', user: { login: 'danielzaiser91' }, draft: false, state: 'closed', merged_at: '2026-11-14T08:57:13Z', closed_at: '2026-11-14T08:57:13Z', created_at: '2026-11-13T23:20:14Z', updated_at: '2026-11-14T08:57:15Z', head: { ref: 'text/patchnotes-2026-11-14' }, body: 'Täglicher Lauf des Patch-Notes-Autors (Start 14.11. 00:13)' })
const GEMERGT_A = rest({ number: 3709, title: 'fix(folgen): Wochenplan ohne Folgenzahl zählt Sendepausen', user: { login: 'danielzaiser91' }, draft: false, state: 'closed', merged_at: '2026-11-14T05:36:49Z', closed_at: '2026-11-14T05:36:49Z', created_at: '2026-11-13T00:39:42Z', updated_at: '2026-11-14T05:36:51Z', head: { ref: 'claude/nacht-fehler-wochen-ohne-folgenzahl-pause' }, body: '## Fehler\n`wochenAbStart` in `pipeline/bau/folgen-erschienen-je-weg.ts`' })
const GEMERGT_B = rest({ number: 3680, title: 'fix(folgen): Wikipedia-Grenze, wenn aniSearch nur künftige Daten', user: { login: 'danielzaiser91' }, draft: false, state: 'closed', merged_at: '2026-11-14T04:56:50Z', closed_at: '2026-11-14T04:56:50Z', created_at: '2026-11-12T23:45:34Z', updated_at: '2026-11-14T04:56:52Z', head: { ref: 'claude/nacht-fehler-erschienen-wiki-grenze' }, body: '## Fehler\n`erschieneneFolgen` begrenzt die aniSearch-Folgenliste' })
const GESCHLOSSEN = rest({ number: 3644, title: 'fix(youtube): „OmU“ nur als ganzes Wort als andere Fassung werten', user: { login: 'danielzaiser91' }, draft: false, state: 'closed', merged_at: null, closed_at: '2026-11-13T17:50:15Z', created_at: '2026-11-12T22:34:45Z', updated_at: '2026-11-13T17:50:15Z', head: { ref: 'claude/nacht-tests-fix-titel-muster-omu' }, body: '## Was\n`ANDERE_FASSUNG` hatte vor der Gruppe ein `\\b`' })
const OFFEN_A = rest({ number: 3828, title: 'fix(push): Termine ohne Uhrzeit lösen keinen Push aus', user: { login: 'danielzaiser91' }, draft: false, state: 'open', merged_at: null, closed_at: null, created_at: '2026-11-14T09:04:00Z', updated_at: '2026-11-14T09:04:00Z', head: { ref: 'fix/push-ohne-uhrzeit-aus' }, body: '## Ziel\nDaniels Entscheidung vom 14.11.2026 01:20' })
const OFFEN_ENTWURF = rest({ number: 3729, title: 'Umbau: zaehleOffenePruefungen zerlegt (Prüfstand, Suchen/Seiten)', user: { login: 'danielzaiser91' }, draft: true, state: 'open', merged_at: null, closed_at: null, created_at: '2026-11-13T01:05:56Z', updated_at: '2026-11-13T01:05:56Z', head: { ref: 'claude/nacht-umfang-zaehleOffenePruefungen' }, body: '**Was:** In `worker/src/pruefung-zaehlen.ts` stehen das Holen des Prüfstands' })
const mitAuftrag = (p, id, zusatz = ' · Routine: trig_X') => ({ ...p, body: `${p.body}\nAuftrag: ${id}${zusatz}\nClaude-Session: https://claude.ai/code/session_x` })
const COMMITS = [{ commit: { committer: { date: '2026-11-13T23:19:40Z' } } }, { commit: { committer: { date: '2026-11-13T23:20:01Z' } } }]

const JETZT = Date.parse('2026-11-14T09:15:00Z')
const alle = (...rests) => rests.map(prVonRest)

// --- prVonRest -------------------------------------------------------------------------------------------------------
gleich('prVonRest offen', prVonRest(OFFEN_A), { nummer: 3828, titel: OFFEN_A.title, autor: 'danielzaiser91', beschreibung: OFFEN_A.body, entwurf: false, offen: true, gemergtAm: null, geschlossenAm: null, erstellt: '2026-11-14T09:04:00Z', zweig: 'fix/push-ohne-uhrzeit-aus' })
pruefe('prVonRest Entwurf', prVonRest(OFFEN_ENTWURF).entwurf === true)
pruefe('prVonRest gemergt = nicht offen, mit Zeit', prVonRest(GEMERGT_A).offen === false && prVonRest(GEMERGT_A).gemergtAm === '2026-11-14T05:36:49Z')
pruefe('prVonRest geschlossen ohne Merge', prVonRest(GESCHLOSSEN).offen === false && prVonRest(GESCHLOSSEN).gemergtAm === null)
pruefe('prVonRest ohne Beschreibung', prVonRest({ ...OFFEN_A, body: null }).beschreibung === '')

// --- Auftragszeile ---------------------------------------------------------------------------------------------------
const pa = (body) => ({ beschreibung: body })
pruefe('Zeile mit Routine dahinter', traegtAuftrag(pa('x\nAuftrag: foo-1 · Routine: trig_A\ny'), 'foo-1'))
pruefe('Zeile allein', traegtAuftrag(pa('Auftrag: foo-1'), 'foo-1'))
pruefe('Zeile am Textanfang', traegtAuftrag(pa('Auftrag: foo-1\nrest'), 'foo-1'))
pruefe('andere id mit gleichem Anfang trifft nicht', !traegtAuftrag(pa('Auftrag: foo-12 · Routine: x'), 'foo-1'))
pruefe('längere id trifft nicht auf kürzere Anfrage umgekehrt', !traegtAuftrag(pa('Auftrag: foo'), 'foo-1'))
pruefe('Erwähnung mitten im Satz trifft nicht', !traegtAuftrag(pa('siehe Auftrag: foo-1 oben'), 'foo-1'))
pruefe('Punkt in der id ist kein Platzhalter', !traegtAuftrag(pa('Auftrag: fooX1'), 'foo.1'))
pruefe('ohne Beschreibung', !traegtAuftrag({}, 'foo-1'))
gleich('prZuAuftrag: offener vor geschlossenem', prZuAuftrag([{ nummer: 9, offen: false, beschreibung: 'Auftrag: a' }, { nummer: 5, offen: true, beschreibung: 'Auftrag: a' }], 'a').nummer, 5)
gleich('prZuAuftrag: sonst höchste Nummer', prZuAuftrag([{ nummer: 5, offen: false, beschreibung: 'Auftrag: a' }, { nummer: 9, offen: false, beschreibung: 'Auftrag: a' }], 'a').nummer, 9)
pruefe('prZuAuftrag ohne Treffer', prZuAuftrag([{ nummer: 5, offen: true, beschreibung: 'nichts' }], 'a') === undefined)

// --- median ---------------------------------------------------------------------------------------------------------
gleich('Median ungerade', median([5, 1, 3]), 3)
gleich('Median gerade', median([4, 1, 2, 3]), 2.5)
gleich('Median eines Werts', median([7]), 7)

// --- kontingent -------------------------------------------------------------------------------------------------------
const imStunde = (n, stunde, basis = {}) => Array.from({ length: n }, (_, i) => prVonRest({ ...GEMERGT_A, ...basis, number: 10_000 + stunde * 100 + i, merged_at: `2026-11-13T${String(stunde).padStart(2, '0')}:${String(10 + i).padStart(2, '0')}:00Z` }))
const k1 = kontingentVon([...alle(DATEN_BOT, PATCHNOTES, GEMERGT_A, GEMERGT_B, GESCHLOSSEN, OFFEN_A, OFFEN_ENTWURF)], JETZT)
gleich('Kontingent echte PRs: Durchsatz 1/h (Daten-Bot, Geschlossener, Offene nicht gezählt)', [k1.durchsatz, k1.grenze, k1.offen, k1.voll], [1, 5, 1, false])
gleich('Zeitfenster', [k1.von, k1.bis], ['2026-11-11T09:15:00.000Z', '2026-11-14T09:15:00.000Z'])
gleich('Kontingentzeile', kontingentZeile(k1), 'Kontingent: 1/5 (Durchsatz 1/h, gemessen 2026-11-11 09:15–2026-11-14 09:15 UTC)')
gleich('Durchsatz 4/h ergibt Grenze 8', kontingentVon([...imStunde(4, 3), ...imStunde(4, 4)], JETZT).grenze, 8)
gleich('Median je Stunde mit Merge (2,3,9 → 3 → 6)', kontingentVon([...imStunde(2, 3), ...imStunde(3, 4), ...imStunde(9, 5)], JETZT).grenze, 6)
gleich('Grenze höchstens 15', kontingentVon([...imStunde(10, 3), ...imStunde(10, 4)], JETZT).grenze, 15)
gleich('Grenze mindestens 5 ohne Merges', kontingentVon([], JETZT).grenze, 5)
gleich('Grenze mindestens 5 bei Durchsatz 2', kontingentVon([...imStunde(2, 3)], JETZT).grenze, 5)
gleich('Median gerade Anzahl Stunden (1 und 2 → 1,5 → 3 → 5)', kontingentVon([...imStunde(1, 3), ...imStunde(2, 4)], JETZT).durchsatz, 1.5)
gleich('Durchsatz 3,5 ergibt 7', kontingentVon([...imStunde(3, 3), ...imStunde(4, 4)], JETZT).grenze, 7)
const aufGrenze = (zeit) => prVonRest({ ...GEMERGT_A, merged_at: zeit })
gleich('Merge genau 72 h her zählt', kontingentVon([aufGrenze('2026-11-11T09:15:00Z')], JETZT).durchsatz, 1)
gleich('Merge 1 s vor dem Fenster zählt nicht', kontingentVon([aufGrenze('2026-11-11T09:14:59Z')], JETZT).durchsatz, 0)
gleich('github-actions als Autor zählt nicht', kontingentVon([prVonRest({ ...GEMERGT_A, user: { login: 'github-actions[bot]' } })], JETZT).durchsatz, 0)
gleich('Titel chore(data) zählt nicht, auch von Menschen', kontingentVon([prVonRest({ ...GEMERGT_A, title: 'chore(data): von Hand' })], JETZT).durchsatz, 0)
gleich('Titel mit chore (ohne data) zählt', kontingentVon([prVonRest({ ...GEMERGT_A, title: 'chore(deps): x' })], JETZT).durchsatz, 1)
gleich('geschlossener ohne Merge zählt nicht', kontingentVon(alle(GESCHLOSSEN), JETZT).durchsatz, 0)
const offene = (n, basis = {}) => Array.from({ length: n }, (_, i) => prVonRest({ ...OFFEN_A, ...basis, number: 20_000 + i }))
gleich('offene Entwürfe zählen nicht', kontingentVon(offene(7, { draft: true }), JETZT).offen, 0)
gleich('offene chore(data) zählen nicht', kontingentVon(offene(7, { title: 'chore(data): x' }), JETZT).offen, 0)
gleich('offene github-actions-PRs zählen nicht', kontingentVon(offene(7, { user: { login: 'github-actions[bot]' } }), JETZT).offen, 0)
pruefe('offen = Grenze ist voll', kontingentVon(offene(5), JETZT).voll === true)
pruefe('offen = Grenze − 1 ist nicht voll', kontingentVon(offene(4), JETZT).voll === false)

// --- vorab ------------------------------------------------------------------------------------------------------------
const frei = { offen: 0, grenze: 5, durchsatz: 0, von: '2026-11-11T09:15:00.000Z', bis: '2026-11-14T09:15:00.000Z', voll: false }
const voll = { ...frei, offen: 5, voll: true }
const eintrag = (id) => ({ id, routine: `trig_${id}`, start: '2026-11-14T08:00:00.000Z' })
const geschlossenMit = (id, nummer = 50) => ({ ...prVonRest(mitAuftrag(GESCHLOSSEN, id)), nummer })
const gemergtMit = (id, nummer = 51) => ({ ...prVonRest(mitAuftrag(GEMERGT_A, id)), nummer })
const offenMit = (id, nummer = 52) => ({ ...prVonRest(mitAuftrag(OFFEN_A, id)), nummer })
pruefe('vorab: neue id, nichts los → ja', vorabUrteil('neu', [], [], frei).ok)
pruefe('vorab (a): id im Register, noch kein PR → nein', !vorabUrteil('a', [eintrag('a')], [], frei).ok)
pruefe('vorab (a): id im Register, PR offen → nein', /steht im Register/.test(vorabUrteil('a', [eintrag('a')], [offenMit('a')], frei).grund))
pruefe('vorab (a): id im Register, PR gemergt → ja', vorabUrteil('a', [eintrag('a')], [gemergtMit('a')], frei).ok)
pruefe('vorab (a): id im Register, PR geschlossen → ja', vorabUrteil('a', [eintrag('a')], [geschlossenMit('a')], frei).ok)
pruefe('vorab (b): offener PR mit Zeile, Register leer → nein', /#52/.test(vorabUrteil('a', [], [offenMit('a')], frei).grund))
pruefe('vorab (b): gemergter PR mit Zeile, Register leer → ja', vorabUrteil('a', [], [gemergtMit('a')], frei).ok)
pruefe('vorab (b): offener PR einer anderen id → ja', vorabUrteil('a', [], [offenMit('b')], frei).ok)
pruefe('vorab (c): Kontingent voll → nein mit Kontingentzeile', /^Kontingent: 5\/5/.test(vorabUrteil('a', [], [], voll).grund))
pruefe('vorab (d): vier aktive → ja', vorabUrteil('neu', ['a', 'b', 'c', 'd'].map(eintrag), [], frei).ok)
pruefe('vorab (d): fünf aktive → nein', /5 aktive/.test(vorabUrteil('neu', ['a', 'b', 'c', 'd', 'e'].map(eintrag), [], frei).grund))
pruefe('vorab (d): fünf Einträge, einer fertig → ja', vorabUrteil('neu', ['a', 'b', 'c', 'd', 'e'].map(eintrag), [gemergtMit('a')], frei).ok)
pruefe('vorab (d): fünf Einträge, einer mit geschlossenem PR → ja', vorabUrteil('neu', ['a', 'b', 'c', 'd', 'e'].map(eintrag), [geschlossenMit('c')], frei).ok)
pruefe('vorab (d): fünf Einträge, zwei fertig, einer offen → ja', vorabUrteil('neu', ['a', 'b', 'c', 'd', 'e'].map(eintrag), [gemergtMit('a'), gemergtMit('b', 53), offenMit('c', 54)], frei).ok)

// --- Vorrat und Register ----------------------------------------------------------------------------------------------
gleich('Vergeben-Zeile in Berliner Zeit (Winter, UTC+1)', vergebenZeile('trig_A', JETZT), '**Vergeben:** Cloud-Routine https://claude.ai/code/routines/trig_A (14.11. 10:15)')
gleich('Vergeben-Zeile in Sommerzeit (UTC+2)', vergebenZeile('trig_A', Date.parse('2026-07-01T10:05:00Z')), '**Vergeben:** Cloud-Routine https://claude.ai/code/routines/trig_A (01.07. 12:05)')
gleich('Vorrat: Zeile unter der ersten', vorratMitVergeben('# Titel\n\nText\n', 'V'), '# Titel\nV\n\nText\n')
pruefe('Vorrat: vorhandene Vergeben-Zeile → null', vorratMitVergeben('# Titel\n**Vergeben:** x\nText', 'V') === null)
pruefe('Vorrat: Vergeben-Zeile weiter unten → null', vorratMitVergeben('# Titel\n\nText\n**Vergeben:** x', 'V') === null)
pruefe('Vorrat: „Vergeben“ im Fließtext ist keine Zeile', vorratMitVergeben('# Titel\nWurde vergeben: nein', 'V') !== null)
gleich('mitEintrag ersetzt dieselbe id', mitEintrag([eintrag('a'), eintrag('b')], { id: 'a', routine: 'neu', start: 's' }).map((e) => e.routine), ['trig_b', 'neu'])

// --- Unterbefehle über `lauf` mit Attrappe-Welt ------------------------------------------------------------------------
const wurzel = mkdtempSync(join(tmpdir(), 'cloud-auftraege-'))
const pfad = (n) => join(wurzel, n)
function welt(opts = {}) {
  const ausgabe = []
  const aufrufe = { prs: [] }
  const w = {
    jetzt: () => JETZT,
    zeile: (t) => ausgabe.push(t),
    prs: (seit) => {
      aufrufe.prs.push(seit)
      return opts.prs ?? []
    },
    letzterCommit: (n) => (opts.commit ? opts.commit(n) : '2026-11-14T09:00:00Z'),
    pruefstand: (n) => (opts.pruefstand ? opts.pruefstand(n) : { kette: 'Kette grün', kandidat: false, grund: 'Review-Stand leer, nicht APPROVED' }),
  }
  return { w, ausgabe, aufrufe }
}
const ruf = (argv, opts) => {
  const { w, ausgabe, aufrufe } = welt(opts)
  return { exit: lauf(argv, w), ausgabe, aufrufe }
}
const lies = (p) => JSON.parse(readFileSync(p, 'utf8'))

// Aufruffehler
gleich('unbekannter Befehl → 2', ruf(['quatsch']).exit, 2)
gleich('ohne Befehl → 2', ruf([]).exit, 2)
gleich('vorab ohne --register → 2', ruf(['vorab', 'a']).exit, 2)
gleich('vorab ohne id → 2', ruf(['vorab', '--register', pfad('r0.json')]).exit, 2)
gleich('eintragen ohne --routine → 2', ruf(['eintragen', 'a', '--register', pfad('r0.json')]).exit, 2)

// vorab
const reg1 = pfad('r1.json')
writeFileSync(reg1, JSON.stringify([eintrag('a')]))
const v1 = ruf(['vorab', 'neu', '--register', reg1], { prs: [] })
gleich('vorab ja → Exit 0', v1.exit, 0)
const v2 = ruf(['vorab', 'a', '--register', reg1], { prs: [] })
gleich('vorab nein → Exit 1, eine Zeile mit Grund', [v2.exit, v2.ausgabe.length, /^nein: a steht im Register/.test(v2.ausgabe[0])], [1, 1, true])
const v3 = ruf(['vorab', 'neu', '--register', pfad('gibtsnicht.json')], { prs: [] })
gleich('vorab ohne Registerdatei → leeres Register, Exit 0, Datei nicht angelegt', [v3.exit, existsSync(pfad('gibtsnicht.json'))], [0, false])
const v4 = ruf(['vorab', 'neu', '--register', reg1], { prs: imStunde(1, 3).concat(offene(5)) })
gleich('vorab bei vollem Kontingent → Exit 1', [v4.exit, /Kontingent: 5\/5/.test(v4.ausgabe[0])], [1, true])
gleich('vorab fragt die PRs ab Registerstart oder 72 h zurück ab, was früher ist', v1.aufrufe.prs, [Date.parse('2026-11-11T09:15:00Z')])
const regAlt = pfad('r-alt.json')
writeFileSync(regAlt, JSON.stringify([{ ...eintrag('x'), start: '2026-11-01T00:00:00.000Z' }]))
gleich('vorab: älterer Registerstart weitet das Fenster', ruf(['vorab', 'neu', '--register', regAlt], { prs: [] }).aufrufe.prs, [Date.parse('2026-11-01T00:00:00Z')])
writeFileSync(pfad('kaputt.json'), '{"a":1}')
let wurf = null
try {
  ruf(['vorab', 'neu', '--register', pfad('kaputt.json')])
} catch (e) {
  wurf = /keine Liste/.test(e.message) ? 'keine Liste' : e.message
}
pruefe('Register, das keine Liste ist, wirft „keine Liste“ (Exit 2 in main)', wurf === 'keine Liste')

// eintragen
const reg2 = pfad('r2.json')
const e1 = ruf(['eintragen', 'a', '--routine', 'trig_A', '--register', reg2])
gleich('eintragen legt die Datei an', [e1.exit, lies(reg2)], [0, [{ id: 'a', routine: 'trig_A', start: '2026-11-14T09:15:00.000Z' }]])
ruf(['eintragen', 'b', '--routine', 'trig_B', '--register', reg2])
gleich('eintragen hängt an', lies(reg2).map((e) => e.id), ['a', 'b'])
ruf(['eintragen', 'a', '--routine', 'trig_A2', '--register', reg2])
gleich('eintragen derselben id ersetzt', lies(reg2).map((e) => `${e.id}:${e.routine}`), ['b:trig_B', 'a:trig_A2'])
const vorrat = pfad('vorrat.md')
writeFileSync(vorrat, '# Auftrag Z\n\nBeschreibung\n')
const e2 = ruf(['eintragen', 'z', '--routine', 'trig_Z', '--register', reg2, '--vorrat', vorrat])
gleich('eintragen mit Vorrat: Zeile unter der ersten', [e2.exit, readFileSync(vorrat, 'utf8')], [0, '# Auftrag Z\n**Vergeben:** Cloud-Routine https://claude.ai/code/routines/trig_Z (14.11. 10:15)\n\nBeschreibung\n'])
const vorherReg = readFileSync(reg2, 'utf8')
const vorherVorrat = readFileSync(vorrat, 'utf8')
const e3 = ruf(['eintragen', 'y', '--routine', 'trig_Y', '--register', reg2, '--vorrat', vorrat])
gleich('eintragen: Vorrat schon vergeben → Exit 1, weder Register noch Vorrat geändert', [e3.exit, readFileSync(reg2, 'utf8') === vorherReg, readFileSync(vorrat, 'utf8') === vorherVorrat], [1, true, true])
gleich('eintragen: Vorratsdatei fehlt → Exit 2, Register unverändert', [ruf(['eintragen', 'y', '--routine', 'trig_Y', '--register', reg2, '--vorrat', pfad('weg.md')]).exit, readFileSync(reg2, 'utf8') === vorherReg], [2, true])

// uebersicht
const reg3 = pfad('r3.json')
const start = (minVorher) => new Date(JETZT - minVorher * 60_000).toISOString()
writeFileSync(reg3, JSON.stringify([
  { id: 'fertig-1', routine: 'trig_F1', start: start(300) },
  { id: 'fertig-2', routine: 'trig_F2', start: start(300) },
  { id: 'haengt', routine: 'trig_H', start: start(200) },
  { id: 'nur-gestartet', routine: 'trig_N', start: start(10) },
  { id: 'idle-ohne-pr', routine: 'trig_I', start: start(31) },
  { id: 'mit-pr', routine: 'trig_M', start: start(100) },
]))
const runsPfad = pfad('runs.json')
const vorMin = (m) => new Date(JETZT - m * 60_000).toISOString()
writeFileSync(runsPfad, JSON.stringify({
  trig_H: { data: [{ worker_status: 'running', last_event_at: vorMin(46), url: 'https://claude.ai/code/session_h' }] },
  trig_N: { data: [{ worker_status: 'idle', last_event_at: vorMin(5), url: 'u' }] },
  trig_I: { data: [{ worker_status: 'idle', last_event_at: vorMin(30), url: 'u' }] },
  trig_M: { data: [{ worker_status: 'idle', last_event_at: vorMin(60), url: 'u' }, { worker_status: 'running', last_event_at: vorMin(2), url: 'u2' }] },
}))
const prsUe = [gemergtMit('fertig-1', 61), geschlossenMit('fertig-2', 62), offenMit('mit-pr', 63), prVonRest(OFFEN_A)]
const ue = ruf(['uebersicht', '--register', reg3, '--runs', runsPfad], { prs: prsUe, commit: (n) => (n === 63 ? '2026-11-14T09:10:00Z' : null) })
const text = ue.ausgabe.join('\n')
gleich('übersicht: Exit 0', ue.exit, 0)
pruefe('übersicht: Schlusszeile zählt fertige (2)', ue.ausgabe.at(-1) === 'Fertig (PR gemergt/geschlossen): 2', ue.ausgabe.at(-1))
pruefe('übersicht: fertige nicht einzeln', !/fertig-1|fertig-2/.test(text))
pruefe('übersicht: PR-Nummer über die Auftragszeile', /^mit-pr · .*PR #63 · letzter Commit 2026-11-14T09:10:00Z/.test(ue.ausgabe.find((z) => z.startsWith('mit-pr'))))
pruefe('übersicht: Kette und Merge-Reife aus dem Prüfstand', /Kette: Kette grün · Merge-reif: nein · Prüfstand: Review-Stand leer, nicht APPROVED/.test(ue.ausgabe.find((z) => z.startsWith('mit-pr'))))
pruefe('übersicht: Sitzung aus dem jüngsten Lauf (running, nicht idle)', /Sitzung: running$/.test(ue.ausgabe.find((z) => z.startsWith('mit-pr'))))
pruefe('übersicht: ohne PR „kein PR“', /^nur-gestartet · .*kein PR · kein Commit/.test(ue.ausgabe.find((z) => z.startsWith('nur-gestartet'))))
pruefe('übersicht: running seit 46 min → Alarm', ue.ausgabe.some((z) => z.startsWith('ALARM haengt: haengt ')))
pruefe('übersicht: idle ohne PR seit 31 min → Alarm', ue.ausgabe.some((z) => z.startsWith('ALARM haengt: idle-ohne-pr ')))
pruefe('übersicht: genau zwei Alarme (jung gestartet und mit PR kein Alarm)', ue.ausgabe.filter((z) => z.startsWith('ALARM')).length === 2)
const uj = ruf(['uebersicht', '--register', reg3, '--runs', runsPfad, '--json'], { prs: prsUe })
const j = JSON.parse(uj.ausgabe.join('\n'))
gleich('übersicht --json: Felder', [j.fertig, j.eintraege.map((e) => e.id), j.alarme.length, j.eintraege.find((e) => e.id === 'mit-pr').pr], [2, ['haengt', 'nur-gestartet', 'idle-ohne-pr', 'mit-pr'], 2, 63])
gleich('übersicht ohne --runs: Sitzung unbekannt, kein Alarm', ruf(['uebersicht', '--register', reg3], { prs: prsUe }).ausgabe.filter((z) => z.startsWith('ALARM')).length, 0)
gleich('übersicht: runs.json fehlt → Exit 2', ruf(['uebersicht', '--register', reg3, '--runs', pfad('weg.json')]).exit, 2)
const kaputtStand = ruf(['uebersicht', '--register', reg3, '--runs', runsPfad], { prs: prsUe, pruefstand: () => { throw new Error('gh kaputt') } })
pruefe('übersicht: Prüfstand wirft → Zeile nennt es, Lauf geht weiter', kaputtStand.exit === 0 && kaputtStand.ausgabe.some((z) => /Prüfstand unlesbar: gh kaputt/.test(z)))
const merge = ruf(['uebersicht', '--register', reg3, '--runs', runsPfad], { prs: prsUe, pruefstand: () => ({ kette: 'Kette grün', kandidat: true, grund: 'Stufe 1, Kette grün, Prüfer-Urteil ok zum Kopf' }) })
pruefe('übersicht: Merge-reif ja', /Merge-reif: ja · Prüfstand: Stufe 1/.test(merge.ausgabe.find((z) => z.startsWith('mit-pr'))))
pruefe('übersicht: Prüfstand nur für Einträge mit PR abgefragt', (() => { const n = []; ruf(['uebersicht', '--register', reg3], { prs: prsUe, pruefstand: (x) => { n.push(x); return { kette: 'k', kandidat: false, grund: 'g' } } }); return n.join() === '63' })())

// sitzungVon: Grenzen
const lauf46 = { worker_status: 'running', ms: JETZT - 46 * 60_000 }
gleich('Sitzung running 45 min still → kein Alarm', sitzungVon({ worker_status: 'running', ms: JETZT - 45 * 60_000 }, true, JETZT, JETZT).alarm, null)
pruefe('Sitzung running 46 min still → Alarm', sitzungVon(lauf46, true, JETZT, JETZT).alarm !== null)
gleich('Sitzung idle ohne PR, Start genau 30 min → kein Alarm', sitzungVon({ worker_status: 'idle', ms: JETZT }, false, JETZT - 30 * 60_000, JETZT).alarm, null)
pruefe('Sitzung idle ohne PR, Start 31 min → Alarm', sitzungVon({ worker_status: 'idle', ms: JETZT }, false, JETZT - 31 * 60_000, JETZT).alarm !== null)
gleich('Sitzung running, frisches Ereignis, kein PR, Start lange her → kein Alarm (arbeitet noch)', sitzungVon({ worker_status: 'running', ms: JETZT - 60_000 }, false, JETZT - 120 * 60_000, JETZT).alarm, null)
gleich('Sitzung idle mit PR, Start lange her → kein Alarm', sitzungVon({ worker_status: 'idle', ms: JETZT - 600 * 60_000 }, true, JETZT - 700 * 60_000, JETZT).alarm, null)
gleich('Sitzung running, lange still, kein PR → Alarm wegen running', sitzungVon(lauf46, false, JETZT, JETZT).alarm !== null, true)
gleich('Sitzung ohne Lauf → unbekannt', sitzungVon(undefined, false, JETZT - 999 * 60_000, JETZT), { zustand: 'unbekannt', alarm: null })

// kontingent als Befehl
const kb = ruf(['kontingent'], { prs: offene(2) })
gleich('kontingent: Zeile und Exit 0', [kb.exit, kb.ausgabe[0].startsWith('Kontingent: 2/5')], [0, true])
gleich('kontingent: fragt ab 72 h zurück', kb.aufrufe.prs, [JETZT - 72 * 3600_000])
gleich('kontingent voll → Exit 1', ruf(['kontingent'], { prs: offene(5) }).exit, 1)

// --- Welt: gh-Anschluss mit Attrappe, die echte REST-Antworten liefert -------------------------------------------------
const sonde = []
const ghRest = (seiten) => (args) => {
  sonde.push(args.join(' '))
  const m = /pulls\?state=(\w+)&sort=updated&direction=desc&per_page=100&page=(\d+)/.exec(args[1] ?? '')
  if (m) return JSON.stringify(seiten[m[1]]?.[Number(m[2]) - 1] ?? [])
  if (/pulls\/\d+\/commits/.test(args[1] ?? '')) return COMMITS.map((c) => c.commit.committer.date).join('\n') + '\n'
  throw new Error(`unerwartet: ${args.join(' ')}`)
}
const REPO = 'danielzaiser91/anime-kalender-de'
const kurz = listePrs(ghRest({ open: [[OFFEN_A, OFFEN_ENTWURF]], closed: [[DATEN_BOT, PATCHNOTES, GEMERGT_A, GESCHLOSSEN]] }), REPO, JETZT - 72 * 3600_000)
gleich('listePrs: offene und geschlossene, normalisiert', kurz.map((p) => [p.nummer, p.offen]), [[3828, true], [3729, true], [3829, false], [3811, false], [3709, false], [3644, false]])
sonde.length = 0
const fuell = (n, rest0) => Array.from({ length: 100 }, (_, i) => ({ ...rest0, number: n + i }))
listePrs(ghRest({ open: [[OFFEN_A]], closed: [fuell(1000, GEMERGT_A), fuell(2000, GEMERGT_A), [GEMERGT_B]] }), REPO, JETZT - 72 * 3600_000)
gleich('listePrs: blättert, bis eine Seite unter 100 hat', sonde.filter((s) => s.includes('state=closed')).length, 3)
sonde.length = 0
const altSeite = fuell(1000, { ...GEMERGT_A, updated_at: '2026-11-01T00:00:00Z' })
listePrs(ghRest({ open: [[OFFEN_A]], closed: [altSeite, fuell(2000, GEMERGT_A)] }), REPO, JETZT - 72 * 3600_000)
gleich('listePrs: hört auf, sobald die Seite älter als das Fenster endet', sonde.filter((s) => s.includes('state=closed')).length, 1)
sonde.length = 0
listePrs(ghRest({ open: [[OFFEN_A]], closed: [fuell(1000, GEMERGT_A), [GEMERGT_B]] }), REPO, JETZT - 72 * 3600_000)
gleich('listePrs: Seite mit 100 neueren geht weiter', sonde.filter((s) => s.includes('state=closed')).length, 2)
let zuViel = null
try {
  listePrs(ghRest({ open: [[OFFEN_A]], closed: Array.from({ length: 11 }, (_, i) => fuell(i * 100, GEMERGT_A)) }), REPO, JETZT - 72 * 3600_000)
} catch (e) {
  zuViel = e.message
}
pruefe('listePrs: über 1000 PRs im Fenster → Fehler statt Abschneiden', /mehr als 1000/.test(zuViel ?? ''), String(zuViel))
let zehnVoll = null
try {
  listePrs(ghRest({ open: [[OFFEN_A]], closed: Array.from({ length: 10 }, (_, i) => fuell(i * 100, GEMERGT_A)) }), REPO, JETZT - 72 * 3600_000)
} catch (e) {
  zehnVoll = e.message
}
pruefe('listePrs: zehn volle Seiten und eine elfte Anfrage → Fehler (Grenze genau bei 1000)', /mehr als 1000/.test(zehnVoll ?? ''), String(zehnVoll))
let offenZuViel = null
try {
  listePrs(ghRest({ open: Array.from({ length: 11 }, (_, i) => fuell(i * 100, OFFEN_A)) }), REPO, JETZT)
} catch (e) {
  offenZuViel = e.message
}
pruefe('listePrs: über 1000 offene → Fehler', /mehr als 1000 offene/.test(offenZuViel ?? ''), String(offenZuViel))

const echt = echteWelt({ gh: ghRest({ open: [], closed: [] }), repo: REPO, jetzt: () => JETZT, merger: {} })
gleich('letzterCommit: letzte Zeile der Commit-Zeiten', echt.letzterCommit(3811), '2026-11-13T23:20:01Z')
pruefe('Welt: jetzt aus der Parameter-Uhr', echt.jetzt() === JETZT)

// Prüfstand über die Merger-Welt: echte Auswahlregel `kandidat()`, GraphQL-Form (Entwurf, UNKNOWN, chore(data)) aus nacht-merger-welt.mjs
const KOPF = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const gruen = [{ __typename: 'CheckRun', name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'SUCCESS' }]
const urteil = { login: 'github-actions[bot]', assoc: 'NONE', at: '2026-11-14T09:00:00Z', body: `**Prüfer-Review** für ${KOPF.slice(0, 9)} - Urteil: **ok**\n\nProtokoll` }
const mergerPr = (o) => ({ nummer: 63, titel: 'fix: x', beschreibung: 'Auftrag: mit-pr', kopf: KOPF, zweig: 'bauer/x', entwurf: false, offen: true, erstellt: '2026-11-14T09:00:00Z', reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN', geaenderteDateien: 2, ...o })
const mergerAttrappe = (pr, extra = {}) => ({ offene: () => [pr], details: (p) => ({ ...p, stufe: 1, pfade: ['tools/x.mjs'], checks: gruen, kommentare: [urteil], ...extra }) })
const stand = (pr, extra) => echteWelt({ gh: ghRest({}), repo: REPO, merger: mergerAttrappe(pr, extra) }).pruefstand(63)
gleich('Prüfstand bereit → Kandidat ja', stand(mergerPr()), { kette: 'Kette grün', kandidat: true, grund: 'Stufe 1, Kette grün, Prüfer-Urteil ok zum Kopf' })
gleich('Prüfstand Mergestatus UNKNOWN → nein mit Grund', stand(mergerPr({ mergeStateStatus: 'UNKNOWN' })).grund, 'Mergestatus UNKNOWN, nicht CLEAN')
gleich('Prüfstand Entwurf → nein', [stand(mergerPr({ entwurf: true })).kandidat, stand(mergerPr({ entwurf: true })).grund], [false, 'Entwurf'])
gleich('Prüfstand Daten-PR (chore(data)-Zweig) → nein', stand(mergerPr({ titel: 'chore(data): x', zweig: 'daten/1-x' })).grund, 'Daten-PR (Sache des Sammlers)')
gleich('Prüfstand Kette rot → Kettengrund', stand(mergerPr(), { checks: [{ __typename: 'CheckRun', name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'FAILURE' }] }).kette, 'Check rot: PR-Prüfkette')
let nichtDa = null
try {
  echteWelt({ gh: ghRest({}), repo: REPO, merger: mergerAttrappe(mergerPr({ nummer: 7 })) }).pruefstand(63)
} catch (e) {
  nichtDa = e.message
}
pruefe('Prüfstand: PR nicht in der Offen-Liste → Fehler (nicht „bereit“)', /nicht in der Liste der offenen/.test(nichtDa ?? ''), String(nichtDa))
let zaehlt = 0
const einmal = echteWelt({ gh: ghRest({}), repo: REPO, merger: { offene: () => { zaehlt++; return [mergerPr()] }, details: (p) => ({ ...p, stufe: 1, pfade: [], checks: gruen, kommentare: [urteil] }) } })
einmal.pruefstand(63)
einmal.pruefstand(63)
gleich('Prüfstand: Liste der offenen nur einmal je Lauf geholt', zaehlt, 1)

if (fehler > 0) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('cloud-auftraege.test: ok')
