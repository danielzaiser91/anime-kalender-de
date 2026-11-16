/**
 * `Ladeplatz.tsx` läuft wirklich (react-dom/client auf dem Mini-DOM, Attrappe-Uhr): Der Platzhalter steht, solange geladen wird,
 * zeigt nach 300 ms „Lädt …“ (`role="status"`) und verschwindet nach 8 s, damit der Fuß nicht dauerhaft unsichtbar bleibt.
 * Verschachtelte Ladeplätze teilen sich die Frist (kein Aufblitzen, keine 16 s); der Zeitgeber wird abgeräumt. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h, Fragment } from 'react'
import { createRoot } from 'react-dom/client'
import { attrappeUhr, ignoriereCss, installiereMiniDom, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { Ladeplatz } = await import('../web/src/components/Ladeplatz.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const platz = (w: MiniKnoten) => w.finde((k) => k.getAttribute('data-ladeplatz') !== null).length
const hinweise = (w: MiniKnoten) => w.finde((k) => k.getAttribute('role') === 'status').map((k) => k.textContent)

async function aufbau() {
  const uhr = attrappeUhr()
  const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  const schiebe = (ms: number) => uhr.schiebe(ms, (f) => act(async () => f()))
  const zeige = (baum: unknown) => act(async () => wurzel.render(baum as never))
  /** Baut ab und lässt den Rücksetz-Zeitgeber (0 ms) laufen; danach darf kein Zeitgeber übrig sein. */
  const ende = async () => {
    await act(async () => wurzel.unmount())
    await schiebe(0)
    const offen = uhr.offen()
    dom.entferne()
    return offen
  }
  return { w: dom.wurzel, schiebe, zeige, ende }
}

console.log('Einzelner Ladeplatz')
{
  const t = await aufbau()
  await t.zeige(h(Ladeplatz))
  pruefe('Start: Platzhalter steht, noch kein Hinweis', platz(t.w) === 1 && hinweise(t.w).length === 0, [platz(t.w), hinweise(t.w)])
  await t.schiebe(299)
  pruefe('299 ms: noch kein Hinweis', hinweise(t.w).length === 0, hinweise(t.w))
  await t.schiebe(1)
  pruefe('300 ms: „Lädt …“ als Status', JSON.stringify(hinweise(t.w)) === '["Lädt …"]', hinweise(t.w))
  await t.schiebe(7699)
  pruefe('7999 ms: Platzhalter steht noch', platz(t.w) === 1, platz(t.w))
  await t.schiebe(1)
  pruefe('8000 ms: Platzhalter und Hinweis weg, der Fuß ist wieder sichtbar', platz(t.w) === 0 && hinweise(t.w).length === 0, [platz(t.w), hinweise(t.w)])
  pruefe('Abbauen: kein Zeitgeber übrig', (await t.ende()) === 0)
}

console.log('Ohne Hinweis (Datenbank zeigt schon ihre eigene Ladezeile)')
{
  const t = await aufbau()
  await t.zeige(h(Ladeplatz, { ohneHinweis: true }))
  await t.schiebe(1000)
  pruefe('nach 1 s: Platzhalter ja, Hinweis nein', platz(t.w) === 1 && hinweise(t.w).length === 0, [platz(t.w), hinweise(t.w)])
  pruefe('Abbauen: kein Zeitgeber übrig', (await t.ende()) === 0)
}

console.log('Verschachtelt: eine gemeinsame Frist')
{
  const t = await aufbau()
  await t.zeige(h(Fragment, { key: 'a' }, h(Ladeplatz)))
  await t.schiebe(5000)
  await t.zeige(h(Fragment, { key: 'b' }, h(Ladeplatz)))
  pruefe('Wechsel nach 5 s: kein Aufblitzen, der Platzhalter steht durchgehend', platz(t.w) === 1, platz(t.w))
  pruefe('Wechsel: der Hinweis läuft weiter (Uhr nicht neu gestartet)', hinweise(t.w).length === 1, hinweise(t.w))
  await t.schiebe(2999)
  pruefe('7999 ms seit Beginn: noch da', platz(t.w) === 1, platz(t.w))
  await t.schiebe(1)
  pruefe('8000 ms seit Beginn (nicht seit dem Wechsel): weg', platz(t.w) === 0, platz(t.w))
  await t.zeige(h(Fragment, { key: 'c' }, h(Ladeplatz)))
  pruefe('später neu eingebaut: bleibt weg (keine neue Frist, kein Aufblitzen)', platz(t.w) === 0, platz(t.w))
  pruefe('Abbauen: kein Zeitgeber übrig', (await t.ende()) === 0)
}

console.log('Nächster Seitenaufruf')
{
  const t = await aufbau()
  await t.zeige(h(Ladeplatz))
  await t.schiebe(8000)
  await t.zeige(h(Fragment))
  await t.schiebe(0)
  await t.zeige(h(Ladeplatz))
  pruefe('nach Abbau aller Ladeplätze beginnt die Frist von vorn: Platzhalter steht wieder', platz(t.w) === 1, platz(t.w))
  await t.schiebe(7999)
  pruefe('… und gibt erst nach 8 s wieder auf', platz(t.w) === 1, platz(t.w))
  pruefe('Abbauen: kein Zeitgeber übrig', (await t.ende()) === 0)
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nLadeplatz: Hinweis nach 300 ms, Aufgeben nach 8 s, gemeinsame Frist, Zeitgeber geräumt')
