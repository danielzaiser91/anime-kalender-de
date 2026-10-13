/**
 * Zusicherungen zum Sammler für offizielle Websites (13.10.2026), ohne Netz: Relevanzfilter (die von Hand gefundenen Meldungen rein, die typischen Fehltreffer raus),
 * Datumsfenster der Vorschläge und die Leser für Feed, JSON, WordPress und HTML. Höflichkeit und Fristen des Laufs stehen in `check-offizielle-lauf.ts`.
 */
import { datumIn, nurDatum } from './lib/offiziell-datum.ts'
import { lese } from './lib/offiziell-lesen.ts'
import { kategorie } from './lib/offiziell-relevanz.ts'
import type { Seite } from './lib/offiziell-seiten.ts'
import { BEHALTEN_TAGE, KANDIDATEN_TAGE, fuehreZusammen, kandidaten } from './lib/offiziell-vorschlaege.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-13'
const seite = (host: string, muster: Seite['muster'] = 'html', mehr: Partial<Seite> = {}): Seite => ({ host, url: `https://${host}/news/`, muster, sprache: 'ja', ...mehr })

function relevanz(): void {
  console.log('\nRelevanzfilter (Handstichprobe 13.10.2026)')
  const rein: [string, string][] = [
    ['Season 2 Production Confirmed!', 'staffel'],
    ['2026年10月より第2期 第2クール放送決定！', 'staffel'],
    ['第2期 第2クールの放送・配信情報を公開！', 'staffel'],
    ['3期第2クール、2027年放送決定！', 'staffel'],
    ['Netflixにて世界独占配信！', 'termin'],
    ['Netflixにて、2026年世界独占配信決定！', 'termin'],
    ['Prime Videoで第1話先行配信', 'termin'],
    ['劇場版 公開決定', 'film'],
    ['ドイツ語吹替版の配信が決定', 'synchro'],
    ['Netflix世界独占配信 Blu-ray特典も決定', 'termin'],
  ]
  for (const [titel, soll] of rein) pruefe(`relevant (${soll}): ${titel}`, kategorie(titel) === soll, kategorie(titel))
  const raus = [
    'TVアニメ『東京リベンジャーズ』三天戦争編 Blu-ray＆DVD第1巻 発売記念プレゼントキャンペーン開催決定！',
    '映画・チャンネルNECOにて放送決定',
    '劇場物販情報を公開',
    '三天戦争編 放送開始記念！ アニメイト限定ポスタージャック',
    '第2期 オンラインくじ販売決定',
    '「大樹のむらじお！２」第１０回配信のゲストが決定',
    'ABEMA、TVerにて「花ざかりの君たちへ」一挙配信の実施決定！',
    '第4期PV第2弾',
    'AT-Xにて一挙放送決定！',
    '作戦41あらすじ＆場面写真公開！',
    '第2期ノンクレジットOP公開！',
  ]
  for (const titel of raus) pruefe(`nicht relevant: ${titel}`, kategorie(titel) === undefined, kategorie(titel))
}

function datumsfenster(): void {
  console.log('\nDatumsfenster der Vorschläge')
  const s = seite('snowballearth.net', 'json', { sprache: 'en' })
  const tag = (zurueck: number): string => new Date(Date.parse(`${HEUTE}T00:00:00Z`) - zurueck * 86_400_000).toISOString().slice(0, 10)
  const eintrag = (zurueck: number) => ({ titel: 'Season 2 Production Confirmed!', datum: tag(zurueck), url: 'https://snowballearth.net/en/news/detail.html?d=1' })
  pruefe(`eine Staffelmeldung von vor ${KANDIDATEN_TAGE} Tagen wird noch vorgeschlagen`, kandidaten(s, [eintrag(KANDIDATEN_TAGE)], [196144], HEUTE).length === 1)
  pruefe(`eine von vor ${KANDIDATEN_TAGE + 1} Tagen nicht mehr`, kandidaten(s, [eintrag(KANDIDATEN_TAGE + 1)], [196144], HEUTE).length === 0)
  const v = kandidaten(s, [eintrag(108)], [196144], HEUTE)[0]!
  pruefe('der Vorschlag trägt Überschrift wörtlich, Tag der Seite, Kachel, Sprache, Kategorie, Fundtag', v.titel === 'Season 2 Production Confirmed!' && v.datum === tag(108) && v.titelIds[0] === 196144 && v.sprache === 'en' && v.kategorie === 'staffel' && v.gefundenAm === HEUTE, v)
  const wieder = fuehreZusammen([v], kandidaten(s, [eintrag(108)], [196144], '2026-10-20'), '2026-10-20')
  pruefe('derselbe Fund an einem späteren Tag ändert nichts (keine Dopplung, gefundenAm bleibt)', wieder.length === 1 && wieder[0]!.gefundenAm === HEUTE, wieder)
  const alt = fuehreZusammen([v], [], tag(108 - BEHALTEN_TAGE - 1))
  pruefe(`nach ${BEHALTEN_TAGE} Tagen fällt ein Vorschlag aus der Datei`, alt.length === 0, alt)
}

const RSS = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[3期第2クール、2027年放送決定！]]></title><link>https://m.example/news/1/</link><pubDate>Sat, 03 Oct 2026 00:30:00 +0900</pubDate><content:encoded><![CDATA[<p>Volltext</p>]]></content:encoded></item></channel></rss>`
const ATOM = `<feed><entry><title type="html">Dub &amp; more</title><link rel="alternate" href="https://a.example/p/2"/><updated>2026-09-18T01:00:00+09:00</updated></entry></feed>`
const WP = JSON.stringify([{ date: '2026-08-15T10:00:00', title: { rendered: 'AT-X&#8211;Sendung' }, link: 'https://w.example/news/471/' }])
const LISTE = JSON.stringify({ data: { list: [{ uniqueId: '20260627_01', title: 'Season 2 Production Confirmed!', date: '2026.06.27', directLinkUrl: '' }] } })

function leser(): void {
  console.log('\nLeser: Feed, WordPress, JSON')
  const rss = lese('feed', RSS, 'https://m.example/feed/', HEUTE)
  pruefe('RSS: Überschrift aus CDATA, Adresse, Tag in der Ortszeit der Seite (03.10. 00:30 JST, nicht 02.10. Berlin), kein Volltext', rss[0]?.titel === '3期第2クール、2027年放送決定！' && rss[0].datum === '2026-10-03' && JSON.stringify(rss).includes('Volltext') === false, rss)
  const atom = lese('feed', ATOM, 'https://a.example/feed', HEUTE)
  pruefe('Atom: Überschrift, href, Tag', atom[0]?.titel === 'Dub & more' && atom[0].url === 'https://a.example/p/2' && atom[0].datum === '2026-09-18', atom)
  const wp = lese('wp', WP, 'https://w.example/wp-json/', HEUTE)
  pruefe('WordPress: title.rendered ohne Entitäten, Link', wp[0]?.titel === 'AT-X–Sendung' && wp[0].url === 'https://w.example/news/471/', wp)
  const json = lese('json', LISTE, 'https://s.example/en/news/newslist.json', HEUTE, 'https://s.example/en/news/detail.html?d={uniqueId}')
  pruefe('JSON: Liste unter data.list, leere directLinkUrl, Adresse aus der Vorlage', json[0]?.url === 'https://s.example/en/news/detail.html?d=20260627_01' && json[0].datum === '2026-06-27', json)
  pruefe('JSON ohne Vorlage und ohne Link: Adresse der Liste', lese('json', LISTE, 'https://s.example/n.json', HEUTE)[0]?.url === 'https://s.example/n.json')
  pruefe('kaputtes JSON ergibt eine leere Liste, keinen Abbruch', lese('json', '{nicht json', 'https://s.example/', HEUTE).length === 0)
  const zukunft = JSON.stringify([{ title: 'Termin im Text', date: '2027-02-19' }, { title: 'heute', date: HEUTE }])
  pruefe('Zukunftsdatum (Termin im Text) ist keine Meldung', lese('json', zukunft, 'https://s.example/', HEUTE).map((e) => e.titel).join() === 'heute')
}

const TABELLE = `<html><head><title>NEWS 2026年7月1日（水）より</title></head><body><table>
<tr><td class="day">2026/10/11</td><td class="read"><div class="title"><a href="../story/41.html">作戦41あらすじ＆場面写真公開！</a></div></td></tr>
<tr><td class="day">2026/09/25</td><td class="read"><div class="title"><a href="/news/index02700000.html">第2期 第2クールの放送・配信情報を公開！</a></div></td></tr></table></body></html>`
const LISTE_A = `<ul class="news"><li><a href="/news/archives/5125"><span class="c-news-date">2026.10.12</span><span class="cat">NEWS</span><p>TVアニメ 53話 放送＆配信時間変更のおしらせ</p></a></li>
<li><span class="date">2026.06.27</span><a href="detail.html?d=2">Season 2 Production Confirmed!</a></li></ul><script>var d = "2026.01.01 nicht lesen"</script>`
const DEFINITIONSLISTE = `<dl><dt>2026.09.14</dt><dd><a href="/n/1">ABEMAにて一挙配信</a></dd><dt>2026.07.06</dt><dd class="x"><span>NEWS</span><a href="#">ストーリービジュアル解禁</a></dd></dl>`
const ZEIT = `<article><time datetime="2026-08-15T10:00:00+09:00">8/15</time><h2><a href="/p/9">AT-Xにて一挙放送決定！</a></h2></article>`

function htmlLeser(): void {
  console.log('\nLeser: HTML-Listen (vier Gerüste, ein Leser)')
  const t = lese('html', TABELLE, 'https://y.example/news/', HEUTE)
  pruefe('Tabelle: Datum in der Zelle, Titel im Link, relative Adressen aufgelöst', t.length === 2 && t[0]!.url === 'https://y.example/story/41.html' && t[1]!.titel.startsWith('第2期') && t[1]!.url === 'https://y.example/news/index02700000.html', t)
  pruefe('Datum im <title> der Seite zählt nicht', !t.some((e) => e.datum === '2026-07-01'))
  const a = lese('html', LISTE_A, 'https://t.example/news/', HEUTE)
  pruefe('Liste mit Link um das Datum: Rubrik „NEWS“ ist keine Überschrift', a.find((e) => e.datum === '2026-10-12')?.titel === 'TVアニメ 53話 放送＆配信時間変更のおしらせ', a)
  pruefe('Liste mit Datum neben dem Link', a.find((e) => e.datum === '2026-06-27')?.url === 'https://t.example/news/detail.html?d=2', a)
  pruefe('Datum in einem Skript wird nicht gelesen', !a.some((e) => e.datum === '2026-01-01'))
  const d = lese('html', DEFINITIONSLISTE, 'https://d.example/news/', HEUTE)
  pruefe('Definitionsliste (dt/dd): jedes Datum bekommt den Link seiner dd', d.find((e) => e.datum === '2026-09-14')?.url === 'https://d.example/n/1' && d.length === 2, d)
  pruefe('Link „#“ gilt nicht: die Adresse ist die der Liste', d.find((e) => e.datum === '2026-07-06')?.url === 'https://d.example/news/', d)
  const z = lese('html', ZEIT, 'https://z.example/', HEUTE)
  pruefe('<time datetime> liefert das Datum, wenn der sichtbare Text keines nennt', z[0]?.datum === '2026-08-15' && z[0].titel.startsWith('AT-X'), z)
  pruefe('Überschrift, die nur eine Adresse ist (Verweis auf Shop/YouTube), entfällt', lese('html', '<li>2026.09.29 <a href="https://youtu.be/x">https://youtu.be/x</a></li>', 'https://z.example/', HEUTE).length === 0)
  pruefe('Seite ohne Liste ergibt eine leere Liste', lese('html', '<html><body><p>Willkommen</p></body></html>', 'https://z.example/', HEUTE).length === 0)
}

function datumsleser(): void {
  console.log('\nDatum im Text')
  const faelle: [string, string | undefined][] = [
    ['2026.06.27', '2026-06-27'], ['2026年6月27日（土）', '2026-06-27'], ['2026/10/01', '2026-10-01'], ['June 27, 2026', '2026-06-27'],
    ['27 Jun 2026', '2026-06-27'], ['27.06.2026', '2026-06-27'], ['6/27', undefined], ['2026.02.30', undefined], ['Season 2', undefined],
  ]
  for (const [text, soll] of faelle) pruefe(`„${text}“ → ${soll ?? 'kein Datum'}`, datumIn(text) === soll, datumIn(text))
  pruefe('„2026.10.01 Season2“ ist nicht nur ein Datum', !nurDatum('2026.10.01 Season2') && nurDatum('2026.10.01 (木)'))
}

relevanz()
datumsfenster()
leser()
htmlLeser()
datumsleser()

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nOffizielle Websites (Filter, Fenster, Leser): alle Zusicherungen erfüllt')
