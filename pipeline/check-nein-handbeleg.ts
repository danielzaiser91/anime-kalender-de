/**
 * Zusicherung: Ein Nein-Handbeleg (`available: false` oder `dub: false`) hält jede Stelle des Baus auf, die einen Weg neu anlegt.
 * Die Stellen: Cartoon-Zwilling (`fehlendeAnbieter`) und JustWatch-Runde „Titel ohne jeden Weg" (`ergaenzeWegeOhneWeg`);
 * die Runde „Abo-Weg mit deutschem Ton" und die Termin-Wege kannten das Nein schon. Anlass: Afro Samurai (1292) und 2.5 Dimensional Seduction (185515), 13.10.2026.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-nein-handbeleg.ts`
 */
import type { StreamLink, Title, WatchLink } from '../shared/types.ts'
import { fehlendeAnbieter } from './bau/cartoon-zu-anime.ts'
import { ergaenzeWegeOhneWeg } from './bau/11-2-2-wege-ohne-weg.ts'
import { dubKey, neinHandbelege, type DubCheck } from './lib/dub-confirmed.ts'
import { bezugswegeTrotzNein, entferneBezugswegeTrotzNein } from './lib/handbeleg-bezugswege.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const weg = (platform: string): StreamLink => ({ platform, url: `https://example.org/${platform}` }) as StreamLink
const hand = (anilistId: number, platform: string, rest: Partial<Pick<DubCheck, 'dub' | 'available' | 'dubRanges'>>) => ({ anilistId, platform, ...rest }) as Parameters<typeof neinHandbelege>[0][number]

console.log('\nNein-Handbelege als Schlüsselmenge:')
{
  const nein = neinHandbelege([hand(1, 'crunchyroll', { dub: false }), hand(2, 'netflix', { available: false }), hand(3, 'adn', { dub: true }), hand(4, 'joyn', {})])
  pruefe('dub: false und available: false zählen, dub: true und Beleg ohne Urteil nicht', nein.size === 2 && nein.has(dubKey(1, 'crunchyroll')) && nein.has(dubKey(2, 'netflix')), [...nein])

  /*
    Neuanlegen ist strenger als Entfernen: Ein Ja derselben Plattform hebt das Nein hier nicht auf, denn beide können verschiedenen Ausgaben gelten
    (Digimon 552: Prime-Ausgabe B0CGRJGJX1 ja, Crunchyroll-Kanal B0CHHNJJW3 nein). Ohne Adresse im Schlüssel würde eine JustWatch-Runde die verneinte Ausgabe
    neu anlegen (Bau-Vergleich 14.10.2026: Digimon und 10719 bekamen einen Prime-Weg). `entferneBezugswegeTrotzNein` dagegen löscht bei Ja daneben nichts.
  */
  const gemischt = neinHandbelege([
    hand(10, 'primevideo', { dub: false }),
    hand(10, 'primevideo', { dub: true }),
    hand(11, 'netflix', { available: false }),
    hand(11, 'netflix', { dubRanges: [{ from: 1, to: 3, dub: true }] }),
  ])
  pruefe('ein Ja derselben Plattform (dub: true) hebt das Nein nicht auf', gemischt.has(dubKey(10, 'primevideo')), [...gemischt])
  pruefe('ein deutscher Bereich (dubRanges) daneben hebt es auch nicht auf', gemischt.has(dubKey(11, 'netflix')), [...gemischt])
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

console.log('\ncheck:handbelege liest auch Bezugswege (`bezugswegeTrotzNein`):')
{
  const wege = [
    { name: 'Netflix', url: 'https://www.netflix.com/title/81567663', kind: 'stream' },
    { name: 'YouTube', url: 'https://www.themoviedb.org/movie/573699/watch?locale=DE', kind: 'stream', zugang: 'kauf' },
    { name: 'Rakuten TV', url: 'https://rakuten.tv/x', kind: 'stream', zugang: 'kauf' },
  ] as WatchLink[]
  const titel = { watchLinks: wege }
  const namen = (platform: string, adressen: string[], nichtVerfuegbar: boolean) => bezugswegeTrotzNein(titel, platform, adressen, nichtVerfuegbar).map((w) => w.name).join()
  pruefe('nicht verfügbar: der Bezugsweg dieser Plattform steht noch', namen('netflix', [], true) === 'Netflix')
  pruefe('nicht verfügbar gilt auch für einen Kaufweg', namen('youtube', [], true) === 'YouTube')
  pruefe('ohne deutschen Ton: ein Weg ohne Kauf steht noch', namen('netflix', [], false) === 'Netflix')
  pruefe('ohne deutschen Ton: ein Kaufweg sagt nichts über den Ton und bleibt', namen('youtube', [], false) === '')
  pruefe('eine andere Plattform bleibt unberührt', namen('primevideo', [], true) === '')
  pruefe('nennt das Nein eine Adresse, zählt nur diese', namen('netflix', ['https://www.netflix.com/title/1'], true) === '')
  pruefe('dieselbe Adresse zählt (Schreibweise egal)', namen('netflix', ['http://netflix.com/title/81567663'], true) === 'Netflix')

  /* Der Bau nimmt dieselben Wege heraus (`entferneBezugswegeTrotzNein`), sonst bliebe check:handbelege rot (Beyblade Burst, 14.10.2026). */
  const titelMit = (id: number) => ({ id, watchLinks: wege.map((w) => ({ ...w })) }) as unknown as Title
  const pruefeBau = (checks: unknown[]) => {
    const titles = new Map([1, 2].map((id) => [id, titelMit(id)] as [number, Title]))
    const n = entferneBezugswegeTrotzNein(titles, checks as DubCheck[])
    return { n, eins: (titles.get(1)!.watchLinks ?? []).map((w) => w.name).join(), zwei: (titles.get(2)!.watchLinks ?? []).length }
  }
  const weg = pruefeBau([{ anilistId: 1, platform: 'netflix', available: false }])
  pruefe('Bau: ein „nicht verfügbar“ nimmt den Netflix-Weg heraus, nur bei diesem Titel', weg.n === 1 && weg.eins === 'YouTube,Rakuten TV' && weg.zwei === 3, weg)
  pruefe('Bau: ein Ja derselben Plattform daneben lässt alle Wege stehen', pruefeBau([{ anilistId: 1, platform: 'netflix', available: false }, { anilistId: 1, platform: 'netflix', dub: true }]).n === 0)
  pruefe('Bau: dub:false nimmt keinen Kaufweg heraus', pruefeBau([{ anilistId: 1, platform: 'youtube', dub: false }]).n === 0)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
