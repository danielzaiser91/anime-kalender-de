/**
 * Prüfsatz für den Faktensammler (tools/handlung-fakten/*.ts, 12.10.2026): Wortnähe, Wikitext, Seitennamen, Einordnung, Abruf (Pause, Fehler, Cache), Seitensuche, Karte.
 * Kein Netz, kein Wikipedia-Abruf. Läuft mit node (Typen werden von node selbst entfernt).
 */
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { baueKarte, kartenMarkdown, ordneEin, quellsaetzeMarkdown } from './handlung-fakten/karte.ts'
import { ohneMarke, seitenKandidaten } from './handlung-fakten/kandidaten.ts'
import { istBestanden, laengsteFolge, vergleiche, woerter } from './handlung-fakten/naehe.ts'
import { sammleWikipedia } from './handlung-fakten/seiten.ts'
import { enthaeltWertung, folgenWiderspruch, istWertung, unbelegteZahlen } from './handlung-fakten/zahlen.ts'
import { istErlaubt, leseRegeln } from './handlung-fakten/robots.ts'
import { UA } from './handlung-fakten/typen.ts'
import { erstelleHoler } from './handlung-fakten/wikipedia.ts'
import { abschnitt, einleitung, infobox, istAnimationsSeite, istBegriffsklaerung, istWeiterleitung, sauber, saetze } from './handlung-fakten/wikitext.ts'

let fehler = 0
async function fall(name, fn) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (e) {
    fehler++
    console.log(`  FEHL ${name}: ${e.message}`)
  }
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms))

await fall('Wortnähe: fünf gemeinsame Wörter fallen durch, Umformulierung besteht', () => {
  const quelle = { name: 'q', text: 'Maomao wurde entführt und als Dienstmagd an den kaiserlichen Hof verkauft.' }
  const kopie = vergleiche('Sie wurde entführt und als Dienstmagd an den Hof gebracht', quelle)
  assert.equal(kopie.laengste, 7)
  assert.equal(istBestanden([kopie]), false)
  const frei = vergleiche('Eine junge Apothekerin landet im Palast und löst dort Giftfälle', quelle)
  assert.equal(istBestanden([frei]), true)
  assert.equal(laengsteFolge(woerter('a b c d'), woerter('x b c d y')).len, 3)
})

await fall('Wikitext: Markup, Abschnitt mit Unterabschnitt, Einleitung', () => {
  const t = "{{Infobox\n| studio = OLM\n}}\nDer '''Film''' ist ein [[Anime|Animationsfilm]].<ref>x</ref>\n\n== Handlung ==\nA geht los.\n=== Teil 1 ===\nB folgt.\n== Rezeption ==\nLob."
  assert.equal(sauber("[[Datei:x.jpg|mini]]Der '''Film''' [[Anime|Anime]]<ref name=a/>"), 'Der Film Anime')
  assert.equal(abschnitt(t), 'A geht los.\n=== Teil 1 ===\nB folgt.')
  assert.equal(einleitung(t), 'Der Film ist ein Animationsfilm.')
  assert.equal(abschnitt(t, 'Nichts'), '')
})

await fall('Wikitext: Sätze trennen nicht an Kürzeln; Weiterleitung und Begriffsklärung erkannt', () => {
  assert.equal(saetze('Dr. Smith kommt in die Stadt an. Dann beginnt der Fall von vorn.').length, 2)
  assert.equal(istWeiterleitung('#REDIRECT [[Made in Abyss]]'), 'Made in Abyss')
  assert.equal(istWeiterleitung('#WEITERLEITUNG [[Bakugan#Staffeln]]'), 'Bakugan')
  assert.equal(istBegriffsklaerung('{{Begriffsklärung}}\n\n\'\'\'X\'\'\' steht für:'), true)
  assert.equal(istAnimationsSeite('{{disambiguation}} anime'), false)
  assert.equal(istAnimationsSeite("'''X''' is a Japanese anime series."), true)
  assert.equal(istAnimationsSeite("'''Silver Twilight''' is a 1990 jazz album."), false)
})

await fall('Wikitext: Infobox-Fakten, mehrere Felder in einer Zeile', () => {
  const t = '| studio = [[OLM]]\n| released = | first_aired = {{Start date|2018|4|8}}\n| runtime = 24 minutes\n| plot = ignoriert'
  const ib = infobox(t)
  assert.equal(ib.studio, 'OLM')
  assert.equal(ib.firstaired, '2018-4-8')
  assert.equal(ib.runtime, '24 minutes')
  assert.equal('released' in ib, false)
  assert.equal('plot' in ib, false)
})

await fall('Seitennamen: Marken fallen ab, Reihe statt Titel, keine Doppelten', () => {
  assert.equal(ohneMarke('Die Tagebücher der Apothekerin: Staffel 3 - Cour 1'), 'Die Tagebücher der Apothekerin')
  assert.equal(ohneMarke('Mob Psycho 100 2nd Season'), 'Mob Psycho 100')
  assert.equal(ohneMarke('Made in Abyss'), 'Made in Abyss')
  const k = seitenKandidaten({ titleEn: 'Bakugan: Legends', titleDe: 'Bakugan: Legends' }, ['Bakugan: Battle Planet'])
  assert.deepEqual(k, [
    { name: 'Bakugan: Legends', ebene: 'titel' },
    { name: 'Bakugan', ebene: 'reihe' },
    { name: 'Bakugan: Battle Planet', ebene: 'reihe' },
  ])
  assert.equal(ohneMarke('Angel Beats! Specials'), 'Angel Beats! Specials')
  assert.equal(ohneMarke('Angel Beats! Specials', true), 'Angel Beats!')
  const g = seitenKandidaten({ titleEn: 'Baby Shark’s Big Show!' }, [])
  assert.deepEqual(g, [{ name: "Baby Shark's Big Show!", ebene: 'titel' }])
  const s = seitenKandidaten({ titleEn: 'The Apothecary Diaries Season 3' }, [])
  assert.deepEqual(s, [{ name: 'The Apothecary Diaries', ebene: 'reihe' }])
})

await fall('Einordnung: zwei Sätze und zwei Quellen sind die Schwelle', () => {
  assert.equal(ordneEin({ titelSaetze: 3, titelPlot: 3, reiheSaetze: 0, quellen: 2 }).einordnung, 'titel')
  assert.equal(ordneEin({ titelSaetze: 1, titelPlot: 1, reiheSaetze: 4, quellen: 2 }).einordnung, 'reihe')
  assert.equal(ordneEin({ titelSaetze: 3, titelPlot: 1, reiheSaetze: 0, quellen: 1 }).einordnung, 'zu dünn')
  assert.equal(ordneEin({ titelSaetze: 3, titelPlot: 3, reiheSaetze: 0, quellen: 1 }).einordnung, 'titel')
  assert.equal(ordneEin({ titelSaetze: 1, titelPlot: 1, reiheSaetze: 0, quellen: 3 }).einordnung, 'zu dünn')
})

function antwort(status, text = '', kopf = {}) {
  return { status, ok: status >= 200 && status < 300, text: async () => text, headers: { get: (k) => kopf[k] ?? null } }
}
const TEST_ORDNER = `data/cache/handlung-fakten-test-${process.pid}`

await fall('Abruf: Mindestabstand zwischen zwei Abrufen (ohne Pause rot)', async () => {
  const zeiten = []
  const fetchFn = async () => {
    zeiten.push(Date.now())
    return antwort(200, 'Text')
  }
  const hole = erstelleHoler({ fetchFn, warteFn: warte, pauseMs: 80, ordner: `${TEST_ORDNER}/pause` })
  await hole('de', 'A')
  await hole('de', 'B')
  await hole('en', 'C')
  assert.equal(zeiten.length, 3)
  assert.ok(zeiten[1] - zeiten[0] >= 75, `Abstand ${zeiten[1] - zeiten[0]} ms`)
  assert.ok(zeiten[2] - zeiten[1] >= 75, `Abstand ${zeiten[2] - zeiten[1]} ms`)
})

await fall('Abruf: Fehler bedeuten Pause und Wiederholung, am Ende „fehler“ statt Abbruch, nichts im Cache', async () => {
  let aufrufe = 0
  const pausen = []
  const fetchFn = async () => {
    aufrufe++
    return antwort(503)
  }
  const hole = erstelleHoler({ fetchFn, warteFn: async (ms) => void pausen.push(ms), pauseMs: 0, backoffSek: [1, 2], ordner: `${TEST_ORDNER}/fehler` })
  const a = await hole('en', 'X')
  assert.equal(a.status, 'fehler')
  assert.equal(aufrufe, 3)
  assert.deepEqual(pausen.filter((p) => p >= 1000), [1000, 2000])
  await hole('en', 'X')
  assert.equal(aufrufe, 6)
})

await fall('Abruf: 429 mit Retry-After, danach Erfolg', async () => {
  const antworten = [antwort(429, '', { 'retry-after': '7' }), antwort(200, 'Inhalt')]
  const pausen = []
  const hole = erstelleHoler({ fetchFn: async () => antworten.shift(), warteFn: async (ms) => void pausen.push(ms), pauseMs: 0, backoffSek: [1], ordner: `${TEST_ORDNER}/retry` })
  const a = await hole('de', 'Y')
  assert.equal(a.status, 'ok')
  assert.ok(pausen.includes(7000))
})

await fall('Abruf: 404 und Treffer liegen im Cache, Weiterleitung wird verfolgt', async () => {
  let aufrufe = 0
  const seiten = { Alt: antwort(200, '#REDIRECT [[Neu]]'), Neu: antwort(200, 'Der Inhalt'), Fehlt: antwort(404) }
  const fetchFn = async (url) => {
    aufrufe++
    const name = decodeURIComponent(/wiki\/([^?]+)\?action=raw/.exec(url)[1])
    return seiten[name]
  }
  const hole = erstelleHoler({ fetchFn, warteFn: async () => {}, pauseMs: 0, ordner: `${TEST_ORDNER}/cache` })
  const a = await hole('de', 'Alt')
  assert.equal(a.seite, 'Neu')
  assert.equal(a.weitergeleitetVon, 'Alt')
  assert.equal(a.text, 'Der Inhalt')
  assert.equal((await hole('de', 'Fehlt')).status, '404')
  const vorher = aufrufe
  await hole('de', 'Alt')
  await hole('de', 'Fehlt')
  assert.equal(aufrufe, vorher)
  const url = []
  await erstelleHoler({ fetchFn: async (u) => (url.push(u), antwort(404)), warteFn: async () => {}, pauseMs: 0, ordner: `${TEST_ORDNER}/url` })('en', 'Persona 5: The Animation')
  assert.equal(url[0], 'https://en.wikipedia.org/wiki/Persona_5%3A_The_Animation?action=raw')
})

const WIKI_ROBOTS = [
  'User-agent: BadBot',
  'Disallow: /',
  '',
  'User-agent: *',
  'Allow: /w/load.php?',
  'Disallow: /w/',
  'Disallow: /api/',
  'Disallow: /wiki/Special:',
  'Disallow: /*action=edit$',
].join('\n')

await fall('robots.txt: Block „*“, längste Regel gilt, Platzhalter, Wikidata-Fall (/sparql gesperrt)', () => {
  const r = leseRegeln(WIKI_ROBOTS)
  assert.equal(istErlaubt(r, '/wiki/Made_in_Abyss?action=raw'), true)
  assert.equal(istErlaubt(r, '/w/api.php?action=query'), false)
  assert.equal(istErlaubt(r, '/w/load.php?x=1'), true)
  assert.equal(istErlaubt(r, '/api/rest_v1/page'), false)
  assert.equal(istErlaubt(r, '/wiki/Special:Search'), false)
  assert.equal(istErlaubt(r, '/wiki/Seite?action=edit'), false)
  assert.equal(istErlaubt(r, '/wiki/Seite?action=editx'), true)
  assert.equal(istErlaubt(leseRegeln('User-agent: *\nDisallow: /sparql'), '/sparql?query=SELECT'), false)
})

await fall('robots.txt: ein gesperrter Pfad wird nie abgerufen', async () => {
  let aufrufe = 0
  const fetchFn = async () => (aufrufe++, antwort(200, 'x'))
  const regeln = { 'en.wikipedia.org': leseRegeln('User-agent: *\nDisallow: /wiki/Gesperrt'), 'de.wikipedia.org': [] }
  const hole = erstelleHoler({ fetchFn, warteFn: async () => {}, pauseMs: 0, regeln, ordner: TEST_ORDNER + '/robots' })
  assert.equal((await hole('en', 'Gesperrt')).status, 'gesperrt')
  assert.equal(aufrufe, 0)
  assert.equal((await hole('en', 'Frei')).status, 'ok')
  assert.equal(aufrufe, 1)
})

await fall('robots.txt: ein HTTP-Sprung auf einen gesperrten Pfad oder fremden Host wird nicht abgerufen', async () => {
  const regeln = { 'en.wikipedia.org': leseRegeln(WIKI_ROBOTS), 'de.wikipedia.org': [] }
  const sprung = (ziel) => antwort(301, '', { location: ziel })
  const seiten = {
    Api: sprung('https://en.wikipedia.org/w/api.php?action=query&titles=X'),
    Spezial: sprung('/wiki/Special:Search?search=X'),
    Fremd: sprung('https://example.org/wiki/X?action=raw'),
    Kette: sprung('/wiki/Kette2?action=raw'),
    Kette2: sprung('/wiki/Kette3?action=raw'),
    Gut: sprung('/wiki/Ziel?action=raw'),
    Ziel: antwort(200, 'Der Inhalt'),
  }
  const urls = []
  const fetchFn = async (url, opts) => {
    urls.push(url)
    assert.equal(opts.redirect, 'manual')
    return seiten[new URL(url).pathname.split('/').pop()]
  }
  const hole = erstelleHoler({ fetchFn, warteFn: async () => {}, pauseMs: 0, regeln, ordner: TEST_ORDNER + '/sprung' })
  for (const name of ['Api', 'Spezial', 'Fremd']) {
    const vorher = urls.length
    assert.equal((await hole('en', name)).status, 'gesperrt', name)
    assert.equal(urls.length, vorher + 1, `${name}: nur die Ausgangsadresse wurde abgerufen`)
  }
  assert.equal((await hole('en', 'Kette')).status, 'gesperrt')
  assert.equal(urls.filter((u) => u.includes('Kette3')).length, 0)
  const gut = await hole('en', 'Gut')
  assert.equal(gut.status, 'ok')
  assert.equal(gut.text, 'Der Inhalt')
})

await fall('User-Agent: Projekt-URL mit Impressum, keine Mailadresse', () => {
  assert.ok(UA.includes('https://anime-kalender.de/#/impressum'))
  assert.ok(!UA.includes('@'))
})

const LUECKE = {
  id: 7,
  geteilt: false,
  titleEn: 'Beispiel Serie: Film',
  titleDe: undefined,
  jpYear: 2019,
  format: 'MOVIE',
  genres: ['Fantasy'],
  studios: [],
  reiheNamen: ['Beispiel Serie'],
  geschwister: [],
}
const ANIME = "'''Beispiel''' is a 2019 Japanese anime film.\n\n== Plot ==\nErster Satz der Handlung steht hier. Zweiter Satz der Handlung steht hier."

function holerAus(seiten, aufrufe = []) {
  return async (sprache, name) => {
    aufrufe.push(`${sprache}:${name}`)
    const text = seiten[`${sprache}:${name}`]
    if (text === undefined) return { status: '404', seite: name }
    return { status: 'ok', text, seite: name, datei: `${sprache}-x.wiki` }
  }
}

await fall('Seitensuche: geratener Name mit Jahr (Ebene titel), ohne Jahr Reihe, Begriffsklärung mit Zusatz', async () => {
  const b = await sammleWikipedia(LUECKE, holerAus({ 'en:Beispiel Serie: Film': ANIME }))
  assert.equal(b.funde[0].ebene, 'titel')
  const ohneJahr = await sammleWikipedia(LUECKE, holerAus({ 'en:Beispiel Serie: Film': ANIME.replace('2019', '2001') }))
  assert.equal(ohneJahr.funde[0].ebene, 'reihe')
  const c = await sammleWikipedia({ ...LUECKE, titleEn: 'Beispiel' }, holerAus({ 'en:Beispiel': '{{disambiguation}}', 'en:Beispiel (anime)': ANIME }))
  assert.equal(c.funde[0].seite, 'Beispiel (anime)')
})

await fall('Seitensuche: fehlende Seite probiert keinen Zusatz, abgelehnte Seiten bleiben ohne Fund', async () => {
  const aufrufe = []
  const r = await sammleWikipedia({ ...LUECKE, titleEn: 'Nichts', reiheNamen: [] }, holerAus({}, aufrufe))
  assert.equal(r.funde.length, 0)
  assert.ok(!aufrufe.some((a) => a.includes('(')), aufrufe.join(' | '))
  const album = await sammleWikipedia({ ...LUECKE, titleEn: 'Silver', reiheNamen: [] }, holerAus({ 'en:Silver': "'''Silver''' is a jazz album." }))
  assert.equal(album.funde.length, 0)
})

await fall('Karte: Schreiber-Karte enthält keinen Quellsatz, die Quellsatz-Datei schon', () => {
  const fund = { sprache: 'en', seite: 'Beispiel Serie: Film', datei: 'x', text: ANIME, ebene: 'titel' }
  const as = { id: 5, titel: 'x', info: { Typ: 'Film' }, hauptgenres: ['Fantasy'], nebengenres: [], tags: [], figuren: ['Riko'], beziehungen: [], beschreibungen: [] }
  const k = baueKarte(LUECKE, [fund], [], as)
  assert.equal(k.einordnung, 'titel')
  assert.equal(k.zaehlung.titelSaetze, 2)
  assert.ok(!kartenMarkdown(k).includes('Erster Satz der Handlung'))
  assert.ok(quellsaetzeMarkdown(k).includes('Erster Satz der Handlung'))
  assert.ok(kartenMarkdown(k).includes('Riko'))
  const duenn = baueKarte(LUECKE, [], [], as)
  assert.equal(duenn.einordnung, 'zu dünn')
})

await fall('Zahlen: unbelegte Zahl wird gefunden, „zwölf“ zählt wie 12, Folgenzahl-Widerspruch', () => {
  assert.deepEqual(unbelegteZahlen('Zwölf Folgen, 2026, dazu 24 Kapitel', ['Staffel mit 12 Folgen, 2026']), ['24'])
  assert.deepEqual(unbelegteZahlen('Eine Serie mit zwölf Folgen', ['12 episodes']), [])
  assert.equal(folgenWiderspruch(12, [{ name: 'a', wert: 12 }, { name: 'b', wert: undefined }]), undefined)
  assert.deepEqual(folgenWiderspruch(12, [{ name: 'aniSearch 1', wert: 24 }]), { katalog: 12, quellen: [{ name: 'aniSearch 1', wert: 24 }] })
})

await fall('Wertung: Rezension und Zitat bleiben aus den Quellsätzen, Titel in Anführungszeichen sind im eigenen Text erlaubt', () => {
  assert.equal(istWertung('Critics praised the film for its animation.'), true)
  assert.equal(istWertung('Kritiker lobten die Optik.'), true)
  assert.equal(istWertung('One reviewer wrote "a sharp and moving story about cars".'), true)
  assert.equal(istWertung('Ren joins other students and forms a group.'), false)
  assert.equal(enthaeltWertung('Zusammenschnitt der Serie „Made in Abyss“ als Kinofilm.'), false)
  assert.equal(enthaeltWertung('Laut Kritikern ein Meisterwerk.'), true)
})

await fall('Karte: Wertungssatz der Einleitung kommt nicht in die Quellsätze, Folgenwiderspruch steht in der Karte, Reihenhinweis ohne „Die Reihe handelt von“ als Anfang', () => {
  const text = "'''Beispiel''' is a 2019 Japanese anime film.\n\nSie spielt in einer Stadt am Meer, in der zwei Freunde leben. Critics praised the film for its animation and music. Am Ende fahren beide nach Hause zurück."
  const fund = { sprache: 'en', seite: 'Beispiel Serie: Film', datei: 'x', text: text + '\n| episodes = 24', ebene: 'reihe' }
  const as = { id: 5, titel: 'x', info: { Typ: 'TV-Serie, 12 (~ 24 min)' }, hauptgenres: ['Fantasy'], nebengenres: [], tags: [], figuren: [], beziehungen: [], beschreibungen: [] }
  const k = baueKarte({ ...LUECKE, episodes: 13 }, [fund], [], as)
  const q = k.quellsaetze[0]
  assert.equal(q.entfernt, 1)
  assert.ok(!q.saetze.some((x) => x.includes('Critics')))
  assert.deepEqual(k.folgenWiderspruch, { katalog: 13, quellen: [{ name: 'aniSearch 5', wert: 12 }] })
  const md = kartenMarkdown({ ...k, einordnung: 'reihe' })
  assert.ok(md.includes('ACHTUNG Folgenzahl'))
  assert.ok(md.includes('nicht mit „Die Reihe handelt von“ beginnen'))
})

rmSync(TEST_ORDNER, { recursive: true, force: true })
console.log(fehler ? `${fehler} Fälle rot` : 'alle Fälle grün')
process.exit(fehler ? 1 : 0)
