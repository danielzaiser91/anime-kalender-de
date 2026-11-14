/**
 * Direkte Zusicherungen zu `pipeline/lib/titel-namen.ts`: `andereNamen` liefert die übrigen Schreibweisen ohne den gezeigten
 * Namen und ohne Dopplungen (Groß-/Kleinschreibung und Leerraum zählen nicht); `titelJsonLd` maskiert `<`. Läuft in `check:logic`.
 */
import { andereNamen, titelJsonLd } from './lib/titel-namen.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const alle = { titleDe: 'Angriff auf Titan', titleEn: 'Attack on Titan', titleRomaji: 'Shingeki no Kyojin', titleNative: '進撃の巨人' }
pruefe('gezeigter Name fällt weg, Reihenfolge De/En/Romaji/Native', andereNamen(alle, 'Angriff auf Titan'), ['Attack on Titan', 'Shingeki no Kyojin', '進撃の巨人'])
pruefe('Vergleich ohne Groß-/Kleinschreibung und Leerraum', andereNamen(alle, '  ATTACK ON TITAN '), ['Angriff auf Titan', 'Shingeki no Kyojin', '進撃の巨人'])
pruefe('gleiche Schreibweise in zwei Feldern nur einmal', andereNamen({ titleDe: 'Naruto', titleEn: 'naruto', titleRomaji: 'Naruto', titleNative: 'ナルト' }, 'x'), ['Naruto', 'ナルト'])
pruefe('fehlende und leere Felder werden übersprungen', andereNamen({ titleEn: '', titleRomaji: undefined, titleNative: 'ナルト' }, 'x'), ['ナルト'])
pruefe('ohne Titel', andereNamen(undefined, 'x'), [])
pruefe('Ergebnis ist getrimmt', andereNamen({ titleEn: '  Foo  ' }, 'x'), ['Foo'])

const ld = titelJsonLd({ name: '</script><b>' })
const innen = ld.slice(ld.indexOf('>') + 1, ld.lastIndexOf('</script>'))
pruefe('kein rohes < im Block', innen.includes('<'), false)
pruefe('< als \\u003c maskiert', ld.includes('\\u003c/script>\\u003cb>'), true)
pruefe('Block-Rahmen', ld.startsWith('    <script type="application/ld+json">') && ld.endsWith('</script>'), true)
pruefe('Inhalt bleibt lesbares JSON', JSON.parse(innen), { name: '</script><b>' })

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('check-titel-namen: ok')
