import type { StreamLink, Title } from '../../shared/types.ts'

/** Hat der Weg die Form, in der der Bau sein Ja annimmt: Joyn, oder Prime mit Kanal? */
function darfAbgeleitetSein(s: StreamLink): boolean {
  if (s.dubAbgeleitet === 'joyn-pauschal') return s.platform === 'joyn'
  return s.platform === 'primevideo' && Boolean(s.kanal)
}

/** Zusicherung für die Auslieferung: `dubAbgeleitet` steht nur neben `dub: true` und nur an Joyn bzw. einem Prime-Kanal-Weg. */
export function dubAbgeleitetFehler(titles: Iterable<Title>): string[] {
  const fehler: string[] = []
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      if (!s.dubAbgeleitet) continue
      if (s.dub !== true) fehler.push(`Titel ${t.id}: ${s.url} trägt dubAbgeleitet „${s.dubAbgeleitet}“ ohne dub: true`)
      else if (!darfAbgeleitetSein(s)) fehler.push(`Titel ${t.id}: ${s.url} (${s.platform}) trägt dubAbgeleitet „${s.dubAbgeleitet}“, ist aber weder Joyn noch ein Prime-Kanal-Weg`)
    }
  }
  return fehler
}
