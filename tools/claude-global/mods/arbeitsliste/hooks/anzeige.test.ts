import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { STAND, PANE, BAND, zeilen, hat, oeffneAlle, starte } from './testhilfe'

test('Pane: eine Zeile je Eintrag, ohne Markdown, Later eingeklappt', async ($, on) => {
  starte(on, null)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  const z = zeilen(await pane.drawn())
  const text = z.join('\n')

  expect(z[0]).toBe('○ Autonomer Modus aus')
  expect(text).not.toContain('**')
  expect(text).not.toContain('](')
  expect(text).not.toMatch(/Autonomer Modus — /)
  expect(z).toContain('▾ In Arbeit 3')
  expect(z).toContain('  ● Prüfliste Rooster Fighter (Netflix)')
  expect(z).toContain('  ● Impressum-Anschrift eintragen (Daniel, 10.10. 12:27)')
  expect(z).toContain('▾ Als Nächstes 7')
  expect(z.filter(s => s.startsWith('  ○ '))).toHaveLength(5)
  expect(z).toContain('    + 2 weitere')
  expect(hat(await pane.drawn(), 'wrap', 'wrap')).toBe(true)
  expect(hat(await pane.drawn(), 'wrap', 'truncate-end')).toBe(false)
  expect(text).toContain('Patchnotes ohne Footer')

  await pane.press({ key: 'mehr:todo' })
  const z2 = zeilen(await pane.drawn())
  expect(z2.filter(s => s.startsWith('  ○ '))).toHaveLength(7)
  expect(z2).toContain('    – weniger')

  await pane.press({ key: 'now:0' })
  const z3 = zeilen(await pane.drawn())
  expect(z3.some(s => s.includes('Code fertig und geprüft'))).toBe(true)
  await pane.unmount()
})

// Die Leiste: zwei Knöpfe (Agents, Arbeitsliste) und zwei Bälle, eine Zeile, sonst nichts.
test('Leiste: zwei Knöpfe mit Zahlen, zwei leere Bälle, eine Zeile', async ($, on) => {
  starte(on, null, [], true, MIT_DANIEL, false, 3)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'agents-oeffnen' }))?.props.label).toBe('Agents 3')
  expect((await band.find({ key: 'oeffnen' }))?.props.label).toBe('Arbeitsliste 4')
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).toBe('Agents 3Arbeitsliste 4○○○')
  const baum = JSON.stringify(await band.drawn())
  expect(baum).toContain('{"color":"success"},"children":["○"]')
  expect(baum).toContain('{"color":"warning"},"children":["○"]')
  expect(baum).toContain('{"color":"suggestion"},"children":["○"]')
  await band.unmount()
})

test('Leiste: Prüfer zählen getrennt („Agents 1+2“), ohne Prüfer nur die Zahl', async ($, on) => {
  starte(on, null, [], true, MIT_DANIEL)
  const laeuft = [
    { description: 'Bauer', status: 'running' },
    { description: 'Prüfer PR 12', status: 'running' },
    { description: 'Gegenlesen', type: 'pruefer', status: 'running' },
    { description: 'Prüfer fertig', status: 'done' },
  ]
  on('state.get', (_$, e, next) => ((e as { plugin?: string }).plugin === 'savvy-progress' ? ({ value: { value: laeuft, version: 1 } } as never) : next(e)))
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'agents-oeffnen' }))?.props.label).toBe('Agents 1+2')
  await band.unmount()
})

test('Autonomer Modus an: Endzeit in Statuszeile und Leiste, kein Now-Eintrag', async ($, on) => {
  const bis = new Date(Date.now() + 3_600_000).toISOString()
  starte(on, bis)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  const z = zeilen(await pane.drawn())
  expect(z[0]).toMatch(/^● Autonomer Modus bis \d\d:\d\d$/)
  expect(z).toContain('▾ In Arbeit 3')
  await pane.unmount()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).toBe('Agents 0Arbeitsliste 0◉○○')
  await band.unmount()
})

// Vorher las die Mod eine globale Datei: jede Sitzung hielt sich dann für autonom (Daniel, 14.10.2026).
test('Autonomer Modus: Marker einer fremden Sitzung oder die alte globale Datei zeigen nichts', async ($, on) => {
  starte(on, null)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  expect(zeilen(await pane.drawn())[0]).toBe('○ Autonomer Modus aus')
  await pane.unmount()
})

test('Leiste: Ruhemodus an ist der zweite Ball gefüllt, der erste leer', async ($, on) => {
  starte(on, null, [], true, STAND, true)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s.endsWith('○◉○')).toBe(true)
  await band.unmount()
})


test('Leiste: Ruhemodus sanft zeigt die Sanduhr, solange mehr als 2 Agenten laufen', async ($, on) => {
  starte(on, null, [], true, STAND, 'sanft', 3)
  await $.session.start({ cwd: 'C:/x', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).toBe('Agents 3Arbeitsliste 0○◉⧗○')
  await band.unmount()
})

test('Leiste: Ruhemodus sanft ohne Sanduhr, sobald höchstens 2 Agenten laufen', async ($, on) => {
  starte(on, null, [], true, STAND, 'sanft', 2)
  await $.session.start({ cwd: 'C:/x', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).toBe('Agents 2Arbeitsliste 0○◉○')
  await band.unmount()
})

test('Leiste: Ruhemodus sanft zählt Prüfer nicht — 2 Agenten und 2 Prüfer ohne Sanduhr', async ($, on) => {
  starte(on, null, [], true, STAND, 'sanft', 4, 2)
  await $.session.start({ cwd: 'C:/x', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).toBe('Agents 2+2Arbeitsliste 0○◉○')
  await band.unmount()
})

test('Leiste: Markerdatei „hart“ zeigt keine Sanduhr', async ($, on) => {
  starte(on, null, [], true, STAND, 'hart', 3)
  await $.session.start({ cwd: 'C:/x', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).toBe('Agents 3Arbeitsliste 0○◉○')
  await band.unmount()
})

test('Leiste: leere Markerdatei gilt als sanft, bei 3 Agenten steht die Sanduhr', async ($, on) => {
  starte(on, null, [], true, STAND, true, 3)
  await $.session.start({ cwd: 'C:/x', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).toBe('Agents 3Arbeitsliste 0○◉⧗○')
  await band.unmount()
})

// Desktop zeichnet dieselben Textzeichen wie das Terminal: keine Bilder, die beim Neuzeichnen leer blinken.
test('Leiste auf dem Desktop: Textzeichen statt Bilder, gefüllt = an, leer = aus, drei Farben', async ($, on) => {
  const bis = new Date(Date.now() + 3_600_000).toISOString()
  starte(on, bis, [], true, STAND)
  await $.session.start({ cwd: 'C:/x', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).toBe('Agents 0Arbeitsliste 0◉○○')
  const baum = JSON.stringify(await band.drawn())
  expect(baum).not.toContain('"Svg"')
  expect(baum).toContain('{"color":"success"},"children":["◉"]')
  expect(baum).toContain('{"color":"warning"},"children":["○"]')
  await band.unmount()
})

test('Leiste: die Savvy-Zeile entfällt, nur die eigene bleibt', async ($, on) => {
  starte(on, null, [], false)
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [{ type: 'Text', props: {}, children: ['savvy'] }] }) as never)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).not.toContain('savvy')
  expect(reihe.s.startsWith('Agents ')).toBe(true)
  await band.unmount()
})

test('Pane: auf Terminal und Desktop gezeichnet, ohne Savvy kein Agenten-Abschnitt', async ($, on) => {
  starte(on, null)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface })
    await oeffneAlle(pane)
    const text = zeilen(await pane.drawn()).join('\n')
    expect(text).toContain('Patchnotes ohne Footer')
    expect(text).not.toContain('Agenten')
    await pane.unmount()
  }
})

test('Status bei langen Titeln', async ($, on) => {
  const status: (string | undefined)[] = []
  starte(on, null, status)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  expect(status).toContain('Arbeitsliste: 8 Titel über 36 Zeichen')
})

// Feste Daten weit auseinander (01.01. schon vorbei, 31.12. noch nicht), unabhängig von der Uhrzeit.
const MIT_DANIEL = `${STAND}
## Daniel-Todo
### Jetzt
- 🔵 [klein] **Wenn Zeit ist: Aufräumen** — a
- **rtk-Hook aus settings.json entfernen** — zweiter Block
- 🔴 **Live falsch: Termin prüfen** — b
### Später
- 📅 **01.01. 08:00 Alt fällig prüfen** — x
- 📅 **31.12. 23:59 Spät prüfen** — y
- ⏳ **Impressum-Antwort abwarten** — z
- 🚫 **Rechtsfrage Handlung klären** — w
`

// Text-Farben (Themenschlüssel) je Titel im Baum.
function farben(knoten: unknown, aus: Record<string, { farbe?: string; gedimmt?: boolean }> = {}, text?: any): Record<string, { farbe?: string; gedimmt?: boolean }> {
  if (typeof knoten === 'string') {
    if (text) aus[knoten] = { farbe: text.color, gedimmt: !!text.dimColor }
    return aus
  }
  if (!knoten || typeof knoten !== 'object') return aus
  const k = knoten as { type?: string; props?: Record<string, any>; children?: unknown[] }
  const kinder = k.children ?? (k.props?.children as unknown[] | undefined) ?? []
  for (const c of Array.isArray(kinder) ? kinder : [kinder]) farben(c, aus, k.type === 'Text' ? k.props : text)
  return aus
}

test('Pane: Jetzt nach Dringlichkeit gefärbt und sortiert, Icon statt Nummer, nichts gedimmt', async ($, on) => {
  starte(on, null, [], true, MIT_DANIEL)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  const baum = await pane.drawn()
  const z = zeilen(baum)
  const reihe = ['  🔴 Live falsch: Termin prüfen', '  🟠 rtk-Hook aus settings.json entfernen', '  ⏰ 01.01. 08:00 Alt fällig prüfen', '  🔵 Wenn Zeit ist: Aufräumen']
  expect(reihe.map(r => z.indexOf(r)).every(i => i >= 0)).toBe(true)
  expect(reihe.map(r => z.indexOf(r))).toEqual([...reihe.map(r => z.indexOf(r))].sort((a, b) => a - b))
  const f = farben(baum)
  expect(f['Live falsch: Termin prüfen']).toEqual({ farbe: 'error', gedimmt: false })
  expect(f['rtk-Hook aus settings.json entfernen']).toEqual({ farbe: 'warning', gedimmt: false })
  expect(f['01.01. 08:00 Alt fällig prüfen']).toEqual({ farbe: 'warning', gedimmt: false })
  // [klein] bleibt in Jetzt farbig statt grau
  expect(f['Wenn Zeit ist: Aufräumen']).toEqual({ farbe: 'suggestion', gedimmt: false })
  await pane.unmount()
})

test('Pane: Jetzt und Später getrennt, Icons vorn, Fälliges wandert nach Jetzt', async ($, on) => {
  starte(on, null, [], true, MIT_DANIEL)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  const z = zeilen(await pane.drawn())
  expect(z).toContain('▾ Jetzt 4')
  expect(z).toContain('  🟠 rtk-Hook aus settings.json entfernen')
  expect(z).toContain('  ⏰ 01.01. 08:00 Alt fällig prüfen')
  expect(z).toContain('▾ Später 3')
  expect(z).toContain('  📅 31.12. 23:59 Spät prüfen')
  expect(z).toContain('  ⏳ Impressum-Antwort abwarten')
  expect(z).toContain('  🚫 Rechtsfrage Handlung klären')
  expect(z.indexOf('  📅 31.12. 23:59 Spät prüfen')).toBeLessThan(z.indexOf('  ⏳ Impressum-Antwort abwarten'))
  await pane.unmount()
})

test('Klick auf die Zeile: zu → öffnen mit Fokus, dahinter → nach vorn, vorn → schließen', async ($, on) => {
  starte(on, null)
  let panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[] = []
  const log: string[] = []
  on('ui.panes', () => ({ value: panes }) as never)
  on('ui.open', (_$, e) => { log.push(`open:${(e as { focus?: boolean }).focus}`); return { value: { isPlaced: true } } as never })
  on('ui.close', () => { log.push('close'); return { value: undefined } as never })
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const pane = (isShown: boolean) => [{ id: 'arbeitsliste', title: 'Arbeitsliste', isShown, isFocused: isShown, isPlaced: true }]
  const druecke = async () => {
    await band.press({ key: 'oeffnen' })
    await new Promise(r => setTimeout(r, 30))
  }
  await druecke()
  panes = pane(false)
  await druecke()
  panes = pane(true)
  await druecke()
  expect(log).toEqual(['open:true', 'open:true', 'close'])
  await band.unmount()
})

test('Klick auf „Agents“ schaltet das Savvy-Pane über dessen Befehl, ohne ein eigenes Pane gleicher Kennung zu öffnen', async ($, on) => {
  starte(on, null)
  const log: string[] = []
  on('ui.panes', () => ({ value: [] }) as never)
  on('ui.open', (_$, e) => { log.push(`open:${(e as { id?: string }).id}`); return { value: { isPlaced: true } } as never })
  on('command.run', (_$, e) => { log.push(`befehl:${(e as { command?: string }).command}`); return { text: 'ok' } as never })
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.press({ key: 'agents-oeffnen' })
  await new Promise(r => setTimeout(r, 30))
  expect(log).toEqual(['befehl:agents-info'])
  await band.unmount()
})

const MIT_LINKS = `## Daniel-Todo

### Jetzt

- **Bericht lesen** — siehe [Bericht](berichte/x.md) und https://example.org/a.

### Später

- 📅 **23:59 Marronniers Folge 2 prüfen** — [Prime-Seite](https://www.amazon.de/gp/video/detail/B0HG69RT1Y)

## In Arbeit

- **Eintrag** — Datei C:/code/ai/a.md ist dort.
`

test('Pane: https als Link-Element (blau, unterstrichen), file als schlichter Button; kein Kopieren-Knopf', async ($, on) => {
  starte(on, null, [], true, MIT_LINKS)
  const gestartet: string[][] = []
  on('process.run', (_$, e) => { gestartet.push([...(e as { argv: string[] }).argv]); return { value: { exitCode: 0, stdout: '', stderr: '' } } as never })
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  const links: { href: string; label: string; farbe?: string; unterstrichen?: boolean }[] = []
  const knoepfe: string[] = []
  const alle: string[] = []
  const sammle = (k: any, text?: any) => {
    if (!k || typeof k !== 'object') return
    if (k.type === 'Link') links.push({ href: k.props.href, label: k.props.label, farbe: text?.color, unterstrichen: text?.underline })
    if (k.type === 'Button') alle.push(String(k.props.label ?? ''))
    if (k.type === 'Button' && String(k.props.key ?? '').startsWith('v-')) knoepfe.push(k.props.label)
    for (const c of k.children ?? (Array.isArray(k.props?.children) ? k.props.children : [])) sammle(c, k.type === 'Text' ? k.props : text)
  }
  sammle(await pane.drawn())
  expect(links).toEqual([
    { href: 'https://example.org/a', label: 'a', farbe: 'suggestion', unterstrichen: true },
    { href: 'https://www.amazon.de/gp/video/detail/B0HG69RT1Y', label: 'Prime-Seite', farbe: 'suggestion', unterstrichen: true },
  ])
  expect(knoepfe.map(k => k.trim())).toEqual(['↗ Bericht', '↗ a.md'])
  expect(alle.join('')).not.toContain('⧉')
  expect(alle.join('')).not.toContain('Kopieren')
  await pane.press({ key: 'v-von-0-0' })
  await new Promise(r => setTimeout(r, 30))
  expect(gestartet).toEqual([['explorer.exe', 'C:\\code\\ai\\anime-kalender-de\\daniel-zum-abarbeiten\\berichte\\x.md']])
  await pane.unmount()
})

test('Takt: bei unveränderter Datei schreibt eine Minute keine Atome (keine Neuzeichnung)', async ($, on) => {
  const uhr = mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('fs.read', (_$, e) => (e.path.endsWith('stand.md') ? ({ value: STAND } as never) : ({ deny: 'fehlt' } as never)))
  const schreibt: string[] = []
  let liest = 0
  on('state.set', (_$, e, next) => { schreibt.push(JSON.stringify((e as { ref: unknown }).ref)); return next(e) })
  on('state.get', (_$, e, next) => { liest++; return next(e) })
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const nachStart = schreibt.length
  await uhr.advance(60_000)
  console.log('MESS Schreibzugriffe je Minute (Datei unverändert):', schreibt.length - nachStart, '- beim Start:', nachStart)
  expect(schreibt.length - nachStart).toBe(0)
})

test('Pane: Regelmäßig unten, nach nächstem Lauf sortiert, Chip, Einklappen ab 6, Detail beim Aufklappen', async ($, on) => {
  const zeilenDaten = [
    '- ⟳ **Ohne Termin** — nach jedem Lauf · Rhythmus: nach jedem Sammel-Lauf',
    ...[0, 1, 2, 3, 4, 5].map(h => `- ⟳ **Lauf ${h}** — Datei lauf${h}.yml · Rhythmus: täglich · cron: 0 ${h * 4} * * *`),
  ]
  const stand = STAND + '\n## Regelmäßig (Quelle: x)\n\n' + zeilenDaten.join('\n') + '\n'
  starte(on, null, [], true, stand)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  let z = zeilen(await pane.drawn())
  const start = z.indexOf('▾ Regelmäßig 7')
  expect(start).toBeGreaterThan(z.indexOf('▾ Als Nächstes 7'))
  const reihen = z.slice(start + 1)
  // Chip (9 Zellen, rechtsbündig) · ▸ · Titel; fünf sichtbar, danach „+ 2 weitere“ und die Fußnote
  expect(reihen.slice(0, 5).every(r => /^( {0,7}in \d+ (min|h|d)|    jetzt) ▸ Lauf \d$/.test(r))).toBe(true)
  expect(reihen[5]).toBe('    + 2 weitere')
  expect(reihen[6]).toBe('  Cron UTC · Wecker feuert zur Stunde ±min')
  expect(z.some(r => r.includes('⟳') || r.includes('Cloudflare'))).toBe(false)
  await pane.press({ key: 'mehr:regeln' })
  z = zeilen(await pane.drawn())
  expect(z.some(r => r.trim() === '— ▸ Ohne Termin')).toBe(true)
  await pane.press({ key: 'regel:3' })
  z = zeilen(await pane.drawn())
  expect(z.some(r => /^ +täglich · (heute|morgen) \d\d:\d\d$/.test(r))).toBe(true)
  expect(z).toContain('    Datei lauf2.yml')
  await pane.unmount()
})

test('Pane: In Pipeline über Regelmäßig, Ort-Marke je Zeile, älteste zuerst, leer = ausgeblendet', async ($, on) => {
  const stand =
    STAND +
    '\n## In Pipeline\n\n- [2026-10-10 14:00] **Neuere Änderung** — Ort: worker (Auslieferung offen)\n- [2026-10-09 08:30] **Ältere Änderung** — Ort: pipeline (Bestandsbau)\n- [2026-10-10 15:00] **Ohne Ort angegeben, lang genug** — x\n' +
    '\n## Regelmäßig (Quelle: x)\n\n- ⟳ **Lauf** — Datei l.yml · Rhythmus: täglich · cron: 0 4 * * *\n'
  starte(on, null, [], true, stand)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  let z = zeilen(await pane.drawn())
  const k = z.indexOf('▾ In Pipeline 3')
  expect(k).toBeGreaterThan(z.indexOf('▾ Als Nächstes 7'))
  expect(k).toBeLessThan(z.findIndex(s => s.startsWith('▾ Regelmäßig')))
  expect(z.slice(k + 1, k + 4)).toEqual(['  ⇢ pipeline Ältere Änderung', '  ⇢ worker Neuere Änderung', '  ⇢ ? Ohne Ort angegeben, lang genug'])
  await pane.press({ key: 'pipe:1' })
  z = zeilen(await pane.drawn())
  expect(z).toContain('    Auslieferung offen')
  await pane.unmount()
})

test('Pane: ohne Pipeline-Zeilen kein Bereich', async ($, on) => {
  starte(on, null)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  expect(zeilen(await pane.drawn()).some(s => s.startsWith('In Pipeline'))).toBe(false)
  await pane.unmount()
})

test('Pane: langer Titel bricht auf Panebreite um, gekürzt erst jenseits von zwei Zeilen', async ($, on) => {
  const lang = 'Wochenstart statt Alle Folgen, Termine ohne belegte Synchro gekennzeichnet'
  const sehrLang = 'x'.repeat(200)
  const stand = `## In Arbeit\n\n- **${lang}** — rest\n- **${sehrLang}** — rest\n`
  starte(on, null, [], true, stand)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 45 }, surface: 'terminal' })
  await oeffneAlle(pane)
  const z = zeilen(await pane.drawn())
  // breite 45 - 7 = 38; Gesamt 2 * 38 - 4 = 72: der 74-Zeichen-Titel ist knapp gekürzt, aber nicht auf 38
  const e = z.find(s => s.includes('Wochenstart'))!
  expect(e.length).toBeGreaterThan(60)
  expect(z.find(s => s.includes('xxxx'))!.endsWith('…')).toBe(true)
  await pane.unmount()
})

// 7 Jetzt, 7 In Arbeit (4 normal, 3 klein), 7 Als Nächstes: jeder Bereich zeigt höchstens 5.
const VIELE = [
  '## In Arbeit',
  ...[1, 2, 3, 4].map(n => `- **Arbeit ${n}**`),
  ...[1, 2, 3].map(n => `- [klein] **Klein ${n}**`),
  '## Als Nächstes (Todo)',
  ...[1, 2, 3, 4, 5, 6, 7].map(n => `- Danach ${n}`),
  '## Daniel-Todo',
  '### Jetzt',
  ...[1, 2, 3, 4, 5, 6, 7].map(n => `- 🔴 **Jetzt ${n}**`),
  '',
].join('\n')

test('Pane: jeder Bereich zeigt höchstens 5, der Rest klappt hinter „+ N weitere“ aus und ein', async ($, on) => {
  starte(on, null, [], true, VIELE)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  let z = zeilen(await pane.drawn())
  expect(z).toContain('▾ Jetzt 7')
  expect(z.filter(s => /^ {2}\S+ Jetzt \d$/.test(s))).toHaveLength(5)
  expect(z.filter(s => s.startsWith('  ○ Danach'))).toHaveLength(5)
  expect(z.filter(s => s === '    + 2 weitere')).toHaveLength(2)
  // In Arbeit: 4 normal ohne „weitere“, die 3 Kleinigkeiten hinter ihrem Knopf
  expect(z.filter(s => /^ {2}● Arbeit \d$/.test(s))).toHaveLength(4)
  expect(z).toContain('    + 3 Kleinigkeiten')
  expect(z.some(s => s.includes('Klein 1'))).toBe(false)

  await pane.press({ key: 'mehr:jetzt' })
  z = zeilen(await pane.drawn())
  expect(z.filter(s => /^ {2}\S+ Jetzt \d$/.test(s))).toHaveLength(7)
  expect(z.filter(s => s === '    – weniger')).toHaveLength(1)
  expect(z.filter(s => s.startsWith('  ○ Danach'))).toHaveLength(5)

  await pane.press({ key: 'mehr:klein' })
  z = zeilen(await pane.drawn())
  expect(z.filter(s => s.startsWith('  · Klein'))).toHaveLength(3)
  expect(z).toContain('    – Kleinigkeiten ausblenden')

  await pane.press({ key: 'mehr:klein' })
  await pane.press({ key: 'mehr:jetzt' })
  z = zeilen(await pane.drawn())
  expect(z.filter(s => /^ {2}\S+ Jetzt \d$/.test(s))).toHaveLength(5)
  expect(z).toContain('    + 3 Kleinigkeiten')
  await pane.unmount()
})

test('Pane: ein einzelnes ui.press wirkt, auch nach Neuzeichnung; die Knopf-Kennung bleibt gleich', async ($, on) => {
  starte(on, null, [], true, VIELE)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  const kennungen = async () => {
    const alle: string[] = []
    const sammle = (k: any) => {
      if (!k || typeof k !== 'object') return
      if (k.type === 'Button') alle.push(k.props.key)
      for (const c of k.children ?? k.props?.children ?? []) sammle(c)
    }
    sammle(await pane.drawn())
    return alle
  }
  const vorher = await kennungen()
  expect(new Set(vorher).size).toBe(vorher.length)
  // Einzelner Druck, ohne vorherigen Fokus-Druck
  await $.ui.press({ plugin: 'arbeitsliste', key: 'mehr:todo', requestId: 'arbeitsliste', surface: 'terminal' } as never)
  expect(zeilen(await pane.drawn()).filter(s => s.startsWith('  ○ Danach'))).toHaveLength(7)
  // Zustandswechsel zeichnet neu: dieselben Kennungen (nur das Label wechselt), der nächste einzelne Druck wirkt wieder
  const nachher = await kennungen()
  expect(nachher).toEqual(vorher)
  await $.ui.press({ plugin: 'arbeitsliste', key: 'mehr:todo', requestId: 'arbeitsliste', surface: 'terminal' } as never)
  expect(zeilen(await pane.drawn()).filter(s => s.startsWith('  ○ Danach'))).toHaveLength(5)
  await pane.unmount()
})

test('Pane: aufgeklappt gibt es „Text kopieren“, der Druck legt Titel und Rest in die Zwischenablage', async ($, on) => {
  starte(on, null)
  const kopiert: string[] = []
  on('ui.copy', (_$, e) => {
    kopiert.push((e as { text: string }).text)
    return { value: { isCopied: true } } as never
  })
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  expect(zeilen(await pane.drawn()).some(s => s.includes('Text kopieren'))).toBe(false)

  await pane.press({ key: 'now:0' })
  expect(zeilen(await pane.drawn()).some(s => s.includes('Text kopieren'))).toBe(true)
  await pane.press({ key: 'kopie:now:0' })
  expect(kopiert).toHaveLength(1)
  expect(kopiert[0]).toContain('Patchnotes ohne Footer')
  expect(kopiert[0]).toContain('Code fertig und geprüft')
  await pane.unmount()
})

// Flackern (Daniel, 11.10.2026): ein State-Abo im Render zeichnete die Leiste bei jedem Savvy-Schritt neu.
test('Leiste: der Render liest nichts nach; die Agentenzahl kommt über den 3-s-Takt', async ($, on) => {
  const uhr = mock.clock(on)
  let laeuft = 2
  let savvyLesen = 0
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }) as never)
  on('fs.read', (_$, e) => (e.path.endsWith('stand.md') ? ({ value: STAND } as never) : ({ deny: 'fehlt' } as never)))
  on('state.get', (_$, e, next) => {
    if ((e as { plugin?: string }).plugin !== 'savvy-progress') return next(e)
    savvyLesen++
    const liste = Array.from({ length: laeuft }, () => ({ description: 'Bauer', status: 'running' }))
    return { value: { value: liste, version: savvyLesen } } as never
  })
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const vorMount = savvyLesen
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ key: 'agents-oeffnen' }))?.props.label).toBe('Agents 2')
  expect(savvyLesen).toBe(vorMount)

  laeuft = 3
  await uhr.advance(3_000)
  expect((await band.find({ key: 'agents-oeffnen' }))?.props.label).toBe('Agents 3')
  await band.unmount()
})


// Ein Lauf mit oder ohne Marker messung.an; Rückgabe: alles, was ins Protokoll geschrieben wurde.
async function messLauf($: any, on: On, marker: boolean): Promise<string> {
  const uhr = mock.clock(on)
  const geschrieben: string[] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }) as never)
  on('fs.read', (_$, e) => (e.path.endsWith('stand.md') ? ({ value: STAND } as never) : ({ deny: 'fehlt' } as never)))
  on('fs.exists', (_$, e) => ({ value: marker && e.path.endsWith('messung.an') }) as never)
  on('fs.write', (_$, e) => {
    geschrieben.push(e.path.endsWith('messung.log') ? (e as { text: string }).text : '')
    return { value: undefined } as never
  })
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await uhr.advance(3_000)
  await band.unmount()
  return geschrieben.join('')
}

test('Messung an: eine Zeile je Render samt Dauer, Cache-Treffer und Auslöser', async ($, on) => {
  expect(await messLauf($, on, true)).toMatch(/ render +(neu|cache) +[\d.]+ms auslöser=\S+ terminal/)
})

test('Messung aus: keine Protokolldatei', async ($, on) => {
  expect(await messLauf($, on, false)).toBe('')
})
test('Pane: Standard alle Bereiche zu außer Jetzt; Kopf zeigt Titel und Anzahl; Klick klappt auf und wieder zu', async ($, on) => {
  starte(on, null, [], true, STAND.replace('## In Arbeit', '## Daniel-Todo\n\n### Jetzt\n- 🔴 **Eins prüfen** — x\n\n## In Arbeit'))
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  let z = zeilen(await pane.drawn())
  expect(z).toContain('▾ Jetzt 1')
  expect(z).toContain('  🔴 Eins prüfen — x')
  expect(z).toContain('▸ In Arbeit 3')
  expect(z).toContain('▸ Als Nächstes 7')
  expect(z.some(s => s.includes('Prüfliste Rooster'))).toBe(false)

  await pane.press({ key: 'bereich:arbeit' })
  z = zeilen(await pane.drawn())
  expect(z).toContain('▾ In Arbeit 3')
  expect(z).toContain('  ● Prüfliste Rooster Fighter (Netflix)')
  expect(z).toContain('▸ Als Nächstes 7')

  await pane.press({ key: 'bereich:arbeit' })
  expect(zeilen(await pane.drawn())).toContain('▸ In Arbeit 3')

  await pane.press({ key: 'bereich:jetzt' })
  z = zeilen(await pane.drawn())
  expect(z).toContain('▸ Jetzt 1')
  expect(z).not.toContain('  🔴 Eins prüfen — x')
  await pane.unmount()
})

// Alle Bereiche mit mehr als fünf Zeilen: zu zeigt nur den Kopf, kein „+ N weitere“, keinen Körper.
function standMitAllem(): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const jetzt = new Date(Date.now() - 3_600_000)
  const stempel = `${jetzt.getFullYear()}-${p(jetzt.getMonth() + 1)}-${p(jetzt.getDate())} ${p(jetzt.getHours())}:${p(jetzt.getMinutes())}`
  const reihe = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i + 1))
  return [
    '## Neu und live testbar',
    ...reihe(6, i => `- [${stempel}] **Live ${i}** — [x](https://example.org/${i})`),
    '## Daniel-Todo',
    '### Jetzt',
    ...reihe(6, i => `- 🔴 **Jetzt ${i}**`),
    '### Später',
    ...reihe(6, i => `- ⏳ **Spät ${i}**`),
    '## In Arbeit',
    ...reihe(6, i => `- **Arbeit ${i}**`),
    ...reihe(2, i => `- [klein] **Klein ${i}**`),
    '## Als Nächstes (Todo)',
    ...reihe(6, i => `- Danach ${i}`),
    '## In Pipeline',
    ...reihe(6, i => `- [${stempel}] **Pipe ${i}** — Ort: worker (x)`),
    '## Regelmäßig (Quelle: x)',
    ...reihe(6, i => `- ⟳ **Regel ${i}** — Datei r${i}.yml · Rhythmus: täglich · cron: 0 ${i} * * *`),
    '',
  ].join('\n')
}

const KOEPFE = ['Neu und jetzt live testbar:', 'Später 6', 'In Arbeit 8', 'Als Nächstes 6', 'In Pipeline 6', 'Regelmäßig 6', 'Agenten 6']

test('Pane: alle Bereiche zu zeigen nur den Kopf (außer Jetzt), aufgeklappt Körper und „+ N weitere“', async ($, on) => {
  starte(on, null, [], true, standMitAllem(), false, 6)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  let z = zeilen(await pane.drawn())
  for (const k of KOEPFE) expect(z.some(s => s.startsWith('▸ ') && s.includes(k.replace(' 6', '')))).toBe(true)
  expect(z).toContain('▾ Jetzt 6')
  expect(z.filter(s => s === '    + 1 weitere')).toHaveLength(1)
  for (const wort of ['Live 1', 'Spät 1', 'Arbeit 1', 'Klein', 'Danach', 'Pipe 1', 'Lauf', 'Regel 1', 'Agents öffnen', 'Cron UTC']) {
    expect(z.some(s => s.includes(wort))).toBe(false)
  }
  await oeffneAlle(pane)
  z = zeilen(await pane.drawn())
  expect(z.filter(s => s === '    + 1 weitere').length).toBeGreaterThanOrEqual(7)
  for (const wort of ['Live 1', 'Spät 1', 'Arbeit 1', 'Danach 1', 'Pipe 1', 'Regel 1', 'Agents öffnen', 'Cron UTC']) {
    expect(z.some(s => s.includes(wort))).toBe(true)
  }
  await pane.unmount()
})

test('Pane: leere Bereiche zeigen „nichts“ nur, solange sie offen sind', async ($, on) => {
  starte(on, null, [], true, '## Daniel-Todo\n### Später\n- ⏳ **Warten**\n## In Arbeit\n## Als Nächstes (Todo)\n')
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const nichts = async () => zeilen(await pane.drawn()).filter(s => s === '  nichts').length
  expect(await nichts()).toBe(1)
  await pane.press({ key: 'bereich:jetzt' })
  expect(await nichts()).toBe(0)
  await oeffneAlle(pane)
  expect(await nichts()).toBe(3)
  await pane.unmount()
})

test('Leiste: Sparmodus an ist der dritte Ball gefüllt, das Pane nennt ihn', async ($, on) => {
  starte(on, null, [], true, STAND, false, 0, 0, true)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const reihe = { s: '' }
  zeilen(await band.drawn(), [], reihe)
  expect(reihe.s).toBe('Agents 0Arbeitsliste 0○○◉')
  await band.unmount()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await oeffneAlle(pane)
  expect(zeilen(await pane.drawn())).toContain('● Sparmodus: nur Sonnet mittel und Haiku als Subagenten')
  await pane.unmount()
})
