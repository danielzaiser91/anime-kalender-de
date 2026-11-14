/**
 * Zusicherungen zu `lib/anisearch-artikel.ts` an nachgebautem Seitengerüst: Tonspuren (`Sprache:`) getrennt von Untertiteln,
 * Kommas in Klammern, EAN, enthaltene Titel mit Typ und Folgenzahl, Grenzen des Abschnitts. Läuft in `check:logic`.
 */
import { artikelAus } from './lib/anisearch-artikel.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const info = (name: string, wert: string) => `<div class="shopinfo"><span class="header">${name}:</span> ${wert} </div>`
const titel = (id: string, datum: string) => `<li><a href="anime/${id}" class="x"><span class="title">T</span><span class="date">${datum}</span></a></li>`
const seite = (innen: string, danach = '') => `<html><h1>Produktinformationen</h1>${innen}<h2>Weitere Artikel</h2>${danach}</html>`

const VOLL = seite(
  [
    '<div><span class="header">EAN:</span> 4061229123456</div>',
    info('Sprache', 'Deutsch (DTS-HD 5.1, 2.0), <b>Japanisch</b> (DTS-HD 2.0)'),
    info('Untertitel', 'Deutsch'),
    info('Publisher', 'Crunchyroll &amp; Partner'),
    info('Umfang', '3 Discs'),
    info('Medium', 'Blu-ray'),
    '<section id="anime"><ul>',
    titel('12345', 'TV-Serie, 12 (2020)'),
    titel('12346,frieren', 'Bonus, 1 (2020)'),
    titel('12347', 'OVA, ? (2021)'),
    titel('12348', 'Film'),
    titel('12349', 'TV-Serie, 24+ (2022)'),
    '</ul></section>',
  ].join('\n'),
  info('Sprache', 'Englisch') + '<section id="anime">' + titel('99999', 'Film (2020)') + '</section>',
)

pruefe('vollständiger Artikel', artikelAus(VOLL), {
  ean: '4061229123456',
  audio: ['Deutsch (DTS-HD 5.1, 2.0)', 'Japanisch (DTS-HD 2.0)'],
  untertitel: ['Deutsch'],
  publisher: 'Crunchyroll & Partner',
  umfang: '3 Discs',
  medium: 'Blu-ray',
  enthalten: [
    { anisearchId: 12345, typ: 'TV-Serie', folgen: 12 },
    { anisearchId: 12346, typ: 'Bonus', folgen: 1 },
    { anisearchId: 12347, typ: 'OVA' },
    { anisearchId: 12348, typ: 'Film' },
    { anisearchId: 12349, typ: 'TV-Serie', folgen: 24 },
  ],
})

pruefe('ohne Produktinformationen: undefined', artikelAus('<html>Sprache: Deutsch</html>'), undefined)
pruefe('leere Seite: undefined', artikelAus(''), undefined)
pruefe('Abschnitt ohne Felder: nur leere Titelliste', artikelAus(seite('')), { enthalten: [] })
pruefe('fehlt „Sprache“, fehlt audio (keine Tonspur erfunden)', 'audio' in (artikelAus(seite(info('Untertitel', 'Deutsch'))) ?? {}), false)
pruefe('leerer Wert zählt nicht', artikelAus(seite(info('Sprache', ' <i></i> ') + info('Medium', '&nbsp;'))), { enthalten: [] })
pruefe(
  'Felder und Titel unter „Weitere Artikel“ gehören nicht zum Artikel',
  artikelAus(seite(info('Medium', 'DVD'), info('Sprache', 'Deutsch') + '<section id="anime">' + titel('99999', 'Film (2020)') + '</section>')),
  { medium: 'DVD', enthalten: [] },
)
pruefe('ohne „Weitere Artikel“ bis zum Ende gelesen', artikelAus(`Produktinformationen ${info('Sprache', 'Deutsch')}`)?.audio, ['Deutsch'])
pruefe('EAN mit weniger als 8 Ziffern zählt nicht', artikelAus(seite('<span class="header">EAN:</span> 1234567'))?.ean, undefined)
pruefe('Apostroph-Entities', artikelAus(seite(info('Publisher', 'Kaze&#039;s &#x27;Label&#39;')))?.publisher, "Kaze's 'Label'")
pruefe('Liste: leere Stücke fallen weg', artikelAus(seite(info('Untertitel', 'Deutsch, , Englisch,')))?.untertitel, ['Deutsch', 'Englisch'])

if (fehler) process.exit(1)
console.log('check-anisearch-artikel: ok')
