/**
 * Zusicherung: ein Termin „im Angebot seit“ (`imAngebot`) trägt auf der Kachel die Marke „Neu bei <Anbieter>“ (Woche, Monat), einspaltig und damit nicht den Anschein einer
 * Neuerscheinung (Dirigent, 13.10.2026). Muster: Katalog-Release (`check-kachel-katalog.ts`); ein Katalog-Release schlägt die Marke.
 * Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import { anbieterName, type ReleaseEvent } from '../shared/types.ts'
import { ART_STIL, anbieterNamenDerKachel, artName, istBreit, kartenArt, termineDerKachel } from '../web/src/lib/kachel-folgen.ts'
import { anbieterZeile } from '../web/src/components/kalender/Marken.tsx'
import { TEXTE_KALENDER } from '../web/src/lib/i18n-kalender.ts'
import { translate } from '../web/src/lib/i18n.tsx'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ev = (o: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: 'x@2026-03-31', releaseSlug: 'motn-1-crunchyroll', titleId: 1, name: 'X', date: '2026-03-31', releaseType: 'batch', platform: 'crunchyroll', episodeCount: 24, ...o }) as unknown as ReleaseEvent
const data = { releaseBySlug: new Map() }

console.log('\nIm Angebot seit auf der Kachel:')
pruefe('Kachel mit imAngebot trägt die Marke', kartenArt([ev({ imAngebot: true })], data) === 'imAngebot', kartenArt([ev({ imAngebot: true })], data))
pruefe('ohne imAngebot: keine Marke', kartenArt([ev()], data) === undefined)
pruefe('ein Katalog-Release schlägt die Marke', kartenArt([ev({ imAngebot: true, katalog: 'belegt' })], data) === 'katalog')
pruefe('Name und Hinweis stehen in den Texten', ART_STIL.imAngebot.name in TEXTE_KALENDER && ART_STIL.imAngebot.hinweis in TEXTE_KALENDER)
const adn = ev({ imAngebot: true, platform: 'adn' })
const prime = ev({ imAngebot: true, platform: 'primevideo' })
const fahne = (...termine: ReleaseEvent[]) => artName('imAngebot', termine, translate)
pruefe('Fahne: „Neu bei ADN“ beim ADN-Termin', fahne(adn) === 'Neu bei ADN', fahne(adn))
pruefe('Fahne: der Anbieter wechselt mit dem Termin', fahne(prime) === `Neu bei ${anbieterName('primevideo')}`, fahne(prime))
pruefe('Fahne: bei TV der Sender', fahne(ev({ imAngebot: true, platform: 'tv', sender: 'RTL Zwei' })) === 'Neu bei RTL Zwei')
pruefe('Fahne: nennt den Anbieter des Termins mit Marke, nicht des ersten im Bündel', fahne(ev({ platform: 'netflix' }), adn) === 'Neu bei ADN', fahne(ev({ platform: 'netflix' }), adn))
pruefe('Fahne: keine offene Lücke „{anbieter}“', !fahne(adn).includes('{'))
pruefe('andere Marken behalten ihren Text', artName('start', [adn], translate) === TEXTE_KALENDER['kal.start'])
pruefe('„Neu bei …“ ist einspaltig', !istBreit('imAngebot'))
pruefe('ohne Marke: einspaltig', !istBreit(undefined))
pruefe('Staffelstart, -finale und Katalog bleiben zweispaltig', (['start', 'finale', 'katalog', 'katalogVermutlich'] as const).every(istBreit))
pruefe('Fahnenfarbe ist ein Token, keine alte Farbklasse', ART_STIL.imAngebot.fahne === 'bg-ak-marke')
/* Die Kachel selbst lässt sich nicht ohne Browser rendern (`useAbSm` kennt keinen Server-Stand); die Anbindung prüfen wir am Quelltext. */
const posterKarte = readFileSync(new URL('../web/src/components/kalender/PosterKarte.tsx', import.meta.url), 'utf8')
const monatsansicht = readFileSync(new URL('../web/src/components/MonthView.tsx', import.meta.url), 'utf8')
pruefe('PosterKarte: die Breite kommt aus istBreit', /const breit = istBreit\(p\.art\)/.test(posterKarte))
pruefe('PosterKarte und Monat: Fahnentext über artName, nie t(ART_STIL[…].name)', !/t\(ART_STIL\[[^\]]*\]\.name\)/.test(posterKarte + monatsansicht))
pruefe('PosterKarte: die Fahne bekommt die Termine der Kachel', posterKarte.includes('<ArtFahne art={p.art} termine={(p.anbieter ?? [p.buendel ?? [p.event]]).flat()} />'))

console.log('\nKeine Dopplung: Nennt die Fahne den Anbieter, steht er nicht noch einmal daneben:')
const netflix = ev({ id: 'n@2026-03-31', platform: 'netflix' })
const rtl = ev({ id: 'r@2026-03-31', platform: 'tv', sender: 'RTL Zwei', imAngebot: true, episode: 3, episodeCount: undefined })
pruefe('Beschriftung: ein Anbieter, den die Fahne nennt, entfällt', anbieterNamenDerKachel([adn], 'imAngebot', [adn]).length === 0, anbieterNamenDerKachel([adn], 'imAngebot', [adn]))
pruefe('Beschriftung: ein Sender, den die Fahne nennt, entfällt', anbieterNamenDerKachel([rtl], 'imAngebot', [rtl]).length === 0, anbieterNamenDerKachel([rtl], 'imAngebot', [rtl]))
pruefe('Beschriftung: mehrere Anbieter bleiben vollständig', anbieterNamenDerKachel([netflix, adn], 'imAngebot', [netflix, adn]).join() === `${anbieterName('netflix')},${anbieterName('adn')}`, anbieterNamenDerKachel([netflix, adn], 'imAngebot', [netflix, adn]))
pruefe('Beschriftung: mehrere Anbieter bleiben vollständig, auch wenn der erste die Fahne trägt', anbieterNamenDerKachel([adn, netflix], 'imAngebot', [adn, netflix]).join() === `${anbieterName('adn')},${anbieterName('netflix')}`)
pruefe('Beschriftung: ein Anbieter, den die Fahne nicht nennt, bleibt', anbieterNamenDerKachel([netflix], 'imAngebot', [netflix, adn]).join() === anbieterName('netflix'), anbieterNamenDerKachel([netflix], 'imAngebot', [netflix, adn]))
pruefe('Beschriftung: ohne Fahne bleibt der Anbieter', anbieterNamenDerKachel([adn], undefined, [adn]).join() === anbieterName('adn'), anbieterNamenDerKachel([adn], undefined, [adn]))
pruefe('Beschriftung: bei anderer Fahne („Staffelstart“) bleibt der Anbieter', anbieterNamenDerKachel([adn], 'start', [adn]).join() === anbieterName('adn'), anbieterNamenDerKachel([adn], 'start', [adn]))
const mit = (platform: 'adn', o: Partial<ReleaseEvent> = {}) => ev({ platform, episode: 2, episodeCount: 12, ...o })
const folge2 = translate('kal.folgeVon', { n: 2, von: 12 })
pruefe('Zeile unter dem Titel: mit Fahne nur die Folge', anbieterZeile(mit('adn'), translate, undefined, 'imAngebot') === folge2, anbieterZeile(mit('adn'), translate, undefined, 'imAngebot'))
pruefe('Zeile unter dem Titel: ohne Fahne „Anbieter · Folge“', anbieterZeile(mit('adn'), translate, undefined, undefined) === `${anbieterName('adn')} · ${folge2}`)
pruefe('Zeile unter dem Titel: im Fernsehen nur die Folge, nicht der halbe Sendername', anbieterZeile(rtl, translate, undefined, 'imAngebot') === translate('kal.folge', { n: 3 }), anbieterZeile(rtl, translate, undefined, 'imAngebot'))
pruefe('Zeile unter dem Titel: ohne Folge bleibt sie leer', anbieterZeile(ev({ platform: 'adn', episodeCount: undefined }), translate, undefined, 'imAngebot') === '')
/* Die Kachel nennt den Anbieter aus allen ihren Terminen — auch wenn nicht der erste Anbieter die Marke trägt. */
const adnMarke = ev({ id: 'a@2026-03-31', platform: 'adn', imAngebot: true })
const mehrere = new Map([[netflix.id, [[netflix], [adnMarke]]]])
const buendel = new Map([[netflix.id, [netflix, adnMarke]]])
pruefe('Kachel mit mehreren Anbietern: Fahne nennt den Anbieter mit Marke, nicht den ersten', artName('imAngebot', termineDerKachel(netflix, mehrere, undefined), translate) === 'Neu bei ADN', artName('imAngebot', termineDerKachel(netflix, mehrere, undefined), translate))
pruefe('Kachel mit Bündel: alle Termine des Bündels zählen', artName('imAngebot', termineDerKachel(netflix, undefined, buendel), translate) === 'Neu bei ADN')
pruefe('Kachel ohne Bündel: der Termin selbst', termineDerKachel(adnMarke, mehrere, buendel).length === 1 && termineDerKachel(adnMarke, mehrere, buendel)[0] === adnMarke)
pruefe('Monat: Beschriftung und Zeile rufen die Helfer mit den Daten der Kachel', /anbieterNamenDerKachel\(koepfe, a, termine\)/.test(monatsansicht) && (monatsansicht.match(/termineDerKachel\(ev, p\.mehrere, p\.buendel\)/g) ?? []).length === 2 &&/anbieterZeile\(ev, t, p\.buendel\?\.get\(ev\.id\), a\)/.test(monatsansicht))
pruefe('Woche: die Zeile unter dem Titel kennt die Fahne', /anbieterZeile\(p\.event, t, p\.buendel, p\.art\)/.test(posterKarte))
pruefe('der Hinweis sagt, dass es nicht der Erscheinungstag ist', TEXTE_KALENDER['kal.imAngebotHinweis'].includes('nicht der Erscheinungstag'))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
