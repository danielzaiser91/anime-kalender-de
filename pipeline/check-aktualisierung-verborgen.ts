/**
 * Zusicherungen für `pruefeNachPause` (Prüfung im Verborgenen) und die Verdrahtung des Neuladens mit der Lesestelle
 * (`web/src/lib/aktualisierung.ts`): Fake-Dokument, Attrappe-Uhr, keine echte Zeit. Läuft in `check:logic`.
 */
export {}
const g = globalThis as unknown as Record<string, unknown>
g.__APP_VERSION__ = 'alt-stand'

const { pruefeNachPause, pruefeVersionBeimLaden } = await import('../web/src/lib/aktualisierung.ts')
const { SCHLUESSEL } = await import('../web/src/lib/lesestelle.ts')

const PAUSE = 10 * 60_000
let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

function aufbau() {
  let jetzt = 1_000_000
  const timer = new Map<number, { f: () => void; ms: number }>()
  let nr = 0
  const doc = { hidden: false, hoerer: [] as Array<() => void>, addEventListener(_a: string, f: () => void) { this.hoerer.push(f) } }
  let geprueft = 0
  pruefeNachPause(doc as unknown as Document, () => void geprueft++, {
    jetzt: () => jetzt,
    setze: (f, ms) => { timer.set(++nr, { f, ms }); return nr },
    loesche: (id) => void timer.delete(id),
  })
  const wechsle = (hidden: boolean) => {
    doc.hidden = hidden
    doc.hoerer.forEach((h) => h())
  }
  return { doc, timer, wechsle, vor: (ms: number) => { jetzt += ms }, geprueft: () => geprueft }
}

{
  const t = aufbau()
  t.wechsle(true)
  pruefe('Verbergen setzt genau einen Timer über PAUSE_MS', t.timer.size === 1 && [...t.timer.values()][0].ms === PAUSE, [...t.timer.values()])
  pruefe('vor Ablauf wird nicht geprüft', t.geprueft() === 0)
  const einer = [...t.timer.values()][0]
  einer.f()
  pruefe('Timer im Verborgenen → Prüfung (Neuladen dort, nicht bei der Rückkehr)', t.geprueft() === 1)
}
{
  const t = aufbau()
  t.wechsle(true)
  t.vor(5 * 60_000)
  t.wechsle(false)
  pruefe('Rückkehr nach 5 min löscht den Timer, keine Prüfung', t.timer.size === 0 && t.geprueft() === 0)
}
{
  const t = aufbau()
  t.wechsle(true)
  const einer = [...t.timer.values()][0]
  t.doc.hidden = false // sichtbar, ohne dass der Hörer lief: der Timer darf dann nicht prüfen
  einer.f()
  pruefe('Timer feuert, Tab ist aber sichtbar → keine Prüfung', t.geprueft() === 0)
}
{
  const t = aufbau()
  t.wechsle(true)
  t.wechsle(true)
  pruefe('zweites Verbergen ersetzt den Timer (kein zweiter bleibt liegen)', t.timer.size === 1)
}
{
  const t = aufbau()
  t.wechsle(true)
  t.timer.clear() // Tab eingefroren: Timer lief nie
  t.vor(PAUSE)
  t.wechsle(false)
  pruefe('Rückfall: Rückkehr nach genau PAUSE_MS prüft einmal', t.geprueft() === 1)
}
{
  const t = aufbau()
  t.wechsle(true)
  t.timer.clear()
  t.vor(PAUSE - 1)
  t.wechsle(false)
  pruefe('Rückfall: eine Millisekunde zu kurz prüft nicht', t.geprueft() === 0)
}
{
  const t = aufbau()
  t.wechsle(false)
  pruefe('sichtbar ohne vorheriges Verbergen: keine Prüfung', t.geprueft() === 0)
}

// Verdrahtung: Neuladen speichert die Lesestelle vor `location.reload`
{
  const speicher = new Map<string, string>()
  let neuGeladen = 0
  let gespeichertBeimLaden: string | undefined
  g.sessionStorage = {
    getItem: (k: string) => speicher.get(k) ?? null,
    setItem: (k: string, v: string) => void speicher.set(k, v),
    removeItem: (k: string) => void speicher.delete(k),
  }
  g.location = { pathname: '/', hash: '#/', reload: () => { neuGeladen++; gespeichertBeimLaden = speicher.get(SCHLUESSEL) } }
  g.window = { addEventListener: () => undefined }
  g.document = {
    hidden: false,
    addEventListener: () => undefined,
    querySelector: () => ({ getBoundingClientRect: () => ({ height: 50 }) }),
    querySelectorAll: () => [{ dataset: { datum: '2026-10-29' }, getBoundingClientRect: () => ({ top: 120, bottom: 700, height: 580 }) }],
  }
  g.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ v: 'neuer-stand' }) })
  pruefeVersionBeimLaden()
  await new Promise((fertig) => setTimeout(fertig, 20))
  const got = JSON.parse(gespeichertBeimLaden ?? 'null')
  pruefe('neue Fassung → genau ein Neuladen', neuGeladen === 1, neuGeladen)
  pruefe('die Lesestelle liegt schon im Speicher, wenn neu geladen wird', got?.datum === '2026-10-29' && got.abstand === 70 && got.ort === '/#/', got)
}

if (fehler > 0) {
  console.error(`✖ ${fehler} Fehler`)
  process.exit(1)
}
console.log(`✔ aktualisierung-verborgen: Timer beim Verbergen, Rückkehr löscht, nur wenn noch verborgen, Rückfall nach PAUSE_MS, Lesestelle vor dem Neuladen (${faelle} Fälle)`)
