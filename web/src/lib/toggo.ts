/**
 * **Was die TOGGO-Pille über die abrufbaren Folgen sagt** (19.09.2026).
 *
 * Gerechnet wird beim Anzeigen, nicht beim Bau: Bei Daima schließt jeden Abend ein
 * 7-Tage-Fenster, der Datensatz ist bis zu einem Tag alt. Zwei gemessene Formen:
 * Daima — fünf Folgen mit je eigenem Fenster (sieben Tage nach der Ausstrahlung),
 * Boruto — 30 Folgen mit einem gemeinsamen Fenster bis 31.12.2026.
 */
import type { WatchLink } from '@shared/types.ts'

type Block = NonNullable<WatchLink['toggo']>[number]

/** Jetzt als „YYYY-MM-DDTHH:MM" in Berliner Ortszeit — dieselbe Form wie im Datensatz. */
export function jetztBerlin(d = new Date()): string {
  const t = Object.fromEntries(
    new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  return `${t.year}-${t.month}-${t.day}T${t.hour}:${t.minute}`
}

const tage = (ab: string, ende: string) => (Date.parse(ende + ':00Z') - Date.parse(ab + ':00Z')) / 86_400_000

/**
 * „Fg. 14–18 · je 7 Tage", „30 Folgen · bis 31.12." oder „gerade keine Folge".
 * `undefined`, wenn für den Weg keine Fenster bekannt sind.
 */
export function toggoAngabe(bloecke: Block[] | undefined, jetzt = jetztBerlin()): string | undefined {
  if (!bloecke) return undefined
  const offen = bloecke.filter((b) => b.ab <= jetzt && jetzt < b.ende)
  if (!offen.length) return 'gerade keine Folge'
  /* Aufeinanderfolgende Blöcke derselben Staffel zu einem Bereich zusammenziehen. */
  const bereiche: { staffel: number; von: number; bis: number }[] = []
  for (const b of [...offen].sort((x, y) => x.staffel - y.staffel || x.von - y.von)) {
    const l = bereiche[bereiche.length - 1]
    if (l && l.staffel === b.staffel && b.von <= l.bis + 1) l.bis = Math.max(l.bis, b.bis)
    else bereiche.push({ staffel: b.staffel, von: b.von, bis: b.bis })
  }
  /*
    Mehr als zwei Bereiche werden zur Anzahl: Boruto gibt je Staffel fünf Folgen frei,
    verteilt über sechs Staffeln — als Liste sprengte das die Pille (19.09.2026).
  */
  const folgen =
    bereiche.length > 2
      ? `${bereiche.reduce((n, b) => n + b.bis - b.von + 1, 0)} Folgen`
      : `Fg. ${bereiche.map((b) => (b.von === b.bis ? b.von : `${b.von}–${b.bis}`)).join(', ')}`
  const enden = new Set(offen.map((b) => b.ende))
  const zusatz =
    enden.size === 1
      ? `bis ${offen[0]!.ende.slice(8, 10)}.${offen[0]!.ende.slice(5, 7)}.`
      : offen.every((b) => Math.abs(tage(b.ab, b.ende) - 7) < 0.1)
        ? 'je 7 Tage'
        : undefined
  return [folgen, zusatz].filter(Boolean).join(' · ')
}
