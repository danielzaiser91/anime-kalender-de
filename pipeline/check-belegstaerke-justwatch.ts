/**
 * Zusicherungen zu JustWatch-Deutsch als mittlerer Quelle der Belegstärke (05.11.2026), gegen eine Kulisse (`AK_ROOT`) mit erfundenen Kennungen ab 900201:
 * nur Deutsch an einem Nicht-Amazon-Angebot zählt, titelweit und nie als Weg-Ja; ein Kanal-Titel nur mit Amazons eigener Angabe (Vorbild 184591) hebt nie.
 * Läuft in `check:logic`.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'

const angebote = (anbieter: string, audio: string[], url?: string, art = 'FLATRATE') => ({ anbieter, art, audio, ...(url ? { url } : {}) })
const befund = (jwId: string, angebote: object[]) => ({ geprueftAm: '2026-10-12', jwId, angebote })

const APPLE = 900201
const NUR_KANAL = 900202
const AMAZON_UND_MARKE = 900203
const APPLE_OHNE_MARKE = 900204
const APPLE_MIT_TON = 900205
const GETEILT_A = 900206
const GETEILT_B = 900207
const AMAZON_ADRESSE = 900208
const APPLE_KANAL = 900209
const ARD_APPLE = 900210
const KEIN_DE = 900211
const OHNE_TREFFER = 900212
const AMAZON_WWW = 900213
const NUR_KAUF = 900214
const NUR_LEIHE = 900215
const KAUF_UND_ABO = 900216
const FREI = 900217
const WERBEFINANZIERT = 900218

const kulisse = mkdtempSync(join(tmpdir(), 'belegstaerke-justwatch-'))
process.env.AK_ROOT = kulisse
mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
writeFileSync(join(kulisse, 'data/synchron-forum-treffer.yaml'), '# leer\n')
writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '[]\n')
writeFileSync(join(kulisse, 'data/anisearch-ids-hand.yaml'), '900999: 900998\n')
writeFileSync(
  join(kulisse, 'data/justwatch-audio.json'),
  JSON.stringify({
    [APPLE]: befund('tm1', [angebote('Apple TV Store', ['de'])]),
    [NUR_KANAL]: befund('ts2', [angebote('Aniverse Amazon Channel', ['ja'], 'https://watch.amazon.de/detail?gti=x'), angebote('Amazon Prime Video', ['de'])]),
    [AMAZON_UND_MARKE]: befund('tm3', [angebote('Amazon Video', ['de']), angebote('Kixi Select Amazon Channel', ['de'])]),
    [APPLE_OHNE_MARKE]: befund('tm4', [angebote('MagentaTV', ['de', 'ja'])]),
    [APPLE_MIT_TON]: befund('tm5', [angebote('Apple TV Store', ['de'])]),
    [GETEILT_A]: befund('tm6', [angebote('Apple TV Store', ['de'])]),
    [GETEILT_B]: befund('tm6', [angebote('Apple TV Store', ['de'])]),
    [AMAZON_ADRESSE]: befund('tm8', [angebote('Irgendein Kanal', ['de'], 'https://watch.amazon.de/detail?gti=y')]),
    [APPLE_KANAL]: befund('tm9', [angebote('Apple TV Amazon Channel', ['de'])]),
    [ARD_APPLE]: befund('tm10', [angebote('ARD Plus Apple TV channel', ['de'])]),
    [KEIN_DE]: befund('tm11', [angebote('Apple TV Store', ['ja'])]),
    [AMAZON_WWW]: befund('tm13', [angebote('Irgendein Shop', ['de'], 'https://www.amazon.de/dp/B000TEST')]),
    [OHNE_TREFFER]: { geprueftAm: '2026-10-12', jwId: 'tm12', ohneTreffer: true, angebote: [angebote('Apple TV Store', ['de'])] },
    [NUR_KAUF]: befund('tm14', [angebote('Crunchyroll', ['ja']), angebote('JPC', ['de'], undefined, 'BUY')]),
    [NUR_LEIHE]: befund('tm15', [angebote('maxdome Store', ['de'], undefined, 'RENT')]),
    [KAUF_UND_ABO]: befund('tm16', [angebote('JPC', ['de'], undefined, 'BUY'), angebote('Disney Plus', ['de'])]),
    [FREI]: befund('tm17', [angebote('ZDF', ['de'], undefined, 'FREE')]),
    [WERBEFINANZIERT]: befund('tm18', [angebote('YouTube Free', ['de'], undefined, 'ADS')]),
  }),
)

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

try {
  const { ladeBelegsignale, mitBelegstaerke, belegstaerke } = await import('./lib/belegstaerke.ts')
  const { istAmazonAngebot } = await import('./lib/anisearch-sammeleintrag.ts')
  const titel = (id: number, extra: Partial<Title> = {}) => ({ id, dubConfidence: 'low', streams: [], ...extra }) as unknown as Title
  const marke = { deErstausgabe: { synchro: true } } as Partial<Title>
  const stufe = (t: Title, releases: Release[] = []) => mitBelegstaerke([t], releases, new Set())[0]?.dubConfidence

  console.log('\nBelegstärke: Welche JustWatch-Angebote zählen (Kulisse)')
  const jw = ladeBelegsignale([]).justwatch
  const gefunden = [...(jw ?? [])]
  pruefe('Deutsch an Apple TV: zählt', jw?.has(APPLE) === true, gefunden)
  pruefe('MagentaTV mit Deutsch und Japanisch: zählt', jw?.has(APPLE_OHNE_MARKE) === true, gefunden)
  pruefe('ARD Plus Apple TV channel ist kein Amazon-Kanal: zählt', jw?.has(ARD_APPLE) === true, gefunden)
  pruefe('nur Aniverse Amazon Channel (Japanisch) und Amazon Prime Video: zählt nicht', jw?.has(NUR_KANAL) === false, gefunden)
  pruefe('Amazon Video und Kixi Amazon Channel: zählt nicht', jw?.has(AMAZON_UND_MARKE) === false, gefunden)
  pruefe('Amazon-Adresse bei fremdem Anbietername: zählt nicht', jw?.has(AMAZON_ADRESSE) === false, gefunden)
  pruefe('Amazon-Adresse (www) bei fremdem Anbietername: zählt nicht', jw?.has(AMAZON_WWW) === false, gefunden)
  pruefe('Apple TV Amazon Channel: zählt nicht', jw?.has(APPLE_KANAL) === false, gefunden)
  pruefe('Apple ohne Deutsch: zählt nicht', jw?.has(KEIN_DE) === false, gefunden)
  pruefe('Befund ohne Treffer: zählt nicht', jw?.has(OHNE_TREFFER) === false, gefunden)
  pruefe('Befund, den sich zwei Titel teilen: zählt für keinen', jw?.has(GETEILT_A) === false && jw?.has(GETEILT_B) === false, gefunden)
  pruefe('Deutsch nur bei einem Kauf-Händler (JPC, Vorbild 118465): zählt nicht', jw?.has(NUR_KAUF) === false, gefunden)
  pruefe('Deutsch nur bei einem Leih-Händler: zählt nicht', jw?.has(NUR_LEIHE) === false, gefunden)
  pruefe('Händler plus Streaming-Abo mit Deutsch: zählt über das Abo', jw?.has(KAUF_UND_ABO) === true, gefunden)
  pruefe('Deutsch bei einem freien Angebot: zählt', jw?.has(FREI) === true, gefunden)
  pruefe('Deutsch bei einem werbefinanzierten Angebot: zählt', jw?.has(WERBEFINANZIERT) === true, gefunden)
  pruefe('genau sieben Titel zählen (Apple, MagentaTV, ARD Plus Apple, Mit-Ton, Händler+Abo, frei, Werbung)', jw?.size === 7, gefunden)
  pruefe('istAmazonAngebot: Prime Video with Ads', istAmazonAngebot({ anbieter: 'Amazon Prime Video with Ads' }))
  pruefe('istAmazonAngebot: MX Player', istAmazonAngebot({ anbieter: 'Amazon MX Player' }))
  pruefe('istAmazonAngebot: Apple TV Store ist es nicht', !istAmazonAngebot({ anbieter: 'Apple TV Store' }))

  console.log('\nBelegstärke: JustWatch als eine mittlere Quelle über den Bau (mitBelegstaerke)')
  pruefe('JustWatch allein (Apple, keine aniSearch-Marke): normal', stufe(titel(APPLE_OHNE_MARKE)) === 'normal', stufe(titel(APPLE_OHNE_MARKE)))
  pruefe('JustWatch plus aniSearch-Marke: high', stufe(titel(APPLE, marke)) === 'high', stufe(titel(APPLE, marke)))
  const tv = [{ titleId: APPLE_OHNE_MARKE, platform: 'tv' }] as unknown as Release[]
  pruefe('JustWatch plus TV-Termin: high', stufe(titel(APPLE_OHNE_MARKE), tv) === 'high', stufe(titel(APPLE_OHNE_MARKE), tv))
  pruefe('aniSearch-Marke allein (ohne JustWatch): normal', stufe(titel(KEIN_DE, marke)) === 'normal')
  pruefe('Kanal-Titel nur mit Amazons Angabe, aniSearch p (ohne Marke): low (Vorbild 184591)', stufe(titel(NUR_KANAL)) === 'low', stufe(titel(NUR_KANAL)))
  pruefe('Kanal-Titel mit Amazons Angabe plus Marke: normal, nicht high', stufe(titel(AMAZON_UND_MARKE, marke)) === 'normal', stufe(titel(AMAZON_UND_MARKE, marke)))
  const mitTon = titel(APPLE_MIT_TON, { streams: [{ platform: 'netflix', url: 'x', dub: true }] as never })
  pruefe('Anbieter-Tonspur plus JustWatch am selben Titel: high, nicht very-high (dieselbe Aussage)', stufe(mitTon) === 'high', stufe(mitTon))
  const kartei = { ...ladeBelegsignale([]), kartei: new Set([APPLE_MIT_TON]) }
  pruefe('Synchronkartei plus JustWatch (ohne Tonspur): very-high', belegstaerke(titel(APPLE_MIT_TON), kartei) === 'very-high')
  pruefe('JustWatch zählt in belegstaerke() nur über das Signal', belegstaerke(titel(APPLE, marke), { ...kartei, kartei: new Set(), justwatch: undefined }) === 'normal')
  const nein = [{ platform: 'netflix', url: 'x', dub: false }]
  const weg = mitBelegstaerke([titel(APPLE, { ...marke, streams: structuredClone(nein) as never })], [], new Set())[0]
  pruefe('kein Weg bekommt dub: true daraus, ein Weg mit dub: false bleibt', JSON.stringify(weg?.streams) === JSON.stringify(nein), weg?.streams)
  pruefe('derselbe Titel wird dabei high (JustWatch plus Marke)', weg?.dubConfidence === 'high', weg?.dubConfidence)
} finally {
  rmSync(kulisse, { recursive: true, force: true, maxRetries: 3 })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nBelegstärke (JustWatch): alle Zusicherungen halten.')
