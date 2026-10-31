/**
 * Zusicherungen zur Handliste der ADN-Cartoons (`lib/cartoon-handliste.ts`, `bau/cartoon-adn.ts`, `fetch-cartoons.ts`).
 * Teil 1: Auswahl und Auflösung der Handliste (erfundene TMDB-Antworten, kein Abruf). Teil 2: ADN-Bau auf einer Kulisse im Temp-Ordner
 * (`AK_ROOT`): Dreamland (ADN 887, zwei Samstagsfolgen, kein aniSearch-Eintrag) steht mit Weg ADN und beiden Terminen im Bestand.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'
import type { AdnShow } from './lib/adn.ts'
import type { CartoonEintrag } from './lib/cartoons.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'cartoon-handliste-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data'), { recursive: true })
mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const treffer = (id: number, name: string, original: string, jahr: string, genres = [16]) => ({ id, name, original_name: original, first_air_date: jahr, genre_ids: genres })

try {
  const { waehleTreffer, kandidatenZeile, loeseHandliste, ohneDoppelte, suchbegriffe, handlisteLaden, mitHandliste, adnKennungGeaendert, mitAdnKennung } = await import('./lib/cartoon-handliste.ts')
  const tintin = { adn: 734, name: 'Tintin (Adventures)', original: 'Les Aventures de Tintin' }

  console.log('\nAuswahl des Treffers')
  pruefe('ein Treffer mit gleichem Originalnamen und Animation: übernommen', JSON.stringify(waehleTreffer(tintin, [treffer(1, 'Die Abenteuer von Tim und Struppi', 'Les Aventures de Tintin', '1991-09-21')])) === '{"id":1}')
  pruefe('Name nur im deutschen Feld gleich: übernommen', JSON.stringify(waehleTreffer({ adn: 1, name: 'Yakari' }, [treffer(2, 'Yakari', 'Yakari', '2005-01-01')])) === '{"id":2}')
  pruefe('ohne Animations-Genre: kein Treffer', 'grund' in waehleTreffer(tintin, [treffer(1, 'x', 'Les Aventures de Tintin', '1991-09-21', [99])]))
  pruefe('Genre-Liste fehlt: kein Treffer', 'grund' in waehleTreffer(tintin, [{ id: 1, original_name: 'Les Aventures de Tintin' }]))
  pruefe('anderer Name: kein Treffer', 'grund' in waehleTreffer(tintin, [treffer(1, 'Tintin und der Haifischsee', 'Tintin et le lac aux requins', '1972-01-01')]))
  pruefe('Akzent und Satzzeichen zählen nicht', 'id' in waehleTreffer({ adn: 2, name: 'Babar', original: 'Babar' }, [treffer(3, 'BABAR!', 'Babár', '1989-01-01')]))
  const zwei = waehleTreffer({ adn: 3, name: 'Billy & Buddy', original: 'Boule et Bill' }, [treffer(10, 'Billy & Buddy', 'Boule et Bill', '2003-01-01'), treffer(11, 'Billy & Buddy', 'Boule et Bill', '2016-01-01')])
  pruefe('zwei Treffer: mehrdeutig, keiner gewählt', 'grund' in zwei && zwei.grund.includes('mehrdeutig') && zwei.grund.includes('10') && zwei.grund.includes('11'), zwei)
  pruefe('mit `jahr` gewinnt der passende', JSON.stringify(waehleTreffer({ adn: 3, name: 'Billy & Buddy', original: 'Boule et Bill', jahr: 2016 }, [treffer(10, 'Billy & Buddy', 'Boule et Bill', '2003-01-01'), treffer(11, 'Billy & Buddy', 'Boule et Bill', '2016-01-01')])) === '{"id":11}')
  pruefe('`jahr` ohne passenden Treffer: kein Treffer', 'grund' in waehleTreffer({ ...tintin, jahr: 1900 }, [treffer(1, 'x', 'Les Aventures de Tintin', '1991-09-21')]))
  pruefe('dieselbe Serie aus zwei Suchen zählt einmal', JSON.stringify(waehleTreffer(tintin, [treffer(1, 'a', 'Les Aventures de Tintin', '1991-09-21'), treffer(1, 'a', 'Les Aventures de Tintin', '1991-09-21')])) === '{"id":1}')
  pruefe('Suchbegriffe: Original zuerst, ohne Doppelte', suchbegriffe({ adn: 1, name: 'Babar', original: 'Babar' }).join() === 'Babar' && suchbegriffe(tintin).join() === 'Les Aventures de Tintin,Tintin (Adventures)')

  console.log('\nAuflösung der Liste')
  const meldungen: string[] = []
  const gesucht: string[] = []
  const suche = async (b: string) => {
    gesucht.push(b)
    return b === 'Dreamland' ? [treffer(900887, 'Dreamland', 'Dreamland', '2026-10-17')] : b === 'Babar' ? [treffer(5, 'Babar', 'Babar', '1989-01-01'), treffer(6, 'Babar', 'Babar', '2010-01-01')] : []
  }
  const liste = [
    { adn: 887, name: 'Dreamland', original: 'Dreamland' },
    { adn: 1178, name: 'Babar', original: 'Babar' },
    { adn: 748, name: 'Cousteau', pruefen: 'Doku?' },
    { adn: 100, name: 'Fest', tmdb: 777 },
    { adn: 101, name: 'Schon da' },
    { adn: 102, name: 'Nirgends' },
  ]
  const ok = await loeseHandliste(liste, new Map([[101, 888]]), suche, (z) => meldungen.push(z))
  pruefe('Suche nimmt den eindeutigen Treffer', ok.get(887) === 900887, [...ok])
  pruefe('mehrdeutig: nicht übernommen, Grund im Log', !ok.has(1178) && meldungen.some((z) => z.includes('1178') && z.includes('mehrdeutig')), meldungen)
  pruefe('Grenzfall `pruefen`: nicht übernommen, nicht gesucht, Grund im Log', !ok.has(748) && !gesucht.includes('Cousteau') && meldungen.some((z) => z.includes('748') && z.includes('Doku?')), [gesucht, meldungen])
  pruefe('feste Kennung gilt ohne Suche', ok.get(100) === 777 && !gesucht.includes('Fest'))
  pruefe('Kennung aus dem Bestand gilt ohne Suche', ok.get(101) === 888 && !gesucht.includes('Schon da'))
  pruefe('ohne Treffer: nicht übernommen, Grund im Log', !ok.has(102) && meldungen.some((z) => z.includes('102') && z.includes('kein Treffer')), meldungen)
  pruefe('gefundener Treffer steht mit Begründung im Log', meldungen.some((z) => z.includes('887') && z.includes('TMDB 900887') && z.includes('stimmen')), meldungen)
  pruefe('A1: gefunden-Zeile nennt Jahr und (fehlende) Folgenzahl', meldungen.some((z) => z.includes('887') && z.includes('Jahr/Folgen 2026/?')), meldungen)
  const mf: string[] = []
  await loeseHandliste([{ adn: 5, name: 'Mit' }], new Map(), async () => [{ ...treffer(77, 'Mit', 'Mit', '2011-05-01'), number_of_episodes: 52 }], (z) => mf.push(z))
  pruefe('A1: Folgenzahl, wenn der Treffer sie trägt', mf.some((z) => z.includes('Jahr/Folgen 2011/52')), mf)
  const mz: string[] = []
  await loeseHandliste([{ adn: 6, name: 'Zwei' }], new Map(), async () => [{ ...treffer(78, 'Anders', 'Anders', '1999-01-01'), number_of_episodes: 10 }, { ...treffer(79, 'Zwei', 'Zwei', '2012-03-01'), number_of_episodes: 26 }], (z) => mz.push(z))
  pruefe('A1: Jahr/Folgen stammen vom gewählten Treffer, nicht vom ersten', mz.some((z) => z.includes('TMDB 79') && z.includes('Jahr/Folgen 2012/26')), mz)
  const mk: string[] = []
  await loeseHandliste([{ adn: 7, name: 'Billy & Buddy', original: 'Boule et Bill' }], new Map(), async () => [treffer(44157, 'Billy & Buddy', 'Boule et Bill', '2003-09-01'), treffer(69906, 'Billy & Buddy', 'Boule et Bill', '2016-01-01'), treffer(70000, 'Anderes', 'Anderes', '2016-01-01', [35])], (z) => mk.push(z))
  pruefe('Kandidaten-Zeile: Kennung, Name, Original, Jahr, Animation je Kandidat, ohne Doppelte', mk.length === 1 && mk[0].includes('Kandidaten: 44157 „Billy & Buddy“/„Boule et Bill“ Jahr/Folgen 2003/?, Animation; 69906 „Billy & Buddy“/„Boule et Bill“ Jahr/Folgen 2016/?, Animation; 70000 „Anderes“/„Anderes“ Jahr/Folgen 2016/?, keine Animation'), mk)
  const kz = kandidatenZeile(Array.from({ length: 12 }, (_, i) => treffer(i + 1, 'N', 'N', '2000-01-01')))
  pruefe('Kandidaten-Zeile: höchstens zehn, keine Treffer benannt', kz.split('; ').length === 10 && kandidatenZeile([]) === 'keine Treffer', kz)
  const tv = { adn: 8, name: 'Tintin (Adventures)', original: 'Les Aventures de Tintin', varianten: ['Tim und Struppi'] }
  pruefe('Variante: wird gesucht', suchbegriffe(tv).join() === 'Les Aventures de Tintin,Tintin (Adventures),Tim und Struppi')
  pruefe('Variante: Treffer mit dem Variantennamen zählt', 'id' in waehleTreffer(tv, [treffer(9, 'Tim und Struppi', 'Tintin', '1991-01-01')]) && 'grund' in waehleTreffer({ ...tv, varianten: [] }, [treffer(9, 'Tim und Struppi', 'Tintin', '1991-01-01')]))
  const mg: string[] = []
  const abgefragt: number[] = []
  const folgen = async (id: number) => {
    abgefragt.push(id)
    return id === 44157 ? 104 : id === 69906 ? 78 : undefined
  }
  await loeseHandliste([{ adn: 7, name: 'Billy & Buddy', original: 'Boule et Bill' }], new Map(), async () => [treffer(44157, 'Billy & Buddy', 'Boule et Bill', '2003-09-01'), treffer(69906, 'Billy & Buddy', 'Boule et Bill', '2016-01-01'), treffer(70000, 'Anderes', 'Anderes', '2016-01-01', [35])], (z) => mg.push(z), folgen)
  pruefe('Folgenzahl: Animations-Kandidaten bekommen sie aus der Detailabfrage, andere nicht', mg[0].includes('2003/104, Animation') && mg[0].includes('2016/78, Animation') && mg[0].includes('2016/?, keine Animation') && abgefragt.join() === '44157,69906', [mg, abgefragt])
  const mgf: string[] = []
  await loeseHandliste([{ adn: 9, name: 'Eins' }], new Map(), async () => [treffer(5, 'Eins', 'Eins', '2001-01-01')], (z) => mgf.push(z), async () => 52)
  pruefe('Folgenzahl: auch die gefunden-Zeile nennt sie', mgf[0].includes('TMDB 5 gefunden') && mgf[0].includes('Jahr/Folgen 2001/52'), mgf)
  const dopp = ohneDoppelte(new Map([[1, 50], [2, 50], [3, 60]]))
  pruefe('zwei Einträge, eine TMDB-Serie: beide raus', dopp.ok.size === 1 && dopp.ok.get(3) === 60 && dopp.doppelt.join() === '1,2', dopp.doppelt)
  const ml: string[] = []
  const beide = await loeseHandliste([{ adn: 1, name: 'A', tmdb: 9 }, { adn: 2, name: 'B', tmdb: 9 }], new Map(), suche, (z) => ml.push(z))
  pruefe('Liste mit zwei Einträgen auf derselben Serie: leer, Log nennt beide', beide.size === 0 && ml.length === 2, ml)

  console.log('\nKleine Helfer des Abrufs')
  pruefe('Kandidaten plus Handliste, ohne Doppelte', mitHandliste([1, 2], new Map([[2, 10], [3, 11]])).join() === '1,2,3')
  pruefe('leere Handliste ändert die Kandidaten nicht', mitHandliste([4, 5], new Map()).join() === '4,5')
  pruefe('andere ADN-Kennung im Bestand: neu holen', adnKennungGeaendert({ adnId: 5 }, 6) && adnKennungGeaendert({}, 6) && adnKennungGeaendert({ adnId: 5 }, undefined))
  pruefe('gleiche Kennung, oder beide ohne: nicht neu holen', !adnKennungGeaendert({ adnId: 6 }, 6) && !adnKennungGeaendert({}, undefined))
  pruefe('Eintrag bekommt die ADN-Kennung; ohne Kennung bleibt er, wie er ist', mitAdnKennung({ a: 1 }, 7).adnId === 7 && !('adnId' in mitAdnKennung({ a: 1 }, undefined)))

  console.log('\nLader der Handliste')
  const ladeAus = (inhalt: string): string => {
    writeFileSync(join(wurzel, 'data', 'cartoon-handliste.yaml'), inhalt)
    try {
      return `ok ${handlisteLaden(wurzel).length}`
    } catch (e) {
      return (e as Error).message
    }
  }
  pruefe('gültiger Eintrag', ladeAus('eintraege:\n  - { adn: 1, name: A }\n') === 'ok 1')
  pruefe('leere Datei: leere Liste', ladeAus('') === 'ok 0')
  pruefe('ADN-Kennung fehlt: Fehler', ladeAus('eintraege:\n  - { name: A }\n').includes('adn fehlt'))
  pruefe('Name fehlt: Fehler', ladeAus('eintraege:\n  - { adn: 1 }\n').includes('name fehlt'))
  pruefe('TMDB-Kennung ist Text: Fehler', ladeAus('eintraege:\n  - { adn: 1, name: A, tmdb: abc }\n').includes('tmdb ist keine Zahl'))
  pruefe('ADN-Kennung doppelt: Fehler', ladeAus('eintraege:\n  - { adn: 1, name: A }\n  - { adn: 1, name: B }\n').includes('doppelt'))

  console.log('\nDie echte Liste')
  const echt = handlisteLaden(process.cwd())
  const dream = echt.find((e) => e.adn === 887)
  pruefe('Dreamland steht drin, ohne feste Kennung (der Abruf sucht)', dream?.name === 'Dreamland' && dream.tmdb === undefined, dream)
  const cousteau = echt.find((e) => e.adn === 748)
  pruefe('Cousteau ist Animation (TMDB 103938, 26 Folgen wie bei ADN), kein Grenzfall mehr', cousteau?.tmdb === 103938 && !cousteau.pruefen, cousteau)
  pruefe('keine ADN-Kennung doppelt', new Set(echt.map((e) => e.adn)).size === echt.length)

  console.log('\nBau: ADN-Serie ohne aniSearch-Eintrag als Cartoon')
  const { ergaenzeAdnTitel } = await import('./bau/07-adn.ts')
  const { schreibeCartoons } = await import('./bau/nebendateien.ts')
  const dreamland: AdnShow = {
    showId: 887,
    title: 'Dreamland',
    originalTitle: 'Dreamland',
    url: 'https://animationdigitalnetwork.com/de/video/887',
    fromCatalog: true,
    batch: false,
    episodes: [
      { date: '2026-10-17', time: '19:00', episode: 1, url: 'https://animationdigitalnetwork.com/de/video/887-dreamland/1001-folge-1' },
      { date: '2026-10-24', time: '19:00', episode: 2, url: 'https://animationdigitalnetwork.com/de/video/887-dreamland/1002-folge-2' },
    ],
  }
  const eintrag = (adnId?: number): CartoonEintrag => ({ id: -900887, tmdbId: 900887, titleEn: 'Dreamland', titleDe: 'Dreamland', genres: ['Animation'], anbieterDe: [], land: ['FR'], adnId, stand: 3, geholtAm: '2026-10-31' })
  const baue = (adnId?: number, im: 'katalog' | 'kalender' = 'katalog'): { releases: Release[]; cartoons: Title[] } => {
    const datei = (shows: AdnShow[]) => JSON.stringify({ scrapedAt: '2026-10-31', window: { from: '', to: '' }, shows })
    writeFileSync(join(wurzel, 'data', 'adn.json'), datei(im === 'kalender' ? [{ ...dreamland, fromCatalog: undefined }] : []))
    writeFileSync(join(wurzel, 'data', 'adn-catalog.json'), datei(im === 'katalog' ? [dreamland] : []))
    writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify({ '-900887': eintrag(adnId) }))
    const releases: Release[] = []
    const ausgabe = join(wurzel, 'public', 'data', 'cartoons.json')
    rmSync(ausgabe, { force: true })
    ergaenzeAdnTitel({ titles: new Map(), releases, titleByName: new Map(), seenSlugs: new Set() })
    schreibeCartoons()
    return { releases, cartoons: existsSync(ausgabe) ? (JSON.parse(readFileSync(ausgabe, 'utf8')) as Title[]) : [] }
  }
  const mit = baue(887)
  const termin = mit.releases.find((r) => r.platform === 'adn')
  pruefe('Termin entsteht, hängt am Cartoon (negative Kennung)', termin?.titleId === -900887 && termin.name === 'Dreamland', mit.releases)
  pruefe('beide Folgen mit Datum und Uhrzeit aus ADN', termin?.schedule?.firstEpisodeDate === '2026-10-17' && termin.schedule.lastEpisodeDate === '2026-10-24' && termin.schedule.time === '19:00' && termin.schedule.episodeCount === 2, termin?.schedule)
  const cartoon = mit.cartoons.find((t) => t.id === -900887)
  const adnWeg = cartoon?.streams.find((s) => s.platform === 'adn')
  pruefe('Cartoon steht im Bestand, ohne TMDB-Anbieter, nur durch die Handliste', Boolean(cartoon), mit.cartoons.map((t) => t.id))
  pruefe('Weg ADN: deutscher Ton, Adresse der Serienseite', adnWeg?.dub === true && adnWeg.url === 'https://animationdigitalnetwork.com/de/video/887', cartoon?.streams)

  const ausKalender = baue(887, 'kalender')
  pruefe('Serie nur im Kalender (adn.json): Termin und Weg ADN ebenso', ausKalender.releases.some((r) => r.titleId === -900887) && ausKalender.cartoons[0]?.streams.some((s) => s.platform === 'adn' && s.dub === true), [ausKalender.releases.length, ausKalender.cartoons[0]?.streams])

  const ohne = baue(undefined)
  pruefe('Gegenprobe ohne `adnId`: kein ADN-Termin', ohne.releases.length === 0, ohne.releases)
  pruefe('Gegenprobe ohne `adnId`: Cartoon ohne Anbieter und Sender bleibt draußen (Aufnahmebeleg)', ohne.cartoons.length === 0, ohne.cartoons.length)
  const falsch = baue(999)
  pruefe('Gegenprobe andere ADN-Kennung: kein Termin für Serie 887', falsch.releases.length === 0 && falsch.cartoons.every((t) => !t.streams.some((s) => s.platform === 'adn')), falsch.releases)

  console.log('\nWeg ADN am Cartoon (ergaenzeAdnWege)')
  const { ergaenzeAdnWege, cartoonTitelJeAdn } = await import('./bau/cartoon-adn.ts')
  const titelMit = (id: number, streams: Title['streams'] = []) => ({ id, streams }) as unknown as Title
  const rohMit = { '-5': { ...eintrag(7), id: -5 }, '-6': { ...eintrag(undefined), id: -6 } }
  const serie = (aenderung: Partial<AdnShow> = {}): AdnShow => ({ ...dreamland, showId: 7, ...aenderung })
  const wege = (t: Title, shows: AdnShow[]) => ({ neu: ergaenzeAdnWege([t], rohMit, shows), streams: t.streams })
  const frisch = wege(titelMit(-5), [serie()])
  pruefe('ohne ADN-Weg: neuer Weg mit Ton und Adresse der Serie', frisch.neu === 1 && JSON.stringify(frisch.streams) === '[{"platform":"adn","url":"https://animationdigitalnetwork.com/de/video/887","dub":true}]', frisch)
  const vorhanden = wege(titelMit(-5, [{ platform: 'adn', url: '' }]), [serie()])
  pruefe('TMDB-Weg ADN ohne Adresse: bekommt Ton und Adresse, kein zweiter Weg', vorhanden.neu === 1 && vorhanden.streams.length === 1 && vorhanden.streams[0]!.dub === true && vorhanden.streams[0]!.url.endsWith('/887'), vorhanden)
  const eigene = wege(titelMit(-5, [{ platform: 'adn', url: 'https://eigene.example/adn' }]), [serie()])
  pruefe('vorhandene Adresse bleibt', eigene.streams[0]!.url === 'https://eigene.example/adn', eigene)
  pruefe('Serie ohne Folgen: kein Weg', wege(titelMit(-5), [serie({ episodes: [] })]).neu === 0)
  pruefe('Serie ohne Adresse: kein Weg', wege(titelMit(-5), [serie({ url: '' })]).neu === 0)
  pruefe('andere Serienkennung: kein Weg', wege(titelMit(-5), [serie({ showId: 8 })]).neu === 0)
  pruefe('Cartoon ohne ADN-Kennung: kein Weg', wege(titelMit(-6), [serie()]).neu === 0)
  pruefe('Cartoon, der nicht in den Rohdaten steht: kein Weg', wege(titelMit(-9), [serie()]).neu === 0)
  const { adnShowJeCartoon } = await import('./bau/cartoon-adn.ts')
  pruefe('ADN-Serie je Cartoon: nur der Eintrag mit Kennung, Folgen und Adresse', [...adnShowJeCartoon(rohMit, [serie()]).keys()].join() === '-5')
  pruefe('ADN-Serie je Cartoon: ohne Folgen oder Adresse leer', adnShowJeCartoon(rohMit, [serie({ episodes: [] })]).size === 0 && adnShowJeCartoon(rohMit, [serie({ url: '' })]).size === 0)
  pruefe('Titelkarte: nur Einträge mit ADN-Kennung', [...cartoonTitelJeAdn(rohMit).keys()].join() === '7')

  console.log('\nVorrang: ein Anime mit gleichem Namen gewinnt vor dem Cartoon')
  const anime = { id: 5, franchiseId: 5, titleRomaji: 'Dreamland', titleEn: 'Dreamland', episodes: 2, keywords: [], genres: [], streams: [] } as unknown as Title
  const { normalizeTitle } = await import('./lib/crunchyroll.ts')
  const { titelZurShow } = await import('./bau/adn-show-titel.ts')
  const jeAdn = new Map([[887, { id: -900887 } as unknown as Title]])
  pruefe('Namenstreffer vor Cartoon', titelZurShow(dreamland, new Map([[5, anime]]), new Map([[normalizeTitle('Dreamland'), anime]]), jeAdn)?.id === 5)
  pruefe('ohne Anime: der Cartoon', titelZurShow(dreamland, new Map(), new Map(), jeAdn)?.id === -900887)
  pruefe('ohne Anime und ohne Cartoon: nichts', titelZurShow(dreamland, new Map(), new Map(), new Map()) === undefined)
  pruefe('Standardparameter: ohne Cartoon-Karte nichts', titelZurShow(dreamland, new Map(), new Map()) === undefined)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nCartoon-Handliste: alle Zusicherungen erfüllt')
