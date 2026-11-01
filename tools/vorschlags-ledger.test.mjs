// Test: node tools/vorschlags-ledger.test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { berichtAusJsonl, zieheZeile, schluessel, korpusAus, istGedeckt, ledgerZeilen, aehnlich, texteAusListe, lauf } from './vorschlags-ledger.mjs'

const ZEIT = '2999-12-31T10:00:00Z'
const ALT = new Date('2999-12-30T00:00:00Z')
const bericht = (text) => `${JSON.stringify({ type: 'assistant', timestamp: ZEIT, message: { content: [{ type: 'text', text }] } })}\n`
const handback = (text) => `${JSON.stringify({ type: 'assistant', timestamp: ZEIT, message: { content: [{ type: 'tool_use', name: 'SubagentHandback', input: { message: text } }] } })}\n`

// zieheZeile
assert.equal(zieheZeile('Gut: a. Vorschlag: Messläufe nie parallel starten, im Werkzeug-Kopf vermerken\nVeraltet: keine', 'Vorschlag'), 'Messläufe nie parallel starten, im Werkzeug-Kopf vermerken')
assert.equal(zieheZeile('Vorschlag: keine\n', 'Vorschlag'), '')
assert.equal(zieheZeile('Vorschlag: —\n', 'Vorschlag'), '')
assert.equal(zieheZeile('Ergebnis ohne Rückblick', 'Vorschlag'), '')
assert.equal(zieheZeile('Vorschlag: Ein langer Vorschlag hier; Veraltet: die Zeile in Datei x.md', 'Veraltet'), 'die Zeile in Datei x.md')
assert.equal(zieheZeile('Vorschlag: Ein langer Vorschlag hier; Veraltet: die Zeile in Datei x.md', 'Vorschlag'), 'Ein langer Vorschlag hier')

// zieheZeile: voller Vorschlag über mehrere Zeilen, bis Leerzeile oder nächstes Stichwort
const mehrzeilig = 'Rückblick: gut: x\nVorschlag: Ein Gesamtlimit je Test einführen,\ndamit auch offene Aufrufe abgedeckt sind.\nVeraltet: nichts. Prozesse: keine übrig.'
assert.equal(zieheZeile(mehrzeilig, 'Vorschlag'), 'Ein Gesamtlimit je Test einführen, damit auch offene Aufrufe abgedeckt sind.')
assert.equal(zieheZeile('Vorschlag: Erster Satz des Vorschlags\n\nAnderer Absatz danach', 'Vorschlag'), 'Erster Satz des Vorschlags')
// Aufzählungspunkt nach gefüllter Zeile gehört nicht mehr dazu, nach leerer Stichwortzeile schon
assert.equal(zieheZeile('- Vorschlag: Reihenfolge als Pflichttest\n- Prozesse: keine übrig', 'Vorschlag'), 'Reihenfolge als Pflichttest')
assert.equal(zieheZeile('Vorschlag: Erste Idee zum Werkzeug\n- A4 (Hinweis): anderes Thema', 'Vorschlag'), 'Erste Idee zum Werkzeug')
assert.equal(zieheZeile('Vorschlag:\n- erster Punkt der Liste\n- zweiter Punkt der Liste\n\nProzesse: keine', 'Vorschlag'), 'erster Punkt der Liste zweiter Punkt der Liste')
// „Vorschlag:“ mitten in einer Auflage zählt nicht, der Rückblick am Ende gewinnt
assert.equal(zieheZeile('A3: Untertitel falsch. Vorschlag: "Mehr Discs haben einen Kauflink"\n\nRückblick:\n- Vorschlag: Pflichttest für Reihenfolgen\n- Prozesse: keine übrig', 'Vorschlag'), 'Pflichttest für Reihenfolgen')
assert.equal(zieheZeile('Vorschlag: Etwas Langes zum Anfügen. Prozesse: keine übrig.', 'Vorschlag'), 'Etwas Langes zum Anfügen')

// berichtAusJsonl: Handback schlägt letzten Text, auch wenn danach noch Text kommt
const gemischt = handback('Vorschlag: Aus dem Handback gelesen') + bericht('spätere Nachricht')
assert.equal(berichtAusJsonl(gemischt).bericht, 'Vorschlag: Aus dem Handback gelesen')
assert.equal(berichtAusJsonl(bericht('nur Text')).bericht, 'nur Text')
assert.equal(berichtAusJsonl('').ende, null)

// schluessel: Code-Spans und PR-Nummern ganz, Wörter als Stamm, kurze Wörter und Stopp fliegen raus
const s = schluessel('Der `Panel-Bild.mjs` und PR #1234 sollten Messläufe parallel starten')
assert.deepEqual(s.fest.sort(), ['#1234', 'panel-bild.mjs'])
assert.deepEqual(s.stamm.sort(), ['messlä', 'parall', 'starte'])

// istGedeckt: Absatz trägt; verteilt über zwei Absätze zählt nicht; unter 3 Begriffen nie gedeckt
const korpus = korpusAus(['Messläufe laufen nie parallel. Vermerk im Werkzeug-Kopf.\n\nAnderes Thema Wächter Mutation.', 'Zweite Datei: Starten von Läufen'])
assert.equal(istGedeckt('Messläufe nie parallel starten, im Werkzeug-Kopf vermerken', korpus), true)
assert.equal(istGedeckt('Messläufe vermerken, Wächter Mutation prüfen Werkzeug', korpus), false)
assert.equal(istGedeckt('Messläufe parallel', korpus), false)
assert.equal(istGedeckt('Dateiumzug Prozessregister Zeitüberschreitung', korpus), false)

// ledgerZeilen: nur ungedeckte, nur neue Agenten, leere Vorschläge fallen weg
const e = (id, vorschlag) => ({ id, typ: 'bauer', datum: '2999-12-31', vorschlag, veraltet: '' })
const k = korpusAus(['Messläufe nie parallel starten, im Werkzeug-Kopf vermerken'])
const z = ledgerZeilen([e('agent-a1', 'Messläufe nie parallel starten, im Werkzeug-Kopf vermerken'), e('agent-a2', 'Dateiumzug Prozessregister Zeitüberschreitung prüfen'), e('agent-a3', ''), e('agent-a4', 'Dateiumzug Prozessregister Zeitüberschreitung prüfen')], k, ['agent-a4'])
assert.equal(z.length, 1)
assert.match(z[0], /^- \[ \] 2999-12-31 bauer `agent-a2`: Dateiumzug .* → verankern \/ verwerfen: $/)

// Bündeln: ähnliche Vorschläge eine Zeile mit beiden Kennungen, Unähnliches getrennt, Typen/Veraltetes zusammen
const dupA = { id: 'agent-b1', typ: 'analyst', datum: '2999-12-31', vorschlag: 'Fix-PRs bei rotem Bestandsbau bekommen im Merge-Lauf Vorrang, `merge-lauf.mjs` anpassen', veraltet: 'Zeile x' }
const dupB = { id: 'agent-b2', typ: 'bauer', datum: '2999-12-30', vorschlag: 'Im Merge-Lauf bekommen Fix-PRs bei rotem Bestandsbau Vorrang, `merge-lauf.mjs` anpassen', veraltet: '' }
const fremd = e('agent-b3', 'Dateiumzug Prozessregister Zeitüberschreitung prüfen')
assert.equal(aehnlich(dupA.vorschlag, dupB.vorschlag), true)
assert.equal(aehnlich(dupA.vorschlag, fremd.vorschlag), false)
const gebuendelt = ledgerZeilen([dupA, fremd, dupB], [], [])
assert.equal(gebuendelt.length, 2)
assert.match(gebuendelt[0], /^- \[ \] 2999-12-31 analyst\/bauer `agent-b1`, `agent-b2`: Fix-PRs .* Veraltet gemeldet: Zeile x → /)
assert.match(gebuendelt[1], /`agent-b3`/)
// vorhandener Text (offen oder abgehakt) unterdrückt eine neue Wiederholung
const liste = '- [x] 2999-12-29 bauer `agent-b0`: Im Merge-Lauf bekommen Fix-PRs bei rotem Bestandsbau Vorrang, `merge-lauf.mjs` anpassen → verankern / verwerfen: erledigt\n'
assert.deepEqual(texteAusListe(liste), ['Im Merge-Lauf bekommen Fix-PRs bei rotem Bestandsbau Vorrang, `merge-lauf.mjs` anpassen'])
assert.equal(ledgerZeilen([dupA, fremd], [], [], texteAusListe(liste)).length, 1)

// lauf: ganzer Weg über Dateien, zweimal (zweiter Lauf legt nichts doppelt an), Altbericht und fremde Zeile bleiben
const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'vorschlags-ledger-'))
const sub = path.join(wurzel, 'projekte', 'sitzung1', 'subagents')
fs.mkdirSync(sub, { recursive: true })
fs.mkdirSync(path.join(wurzel, 'doku'))
fs.writeFileSync(path.join(wurzel, 'doku', 'regel.md'), 'Messläufe nie parallel starten, im Werkzeug-Kopf vermerken.\n')
fs.writeFileSync(path.join(sub, 'agent-gedeckt.jsonl'), handback('Vorschlag: Messläufe nie parallel starten, im Werkzeug-Kopf vermerken\nVeraltet: keine'))
fs.writeFileSync(path.join(sub, 'agent-offen.jsonl'), handback('Vorschlag: Dateiumzug Prozessregister Zeitüberschreitung prüfen\nVeraltet: die Angabe in Datei x.md zu Läufen'))
fs.writeFileSync(path.join(sub, 'agent-offen.meta.json'), '{"agentType":"pruefer"}')
fs.writeFileSync(path.join(sub, 'agent-ohne.jsonl'), bericht('Ergebnis ohne Rückblick'))
fs.writeFileSync(path.join(sub, 'agent-leer.jsonl'), '')
fs.writeFileSync(path.join(sub, 'agent-alt.jsonl'), `${JSON.stringify({ type: 'assistant', timestamp: '2999-01-01T00:00:00Z', message: { content: [{ type: 'text', text: 'Vorschlag: Uralter Vorschlag zu Zeitüberschreitung Prozessregister' }] } })}\n`)
const aus = path.join(wurzel, 'liste.md')
fs.writeFileSync(aus, '# Kopf\n\nEigene Zeile von Hand\n')
const arg = { projekte: path.join(wurzel, 'projekte'), wurzeln: [path.join(wurzel, 'doku'), path.join(wurzel, 'fehlt')], ausgabe: aus, seit: ALT }
assert.equal(lauf(arg), 1)
const nach1 = fs.readFileSync(aus, 'utf8')
assert.match(nach1, /^# Kopf\n\nEigene Zeile von Hand\n- \[ \] 2999-12-31 pruefer `agent-offen`: Dateiumzug .* Veraltet gemeldet: die Angabe in Datei x\.md zu Läufen/)
assert.ok(!nach1.includes('agent-gedeckt') && !nach1.includes('agent-ohne') && !nach1.includes('agent-alt'))
assert.equal(lauf(arg), 0)
assert.equal(fs.readFileSync(aus, 'utf8'), nach1)
// abgehakte Zeile bleibt Byte für Byte und kommt nicht wieder
const abgehakt = nach1.replace('- [ ] ', '- [x] ')
fs.writeFileSync(aus, abgehakt)
assert.equal(lauf(arg), 0)
assert.equal(fs.readFileSync(aus, 'utf8'), abgehakt)
// Ausgabedatei fehlt noch: Kopf wird angelegt
fs.rmSync(aus)
assert.equal(lauf(arg), 1)
assert.match(fs.readFileSync(aus, 'utf8'), /^# Offene Agenten-Vorschläge\n\n.*\n\n- \[ \] /s)
fs.rmSync(wurzel, { recursive: true, force: true })

console.log('vorschlags-ledger.test: 7 Gruppen (Zeile mehrzeilig, Bericht, Schlüssel, Deckung, Bündeln, abgehakt, Lauf zweimal) grün')
