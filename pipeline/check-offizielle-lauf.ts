/**
 * Zusicherungen zum Lauf des Sammlers für offizielle Websites (13.10.2026), ohne Netz und ohne Warten:
 * Höflichkeit (robots.txt, Crawl-delay, Pause statt Abbruch) und die Fristen. Jede Drossel hat ihren Test „Änderung wird spätestens nach X sichtbar“:
 * - eine neue Meldung steht spätestens nach 3 Tagen in der Vorschlagsdatei (60 Hosts, 25 je Lauf),
 * - eine geänderte robots.txt gilt spätestens am 7. Tag,
 * - eine Pause endet spätestens nach 24 Stunden, auch bei `Retry-After` von 10 Tagen,
 * - der Wecker startet den Lauf täglich; fällt er aus, holt die Wecker-Wache ihn nach 30 Stunden nach (`shared/weckplan.ts`, `wecker-wache.yml`).
 */
import { readFileSync } from 'node:fs'
import { faelligeLaeufe, startErlaubt } from '../shared/weckplan.ts'
import { crawlDelay, type Antwort, type Holer } from './lib/offiziell-abruf.ts'
import { lauf, type LaufEinstellung } from './lib/offiziell-lauf.ts'
import { MUSTER_NAMEN, ladeSeiten, titelJeHost, type Seite } from './lib/offiziell-seiten.ts'
import { FEHLER_BIS_PAUSE, faelligeSeiten, nachLesung, type Stand } from './lib/offiziell-stand.ts'
import { fuehreZusammen, type Vorschlag } from './lib/offiziell-vorschlaege.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kein = async (): Promise<void> => undefined
const sprich = (status: number, text = '', retryAfter?: number): Antwort => ({ status, text, retryAfter })
const tag0 = Date.UTC(2026, 9, 13, 4)
const tagN = (n: number): Date => new Date(tag0 + n * 86_400_000)
const iso = (d: Date): string => d.toISOString().slice(0, 10)
const seite = (host: string, mehr: Partial<Seite> = {}): Seite => ({ host, url: `https://${host}/news/`, muster: 'html', sprache: 'ja', ...mehr })
const liste = (datum: string, titel: string): string => `<ul><li><span>${datum.replaceAll('-', '.')}</span><a href="/n/1">${titel}</a></li></ul>`
const einstellung = (jetzt: Date, mehr: Partial<LaufEinstellung> = {}): LaufEinstellung => ({ jetzt, grenze: 25, ende: Infinity, uhr: () => 0, ...mehr })

function robotsLesen(): void {
  console.log('\nCrawl-delay in der robots.txt')
  pruefe('für alle gilt', crawlDelay('User-agent: *\nCrawl-delay: 30\n') === 30)
  pruefe('einer anderen Kennung gilt nicht', crawlDelay('User-agent: Googlebot\nCrawl-delay: 30\n') === 0)
  pruefe('Kennung mit Punkt gilt uns', crawlDelay('User-agent: *\nCrawl-delay: 30\n\nUser-agent: anime-kalender.de\nCrawl-delay: 5\n') === 5)
  pruefe('unserer Kennung schlägt den für alle', crawlDelay('User-agent: *\nCrawl-delay: 30\n\nUser-agent: anime-kalender\nCrawl-delay: 5\n') === 5)
}

async function hoeflichkeit(): Promise<void> {
  console.log('\nHöflichkeit: robots.txt, Crawl-delay, Pause statt Abbruch')
  const jetzt = tagN(0)
  const aufrufe: string[] = []
  const holer = (robots: Antwort, antwort: Antwort): Holer => async (url) => {
    aufrufe.push(url)
    return url.endsWith('/robots.txt') ? robots : antwort
  }
  const html = liste('2026-10-12', '第2期 放送決定！')
  const verboten = await lauf([seite('a.example')], { hosts: {} }, new Map(), einstellung(jetzt), holer(sprich(200, 'User-agent: *\nDisallow: /news/\n'), sprich(200, html)), kein)
  pruefe('robots.txt verbietet den Pfad: die Liste wird nicht abgerufen', aufrufe.every((u) => u.endsWith('/robots.txt')) && verboten.stand.hosts['a.example']?.ausgang === 'robots', aufrufe)
  const zwei = await lauf([seite('b.example'), seite('c.example')], { hosts: {} }, new Map(), einstellung(jetzt), async (u) => (u.includes('b.example') ? sprich(u.endsWith('robots.txt') ? 404 : 403, '', 864_000) : sprich(u.endsWith('robots.txt') ? 404 : 200, html)), kein)
  const b = zwei.stand.hosts['b.example']!
  pruefe('403 auf der Liste: Pause statt Abbruch, der nächste Host wird trotzdem gelesen', b.ausgang === 'gesperrt' && b.status === 403 && zwei.stand.hosts['c.example']?.ausgang === 'ok', zwei.zeilen)
  const pause = Date.parse(b.pauseBis!) - jetzt.getTime()
  pruefe('die Pause endet spätestens nach 24 Stunden, auch bei Retry-After von 10 Tagen', pause <= 86_400_000 && pause >= 3_600_000, b)
  const nachPause = faelligeSeiten([seite('b.example')], zwei.stand, new Date(jetzt.getTime() + pause + 60_000), 25)
  const waehrendPause = faelligeSeiten([seite('b.example')], zwei.stand, new Date(jetzt.getTime() + 60_000), 25)
  pruefe('während der Pause wird der Host nicht gelesen, danach wieder', waehrendPause.length === 0 && nachPause.length === 1)
  const gewartet: number[] = []
  const langsam = await lauf([seite('d.example')], { hosts: {} }, new Map(), einstellung(jetzt), holer(sprich(200, 'User-agent: *\nCrawl-delay: 30\n'), sprich(200, html)), async (ms) => void gewartet.push(ms))
  pruefe('Crawl-delay 30 s: der Lauf wartet 30 s zwischen robots.txt und Liste', gewartet.includes(30_000) && langsam.stand.hosts['d.example']?.ausgang === 'ok', gewartet)
  gewartet.length = 0
  const zuLang = await lauf([seite('e.example')], { hosts: {} }, new Map(), einstellung(jetzt), holer(sprich(200, 'User-agent: *\nCrawl-delay: 600\n'), sprich(200, html)), async (ms) => void gewartet.push(ms))
  pruefe('Crawl-delay über 60 s: der Host wird in diesem Lauf übersprungen', gewartet.length === 0 && zuLang.stand.hosts['e.example']?.ausgang === 'robots', gewartet)
}

function fehlschlaege(): void {
  console.log('\nFehlschläge')
  let h = nachLesung(undefined, 'fehler', tagN(0))
  pruefe('ein einzelner Fehlschlag pausiert nicht', h.pauseBis === undefined && h.fehler === 1, h)
  for (let i = 1; i < FEHLER_BIS_PAUSE; i++) h = nachLesung(h, 'fehler', tagN(0))
  pruefe(`nach ${FEHLER_BIS_PAUSE} Fehlschlägen in Folge pausiert der Host`, h.pauseBis !== undefined, h)
  const gut = nachLesung(h, 'ok', tagN(1))
  pruefe('ein Erfolg setzt Zähler und Pause zurück', gut.pauseBis === undefined && gut.fehler === 0, gut)
}

/** Tag für Tag lesen, wie der Wecker es täglich tut; `inhalt` bestimmt, was jeder Host an diesem Tag liefert. */
async function tage(seiten: Seite[], anzahl: number, inhalt: (host: string, tag: number, url: string) => Antwort): Promise<{ stand: Stand; vorschlaege: Vorschlag[]; gelesen: string[][] }> {
  let stand: Stand = { hosts: {} }
  let vorschlaege: Vorschlag[] = []
  const gelesen: string[][] = []
  for (let t = 0; t < anzahl; t++) {
    const heute: string[] = []
    const holer: Holer = async (url) => {
      const host = new URL(url).host
      if (!url.endsWith('/robots.txt')) heute.push(host)
      return inhalt(host, t, url)
    }
    const ergebnis = await lauf(seiten, stand, new Map(), einstellung(tagN(t)), holer, kein)
    stand = ergebnis.stand
    vorschlaege = fuehreZusammen(vorschlaege, ergebnis.neu, iso(tagN(t)))
    gelesen.push(heute)
  }
  return { stand, vorschlaege, gelesen }
}

async function fristen(): Promise<void> {
  console.log('\nFristen: Änderungen werden spätestens nach X sichtbar')
  const hosts = Array.from({ length: 60 }, (_, i) => `h${String(i + 1).padStart(2, '0')}.example`)
  const seiten = hosts.map((h) => seite(h))
  const ohneNeues = (url: string): Antwort => sprich(url.endsWith('/robots.txt') ? 404 : 200, liste('2026-10-01', 'Goodies im Shop'))
  const neuAb1 = (host: string, t: number, url: string): Antwort =>
    host === 'h60.example' && t >= 1 && !url.endsWith('/robots.txt') ? sprich(200, liste(iso(tagN(t)), 'Season 2 Production Confirmed!')) : ohneNeues(url)
  const lauf3 = await tage(seiten, 3, (h, t, u) => neuAb1(h, t, u))
  pruefe('nach 2 Läufen sind erst 50 von 60 Hosts gelesen (25 je Lauf)', new Set(lauf3.gelesen.slice(0, 2).flat()).size === 50, lauf3.gelesen.map((g) => g.length))
  pruefe('nach 3 Läufen ist jeder Host gelesen: eine neue Meldung steht spätestens am 3. Tag in der Vorschlagsdatei', new Set(lauf3.gelesen.flat()).size === 60 && lauf3.vorschlaege.some((v) => v.host === 'h60.example' && v.kategorie === 'staffel'), lauf3.vorschlaege)
  const zweimal = await lauf(seiten, lauf3.stand, new Map(), einstellung(tagN(2)), async (u) => ohneNeues(u), kein)
  const heuteGelesen = new Set(lauf3.gelesen[2])
  pruefe('ein zweiter Lauf am selben Tag liest keinen Host ein zweites Mal', zweimal.zeilen.length > 0 && zweimal.zeilen.every((z) => !heuteGelesen.has(z.split(' ')[0]!)), zweimal.zeilen)
  const einHost = await tage([seite('r.example')], 10, (_h, t, url) =>
    url.endsWith('/robots.txt') ? sprich(200, t >= 3 ? 'User-agent: *\nDisallow: /news/\n' : 'User-agent: *\nDisallow: /intern/\n') : sprich(200, liste('2026-10-12', 'Season 2 Production Confirmed!')),
  )
  const letzterLesetag = einHost.gelesen.map((g, t) => (g.length ? t : -1)).reduce((a, b) => Math.max(a, b), -1)
  pruefe(`eine ab Tag 3 geltende Sperre in der robots.txt wirkt spätestens am Tag 7`, letzterLesetag < 7 && letzterLesetag >= 3, einHost.gelesen.map((g) => g.length))
}

async function frist(): Promise<void> {
  console.log('\nFrist des Laufs')
  const seiten = ['a', 'b', 'c', 'd', 'e'].map((h) => seite(`${h}.example`))
  let ticks = 0
  const holer: Holer = async (url) => sprich(url.endsWith('/robots.txt') ? 404 : 200, liste('2026-10-12', 'Season 2 Production Confirmed!'))
  const erster = await lauf(seiten, { hosts: {} }, new Map(), einstellung(tagN(0), { ende: 2, uhr: () => ticks++ }), holer, kein)
  pruefe('nach Ablauf der Frist beginnt der Lauf keinen weiteren Host und meldet den Rest', erster.zeilen.length === 3 && erster.uebrig === 2, erster.zeilen.length)
  const zweiter = await lauf(seiten, erster.stand, new Map(), einstellung(tagN(1)), holer, kein)
  pruefe('der nächste Lauf liest zuerst, was die Frist übrig ließ', zweiter.zeilen.slice(0, 2).every((z) => z.startsWith('d.example') || z.startsWith('e.example')), zweiter.zeilen)
}

function zuordnung(): void {
  console.log('\nHost → Titel (aniSearch-Websites)')
  const w = (url: string) => ({ info: { websites: [{ url }] } })
  const karte = titelJeHost({ '1': w('https://www.example.jp/'), '2': w('https://example.jp/news'), '3': w('https://andere.jp/'), '4': w('https://example.jp/'), '5': w('https://nur-in-aniSearch.jp/') }, { '1': 2024, '2': 2026, '3': 2026, '4': 2026 })
  pruefe('der jüngste Titel eines Hosts gewinnt, bei Gleichstand bleiben beide (www. zählt nicht)', karte.get('example.jp')?.join() === '2,4', [...karte])
  pruefe('ein Titel, den der Bestand nicht kennt, bekommt keine Kachel', !karte.has('nur-in-anisearch.jp'))
}

/** Der Wecker startet den Sammler täglich; die Wache holt ihn nach und kontrolliert ihn. Ohne diese Einträge liefe er nie von selbst. */
function wecker(): void {
  console.log('\nZeitplan (Cloudflare-Wecker)')
  const um = (isoZeit: string): boolean => faelligeLaeufe(new Date(isoZeit)).includes('offizielle-news.yml')
  pruefe('täglich um 13 Uhr UTC fällig, zu anderen Stunden nicht', um('2026-10-14T13:00:00Z') && um('2026-10-17T13:00:00Z') && !um('2026-10-14T12:00:00Z') && !um('2026-10-14T14:00:00Z'))
  const start = new Date('2026-10-14T13:00:00Z')
  const gestern = (stundenher: number) => [{ created_at: new Date(start.getTime() - stundenher * 3_600_000).toISOString(), status: 'completed', conclusion: 'success' }]
  pruefe('der Start vor 24 Stunden ist erlaubt, ein Doppelstart binnen 10 Stunden nicht', startErlaubt('offizielle-news.yml', gestern(24), start) && !startErlaubt('offizielle-news.yml', gestern(1), start))
  const wache = readFileSync(new URL('../.github/workflows/wecker-wache.yml', import.meta.url), 'utf8')
  const fristen = readFileSync(new URL('../tools/wache-fristen.mjs', import.meta.url), 'utf8')
  const nachholGrenze = Number(/offizielle-news\.yml:(\d+)/.exec(wache)?.[1])
  pruefe('fällt der Wecker aus, holt ihn die Wecker-Wache nach 30 Stunden nach (mehr als ein Takt von 24 h)', nachholGrenze > 24 && nachholGrenze <= 36, nachholGrenze)
  const frist = Number(/'offizielle-news\.yml': (\d+)/.exec(fristen)?.[1])
  pruefe('die Wochenwache meldet einen Ausfall spätestens nach 36 Stunden ohne Erfolg', frist > nachholGrenze && frist <= 36, frist)
}

function seitenliste(): void {
  console.log('\nSeitenliste data/offizielle-seiten.yaml')
  const seiten = ladeSeiten()
  const doppelt = seiten.filter((s, i) => seiten.findIndex((x) => x.host === s.host) !== i).map((s) => s.host)
  pruefe(`${seiten.length} Seiten, jeder Host einmal`, seiten.length > 0 && doppelt.length === 0, doppelt)
  const schlecht = seiten.filter((s) => !MUSTER_NAMEN.includes(s.muster) || new URL(s.url).host !== s.host || !s.url.startsWith('https://') || (s.eintrag && s.muster !== 'json') || !/^[a-z]{2}$/.test(s.sprache))
  pruefe('Muster bekannt, Adresse https auf dem eigenen Host, Vorlage nur bei JSON, Sprache zweistellig', schlecht.length === 0, schlecht.map((s) => s.host))
}

robotsLesen()
seitenliste()
await hoeflichkeit()
fehlschlaege()
await fristen()
await frist()
zuordnung()
wecker()

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nOffizielle Websites (Lauf, Höflichkeit, Fristen): alle Zusicherungen erfüllt')
