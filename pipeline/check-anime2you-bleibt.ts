/**
 * Zusicherungen: ein Beleg mit der Artikel-Adresse (Handbeleg oder Anime2You-Automatik) verdrängt die Termine eines
 * Sammelartikels nicht (08.11.2026, Artikel 1066831 „25 Anime-Neuzugänge ab sofort auf Joyn verfügbar“, Termin 03.11.).
 */
import { bleibtImVorrat, type VorratKandidat } from './lib/anime2you-bleibt.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}`)
}

const HEUTE = '2026-11-09'
// Form des echten Eintrags aus data/proposals/anime2you.json (Stand 08.11.2026 18:01 UTC): keine Daten im Text, 25 Sammeleinträge vom 03.11.
const JOYN: VorratKandidat = {
  alreadyCurated: true,
  dates: [],
  sammel: [
    { titel: 'Akame ga KILL!', datum: '2026-11-03' },
    { titel: 'Clannad', datum: '2026-11-03' },
  ],
}
const alt = (p: VorratKandidat, heute: string): boolean =>
  p.dates.some((d) => (d.iso ?? `${d.month}-31`) >= heute) || !p.alreadyCurated || !!p.verschiebungen?.length || (p.sammel as { datum?: string }[] | undefined)?.some((e) => (e.datum ?? '') >= heute) === true

pruefe('Rot-Probe: die alte Bedingung warf den Joyn-Artikel raus', alt(JOYN, HEUTE) === false)
pruefe('Eingearbeiteter Sammelartikel mit vergangenem Termin bleibt', bleibtImVorrat(JOYN, HEUTE))
pruefe('… mit genau einem Sammeleintrag', bleibtImVorrat({ ...JOYN, sammel: [{ datum: '2026-11-03' }] }, HEUTE))
pruefe('Eingearbeitet ohne Sammeleintrag, ohne Zukunftsdatum: raus', !bleibtImVorrat({ ...JOYN, sammel: [] }, HEUTE))
pruefe('Eingearbeitet, Feld sammel fehlt: raus', !bleibtImVorrat({ alreadyCurated: true, dates: [] }, HEUTE))
pruefe('Nicht eingearbeitet: bleibt', bleibtImVorrat({ alreadyCurated: false, dates: [] }, HEUTE))
pruefe('Eingearbeitet, Datum heute: bleibt', bleibtImVorrat({ alreadyCurated: true, dates: [{ iso: HEUTE }] }, HEUTE))
pruefe('Eingearbeitet, Datum gestern: raus', !bleibtImVorrat({ alreadyCurated: true, dates: [{ iso: '2026-11-08' }] }, HEUTE))
pruefe('Eingearbeitet, nur Monat (ohne Tag) im laufenden Monat: bleibt', bleibtImVorrat({ alreadyCurated: true, dates: [{ month: '2026-11' }] }, HEUTE))
pruefe('Eingearbeitet mit Verschiebungen: bleibt', bleibtImVorrat({ alreadyCurated: true, dates: [], verschiebungen: [{}] }, HEUTE))

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAnime2You-Vorrat (Sammelartikel bleibt trotz Beleg): alle Zusicherungen erfüllt')
