/**
 * Gegenproben zu D-27 (`lib/invarianten-kanal.ts`): One Piece Film: Strong World (4155) hatte im vorigen Bestand einen Prime-Weg über den
 * Kanal ADN und verlor ihn am 12.10.2026 ohne Spur.
 */
import type { Title } from '../shared/types.ts'
import { kanalWegVerloren } from './lib/invarianten-kanal.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}`)
}

const prime = { platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/B0DQM5BCFD', zugang: 'abo', kanal: 'ADN' }
const adn = { platform: 'adn', url: 'https://animationdigitalnetwork.com/de/video/948', dub: true, zugang: 'abo' }
const titel = (streams: object[]) => [{ id: 4155, titleRomaji: 'ONE PIECE FILM: STRONG WORLD', streams } as unknown as Title]
const kanal = new Set(['4155|amazon:b0dqm5bcfd'])
const vorher = titel([prime, adn])
const keinGrund = () => false
const andereAusgabe = { ...prime, url: 'https://www.amazon.de/gp/video/detail/B0AAAAAAAA' }

console.log('\nD-27: Ein Titel darf seinen Prime-Weg auf einer Kanal-Adresse nicht ohne Spur verlieren:')
pruefe('Kanal-Weg weg, kein Protokoll wird gemeldet', kanalWegVerloren(vorher, titel([adn]), kanal, keinGrund).length === 1)
pruefe('Weg noch da geht durch', kanalWegVerloren(vorher, titel([adn, prime]), kanal, keinGrund).length === 0)
pruefe('Ein anderer Prime-Weg (neue Ausgabe) ersetzt ihn', kanalWegVerloren(vorher, titel([adn, andereAusgabe]), kanal, keinGrund).length === 0)
pruefe('Weg mit Spur (Abgang, Gedächtnis, tote Adresse) geht durch', kanalWegVerloren(vorher, titel([adn]), kanal, () => true).length === 0)
pruefe('Titel, der fehlt, ist Sache des Titelschwund-Riegels', kanalWegVerloren(vorher, [], kanal, keinGrund).length === 0)
pruefe('Weg ohne Kanal-Adresse geht durch', kanalWegVerloren(vorher, titel([adn]), new Set(['999|amazon:b0xxxxxxxx']), keinGrund).length === 0)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nD-27 hält.')
process.exit(verletzt ? 1 : 0)
