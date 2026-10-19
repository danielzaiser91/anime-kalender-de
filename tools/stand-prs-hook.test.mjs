/**
 * Test für `tools/claude-global/hooks/stand-prs.js`: PR-Zeilen in stand.md unter „## In Arbeit“ ohne Handarbeit
 * (Daniel 19.10.2026). Feste Zeit über JETZT, Wegwerf-Dateien unter os.tmpdir(), gh als Attrappe.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const HOOK = join(import.meta.dirname, 'claude-global', 'hooks', 'stand-prs.js')
const ATTRAPPE = join(import.meta.dirname, 'stand-prs-gh-attrappe.mjs')
const h = require(HOOK)

const MIN = 60000
const JETZT = Date.parse('2026-10-19T22:30:00Z') // 00:30 in Berlin am 20.10.: UTC-Tag ≠ Berliner Tag
const ADR = 'https://github.com/danielzaiser91/anime-kalender-de/pull/'
const ci = (sha, wort) => ({ author: { login: 'github-actions' }, body: `**Prüfer-Review** für ${sha} - Urteil: **${wort}**\n\nBegründung` })
const mensch = (text) => ({ author: { login: 'danielzaiser91' }, body: text })
function pr(number, felder = {}) {
  const { rollup = 'SUCCESS', kommentare = [ci('abcdef123', 'ok')], ...rest } = felder
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
const gemergt = (number, mergedAt, title = `fix: gemergt ${number}`) => ({ number, title, url: `${ADR}${number}`, mergedAt })

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
// Wortgrenze erst ab Stelle 21 (sonst bliebe zu wenig Titel): Leerzeichen an 20 → hart, an 21 → am Wort
assert.equal(h.kurztitel('Kurzes Wort und dann eineextremlangezusammensetzung').titel, 'Kurzes Wort und dann eineextremlang…')
assert.equal(h.kurztitel('Kurzes Wort und dannX eineextremlangezusammensetzung').titel, 'Kurzes Wort und dannX…')

// --- urteil: jüngstes CI-Urteil, nur github-actions, Kopf verglichen ---
assert.equal(h.urteil(pr(1, { kommentare: [] })), null)
assert.equal(h.urteil(pr(1, { kommentare: [mensch('**Prüfer-Review** für abcdef123 - Urteil: **ok**')] })), null, 'Mensch zählt nicht')
assert.deepEqual(h.urteil(pr(1, { kommentare: [ci('abcdef123', 'aendern'), mensch('x'), ci('abcdef123', 'ok')] })), { wort: 'ok', alt: false })
assert.deepEqual(h.urteil(pr(1, { kommentare: [ci('abcdef123', 'ok'), ci('0123456ab', 'aendern')] })), { wort: 'aendern', alt: true })
assert.deepEqual(h.urteil(pr(1, { kommentare: [ci('abcdef123', 'ok, Checks rot: Kette – Workflows')] })), { wort: 'ok', alt: false })
assert.equal(h.urteil(pr(1, { kommentare: [{ author: { login: 'github-actions' }, body: 'Vorschau: **Prüfer-Review** für abcdef123 - Urteil: **ok**' }] })), null)

// --- zustand und bereit: jede Bedingung einzeln ---
assert.deepEqual(h.zustand(pr(1)), ['Prüfer ok', 'Checks grün'])
assert.deepEqual(h.zustand(pr(1, { title: '[Prüfung rot] chore(data): x', isDraft: true, mergeable: 'CONFLICTING', rollup: 'FAILURE', kommentare: [] })), [
  'Prüfung rot',
  'Entwurf',
  'Konflikt',
  'Prüfer offen',
  'Checks rot',
])
assert.deepEqual(h.zustand(pr(1, { rollup: 'PENDING', kommentare: [ci('0123456ab', 'ok')] })), ['Prüfer ok (älterer Kopf)', 'Checks laufen'])
assert.deepEqual(h.zustand(pr(1, { rollup: 'ERROR' })).at(-1), 'Checks rot')
assert.deepEqual(h.zustand(pr(1, { rollup: 'EXPECTED' })).at(-1), 'Checks laufen')
assert.deepEqual(h.zustand(pr(1, { rollup: null })), ['Prüfer ok'], 'ohne Checks kein Teil')
assert.deepEqual(h.zustand(pr(1, { mergeable: 'UNKNOWN' })), ['Prüfer ok', 'Checks grün'], 'UNKNOWN ist kein Konflikt')
assert.equal(h.bereit(pr(1)), true)
assert.equal(h.bereit(pr(1, { isDraft: true })), false)
assert.equal(h.bereit(pr(1, { mergeable: 'CONFLICTING' })), false)
assert.equal(h.bereit(pr(1, { rollup: 'PENDING' })), false)
assert.equal(h.bereit(pr(1, { kommentare: [ci('abcdef123', 'aendern')] })), false)
assert.equal(h.bereit(pr(1, { kommentare: [ci('0123456ab', 'ok')] })), false, 'Urteil für älteren Kopf')
assert.equal(h.bereit(pr(1, { kommentare: [] })), false)

// --- Zeilen ---
assert.equal(h.offeneZeile(pr(901001)), `- **PR 901001** — Prüfer ok · Checks grün — [PR 901001](${ADR}901001)`)
assert.equal(h.berlin('2026-10-19T22:30:00Z'), '20.10. 00:30', 'Berliner Tag, nicht UTC')
assert.equal(h.berlin('2026-12-31T23:05:00Z'), '01.01. 00:05', 'Jahreswechsel, Winterzeit')
assert.equal(h.berlin('2026-07-01T10:00:00Z'), '01.07. 12:00', 'Sommerzeit')
assert.equal(h.gemergtZeile(gemergt(901009, '2026-10-19T13:35:44Z', 'fix: Netflix')), `- [klein] **Netflix** — gemergt 19.10. 15:35 — [PR 901009](${ADR}901009)`)

// --- notizenAus ---
const altBlock = [
  `- **A** — x — [PR 901001](${ADR}901001)`,
  '  - Notiz A1',
  '   ',
  '    weiter A',
  '---',
  '  - nach Freitext verwaist',
  `- **B** — x — [PR 901002](${ADR}901002)`,
  `- **C ohne Verweis** — x`,
  '  - verwaiste Notiz',
  `- [klein] **D** — gemergt — [PR 901003](${ADR}901003)`,
  '\t- Notiz D',
].join('\n')
assert.deepEqual(h.notizenAus(altBlock), { 901001: ['  - Notiz A1', '    weiter A'], 901003: ['\t- Notiz D'] })

// --- baueBlock: bereite zuerst, sonst neueste zuerst; gemergt im 24-h-Fenster ohne Sammler ---
const offen = [pr(901001, { kommentare: [] }), pr(901002), pr(901003, { rollup: 'FAILURE' }), pr(901004, { isDraft: true })]
const grenze = JETZT - 24 * 60 * MIN
const merge = [
  gemergt(901010, new Date(grenze - 1).toISOString()),
  gemergt(901011, new Date(grenze).toISOString()),
  gemergt(901012, new Date(JETZT - MIN).toISOString(), 'chore(data): Sendezeiten gesammelt'),
  gemergt(901013, new Date(JETZT - 2 * MIN).toISOString()),
  gemergt(901014, null),
]
const block = h.baueBlock({ offen, gemergt: merge }, { 901003: ['  - behalten'], 901011: ['  - auch hier'], 901099: ['  - weg'] }, JETZT)
const nummern = block.map((z) => /\[PR (\d+)\]/.exec(z)?.[1] ?? z.trim())
assert.deepEqual(nummern, [h.AUF, '901002', '901004', '901003', '- behalten', '901001', '901013', '901011', '- auch hier', h.ZU])

// --- ersetzeBlock ---
const STAND = [
  '# Stand',
  '## Daniel-Todo',
  '- 🔴 **Frage** — x',
  '',
  '## In Arbeit (Stand 19.10.)',
  '- ▶ **Handzeile** — bleibt',
  '  - Detail der Handzeile',
  '',
  '',
  '## Als Nächstes (Todo)',
  '- **Später** — x',
  '',
].join('\n')
const prs = { offen: [pr(901002)], gemergt: [] }
const erst = h.ersetzeBlock(STAND, prs, JETZT)
const erwartet = [
  '# Stand',
  '## Daniel-Todo',
  '- 🔴 **Frage** — x',
  '',
  '## In Arbeit (Stand 19.10.)',
  '- ▶ **Handzeile** — bleibt',
  '  - Detail der Handzeile',
  h.AUF,
  h.offeneZeile(pr(901002)),
  h.ZU,
  '',
  '',
  '## Als Nächstes (Todo)',
  '- **Später** — x',
  '',
].join('\n')
assert.equal(erst, erwartet, 'Block am Ende von „In Arbeit“, vor den Leerzeilen; alles andere unverändert')
const mitNotiz = erst.replace(`${h.offeneZeile(pr(901002))}\n`, `${h.offeneZeile(pr(901002))}\n  - Handnotiz\n`)
const zweit = h.ersetzeBlock(mitNotiz, { offen: [pr(901005), pr(901002, { rollup: 'FAILURE' })], gemergt: [] }, JETZT)
assert.ok(zweit.includes(`${h.offeneZeile(pr(901005))}\n${h.offeneZeile(pr(901002, { rollup: 'FAILURE' }))}\n  - Handnotiz\n${h.ZU}`), 'Notiz wandert mit')
assert.equal(zweit.split(h.AUF).length, 2, 'genau ein Block')
assert.equal(h.ersetzeBlock(zweit, { offen: [], gemergt: [] }, JETZT), erst.replace(`${h.offeneZeile(pr(901002))}\n`, ''), 'geschlossener PR: Zeile und Notiz weg')
assert.equal(h.ersetzeBlock('# ohne\n## Als Nächstes\n', prs, JETZT), null)
const amEnde = h.ersetzeBlock('## In Arbeit\n- x', prs, JETZT)
assert.equal(amEnde, `## In Arbeit\n- x\n${h.AUF}\n${h.offeneZeile(pr(901002))}\n${h.ZU}`, 'letzter Abschnitt der Datei')
assert.equal(h.ersetzeBlock('## In Arbeit\n\n## B', prs, JETZT), `## In Arbeit\n${h.AUF}\n${h.offeneZeile(pr(901002))}\n${h.ZU}\n\n## B`)
const zeile = h.offeneZeile(pr(901002))
assert.equal(h.ersetzeBlock('## Info\n- i\n## In Arbeit\n### Gruppe\n- x\n  \n## B', prs, JETZT), `## Info\n- i\n## In Arbeit\n### Gruppe\n- x\n${h.AUF}\n${zeile}\n${h.ZU}\n  \n## B`, 'nur „## In Arbeit“, Unterüberschrift bleibt im Abschnitt, Leerraum-Zeile zählt als leer')
const nurAuf =`## In Arbeit\n${h.AUF}\n- alt\n## B\n`
assert.equal(h.ersetzeBlock(nurAuf, prs, JETZT).split(h.AUF).length, 3, 'ohne Endmarke: neuer Block, alter Text bleibt sichtbar')

// --- sollLaufen ---
const post = (command) => ({ hook_event_name: 'PostToolUse', tool_input: { command } })
const gh = '"/c/Program Files/GitHub CLI/gh.exe"'
for (const befehl of ['create --body-file x', 'merge 1597 --squash', 'close 12', 'ready 12', 'reopen 12', 'edit 12 --title x']) {
  assert.equal(h.sollLaufen(post(`${gh} pr ${befehl}`), JETZT, JETZT), true, `ändernd sofort: ${befehl}`)
}
assert.equal(h.sollLaufen(post('gh pr view 12 --json state'), JETZT - 5 * MIN + 1, JETZT), false, 'lesend: Drossel knapp nicht um')
assert.equal(h.sollLaufen(post('gh pr view 12 --json state'), JETZT - 5 * MIN, JETZT), true, 'lesend: Drossel genau um')
assert.equal(h.sollLaufen(post('gh run list'), 0, JETZT), true)
assert.equal(h.sollLaufen(post('git status'), 0, JETZT), false, 'fremder Befehl nie')
assert.equal(h.sollLaufen(post('gh api repos/x/y'), 0, JETZT), false, 'anderer gh-Befehl nie')
assert.equal(h.sollLaufen(post('echo gh pr merge'), 0, JETZT), true, 'Text mit gh pr zählt (lieber einmal zu oft)')
assert.equal(h.sollLaufen({ hook_event_name: 'UserPromptSubmit' }, JETZT - 5 * MIN + 1, JETZT), false)
assert.equal(h.sollLaufen({ hook_event_name: 'UserPromptSubmit' }, JETZT - 5 * MIN, JETZT), true)
assert.equal(h.sollLaufen({ hook_event_name: 'UserPromptSubmit' }, JETZT - 60 * MIN, JETZT), true)

// --- lauf: Datei, Sperre, Zeilenenden, Änderungszeit, Fehler ---
const ordner = mkdtempSync(join(tmpdir(), 'stand-prs-'))
const datei = join(ordner, 'stand.md')
const env = { STAND_PRS_DATEI: datei, STAND_PRS_ZUSTAND: join(ordner, 'zustand', 'stand-prs.json') }
const antwort = { data: { repository: { offen: { nodes: [pr(901002)] }, gemergt: { nodes: [] } } } }
const ghFest = (args) => {
  assert.deepEqual(args.slice(0, 2), ['api', 'graphql'])
  return JSON.stringify(antwort)
}
const zustand = () => JSON.parse(readFileSync(env.STAND_PRS_ZUSTAND, 'utf8'))
try {
  writeFileSync(datei, STAND.replace(/\n/g, '\r\n'))
  utimesSync(datei, 1700000000, 1700000000)
  assert.equal(h.lauf({ jetzt: true }, { env, gh: ghFest, jetzt: JETZT }), 'geschrieben (1 offen)')
  assert.equal(readFileSync(datei, 'utf8'), erwartet.replace(/\n/g, '\r\n'), 'CRLF bleibt CRLF')
  assert.equal(statSync(datei).mtimeMs, 1700000000 * 1000, 'Änderungszeit bleibt (daniel-dateien.js misst daran)')
  assert.deepEqual(zustand(), { t: JETZT, ergebnis: 'geschrieben (1 offen)' })
  assert.equal(h.lauf({ jetzt: true }, { env, gh: ghFest, jetzt: JETZT }), 'unverändert')
  assert.equal(h.lauf({ hook_event_name: 'UserPromptSubmit' }, { env, gh: ghFest, jetzt: JETZT + MIN }), 'übersprungen', 'Drossel über den Zustand')
  assert.equal(h.lauf(post('gh pr merge 1'), { env, gh: ghFest, jetzt: JETZT + MIN }), 'unverändert', 'ändernder Befehl trotz Drossel')
  assert.ok(!existsSync(`${datei}.pr-sperre`) && !existsSync(`${datei}.pr-neu`), 'keine Reste')

  // Während der Abfrage steht „läuft“ mit Zeit im Zustand: ein zweiter Hook-Aufruf in der Zeit fällt unter die Drossel.
  const ghPrueftZustand = (args) => {
    assert.deepEqual(zustand(), { t: JETZT + 10 * MIN, ergebnis: 'läuft' })
    assert.equal(h.lauf({ hook_event_name: 'UserPromptSubmit' }, { env, gh: ghFest, jetzt: JETZT + 11 * MIN }), 'übersprungen')
    return ghFest(args)
  }
  assert.equal(h.lauf({ jetzt: true }, { env, gh: ghPrueftZustand, jetzt: JETZT + 10 * MIN }), 'unverändert')

  // Sperre direkt: übernommene Sperre trägt die neue Zeit, sonst übernähme sie der nächste Lauf sofort wieder.
  const sp = join(ordner, 'probe.sperre')
  assert.equal(h.sperre(sp, JETZT), true)
  assert.equal(readFileSync(sp, 'utf8'), String(JETZT))
  assert.equal(h.sperre(sp, JETZT + 2 * MIN - 1), false, 'knapp unter SPERRE_ALT')
  assert.equal(h.sperre(sp, JETZT + 2 * MIN), true, 'genau SPERRE_ALT: übernommen')
  assert.equal(readFileSync(sp, 'utf8'), String(JETZT + 2 * MIN))
  assert.equal(h.sperre(sp, JETZT + 3 * MIN), false, 'frisch übernommene Sperre hält')
  writeFileSync(sp, 'Unsinn')
  assert.equal(h.sperre(sp, JETZT), true, 'unlesbare Zeit gilt als verwaist')

  writeFileSync(`${datei}.pr-sperre`, String(JETZT - 2 * MIN + 1))
  assert.equal(h.lauf({ jetzt: true }, { env, gh: ghFest, jetzt: JETZT }), 'gesperrt')
  assert.ok(existsSync(`${datei}.pr-sperre`), 'fremde Sperre bleibt')
  writeFileSync(`${datei}.pr-sperre`, String(JETZT - 2 * MIN))
  writeFileSync(datei, STAND)
  assert.equal(h.lauf({ jetzt: true }, { env, gh: ghFest, jetzt: JETZT }), 'geschrieben (1 offen)', 'verwaiste Sperre wird übernommen')
  assert.ok(!existsSync(`${datei}.pr-sperre`))

  writeFileSync(datei, STAND)
  const kaputt = () => {
    throw new Error('gh: HTTP 502\nmehr')
  }
  assert.equal(h.lauf({ jetzt: true }, { env, gh: kaputt, jetzt: JETZT }), 'Fehler: gh: HTTP 502')
  assert.equal(readFileSync(datei, 'utf8'), STAND, 'bei gh-Fehler unverändert')
  assert.equal(zustand().ergebnis, 'Fehler: gh: HTTP 502')
  assert.match(h.lauf({ jetzt: true }, { env, gh: () => '{"data":{"repository":{"offen":{},"gemergt":{"nodes":[]}}}}', jetzt: JETZT }), /^Fehler: Antwort ohne nodes/)
  writeFileSync(datei, '# ohne Abschnitt\n')
  assert.equal(h.lauf({ jetzt: true }, { env, gh: ghFest, jetzt: JETZT }), 'ohne Abschnitt')
  assert.equal(readFileSync(datei, 'utf8'), '# ohne Abschnitt\n')

  // --- Prozess: echter Einstieg über stdin bzw. --jetzt, gh als Attrappe ---
  const log = join(ordner, 'attrappe.log')
  const prozessEnv = { ...process.env, ...env, STAND_PRS_GH_SKRIPT: ATTRAPPE, STAND_PRS_ATTRAPPE_LOG: log }
  rmSync(env.STAND_PRS_ZUSTAND, { force: true })
  writeFileSync(datei, STAND)
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(post('gh pr create --body-file x')), env: prozessEnv, encoding: 'utf8', windowsHide: true })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout, '', 'async-Hook schreibt nichts nach stdout')
  assert.equal(readFileSync(log, 'utf8'), 'richtig: api graphql\n')
  const text = readFileSync(datei, 'utf8')
  const zeilen = text.split('\n').filter((z) => /\[PR 9010\d\d\]/.test(z))
  assert.deepEqual(zeilen, [
    `- **Zweiter offener PR** — Prüfer ok · Checks grün — [PR 901002](${ADR}901002)`,
    `- **Dritter offener PR** — Prüfer offen · Checks laufen — [PR 901003](${ADR}901003)`,
    `- **Erster offener PR** — Prüfer aendern · Checks rot — [PR 901001](${ADR}901001)`,
  ])
  assert.equal(zustand().ergebnis, 'geschrieben (3 offen)')
  const fremd = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(post('git status')), env: prozessEnv, encoding: 'utf8', windowsHide: true })
  assert.equal(fremd.status, 0)
  assert.equal(readFileSync(log, 'utf8'), 'richtig: api graphql\n', 'fremder Befehl fragt gh nicht')
  const hand = spawnSync(process.execPath, [HOOK, '--jetzt'], { env: prozessEnv, encoding: 'utf8', windowsHide: true })
  assert.equal(hand.stdout, 'stand-prs: unverändert\n')
  const kaputtEin = spawnSync(process.execPath, [HOOK], { input: 'kein json', env: prozessEnv, encoding: 'utf8', windowsHide: true })
  assert.equal(kaputtEin.status, 0, 'ungültige Eingabe stört nie')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('stand-prs-hook.test: ok (Kurztitel, Urteil, Zustand, Bereit, Berlin-Zeit, Notizen, Block, Ersetzen, Drossel, Sperre, CRLF, Änderungszeit, Fehler, Prozess)')
