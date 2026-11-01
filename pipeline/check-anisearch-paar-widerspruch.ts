/**
 * Zusicherung: Verbindet aniSearchs MAL-Brücke zwei verschiedene Werke (Voidoll irregular ↔ #Compass), widerspricht das Paar den Merkmalen des Titels
 * (`lib/anisearch-paar-widerspruch.ts`), und ein von Hand verworfenes Paar (`data/anisearch-mal-verworfen.json`) gibt dem Titel keine Kennung.
 * Die Fälle sind die echten aus dem Bestand vom 01.11.2026. Bestandsteil: `check-anisearch-paar-bestand.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-anisearch-paar-widerspruch.ts`
 */
import { anisearchKennungen, baueFesteKennungen } from './bau/anisearch-kennung.ts'
import { anisearchHand } from './bau/grundlagen.ts'
import { ohneVerworfene, ohneVerworfeneSeiten } from './lib/anisearch-verworfen.ts'
import { namenAehneln, paarWiderspricht } from './lib/anisearch-paar-widerspruch.ts'
import type { readJson } from './lib/util.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nNamen:')
pruefe('Honekami / Hone Kami: zusammengeschrieben ähnlich', namenAehneln('Honekami', 'Hone Kami'))
pruefe('Fate / Fatezero: kurzer Name steckt zusammengeschrieben im langen', namenAehneln('Fate', 'Fatezero'))
pruefe('ein gemeinsames Wort von drei Buchstaben genügt (Gan Aaa Zzz / Gan Bbb Yyy)', namenAehneln('Gan Aaa Zzz', 'Gan Bbb Yyy'))
pruefe('Voidoll irregular / #Compass: nichts gemeinsam', !namenAehneln('Voidoll irregular', '#Compass'))
pruefe('Partikel „no“ allein verbindet nicht (Ga no Iru Tokoro / Nihon no Shinseiki)', !namenAehneln('Ga no Iru Tokoro', 'Thinking and Drawing: Nihon no Shinseiki Art Animation'))
pruefe('zu kurzer Rest („Ani“ in „Anime“) zählt nicht als zusammengeschrieben', !namenAehneln('Ani', 'Anime Gataris'))

console.log('\nEchte Paare aus dem Bestand:')
const t = (names: string[], jahr: number, folgen: number) => ({ names, jahr, folgen })
pruefe('Voidoll irregular (2018, 1) ↔ #Compass (2018, 10): widerspricht', paarWiderspricht(t(['Voidoll irregular'], 2018, 1), t(['#Compass'], 2018, 10)))
pruefe('Ga no Iru Tokoro (2001, 1) ↔ Thinking and Drawing (1999, 9): widerspricht', paarWiderspricht(t(['Ga no Iru Tokoro'], 2001, 1), t(['Thinking and Drawing: Nihon no Shinseiki Art Animation'], 1999, 9)))
pruefe('Dinozaurs (2000, 26) ↔ Dinozone (1998, 5): widerspricht', paarWiderspricht(t(['DINOZAURS : THE SERIES'], 2000, 26), t(['Dinozone'], 1998, 5)))
pruefe('Shimajirou (2024, 1) ↔ Qiao Hu (2021, 1): nur das Jahr trägt, widerspricht', paarWiderspricht(t(['Shimajirou Miracle-jima no Nanairo Carnation'], 2024, 1), t(['Qiao Hu Mofa Dao Lixian Ji'], 2021, 1)))
pruefe('Onmyouji Heian Monogatari ↔ Yinyang Shi (gleiches Jahr und Folgen, nur Umschrift): kein Widerspruch', !paarWiderspricht(t(['Onmyouji: Heian Monogatari'], 2018, 12), t(['Yinyang Shi: Pingan Wuyu'], 2018, 12)))
pruefe('Honekami (2021) ↔ Hone Kami (2023): Jahr weicht, Name gleich — kein Widerspruch', !paarWiderspricht(t(['Honekami'], 2021, 1), t(['Hone Kami'], 2023, 1)))
pruefe('Namen verschieden, Jahr ±1 und Folgen gleich: kein Widerspruch', !paarWiderspricht(t(['Aaa Bbb'], 2020, 12), t(['Ccc Ddd'], 2021, 12)))
pruefe('Namen verschieden, nur Folgen verschieden: Widerspruch', paarWiderspricht(t(['Aaa Bbb'], 2020, 12), t(['Ccc Ddd'], 2020, 13)))
pruefe('Namen verschieden, Jahr genau 2 auseinander, Folgen gleich: Widerspruch', paarWiderspricht(t(['Aaa Bbb'], 2020, 12), t(['Ccc Ddd'], 2022, 12)))
pruefe('Namen verschieden, Merkmale fehlen: kein Widerspruch', !paarWiderspricht({ names: ['Aaa Bbb'] }, { names: ['Ccc Ddd'] }))
pruefe('Gan to Gon (1971, 260) ↔ Gan to Gon (1974, 65): gleicher Name trotz Jahr und Folgen, kein Widerspruch', !paarWiderspricht(t(['Gan to Gon'], 1971, 260), t(['Gan to Gon'], 1974, 65)))
pruefe('Jahr 0 der Seite („unbekannt“, SK8 (TV)) zählt nicht als Jahr', !paarWiderspricht(t(['Aaa Bbb'], 2020, 12), { names: ['Ccc Ddd'], jahr: 0, folgen: 12 }))
pruefe('ein Name des Titels passt zu irgendeinem der Seite (Englisch): kein Widerspruch', !paarWiderspricht(t(['Xxx Yyy', 'Star Wars Visions'], 2020, 1), t(['Zzz Qqq', 'Star Wars Visions'], 2025, 9)))
pruefe('ohne Namen auf einer Seite: kein Widerspruch', !paarWiderspricht({ names: [], jahr: 2000, folgen: 1 }, t(['Aaa Bbb'], 2020, 9)))

console.log('\nVerworfene Paare:')
const roh = { 1: 10, 2: 20 }
pruefe('Paar in der Liste fällt weg, das andere bleibt', JSON.stringify(ohneVerworfene(roh, { 1: { anisearch: 10, grund: 'x' } })) === JSON.stringify({ 2: 20 }))
pruefe('gleiche MAL, andere aniSearch-Seite (der Abruf hat neu gepaart): bleibt', JSON.stringify(ohneVerworfene(roh, { 1: { anisearch: 11, grund: 'x' } })) === JSON.stringify(roh))
const seiten = { 10: { anisearchId: 5 }, 11: { anisearchId: 5 }, 12: { anisearchId: 6 } }
const nurZehn = { 7: { anisearch: 5, anilist: 10, grund: 'x' } }
pruefe('Seiten: verworfene Seite fällt nur beim genannten AniList-Titel weg', Object.keys(ohneVerworfeneSeiten(seiten, nurZehn)).join() === '11,12')
pruefe('Seiten: gleicher Titel, andere Seite (neu zugeordnet): bleibt', Object.keys(ohneVerworfeneSeiten(seiten, { 7: { anisearch: 9, anilist: 10, grund: 'x' } })).join() === '10,11,12')
pruefe('Seiten: Eintrag ohne anilist streicht keine Seite (er gilt nur der MAL-Brücke)', Object.keys(ohneVerworfeneSeiten(seiten, { 7: { anisearch: 5, grund: 'x' } })).join() === '10,11,12')
/* Fake-Dateien: Schlüssel = Dateiname. Die Titel-Kennungen liegen über allen echten, damit die festen Kennungen sie nicht berühren. */
const dateien: Record<string, unknown> = {
  'anisearch-mal.json': { 38603: 9_000_001, 8409: 9_000_002, 40568: 9_000_003 },
  'anisearch-mal-verworfen.json': { 38603: { anisearch: 9_000_001, grund: 'Probe' } },
}
const lies = (<T>(pfad: string, fallback: T): T => (dateien[pfad.split('/').pop()!] as T | undefined) ?? fallback) as typeof readJson
const titel = [{ id: 900_001, mal: 38603 }, { id: 900_002, mal: 8409 }, { id: 900_003, mal: 40568 }]
const k = anisearchKennungen(titel, lies)
pruefe('Bau: verworfenes Paar gibt dem Titel keine Kennung, die übrigen Paare gelten', !k.has(900_001) && k.get(900_002) === 9_000_002 && k.get(900_003) === 9_000_003, [...k])
const fest = {
  'anisearch.json': { 900_011: { anisearchId: 9_000_011 }, 900_012: { anisearchId: 9_000_012 } },
  'anisearch-titel.json': { 900_013: { anisearchId: 9_000_013 }, 900_014: { anisearchId: 9_000_014 } },
  'anisearch-mal-verworfen.json': {
    5: { anisearch: 9_000_011, anilist: 900_011, grund: 'Probe' },
    6: { anisearch: 9_000_013, anilist: 900_013, grund: 'Probe' },
  },
}
const festLies = (<T>(pfad: string, fallback: T): T => (fest[pfad.split('/').pop()! as keyof typeof fest] as T | undefined) ?? fallback) as typeof readJson
const feste = baueFesteKennungen(festLies)
pruefe('Feste Kennungen: verworfene Seite fällt in beiden Abrufdateien weg, die übrige bleibt', !feste.has(900_011) && !feste.has(900_013) && feste.get(900_012) === 9_000_012 && feste.get(900_014) === 9_000_014, [...feste].filter(([i]) => i > 900_000))
dateien['anisearch-mal-verworfen.json'] = {}
pruefe('Bau ohne Streichliste: dasselbe Paar gilt (die Streichung wirkt wirklich)', anisearchKennungen(titel, lies).get(900_001) === 9_000_001)
/* Zwischenspeicher der festen Kennungen: ein Handeintrag (stabile Quelle, kein Abrufergebnis) muss über `anisearchKennungen` ankommen. */
const [handId, handSeite] = Object.entries(anisearchHand).map(([i, s]) => [Number(i), s] as const)[0]!
pruefe('Bau: feste Kennungen (Handdatei) kommen über anisearchKennungen an', anisearchKennungen([{ id: handId }], lies).get(handId) === handSeite, [handId, handSeite])

if (verletzt) {
  console.error(`\n${verletzt} von ${faelle} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nOK — ${faelle} Fälle`)
