/**
 * Zusicherung: Ein Nein-Handbeleg (`available: false` oder `dub: false`) hält jede Stelle des Baus auf, die einen Weg neu anlegt.
 * Die Stellen: Cartoon-Zwilling (`fehlendeAnbieter`) und JustWatch-Runde „Titel ohne jeden Weg" (`ergaenzeWegeOhneWeg`);
 * die Runde „Abo-Weg mit deutschem Ton" und die Termin-Wege kannten das Nein schon. Anlass: Afro Samurai (1292) und 2.5 Dimensional Seduction (185515), 13.10.2026.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-nein-handbeleg.ts`
 */
import type { StreamLink, Title } from '../shared/types.ts'
import { fehlendeAnbieter } from './bau/cartoon-zu-anime.ts'
import { ergaenzeWegeOhneWeg } from './bau/11-2-2-wege-ohne-weg.ts'
import { dubKey, neinHandbelege } from './lib/dub-confirmed.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const weg = (platform: string): StreamLink => ({ platform, url: `https://example.org/${platform}` }) as StreamLink
const hand = (anilistId: number, platform: string, rest: { dub?: boolean; available?: boolean }) => ({ anilistId, platform, ...rest }) as Parameters<typeof neinHandbelege>[0][number]

console.log('\nNein-Handbelege als Schlüsselmenge:')
{
  const nein = neinHandbelege([hand(1, 'crunchyroll', { dub: false }), hand(2, 'netflix', { available: false }), hand(3, 'adn', { dub: true }), hand(4, 'joyn', {})])
  pruefe('dub: false und available: false zählen, dub: true und Beleg ohne Urteil nicht', nein.size === 2 && nein.has(dubKey(1, 'crunchyroll')) && nein.has(dubKey(2, 'netflix')), [...nein])
}

console.log('\nCartoon-Zwilling übernimmt Anbieter:')
{
  const cartoon = { streams: [weg('crunchyroll'), weg('netflix')] }
  const nein = neinHandbelege([hand(1292, 'crunchyroll', { dub: false })])
  const plattformen = (n: Set<string>, id: number) => fehlendeAnbieter(cartoon, { id, streams: [] }, n).map((s) => s.platform).join()
  pruefe('ohne Nein-Handbeleg kommen beide Anbieter dazu', plattformen(new Set(), 1292) === 'crunchyroll,netflix')
  pruefe('mit Nein-Handbeleg für Crunchyroll kommt nur Netflix dazu', plattformen(nein, 1292) === 'netflix', plattformen(nein, 1292))
  pruefe('das Nein gilt nur dem Anime-Titel, dem es gehört', plattformen(nein, 99) === 'crunchyroll,netflix')
}

console.log('\nJustWatch-Runde „Titel ohne jeden Weg":')
{
  const angebot = (anbieter: string, url: string) => ({ anbieter, art: 'FLATRATE', url })
  const jw = { '185515': { angebote: [angebot('Crunchyroll', 'https://www.crunchyroll.com/de/watch/GG1U2JQM9'), angebot('Netflix', 'https://www.netflix.com/title/1')] } }
  const lauf = (nein: Set<string>) => {
    const titel = { id: 185515, streams: [] } as unknown as Title
    ergaenzeWegeOhneWeg({ titles: new Map([[185515, titel]]), jw, handNein: nein, tmdbMehrdeutig: new Set(), toteAdressen: new Set() })
    return (titel.watchLinks ?? []).map((w) => w.name)
  }
  pruefe('ohne Nein-Handbeleg legt die Runde Crunchyroll und Netflix an', lauf(new Set()).join() === 'Crunchyroll,Netflix', lauf(new Set()))
  const ohne = lauf(neinHandbelege([hand(185515, 'crunchyroll', { dub: false })]))
  pruefe('mit Nein-Handbeleg für Crunchyroll bleibt nur Netflix', ohne.join() === 'Netflix', ohne)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
