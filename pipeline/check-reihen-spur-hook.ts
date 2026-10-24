/**
 * Verdrahtung der Reihen-Spur (PR 1913, Prüfer R1): `ReihenSpur` läuft mit einem Mini-Dispatcher für die React-Hooks (kein DOM im Repo),
 * die Effekte laufen gegen eine Fake-Spur mit Fake-`MutationObserver`/`ResizeObserver`/`requestAnimationFrame`.
 * Belegt: Inhaltsänderung misst neu, `requestAnimationFrame` wird nicht ungebunden übergeben (Browser: „Illegal invocation“), Aufräumen läuft.
 * Aufruf: `npm run check:logic`.
 */
import React from 'react'
import { ReihenSpur } from '../web/src/components/detail/reihen-spur.tsx'

let verletzt = 0
function gleich(name: string, ist: unknown, soll: unknown): void {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(ist)}`)
}

type Effekt = () => void | (() => void)
type Fake = { rueckruf: () => void; ziel?: unknown; getrennt: boolean }
const intern = (React as unknown as Record<string, { H: unknown }>).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE

/** Rahmen wie im Browser: nur als Methode von `globalThis` (this undefined/global) aufrufbar, sonst wirft er „Illegal invocation“. */
function streng(name: string, f: (...a: never[]) => unknown) {
  return function (this: unknown, ...a: never[]) {
    if (this !== undefined && this !== globalThis) throw new TypeError(`${name}: Illegal invocation`)
    return f(...a)
  }
}

function lauf(): { beobachter: Fake[]; offen: Map<number, () => void>; zustand: () => { versteckt: boolean }; spur: { scrollWidth: number }; aufraeumen: () => void; abgebrochen: number[] } {
  const beobachter: Fake[] = []
  const offen = new Map<number, () => void>()
  const abgebrochen: number[] = []
  let naechste = 1
  class Beobachter {
    f: Fake
    constructor(rueckruf: () => void) {
      this.f = { rueckruf, getrennt: false }
      beobachter.push(this.f)
    }
    observe(el: unknown) {
      this.f.ziel = el
    }
    disconnect() {
      this.f.getrennt = true
    }
  }
  const g = globalThis as Record<string, unknown>
  g.MutationObserver = Beobachter
  g.ResizeObserver = Beobachter
  g.requestAnimationFrame = streng('requestAnimationFrame', ((f: () => void) => {
    offen.set(naechste, f)
    return naechste++
  }) as never)
  g.cancelAnimationFrame = streng('cancelAnimationFrame', ((id: number) => {
    abgebrochen.push(id)
    offen.delete(id)
  }) as never)

  const speicher: unknown[] = []
  const effekte: Effekt[] = []
  const refs: { current: unknown }[] = []
  let platz = 0
  intern.H = {
    useRef: () => (refs[platz] ??= { current: null }),
    useId: () => 'r0',
    useCallback: (f: unknown) => f,
    useState: (start: unknown) => {
      const i = platz++
      if (!(i in speicher)) speicher[i] = start
      return [speicher[i], (neu: unknown) => (speicher[i] = typeof neu === 'function' ? (neu as (a: unknown) => unknown)(speicher[i]) : neu)]
    },
    useLayoutEffect: (f: Effekt) => void effekte.push(f),
  }
  const t = ((k: string) => k) as never
  ReihenSpur({ titel: 'Hauptserie', gewaehltId: 1, erste: true, t, children: null })
  intern.H = null

  const spur = { scrollWidth: 900, clientWidth: 300, scrollLeft: 0, addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null }
  const ref = refs.find((r) => r.current === null)
  if (!ref) throw new Error('Spur-Ref fehlt')
  ref.current = spur
  const aufraeumer = effekte.map((e) => e()).filter((r): r is () => void => typeof r === 'function')
  const zustand = () => speicher.find((s) => typeof s === 'object' && s !== null && 'versteckt' in s) as { versteckt: boolean }
  return { beobachter, offen, zustand, spur, abgebrochen, aufraeumen: () => aufraeumer.forEach((a) => a()) }
}

const l = lauf()
gleich('Start: Inhalt läuft über, Pfeile sichtbar', l.zustand().versteckt, false)
l.spur.scrollWidth = 300
l.beobachter[0]?.rueckruf()
for (const f of l.offen.values()) f()
gleich('Karten fallen weg (Mutation-Rückruf): Pfeile verschwinden', l.zustand().versteckt, true)
gleich('Beide Beobachter hängen an der Spur', l.beobachter.map((b) => b.ziel === l.spur), [true, true])
l.beobachter[1]?.rueckruf()
const offenVorher = [...l.offen.keys()]
l.aufraeumen()
gleich('Unmount trennt beide Beobachter', l.beobachter.map((b) => b.getrennt), [true, true])
gleich('Unmount bricht den offenen Rahmen ab', [offenVorher.length, l.abgebrochen.includes(offenVorher[0] ?? -1), l.offen.size], [1, true, 0])

if (verletzt > 0) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\ncheck-reihen-spur-hook: Inhaltsänderung misst neu, Rahmen-Funktionen gebunden, Unmount räumt auf ✓')
