/**
 * `laufendeSynchro()` aus `verdacht.mjs`: Wann kommt ein Handbeleg mit halber Synchro zurück auf
 * die Prüfliste? Anlass: Snowball Earth bei Disney+ (26.09.2026), eingefroren auf Folge 1–2.
 */
import { laufendeSynchro } from './verdacht.mjs'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = [
  { id: 1, jpEnd: '2026-06-26' },
  { id: 2, jpEnd: '2020-03-01' },
  { id: 3, jpEnd: null },
]
const halb = (id, am, bis = 2, url = 'https://www.disneyplus.com/browse/entity-x') => ({
  anilistId: id,
  platform: 'disneyplus',
  url,
  checkedAt: am,
  dubRanges: [
    { from: 1, to: bis, dub: true },
    { from: bis + 1, to: 13, dub: false },
  ],
})

console.log('Laufende Synchro erneut vorlegen\n')
{
  const r = laufendeSynchro([halb(1, '2026-09-20')], titel, 'disneyplus', '2026-09-27')
  pruefe('Snowball Earth: 1–2 deutsch, sieben Tage alt → zurück auf die Liste', r.get(1)?.seit === '2026-09-27' && r.get(1)?.laufendeSynchro?.bis === 2, r.get(1))
}
{
  const r = laufendeSynchro([halb(1, '2026-09-20')], titel, 'disneyplus', '2026-09-26')
  pruefe('sechs Tage alt → noch nicht', !r.has(1))
}
{
  const r = laufendeSynchro([halb(1, '2026-09-20'), halb(1, '2026-09-26', 6)], titel, 'disneyplus', '2026-09-28')
  pruefe('ein neuerer Beleg schiebt die Frist', !r.has(1))
}
{
  const fertig = { ...halb(1, '2026-09-01'), dubRanges: [{ from: 1, to: 13, dub: true }] }
  pruefe('komplett deutsch → nie', !laufendeSynchro([fertig], titel, 'disneyplus', '2026-10-30').has(1))
}
{
  const luecke = {
    ...halb(1, '2026-09-01'),
    dubRanges: [
      { from: 1, to: 48, dub: true },
      { from: 49, to: 49, dub: false },
      { from: 50, to: 61, dub: true },
    ],
  }
  pruefe('Lücke in der Mitte, hinten deutsch (One Piece Fg. 49) → nie', !laufendeSynchro([luecke], titel, 'disneyplus', '2026-10-30').has(1))
}
{
  const ohne = { ...halb(1, '2026-09-01'), dubRanges: [{ from: 1, to: 13, dub: false }] }
  pruefe('gar nicht deutsch → nie (das ist ein Nein, keine laufende Synchro)', !laufendeSynchro([ohne], titel, 'disneyplus', '2026-10-30').has(1))
}
pruefe('japanisches Ende über ein Jahr her → Endzustand, nie', !laufendeSynchro([halb(2, '2026-09-01')], titel, 'disneyplus', '2026-10-30').has(2))
pruefe('ohne japanisches Ende (läuft noch) → ja', laufendeSynchro([halb(3, '2026-09-01')], titel, 'disneyplus', '2026-10-30').has(3))
pruefe('fremder Anbieter → nie', !laufendeSynchro([halb(1, '2026-09-01')], titel, 'netflix', '2026-10-30').has(1))
pruefe('Titel nicht im Bestand → nie', !laufendeSynchro([halb(99, '2026-09-01')], titel, 'disneyplus', '2026-10-30').has(99))

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
