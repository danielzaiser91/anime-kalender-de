/**
 * Kanal-Nachmessung (12.10.2026): Vergleich alter Kanal-Beleg gegen neue Messung (`tools/kanal-nachmessung.mjs`).
 * Eingaben sind kleine Beispiele im Speicher; der Stichtag ist der 13.10.2026.
 */
import { einzureihen, vergleiche } from './kanal-nachmessung.mjs'

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const note = 'Tonspuren: 日本語, Deutsch — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg'
const ja = (id, asin, checkedAt, extra = {}) => ({ anilistId: id, platform: 'primevideo', url: `https://www.amazon.de/gp/video/detail/${asin}`, dub: true, checkedAt, note, ...extra })
const folgen = (...sprachen) => ({ folgen: sprachen.map((s) => ({ unsere: 1, sprachen: s })) })

const belege = [
  ja(1, 'B0AAAAAAA1', '2026-08-30'),
  ja(2, 'B0AAAAAAA2', '2026-09-20'),
  ja(3, 'B0AAAAAAA3', '2026-09-20'),
  ja(4, 'B0AAAAAAA4', '2026-09-20', { zweiteQuelle: 'JustWatch' }),
  { ...ja(5, 'B0AAAAAAA5', '2026-09-20'), note: 'Tonspuren: Deutsch' },
  ja(6, 'B0AAAAAAA6', '2026-09-20'),
  ja(6, 'B0AAAAAAA6', '2026-10-13', { kanalMessung: 'ja' }),
  ja(7, 'B0AAAAAAA7', '2026-09-20'),
  { anilistId: 7, platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/B0AAAAAAA7', kanalMessung: 'nein', checkedAt: '2026-10-14', note },
]
const zugeordnet = {
  'https://www.amazon.de/dp/B0AAAAAAA2': { titleId: 2, asin: 'B0AAAAAAA2', folgen: [{ unsere: 1, sprachen: ['日本語'] }, { unsere: 2, sprachen: ['日本語', 'Deutsch'] }] },
  'https://www.amazon.de/dp/B0AAAAAAA3': { titleId: 3, asin: 'B0AAAAAAA3', ...folgen(['日本語']) },
}

const zeilen = vergleiche(belege, zugeordnet, '2026-10-13')
const von = (id) => zeilen.find((z) => z.anilistId === id)

pruefe('ein Ja ohne Meldung: neu fehlt, Gegenprobe keine', von(1)?.neu === 'fehlt' && von(1)?.gegenprobe === 'keine', von(1))
pruefe('der Beleg von vor 4.20.10 ist gekennzeichnet', von(1)?.vorErweiterung === true && von(2)?.vorErweiterung === false)
pruefe('Deutsch in einer Folge ist Gegenprobe Ja', von(2)?.gegenprobe === 'ja')
pruefe('Folgen nur ohne Deutsch sind Gegenprobe Nein', von(3)?.gegenprobe === 'nein')
pruefe('ein Ja mit zweiter Quelle ist nicht betroffen', von(4) === undefined)
pruefe('ein Beleg ohne Kanal-Warnung ist nicht betroffen', von(5) === undefined)
pruefe('eine neue Messung Ja bestätigt', von(6)?.neu === 'ja' && von(6)?.neuAm === '2026-10-13', von(6))
pruefe('die neue Messung zählt nicht selbst als alter Beleg', zeilen.filter((z) => z.anilistId === 6).length === 1 && von(6)?.alt === '2026-09-20')
pruefe('eine neue Messung Nein ist die Abweichung', von(7)?.neu === 'nein' && von(7)?.neuAm === '2026-10-14', von(7))

const ein = einzureihen(zeilen)
pruefe('ohne Gegenprobe vor 4.20.10: Vorrang 1', ein.get(1) === 1, [...ein])
pruefe('Gegenprobe widerspricht: Vorrang 1', ein.get(3) === 1)
pruefe('Gegenprobe bestätigt: nicht auf die Liste', !ein.has(2))
pruefe('ohne Gegenprobe nach 4.20.10: Vorrang 2', ein.get(7) === 2 && ein.get(6) === 2, [...ein])

if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zur Kanal-Nachmessung halten.')
