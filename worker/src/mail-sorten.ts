/**
 * **Die Reihenfolge der Mail**.
 *
 * „tv releases in newsletter separiert anzeigen, vor allem wenn es wiederholungen sind, sind es
 * nebensächliche infos, falls es tv premiere ist, sollte sie auch oben angezeigt werden, da es
 * besonders ist. Generell sollte newsletter so priorisiert sein: Favoriten, Premieren, Finale,
 * Kino, Stream, Kauftitel, TV (wiederholungen)."
 *
 * Daraus wird hier **nur die Einordnung** — wie die Abschnitte heißen und wie sie aussehen, steht
 * in `templates.ts`. Getrennt, damit man die Regeln ohne HTML lesen und prüfen kann.
 *
 * Die TV-Trennung hängt an `tvPremiere`, das der Bau an den Termin schreibt
 * (`shared/tv-signale.ts`): true = erstmals auf Deutsch, false = Wiederholung, **fehlend** =
 * keine Aussage (Sichtung ohne belegte Folgennummer). Fehlendes zählt zu den Wiederholungen —
 * so war die Mail bisher: eine Sichtung ohne Nummer ist keine Premiere, die man ankündigen kann.
 */
import type { ReleaseEvent } from '../../shared/types.ts'

export type Sorte = 'kino' | 'stream' | 'disc' | 'tv-premiere' | 'tv-wiederholung'

/** Wohin gehört dieser Termin? */
export function sorteVon(ev: ReleaseEvent): Sorte {
  if (ev.platform === 'tv') return ev.tvPremiere ? 'tv-premiere' : 'tv-wiederholung'
  if (ev.platform === 'kino') return 'kino'
  if (ev.releaseType === 'disc' || ev.platform === 'disc') return 'disc'
  return 'stream'
}

/**
 * Wie wichtig ist ein Termin **innerhalb** der Favoriten?
 *
 * Daniel wollte „Premieren, Finale" oben — innerhalb einer Rubrik heißt das: Das Finale einer
 * gemerkten Staffel ist der stärkste Grund hinzusehen, danach der Staffelstart, dann jede
 * TV-Premiere. Alles andere bleibt in der Zeitfolge (die entscheidet `dateSections`).
 */
export function wichtigkeit(ev: ReleaseEvent): number {
  if (ev.staffelfinale) return 0
  if (ev.staffelstart) return 1
  if (ev.platform === 'tv' && ev.tvPremiere) return 2
  return 3
}

/** Ein Abzeichen an der Zeile — kurz genug für eine schmale Spalte. */
export function abzeichen(ev: ReleaseEvent): string | undefined {
  if (ev.staffelfinale) return 'Finale'
  if (ev.staffelstart) return 'Start'
  if (ev.platform === 'tv' && ev.tvPremiere) return 'Premiere'
  return undefined
}

/** Die Reihenfolge der Abschnitte — genau die von Daniel genannte. */
export const SORTEN: { sorte: Sorte; titel: string; farbe: string; hinweis: string }[] = [
  { sorte: 'kino', titel: '🎬 Kino', farbe: '#eab308', hinweis: 'Kinostarts und letzte Spieltage.' },
  { sorte: 'stream', titel: '▶ Neu bei den Anbietern', farbe: '#60a5fa', hinweis: 'Neue Folgen und Katalogtitel.' },
  { sorte: 'disc', titel: '💿 Im Handel', farbe: '#22c55e', hinweis: 'Kaufen lohnt sich — hier gibt es die deutsche Fassung.' },
  { sorte: 'tv-premiere', titel: '📺 TV — Premieren', farbe: '#2dd4bf', hinweis: 'Erstmals auf Deutsch im Fernsehen. Nicht verpassen.' },
]
