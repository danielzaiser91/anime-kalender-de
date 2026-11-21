/**
 * **Der Messer im Fünf-Minuten-Takt** (`worker/src/ausbleiben-messer.ts`): geprüft über den echten `scheduled`-Einstieg des Workers
 * mit R2-Attrappe und Crunchyroll-Attrappe. Slot ist 15:00 Berlin = 14:00Z am 15.11.2026 (Space Mercenary F7, kam 15:19).
 * Belegt: Schalter (aus ohne `an`), kein D1, nur fällige Termine, Takt, Stand in R2, Monotonie, Nichtauskunft, Sperre, Abbruch.
 *
 * Aufruf: `npx tsx tools/worker-ausbleiben-messer.test.ts`
 */
import worker from '../worker/src/index.ts'
import type { Env } from '../worker/src/env.ts'
import { STAND_SCHLUESSEL, SCHALTER_SCHLUESSEL, SPERRE_SCHLUESSEL, ZIELE_JE_LAUF, waehleZiele } from '../worker/src/ausbleiben-messer.ts'
import { fetchAttrappe, neueDatenbank, testEnv, zaehler, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

let fehler = 0
const zeige = console.log
const pruefe = (bedingung: boolean, text: string) => {
  zeige(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
let protokoll: string[] = []
console.log = (...a: unknown[]) => void protokoll.push(a.join(' '))
console.error = (...a: unknown[]) => void protokoll.push(a.join(' '))

const MIN = 6e4
const SLOT = Date.UTC(2026, 10, 15, 14, 0)
const ev = (o: Record<string, unknown>) => ({ titleId: 1, releaseType: 'weekly', platform: 'crunchyroll', name: 'X', estimated: true, date: '2026-11-15', ohneSichtung: true, ...o })
const F7 = ev({ id: 'cr-GT00384006@2026-11-15', releaseSlug: 'cr-GT00384006', time: '15:00', episode: 7, episodeCount: 13 })
const TERMINE = [
  F7,
  ev({ id: 'a', releaseSlug: 'cr-GT00000001', time: '15:00', episode: 7 }), // zweiter echter Kandidat
  ev({ id: 'b', releaseSlug: 'aoashi-staffel-2-crunchyroll-de-2026-10-25', time: '15:00', episode: 3 }), // alter Schlüssel: keine Serienkennung
  ev({ id: 'c', releaseSlug: 'cr-GT00000003', episode: 4 }), // ohne Uhrzeit
  ev({ id: 'd', releaseSlug: 'cr-GT00000004', time: '15:00', episode: 5, date: '2026-11-18' }), // drei Tage später
  ev({ id: 'e', releaseSlug: 'cr-GT00000005', time: '15:00', episode: 6, platform: 'netflix' }),
  ev({ id: 'f', releaseSlug: 'cr-GT00000006', time: '15:00', episode: 8, ohneSichtung: undefined }), // schon gesehen
]

const folgen = (deutsch: boolean, nr = 7) => ({ data: [{ episode_number: nr - 1, versions: [{ audio_locale: 'ja-JP' }, { audio_locale: 'de-DE' }] }, { episode_number: nr, versions: [{ audio_locale: 'ja-JP' }, ...(deutsch ? [{ audio_locale: 'de-DE' }] : [])] }] })
const staffeln = { data: [{ season_sequence_number: 1, versions: [{ audio_locale: 'ja-JP', guid: 'JA' }, { audio_locale: 'de-DE', guid: 'GS1DEDE' }] }] }

const welt = {
  de: false,
  episodesStatus: 200,
  tokenStatus: 200,
  seasonsStatus: 200,
  wirft: '',
  github: 0,
  aufrufe: [] as string[],
  r2: new Map<string, string>(),
  puts: 0,
  mitRumpf: false, // Fehlerantworten der Folgenliste tragen einen gültigen JSON-Rumpf
  episodes429Ab: 0, // ab dem n-ten Abruf der Folgenliste im Takt: 429
  episodesNr: 0,
  haengt: false,
  ohneFrist: false,
  fristen: [] as number[],
  staffeln: staffeln as unknown,
  folgenAntwort: null as unknown,
}
const echteFrist = AbortSignal.timeout.bind(AbortSignal)
AbortSignal.timeout = (ms: number) => {
  welt.fristen.push(ms)
  if (!welt.haengt) return echteFrist(ms)
  const k = new AbortController() // hier verkürzt; ein sichtbarer Timer, denn der von AbortSignal.timeout hält den Prozess nicht wach
  setTimeout(() => k.abort(), 30)
  return k.signal
}
fetchAttrappe('2026-11-15')
const basis = globalThis.fetch
globalThis.fetch = (async (eingabe: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof eingabe === 'string' ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url
  const j = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status })
  if (url.endsWith('/events.json')) {
    zaehler.fetch++
    welt.aufrufe.push('events')
    return j(TERMINE)
  }
  if (url.includes('api.github.com')) welt.github++
  if (url.includes('beta-api.crunchyroll.com')) {
    welt.aufrufe.push(url.replace('https://beta-api.crunchyroll.com', ''))
    await new Promise((fertig) => setTimeout(fertig, 5)) // eine Frist von 0 ms wäre hier schon abgelaufen
    if (init?.signal?.aborted) throw new Error('abgebrochen (Frist)')
    if (welt.wirft) throw new Error(welt.wirft)
    if (welt.haengt) {
      if (!init?.signal) {
        welt.ohneFrist = true
        return j({}, 500)
      }
      const signal = init.signal
      await new Promise((_, nein) => signal.addEventListener('abort', () => nein(new Error('abgebrochen (Frist)'))))
    }
    if (url.includes('/auth/v1/token')) return welt.tokenStatus === 200 ? j({ access_token: 'T', country: 'US' }) : j({}, welt.tokenStatus)
    if (url.includes('/series/') && url.includes('/seasons')) return welt.seasonsStatus === 200 ? j(welt.staffeln) : j({}, welt.seasonsStatus)
    if (url.includes('/seasons/GS1DEDE/episodes')) {
      welt.episodesNr++
      if (welt.episodes429Ab && welt.episodesNr >= welt.episodes429Ab) return j({}, 429)
      const rumpf = welt.folgenAntwort ?? folgen(welt.de, 7)
      return welt.episodesStatus === 200 ? j(rumpf) : j(welt.mitRumpf ? rumpf : {}, welt.episodesStatus)
    }
  }
  return basis(eingabe, init)
}) as typeof fetch

const r2 = {
  get: async (k: string) => (welt.r2.has(k) ? { text: async () => welt.r2.get(k) as string } : null),
  put: async (k: string, v: string) => {
    welt.puts++
    welt.r2.set(k, v)
  },
}

async function takt(uhr: number, mitBelege = true): Promise<string> {
  protokoll = []
  welt.aufrufe = []
  welt.github = 0
  welt.episodesNr = 0
  welt.fristen = []
  zaehlerZurueck()
  const env = { ...testEnv(neueDatenbank(), 7), ...(mitBelege ? { BELEGE: r2 } : {}) } as unknown as Env
  const offen: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => offen.push(p), passThroughOnException: () => {} } as unknown as ExecutionContext
  await worker.scheduled({ cron: '*/5 * * * *', scheduledTime: uhr, noRetry: () => {} }, env, ctx)
  await Promise.allSettled(offen)
  return protokoll.find((z) => z.startsWith('[ausbleiben]')) ?? ''
}
const cr = () => welt.aufrufe.filter((u) => u !== 'events')
const stand = (): Record<string, { slotMs?: number; gesehenAm?: number; ohneDeutschAm?: number; letzteLesung?: number; staffel?: string }> => JSON.parse(welt.r2.get(STAND_SCHLUESSEL) ?? '{}')

// 0. Auswahl der Ziele über Mitternacht Berlin (Winter- und Sommerzeit): Termin 00:30 des Folgetags und 23:30 des Vortags
const nacht = (id: string, date: string, time: string) => ev({ id, releaseSlug: `cr-${id}`, date, time, episode: 1 })
const wintersZiele = waehleZiele([nacht('GTSPAET', '2026-11-16', '00:30'), nacht('GTFRUEH', '2026-11-15', '23:30'), nacht('GTFERN', '2026-11-18', '00:30')] as never, new Date(Date.UTC(2026, 10, 15, 23, 50)))
pruefe(JSON.stringify(wintersZiele.map((z) => [z.serie, z.slotMs])) === JSON.stringify([['GTFRUEH', Date.UTC(2026, 10, 15, 22, 30)], ['GTSPAET', Date.UTC(2026, 10, 15, 23, 30)]]), `Winter 00:50 Berlin: 23:30 und 00:30 gewählt, früherer zuerst, Termin in drei Tagen nicht (${JSON.stringify(wintersZiele)})`)
const ohneFolge = [{ ...nacht('GTOHNE1', '2026-11-15', '23:30'), episode: undefined }, { ...nacht('GTOHNE2', '2026-11-15', '23:30'), episode: null }, nacht('GTMIT', '2026-11-15', '23:30')]
pruefe(JSON.stringify(waehleZiele(ohneFolge as never, new Date(Date.UTC(2026, 10, 15, 23, 50))).map((z) => z.serie)) === '["GTMIT"]', 'Termin ohne Folgennummer (fehlt oder null) ist kein Ziel')
const sommerZiele = waehleZiele([nacht('GTSOMMER', '2026-07-13', '00:30')] as never, new Date(Date.UTC(2026, 6, 12, 22, 40)))
pruefe(sommerZiele.length === 1 && sommerZiele[0].slotMs === Date.UTC(2026, 6, 12, 22, 30), 'Sommer: 00:30 Berlin ist 22:30Z des Vortags')

// 1. Ohne Schalter und ohne Ablage: kein Crunchyroll-Abruf, nichts geschrieben
let zeile = await takt(SLOT + 10 * MIN)
pruefe(zeile === '[ausbleiben] aus: Schalter', `ohne Schalter: aus (${zeile})`)
pruefe(cr().length === 0 && welt.puts === 0, 'ohne Schalter: kein Crunchyroll-Abruf, kein Schreiben')
pruefe((await takt(SLOT + 10 * MIN, false)) === '[ausbleiben] aus: keine Ablage', 'ohne R2-Bindung: aus')
welt.r2.set(SCHALTER_SCHLUESSEL, 'aus')
pruefe((await takt(SLOT + 10 * MIN)).endsWith('aus: Schalter') && cr().length === 0, 'Schalter „aus“: aus')
welt.r2.set(SCHALTER_SCHLUESSEL, '')
pruefe((await takt(SLOT + 10 * MIN)).endsWith('aus: Schalter'), 'Schalter leer: aus')
welt.r2.set(SCHALTER_SCHLUESSEL, 'an ')
pruefe(!(await takt(SLOT - 20 * MIN)).includes('Schalter'), 'Schalter „an “ (mit Leerzeichen am Ende): läuft')

// 2. Vor dem Slot: Ziele da, aber nichts dran, kein Abruf
zeile = await takt(SLOT - 5 * MIN)
pruefe(zeile === '[ausbleiben] ziele=2 dran=0', `vor dem Slot: zwei Ziele, nichts dran (${zeile})`)
pruefe(cr().length === 0, 'vor dem Slot: kein Crunchyroll-Abruf')
pruefe((await takt(SLOT + 60 * MIN)).includes('volle Stunde') && welt.aufrufe.length === 0, 'zur vollen Stunde: nichts geladen, nichts abgerufen (die Stunden-Aufrufe bleiben wie vorher)')

// 3. 15:10, Folge ohne deutsche Fassung: Token, Staffelliste, Folgenliste; Stand in R2; kein D1
zeile = await takt(SLOT + 10 * MIN)
pruefe(zeile.includes('ziele=2 dran=2') && zeile.includes('"offen":2'), `15:10: zwei offen (${zeile})`)
pruefe(cr().join(' ').split('/auth/v1/token').length === 2, 'ein Token je Takt')
pruefe(cr().filter((u) => u.includes('/seasons?locale')).length === 2 && cr().filter((u) => u.includes('/episodes?locale')).length === 2, 'je Termin eine Staffelliste und eine Folgenliste')
pruefe(cr().every((u) => !u.includes('browse') && !u.includes('&_=')), 'keine Browse-Liste, keine Umgehung des Zwischenspeichers')
pruefe(welt.aufrufe.filter((u) => u === 'events').length === 1, 'die Termindatei wird je Takt nur einmal geladen (Push und Messer teilen)')
pruefe(zaehler.d1 === 0, `kein D1 im ganzen Takt (${zaehler.d1})`)
pruefe(welt.github > 0 && protokoll.some((z) => z.startsWith('[push5] ') && !z.includes('fehlgeschlagen')), 'der Takt bleibt, was er war: Wecker und Push laufen mit')
pruefe(stand()['GT00384006:7:2026-11-15']?.ohneDeutschAm === SLOT + 10 * MIN && stand()['GT00384006:7:2026-11-15']?.staffel === 'GS1DEDE', 'Stand: ohne Deutsch um 15:10, Staffel gemerkt')
pruefe(Object.keys(stand()).length === 2, 'nur die zwei echten Termine im Stand (alter Schlüssel, ohne Uhrzeit, später, Netflix, gesehen: nie)')

// 4. Takt: 15:12 nichts dran; 15:15 wieder; die Staffel wird nicht erneut geholt
zeile = await takt(SLOT + 12 * MIN)
pruefe(zeile === '[ausbleiben] ziele=2 dran=0' && cr().length === 0, '15:12 (zwei Minuten später): nichts dran')
zeile = await takt(SLOT + 15 * MIN)
pruefe(zeile.endsWith('dran=0'), '15:15 (Stufe 15 min, letzte Lesung 15:10): nichts dran')
zeile = await takt(SLOT + 25 * MIN)
pruefe(zeile.includes('dran=2') && zeile.includes('"offen":2') && cr().filter((u) => u.includes('/series/')).length === 0, `15:25: dran, noch offen (25 min < 26), Staffel nicht erneut geholt (${zeile})`)

// 5. 15:30 liest nicht (Takt), 15:40 liest und urteilt: ausgeblieben
pruefe((await takt(SLOT + 30 * MIN)).endsWith('dran=0'), '15:30: nichts dran')
zeile = await takt(SLOT + 40 * MIN)
pruefe(zeile.includes('"ausgeblieben":2'), `15:40: ausgeblieben (${zeile})`)

// 6. Die deutsche Fassung kommt: erschienen; danach liest nichts mehr, auch eine ältere Lesung kippt nichts
welt.de = true
zeile = await takt(SLOT + 55 * MIN)
pruefe(zeile.includes('"erschienen":2') && stand()['GT00384006:7:2026-11-15']?.gesehenAm === SLOT + 55 * MIN, `15:55: erschienen (${zeile})`)
welt.de = false
zeile = await takt(SLOT + 70 * MIN)
pruefe(zeile === '[ausbleiben] ziele=2 dran=0' && cr().length === 0, 'danach: gesehen heißt gesehen, keine weitere Lesung')
pruefe(stand()['GT00384006:7:2026-11-15']?.gesehenAm === SLOT + 55 * MIN, 'erste Sichtung unverändert')

// 7. Nichtauskunft und Sperre
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.episodesStatus = 500
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('"unbekannt":2') && Object.values(stand()).every((s) => s.ohneDeutschAm === undefined), `HTTP 500 der Folgenliste: nie Ausbleiben (${zeile})`)
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.episodesStatus = 429
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('gestoppt: HTTP 429') && cr().filter((u) => u.includes('/episodes?')).length === 1, `HTTP 429: sofort Schluss, kein zweiter Abruf (${zeile})`)
welt.r2.delete(SPERRE_SCHLUESSEL)
welt.episodesStatus = 200
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.tokenStatus = 403
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('token: HTTP 403') && cr().length === 1 && !welt.r2.has('x'), `Token 403: Schluss nach dem Token (${zeile})`)
welt.r2.delete(SPERRE_SCHLUESSEL)
welt.tokenStatus = 200

// 7b. HTTP 403, Netzfehler (Text im Protokoll), kein Termin, Aufbewahrung des Stands (genau drei Tage bleiben)
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.episodesStatus = 403
pruefe((await takt(SLOT + 30 * MIN)).includes('gestoppt: HTTP 403'), 'HTTP 403 der Folgenliste: Schluss')
welt.r2.delete(SPERRE_SCHLUESSEL)
welt.episodesStatus = 200
welt.wirft = 'Netz weg'
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('token: Netz weg') && cr().length === 1, `Netzfehler beim Token: Text im Protokoll, Schluss (${zeile})`)
welt.wirft = ''
const DREI_TAGE = 3 * 24 * 60 * MIN
welt.r2.set(STAND_SCHLUESSEL, JSON.stringify({ 'ALT:1:x': { slotMs: SLOT + 10 * MIN - DREI_TAGE }, 'ZUALT:1:x': { slotMs: SLOT + 10 * MIN - DREI_TAGE - 1 } }))
await takt(SLOT + 10 * MIN)
pruefe('ALT:1:x' in stand() && !('ZUALT:1:x' in stand()) && 'GT00384006:7:2026-11-15' in stand(), 'Stand: genau drei Tage alt bleibt, eine Millisekunde mehr fällt weg')
const gemerkt = TERMINE.splice(0, TERMINE.length)
welt.r2.set(STAND_SCHLUESSEL, '{}')
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile === '[ausbleiben] ziele=0' && cr().length === 0, `ohne Termin: ziele=0, kein Abruf (${zeile})`)
TERMINE.push(...gemerkt)

// 8. Höchstens ZIELE_JE_LAUF Termine je Takt
const mehr = Array.from({ length: 7 }, (_, i) => ev({ id: `m${i}`, releaseSlug: `cr-GT0000010${i}`, time: '15:00', episode: 1 }))
TERMINE.push(...mehr)
welt.r2.set(STAND_SCHLUESSEL, '{}')
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes(`dran=${ZIELE_JE_LAUF}`) && cr().filter((u) => u.includes('/series/')).length === ZIELE_JE_LAUF, `höchstens ${ZIELE_JE_LAUF} Termine je Takt (${zeile})`)
pruefe(ZIELE_JE_LAUF === 4, 'Grenze 4')

// 9. Ein Fehler im Messer stört den Takt nicht
welt.r2.set(STAND_SCHLUESSEL, 'kein json')
zeile = await takt(SLOT + 30 * MIN)
pruefe(protokoll.some((z) => z.startsWith('[ausbleiben] fehlgeschlagen')) && protokoll.some((z) => z.startsWith('[push5]')), 'kaputter Stand: Fehler wird protokolliert, der Push-Takt läuft weiter')

// 10. Schalterwerte, die nur mit „an“ anfangen, schalten nicht ein
for (const wert of ['an?', 'anhalten']) {
  welt.r2.set(SCHALTER_SCHLUESSEL, wert)
  pruefe((await takt(SLOT + 30 * MIN)).endsWith('aus: Schalter') && cr().length === 0, `Schalter „${wert}“: aus`)
}
welt.r2.set(SCHALTER_SCHLUESSEL, 'an')

// 11. Zeitpunkt, Rückstand und Nichtauskunft mit eigenen Terminen
const setze = (...t: unknown[]) => void TERMINE.splice(0, TERMINE.length, ...(t as typeof TERMINE))
const A = ev({ id: 'x1', releaseSlug: 'cr-GT00384006', time: '15:00', episode: 7 })
const B = ev({ id: 'x2', releaseSlug: 'cr-GT00000001', time: '15:00', episode: 7 })
const KEY_A = 'GT00384006:7:2026-11-15'

// 11a. A1: Ein am selben Tag von 15:00 auf 17:00 verschobener Termin wird nie vor 17:00 + 26 min „ausgeblieben“
setze(A)
welt.r2.set(STAND_SCHLUESSEL, '{}')
zeile = await takt(SLOT + 5 * MIN)
pruefe(zeile.includes('"offen":1'), `A1: 15:05 gelesen, offen (${zeile})`)
setze(ev({ id: 'x1', releaseSlug: 'cr-GT00384006', time: '17:00', episode: 7 }))
zeile = await takt(SLOT + 65 * MIN)
pruefe(zeile === '[ausbleiben] ziele=1 dran=0' && cr().length === 0 && !zeile.includes('ausgeblieben'), `A1: 16:05, Termin jetzt 17:00: nichts dran, nie ausgeblieben (${zeile})`)
zeile = await takt(SLOT + 125 * MIN)
pruefe(zeile.includes('"offen":1') && stand()[KEY_A]?.ohneDeutschAm === SLOT + 125 * MIN, `A1: 17:05 gelesen, nach dem neuen Slot erst offen (${zeile})`)
zeile = await takt(SLOT + 150 * MIN)
pruefe(zeile.includes('"ausgeblieben":1'), `A1: 17:30 ausgeblieben, gerechnet ab 17:00 (${zeile})`)

// 11b. A2: Nach 403/429 Pause (eine Stunde), dann wieder
setze(A)
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.r2.delete(SPERRE_SCHLUESSEL)
welt.episodesStatus = 429
zeile = await takt(SLOT + 10 * MIN)
pruefe(zeile.includes('gestoppt: HTTP 429') && welt.r2.get(SPERRE_SCHLUESSEL) === String(SLOT + 70 * MIN), `A2: 429 setzt die Sperre bis 15:10Z (${welt.r2.get(SPERRE_SCHLUESSEL)})`)
welt.episodesStatus = 200
zeile = await takt(SLOT + 15 * MIN)
pruefe(zeile === '[ausbleiben] ziele=1 dran=1 gesperrt' && cr().length === 0, `A2: fünf Minuten später: kein einziger Abruf (${zeile})`)
pruefe((await takt(SLOT + 69 * MIN)).endsWith('gesperrt') && cr().length === 0, 'A2: eine Minute vor Ablauf noch Sperre')
zeile = await takt(SLOT + 70 * MIN)
pruefe(!zeile.includes('gesperrt') && cr().length === 3, `A2: genau zum Ablauf wieder Token, Staffel- und Folgenliste (${zeile})`)
welt.r2.delete(SPERRE_SCHLUESSEL)
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.tokenStatus = 429
zeile = await takt(SLOT + 80 * MIN)
pruefe(zeile.includes('token: HTTP 429') && welt.r2.get(SPERRE_SCHLUESSEL) === String(SLOT + 140 * MIN), `A2: 429 am Token sperrt ebenso (${zeile})`)
zeile = await takt(SLOT + 85 * MIN)
pruefe(zeile.endsWith('gesperrt') && cr().length === 0, 'A2: danach kein Tokenabruf')
welt.tokenStatus = 500
welt.r2.delete(SPERRE_SCHLUESSEL)
welt.r2.set(STAND_SCHLUESSEL, '{}')
zeile = await takt(SLOT + 90 * MIN)
pruefe(zeile.includes('token: HTTP 500') && !welt.r2.has(SPERRE_SCHLUESSEL), 'A2: ein einfacher Fehler am Token sperrt nicht')
welt.tokenStatus = 200

// 11c. A3: HTTP 500 mit gültigem JSON-Rumpf (Folge ohne Deutsch, Slot + 40 min) ist nie Ausbleiben
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.episodesStatus = 500
welt.mitRumpf = true
zeile = await takt(SLOT + 40 * MIN)
pruefe(zeile.includes('"unbekannt":1') && !zeile.includes('"ausgeblieben":1'), `A3: HTTP 500 mit Rumpf: unbekannt (${zeile})`)
welt.episodesStatus = 200
welt.mitRumpf = false

// 11d. A3: 429 an der Staffelliste beendet den Takt (kein Abruf für das zweite Ziel)
setze(A, B)
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.seasonsStatus = 429
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('gestoppt: HTTP 429') && cr().filter((u) => u.includes('/series/')).length === 1 && cr().filter((u) => u.includes('/episodes?')).length === 0, `A3: 429 an der Staffelliste: Schluss nach einem Abruf (${zeile})`)
welt.seasonsStatus = 200
welt.r2.delete(SPERRE_SCHLUESSEL)

// 11e. A3: 429 erst beim zweiten Ziel: die Lesung des ersten bleibt im Stand
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.episodes429Ab = 2
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('gestoppt: HTTP 429') && stand()[KEY_A]?.ohneDeutschAm === SLOT + 30 * MIN && !('GT00000001:7:2026-11-15' in stand()), `A3: Stand bleibt bei Stopp erhalten (${JSON.stringify(stand())})`)
welt.episodes429Ab = 0
welt.r2.delete(SPERRE_SCHLUESSEL)

// 11f. A3: eine hängende Antwort endet an der Frist von 8 s (Frist hier verkürzt), nicht nie
welt.r2.set(STAND_SCHLUESSEL, '{}')
welt.haengt = true
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('token: abgebrochen (Frist)') && !welt.ohneFrist && welt.fristen.includes(8000), `A3: Abruf mit Frist 8000 ms (${zeile}, ${welt.fristen})`)
welt.haengt = false

// 11g. A4: Ein frischer Termin kommt trotz vier Rückständen im selben Takt dran, die Kappe bleibt
const rueck = [1, 2, 3, 4].map((i) => ev({ id: `r${i}`, releaseSlug: `cr-GT0000020${i}`, time: '15:00', episode: 1 }))
const frisch = ev({ id: 'fr', releaseSlug: 'cr-GT00000299', time: '16:00', episode: 1 })
setze(...rueck, frisch)
welt.r2.set(STAND_SCHLUESSEL, JSON.stringify(Object.fromEntries([1, 2, 3, 4].map((i) => [`GT0000020${i}:1:2026-11-15`, { slotMs: SLOT, letzteLesung: SLOT + 5 * MIN, ohneDeutschAm: SLOT + 5 * MIN }]))))
zeile = await takt(SLOT + 70 * MIN)
const s11 = stand()
pruefe(zeile.includes('ziele=5 dran=4') && s11['GT00000299:1:2026-11-15']?.letzteLesung === SLOT + 70 * MIN, `A4: der frische Termin wird gelesen (${zeile})`)
pruefe(Object.values(s11).filter((s) => s.letzteLesung === SLOT + 70 * MIN).length === 4 && s11['GT00000204:1:2026-11-15']?.letzteLesung === SLOT + 5 * MIN, 'A4: vom Rückstand nur drei, der späteste wartet')
// ein verschobener Termin (Stand mit altem Slot und früherer Lesung) ist ebenfalls frisch
welt.r2.set(STAND_SCHLUESSEL, JSON.stringify({ ...Object.fromEntries([1, 2, 3, 4].map((i) => [`GT0000020${i}:1:2026-11-15`, { slotMs: SLOT, letzteLesung: SLOT + 5 * MIN, ohneDeutschAm: SLOT + 5 * MIN }])), 'GT00000299:1:2026-11-15': { slotMs: SLOT, letzteLesung: SLOT + 5 * MIN, ohneDeutschAm: SLOT + 5 * MIN } }))
await takt(SLOT + 70 * MIN)
pruefe(stand()['GT00000299:1:2026-11-15']?.letzteLesung === SLOT + 70 * MIN && stand()['GT00000299:1:2026-11-15']?.slotMs === SLOT + 60 * MIN, 'A4: verschobener Termin kommt vor dem Rückstand dran, mit neuem Slot')

// 11h. A5: Folge der Vorstaffel (Staffel 2 ohne Deutsch): alte Folge zählt nicht, junge schon
setze(A)
welt.staffeln = { data: [...staffeln.data, { season_sequence_number: 2, versions: [{ audio_locale: 'ja-JP', guid: 'JA2' }] }] }
const eintrag = (datum: string) => ({ data: [{ episode_number: 7, episode_air_date: datum, versions: [{ audio_locale: 'ja-JP' }, { audio_locale: 'de-DE' }] }] })
welt.folgenAntwort = eintrag('2024-05-01T00:00:00Z')
welt.r2.set(STAND_SCHLUESSEL, '{}')
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('"unbekannt":1') && stand()[KEY_A]?.gesehenAm === undefined && stand()[KEY_A]?.staffel === undefined, `A5: Folge 7 von 2024 ist keine Sichtung des Termins (${zeile})`)
welt.folgenAntwort = eintrag('2026-11-14T10:00:00Z')
welt.r2.set(STAND_SCHLUESSEL, '{}')
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('"erschienen":1'), `A5: Folge 7 vom Vortag zählt (${zeile})`)
// Grenze: genau 21 Tage vor dem Termin zählt, eine Sekunde davor nicht; ohne Datum nie
for (const [datum, soll] of [['2026-10-25T14:00:00Z', '"erschienen":1'], ['2026-10-25T13:59:59Z', '"unbekannt":1']] as const) {
  welt.folgenAntwort = eintrag(datum)
  welt.r2.set(STAND_SCHLUESSEL, '{}')
  zeile = await takt(SLOT + 30 * MIN)
  pruefe(zeile.includes(soll), `A5: Folge vom ${datum} gegen Termin 15.11. 14:00Z: ${soll} (${zeile})`)
}
welt.folgenAntwort = { data: [{ episode_number: 7, versions: [{ audio_locale: 'de-DE' }] }] }
welt.r2.set(STAND_SCHLUESSEL, '{}')
zeile = await takt(SLOT + 30 * MIN)
pruefe(zeile.includes('"unbekannt":1'), `A5: Folge der Vorstaffel ohne Datum zählt nicht (${zeile})`)
welt.staffeln = staffeln
welt.folgenAntwort = null

if (fehler) {
  zeige(`\n${fehler} Prüfung(en) rot.`)
  process.exit(1)
}
zeige('\nAlle Prüfungen grün.')
