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
import { dubKey, neinHandbelege, wegVerneint, type DubCheck } from './lib/dub-confirmed.ts'
import { bezugswegeTrotzNein, entferneBezugswegeTrotzNein } from './lib/handbeleg-bezugswege.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const weg = (platform: string): StreamLink => ({ platform, url: `https://example.org/${platform}` }) as StreamLink
const hand = (anilistId: number, platform: string, rest: Partial<Pick<DubCheck, 'url' | 'dub' | 'available' | 'dubRanges'>>) => ({ anilistId, platform, ...rest }) as Parameters<typeof neinHandbelege>[0][number]
const prime = (asin: string) => `https://www.amazon.de/dp/${asin}`
const PRIME_NEIN = prime('B0CHHNJJW3')
const JW_PRIME = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.70a9f6b2-e01c-dfe3-ef0c-dc0ae2d750a5'
/** Zwei Prime-Ausgaben: Nein an `PRIME_NEIN`, Ja an einer zweiten Adresse. Das Nein gilt dann nur seiner Adresse. */
const neinNurDort = (id: number, platform: string, neinUrl: string) =>
  neinHandbelege([hand(id, platform, { url: neinUrl, dub: false }), hand(id, platform, { url: 'https://example.org/ja', dub: true })])

console.log('\nNein-Handbelege als Schlüsselmenge:')
{
  const nein = neinHandbelege([hand(1, 'crunchyroll', { dub: false }), hand(2, 'netflix', { available: false }), hand(3, 'adn', { dub: true }), hand(4, 'joyn', {})])
  pruefe('dub: false und available: false zählen, dub: true und Beleg ohne Urteil nicht', nein.size === 2 && nein.has(dubKey(1, 'crunchyroll')) && nein.has(dubKey(2, 'netflix')), [...nein])

  /*
    Je Adresse (14.10.2026): Ein Ja hebt nur das Nein derselben Adresse auf. Erst ein Ja an einer anderen Adresse beschränkt das Nein auf seine eigene
    (Digimon 552 bei Prime: Ausgabe B0CGRJGJX1 ja, Crunchyroll-Kanal B0CHHNJJW3 nein); ohne zweite Ausgabe sperrt es die Plattform, denn eine neue
    Adresse kann dieselbe Ausgabe in anderer Schreibweise sein (JustWatch-gti statt ASIN).
  */
  const zweiAusgaben = neinHandbelege([hand(10, 'primevideo', { url: PRIME_NEIN, dub: false }), hand(10, 'primevideo', { url: prime('B0CGRJGJX1'), dub: true })])
  pruefe('Ja an einer anderen Adresse: der Weg zu einer dritten Adresse ist frei', !wegVerneint(zweiAusgaben, 10, 'primevideo', JW_PRIME), [...zweiAusgaben])
  pruefe('… die verneinte Adresse bleibt gesperrt, Schreibweise egal', wegVerneint(zweiAusgaben, 10, 'primevideo', 'https://www.amazon.de/gp/video/detail/B0CHHNJJW3?ref=x'))
  const allein = neinHandbelege([hand(11, 'primevideo', { url: PRIME_NEIN, dub: false })])
  pruefe('Nein mit Adresse ohne Ja daneben sperrt die ganze Plattform', wegVerneint(allein, 11, 'primevideo', JW_PRIME), [...allein])
  /* Ein Ja ohne Adresse belegt keine zweite Ausgabe (Overgeared 212888 bei Crunchyroll: Nein an crunchyroll.com, Ja ohne url). */
  const jaOhneAdresse = neinHandbelege([hand(16, 'primevideo', { url: PRIME_NEIN, dub: false }), hand(16, 'primevideo', { dub: true })])
  pruefe('Nein mit Adresse, Ja ohne Adresse: das Nein sperrt die ganze Plattform', wegVerneint(jaOhneAdresse, 16, 'primevideo', JW_PRIME), [...jaOhneAdresse])
  const ohneAdresse = neinHandbelege([hand(12, 'netflix', { available: false }), hand(12, 'netflix', { url: 'https://www.netflix.com/title/1', dub: true })])
  pruefe('Nein ohne Adresse sperrt trotz Ja an einer Adresse die ganze Plattform', wegVerneint(ohneAdresse, 12, 'netflix', 'https://www.netflix.com/title/2'), [...ohneAdresse])
  const gleich = neinHandbelege([hand(13, 'primevideo', { url: prime('B09JV7CC61'), available: false }), hand(13, 'primevideo', { url: 'https://www.amazon.de/gp/video/detail/B09JV7CC61', dub: true })])
  pruefe('Ja (dub: true) an derselben Adresse hebt das Nein auf', gleich.size === 0, [...gleich])
  const bereich = neinHandbelege([hand(14, 'netflix', { url: 'https://www.netflix.com/title/7', available: false }), hand(14, 'netflix', { url: 'https://www.netflix.com/title/7', dubRanges: [{ from: 1, to: 3, dub: true }] })])
  pruefe('ein deutscher Bereich (dubRanges) an derselben Adresse zählt als Ja', bereich.size === 0, [...bereich])
  /* Verschmolzene Zeile (`verschmelze`): altes Ja, jüngeres „nicht verfügbar“ zur selben Adresse trägt beides und gilt als Nein. */
  const verschmolzen = hand(17, 'primevideo', { url: prime('B0VERSCHM1'), dub: true, available: false })
  const nurDiese = neinHandbelege([verschmolzen])
  pruefe('Ja und „nicht verfügbar“ in einer Zeile: das Nein sperrt die Plattform', wegVerneint(nurDiese, 17, 'primevideo', JW_PRIME), [...nurDiese])
  const nebenJa = neinHandbelege([verschmolzen, hand(17, 'primevideo', { url: prime('B0ANDERES1'), dub: true })])
  pruefe('… neben einem Ja an anderer Adresse sperrt es nur die eigene Adresse', wegVerneint(nebenJa, 17, 'primevideo', verschmolzen.url) && !wegVerneint(nebenJa, 17, 'primevideo', JW_PRIME), [...nebenJa])
  const bereichNein = neinHandbelege([hand(18, 'netflix', { url: 'https://www.netflix.com/title/9', available: false, dubRanges: [{ from: 1, to: 3, dub: true }] })])
  pruefe('deutscher Bereich und „nicht verfügbar“ in einer Zeile: das Nein gilt', wegVerneint(bereichNein, 18, 'netflix', 'https://www.netflix.com/title/9'), [...bereichNein])
  const ohneBeide =neinHandbelege([hand(15, 'netflix', { available: false }), hand(15, 'netflix', { dub: true })])
  pruefe('Ja und Nein ohne Adresse: dieselbe Ausgabe ist nicht belegt, das Nein gilt', wegVerneint(ohneBeide, 15, 'netflix', 'https://www.netflix.com/title/8'), [...ohneBeide])
}

console.log('\nCartoon-Zwilling übernimmt Anbieter:')
{
  const cartoon = { streams: [weg('crunchyroll'), weg('netflix')] }
  const nein = neinHandbelege([hand(1292, 'crunchyroll', { dub: false })])
  const plattformen = (n: Set<string>, id: number) => fehlendeAnbieter(cartoon, { id, streams: [] }, n).map((s) => s.platform).join()
  pruefe('ohne Nein-Handbeleg kommen beide Anbieter dazu', plattformen(new Set(), 1292) === 'crunchyroll,netflix')
  pruefe('mit Nein-Handbeleg für Crunchyroll kommt nur Netflix dazu', plattformen(nein, 1292) === 'netflix', plattformen(nein, 1292))
  pruefe('das Nein gilt nur dem Anime-Titel, dem es gehört', plattformen(nein, 99) === 'crunchyroll,netflix')
  pruefe('Nein nur an seiner Adresse: der Weg dorthin kommt nicht dazu', plattformen(neinNurDort(1292, 'crunchyroll', weg('crunchyroll').url), 1292) === 'netflix')
  pruefe('… ein Weg zu einer anderen Adresse schon', plattformen(neinNurDort(1292, 'crunchyroll', 'https://example.org/anders'), 1292) === 'crunchyroll,netflix')
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
  pruefe('Nein nur an seiner Adresse: die Runde legt diese Adresse nicht an', lauf(neinNurDort(185515, 'crunchyroll', 'https://www.crunchyroll.com/de/watch/GG1U2JQM9')).join() === 'Netflix')
  pruefe('… eine andere Adresse derselben Plattform schon', lauf(neinNurDort(185515, 'crunchyroll', 'https://www.crunchyroll.com/de/watch/ANDERS')).join() === 'Crunchyroll,Netflix')
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
