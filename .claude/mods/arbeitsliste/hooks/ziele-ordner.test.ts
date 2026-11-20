import { test, expect } from 'claude-code/testing'

import { PANE, ZIELE_ORDNER, zeilen, hat, starte } from './testhilfe'
import { kennzahlText, kugelFarbe, ladeZiele, leseZielPlan, naechsteAufgabe } from './ziele-ordner'

// Echter Inhalt von 3-fehlerfrei/plan.md (20.11.2026 21:50).
const FEHLERFREI = `# Fehlerfrei — Gesamtplan

Rang 3 (F145). Der Prüfer findet keinen Mangel mehr, weil die Mängelklassen schon beim Bauen mechanisch abgefangen werden.

**Kennzahl:** 43 % → 80 % — Anteil der PRs, die der Prüfer in Runde 1 freigibt (Basis 13.11.; Wochenmessung offen)

## Aufgaben
- [aktiv] bauer.md und pruefer.md auf den Kern kürzen — [Aufgabe](aufgaben/bauer-pruefer-kuerzen.md)
- [geplant] Mängel-Bilanz in der Prüfkette — [Aufgabe](aufgaben/bilanz-in-der-kette.md)
- [geplant] Wochenmessung: Freigabe in Runde 1 — [Aufgabe](aufgaben/wochenmessung-runde-1.md)

## Meilensteine
- [erreicht] Prüfer-Mängel 29.10.–13.11. gezählt — [Analyse](../../berichte/pruefer-maengel-2026-11-13.md)
- [in Arbeit] Jede wiederkehrende Mängelklasse ist mechanisch geprüft
- [offen] Prüfer gibt in Runde 1 bei mindestens 80 % der PRs frei
- [offen] Prüfer findet bei mindestens 95 % der PRs keinen Mangel, vier Wochen in Folge
`

// Ohne Kennzahl, 5 von 8 Meilensteinen, nur bald/geplant (gelb); erledigte Aufgabe davor zählt nicht.
const AUTONOMIE = `# Autonomie — Gesamtplan

## Aufgaben
- [erledigt] Nacht-Merger — [Aufgabe](aufgaben/nacht-merger.md)
- [geplant] Lehren mechanisch — [Aufgabe](aufgaben/lehren.md)
- [bald] **Prüfer in der Cloud** — [Aufgabe](aufgaben/pruefer-cloud.md)

## Meilensteine
${['erreicht', 'erreicht', 'erreicht', 'erreicht', 'erreicht', 'in Arbeit', 'offen', 'offen'].map((s, i) => `- [${s}] M${i}`).join('\n')}
`
const NUR_GEPLANT = `# Volle Daten — Gesamtplan\n\n**Kennzahl:** 61 %\n\n## Aufgaben\n- [geplant] Cartoons erfassen — [Aufgabe](aufgaben/cartoons.md)\n\n## Meilensteine\n- [offen] x\n\n## Notizen\n- [offen] zählt nicht\n- [bald] zählt auch nicht\n`
const ZWEI_AKTIV = `# Schnell live — Gesamtplan\n\n## Aufgaben\n- [geplant] Später\n- [aktiv] Erste aktive — [Aufgabe](aufgaben/eins.md)\n- [aktiv] Zweite aktive — [Aufgabe](aufgaben/zwei.md)\n`
const NICHTS_OFFEN = `# Fertig — Gesamtplan\n\n## Aufgaben\n- [erledigt] Alles — [Aufgabe](aufgaben/alles.md)\n\n## Meilensteine\n- [erreicht] x\n`

const O = `${ZIELE_ORDNER}/3-fehlerfrei`

test('leseZielPlan: Name, Kennzahl bis „ — “, Aufgaben mit absolutem Pfad, Meilensteine nur aus ihrem Abschnitt', () => {
  const z = leseZielPlan(FEHLERFREI, O)
  expect([z.name, z.kennzahl, z.erreicht, z.gesamt, z.plan]).toEqual(['Fehlerfrei', '43 % → 80 %', 1, 4, `${O}/plan.md`])
  expect(z.aufgaben.map(a => [a.status, a.titel, a.datei])).toEqual([
    ['aktiv', 'bauer.md und pruefer.md auf den Kern kürzen', `${O}/aufgaben/bauer-pruefer-kuerzen.md`],
    ['geplant', 'Mängel-Bilanz in der Prüfkette', `${O}/aufgaben/bilanz-in-der-kette.md`],
    ['geplant', 'Wochenmessung: Freigabe in Runde 1', `${O}/aufgaben/wochenmessung-runde-1.md`],
  ])
  expect(kugelFarbe(z)).toBe('success')
  expect(naechsteAufgabe(z)?.titel).toBe('bauer.md und pruefer.md auf den Kern kürzen')
  expect(kennzahlText(z)).toBe('43 % → 80 %')
})

test('ohne Kennzahl „x von y Meilensteinen“, nie Prozent; bald vor geplant, gelb', () => {
  const z = leseZielPlan(AUTONOMIE, 'C:/z/2-autonomie')
  expect(kennzahlText(z)).toBe('5 von 8 Meilensteinen')
  expect(kennzahlText(z)).not.toContain('%')
  expect(kugelFarbe(z)).toBe('warning')
  expect(naechsteAufgabe(z)).toEqual({ status: 'bald', titel: 'Prüfer in der Cloud', datei: 'C:/z/2-autonomie/aufgaben/pruefer-cloud.md' })
})

test('nur geplant: grau (Klammerzeilen anderer Abschnitte zählen nicht); zwei aktiv: die erste; nichts offen: keine Aufgabe; ohne Link: kein Pfad', () => {
  const geplant = leseZielPlan(NUR_GEPLANT, 'C:/z/1')
  expect([kugelFarbe(geplant), geplant.gesamt, geplant.aufgaben.length]).toEqual([null, 1, 1])
  expect(naechsteAufgabe(leseZielPlan(NUR_GEPLANT, 'C:/z/1'))?.titel).toBe('Cartoons erfassen')
  const zwei = leseZielPlan(ZWEI_AKTIV, 'C:/z/4')
  expect([kugelFarbe(zwei), naechsteAufgabe(zwei)?.titel]).toEqual(['success', 'Erste aktive'])
  expect(zwei.aufgaben[0]!.datei).toBeNull()
  expect(naechsteAufgabe(leseZielPlan(NICHTS_OFFEN, 'C:/z/5'))).toBeNull()
})

test('ladeZiele: Ordner nach Namen sortiert, nur Ordner, fehlendes plan.md übersprungen, fehlender Zielordner leer', async () => {
  const plaene: Record<string, string> = { 'W/2-autonomie/plan.md': AUTONOMIE, 'W/1-volle-daten/plan.md': NUR_GEPLANT }
  const d = {
    list: async () => [{ name: '2-autonomie', kind: 'dir' }, { name: 'liesmich.md', kind: 'file' }, { name: '3-ohne-plan', kind: 'dir' }, { name: '1-volle-daten', kind: 'dir' }],
    read: async (p: string) => plaene[p] ?? Promise.reject(new Error('ENOENT')),
  }
  expect((await ladeZiele(d, 'W')).map(z => z.name)).toEqual(['Volle Daten', 'Autonomie'])
  expect(await ladeZiele({ list: () => Promise.reject(new Error('ENOENT')), read: d.read }, 'W')).toEqual([])
})

async function pane($: any, on: any, ziele: Record<string, string>, gestartet: string[][] = []) {
  on('process.run', (_$: any, e: any) => { gestartet.push([...e.argv]); return { value: { exitCode: 0, stdout: '', stderr: '' } } as never })
  starte(on, null, [], true, undefined, false, 0, 0, false, ziele)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  return $.ui.mount({ ...PANE, surface: 'terminal' })
}

// Farbe der Kugeln in Kastenreihenfolge: Themenschlüssel oder „grau“ (dimColor).
function kugeln(k: any, aus: string[] = []): string[] {
  if (!k || typeof k !== 'object') return aus
  const kinder = k.children ?? k.props?.children ?? []
  const liste = Array.isArray(kinder) ? kinder : [kinder]
  if (k.type === 'Text' && liste.join('') === '●') aus.push(k.props?.dimColor ? 'grau' : String(k.props?.color))
  for (const c of liste) kugeln(c, aus)
  return aus
}

const VIER = { '1-volle-daten': NUR_GEPLANT, '2-autonomie': AUTONOMIE, '3-fehlerfrei': FEHLERFREI, '4-schnell-live': NICHTS_OFFEN, '5-ohne-plan': undefined as unknown as string }

test('Pane: Kasten „Ziele“ mit Kugel, Name, Kennzahl und darunter die nächste Aufgabe; keine Status-Labels', async ($, on) => {
  const p = await pane($, on, VIER)
  const baum = await p.drawn()
  const z = zeilen(baum)
  expect(hat(baum, 'borderStyle', 'round')).toBe(true)
  expect(z.slice(0, 8)).toEqual([
    'Ziele',
    '● Volle Daten  61 %',
    '↳ Cartoons erfassen',
    '● Autonomie  5 von 8 Meilensteinen',
    '↳ Prüfer in der Cloud',
    '● Fehlerfrei  43 % → 80 %',
    '↳ bauer.md und pruefer.md auf den Kern kürzen',
    '● Fertig  1 von 1 Meilensteinen',
  ])
  expect(z[8]).not.toContain('↳')
  expect(kugeln(baum)).toEqual(['grau', 'warning', 'success', 'grau'])
  expect(z.join('\n')).not.toMatch(/AGENT|QUEUE|CLAUDE|▸ Fehlerfrei/)
  await p.unmount()
})

test('Pane: Name öffnet plan.md, Aufgabe öffnet ihre .md', async ($, on) => {
  const gestartet: string[][] = []
  const p = await pane($, on, { '3-fehlerfrei': FEHLERFREI }, gestartet)
  await p.press({ key: 'ziel:Fehlerfrei' })
  await p.press({ key: 'aufgabe:Fehlerfrei' })
  await new Promise(r => setTimeout(r, 30))
  const pfade = gestartet.map(([prog, pfad]) => [prog, pfad!.replace(/\\/g, '/')])
  expect(pfade).toEqual([
    ['explorer.exe', `${O}/plan.md`],
    ['explorer.exe', `${O}/aufgaben/bauer-pruefer-kuerzen.md`],
  ])
  await p.unmount()
})

test('Pane: ohne Zielordner kein Kasten und kein Fehler', async ($, on) => {
  const p = await pane($, on, {})
  expect(hat(await p.drawn(), 'borderStyle', 'round')).toBe(false)
  expect(zeilen(await p.drawn()).join('\n')).not.toContain('Ziele')
  await p.unmount()
})
