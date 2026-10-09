import { sprecherNormal } from '@shared/sprecher.ts'

/**
 * Was der Sprecher-Filter von einem Titel verlangt: `mit` — mindestens einer der gewählten Sprecher (ODER),
 * `ohne` — keiner der ausgeschlossenen (UND über alle). Beides gilt zusammen und zusätzlich zu allen anderen Filtern.
 */
export interface SprecherAuswahl {
  mit?: ReadonlySet<number>
  ohne?: ReadonlySet<number>
}

export function passtSprecher(titelId: number, auswahl: SprecherAuswahl): boolean {
  if (auswahl.mit && !auswahl.mit.has(titelId)) return false
  return !auswahl.ohne?.has(titelId)
}

/**
 * Baut die Auswahl aus den Namen. `titelIds` liefert die Titel eines Sprechers, `undefined` solange seine Gruppe
 * noch nicht da ist — dann zeigt die Liste lieber nichts als einen Bestand, der den Filter nicht kennt.
 * Ein Name ohne Eintrag in seiner Gruppe (veralteter Link) hat keine Titel: als „mit" findet er nichts, als „ohne" schließt er nichts aus.
 */
export function baueAuswahl(
  mit: readonly string[],
  ohne: readonly string[],
  titelIds: (name: string) => readonly number[] | undefined,
): SprecherAuswahl | undefined {
  if (!mit.length && !ohne.length) return undefined
  const vereinige = (namen: readonly string[]): Set<number> | undefined => {
    const summe = new Set<number>()
    for (const n of namen) {
      const ids = titelIds(n)
      if (!ids) return undefined
      for (const id of ids) summe.add(id)
    }
    return summe
  }
  const mitIds = vereinige(mit)
  const ohneIds = vereinige(ohne)
  if (mitIds === undefined || ohneIds === undefined) return { mit: new Set() }
  return { mit: mit.length ? mitIds : undefined, ohne: ohne.length ? ohneIds : undefined }
}

/** [Name, Titelzahl, Gruppe] wie im Index. */
export type SprecherEintrag = readonly [string, number, string]

const NORMAL = new WeakMap<readonly SprecherEintrag[], string[]>()

function normale(index: readonly SprecherEintrag[]): string[] {
  let n = NORMAL.get(index)
  if (!n) NORMAL.set(index, (n = index.map((e) => sprecherNormal(e[0]))))
  return n
}

/**
 * Vorschläge zur Eingabe: nur Namen aus dem Index, schon Gewählte nicht. Wortanfänge stehen vor Treffern mitten im Wort
 * („mar" findet „Marc Jacobs" vor „Annemarie"); innerhalb einer Stufe bleibt die Reihenfolge des Index (alphabetisch).
 */
export function sprecherVorschlaege(
  index: readonly SprecherEintrag[],
  eingabe: string,
  gewaehlt: ReadonlySet<string>,
  max: number,
): { treffer: SprecherEintrag[]; mehr: number } {
  const q = sprecherNormal(eingabe)
  if (!q) return { treffer: [], mehr: 0 }
  const normal = normale(index)
  const anfang: SprecherEintrag[] = []
  const mitte: SprecherEintrag[] = []
  index.forEach((e, i) => {
    const n = normal[i]!
    const pos = n.indexOf(q)
    if (pos < 0 || gewaehlt.has(e[0])) return
    ;(pos === 0 || n[pos - 1] === ' ' ? anfang : mitte).push(e)
  })
  const alle = [...anfang, ...mitte]
  return { treffer: alle.slice(0, max), mehr: Math.max(0, alle.length - max) }
}

/** Die Titelzeile eines eingeklappten Vorschlags: die ersten drei, der Rest als Zahl. */
export function kurzeTitelzeile(namen: readonly string[], sichtbar = 3): string {
  const kopf = namen.slice(0, sichtbar).join(', ')
  return namen.length > sichtbar ? `${kopf} … + ${namen.length - sichtbar}` : kopf
}
