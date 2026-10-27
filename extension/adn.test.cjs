/**
 * ADN in der Erweiterung: Sprache je Video aus der Schnittstelle, gemeldet auf Klick.
 *
 * Testdaten: `adn-ausschnitte.fixture.json` (erzeugt von `tools/adn-ausschnitte-erzeugen.mjs`): je Fall die ersten
 * Videos aus dem Archiv der Pipeline und die Abzeichen der gespeicherten Seiten. Jede Zusicherung hat ihre
 * Gegenprobe; die Beziehung der Ausschnitte zum Archiv wird hier nachgerechnet.
 */
const { readFileSync } = require('node:fs')
const { gunzipSync } = require('node:zlib')
const { resolve } = require('node:path')
const vm = require('node:vm')

const lies = (name) => readFileSync(resolve(__dirname, name), 'utf8')
const F = JSON.parse(lies('adn-ausschnitte.fixture.json'))
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Der Leser allein, ohne Seite. */
const kontext = vm.createContext({ globalThis: null, setTimeout })
kontext.globalThis = kontext
vm.runInContext(lies('adn-leser.js'), kontext)
const L = kontext.AK_ADN_LESER
const ordne = (fall) => L.ordne(F[fall].videos)
const toene = (fall, staffel) =>
  ordne(fall)
    .zeilen.filter((z) => staffel === undefined || z.staffel === staffel)
    .map((z) => z.tonDe)

console.log('Adresse')
pruefe('Serienseite → Kennung', L.showId('/de/video/1375-dorohedoro') === 1375)
pruefe('Folgenseite → Kennung der Serie', L.showId('/de/video/1375-dorohedoro/31263-folge-1') === 1375)
pruefe('Gegenprobe: Startseite hat keine', L.showId('/de') === null && L.showId('/de/search') === null)
pruefe('Serienadresse ohne Folge und Staffel', L.showUrl('https://animationdigitalnetwork.com/de/video/1375-dorohedoro/31263-folge-1?s=2') === 'https://animationdigitalnetwork.com/de/video/1375-dorohedoro')
pruefe('Gegenprobe: alte Domain .de ist keine Adresse des Bestands', L.showUrl('https://animationdigitalnetwork.de/video/dorohedoro') === null)

console.log('Sprache je Video')
pruefe('Film mit Synchro (Steins;Gate): ja', toene('film-synchro').join() === 'ja')
pruefe('Gegenprobe: Film nur mit Untertitel (Kizumonogatari): nein', toene('film-untertitel-3').every((t) => t === 'nein') && toene('film-untertitel-3').length === 2)
pruefe('Serie mit Untertitel (B King): nein', toene('serie-untertitel').every((t) => t === 'nein'))
pruefe('Wöchentliche Serie (Suikoden): Folge 1 und 2, beide nein', ordne('serie-woechentlich').zeilen.map((z) => `${z.nummer}:${z.tonDe}`).join() === '1:nein,2:nein')
pruefe('Dorohedoro Staffel 1: nein', toene('serie-synchro-s1', 1).join() === 'nein,nein')
pruefe('Dorohedoro Staffel 2: ja', toene('serie-synchro-s1', 2).join() === 'ja,ja')
const abzeichen = L.seitenstand(F['serie-synchro-s1'].seite.testids, '')
pruefe('Gegenprobe: das Abzeichen der Serie (SYNCHRO) ersetzt die Staffel nicht', abzeichen.synchro && toene('serie-synchro-s1', 1).every((t) => t === 'nein'))
pruefe('Sprachen: vde → de, vostde → ja mit deutschem Untertitel', (() => {
  const z = ordne('film-synchro').zeilen[0]
  return z.sprachen.join() === 'ja,de' && z.untertitel.join() === 'de'
})())

console.log('Folgen, Filme, Rest')
const roh = (extra) => ({ id: 1, title: 't', name: 'n', number: 'Folge 1', shortNumber: '1', season: '1', type: 'EPS', languages: ['vde'], show: { id: 9, title: 'S' }, ...extra })
pruefe('Folge: Nummer und Staffel aus ADN', (() => {
  const z = L.ordne([roh({ shortNumber: '13', season: '2' })]).zeilen[0]
  return z.nummer === 13 && z.staffel === 2 && z.kennung === null
})())
pruefe('Film ohne Nummer: 1, Kennung MOV, keine Staffel', (() => {
  const z = L.ordne([roh({ type: 'MOV', number: 'Film', shortNumber: 'Film', season: null })]).zeilen[0]
  return z.nummer === 1 && z.staffel === null && z.kennung === 'MOV'
})())
pruefe('OVA und Folge 1 derselben Staffel haben verschiedene Schlüssel', (() => {
  const z = L.ordne([roh({}), roh({ id: 2, type: 'OAV', number: 'OVA 1', shortNumber: 'OVA 1' })]).zeilen
  return z[0].kennung !== z[1].kennung
})())
pruefe('Staffel mit Namen: Name als Kennung, keine Staffelnummer', (() => {
  const z = L.ordne([roh({ season: 'Saga 14 : Wano Kuni' })]).zeilen[0]
  return z.staffel === null && z.kennung === 'Saga 14 : Wano Kuni'
})())
pruefe('Trailer, Vorschau und „(NC)" sind keine Folgen', L.ordne([roh({ type: 'PV' }), roh({ id: 3, number: 'Folge 1 (NC)', shortNumber: '1 (NC)' }), roh({ id: 4, number: 'Trailer', shortNumber: 'Trailer' })]).zeilen.length === 0)
pruefe('Gegenprobe: eine echte Folge bleibt', L.ordne([roh({})]).zeilen.length === 1)
pruefe('Ohne Sprachangabe: nicht gemeldet, aber gezählt', (() => {
  const r = L.ordne([roh({ languages: [] })])
  return r.zeilen.length === 0 && r.ohneAngabe === 1
})())

console.log('Meldung')
const serie = L.serieAus(F['serie-synchro-s1'].videos)
const m = L.meldung(serie, 'https://animationdigitalnetwork.com/de/video/1375-dorohedoro', ordne('serie-synchro-s1').zeilen[2])
pruefe('Anbieter adn, gemessen, Verfügbarkeit und Sprache getrennt', m.plattform === 'adn' && m.art === 'gemessen' && m.vorhanden === 'ja' && m.ton_de === 'ja')
pruefe('Genau eine Rohfolge (liegt in der Meldungszeile, nicht in prime_folge)', m.rohfolgen.length === 1 && m.rohfolgen[0].gti === '31276')
pruefe('Rohfolge trägt die Staffelzählung von ADN (reference)', m.rohfolgen[0].roh.referenz === 'dorohedoro_tv2_0001')
pruefe('Folge und Nummer', m.folge === 'Dorohedoro - Folge 13' && m.folge_nr === 13 && m.staffel === 2)
pruefe('Keine Kontodaten in der Meldung', !/@|token|e-?mail|account|profil/i.test(JSON.stringify(m)))
pruefe('„nicht im Angebot" ist vorhanden: nein ohne ton_de', (() => {
  const w = L.wegMeldung(serie, 'u')
  return w.vorhanden === 'nein' && w.ton_de === undefined && !w.rohfolgen
})())

console.log('Schnittstelle')
const antwort = (status, videos) => ({ status, ok: status >= 200 && status < 300, json: async () => ({ videos }) })
const seiten = async (anzahlen, status = 200) => {
  const aufrufe = []
  const holen = async (url, init) => {
    aufrufe.push({ url, init })
    const n = anzahlen[aufrufe.length - 1] ?? 0
    return antwort(status, Array.from({ length: n }, (_, i) => roh({ id: aufrufe.length * 1000 + i })))
  }
  const r = await L.ladeVideos(1375, { holen, pause: 0 })
  return { r, aufrufe }
}
async function schnittstelleUndSeite() {
  const eine = await seiten([99])
  pruefe('99 Videos: ein Aufruf', eine.aufrufe.length === 1 && eine.r.videos.length === 99)
  const zwei = await seiten([100, 20])
  pruefe('Gegenprobe: 100 Videos → zweite Seite mit offset=100', zwei.aufrufe.length === 2 && zwei.aufrufe[1].url.endsWith('limit=100&offset=100') && zwei.r.videos.length === 120)
  pruefe('Kopfzeilen wie die Seite: deutscher Katalog', eine.aufrufe[0].init.headers['x-target-distribution'] === 'de' && eine.aufrufe[0].init.headers['x-source'] === 'Web')
  const nichts = await seiten([], 404)
  pruefe('404 → nicht im Angebot', nichts.r.nichtImAngebot === true)
  const leer = await seiten([0])
  pruefe('200 mit leerer Liste → nicht im Angebot', leer.r.nichtImAngebot === true)
  const kaputt = await seiten([], 500)
  pruefe('Gegenprobe: 500 ist ein Fehler, nie „keine Videos"', kaputt.r.fehler === 'HTTP 500' && !kaputt.r.nichtImAngebot)
  const netz = await L.ladeVideos(1, { holen: async () => { throw new Error('Failed to fetch') } })
  pruefe('Gegenprobe: kein Netz ist ein Fehler', /Failed to fetch/.test(netz.fehler ?? '') && !netz.nichtImAngebot)

  console.log('Seite')
  const ohne = F['film-ohne-video'].seite
  pruefe('Film ohne Video: Hinweis da, kein Abzeichen', L.seitenstand(ohne.testids, 'Kein Video verfügbar.').keinVideo && !L.seitenstand(ohne.testids, '').synchro && !L.seitenstand(ohne.testids, '').untertitel)
  pruefe('Gegenprobe: Serie mit Videos hat den Hinweis nicht', !L.seitenstand(F['serie-untertitel'].seite.testids, '').keinVideo)
  const st = L.seitenstand(F['film-synchro'].seite.testids, '')
  pruefe('Film mit Synchro: beide Abzeichen im Kopf', st.synchro && st.untertitel)
  const sub = L.seitenstand(F['film-untertitel-3'].seite.testids, '')
  pruefe('Gegenprobe: Film nur mit Untertitel hat kein SYNCHRO (die Empfehlungen dahinter tragen es)', !sub.synchro && sub.untertitel && F['film-untertitel-3'].seite.testids.includes('text-SYNCHRO'))

}

async function haupt() {
  await schnittstelleUndSeite()
  await kastenFaelle()
  verdrahtung()
  console.log('')
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) rot`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zu ADN halten.')
}
haupt()

/** Der Kasten im Sandkasten: nichts geht ohne Klick an den Worker, „nicht im Angebot" nie von selbst. */
const alleAngenommen = (b) => ({ ergebnisse: (b.stapel ?? []).map(() => ({ ok: true, befund: null })) })
async function kastenLauf(fall, apiStatus = 200, gemeldet = [], postAntwort = alleAngenommen) {
  const gesendet = []
  const knoepfe = []
  const box = { querySelector: () => ({ appendChild: (k) => knoepfe.push(k) }) }
  const fakeFetch = async (url, init) => {
    if (url.includes('gw.api.animationdigitalnetwork.com')) return antwort(apiStatus, F[fall].videos)
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body)
      gesendet.push(body)
      const inhalt = postAntwort(body)
      const status = inhalt.status ?? 200
      return { ok: status < 400, status, clone() { return this }, json: async () => inhalt }
    }
    return { ok: true, status: 200, json: async () => ({ paare: gemeldet.map((folge) => ({ folge })) }) }
  }
  const k = vm.createContext({
    console,
    setTimeout,
    setInterval: () => 0,
    URL: { createObjectURL: () => '' },
    Blob: class {},
    CustomEvent: class {},
    fetch: fakeFetch,
    chrome: { storage: { sync: { get: async () => ({ token: 't' }) } }, runtime: { getManifest: () => ({ version: 'test' }) } },
    location: { pathname: `/de/video/${F[fall].show ?? 1427}-x`, href: `https://animationdigitalnetwork.com/de/video/${F[fall].show ?? 1427}-x` },
    document: {
      title: 'Titel | ADN',
      createElement: () => ({ remove() {}, isConnected: true, setAttribute() {}, removeAttribute() {} }),
      addEventListener() {},
      querySelectorAll: () => F[fall].seite.testids.map((t) => ({ getAttribute: () => t })),
      querySelector: (s) => (s === 'main' ? { textContent: F[fall].seite.keinVideo ? 'Kein Video verfügbar.' : '' } : s === 'h1' ? { textContent: F[fall].seite.h1 } : null),
    },
    akBox: () => box,
    akDebugLeiste() {},
    akBerichtSchalter: () => ({}),
  })
  k.globalThis = k
  for (const datei of ['disney-netz.js', 'melde-sperre.js', 'adn-leser.js', 'adn-senden.js', 'adn.js']) vm.runInContext(lies(datei), k, { filename: datei })
  await new Promise((fertig) => setTimeout(fertig, 50))
  return { gesendet, knopf: knoepfe[0], alle: knoepfe, k }
}

async function kastenFaelle() {
  console.log('Kasten')
  const lauf = kastenLauf

  const syn = await lauf('film-synchro')
  pruefe('Film mit Synchro: Knopf nennt „1 melden (1× deutsch)"', /1 melden \(1× deutsch\)/.test(syn.knopf.textContent), syn.knopf.textContent)
  pruefe('... und bis zum Klick geht nichts an den Worker', syn.gesendet.length === 0)
  const liste = (l) => l.alle.find((e) => /ak-uebersicht/.test(e.className ?? ''))
  pruefe('Prüfliste steht im Kasten, leer mit Hinweis (Daniel, 16.10.2026)', /^Prüfliste: leer/.test(liste(syn)?.textContent), liste(syn)?.textContent)
  const weg0 = await lauf('film-ohne-video', 404)
  pruefe('... auch auf einer Seite ohne Video', /^Prüfliste: leer/.test(liste(weg0)?.textContent), liste(weg0)?.textContent)
  const neu = await lauf('film-synchro')
  const alt = liste(neu)
  alt.isConnected = false
  await neu.knopf.onclick()
  const listen = neu.alle.filter((e) => /ak-uebersicht/.test(e.className ?? ''))
  pruefe('Kasten entfernt (Knopf nicht mehr im Dokument): die Prüfliste wird neu aufgebaut', listen.length === 2 && listen[1] !== alt && listen[1].isConnected, listen.length)
  const stehen = await lauf('film-synchro')
  await stehen.knopf.onclick()
  pruefe('Gegenprobe: bleibt der Knopf im Dokument, entsteht keine zweite Prüfliste', stehen.alle.filter((e) => /ak-uebersicht/.test(e.className ?? '')).length === 1)
  pruefe('Gegenprobe: der Melde-Knopf ist nicht die Prüfliste', !/Prüfliste/.test(syn.knopf.textContent))
  await syn.knopf.onclick()
  pruefe('Klick: ein Stapel mit der Meldung', syn.gesendet.length === 1 && syn.gesendet[0].stapel.length === 1 && syn.gesendet[0].stapel[0].plattform === 'adn')
  pruefe('... danach „gemeldet" ohne Klick-Aktion', /✓ 1 gemeldet/.test(syn.knopf.textContent) && !syn.knopf.onclick, syn.knopf.textContent)

  const schon = await lauf('serie-untertitel', 200, ['Suikoden - Folge 1'])
  const titel = F['serie-untertitel'].videos.map((v) => v.title)
  const teil = await lauf('serie-untertitel', 200, [titel[0]])
  pruefe('Schon gemeldete Folge wird nicht noch einmal gesendet', (await teil.knopf.onclick(), teil.gesendet[0].stapel.length === 1 && teil.gesendet[0].stapel[0].folge === titel[1]))
  pruefe('Gegenprobe: fremder Titel in der Ferne ändert nichts', (await schon.knopf.onclick(), schon.gesendet[0].stapel.length === 2))

  const weg = await lauf('film-ohne-video', 404)
  pruefe('Film ohne Video: „nicht im Angebot" wird angeboten', /nicht im Angebot melden/.test(weg.knopf.textContent), weg.knopf.textContent)
  pruefe('... und nennt die Seite als Gegenprobe („Kein Video verfügbar")', /Kein Video verfügbar/.test(weg.knopf.textContent))
  pruefe('... aber ohne Klick geht nichts an den Worker (weg nur von Hand)', weg.gesendet.length === 0)
  await weg.knopf.onclick()
  pruefe('Klick: eine Meldung vorhanden = nein', weg.gesendet.length === 1 && weg.gesendet[0].vorhanden === 'nein' && !weg.gesendet[0].stapel)

  await ergebnisFaelle(titel)

  const kaputt = await lauf('film-synchro', 500)
  pruefe('Schnittstelle antwortet 500: Fehler angezeigt, nichts als „weg" angeboten', /nicht lesbar/.test(kaputt.knopf.textContent) && kaputt.gesendet.length === 0, kaputt.knopf.textContent)

}

/** Der Worker nennt je Zeile, ob er sie angenommen hat; nur das zählt als gemeldet. */
async function ergebnisFaelle(titel) {
  const lauf = kastenLauf
  const lehneZweitenAb = (b) => ({
    ergebnisse: b.stapel.map((_, i) => (i === 1 ? { ok: false, status: 400, grund: 'Titel unbekannt' } : { ok: true, befund: null })),
  })
  const ab = await lauf('serie-untertitel', 200, [], lehneZweitenAb)
  await ab.knopf.onclick()
  pruefe('Abgelehnte Zeile zählt nicht als gemeldet (Kasten nicht „✓ … gemeldet")', !/✓/.test(ab.knopf.textContent), ab.knopf.textContent)
  pruefe('... Kasten nennt Zahl und Grund des Servers', /1 abgelehnt: Titel unbekannt/.test(ab.knopf.textContent), ab.knopf.textContent)
  pruefe('... und die Zeile ist erneut sendbar (Klick vorhanden)', typeof ab.knopf.onclick === 'function')
  const gesendetVorher = ab.gesendet.length
  await ab.knopf.onclick()
  pruefe('Erneuter Klick sendet nur die abgelehnte Zeile', ab.gesendet.length === gesendetVorher + 1 && ab.gesendet.at(-1).stapel.length === 1 && ab.gesendet.at(-1).stapel[0].folge === titel[1], ab.gesendet.at(-1))

  const verschieden = await lauf('serie-untertitel', 200, [], (b) => ({ ergebnisse: b.stapel.map((_, i) => ({ ok: false, status: 400, grund: `Grund ${i}` })) }))
  await verschieden.knopf.onclick()
  pruefe('Verschiedene Gründe stehen getrennt im Kasten', /2 abgelehnt: Grund 0 \/ Grund 1/.test(verschieden.knopf.textContent), verschieden.knopf.textContent)

  const ohneErgebnis = await lauf('film-synchro', 200, [], () => ({ ok: true }))
  await ohneErgebnis.knopf.onclick()
  pruefe('Antwort ohne Ergebnisliste gilt nicht als gemeldet', !/✓/.test(ohneErgebnis.knopf.textContent) && /abgelehnt/.test(ohneErgebnis.knopf.textContent), ohneErgebnis.knopf.textContent)

  const schonAlle = await lauf('film-synchro', 200, [F['film-synchro'].videos[0].title])
  pruefe('Alles schon in der Ferne: Kasten sagt „schon gemeldet", ohne POST', /✓ 1 schon gemeldet/.test(schonAlle.knopf.textContent) && schonAlle.gesendet.length === 0, schonAlle.knopf.textContent)

  const wegAb = await lauf('film-ohne-video', 404, [], () => ({ status: 400, error: 'plattform fehlt' }))
  await wegAb.knopf.onclick()
  pruefe('„nicht im Angebot" vom Server abgelehnt: Grund sichtbar, erneut sendbar', /plattform fehlt/.test(wegAb.knopf.textContent) && typeof wegAb.knopf.onclick === 'function', wegAb.knopf.textContent)
}

function verdrahtung() {
  console.log('Verdrahtung und Testdaten')
  const manifest = JSON.parse(lies('manifest.json'))
  const gruppe = manifest.content_scripts.find((g) => g.matches.includes('https://animationdigitalnetwork.com/*'))
  pruefe('Manifest: ADN-Gruppe lädt box.js und disney-netz.js vor adn.js', gruppe && ['box.js', 'disney-netz.js', 'adn-leser.js', 'adn-senden.js'].every((d) => gruppe.js.indexOf(d) > -1 && gruppe.js.indexOf(d) < gruppe.js.indexOf('adn.js')))
  pruefe('Gegenprobe: keine andere Gruppe lädt adn.js', manifest.content_scripts.filter((g) => g.js.includes('adn.js')).length === 1)
  const text = lies('adn-ausschnitte.fixture.json')
  pruefe('Testdaten ohne persönliche Daten (@, token, email, account, user, Konto, Profil)', !/@|token|e-?mail|account|user|konto|profil/i.test(text), text.match(/.{20}(@|token|e-?mail|account|user|konto|profil).{20}/i)?.[0])
  const archivVergleich = Object.values(F).filter((f) => f.show).every((f) => {
    const archiv = JSON.parse(gunzipSync(readFileSync(resolve(__dirname, `../data/adn-raw/${f.show}.json.gz`))))
    const nachId = new Map(archiv.videos.map((v) => [v.id, v]))
    return f.videos.every((v) => nachId.get(v.id)?.languages.join() === v.languages.join() && nachId.get(v.id).title === v.title)
  })
  pruefe('Jeder Ausschnitt stimmt mit dem Archiv der Pipeline überein (Id, Titel, Sprachen)', archivVergleich)
}
