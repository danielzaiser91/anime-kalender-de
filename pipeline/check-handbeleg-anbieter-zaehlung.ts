/**
 * Zusicherung zu `lib/handbeleg-anbieter-zaehlung.ts` und zur Staffelliste ohne Staffel 1 (Beyblade X, 01.11.2026):
 * Netflix führte nur Staffel 2 (49 Folgen), der Handbeleg "Folgen 2–48" stand als unsere Zählung (richtig: 53–99).
 * Der Handbeleg ohne `url` trägt die Adresse nur über den Titel; die Staffel-Paarung darf eine Liste ab Staffel 2 nicht auf unseren ersten Titel legen.
 */
import { findeAnbieterZaehlung, netflixKennungen, UMRECHNUNGS_VERMERK, type StaffelListen } from './lib/handbeleg-anbieter-zaehlung.ts'
import { ordneMeldungZu, ordneNachStaffelliste } from './lib/folgenbereiche.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} ${JSON.stringify(info)}`)
}

const listen: StaffelListen = {
  '81924739': { staffeln: [{ seq: 2, folgen: 49 }] },
  '80108159': { staffeln: [{ seq: 2, folgen: 8 }, { seq: 3, folgen: 8 }] },
  '70171942': { staffeln: [{ seq: 1, folgen: 10 }, { seq: 2, folgen: 13 }] },
  '99999999': { staffeln: [] },
}
const beyblade = { anilistId: 165159, title: 'Beyblade X', platform: 'netflix', dubRanges: [{ from: 2, to: 48, dub: true }] } as const
const adressen = (id: number): string[] => (id === 165159 ? ['81924739'] : id === 900002 ? ['70171942'] : id === 900003 ? ['70171942', '81924739'] : [])
const gefunden = (b: object, l = listen): string[] => findeAnbieterZaehlung([b as never], l, adressen)

const rot = gefunden(beyblade)
pruefe('Beyblade ohne url: Adresse über den Titel, Liste ab Staffel 2 -> Verstoß', rot.length === 1 && rot[0]!.includes('Netflix 81924739') && rot[0]!.includes('Staffel 2') && rot[0]!.includes('2–48'), rot)
pruefe('mit url statt Titeladresse: derselbe Verstoß', gefunden({ ...beyblade, anilistId: 1, url: 'https://www.netflix.com/title/81924739' }).length === 1)
pruefe('url zählt vor der Titeladresse (andere Adresse mit Staffel 1 -> kein Verstoß)', gefunden({ ...beyblade, url: 'https://www.netflix.com/de/title/70171942' }).length === 0)
pruefe('Umrechnungsvermerk in der note nimmt den Verstoß', gefunden({ ...beyblade, note: `Folgen 53–99 — ${UMRECHNUNGS_VERMERK} Staffel 2 beginnt bei Folge 52` }).length === 0)
pruefe('note ohne Vermerk bleibt Verstoß', gefunden({ ...beyblade, note: 'Folgen 2–48 mit deutschem Ton' }).length === 1)
pruefe('ohne Bereiche kein Verstoß', gefunden({ ...beyblade, dubRanges: undefined }).length === 0 && gefunden({ ...beyblade, dubRanges: [] }).length === 0)
pruefe('andere Plattform kein Verstoß', gefunden({ ...beyblade, platform: 'disneyplus' }).length === 0)
pruefe('Liste mit Staffel 1 kein Verstoß', gefunden({ ...beyblade, anilistId: 900002 }).length === 0)
pruefe('Liste ab Staffel 2 mit zwei Staffeln: Verstoß, nennt die erste', gefunden({ ...beyblade, anilistId: 5, url: 'https://www.netflix.com/title/80108159' })[0]?.includes('bei Staffel 2') === true)
pruefe('leere oder fehlende Liste kein Verstoß', gefunden({ ...beyblade, anilistId: 5, url: 'https://www.netflix.com/title/99999999' }).length === 0 && gefunden({ ...beyblade, anilistId: 5, url: 'https://www.netflix.com/title/1' }).length === 0)
pruefe('Titel mit zwei Adressen: nur die ohne Staffel 1 trifft', gefunden({ ...beyblade, anilistId: 900003 }).length === 1)
pruefe('Titel ohne Netflix-Adresse kein Verstoß', gefunden({ ...beyblade, anilistId: 777 }).length === 0)
pruefe('netflixKennungen liest nur Netflix-Verweise', netflixKennungen([{ platform: 'netflix', url: 'https://www.netflix.com/title/81924739' }, { platform: 'disneyplus', url: 'https://x/title/5' }, { platform: 'disneyplus', url: 'https://www.netflix.com/title/7' }, { platform: 'netflix', url: 'https://www.netflix.com/search?q=a' }]).join() === '81924739')

// Schreibweg: Liste ab Staffel 2 wird keinem Titel zugeordnet, auch nicht dem einzigen.
const unsere = [{ id: 165159, titel: 'Beyblade X', folgen: 100 }]
const ab2 = [{ seq: 2, name: '', folgen: 49, erste: 1 }]
const z = ordneNachStaffelliste(ab2, unsere)
pruefe('Liste ab Staffel 2: keine Paare, Begründung genannt', z.paare.length === 0 && z.ohneEntsprechung.length === 0 && /Staffel 2/.test(z.problem ?? ''), z)
pruefe('Meldung Staffel 2 Folge 2 landet nirgends', ordneMeldungZu({ folge: 2, staffel: 2 }, unsere, ab2) === null)
const ab1 = [{ seq: 1, name: '', folgen: 100, erste: 1 }]
pruefe('Kontrolle: Liste ab Staffel 1 ordnet weiter zu', ordneMeldungZu({ folge: 2, staffel: 1 }, unsere, ab1)?.folgeInStaffel === 2)
pruefe('Kontrolle: Liste 1 und 3 (Lücke) geht den bisherigen Weg, nicht die neue Sperre', !/beginnt bei Staffel/.test(ordneNachStaffelliste([{ seq: 3, name: '', folgen: 5, erste: 1 }, { seq: 1, name: '', folgen: 5, erste: 1 }], unsere).problem ?? ''))
pruefe('leere Liste: keine Paare und keine Begründung der Sperre', ordneNachStaffelliste([], unsere).paare.length === 0 && ordneNachStaffelliste([], unsere).problem === undefined)

if (fehler) {
  console.error(`FEHL check-handbeleg-anbieter-zaehlung: ${fehler}`)
  process.exit(1)
}
console.log('check-handbeleg-anbieter-zaehlung: Bereiche an Netflix-Listen ab Staffel 2 brauchen die Umrechnung; die Paarung ordnet sie nicht still zu.')
