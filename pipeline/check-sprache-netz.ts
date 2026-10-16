/**
 * Zusicherungen zum Netz unter „Sprache offen“ (`lib/sprache-netz.ts`): jeder offene Anbieter-Eintrag ist belegt, auf der Prüfliste oder
 * ausdrücklich ohne Weg gekennzeichnet; „weder noch, obwohl eine Liste möglich ist“ (`luecke`) ist der Fehlerfall.
 * Der Bestand nach einem Bau steht in `tools/sprache-netz-bestand-pruefen.mjs`. Läuft in `check:logic`.
 */
import { kennungAusAdresse, netzKlasse, offeneWege, pruefliste, vereinige, type NetzKontext, type Pruefliste } from './lib/sprache-netz.ts'
import type { Release, StreamLink, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const GTI = 'amzn1.dv.gti.547db9e6-e89f-496e-806b-62412d6797fc'
const URL = `https://watch.amazon.de/detail?gti=${GTI}`
const leer = (): Pruefliste => ({ schluessel: new Set(), adressen: new Set(), ids: new Set() })
const titel = (id: number, streams: StreamLink[], zusatz: Partial<Title> = {}): Title => ({ id, streams, ...zusatz }) as Title
const weg = (platform: string, zusatz: Partial<StreamLink> = {}): StreamLink => ({ platform, url: '', ...zusatz }) as StreamLink
const kontext = (zusatz: Partial<NetzKontext> = {}): NetzKontext => ({
  listen: {},
  geprueft: new Set(),
  geprueftSeiten: new Set(),
  wartet: () => false,
  releasesJeTitel: new Map<number, Release[]>(),
  ...zusatz,
})
const klasseVon = (t: Title, k: NetzKontext) => {
  const wege = offeneWege([t], k.releasesJeTitel)
  return wege.length ? netzKlasse(wege[0], k) : 'nicht offen'
}

// Murder Drones (16.10.2026): Cartoon, ein Prime-Weg ohne Urteil, JustWatch nennt Prime nur für die Serie.
const murder = titel(-291212, [weg('primevideo', { url: URL })], { dubHinweis: { quelle: 'justwatch', anbieter: ['Prime Video'] } })
const primeListe = pruefliste({ [GTI]: { url: URL, eintraege: [{ id: -291212, offen: true }] } })

pruefe('Murder Drones ohne Prüfliste und ohne Beleg ist die Lücke (der Wächter schlägt an)', klasseVon(murder, kontext({ listen: { primevideo: leer() } })) === 'luecke')
pruefe('Murder Drones auf der Prüfliste (Schlüssel gti) ist abgedeckt', klasseVon(murder, kontext({ listen: { primevideo: primeListe } })) === 'liste')
pruefe('… auch wenn nur die Adresse in der Liste steht', klasseVon(murder, kontext({ listen: { primevideo: { ...leer(), adressen: new Set([URL]) } } })) === 'liste')
pruefe('… auch wenn nur die Titelkennung in der Liste steht', klasseVon(murder, kontext({ listen: { primevideo: { ...leer(), ids: new Set([-291212]) } } })) === 'liste')
pruefe('Ein Listeneintrag mit offen:false trägt seine Kennung nicht', !pruefliste({ x: { eintraege: [{ id: -291212, offen: false }] } }).ids.has(-291212))
pruefe('Die Liste eines anderen Anbieters zählt nicht', klasseVon(murder, kontext({ listen: { netflix: primeListe } })) === 'luecke')
pruefe('Ein Prime-Titel auf der Suchliste ist abgedeckt (vereinigte Liste)', klasseVon(titel(5, [weg('primevideo', { url: 'https://www.amazon.de/s?k=x' })]), kontext({ listen: { primevideo: vereinige(primeListe, pruefliste({ 'https://www.amazon.de/s?k=x': { id: 5 } })) } })) === 'liste')

pruefe('Mit Urteil (dub) ist der Weg nicht offen', klasseVon(titel(1, [weg('primevideo', { url: URL, dub: true })]), kontext()) === 'nicht offen')
pruefe('Mit JustWatch-Stand ist der Weg nicht offen', klasseVon(titel(1, [weg('primevideo', { url: URL, dubQuelle: 'justwatch', dubStand: '2026-10-12' })]), kontext()) === 'nicht offen')
pruefe('Ein dub:false ohne Stand bleibt offen wie auf der Seite', klasseVon(titel(1, [weg('primevideo', { url: URL, dub: false })]), kontext()) === 'luecke')
pruefe('Nur Untertitel (angekündigte Synchro) ist nicht „Sprache offen“', klasseVon(titel(1, [weg('crunchyroll')], { ankuendigung: { platform: 'crunchyroll', synchro: 'angekuendigt', omuAb: '2026-10-01', stand: '2026-10-01' } } as Partial<Title>), kontext()) === 'nicht offen')

pruefe('Geprüft per Handbeleg oder Urteil: die manuelle Prüfung ist gelaufen', klasseVon(murder, kontext({ geprueft: new Set(['-291212|primevideo']) })) === 'geprueft')
pruefe('Seite gemeldet, Urteil bei einem anderen Titel (Titipo Titipo 2): auch geprüft', klasseVon(murder, kontext({ geprueftSeiten: new Set([GTI]) })) === 'geprueft')
pruefe('Wartet auf Folgen: nichts zu prüfen', klasseVon(murder, kontext({ wartet: () => true })) === 'wartet')
pruefe('Anbieter ohne Prüfliste ist ausdrücklich „ohne Liste“', klasseVon(titel(2, [weg('rtlplus', { url: 'https://plus.rtl.de/x' })]), kontext()) === 'ohne-liste')
pruefe('Listenanbieter ohne Adresse ist ausdrücklich „ohne Adresse“', klasseVon(titel(3, [weg('primevideo')]), kontext()) === 'ohne-adresse')
pruefe('Ein Titel mit zwei Wegen beim selben Anbieter zählt einmal, mit Adresse', offeneWege([titel(4, [weg('netflix'), weg('netflix', { url: 'https://www.netflix.com/title/1' })])], new Map()).length === 1)
pruefe('… der Weg mit Adresse vertritt den Titel (Lücke, nicht „ohne Adresse“)', klasseVon(titel(4, [weg('netflix'), weg('netflix', { url: 'https://www.netflix.com/title/1' })]), kontext({ listen: { netflix: leer() } })) === 'luecke')
pruefe('Listenanbieter ohne Adresse bleibt „ohne Adresse“, auch wenn seine Liste existiert', klasseVon(titel(3, [weg('primevideo')]), kontext({ listen: { primevideo: primeListe } })) === 'ohne-adresse')
pruefe('Die Adresse eines Listeneintrags genügt, auch unter anderem Schlüssel', klasseVon(titel(7, [weg('disneyplus', { url: 'https://www.disneyplus.com/de-de/browse/entity-x' })]), kontext({ listen: { disneyplus: pruefliste({ andererSchluessel: { url: 'https://www.disneyplus.com/de-de/browse/entity-x' } }) } })) === 'liste')
pruefe('Disney+ ist Listenanbieter: mit Adresse ohne Eintrag ist es eine Lücke', klasseVon(titel(8, [weg('disneyplus', { url: 'https://www.disneyplus.com/de-de/browse/entity-y' })]), kontext({ listen: { disneyplus: leer() } })) === 'luecke')
pruefe('Netflix-Kennung aus der Adresse', kennungAusAdresse('https://www.netflix.com/title/81506915') === '81506915')
pruefe('Amazon-Kennung aus der Titelseite und aus JustWatchs Form', kennungAusAdresse('https://www.amazon.de/gp/video/detail/B0DH2X43JG') === 'B0DH2X43JG' && kennungAusAdresse(URL) === GTI)
pruefe('Netflix-Liste ohne Titelkennung: Schlüssel der Adresse genügt', klasseVon(titel(6, [weg('netflix', { url: 'https://www.netflix.com/title/81506915' })]), kontext({ listen: { netflix: pruefliste({ '81506915': { staffeln: [{ offen: true }] } }) } })) === 'liste')

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-sprache-netz: ok')
