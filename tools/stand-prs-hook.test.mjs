/**
 * Test für `tools/claude-global/hooks/stand-prs.js`: PR-Zeilen in stand.md unter „## In Arbeit“ ohne Handarbeit
 * (Daniel 19.10.2026). Feste Zeit über JETZT, Wegwerf-Dateien unter os.tmpdir(), gh als Nachbau, der first/last/after
 * und die Sortierung der Abfrage selbst auswertet. Die Block-Fallliste steht in stand-prs-block.test.mjs.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const HOOK = join(import.meta.dirname, 'claude-global', 'hooks', 'stand-prs.js')
const ATTRAPPE = join(import.meta.dirname, 'stand-prs-gh-attrappe.mjs')
const ECHT = JSON.parse(readFileSync(join(import.meta.dirname, 'stand-prs-urteile-echt.json'), 'utf8')).prs
const h = require(HOOK)

const MIN = 60000
const JETZT = Date.parse('2026-10-19T22:30:00Z') // 00:30 in Berlin am 20.10.: UTC-Tag ≠ Berliner Tag
const iso = (ms) => new Date(ms).toISOString()
const ADR = 'https://github.com/danielzaiser91/anime-kalender-de/pull/'
const ci = (sha, wort) => ({ author: { login: 'github-actions' }, body: `**Prüfer-Review** für ${sha} - Urteil: **${wort}**\n\nBegründung` })
const agent = (kopf, wort, runde = '1') => ({ author: { login: 'danielzaiser91' }, body: `Prüfer Runde ${runde}: ${wort}\n\nKopf ${kopf}, mergeable` })
const mensch = (text) => ({ author: { login: 'danielzaiser91' }, body: text })
const OK = [ci('abcdef123', 'ok'), agent('abcdef123', 'freigeben')]
function pr(number, felder = {}) {
  const { rollup = 'SUCCESS', kommentare = OK, ...rest } = felder
  return {
    number,
    title: `fix(bau): PR ${number}`,
    url: `${ADR}${number}`,
    isDraft: false,
    mergeable: 'MERGEABLE',
    headRefOid: 'abcdef1234567890',
    commits: { nodes: [{ commit: { statusCheckRollup: rollup ? { state: rollup } : null } }] },
    comments: { nodes: kommentare },
    ...rest,
  }
}
const gemergt = (number, mergedAt, title = `fix: gemergt ${number}`, updatedAt = mergedAt) => ({ number, title, url: `${ADR}${number}`, mergedAt, updatedAt })

/** gh-Nachbau: wertet die Grenzen der Abfrage aus wie GitHub; jede unbekannte Form der Abfrage ist ein Testfehler. */
function ghNachbau({ offen = [], gemergt: merged = [] }, aufrufe = []) {
  return (args) => {
    aufrufe.push(args)
    assert.deepEqual(args.slice(0, 2), ['api', 'graphql'])
    assert.ok(args.includes('owner=danielzaiser91') && args.includes('name=anime-kalender-de'), 'Repo')
    const query = args.find((a) => a.startsWith('query=')).slice(6)
    const nach = args.find((a) => a.startsWith('nach='))?.slice(5)
    const repo = {}
    if (query.includes('offen:')) {
      const o = /offen: pullRequests\(states: OPEN, first: (\d+), orderBy: \{field: CREATED_AT, direction: ASC\}\)/.exec(query)
      const k = /comments\((first|last): (\d+)\)/.exec(query)
      assert.ok(o && k, 'Form der offenen Abfrage')
      const fenster = (liste) => (k[1] === 'last' ? liste.slice(-Number(k[2])) : liste.slice(0, Number(k[2])))
      const nodes = offen.slice(0, Number(o[1])).map((p) => ({ ...p, comments: { nodes: fenster(p.comments.nodes) } }))
      repo.offen = { pageInfo: { hasNextPage: offen.length > Number(o[1]) }, nodes }
    }
    const g = /gemergt: pullRequests\(states: MERGED, first: (\d+), after: \$nach, orderBy: \{field: UPDATED_AT, direction: (ASC|DESC)\}\)/.exec(query)
    assert.ok(g, 'Form der gemergten Abfrage')
    const sortiert = [...merged].sort((a, b) => (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)) * (g[2] === 'ASC' ? 1 : -1))
    const ab = nach ? Number(nach) : 0
    const ende = ab + Number(g[1])
    repo.gemergt = { pageInfo: { hasNextPage: ende < sortiert.length, endCursor: String(ende) }, nodes: sortiert.slice(ab, ende) }
    return JSON.stringify({ data: { repository: repo } })
  }
}

// --- kurztitel ---
assert.deepEqual(h.kurztitel('fix(bau): Kurz'), { titel: 'Kurz', marke: '' })
assert.deepEqual(h.kurztitel('feat!: Bruch'), { titel: 'Bruch', marke: '' })
assert.deepEqual(h.kurztitel('Regel: Uhrzeit'), { titel: 'Uhrzeit', marke: '' })
assert.deepEqual(h.kurztitel('[Prüfung rot] chore(data): Tiefendurchlauf'), { titel: 'Tiefendurchlauf', marke: 'Prüfung rot' })
assert.deepEqual(h.kurztitel('Titel mit **fett**'), { titel: 'Titel mit fett', marke: '' })
assert.deepEqual(h.kurztitel('fix: Feld [neu] ergänzt'), { titel: 'Feld [neu] ergänzt', marke: '' }, 'Klammer nur vorn')
assert.deepEqual(h.kurztitel('[Prüfung rot] fix: Ein sehr langer Titel, der geschnitten wird'), { titel: 'Ein sehr langer Titel, der…', marke: 'Prüfung rot' })
const lang = h.kurztitel('fix(kalender): Termine ohne belegte Synchro und Wochentakt fallen weg')
assert.equal(lang.titel, 'Termine ohne belegte Synchro und…')
assert.ok(lang.titel.length <= 36, 'Mod-Grenze KURZTITEL_MAX')
assert.equal(h.kurztitel('x'.repeat(36)).titel, 'x'.repeat(36), 'genau 36 bleibt')
assert.equal(h.kurztitel('x'.repeat(37)).titel, `${'x'.repeat(35)}…`, '37 ohne Leerzeichen: hart geschnitten')
assert.equal(h.kurztitel('claude-global: Hook').titel, 'Hook', 'Präfix mit Bindestrich')
assert.equal(h.kurztitel('Termine und Uhrzeiten belegt, danach kommt mehr Text').titel, 'Termine und Uhrzeiten belegt…', 'Satzzeichen vor dem Schnitt fällt')
assert.equal(h.kurztitel('Kurzes Wort und dann eineextremlangezusammensetzung').titel, 'Kurzes Wort und dann eineextremlang…')
assert.equal(h.kurztitel('Kurzes Wort und dannX eineextremlangezusammensetzung').titel, 'Kurzes Wort und dannX…')

// --- ciUrteil: jüngstes, nur github-actions, Kopf verglichen ---
assert.equal(h.ciUrteil(pr(1, { kommentare: [] })), null)
assert.equal(h.ciUrteil(pr(1, { kommentare: [mensch('**Prüfer-Review** für abcdef123 - Urteil: **ok**')] })), null, 'Mensch zählt nicht')
assert.deepEqual(h.ciUrteil(pr(1, { kommentare: [ci('abcdef123', 'aendern'), mensch('x'), ci('abcdef123', 'ok')] })), { wort: 'ok', alt: false })
assert.deepEqual(h.ciUrteil(pr(1, { kommentare: [ci('abcdef123', 'ok'), ci('0123456ab', 'aendern')] })), { wort: 'aendern', alt: true })
assert.deepEqual(h.ciUrteil(pr(1, { kommentare: [ci('abcdef123', 'ok, Checks rot: Kette – Workflows')] })), { wort: 'ok', alt: false })
assert.equal(h.ciUrteil(pr(1, { kommentare: [{ author: { login: 'github-actions' }, body: 'Vorschau: **Prüfer-Review** für abcdef123 - Urteil: **ok**' }] })), null)
assert.equal(h.ciUrteil(pr(1, { kommentare: [{ author: { login: 'github-actions' }, body: 'Prüfer-Review für abcdef123 - Urteil: ok' }] })), null, 'nur fett')

// --- agentUrteil: „Prüfer Runde N: freigeben|ändern“, Kopf aus „Kopf <sha>“ ---
assert.equal(h.agentUrteil(pr(1, { kommentare: [ci('abcdef123', 'ok')] })), null, 'CI zählt nicht als Agent')
assert.deepEqual(h.agentUrteil(pr(1, { kommentare: [agent('abcdef123', 'freigeben'), agent('abcdef123', 'ändern', '2')] })), { runde: '2', wort: 'ändern', alt: false }, 'jüngstes')
assert.deepEqual(h.agentUrteil(pr(1, { kommentare: [agent('0123456ab', 'freigeben')] })), { runde: '1', wort: 'freigeben', alt: true })
assert.deepEqual(h.agentUrteil(pr(1, { kommentare: [mensch('Prüfer: ändern\n\n**Runde 1, geprüfter Kopf abcdef1234567890.**')] })), { runde: '', wort: 'ändern', alt: false }, 'alte Form ohne Runde')
assert.deepEqual(h.agentUrteil(pr(1, { kommentare: [mensch('Prüfer Runde 3: aendern\n\nKopf `abcdef123`')] })), { runde: '3', wort: 'aendern', alt: false })
assert.deepEqual(h.agentUrteil(pr(1, { kommentare: [mensch('Prüfer Runde 4: freigeben [ausnahme]\n\n- `git diff 0123456..abcdef1` stimmt')] })), { runde: '4', wort: 'freigeben', alt: false }, 'ohne „Kopf“: nennt den Kopf')
assert.deepEqual(h.agentUrteil(pr(1, { kommentare: [mensch('Prüfer Runde 1: freigeben\n\nalles gut')] })), { runde: '1', wort: 'freigeben', alt: true }, 'ohne Kopfangabe nie aktuell')
assert.deepEqual(h.agentUrteil(pr(1, { kommentare: [mensch('Prüfer Runde 1: freigeben\n\nKopf 0123456ab, vorher abcdef123')] })), { runde: '1', wort: 'freigeben', alt: true }, 'erste Kopfangabe zählt')
assert.deepEqual(h.agentUrteil(pr(1, { kommentare: [mensch('Prüfer Runde 2: freigeben\n\nKopf `0123456ab`, vorher abcdef123')] })), { runde: '2', wort: 'freigeben', alt: true }, 'Kopf in Backticks')
for (const fremd of ['Prüfer Runde 1, Nachtrag zur Bilanz: x', 'Dirigent: Prüfer Runde 1: freigeben', '## Nachtrag (Prüfer Runde 1: freigeben)', 'Prüfer Runde 1: freigegeben', 'Prüfer: freigebende Stelle fehlt']) {
  assert.equal(h.agentUrteil(pr(1, { kommentare: [mensch(`${fremd}\n\nKopf abcdef123`)] })), null, fremd)
}

// --- echte Kommentare (gh pr view <n> --json headRefOid,comments, 19.10.2026) ---
const echt = (n) => pr(n, { ...ECHT[n], kommentare: ECHT[n].comments.nodes })
assert.deepEqual(h.zustand(echt(1597)), ['CI ok', 'Prüfer R1 ändern (älterer Kopf)', 'Checks grün'], '1597: CI ok auf 1e1929ce0, Agent R1 auf 08798af3f')
assert.deepEqual(h.zustand(echt(1513)), ['CI aendern', 'Prüfer R4 freigeben', 'Checks grün'], '1513: R4 nennt den Kopf im diff')
assert.deepEqual(h.zustand(echt(1524)), ['CI ok', 'Prüfer R1 ändern (älterer Kopf)', 'Checks grün'], '1524: R1 ohne Kopfangabe')
for (const n of [1513, 1524, 1597]) assert.equal(h.bereit(echt(n)), false, `${n} nicht bereit`)

// --- zustand und bereit: jede Bedingung einzeln ---
assert.deepEqual(h.zustand(pr(1)), ['CI ok', 'Prüfer R1 freigeben', 'Checks grün'])
assert.deepEqual(h.zustand(pr(1, { title: '[Prüfung rot] chore(data): x', isDraft: true, mergeable: 'CONFLICTING', rollup: 'FAILURE', kommentare: [] })), [
  'Prüfung rot',
  'Entwurf',
  'Konflikt',
  'CI offen',
  'Prüfer offen',
  'Checks rot',
])
assert.deepEqual(h.zustand(pr(1, { rollup: 'PENDING', kommentare: [ci('0123456ab', 'ok'), agent('0123456ab', 'ändern', '2')] })), ['CI ok (älterer Kopf)', 'Prüfer R2 ändern (älterer Kopf)', 'Checks laufen'])
assert.deepEqual(h.zustand(pr(1, { rollup: 'ERROR' })).at(-1), 'Checks rot')
assert.deepEqual(h.zustand(pr(1, { rollup: 'EXPECTED' })).at(-1), 'Checks laufen')
assert.deepEqual(h.zustand(pr(1, { rollup: null })), ['CI ok', 'Prüfer R1 freigeben'], 'ohne Checks kein Teil')
assert.deepEqual(h.zustand(pr(1, { mergeable: 'UNKNOWN' })).length, 3, 'UNKNOWN ist kein Konflikt')
assert.equal(h.bereit(pr(1)), true)
assert.equal(h.bereit(pr(1, { isDraft: true })), false)
assert.equal(h.bereit(pr(1, { mergeable: 'CONFLICTING' })), false)
assert.equal(h.bereit(pr(1, { rollup: 'PENDING' })), false)
assert.equal(h.bereit(pr(1, { kommentare: [ci('abcdef123', 'aendern'), agent('abcdef123', 'freigeben')] })), false, 'CI ändern')
assert.equal(h.bereit(pr(1, { kommentare: [ci('0123456ab', 'ok'), agent('abcdef123', 'freigeben')] })), false, 'CI auf älterem Kopf')
assert.equal(h.bereit(pr(1, { kommentare: [ci('abcdef123', 'ok'), agent('abcdef123', 'ändern')] })), false, 'Agent ändern')
assert.equal(h.bereit(pr(1, { kommentare: [ci('abcdef123', 'ok'), agent('0123456ab', 'freigeben')] })), false, 'Agent auf älterem Kopf')
assert.equal(h.bereit(pr(1, { kommentare: [ci('abcdef123', 'ok')] })), false, 'ohne Agent-Urteil')
assert.equal(h.bereit(pr(1, { kommentare: [agent('abcdef123', 'freigeben')] })), false, 'ohne CI-Urteil')

// --- Zeilen ---
assert.equal(h.offeneZeile(pr(901001)), `- **PR 901001** — CI ok · Prüfer R1 freigeben · Checks grün — [PR 901001](${ADR}901001)`)
assert.equal(h.hookNummer(h.offeneZeile(pr(901001, { title: '[Prüfung rot] x', isDraft: true, mergeable: 'CONFLICTING', kommentare: [], rollup: null }))), 901001, 'jede eigene Zeile erkennt der Block wieder')
assert.equal(h.berlin('2026-10-19T22:30:00Z'), '20.10. 00:30', 'Berliner Tag, nicht UTC')
assert.equal(h.berlin('2026-12-31T23:05:00Z'), '01.01. 00:05', 'Jahreswechsel, Winterzeit')
assert.equal(h.berlin(Date.parse('2026-07-01T10:00:00Z')), '01.07. 12:00', 'Sommerzeit, Zahl als Zeit')
assert.equal(h.hinweisZeile(JETZT, 'gh: 502'), '- **PR-Liste veraltet** — Stand 20.10. 00:30; Abruf scheitert: gh: 502')
assert.equal(h.hinweisZeile(0, 'x'), '- **PR-Liste veraltet** — Stand unbekannt; Abruf scheitert: x')

// --- reihen: bereite zuerst, sonst neueste zuerst; gemergt im 24-h-Fenster ohne Sammler als eine Sammelzeile ---
const grenze = JETZT - 24 * 60 * MIN
const offenListe = [pr(901001, { kommentare: [] }), pr(901002), pr(901003, { rollup: 'FAILURE' }), pr(901004, { isDraft: true })]
const merge = [
  gemergt(901010, iso(grenze - 1)),
  gemergt(901011, iso(grenze)),
  gemergt(901012, iso(JETZT - MIN), 'chore(data): Sendezeiten gesammelt'),
  gemergt(901013, iso(JETZT - 2 * MIN)),
  gemergt(901014, null),
  gemergt(901015, iso(JETZT - 3 * MIN), 'chore(wache): Wache durchgesehen'),
]
assert.deepEqual(h.reihen({ offen: offenListe, gemergt: merge }, JETZT).map((r) => r.nummer), [901002, 901004, 901003, 901001, 0], 'gemergte: nur die Sammelzeile')
const sammel = h.reihen({ offen: offenListe, gemergt: merge }, JETZT).at(-1).zeile
assert.equal(sammel, `- [klein] **Gemergt in 24 h: 3** — zuletzt 20.10. 00:28 — [alle](${h.GEMERGT_LISTE})`, 'chore(data) fällt, 901010 (zu alt) und 901014 (ohne Merge) zählen nicht, jüngster ist 901013')
assert.deepEqual(h.reihen({ offen: offenListe, gemergt: [gemergt(901012, iso(JETZT - MIN), 'chore(data): x')] }, JETZT).map((r) => r.nummer), [901002, 901004, 901003, 901001], 'ohne gemergte keine Sammelzeile')
assert.deepEqual(h.reihen({ offen: offenListe, gemergt: [merge[3]] }, JETZT).at(-1), { nummer: 0, zeile: `- [klein] **Gemergt in 24 h: 1** — zuletzt 20.10. 00:28 — [alle](${h.GEMERGT_LISTE})` }, 'genau einer')
assert.ok(h.reihen({ offen: offenListe, gemergt: merge }, JETZT).every((r) => h.hookNummer(r.zeile) === r.nummer))

// --- holePrs gegen den Nachbau: Vollständigkeit ---
const imFenster = (n, schritt = MIN) => Array.from({ length: n }, (_, i) => gemergt(901100 + i, iso(JETZT - (i + 1) * schritt)))
const aelter = (n) => Array.from({ length: n }, (_, i) => gemergt(900500 + i, iso(grenze - (i + 1) * MIN)))
let aufrufe = []
const tag = h.holePrs(ghNachbau({ offen: [pr(901001)], gemergt: [...imFenster(31), ...aelter(5)] }, aufrufe), JETZT)
assert.equal(aufrufe.length, 1, '31 Merges in 24 h: eine Abfrage reicht')
assert.match(h.reihen(tag, JETZT).at(-1).zeile, /Gemergt in 24 h: 31[^0-9]/, 'alle 31 gemergten gezählt')
assert.equal(h.reihen(tag, JETZT).length, 2, 'ein offener PR und die Sammelzeile')
aufrufe = []
const viel = h.holePrs(ghNachbau({ gemergt: [...aelter(7), ...imFenster(150)] }, aufrufe), JETZT)
assert.equal(aufrufe.length, 2, '150 Merges: zwei Seiten')
assert.ok(aufrufe[1].includes('nach=100') && aufrufe[1].some((a) => a.startsWith('query=') && !a.includes('offen:')), 'zweite Seite: nur gemergte, ab Cursor')
assert.match(h.reihen(viel, JETZT)[0].zeile, /Gemergt in 24 h: 150/)
aufrufe = []
h.holePrs(ghNachbau({ gemergt: [...imFenster(99), ...aelter(5)] }, aufrufe), JETZT)
assert.equal(aufrufe.length, 1, 'letzter Eintrag der Seite älter als 24 h: nicht weiter blättern')
aufrufe = []
h.holePrs(ghNachbau({ gemergt: [...imFenster(99), gemergt(901999, iso(grenze)), ...aelter(5)] }, aufrufe), JETZT)
assert.equal(aufrufe.length, 2, 'genau an der Grenze: weiter blättern')
const spaetKommentiert = h.holePrs(ghNachbau({ gemergt: [gemergt(901500, iso(grenze - 60 * MIN), 'fix: alt', iso(JETZT - MIN)), ...imFenster(3)] }), JETZT)
assert.match(h.reihen(spaetKommentiert, JETZT)[0].zeile, /Gemergt in 24 h: 3[^0-9]/, 'nach dem Merge kommentiert: zählt nach mergedAt')
assert.throws(() => h.holePrs(ghNachbau({ gemergt: [...imFenster(2001, MIN / 2)] }), JETZT), /mehr als 20 Seiten/)
assert.equal(h.holePrs(ghNachbau({ gemergt: imFenster(2000, MIN / 2) }), JETZT).gemergt.length, 2000, '20 Seiten ohne Rest reichen')
const hundert = Array.from({ length: 100 }, (_, i) => pr(902000 + i))
assert.equal(h.holePrs(ghNachbau({ offen: hundert }), JETZT).offen.length, 100)
assert.throws(() => h.holePrs(ghNachbau({ offen: [...hundert, pr(902100)] }), JETZT), /mehr als 100 offene PRs/)
assert.throws(() => h.holePrs(() => '{"data":{"repository":{"offen":{},"gemergt":{"nodes":[]}}}}', JETZT), /Antwort ohne nodes/)
// Kommentarfenster: die jüngsten 100 (das Urteil steht nach Runden und Nachträgen am Ende)
const geplauder = (n) => Array.from({ length: n }, (_, i) => mensch(`Nachtrag ${i}`))
const neuestes = h.holePrs(ghNachbau({ offen: [pr(901001, { kommentare: [...geplauder(100), ...OK] })] }), JETZT).offen[0]
assert.equal(h.bereit(neuestes), true, 'Urteile hinter 100 älteren Kommentaren')
const kante = h.holePrs(ghNachbau({ offen: [pr(901001, { kommentare: [ci('abcdef123', 'aendern'), ...OK, ...geplauder(98)] })] }), JETZT).offen[0]
assert.deepEqual(h.zustand(kante), ['CI ok', 'Prüfer R1 freigeben', 'Checks grün'], 'Urteil genau am Rand des Fensters')

// --- ghAufruf: gh.exe, falls vorhanden, ohne Fenster ---
let gerufen
const merkeAufruf = (bin, args, opt) => {
  gerufen = { bin, args, opt }
  return 'antwort'
}
assert.equal(h.ghAufruf(['api', 'x'], merkeAufruf, (p) => p === h.GH_WINDOWS), 'antwort')
assert.deepEqual([gerufen.bin, gerufen.args, gerufen.opt.windowsHide, gerufen.opt.timeout], [h.GH_WINDOWS, ['api', 'x'], true, 30000])
h.ghAufruf(['api'], merkeAufruf, () => false)
assert.equal(gerufen.bin, 'gh', 'ohne gh.exe: gh aus dem PATH')

// --- sollLaufen ---
const post = (command) => ({ hook_event_name: 'PostToolUse', tool_input: { command } })
const ghPfad = '"/c/Program Files/GitHub CLI/gh.exe"'
for (const befehl of ['create --body-file x', 'merge 1597 --squash', 'close 12', 'ready 12', 'reopen 12', 'edit 12 --title x']) {
  assert.equal(h.sollLaufen(post(`${ghPfad} pr ${befehl}`), JETZT, JETZT), true, `ändernd sofort: ${befehl}`)
}
assert.equal(h.sollLaufen(post('gh pr view 12 --json state'), JETZT - 5 * MIN + 1, JETZT), false, 'lesend: Drossel knapp nicht um')
assert.equal(h.sollLaufen(post('gh pr view 12 --json state'), JETZT - 5 * MIN, JETZT), true, 'lesend: Drossel genau um')
assert.equal(h.sollLaufen(post('gh run list'), 0, JETZT), true)
assert.equal(h.sollLaufen(post('git status'), 0, JETZT), false, 'fremder Befehl nie')
assert.equal(h.sollLaufen(post('gh api repos/x/y'), 0, JETZT), false, 'anderer gh-Befehl nie')
assert.equal(h.sollLaufen(post('echo gh pr merge'), 0, JETZT), true, 'Text mit gh pr zählt (lieber einmal zu oft)')
assert.equal(h.sollLaufen({ hook_event_name: 'UserPromptSubmit' }, JETZT - 5 * MIN + 1, JETZT), false)
assert.equal(h.sollLaufen({ hook_event_name: 'UserPromptSubmit' }, JETZT - 5 * MIN, JETZT), true)

// --- ausgabe: still, außer laut ---
assert.equal(h.ausgabe({ ergebnis: 'unverändert', erfolg: true }), '')
assert.equal(h.ausgabe({ ergebnis: 'Fehler: x' }), '')
assert.deepEqual(JSON.parse(h.ausgabe({ ergebnis: 'nicht geschrieben: Marken: x', laut: true })), { systemMessage: 'stand-prs.js: nicht geschrieben: Marken: x (stand.md, Abschnitt „In Arbeit“)' })

// --- lauf: Datei, Zustand, Sperre, Fehler über die Zeit ---
const ordner = mkdtempSync(join(tmpdir(), 'stand-prs-'))
try {
  const datei = join(ordner, 'stand.md')
  const zustandDatei = join(ordner, 'state', 'stand-prs.json')
  const env = { STAND_PRS_DATEI: datei, STAND_PRS_ZUSTAND: zustandDatei }
  const zustand = () => JSON.parse(readFileSync(zustandDatei, 'utf8'))
  const lies = () => readFileSync(datei, 'utf8')
  const ALT = Date.parse('2026-10-01T08:00:00Z')
  writeFileSync(datei, '# Stand\r\n## In Arbeit (Stand 31.12.2999 00:00)\r\n- ▶ **Hand** — bleibt\r\n\r\n## Als Nächstes\r\n- 🔵 x\r\n')
  utimesSync(datei, new Date(ALT), new Date(ALT))
  const daten = { offen: [pr(901001, { kommentare: [] }), pr(901002)], gemergt: [gemergt(901009, iso(JETZT - MIN))] }
  const jetztLauf = (gh, t) => h.lauf({ jetzt: true }, { env, gh, jetzt: t })

  assert.deepEqual(jetztLauf(ghNachbau(daten), JETZT), { ergebnis: 'geschrieben (3 Zeilen)', erfolg: true })
  assert.ok(lies().includes(`${h.AUF}\r\n- **PR 901002** — CI ok · Prüfer R1 freigeben · Checks grün — [PR 901002](${ADR}901002)\r\n`), 'bereit oben, CRLF')
  assert.ok(!/[^\r]\n/.test(lies()), 'keine nackte LF-Zeile')
  assert.equal(statSync(datei).mtimeMs, ALT, 'Änderungszeit bleibt')
  assert.deepEqual(zustand(), { t: JETZT, ergebnis: 'geschrieben (3 Zeilen)', erfolg: JETZT })
  assert.ok(!existsSync(`${datei}.pr-sperre`) && !existsSync(`${datei}.pr-neu`), 'keine Reste')
  assert.deepEqual(jetztLauf(ghNachbau(daten), JETZT + 1), { ergebnis: 'unverändert', erfolg: true })
  assert.deepEqual(h.lauf({ hook_event_name: 'UserPromptSubmit' }, { env, gh: ghNachbau(daten), jetzt: JETZT + 2 }), { ergebnis: 'übersprungen' }, 'Drossel')

  // Zwei Läufe: einer hält die Sperre (frisch: warten, verwaist: übernehmen); Handänderung während der Abfrage bleibt.
  writeFileSync(`${datei}.pr-sperre`, String(JETZT))
  assert.deepEqual(jetztLauf(ghNachbau(daten), JETZT + 2 * MIN - 1), { ergebnis: 'gesperrt' })
  assert.ok(existsSync(`${datei}.pr-sperre`), 'fremde Sperre bleibt')
  assert.deepEqual(jetztLauf(ghNachbau(daten), JETZT + 2 * MIN), { ergebnis: 'unverändert', erfolg: true }, 'verwaiste Sperre übernommen')
  const mitHandzeile = (args) => {
    writeFileSync(datei, lies().replace('- 🔵 x\r\n', '- 🔵 x\r\n- 🔵 **Während der Abfrage**\r\n'))
    return ghNachbau({ ...daten, offen: [pr(901003)] })(args)
  }
  assert.equal(jetztLauf(mitHandzeile, JETZT + 3 * MIN).ergebnis, 'geschrieben (2 Zeilen)')
  assert.ok(lies().includes('- 🔵 **Während der Abfrage**\r\n') && lies().includes('[PR 901003]') && !lies().includes('[PR 901001]'))

  // Abruffehler: still bis VERALTET nach dem letzten Erfolg, danach Hinweiszeile und laut; Erfolg räumt sie weg.
  const kaputt = () => {
    throw new Error('gh: HTTP 502\nDetails')
  }
  const erfolg = zustand().erfolg
  const vorFehler = lies()
  assert.deepEqual(jetztLauf(kaputt, erfolg + 30 * MIN), { ergebnis: 'Fehler: gh: HTTP 502' })
  assert.equal(lies(), vorFehler, 'bis 30 min: Datei unberührt')
  assert.equal(zustand().erfolg, erfolg, 'Fehler verschiebt den letzten Erfolg nicht')
  const veraltet = jetztLauf(kaputt, erfolg + 31 * MIN)
  assert.deepEqual(veraltet, { ergebnis: 'veraltet: gh: HTTP 502', laut: true })
  assert.ok(lies().includes(`${h.AUF}\r\n- **PR-Liste veraltet** — Stand ${h.berlin(erfolg)}; Abruf scheitert: gh: HTTP 502\r\n- **PR 901003**`), 'Hinweis, alte Reihen bleiben')
  assert.match(JSON.parse(h.ausgabe(veraltet)).systemMessage, /veraltet: gh: HTTP 502/)
  const mitHinweis = lies()
  assert.deepEqual(jetztLauf(kaputt, erfolg + 32 * MIN), { ergebnis: 'veraltet: gh: HTTP 502', laut: true }, 'bleibt laut')
  assert.equal(lies(), mitHinweis, 'Hinweis nicht doppelt')
  assert.equal(jetztLauf(ghNachbau(daten), erfolg + 33 * MIN).ergebnis, 'geschrieben (3 Zeilen)')
  assert.ok(!lies().includes('PR-Liste veraltet'), 'Erfolg entfernt den Hinweis')

  // Ohne Zustand (erster Lauf, Abruf scheitert): sofort sichtbar, „Stand unbekannt“.
  rmSync(zustandDatei)
  assert.equal(jetztLauf(kaputt, JETZT).laut, true)
  assert.ok(lies().includes('Stand unbekannt; Abruf scheitert: gh: HTTP 502'))

  // Kaputte Marke, leere oder fehlende Datei: nichts schreiben, laut.
  const zweiMarken = lies().replace(h.ZU, `${h.AUF}\r\n${h.ZU}`)
  writeFileSync(datei, zweiMarken)
  assert.deepEqual(jetztLauf(ghNachbau(daten), JETZT + 40 * MIN), { ergebnis: 'nicht geschrieben: Marken: 2× Anfangs-, 1× Endmarke', laut: true })
  assert.equal(lies(), zweiMarken)
  writeFileSync(datei, '')
  assert.deepEqual(jetztLauf(ghNachbau(daten), JETZT + 41 * MIN), { ergebnis: 'nicht geschrieben: kein Abschnitt „## In Arbeit“', laut: true })
  assert.equal(lies(), '')
  rmSync(datei)
  const fehlt = jetztLauf(ghNachbau(daten), JETZT + 42 * MIN)
  assert.match(fehlt.ergebnis, /^Fehler: ENOENT/)
  assert.equal(fehlt.laut, true)
  assert.ok(!existsSync(`${datei}.pr-sperre`), 'Sperre nach Fehler frei')

  // Prozess: Hook-Eingabe auf stdin, gh als Attrappe; still bei Erfolg, systemMessage bei kaputter Marke.
  writeFileSync(datei, '## In Arbeit (Stand 31.12.2999 00:00)\n- Hand\n')
  rmSync(zustandDatei)
  const log = join(ordner, 'attrappe.log')
  const prozessEnv = { ...process.env, ...env, STAND_PRS_GH_SKRIPT: ATTRAPPE, STAND_PRS_ATTRAPPE_LOG: log }
  const hook = (eingabe) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(eingabe), env: prozessEnv, encoding: 'utf8', windowsHide: true })
  const p1 = hook({ hook_event_name: 'UserPromptSubmit' })
  assert.equal(p1.status, 0, p1.stderr)
  assert.equal(p1.stdout, '', 'Erfolg ist still')
  assert.ok(lies().startsWith(`## In Arbeit (Stand 31.12.2999 00:00)\n- Hand\n${h.AUF}\n- **Zweiter offener PR** — CI ok · Prüfer R1 freigeben · Checks grün`), lies())
  assert.equal(readFileSync(log, 'utf8'), 'richtig: api graphql\n')
  writeFileSync(datei, `${lies()}\n${h.ZU}\n`)
  const p2 = hook(post('"/c/Program Files/GitHub CLI/gh.exe" pr merge 901002 --squash'))
  assert.deepEqual(JSON.parse(p2.stdout), { systemMessage: 'stand-prs.js: nicht geschrieben: Marken: 1× Anfangs-, 2× Endmarke (stand.md, Abschnitt „In Arbeit“)' })
  const p3 = spawnSync(process.execPath, [HOOK, '--jetzt'], { env: { ...prozessEnv, STAND_PRS_ATTRAPPE_LOG: join(ordner, 'nie', 'x.log') }, encoding: 'utf8', windowsHide: true })
  assert.match(p3.stdout, /^stand-prs: Fehler: /, 'Attrappe scheitert: Fehler auf stdout')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('stand-prs-hook.test: ok (Kurztitel, CI- und Agent-Urteil, echte Kommentare 1513/1524/1597, Zustand, Bereit, Zeilen, Vollständigkeit, Kommentarfenster, gh ohne Fenster, Drossel, Ausgabe, Lauf)')
