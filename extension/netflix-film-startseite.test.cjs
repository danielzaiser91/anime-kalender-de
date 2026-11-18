/**
 * Netflix-Durchgang: Film ohne Titelinhalt, sichtbare Frist, Schlusstext, Zähler (Issue 4060, 16.11.2026).
 *
 * Anlass: Bildschirmaufnahme vom 16.11.2026 (v4.32.134): Appleseed (70023531) zeigte unter `/title/…` die Startseite, der Film ging
 * trotzdem in den Player (`/watch`, „0/0“), wartete rund 20 s, wurde ein zweites Mal versucht, und der Durchgang endete als
 * „abgebrochen · besucht 3“, obwohl fünf Titel durchlaufen waren. Hier die eingefrorenen Fälle; kein Abruf bei Netflix.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
const lies = (datei) => readFileSync(resolve(__dirname, datei), 'utf8')

console.log('Netflix: Film ohne Titelinhalt, Frist, Schlusstext, Zähler')
process.on('unhandledRejection', (e) => {
  console.log('  ✗ unbehandelt:', e)
  process.exit(1)
})
const k = { globalThis: null, console, AbortController, URL, setTimeout, clearTimeout, JSON, Math, Date, Map, Set, Promise }
k.globalThis = k
vm.createContext(k)
for (const datei of ['netflix-erinnern.js', 'netflix-uebernahme.js', 'netflix-durchgang-steuerung.js', 'netflix-zurueckgestellt.js']) vm.runInContext(lies(datei), k)

/** Ein Speicher wie `sessionStorage`. */
const speicherNeu = () => {
  const m = new Map()
  return { getItem: (s) => m.get(s) ?? null, setItem: (s, w) => m.set(s, String(w)), removeItem: (s) => m.delete(s) }
}
const T0 = 1_000_000
/** Merkmale der Seite `/title/70023531`, die die Startseite zeigt (kein Titelinhalt). */
const startseite = { pfad: '/title/70023531', titel: 'Startseite – Netflix', folgenElemente: 0, dialoge: { anzahl: 0 } }
const mitInhalt = { pfad: '/title/70023531', titel: 'Appleseed – Netflix', folgenElemente: 0, dialoge: { anzahl: 1 } }

/** Ein Film-Takt: `zeit` ms nach Ankunft auf der Seite. */
const filmTakt = (merkmale, zeit, wartet = { seite: '70023531', seit: T0 }, opt = {}) => {
  const z = { spuren: [], weiter: 0, uebersprungen: new Map(), stoerung: 0, geladen: 0, grund: null }
  const o = { seite: '70023531', reihe: '70023531', film: true, erledigt: Boolean(opt.erledigt), erinnern: false, frist: 20000, jetzt: T0 + zeit, durchlauf: { folgen: [{ film: true }], listeFuer: null }, merkmale: () => merkmale }
  const tun = {
    spur: (...a) => z.spuren.push(a),
    uebersprungen: z.uebersprungen,
    weiter: () => z.weiter++,
    bremse: { stoerung: (r, g) => (z.stoerung++, (z.grund = g)), ok() {} },
    vollLaden: { versucht: () => Boolean(opt.vollVersucht), laden: () => z.geladen++ },
  }
  z.rest = k.akNetflixListeWarten(wartet, o, tun)
  return z
}

/* --- a: Film, Titeladresse zeigt die Startseite --- */
let z = filmTakt(startseite, 3000)
pruefe('a: nach 3 s noch keine Entscheidung (Schonzeit), kein Weitergehen, kein Laden', z.weiter === 0 && z.geladen === 0 && z.stoerung === 0 && z.uebersprungen.size === 0 && !z.rest.entschieden && !z.rest.filmFrei, z.rest)
z = filmTakt(startseite, 8000)
pruefe('a: genau auf der Grenze (8 s) noch nicht entschieden', z.weiter === 0 && z.geladen === 0 && !z.rest.entschieden, z.rest)
z = filmTakt(startseite, 9000)
pruefe('a (A2): nach 8 s leer: wie bei Serien einmal voll laden, noch keine Störung, nicht weiter', z.geladen === 1 && z.stoerung === 0 && z.weiter === 0 && z.rest.entschieden === true && !z.rest.filmFrei, z)
z = filmTakt(startseite, 9000, { seite: '70023531', seit: T0 }, { vollVersucht: true })
pruefe('a: nach dem vollen Laden noch leer: Störung der Sitzung (Bremse bucht den Titel als zurückgestellt) und weiter, kein Player', z.stoerung === 1 && z.weiter === 1 && z.geladen === 0 && /^Titelfenster ohne Inhalt in 8 s, auch nach vollem Laden$/.test(String(z.grund)) && !z.rest.filmFrei, [z.grund, z.stoerung, z.weiter])
pruefe('a: kein Urteil „nicht bei Netflix“ und nichts als übersprungen am Urteil vorbei gebucht', !z.spuren.some((sp) => /nicht bei Netflix/.test(String(sp[0]))) && z.uebersprungen.size === 0, z.spuren)
const wieder = filmTakt(startseite, 12000, z.rest, { vollVersucht: true })
pruefe('a: ein entschiedener Film wird nicht noch einmal weitergereicht', wieder.weiter === 0 && wieder.stoerung === 0 && wieder.rest.entschieden === true)
z = filmTakt(mitInhalt, 1000)
pruefe('a: zeigt die Seite den Titel, ist der Film frei für den Player', z.rest.filmFrei === true && z.weiter === 0 && z.stoerung === 0 && z.uebersprungen.size === 0, z.rest)

/* --- b: laufende Frist sichtbar --- */
pruefe('b: Film wartet auf den Titel, mit Sekunden und Frist', k.akNetflixWartetText({ seite: 'x', seit: T0, film: true, frist: 8000 }, T0 + 3400) === 'wartet auf den Titel, 3 s (Notausgang nach 8 s)', k.akNetflixWartetText({ seite: 'x', seit: T0, film: true, frist: 8000 }, T0 + 3400))
pruefe('b: Sekunden werden abgeschnitten, nicht gerundet (3,6 s = 3)', k.akNetflixWartetText({ seite: 'x', seit: T0, film: true, frist: 8000 }, T0 + 3600) === 'wartet auf den Titel, 3 s (Notausgang nach 8 s)')
pruefe('b: Takt-Ergebnis eines Films nennt „den Titel“, das einer Serie „die Folgenliste“', k.akNetflixWartetText(filmTakt(startseite, 3000).rest, T0 + 3000) === 'wartet auf den Titel, 3 s (Notausgang nach 8 s)' && k.akNetflixWartetText(k.akNetflixListeWarten({ seite: 's', seit: T0 }, { seite: 's', reihe: 's', erinnern: false, frist: 20000, jetzt: T0 + 2000, durchlauf: { folgen: [], listeFuer: null }, merkmale: () => null }, { spur() {}, uebersprungen: new Map(), weiter() {} }), T0 + 5000) === 'wartet auf die Folgenliste, 5 s (Notausgang nach 20 s)')
pruefe('b: Serie wartet auf die Folgenliste, 12 s (Notausgang nach 20 s)', k.akNetflixWartetText({ seite: 'x', seit: T0, frist: 20000 }, T0 + 12100) === 'wartet auf die Folgenliste, 12 s (Notausgang nach 20 s)')
pruefe('b: über der Frist bleibt die Zahl bei der Frist', k.akNetflixWartetText({ seite: 'x', seit: T0, frist: 20000 }, T0 + 25000) === 'wartet auf die Folgenliste, 20 s (Notausgang nach 20 s)')
pruefe('b: ohne Warten oder nach der Entscheidung kein Text', k.akNetflixWartetText(null, T0) === '' && k.akNetflixWartetText({ seite: 'x', seit: T0, entschieden: true, frist: 8000 }, T0 + 1000) === '')
const f = k.akNetflixFortschritt(2, 5, 'Appleseed', 0, 'wartet auf den Titel, 3 von 8 s')
pruefe('b: die Fortschrittszeile trägt den Wartetext', f.text === 'Durchgang: 1 von 5 geprüft · gerade: Appleseed · wartet auf den Titel, 3 von 8 s', f.text)
pruefe('b: Takt-Ergebnis trägt die Frist des Wartens (Film 8 s, Serie 20 s)', filmTakt(startseite, 3000).rest.frist === 8000 && k.akNetflixListeWarten({ seite: 's', seit: T0 }, { seite: 's', reihe: 's', erinnern: false, frist: 20000, jetzt: T0 + 2000, durchlauf: { folgen: [], listeFuer: null }, merkmale: () => null }, { spur() {}, uebersprungen: new Map(), weiter() {} }).frist === 20000)

/* --- c: kein zweiter Versuch über den gescheiterten Weg --- */
{
  const s = speicherNeu()
  pruefe('c: Film noch nicht im Player', k.akNetflixFilmWarDa('70023531', s) === false)
  k.akNetflixFilmVersuchMerken('70023531', s)
  k.akNetflixFilmVersuchMerken('70023531', s)
  pruefe('c: nach dem Start des Durchlaufs gemerkt (einmal, auch bei doppeltem Aufruf)', k.akNetflixFilmWarDa('70023531', s) === true && JSON.parse(s.getItem('ak-netflix-filme')).length === 1, s.getItem('ak-netflix-filme'))
  pruefe('c: ein anderer Film ist frei', k.akNetflixFilmWarDa('70000001', s) === false)
  k.akNetflixZaehlerSetze(0, 5, s)
  pruefe('c: ein neuer Durchgang (Zähler 0) vergisst die Versuche', k.akNetflixFilmWarDa('70023531', s) === false)
}
{
  /* Im Takt, mit dem echten Speicher des Laufs: Freigabe bucht nichts (A1), erst der Start des Durchlaufs. */
  k.sessionStorage = speicherNeu()
  const frei = filmTakt(mitInhalt, 1000)
  pruefe('c (A1): Freigabe zum Player: filmFrei, noch nichts gebucht', frei.rest.filmFrei === true && !k.akNetflixFilmWarDa('70023531'), frei.rest)
  const wiedereintritt = filmTakt(mitInhalt, 1000)
  pruefe('c (A1): Wiedereintritt ohne Player (Durchlauf startete nicht): wieder frei, nicht zurückgestellt', wiedereintritt.rest.filmFrei === true && wiedereintritt.weiter === 0 && wiedereintritt.uebersprungen.size === 0, wiedereintritt.rest)
  k.akNetflixFilmVersuchMerken('70023531')
  const zweit = filmTakt(mitInhalt, 1000)
  pruefe('c: war im Player und ist noch offen: kein Player, zurückgestellt mit Grund, weiter', !zweit.rest.filmFrei && zweit.rest.entschieden === true && zweit.weiter === 1 && zweit.uebersprungen.get('70023531') === 'Player ohne Ergebnis, nicht erneut versucht', [zweit.rest, [...zweit.uebersprungen]])
  const geklappt = filmTakt(mitInhalt, 1000, undefined, { erledigt: true })
  pruefe('c: war im Player und ist nicht mehr offen (Messung geglückt): normaler Weg, nichts zurückgestellt', geklappt.rest.filmFrei === true && geklappt.uebersprungen.size === 0 && geklappt.weiter === 0, geklappt.rest)
  delete k.sessionStorage
}

/* --- d: Schlusstext --- */
{
  const zeile = { kinder: [], appendChild(x) { this.kinder.push(x) }, querySelector(sel) { const kl = sel.replace(/^\./, ''); return this.kinder.find((x) => !x.entfernt && x.className.split(' ').includes(kl)) ?? null } }
  k.document = { createElement: () => ({ className: '', classList: { toggle() {} }, remove() {} }) }
  const ende = (grund, uebersprungen) => k.akNetflixEnde(grund, new Map(uebersprungen.map((id) => [id, 'Titelfenster ohne Inhalt'])), new Set(), 5, { 70023531: { staffeln: [{ offen: true }] } }, new Set(), null, new Set(['a', 'b', 'c', 'd']))
  const text = (e) => { k.akNetflixEndeZeigen(() => zeile, e, ''); return zeile.kinder.pop().textContent }
  const alle = text(ende('kein offener Auftrag mehr', ['70023531']))
  pruefe('d: alle Titel durchlaufen, 1 offen: „Durchgang fertig · 1 offen“', /^Durchgang fertig · 1 offen\b/.test(alle) && !/abgebrochen/.test(alle), alle)
  pruefe('d: Zähler im Schlusstext: besucht 5, 4 nicht bei Netflix', /besucht 5, gemessen 0, nicht bei Netflix 4/.test(alle), alle)
  pruefe('d: ohne Offenes nur „Durchgang fertig“', /^Durchgang fertig(?! ·\s*\d+ offen)/.test(text(ende('kein offener Auftrag mehr', []))))
  const bremse = text(ende('Netflix zeigte 1 Titel ohne Inhalt, sie bleiben offen', []))
  pruefe('d (A3): alle durchlaufen, Bremse hält 1 Titel offen (Fall der Aufnahme): „Durchgang fertig · 1 offen“', /^Durchgang fertig · 1 offen\b/.test(bremse) && !/abgebrochen/.test(bremse), bremse)
  const beides = text(ende('Netflix zeigte 2 Titel ohne Inhalt, sie bleiben offen', ['70023531']))
  pruefe('d: Bremse und Zurückgestelltes zählen zusammen (2 + 1 = 3 offen)', /^Durchgang fertig · 3 offen\b/.test(beides), beides)
  for (const grund of ['abgebrochen', 'Fehler: x', 'Schutz: zu viele Sprünge']) {
    const t = text(ende(grund, ['70023531']))
    pruefe(`d: „${grund}“ bleibt ein Abbruch`, t.startsWith(`Durchgang abgebrochen · ${grund}`), t)
  }
}

/* --- e: Zähler „besucht“ --- */
{
  const s = speicherNeu()
  k.akNetflixZaehlerSetze(0, 5, s)
  pruefe('e: Laufbeginn: besucht 0', k.akNetflixBesuchtStand(s) === 0)
  /* Fünf Sprünge des Laufs; vier gibt der Sprung zurück („nicht bei Netflix“: gezaehlt − 1 und wieder + 1), der fünfte ist der Film. */
  for (let i = 0; i < 5; i++) k.akNetflixZaehlerSetze(1, 5, s, `Titel ${i}`)
  pruefe('e: fünf Titel angesprungen (vier „nicht bei Netflix“, ein Film): besucht 5, auch nach dem Neuladen', k.akNetflixBesuchtStand(s) === 5, k.akNetflixBesuchtStand(s))
  k.akNetflixZaehlerSetze(0, 5, s, null, true)
  pruefe('e: beginnt der Lauf auf einem offenen Titel, zählt er mit', k.akNetflixBesuchtStand(s) === 1, k.akNetflixBesuchtStand(s))
  k.akNetflixZaehlerSetze(0, 5, s)
  pruefe('e: ein neuer Lauf beginnt wieder bei 0', k.akNetflixBesuchtStand(s) === 0)
}

/* --- f: „gerade: …“ läuft mit dem Zähler --- */
{
  const s = speicherNeu()
  k.akNetflixZaehlerSetze(1, 5, s, 'Erster')
  const a = k.akNetflixZaehlerStand(s)
  k.akNetflixZaehlerSetze(2, 5, s, 'Zweiter')
  const b = k.akNetflixZaehlerStand(s)
  pruefe('f: Zähler und Titel stehen im selben Stand', a.gezaehlt === 1 && a.titel === 'Erster' && b.gezaehlt === 2 && b.titel === 'Zweiter', [a, b])
  pruefe('f: ohne Titel bleibt der Stand lesbar', k.akNetflixZaehlerSetze(3, 5, s) === undefined && k.akNetflixZaehlerStand(s).gezaehlt === 3)
}

/* --- Verdrahtung: der echte selbstStartenSchritt aus melder.js mit Attrappen (kein Abruf, kein Netflix) --- */
const verdrahtung = async () => {
  const melder = lies('melder.js')
  const von = melder.indexOf('async function selbstStartenSchritt')
  const quelle = melder.slice(von, melder.indexOf('\n}\n', von) + 2)
  /** Läuft die Funktion in einem Gültigkeitsbereich, der jeden freien Namen aus `w` (sonst aus den echten Globals) nimmt. */
  const lauf = (w) => {
    const bereich = new Proxy(w, {
      has: () => true,
      get: (t, n) => (n === Symbol.unscopables ? undefined : n in t ? t[n] : globalThis[n]),
      set: (t, n, v) => ((t[n] = v), true),
    })
    return new Function('bereich', `with (bereich) { return (${quelle.replace(/^async function selbstStartenSchritt/, 'async function')}) }`)(bereich)()
  }
  const kulisse = (merkmale, opt = {}) => {
    const w = {
      selbstAn: true,
      DURCHLAUF: { laeuft: false, folgen: [{ film: true, videoId: 70023531 }], listeFuer: null },
      location: { pathname: '/title/70023531' },
      document: {},
      history: {},
      gemeinteReihe: () => '70023531',
      titelDerAdresse: () => '70023531',
      keineFolgeVorhanden: () => false,
      offeneTitel: { 70023531: { titel: 'Appleseed', staffeln: [{ nr: 1, film: true, folgen: 1, offen: true }] } },
      fertig: () => Boolean(opt.erledigt),
      selbstVersucht: null,
      selbstWartet: opt.wartet ?? null,
      selbstGesammelt: new Set(),
      SELBST_LISTE_WARTEN: 20000,
      akNetflixListeWarten: k.akNetflixListeWarten,
      akNetflixBericht: { seitenmerkmale: () => merkmale },
      spur: () => {},
      selbstUebersprungen: new Map(),
      weiterGerufen: 0,
      selbstWeiter: () => w.weiterGerufen++,
      bremse: { ok() {}, stoerung() {} },
      vollLaden: { versucht: () => false, laden() {} },
      selbstSammeln: async () => false,
      folgenFuerFilmErgaenzen: () => {},
      Date: { now: () => opt.jetzt ?? T0 },
    }
    return w
  }
  k.sessionStorage = speicherNeu()
  /* Film mit Titelinhalt: erster Takt legt den Wartestand an, zweiter gibt frei, dritter läuft bis ins Sammeln (hier: nicht bereit). */
  const w = kulisse(mitInhalt)
  await lauf(w)
  pruefe('Wiring: erster Takt auf der Seite: Wartestand angelegt, noch nicht frei', w.selbstWartet?.seite === '70023531' && !w.selbstWartet.filmFrei, w.selbstWartet)
  await lauf(w)
  pruefe('Wiring: zweiter Takt: der Film ist frei (Titelinhalt da)', w.selbstWartet?.filmFrei === true && w.selbstVersucht === null, w.selbstWartet)
  await lauf(w)
  pruefe('Wiring (A1): dritter Takt geht ins Sammeln und kehrt zurück, der Film wird NICHT als „Player ohne Ergebnis“ zurückgestellt', w.selbstWartet === null && w.selbstUebersprungen.size === 0 && w.weiterGerufen === 0 && w.selbstVersucht === null, [w.selbstWartet, [...w.selbstUebersprungen], w.weiterGerufen])
  await lauf(w)
  await lauf(w)
  await lauf(w)
  pruefe('Wiring (A1): auch beim Wiedereintritt (neuer Wartestand, wieder frei) nichts zurückgestellt', w.selbstUebersprungen.size === 0 && w.weiterGerufen === 0, [...w.selbstUebersprungen])
  /* War der Film im Player und ist noch offen: zurückgestellt, ohne dass ein Durchlauf startet. */
  k.akNetflixFilmVersuchMerken('70023531')
  const w2 = kulisse(mitInhalt, { wartet: { seite: '70023531', seit: T0 } })
  await lauf(w2)
  pruefe('Wiring: Film war im Player und ist offen: zurückgestellt mit Grund, weiter, kein Sammeln', w2.selbstUebersprungen.get('70023531') === 'Player ohne Ergebnis, nicht erneut versucht' && w2.weiterGerufen === 1, [[...w2.selbstUebersprungen], w2.weiterGerufen])
  const w3 = kulisse(mitInhalt, { wartet: { seite: '70023531', seit: T0 }, erledigt: true })
  await lauf(w3)
  pruefe('Wiring: Film war im Player und ist erledigt (laut Prüfliste): nicht zurückgestellt', w3.selbstUebersprungen.size === 0 && w3.weiterGerufen === 0 && w3.selbstWartet?.filmFrei === true, w3.selbstWartet)
  /* Leeres Fenster: nie ein Weg in den Sammelschritt oder den Player. */
  delete k.sessionStorage
  const w4 = kulisse(startseite, { wartet: { seite: '70023531', seit: T0 }, jetzt: T0 + 9000 })
  let sammelte = 0
  w4.selbstSammeln = async () => (sammelte++, false)
  await lauf(w4)
  pruefe('Wiring: Film mit leerem Titelfenster geht nie bis ins Sammeln (kein Player)', sammelte === 0 && w4.selbstVersucht === null, sammelte)
  /* Der Merker steht im Quelltext vor dem Start des Durchlaufs, nicht an der Freigabe. */
  const nachMerken = quelle.slice(quelle.indexOf('akNetflixFilmVersuchMerken(reihe)'))
  pruefe('Wiring (A1): der Merker wird gesetzt, bevor durchlaufStarten läuft, und nur für Filme', /^akNetflixFilmVersuchMerken\(reihe\)\n\s+await durchlaufStarten\(\)/.test(nachMerken) && /if \(filmHier\) akNetflixFilmVersuchMerken\(reihe\)/.test(quelle))
  const rest = melder
  pruefe('Wiring: besucht kommt aus dem Besuchtzähler, nicht aus Sprüngen plus Rückgaben; Laufbeginn zählt den Starttitel', /akNetflixBesuchtStand\(\), offeneTitel/.test(rest) && !/selbstGezaehlt \+ akNetflixErledigtStand\(\)/.test(rest) && /undefined, null, hierAuftrag, hierAuftrag \? String\(gemeinteReihe\(\)\) : null\)/.test(rest))
  pruefe('Wiring: Fortschritt: Titel aus dem Zählerstand, Wartetext, Sprung mit Titel', /akNetflixZaehlerStand\(\)\.titel \?\? offeneTitel/.test(rest) && /akNetflixWartetText\(selbstWartet, Date\.now\(\)\)/.test(rest) && /akNetflixZaehlerSetze\(\+\+selbstGezaehlt, selbstGrenze, undefined, offeneTitel\[naechster\]\?\.titel, false, naechster\)/.test(rest))
}

void verdrahtung().then(() => {
  if (fehler.length) {
    console.log(`\n${fehler.length} Prüfung(en) fehlgeschlagen.`)
    process.exit(1)
  }
  console.log('\nAlle Prüfungen bestanden.')
})
