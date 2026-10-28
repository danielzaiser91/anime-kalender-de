/**
 * Zusicherung: **Eine Adresse, die ein Eintrag außerhalb von `titles.json` führt, fällt nie über den Namen einem Anime zu**
 * (18.10.2026). Die Meldungen zum Cartoon „Heidi“ (2015) an seinen Adressen bei Disney+ und Prime landeten über den Namen beim
 * Anime „Heidi“ (1974). Geprüft wird die Zuordnung, wie `fetch-urteile.ts` sie baut, gegen eine Attrappe des Bestands in einem
 * Wegwerf-Ordner (`AK_ROOT`): Cartoons, Titel ohne Synchro, Prime-Zuordnungen und Handbelege fremder Kennungen. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'urteil-fremd-'))
const schreibe = (datei: string, inhalt: string) => {
  mkdirSync(join(wurzel, datei, '..'), { recursive: true })
  writeFileSync(join(wurzel, datei), inhalt)
}
const GTI = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.2aa9f6b9-25b2-7d1e-0ed8-533d61a22046'
const DISNEY = 'https://www.disneyplus.com/browse/entity-cfb90125-8678-4327-a1b8-e608f293eccd'
const SUCHE = 'https://www.amazon.de/s?k=Heidi'
const OHNE = 'https://www.amazon.de/dp/B0CWRDZVBY'
const PRIME_FREMD = 'https://www.amazon.de/gp/video/detail/B0FREMD001'
const PRIME_EIGEN = 'https://www.amazon.de/gp/video/detail/B0EIGEN001'
const BELEG_FREMD = 'https://www.amazon.de/gp/video/detail/B0CH9BW1PW'
const GETEILT = 'https://www.netflix.com/title/900003'
const NETFLIX = 'https://www.netflix.com/title/80060413'
const BELEG_GETEILT = 'https://www.amazon.de/gp/video/detail/B0GETEILT1'
const YOUTUBE = 'https://www.youtube.com/playlist?list=PLcartoon900001'
schreibe('public/data/cartoons.json', JSON.stringify([
  { id: -900001, titleEn: 'Heidi', streams: [{ url: GTI }, { url: DISNEY, seite: SUCHE }, { url: GETEILT }, { url: NETFLIX }, { url: YOUTUBE }] },
]))
schreibe('public/data/ohne-synchro.json', JSON.stringify([{ id: 900011, titleEn: 'Magic High: Staffel 3', streams: [{ url: OHNE }] }, { id: 900012 }]))
schreibe('data/prime-zugeordnet.json', JSON.stringify({ [`${PRIME_FREMD}#2`]: { titleId: -900002 }, [PRIME_EIGEN]: { titleId: 900002 }, [DISNEY]: { titleId: 900002 } }))
schreibe('data/dub-confirmed.yaml', `- anilistId: 900013\n  url: ${BELEG_FREMD}\n- anilistId: 900002\n  url: https://www.amazon.de/gp/video/detail/B0EIGEN002\n` +
  `- anilistId: 900014\n  url: ${BELEG_GETEILT}\n- anilistId: 900001\n  url: ${BELEG_GETEILT}\n`)
process.env.AK_ROOT = wurzel

const { meldungsZuordnung } = await import('./fetch-urteile.ts')
const { meldungGrund, titelDerMeldung } = await import('./lib/urteil-je-folge.ts')
const { beobachtungenAusRohfolgen } = await import('./lib/urteil-rohfolgen.ts')
const titel = [
  { id: 900001, titleDe: 'Magic High' },
  { id: 900002, titleDe: 'Eigener Anime' },
  { id: 900005, titleDe: 'Heidi' },
  { id: 900003, titleDe: 'Freezing', streams: [{ url: GETEILT }] },
] as Title[]
const { nachAdresse, staffelKandidaten, nachName, reiheVon } = meldungsZuordnung(titel)
const ziel = (url: string, name: string, staffel: number | null = 1) =>
  titelDerMeldung({ titel_id: null, url, staffel, serientitel: name }, nachAdresse, staffelKandidaten, nachName, reiheVon)
rmSync(wurzel, { recursive: true, force: true })

const faelle: [string, number | null, number | null][] = [
  ['Cartoon-Adresse (gti), Name eines Anime', ziel(GTI, 'Heidi'), null],
  ['Cartoon-Adresse (Disney+), ohne Staffel, trotz eigener Prime-Zuordnung', ziel(DISNEY, 'Heidi', null), null],
  ['Cartoon-Adresse (YouTube-Liste)', ziel(YOUTUBE, 'Heidi'), null],
  ['Cartoon-Adresse (Disney+) mit Ländersegment', ziel(DISNEY.replace('.com/', '.com/de-de/'), 'Heidi'), null],
  ['Cartoon-Adresse (Netflix) mit Ländersegment', ziel(NETFLIX.replace('.com/', '.com/de/'), 'Heidi'), null],
  ['Cartoon-Seite als Suchadresse', ziel(SUCHE, 'Heidi'), null],
  ['Adresse eines Titels ohne Synchro', ziel(OHNE, 'Magic High'), null],
  ['Prime-Zuordnung einer fremden Kennung (mit #-Anhang)', ziel(PRIME_FREMD, 'Heidi'), null],
  ['Handbeleg einer fremden Kennung', ziel(BELEG_FREMD, 'Freezing'), null],
  ['Namensvetter eines Cartoons, unbekannte Adresse (Heidi bei Disney+ ohne Ländersegment)', ziel('https://www.disneyplus.com/browse/entity-900099', 'Heidi'), null],
  ['Kontrolle: unbekannte Adresse, exakter Name', ziel('https://www.netflix.com/title/123', 'Eigener Anime'), 900002],
  ['Kontrolle: andere Disney+-Seite mit Ländersegment', ziel('https://www.disneyplus.com/de-de/browse/entity-900002', 'Eigener Anime'), 900002],
  ['Kontrolle: Prime-Zuordnung eines eigenen Titels sperrt nicht', ziel(PRIME_EIGEN, 'Eigener Anime'), 900002],
  ['Kontrolle: andere YouTube-Liste', ziel(YOUTUBE.replace('PLcartoon', 'PLanime'), 'Eigener Anime'), 900002],
  ['Kontrolle: Handbeleg eines eigenen und eines fremden Titels an einer Sammelseite', ziel(BELEG_GETEILT, 'Magic High'), 900001],
  ['Kontrolle: Handbeleg eines eigenen Titels sperrt nicht', ziel('https://www.amazon.de/gp/video/detail/B0EIGEN002', 'Eigener Anime'), 900002],
  ['Kontrolle: der eigene Weg schlägt den Cartoon an derselben Adresse', ziel(GETEILT, 'Heidi'), 900003],
]
const fehler = faelle.filter(([, ist, soll]) => ist !== soll).map(([name, ist, soll]) => `${name}: ${ist} statt ${soll}`)
const grund = meldungGrund({ titel_id: null, url: GTI, staffel: 1 }, nachAdresse)
if (grund !== 'Adresse außerhalb des Bestands') fehler.push(`Grund der Cartoon-Meldung: ${grund}`)

/* Rohfolgen: Die Zuordnung (`folgen-zuordnung.json`) ist älter als die Erkenntnis, dass die Adresse dem Cartoon gehört —
   Heidi (1974, 2225) bei Disney+, die Schlüssel stehen wörtlich so im Bestand (Urteile `2225|disneyplus|19` am 28.10.2026). */
const HEIDI_GTI = 'eyJtZWRpYUlkIjoiMjAxYjUzYzQtZjRmYS00MTdmLWEzZGMtOGFlYmM0NWE4'
const EIGEN_GTI = 'eyJlaWdlbiI6MX0'
const roh = (gti: string, url: string) => ({ plattform: 'disneyplus', url, asin: null, gti, sprachen: '["de"]', gemeldet_am: '2026-10-16T19:03:34Z', vorhanden: null, ton_de: null })
const zuordnungRoh = { [`disneyplus:${HEIDI_GTI}`]: { titel: 900002, folge: 19 }, [`disneyplus:${EIGEN_GTI}`]: { titel: 900002, folge: 2 } } as never
const istFremd = (url: string) => nachAdresse(url)?.length === 0
const rohFaelle: [string, number, number][] = [
  ['Rohfolge an der Cartoon-Adresse (Disney+ mit Ländersegment)', beobachtungenAusRohfolgen([roh(HEIDI_GTI, DISNEY.replace('.com/', '.com/de-de/'))], zuordnungRoh, new Set(), istFremd).length, 0],
  ['Rohfolge an der Cartoon-Adresse (Disney+ ohne Segment)', beobachtungenAusRohfolgen([roh(HEIDI_GTI, DISNEY)], zuordnungRoh, new Set(), istFremd).length, 0],
  ['Kontrolle: Rohfolge an einer eigenen Adresse zählt', beobachtungenAusRohfolgen([roh(EIGEN_GTI, 'https://www.disneyplus.com/de-de/browse/entity-900002')], zuordnungRoh, new Set(), istFremd).length, 1],
]
fehler.push(...rohFaelle.filter(([, ist, soll]) => ist !== soll).map(([name, ist, soll]) => `${name}: ${ist} statt ${soll}`))
if (fehler.length) {
  console.error(`check-urteil-fremde-adresse: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log(`check-urteil-fremde-adresse: ${faelle.length + rohFaelle.length} Fälle grün (${rohFaelle.length} an Rohfolgen), fremde Adressen fallen keinem Anime zu.`)
