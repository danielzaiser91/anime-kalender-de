/**
 * Zusicherung zur Kachelzahl (Daniel, 12.10.2026): Ein Titel, der am selben Tag bei mehreren Streaming-Anbietern erscheint,
 * ist eine Kachel (Woche und Monat) — mit den Angaben je Anbieter. Aufruf: `npm run check:logic`.
 * Den echten Bestand prüft `check-kachel-anbieter-bestand.ts` (`check:bestand`).
 */
import type { ReleaseEvent } from '../shared/types.ts'
import { buendeleKacheln } from '../web/src/lib/buendel.ts'
import { anbieterVerlauf, eigenstaendigBeiAnbietern, folgeGemeinsam, vereineAnbieter, zeitGemeinsam } from '../web/src/lib/anbieter-kachel.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ev = (platform: string, extra: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `${platform}-${extra.episode ?? 1}`, releaseSlug: platform, titleId: 7, date: '2026-10-11', releaseType: 'weekly', platform, name: 'X', episode: 2, episodeCount: 12, time: '16:00', ...extra }) as unknown as ReleaseEvent

const kacheln = (termine: ReleaseEvent[]) => vereineAnbieter(buendeleKacheln(termine, () => undefined, (e) => !!e.premiere), eigenstaendigBeiAnbietern)

function einheitenpruefung(): void {
  console.log('\nGleicher Titel am selben Tag bei zwei Anbietern:')
  const zwei = kacheln([ev('crunchyroll'), ev('primevideo')])
  pruefe('ist eine Kachel mit zwei Bündeln, der erste Anbieter führt', zwei.length === 1 && zwei[0]!.length === 2 && zwei[0]![0]![0]!.platform === 'crunchyroll', zwei)
  pruefe('gleiche Folge und Zeit: eine gemeinsame Angabe', zeitGemeinsam(zwei[0]!) && folgeGemeinsam(zwei[0]!))
  const verschieden = kacheln([ev('crunchyroll'), ev('primevideo', { episode: 1, time: '18:00', estimated: true })])
  pruefe('verschiedene Folge und Zeit bleiben je Anbieter erhalten', verschieden.length === 1 && !zeitGemeinsam(verschieden[0]!) && !folgeGemeinsam(verschieden[0]!), verschieden)
  const schaetzung = kacheln([ev('crunchyroll'), ev('primevideo', { estimated: true })])
  pruefe('gleiche Uhrzeit, aber nur bei einem geschätzt: Zeit je Anbieter', !zeitGemeinsam(schaetzung[0]!), schaetzung)
  const bruendel = kacheln([ev('crunchyroll', { id: 'a', episode: 3 }), ev('crunchyroll', { id: 'b', episode: 4 }), ev('primevideo', { episode: 3 })])
  pruefe('weitere Folgen desselben Anbieters bleiben im Bündel', bruendel.length === 1 && bruendel[0]!.length === 2 && bruendel[0]![0]!.length === 2 && !folgeGemeinsam(bruendel[0]!), bruendel)

  console.log('\nWas eigenständig bleibt:')
  pruefe('anderer Titel: eigene Kachel', kacheln([ev('crunchyroll'), ev('primevideo', { titleId: 8 })]).length === 2)
  pruefe('ohne Titelkennung nie zusammenlegen', kacheln([ev('crunchyroll', { titleId: 0 }), ev('primevideo', { titleId: 0 })]).length === 2)
  pruefe('Ausgebliebenes bleibt eigen', kacheln([ev('crunchyroll'), ev('primevideo', { verpasst: { erwartetAm: '2026-10-11' } })]).length === 2)
  pruefe('Premiere bleibt eigen', kacheln([ev('crunchyroll'), ev('primevideo', { premiere: true } as Partial<ReleaseEvent>)]).length === 2)
  pruefe('Sprachhinweis (OmU) bleibt eigen', kacheln([ev('crunchyroll'), ev('primevideo', { sprache: 'omu' })]).length === 2)
  const finale = vereineAnbieter([[ev('crunchyroll', { id: 'a' })], [ev('crunchyroll', { id: 'b', episode: 12 })], [ev('primevideo')]], eigenstaendigBeiAnbietern)
  pruefe('zweites Bündel desselben Anbieters ist eine eigene Kachel', finale.length === 2 && finale[0]!.length === 2 && finale[1]!.length === 1, finale)
  const reihenfolge = kacheln([ev('crunchyroll', { titleId: 1, id: 'x' }), ev('netflix', { titleId: 2, id: 'y' }), ev('primevideo', { titleId: 1, id: 'z' })])
  pruefe('die Kachel steht an der Stelle ihres ersten Bündels', reihenfolge.length === 2 && reihenfolge[0]![0]![0]!.id === 'x' && reihenfolge[0]!.length === 2, reihenfolge)

  console.log('\nFarbleiste:')
  pruefe('ein Anbieter: einfache Farbe', anbieterVerlauf(['#111']) === '#111')
  pruefe('zwei Anbieter: zwei gleich breite harte Felder', anbieterVerlauf(['#111', '#222']) === 'linear-gradient(to right, #111 0% 50%, #222 50% 100%)', anbieterVerlauf(['#111', '#222']))
}

einheitenpruefung()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
