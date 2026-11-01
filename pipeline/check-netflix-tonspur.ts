/**
 * Tonspur-Zeile der Netflix-Titelseite: Parser (echte Seiten, gekürzt: `pipeline/fixtures/netflix-titelseite-*.html`),
 * Auswahl der offenen Filme und der Lauf mit Attrappen für Abruf und Pause (keine echte Zeit).
 * Aufruf: npx tsx pipeline/check-netflix-tonspur.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { leseNetflixTonspur, netflixKennung } from './lib/netflix-tonspur.ts'
import {
  erneutSeit,
  leseNetflixFilme,
  tonspurBelegZeilen,
  waehleNetflixFilme,
  type NetflixFilm,
  type TonspurBefund,
} from './lib/netflix-tonspur-lauf.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'
import type { Title } from '../shared/types.ts'

const fehler: string[] = []
let faelle = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  faelle++
  if (!ok) fehler.push(`${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
const seite = (n: string) => readFileSync(join(import.meta.dirname, 'fixtures', n), 'utf8')
const zeile = (sprachen: string) => `<div><h4 class="x">Audio</h4><span class="y">${sprachen}</span></div>`

/* --- Parser an den echten Seiten ------------------------------------------------------------------------ */
const chihiro = leseNetflixTonspur(seite('netflix-titelseite-chihiro.html'))
pruefe('Chihiro (echte Seite): Deutsch → ja', chihiro.urteil === 'ja', chihiro)
pruefe('Chihiro: sechs Sprachen, [Original] abgeschnitten', chihiro.sprachen.join('|') === 'Deutsch|Englisch|Französisch|Japanisch|Russisch|Türkisch', chihiro.sprachen)
const kino = leseNetflixTonspur(seite('netflix-titelseite-kino.html'))
pruefe('Kino’s Journey (echte Seite): nur Japanisch → nein, obwohl „Deutsch“ bei Untertitel steht', kino.urteil === 'nein' && kino.sprachen.join('|') === 'Japanisch', kino)

/* --- Parser: Grenzfälle --------------------------------------------------------------------------------- */
pruefe('keine Audio-Zeile → unbekannt', leseNetflixTonspur('<html><h4>Untertitel</h4><span>Deutsch</span></html>').urteil === 'unbekannt')
pruefe('leere Seite → unbekannt', leseNetflixTonspur('').urteil === 'unbekannt')
pruefe('leere Audio-Zeile → unbekannt', leseNetflixTonspur(zeile('  ')).urteil === 'unbekannt')
pruefe('englische Seite (German) → ja', leseNetflixTonspur(zeile('English, German und Japanese')).urteil === 'ja')
pruefe('Deutsch an letzter Stelle („und“) → ja', leseNetflixTonspur(zeile('Englisch, Japanisch und Deutsch')).urteil === 'ja')
pruefe('nur eine Sprache Deutsch → ja', leseNetflixTonspur(zeile('Deutsch [Original]')).urteil === 'ja')
pruefe('nur Audiodeskription ist kein Deutsch → nein', leseNetflixTonspur(zeile('Deutsch – Audiodeskription, Englisch')).urteil === 'nein')
pruefe('Teilwort („Deutsche Gebärdensprache“) ist kein Deutsch', leseNetflixTonspur(zeile('Deutsche Gebärdensprache und Englisch')).urteil === 'nein')
pruefe('fünf Sprachen ohne Deutsch → nein', leseNetflixTonspur(zeile('Englisch, Französisch, Italienisch, Japanisch und Türkisch')).urteil === 'nein')
pruefe('sechs Sprachen ohne Deutsch → unbekannt (Liste kann abgeschnitten sein)', leseNetflixTonspur(zeile('Englisch, Spanisch, Französisch, Italienisch, Japanisch und Türkisch')).urteil === 'unbekannt')
pruefe('Kennung aus /de/title/', netflixKennung('https://www.netflix.com/de/title/60023642') === '60023642')
pruefe('Kennung aus /title/', netflixKennung('https://www.netflix.com/title/60023642?x=1') === '60023642')
pruefe('Wunschadresse hat keine Kennung', netflixKennung('https://www.netflix.com/pokemonconcierge') === undefined)

/* --- Auswahl der offenen Filme -------------------------------------------------------------------------- */
const nf = (k: string) => ({ platform: 'netflix', url: `https://www.netflix.com/title/${k}` })
const titel = (id: number, format: string, streams: Array<{ platform: string; url: string }>): Title =>
  ({ id, format, titleDe: `T${id}`, streams }) as unknown as Title
const beleg = (id: number, datum: string, dub: boolean | undefined = true, platform = 'netflix'): DubCheck =>
  ({ anilistId: id, platform, dub, checkedAt: datum }) as DubCheck
const GRENZE = '2026-10-25'
const waehle = (titles: Title[], checks: DubCheck[] = [], erneut: Array<{ anilistId: number; platform: string; seit: string }> = [], bestand: Record<string, TonspurBefund> = {}) =>
  waehleNetflixFilme({ titles, checks, erneut: erneutSeit(erneut), bestand, grenze: GRENZE }).map((f) => f.titleId)
const url = (k: string) => `https://www.netflix.com/title/${k}`

pruefe('Film ohne Beleg ist offen', waehle([titel(900001, 'MOVIE', [nf('900101')])]).join() === '900001')
pruefe('Serie (TV) wird nie gewählt', waehle([titel(900002, 'TV', [nf('900102')])]).length === 0)
pruefe('OVA/Special wird nicht gewählt', waehle([titel(900003, 'OVA', [nf('900103')]), titel(900004, 'SPECIAL', [nf('900104')])]).length === 0)
pruefe('Film ohne Netflix-Weg wird nicht gewählt', waehle([titel(900005, 'MOVIE', [{ platform: 'primevideo', url: 'https://www.amazon.de/dp/B0X' }])]).length === 0)
pruefe('Netflix-Wunschadresse ohne Kennung wird nicht gewählt', waehle([titel(900006, 'MOVIE', [{ platform: 'netflix', url: 'https://www.netflix.com/pokemonconcierge' }])]).length === 0)
pruefe('belegter Film (dub: true) ist nicht offen', waehle([titel(900007, 'MOVIE', [nf('900107')])], [beleg(900007, '2026-09-01')]).length === 0)
pruefe('belegtes Nein (dub: false) ist auch ein Beleg', waehle([titel(900007, 'MOVIE', [nf('900107')])], [beleg(900007, '2026-09-01', false)]).length === 0)
pruefe('Adressbeleg ohne Urteil macht nicht belegt', waehle([titel(900008, 'MOVIE', [nf('900108')])], [{ anilistId: 900008, platform: 'netflix', checkedAt: '2026-09-01', url: url('900108') } as DubCheck]).join() === '900008')
pruefe('Beleg einer anderen Plattform macht nicht belegt', waehle([titel(900009, 'MOVIE', [nf('900109')])], [beleg(900009, '2026-09-01', true, 'primevideo')]).join() === '900009')
pruefe('Beleg eines anderen Titels macht nicht belegt', waehle([titel(900010, 'MOVIE', [nf('900110')])], [beleg(900011, '2026-09-01')]).join() === '900010')
const erneut = [{ anilistId: 900012, platform: 'netflix', seit: '2026-10-25' }]
pruefe('Wiedervorlage nach dem Beleg: wieder offen', waehle([titel(900012, 'MOVIE', [nf('900112')])], [beleg(900012, '2026-09-29')], erneut).join() === '900012')
pruefe('Beleg am Tag der Wiedervorlage erledigt sie', waehle([titel(900012, 'MOVIE', [nf('900112')])], [beleg(900012, '2026-10-25')], erneut).length === 0)
pruefe('Beleg nach der Wiedervorlage erledigt sie', waehle([titel(900012, 'MOVIE', [nf('900112')])], [beleg(900012, '2026-11-01')], erneut).length === 0)
pruefe('Wiedervorlage einer anderen Plattform zählt nicht', waehle([titel(900012, 'MOVIE', [nf('900112')])], [beleg(900012, '2026-09-29')], [{ anilistId: 900012, platform: 'primevideo', seit: '2026-10-25' }]).length === 0)
pruefe('Wiedervorlage eines anderen Titels zählt nicht', waehle([titel(900012, 'MOVIE', [nf('900112')])], [beleg(900012, '2026-09-29')], [{ anilistId: 900013, platform: 'netflix', seit: '2026-10-25' }]).length === 0)
pruefe('zwei Wiedervorlagen: die jüngere zählt', waehle([titel(900012, 'MOVIE', [nf('900112')])], [beleg(900012, '2026-10-01')], [{ anilistId: 900012, platform: 'netflix', seit: '2026-09-01' }, { anilistId: 900012, platform: 'netflix', seit: '2026-10-25' }]).join() === '900012')
const film = titel(900014, 'MOVIE', [nf('900114')])
pruefe('Lesung vor genau einer Woche: fällig', waehle([film], [], [], { [url('900114')]: { status: 200, geprueftAm: '2026-09-01', audio: 'nein', audioAm: '2026-10-24' } }).join() === '900014')
pruefe('Lesung an der Wochengrenze: noch nicht fällig', waehle([film], [], [], { [url('900114')]: { status: 200, geprueftAm: '2026-09-01', audio: 'nein', audioAm: GRENZE } }).length === 0)
pruefe('Lesung gestern: nicht fällig', waehle([film], [], [], { [url('900114')]: { status: 200, geprueftAm: '2026-09-01', audio: 'unbekannt', audioAm: '2026-10-31' } }).length === 0)
pruefe('Befund ohne Lesung (nur Status): fällig', waehle([film], [], [], { [url('900114')]: { status: 200, geprueftAm: '2026-10-31' } }).join() === '900014')

/* --- Lauf mit Attrappen --------------------------------------------------------------------------------- */
const filme = (n: number): NetflixFilm[] => Array.from({ length: n }, (_, i) => ({ titleId: 900200 + i, titel: `F${i}`, url: url(String(900300 + i)) }))
const JA = `<html>${zeile('Deutsch, Englisch und Japanisch')}</html>`
const NEIN = `<html>${zeile('Japanisch [Original]')}</html>`
async function lauf(n: number, antwort: (u: string, i: number) => { status: number; text: string } | 'wirft', weiter = () => true) {
  const bestand: Record<string, TonspurBefund | undefined> = {}
  const abrufe: string[] = []
  let pausen = 0
  const erg = await leseNetflixFilme({
    filme: filme(n),
    bestand,
    hole: async (u) => {
      abrufe.push(u)
      const a = antwort(u, abrufe.length - 1)
      if (a === 'wirft') throw new Error('Netzfehler')
      return a
    },
    pause: async () => {
      pausen++
    },
    weiter,
    heute: '2026-11-01',
  })
  return { erg, bestand, abrufe, pausen }
}
const a1 = await lauf(1, () => ({ status: 200, text: JA }))
pruefe('Ja: Beleg-Zeilen mit dub: true, Titel, Adresse und Datum', a1.erg.ja === 1 && a1.erg.zeilen.includes('  dub: true') && a1.erg.zeilen.includes('- anilistId: 900200') && a1.erg.zeilen.includes('  url: https://www.netflix.com/title/900300') && a1.erg.zeilen.includes("  checkedAt: '2026-11-01'"), a1.erg)
pruefe('Ja: Befund trägt Urteil und Datum, Status 200 aus der Antwort', a1.bestand[url('900300')]?.audio === 'ja' && a1.bestand[url('900300')]?.audioAm === '2026-11-01' && a1.bestand[url('900300')]?.status === 200, a1.bestand)
const a2 = await lauf(1, () => ({ status: 200, text: NEIN }))
pruefe('Nein: Befund gespeichert, aber keine Beleg-Zeile', a2.erg.nein === 1 && a2.erg.zeilen.length === 0 && a2.bestand[url('900300')]?.audio === 'nein', a2)
const a3 = await lauf(3, (_u, i) => ({ status: 200, text: i === 1 ? NEIN : JA }))
pruefe('drei Filme: zwei Ja, ein Nein, zwei Pausen dazwischen', a3.erg.ja === 2 && a3.erg.nein === 1 && a3.pausen === 2, a3.erg)
pruefe('nur das Ja erzeugt einen Beleg (Film 1 fehlt)', a3.erg.zeilen.filter((z) => z.startsWith('- anilistId')).join() === '- anilistId: 900200,- anilistId: 900202', a3.erg.zeilen)
const a4 = await lauf(3, (_u, i) => (i === 1 ? { status: 403, text: '' } : { status: 200, text: JA }))
pruefe('403 beendet den Lauf ohne Urteil für diesen und die Rest-Filme', a4.erg.gesperrt && a4.erg.ja === 1 && a4.abrufe.length === 2 && Object.keys(a4.bestand).length === 1, a4)
const a5 = await lauf(3, (_u, i) => (i === 0 ? { status: 429, text: '' } : { status: 200, text: JA }))
pruefe('429 beendet den Lauf, nichts wird gelesen', a5.erg.gesperrt && a5.erg.gelesen === 1 && a5.erg.zeilen.length === 0 && Object.keys(a5.bestand).length === 0, a5)
const a6 = await lauf(1, () => ({ status: 404, text: '' }))
pruefe('404: unbekannt, nie Nein, kein Beleg; Status 404 gemerkt', a6.erg.unbekannt === 1 && a6.erg.nein === 0 && a6.erg.zeilen.length === 0 && a6.bestand[url('900300')]?.status === 404, a6)
const a7 = await lauf(2, (_u, i) => (i === 0 ? 'wirft' : { status: 200, text: JA }))
pruefe('Netzfehler: unbekannt, Lauf geht weiter; Status „fehler“ statt 0', a7.erg.unbekannt === 1 && a7.erg.ja === 1 && a7.bestand[url('900300')]?.status === 'fehler' && a7.bestand[url('900300')]?.audio === 'unbekannt', a7)
const a8 = await lauf(1, () => ({ status: 200, text: '<html>Anmeldung</html>' }))
pruefe('200 ohne Audio-Zeile: unbekannt (Nichtauskunft)', a8.erg.unbekannt === 1 && a8.erg.zeilen.length === 0, a8)
const a9 = await lauf(14, () => ({ status: 200, text: JA }))
pruefe('höchstens zehn Abrufe je Lauf', a9.abrufe.length === 10 && a9.erg.ja === 10, a9.abrufe.length)
let freigabe = 2
const a10 = await lauf(5, () => ({ status: 200, text: JA }), () => freigabe-- > 0)
pruefe('Zeitbudget leer: der Lauf hört auf, der Rest bleibt fällig', a10.abrufe.length === 2, a10.abrufe.length)
const alt = { status: 200, geprueftAm: '2026-10-20', prime: true } as TonspurBefund
const bestandMitAlt: Record<string, TonspurBefund | undefined> = { [url('900300')]: alt }
await leseNetflixFilme({ filme: filme(1), bestand: bestandMitAlt, hole: async () => ({ status: 200, text: JA }), pause: async () => {}, weiter: () => true, heute: '2026-11-01' })
pruefe('vorhandener Befund behält Status und Prüfdatum, bekommt nur das Urteil', bestandMitAlt[url('900300')]?.geprueftAm === '2026-10-20' && bestandMitAlt[url('900300')]?.audio === 'ja' && (bestandMitAlt[url('900300')] as { prime?: boolean }).prime === true, bestandMitAlt)
pruefe('Beleg-Zeilen: Titel mit Anführungszeichen bleibt gültig quotiert', tonspurBelegZeilen({ titleId: 1, titel: 'Er sagte "Hi"', url: url('1') }, ['Deutsch'], '2026-11-01').includes('  title: "Er sagte \\"Hi\\""'))

if (fehler.length) {
  console.error(`check-netflix-tonspur: ${fehler.length} von ${faelle} Fällen falsch:\n- ${fehler.join('\n- ')}`)
  process.exit(1)
}
console.log(`check-netflix-tonspur: ${faelle} Fälle — Parser an zwei echten Seiten, Auswahl offener Filme, Lauf mit 403/429/404/Netzfehler/Budget/Obergrenze 10.`)
