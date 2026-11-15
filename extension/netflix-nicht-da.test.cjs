/**
 * Netflix-Durchgang: Titel, die es in Deutschland nicht gibt (15.11.2026).
 *
 * Anlass: Daniel, Cautious Hero (81196818) landete über die Liste auf /browse, der Durchgang hatte ihn als
 * „Erinnern statt Folgenliste" zurückgestellt; „alle durchgehen" wartete 11–13 s je Umleitung (8 s Leerlauf plus
 * Neuladen), und UI3012-Titel wurden als „ohne Tonspur" gezählt. Jetzt: Vorprüfung vor dem Sprung (Umleitung auf
 * /browse = nicht bei Netflix, sofort), UI3012 nach sauberer Sitzung = Titel, Urteile zählen im Endbericht.
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

console.log('Netflix: nicht bei Netflix (Umleitung, UI3012, Bericht)')
const k = { globalThis: null, console, AbortController, URL, setTimeout, clearTimeout }
k.globalThis = k
vm.createContext(k)
for (const datei of ['netflix-erinnern.js', 'netflix-uebernahme.js', 'netflix-durchgang-steuerung.js', 'netflix-zurueckgestellt.js']) vm.runInContext(lies(datei), k)

/** Antwort des Servers: `url` ist die Adresse nach allen Umleitungen. */
const antwort = (url, redirected) => ({ url: `https://www.netflix.com${url}`, redirected })
const probe = async (a, { profilwahl = false, werfen = false } = {}) => {
  const spuren = []
  const abgefragt = []
  const r = await k.akNetflixUmleitungProbe('81196818', {
    fetch: async (adresse, opt) => {
      abgefragt.push([adresse, opt.credentials, Boolean(opt.signal)])
      if (werfen) throw new Error('Netz weg')
      return a
    },
    profilwahl: () => profilwahl,
    spur: (...x) => spuren.push(x),
  })
  return { r, spuren, abgefragt }
}

(async () => {
  /* --- Vorprüfung: nur eine echte Umleitung auf die Startseite ist ein Urteil --- */
  let p = await probe(antwort('/browse', true))
  pruefe('Umleitung auf /browse (angemeldet): Urteil', p.r === true && p.abgefragt[0][0] === '/title/81196818' && p.abgefragt[0][1] === 'same-origin' && p.abgefragt[0][2] === true, p)
  pruefe('Gebietspfad /de-en/browse zählt ebenso', (await probe(antwort('/de-en/browse', true))).r === true)
  pruefe('Umleitung auf /login (nicht angemeldet): kein Urteil', (await probe(antwort('/login', true))).r === false)
  pruefe('Umleitung auf die Profilauswahl: kein Urteil', (await probe(antwort('/ProfilesGate', true))).r === false)
  pruefe('keine Umleitung (Titelseite da): kein Urteil', (await probe(antwort('/title/81196818', false))).r === false)
  pruefe('/browse ohne Umleitung (Adresse zufällig gleich): kein Urteil', (await probe(antwort('/browse', false))).r === false)
  pruefe('Profilauswahl sichtbar: kein Urteil, nicht einmal ein Abruf', (await probe(antwort('/browse', true), { profilwahl: true })).abgefragt.length === 0)
  p = await probe(null, { werfen: true })
  pruefe('Netzfehler: kein Urteil, aber nicht stumm (Spur mit Grund)', p.r === false && p.spuren.length === 1 && p.spuren[0][0] === 'Vorprüfung ohne Antwort' && /Netz weg/.test(p.spuren[0][1].text), p.spuren)

  /* --- Sprung: Urteil sofort, kein Timer --- */
  const sprung = async ({ umgeleitet, aktiv = true }) => {
    const w = { gehe: [], weiter: [], urteil: [], beleg: 0 }
    await k.akNetflixSprung('81196818', {
      probe: async () => umgeleitet,
      aktiv: () => aktiv,
      gehe: (a) => w.gehe.push(a),
      weiter: (n) => w.weiter.push(n),
      urteil: async (id, g) => w.urteil.push([id, g]),
      beleg: () => w.beleg++,
    })
    return w
  }
  let w = await sprung({ umgeleitet: true })
  pruefe('Umleitung: Urteil „Umleitung auf Startseite“, Sitzungsbeleg, weiter(1) (Sprung zurückgegeben), kein gehe', JSON.stringify(w) === JSON.stringify({ gehe: [], weiter: [1], urteil: [['81196818', 'Umleitung auf Startseite']], beleg: 1 }), w)
  w = await sprung({ umgeleitet: false })
  pruefe('keine Umleitung: gehe /title/<id>, kein Urteil, kein weiter', JSON.stringify(w) === JSON.stringify({ gehe: ['/title/81196818'], weiter: [], urteil: [], beleg: 0 }), w)
  w = await sprung({ umgeleitet: true, aktiv: false })
  pruefe('Durchgang während der Vorprüfung beendet: nichts mehr (weder Urteil noch gehe)', w.gehe.length + w.weiter.length + w.urteil.length + w.beleg === 0, w)
  w = await sprung({ umgeleitet: false, aktiv: false })
  pruefe('Durchgang beendet, keine Umleitung: auch kein gehe', w.gehe.length === 0, w)

  /* --- Urteil: Meldeweg des Knopfes; scheitert er, bleibt es beim Zurückstellen --- */
  const urteil = async (ok) => {
    const nichtDa = new Map()
    const uebersprungen = new Map()
    const spuren = []
    const gemeldet = []
    await k.akNetflixNichtDaUrteil('81196818', 'Umleitung auf Startseite', {
      melden: async (...a) => { gemeldet.push(a); return ok ? { ok: true, text: 'als tot gemeldet' } : { ok: false, text: 'Kein Token' } },
      titel: (id) => `Titel ${id}`,
      nichtDa,
      uebersprungen,
      spur: (...x) => spuren.push(x),
    })
    return { nichtDa: [...nichtDa], uebersprungen: [...uebersprungen], gemeldet, spuren }
  }
  let u = await urteil(true)
  pruefe('Meldung gelingt: gemeldet mit Titel und Grund, in „nicht bei Netflix“, nicht zurückgestellt', JSON.stringify(u.gemeldet) === '[["81196818","Titel 81196818","Umleitung auf Startseite"]]' && JSON.stringify(u.nichtDa) === '[["81196818","Umleitung auf Startseite"]]' && u.uebersprungen.length === 0, u)
  u = await urteil(false)
  pruefe('Meldung scheitert (kein Token): kein Urteil, Titel wird zurückgestellt, Grund in der Spur', u.nichtDa.length === 0 && JSON.stringify(u.uebersprungen) === '[["81196818","Umleitung auf Startseite"]]' && /gescheitert/.test(u.spuren[0][0]) && u.spuren[0][1].text === 'Kein Token', u)

  /* --- UI3012: Titel nur nach sauberer Sitzung, sonst Sitzungsstörung --- */
  const T0 = Date.UTC(2026, 10, 15, 12, 0, 0)
  const ui = (b, erfolge, reihe = '540533') => {
    const nd = []
    const ueb = new Map()
    const d = { titelSperre: { code: 'UI3012', reihe }, selbst: true }
    k.akNetflixTitelUeberspringen(d, ueb, () => {}, b, T0, { erfolge: () => erfolge, urteil: (id, g) => nd.push([id, g]) })
    return { nd, ueb: [...ueb], offen: b.offen() }
  }
  const neu = () => k.akNetflixBremseOeffnen(new Map(), undefined, null)
  let r = ui(neu(), 3)
  pruefe('UI3012 nach drei gemessenen Titeln: „nicht bei Netflix“ (Abspielfehler UI3012), nicht übersprungen, nicht Sitzung', JSON.stringify(r.nd) === '[["540533","Abspielfehler UI3012"]]' && r.ueb.length === 0 && r.offen === 0, r)
  r = ui(neu(), 0)
  pruefe('UI3012 ohne einen gemessenen Titel: weiter Sitzungsstörung (Bremse), kein Urteil', r.nd.length === 0 && r.offen === 1, r)
  r = ui(neu(), 1)
  pruefe('UI3012 nach genau einem gemessenen Titel (Schwelle > 0): Urteil', r.nd.length === 1 && r.offen === 0, r)
  const b = neu()
  ui(b, 2, '1')
  r = ui(b, 2, '2')
  pruefe('zweites UI3012 ohne neuen Erfolg dazwischen: Sitzungsstörung (12.11.: sieben in Folge), kein zweites Urteil', r.nd.length === 0 && r.offen === 1, r)
  r = ui(b, 3, '3')
  pruefe('danach ein gemessener Titel mehr: wieder ein Urteil', r.nd.length === 1, r)
  const b2 = neu()
  ui(b2, 2, '1')
  b2.beleg()
  r = ui(b2, 2, '2')
  pruefe('Umleitungs-Beleg dazwischen (Netflix antwortet eindeutig): Urteil', r.nd.length === 1 && r.offen === 0, r)
  r = ui(b2, 2, '3')
  pruefe('der Beleg gilt nur einmal: das nächste UI3012 ist wieder Sitzung', r.nd.length === 0 && r.offen === 1, r)
  const sp = { d: {}, getItem(n) { return this.d[n] ?? null }, setItem(n, v) { this.d[n] = v } }
  const b3 = k.akNetflixBremseOeffnen(new Map(), undefined, sp)
  ui(b3, 2, '1')
  const b4 = k.akNetflixBremseOeffnen(new Map(), undefined, sp)
  r = ui(b4, 2, '2')
  pruefe('Stand überlebt das Neuladen der Seite (sessionStorage): zweites UI3012 ohne Erfolg = Sitzung', r.nd.length === 0 && r.offen === 1, r)
  b4.zuruecksetzen()
  r = ui(k.akNetflixBremseOeffnen(new Map(), undefined, sp), 2, '4')
  pruefe('Start eines neuen Durchgangs setzt den Stand zurück', r.nd.length === 1, r)
  /* Alter Aufruf ohne Urteilsbausteine bleibt wie vorher. */
  const alt = neu()
  k.akNetflixTitelUeberspringen({ titelSperre: { code: 'UI3012', reihe: '9' }, selbst: true }, new Map(), () => {}, alt, T0)
  pruefe('ohne Urteilsbausteine: UI3012 geht an die Bremse', alt.offen() === 1)
  const e103 = new Map()
  k.akNetflixTitelUeberspringen({ titelSperre: { code: 'E103', reihe: '8' }, selbst: true }, e103, () => {}, neu(), T0, { erfolge: () => 5, urteil: () => fehler.push('E103 darf kein Urteil sein') })
  pruefe('E103 bleibt übersprungen (kein Urteil über andere Codes)', e103.get('8') === 'Netflix zeigt ihn nicht (E103)')

  /* --- Erinnern: erst nach vollem Laden (Billboard der Startseite trägt auch „Erinnern") --- */
  const erinnern = (voll) => {
    const a = { geladen: 0, uebersprungen: new Map(), weiter: 0, spur: [] }
    const tun = { spur: (s) => a.spur.push(s), uebersprungen: a.uebersprungen, weiter: () => a.weiter++, bremse: neu() }
    if (voll !== undefined) tun.vollLaden = { versucht: () => voll, laden: () => a.geladen++ }
    const merkmale = { pfad: '/title/81196818', titel: 'Cautious Hero – Netflix', folgenElemente: 0, dialoge: { anzahl: 1 } }
    const rest = k.akNetflixListeWarten({ seite: '81196818', seit: T0 }, { seite: '81196818', reihe: '81196818', erinnern: true, frist: 20000, jetzt: T0 + 3000, durchlauf: { folgen: [], listeFuer: null }, merkmale: () => merkmale }, tun)
    return { ...a, rest }
  }
  let e = erinnern(false)
  pruefe('Erinnern, noch nicht voll geladen: Seite wird voll geladen, nichts zurückgestellt', e.geladen === 1 && e.uebersprungen.size === 0 && e.weiter === 0 && e.rest.entschieden === true, e)
  e = erinnern(true)
  pruefe('Erinnern nach vollem Laden: gilt, zurückgestellt „Erinnern statt Folgenliste“', e.geladen === 0 && e.uebersprungen.get('81196818') === 'Erinnern statt Folgenliste' && e.weiter === 1, e)
  e = erinnern(undefined)
  pruefe('Erinnern ohne Neulade-Baustein (Rückfall): wie bisher zurückgestellt', e.uebersprungen.size === 1 && e.weiter === 1, e)

  /* --- Umgeleitet im Takt: Urteil statt Zurückstellen, Profilauswahl ohne Urteil --- */
  const takt = (ueberschreibe = {}, mitNichtDa = true) => {
    const a = { urteile: [], uebersprungen: new Map(), weiter: 0 }
    const o = { selbstAn: true, laeuft: false, pfad: '/browse', ziel: { id: '81196818', zeit: 1000, durchgang: true }, jetzt: 6000, offen: true, profilwahl: false, ...ueberschreibe }
    const tun = { spur: () => {}, uebersprungen: a.uebersprungen, weiter: () => a.weiter++ }
    if (mitNichtDa) tun.nichtDa = { urteil: (id, g) => a.urteile.push([id, g]) }
    return { r: k.akNetflixUmgeleitet(o, tun), ...a }
  }
  let t = takt()
  pruefe('Takt auf /browse: Urteil, weiter, nicht zurückgestellt', t.r === true && JSON.stringify(t.urteile) === '[["81196818","Umleitung auf Startseite"]]' && t.weiter === 1 && t.uebersprungen.size === 0, t)
  t = takt({ profilwahl: true })
  pruefe('Takt auf /browse bei der Profilauswahl: weder Urteil noch weiter noch Zurückstellen', t.r === false && t.urteile.length === 0 && t.weiter === 0 && t.uebersprungen.size === 0, t)
  t = takt({}, false)
  pruefe('ohne Urteilsbaustein: Rückfall auf Zurückstellen mit Grund', t.r === true && t.uebersprungen.get('81196818') === 'Netflix leitet auf die Startseite um', t)

  /* --- Fabrik: verdrahtet Vorprüfung, Urteil und Sprung wirklich --- */
  const f = { gehe: [], weiter: [], melden: [], spur: [] }
  const tun = k.akNetflixNichtDaTun({
    melden: async (...a) => { f.melden.push(a); return { ok: true, text: 'ok' } },
    offeneTitel: { 81196818: { titel: 'Cautious Hero' } },
    fertig: new Set(['a', 'b']),
    uebersprungen: new Map(),
    spur: (...a) => f.spur.push(a),
    gehe: (p) => f.gehe.push(p),
    weiter: (n) => f.weiter.push(n),
    aktiv: () => true,
    bremse: neu(),
    profilwahl: () => false,
    fetch: async () => antwort('/browse', true),
  })
  await tun.sprung('81196818')
  pruefe('Fabrik: Umleitung → Meldung mit Titel und Grund, weiter(1), kein gehe', JSON.stringify(f.melden) === '[["81196818","Cautious Hero","Umleitung auf Startseite"]]' && JSON.stringify(f.weiter) === '[1]' && f.gehe.length === 0, f)
  pruefe('Fabrik: erfolge() zählt die gemessenen Titel', tun.erfolge() === 2)
  pruefe('Fabrik: das Urteil steht in der Zählung des Endberichts', k.akNetflixNichtDa().get('81196818') === 'Umleitung auf Startseite')
  const f2 = { gehe: [] }
  const tun2 = k.akNetflixNichtDaTun({ melden: async () => ({ ok: true }), offeneTitel: {}, fertig: new Set(), uebersprungen: new Map(), spur: () => {}, gehe: (p) => f2.gehe.push(p), weiter: () => {}, aktiv: () => true, bremse: neu(), profilwahl: () => false, fetch: async () => antwort('/title/5', false) })
  await tun2.sprung('5')
  pruefe('Fabrik: ohne Umleitung geht der Sprung wie bisher', JSON.stringify(f2.gehe) === '["/title/5"]')

  /* --- Start eines Durchgangs: die Urteile des vorigen Laufs gehen (Zählung des Endberichts) --- */
  const karte = k.akNetflixZurueckNeu({}, () => false, { speicher: { get: async () => ({}), set: async () => {} }, jetzt: () => T0, datum: () => null })
  k.akNetflixNichtDa().set('77', 'Umleitung auf Startseite')
  pruefe('Vorbedingung: ein Urteil des vorigen Laufs steht da', k.akNetflixNichtDa().size >= 1)
  karte.clear()
  pruefe('selbstUebersprungen.clear() (Start eines Durchgangs) leert auch die Urteile', k.akNetflixNichtDa().size === 0, [...k.akNetflixNichtDa()])

  /* --- Zählung „ohne Tonspur“ (B): Lücke, ehrlich benannt — der Zweig sitzt mitten in `durchlaufStarten` (420 Zeilen) und ist nicht
     einzeln ausführbar; hier nur der Quelltext-Anker, die Laufzeit prüft der Takt-Test in netflix-titel-gesperrt für die Störung. --- */
  const melder = lies('melder.js')
  pruefe('ohne Tonspur zählt nicht bei einer Netflix-Störung (UI3012, E103)', /if \(!DURCHLAUF\.stoerung\) DURCHLAUF\.ohneSpur = \(DURCHLAUF\.ohneSpur \?\? 0\) \+ 1/.test(melder))
  if (fehler.length) {
    console.log(`\n${fehler.length} Fall/Fälle rot`)
    process.exit(1)
  }
  console.log('\nNetflix nicht bei Netflix: alle Fälle grün')
})()
