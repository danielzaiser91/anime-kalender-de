/**
 * Hook-Harness für Tests ohne DOM: spielt eine React-Komponente (oder einen Hook) mehrfach durch und stellt dabei die Effekt-Regeln nach —
 * ein Effekt läuft nur beim ersten Durchlauf und bei geänderter Abhängigkeitsliste (`Object.is`), vorher räumt der alte Lauf auf.
 * Ohne Liste läuft er jedes Mal, mit `[]` nur einmal. Der Zustand bleibt zwischen den Durchläufen; neu gerendert wird nur auf Aufruf von `render`.
 */
import React from 'react'

type Aufraeumen = void | (() => void)
type Slot = { wert?: unknown; deps?: readonly unknown[]; aufraeumen?: Aufraeumen }

const intern = (React as unknown as Record<string, { H: unknown }>).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE

function gleicheDeps(alt: readonly unknown[] | undefined, neu: readonly unknown[] | undefined): boolean {
  if (alt === undefined || neu === undefined) return false
  return alt.length === neu.length && neu.every((d, k) => Object.is(d, alt[k]))
}

export type HakenLauf<P> = {
  /** `vorEffekten` bekommt die `useRef`-Objekte in Aufrufreihenfolge — dort hängt der Test seine Fake-Elemente ein, bevor die Effekte laufen. */
  render: (props: P, vorEffekten?: (refs: { current: unknown }[]) => void) => void
  /** Wie Unmount: alle Aufräumfunktionen. */
  schliessen: () => void
}

export function hakenLauf<P>(komponente: (props: P) => unknown): HakenLauf<P> {
  const slots: Slot[] = []
  return {
    render(props, vorEffekten) {
      let i = 0
      const effekte: { slot: Slot; f: () => Aufraeumen; deps?: readonly unknown[] }[] = []
      const refs: { current: unknown }[] = []
      const slot = () => (slots[i++] ??= {})
      const gemerkt = (f: () => unknown, deps: readonly unknown[]) => {
        const s = slot()
        if (!gleicheDeps(s.deps, deps)) {
          s.deps = deps
          s.wert = f()
        }
        return s.wert
      }
      const effekt =(f: () => Aufraeumen, deps?: readonly unknown[]) => {
        const s = slot()
        if (gleicheDeps(s.deps, deps)) return
        effekte.push({ slot: s, f, deps })
      }
      intern.H = {
        useRef: (start: unknown) => {
          const s = slot()
          s.wert ??= { current: start ?? null }
          refs.push(s.wert as { current: unknown })
          return s.wert
        },
        useId: () => 'r0',
        useCallback: (f: unknown, deps: readonly unknown[]) => gemerkt(() => f, deps),
        useMemo: (f: () => unknown, deps: readonly unknown[]) => gemerkt(f, deps),
        useState: (start: unknown) => {
          const s = slot()
          if (!('wert' in s)) s.wert = typeof start === 'function' ? (start as () => unknown)() : start
          return [s.wert, (neu: unknown) => (s.wert = typeof neu === 'function' ? (neu as (a: unknown) => unknown)(s.wert) : neu)]
        },
        useEffect: effekt,
        useLayoutEffect: effekt,
      }
      try {
        komponente(props)
      } finally {
        intern.H = null
      }
      vorEffekten?.(refs)
      for (const e of effekte) if (typeof e.slot.aufraeumen === 'function') e.slot.aufraeumen()
      for (const e of effekte) {
        e.slot.deps = e.deps
        e.slot.aufraeumen = e.f()
      }
    },
    schliessen: () => slots.forEach((s) => typeof s.aufraeumen === 'function' && s.aufraeumen()),
  }
}
