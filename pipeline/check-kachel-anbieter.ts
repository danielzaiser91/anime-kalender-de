/**
 * Zusicherung zur Kachelzahl (Daniel, 12.10.2026): Ein Titel, der am selben Tag bei mehreren Streaming-Anbietern erscheint,
 * ist eine Kachel (Woche und Monat) — mit den Angaben je Anbieter. Aufruf: `npm run check:logic`.
 * Den echten Bestand prüft `check-kachel-anbieter-bestand.ts` (`check:bestand`).
 */
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { buendeleKacheln } from '../web/src/lib/buendel.ts'
import { anbieterVerlauf, eigenstaendigBeiAnbietern, folgeGemeinsam, kanalAnbieterVon, vereineAnbieter, zeitGemeinsam } from '../web/src/lib/anbieter-kachel.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ev = (platform: string, extra: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `${platform}-${extra.episode ?? 1}`, releaseSlug: platform, titleId: 7, date: '2026-10-11', releaseType: 'weekly', platform, name: 'X', episode: 2, episodeCount: 12, time: '16:00', ...extra }) as unknown as ReleaseEvent

const kacheln = (termine: ReleaseEvent[]) => vereineAnbieter(buendeleKacheln(termine, () => false, (e) => !!e.premiere), eigenstaendigBeiAnbietern)

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

/** Prime Video (Crunchyroll) und Crunchyroll am selben Tag sind die Kachel von Crunchyroll (Daniel, 13.10.2026, Reborn as a Space Mercenary). */
function kanalPruefung(): void {
  console.log('\nPrime-Kanal und sein Anbieter am selben Tag:')
  const releases = new Map(
    [
      ['kanal-cr', { kanal: 'Crunchyroll' }],
      ['kanal-adn', { kanal: 'ADN' }],
      ['kanal-aniverse', { kanal: 'aniverse' }],
      ['prime-pur', {}],
    ].map(([slug, r]) => [slug as string, { slug, ...(r as object) } as unknown as Release]),
  )
  const mitKanal = (termine: ReleaseEvent[]) =>
    vereineAnbieter(buendeleKacheln(termine, () => false, (e) => !!e.premiere), eigenstaendigBeiAnbietern, kanalAnbieterVon(releases))
  const prime = (slug: string, extra: Partial<ReleaseEvent> = {}) => ev('primevideo', { releaseSlug: slug, ...extra })

  const cr = mitKanal([ev('crunchyroll'), prime('kanal-cr')])
  pruefe('Crunchyroll vor dem Kanal: eine Kachel, ein Bündel (Crunchyroll)', cr.length === 1 && cr[0]!.length === 1 && cr[0]![0]![0]!.platform === 'crunchyroll', cr)
  const umgekehrt = mitKanal([prime('kanal-cr'), ev('crunchyroll')])
  pruefe('Kanal vor Crunchyroll: dieselbe Kachel, Crunchyroll führt', umgekehrt.length === 1 && umgekehrt[0]!.length === 1 && umgekehrt[0]![0]![0]!.platform === 'crunchyroll', umgekehrt)
  const adn = mitKanal([ev('adn'), prime('kanal-adn')])
  pruefe('ADN und Kanal ADN: eine Kachel mit einem Bündel', adn.length === 1 && adn[0]!.length === 1 && adn[0]![0]![0]!.platform === 'adn', adn)
  const nurKanal = mitKanal([prime('kanal-cr')])
  pruefe('Ohne Crunchyroll am Tag (Filter nur Prime): der Kanal-Termin bleibt', nurKanal.length === 1 && nurKanal[0]![0]![0]!.platform === 'primevideo', nurKanal)
  const fremd = mitKanal([ev('crunchyroll'), prime('kanal-adn')])
  pruefe('Kanal ADN neben Crunchyroll: geteilte Kachel wie bisher', fremd.length === 1 && fremd[0]!.length === 2, fremd)
  const aniverse = mitKanal([ev('crunchyroll'), prime('kanal-aniverse')])
  pruefe('Kanal ohne eigenen Anbieter (Aniverse): geteilte Kachel wie bisher', aniverse.length === 1 && aniverse[0]!.length === 2, aniverse)
  const pur = mitKanal([ev('crunchyroll'), prime('prime-pur')])
  pruefe('Prime ohne Kanal neben Crunchyroll: geteilte Kachel wie bisher', pur.length === 1 && pur[0]!.length === 2, pur)
  const netflix = mitKanal([ev('crunchyroll'), prime('kanal-cr'), ev('netflix')])
  pruefe('Zweitanbieter daneben: Crunchyroll und Netflix, der Kanal fehlt', netflix.length === 1 && netflix[0]!.map((b) => b[0]!.platform).join() === 'crunchyroll,netflix', netflix)
  const omu = mitKanal([ev('crunchyroll'), prime('kanal-cr', { sprache: 'omu' })])
  pruefe('Kanal-Termin mit Sprachhinweis bleibt eigenständig', omu.length === 2, omu)
  const andererTitel = mitKanal([ev('crunchyroll'), prime('kanal-cr', { titleId: 8 })])
  pruefe('Kanal eines anderen Titels bleibt eigene Kachel', andererTitel.length === 2, andererTitel)
}

einheitenpruefung()
kanalPruefung()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
