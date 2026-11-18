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
      weiter: (...a) => w.weiter.push(a),
      urteil: async (id, g) => w.urteil.push([id, g]),
      beleg: () => w.beleg++,
    })
    return w
  }
  let w = await sprung({ umgeleitet: true })
  pruefe('Umleitung: Urteil „Umleitung auf Startseite“, Sitzungsbeleg, weiter(1) (Sprung zurückgegeben), kein gehe', JSON.stringify(w) === JSON.stringify({ gehe: [], weiter: [[1, true, '81196818']], urteil: [['81196818', 'Umleitung auf Startseite']], beleg: 1 }), w)
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
      unterwegs: new Set(),
      uebersprungen,
      spur: (...x) => spuren.push(x),
    })
    return { nichtDa: [...nichtDa], uebersprungen: [...uebersprungen], gemeldet, spuren }
  }
  let u = await urteil(true)
  pruefe('Meldung gelingt: gemeldet mit Titel und Grund, in „nicht bei Netflix“, nicht zurückgestellt', JSON.stringify(u.gemeldet) === '[["81196818","Titel 81196818","Umleitung auf Startseite"]]' && JSON.stringify(u.nichtDa) === '[["81196818","Umleitung auf Startseite"]]' && u.uebersprungen.length === 0, u)
  u = await urteil(false)
  pruefe('Meldung scheitert (kein Token): kein Urteil, Titel wird zurückgestellt, Grund in der Spur', u.nichtDa.length === 0 && JSON.stringify(u.uebersprungen) === '[["81196818","Umleitung auf Startseite"]]' && /gescheitert/.test(u.spuren[0][0]) && u.spuren[0][1].text === 'Kein Token', u)

  /* --- UI3012: Titel nur nach einem Umleitungs-Beleg unmittelbar davor, sonst Sitzungsstörung (auch das erste UI3012 nach sauberen Titeln) --- */
  const T0 = Date.UTC(2026, 10, 15, 12, 0, 0)
  const ui = (b, reihe = '540533') => {
    const nd = []
    const ueb = new Map()
    const d = { titelSperre: { code: 'UI3012', reihe }, selbst: true }
    k.akNetflixTitelUeberspringen(d, ueb, () => {}, b, T0, { urteil: (id, g) => nd.push([id, g]) })
    return { nd, ueb: [...ueb], offen: b.offen() }
  }
  const neu = (speicher = null) => k.akNetflixBremseOeffnen(new Map(), undefined, speicher)
  let r = ui(neu())
  pruefe('UI3012 ohne Beleg (auch nach sauberen Titeln): Sitzungsstörung (Bremse), kein Urteil', r.nd.length === 0 && r.offen === 1, r)
  const b = neu()
  for (const id of ['1', '2', '3']) b.ok()
  const folge = []
  for (let i = 1; i <= 7; i++) folge.push(ui(b, String(i)).nd.length)
  pruefe('12.11.: drei saubere Titel, dann sieben UI3012: keine einzige Meldung', folge.every((n) => n === 0) && b.offen() === 7, folge)
  const b2 = neu()
  b2.beleg()
  r = ui(b2, '2')
  pruefe('Umleitungs-Beleg davor (Netflix antwortet eindeutig): Urteil, nicht Sitzung', JSON.stringify(r.nd) === '[["2","Abspielfehler UI3012"]]' && r.offen === 0, r)
  r = ui(b2, '3')
  pruefe('der Beleg gilt nur einmal: das nächste UI3012 ist wieder Sitzung', r.nd.length === 0 && r.offen === 1, r)
  const b5 = neu()
  b5.beleg()
  b5.ok()
  pruefe('ein sauberer Titel nach dem Beleg verbraucht ihn', ui(b5, '5').nd.length === 0)
  const b6 = neu()
  b6.beleg()
  b6.stoerung('x', 'Titelfenster ohne Inhalt', T0)
  pruefe('eine Störung nach dem Beleg verbraucht ihn', ui(b6, '6').nd.length === 0)
  const sp = { d: {}, getItem(n) { return this.d[n] ?? null }, setItem(n, v) { this.d[n] = v } }
  neu(sp).beleg()
  r = ui(neu(sp), '7')
  pruefe('der Beleg überlebt das Neuladen der Seite (sessionStorage)', r.nd.length === 1, r)
  neu(sp).beleg()
  neu(sp).zuruecksetzen()
  pruefe('Start eines neuen Durchgangs setzt den Beleg zurück', ui(neu(sp), '8').nd.length === 0)
  /* Alter Aufruf ohne Urteilsbausteine bleibt wie vorher. */
  const alt = neu()
  k.akNetflixTitelUeberspringen({ titelSperre: { code: 'UI3012', reihe: '9' }, selbst: true }, new Map(), () => {}, alt, T0)
  pruefe('ohne Urteilsbausteine: UI3012 geht an die Bremse', alt.offen() === 1)
  const e103 = new Map()
  const b7 = neu()
  b7.beleg()
  k.akNetflixTitelUeberspringen({ titelSperre: { code: 'E103', reihe: '8' }, selbst: true }, e103, () => {}, b7, T0, { urteil: () => fehler.push('E103 darf kein Urteil sein') })
  pruefe('E103 bleibt übersprungen (kein Urteil über andere Codes, auch mit Beleg)', e103.get('8') === 'Netflix zeigt ihn nicht (E103)')

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
  pruefe('Erinnern nach vollem Laden: gilt, zurückgestellt „Erinnern-Knopf ohne Datum“', e.geladen === 0 && e.uebersprungen.get('81196818') === 'Erinnern-Knopf ohne Datum' && e.weiter === 1, e)
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
  const bF = neu()
  const tun = k.akNetflixNichtDaTun({
    melden: async (...a) => { f.melden.push(a); return { ok: true, text: 'ok' } },
    offeneTitel: { 81196818: { titel: 'Cautious Hero' } },
    uebersprungen: new Map(),
    spur: (...a) => f.spur.push(a),
    gehe: (p) => f.gehe.push(p),
    weiter: (...a) => f.weiter.push(a),
    aktiv: () => true,
    bremse: bF,
    profilwahl: () => false,
    fetch: async () => antwort('/browse', true),
  })
  await tun.sprung('81196818')
  pruefe('Fabrik: Umleitung → Meldung mit Titel und Grund, weiter(1), kein gehe', JSON.stringify(f.melden) === '[["81196818","Cautious Hero","Umleitung auf Startseite"]]' && JSON.stringify(f.weiter) === '[[1,true,"81196818"]]' && f.gehe.length === 0, f)
  pruefe('Fabrik: das Urteil steht in der Zählung des Endberichts', k.akNetflixNichtDa().get('81196818') === 'Umleitung auf Startseite')
  pruefe('Fabrik: der Umleitungs-Beleg liegt an der Bremse (das nächste UI3012 ist Urteil, danach wieder Sitzung)', ui(bF, '2').nd.length === 1 && ui(bF, '3').nd.length === 0)
  const f2 = { gehe: [] }
  const tun2 = k.akNetflixNichtDaTun({ melden: async () => ({ ok: true }), offeneTitel: {}, uebersprungen: new Map(), spur: () => {}, gehe: (p) => f2.gehe.push(p), weiter: () => {}, aktiv: () => true, bremse: neu(), profilwahl: () => false, fetch: async () => antwort('/title/5', false) })
  await tun2.sprung('5')
  pruefe('Fabrik: ohne Umleitung geht der Sprung wie bisher', JSON.stringify(f2.gehe) === '["/title/5"]')
  const ohneBeleg = neu()
  await k.akNetflixNichtDaTun({ melden: async () => ({ ok: true }), offeneTitel: {}, uebersprungen: new Map(), spur: () => {}, gehe: () => {}, weiter: () => {}, aktiv: () => true, bremse: ohneBeleg, profilwahl: () => false, fetch: async () => antwort('/title/5', false) }).sprung('5')
  pruefe('Fabrik: ohne Umleitung kein Beleg', ui(ohneBeleg, '9').nd.length === 0)
  const zurueck = new Map()
  const tun3 = k.akNetflixNichtDaTun({ melden: async () => ({ ok: false, text: 'Kein Token' }), offeneTitel: {}, uebersprungen: zurueck, spur: () => {}, gehe: () => {}, weiter: () => {}, aktiv: () => true, bremse: neu(), profilwahl: () => false, fetch: async () => antwort('/browse', true) })
  await tun3.sprung('6')
  pruefe('Fabrik: scheitert die Meldung, steht der Titel in der Zurückstellung des Aufrufers', zurueck.get('6') === 'Umleitung auf Startseite', [...zurueck])

  /* --- Vorprüfung mit Frist: Attrappe-Uhr, Attrappe reagiert auf `signal` --- */
  {
    const timer = []
    const geloescht = []
    const echt = { setTimeout: k.setTimeout, clearTimeout: k.clearTimeout }
    k.setTimeout = (fn, ms) => { timer.push([fn, ms]); return timer.length }
    k.clearTimeout = (id) => geloescht.push(id)
    const haengt = (adresse, opt) => new Promise((_, nein) => opt.signal.addEventListener('abort', () => nein(new Error('abgebrochen'))))
    const spurA = []
    const offen = k.akNetflixUmleitungProbe('1', { fetch: haengt, profilwahl: () => false, spur: (...x) => spurA.push(x) })
    pruefe('Vorprüfung: Frist 5000 ms gesetzt', timer.length === 1 && timer[0][1] === 5000, timer.map((t) => t[1]))
    timer[0][0]()
    pruefe('Vorprüfung: nach der Frist abgebrochen = kein Urteil', (await offen) === false && /abgebrochen/.test(spurA[0]?.[1]?.text ?? ''), spurA)
    pruefe('Vorprüfung: der Timer wird auch nach dem Abbruch gelöscht', JSON.stringify(geloescht) === '[1]', geloescht)
    timer.length = 0
    geloescht.length = 0
    const gut = await k.akNetflixUmleitungProbe('1', { fetch: async () => antwort('/browse', true), profilwahl: () => false, spur: () => {} })
    pruefe('Vorprüfung: Antwort vor der Frist = Urteil, Timer gelöscht', gut === true && JSON.stringify(geloescht) === '[1]', geloescht)
    k.setTimeout = echt.setTimeout
    k.clearTimeout = echt.clearTimeout
  }

  /* --- Verdrahtung in melder.js: die echte Zeile `const nichtDaTun = …` läuft mit Attrappen --- */
  const melderText = lies('melder.js')
  const zeileNichtDa = melderText.split('\n').find((z) => z.startsWith('const nichtDaTun = '))
  pruefe('melder.js: Zeile der Verdrahtung gefunden', Boolean(zeileNichtDa))
  const verdrahtet = (o = {}) => {
    k.akNetflixNichtDa().clear() // Beginn eines Durchgangs: die Urteile des vorigen Laufs gehen
    const w = { melden: [], abrufe: [], weiter: [], gehe: [], spur: [] }
    const welt = { selbstAn: true, profil: false, antwort: antwort('/browse', true), ...o }
    const tunW = new Function('akNetflixNichtDaTun', 'totMelden', 'offeneTitel', 'selbstUebersprungen', 'spur', 'gehe', 'selbstWeiter', 'selbstAn', 'bremse', 'akProfilwahlSeite', 'document', 'fetch', 'fertig', 'verbindungLebt', `${zeileNichtDa}\nreturn nichtDaTun`)(
      k.akNetflixNichtDaTun,
      async (...a) => { w.melden.push(a); return { ok: true, text: 'ok' } },
      { 5: { titel: 'Fünf' } },
      welt.uebersprungen ?? new Map(),
      (...a) => w.spur.push(a),
      (p) => w.gehe.push(p),
      (...a) => w.weiter.push(a),
      welt.selbstAn,
      welt.bremse ?? neu(),
      () => welt.profil,
      { marke: 'dokument' },
      async (u, i) => { w.abrufe.push([u, i.credentials, Boolean(i.signal)]); return welt.antwort },
      () => false,
      () => welt.lebt !== false,
    )
    return { w, tunW }
  }
  let v = verdrahtet()
  await v.tunW.sprung('5')
  pruefe('melder.js: Umleitung → Abruf /title/5 mit Cookies und Frist, Meldung mit Titel und Grund, selbstWeiter(1), kein gehe, Spur', JSON.stringify(v.w.abrufe) === '[["/title/5","same-origin",true]]' && JSON.stringify(v.w.melden) === '[["5","Fünf","Umleitung auf Startseite"]]' && JSON.stringify(v.w.weiter) === '[[1,true,"5"]]' && v.w.gehe.length === 0 && v.w.spur.some((s) => s[0] === 'nicht bei Netflix gemeldet' && s[1].reihe === '5'), v.w)
  v = verdrahtet({ lebt: false })
  await v.tunW.sprung('5')
  pruefe('melder.js: bei totem Kontext keine Anfrage bei Netflix (Vorprüfung)', v.w.abrufe.length === 0, v.w)
  v = verdrahtet({ profil: true })
  await v.tunW.sprung('5')
  pruefe('melder.js: Profilauswahl sichtbar → kein Abruf, kein Urteil, der Sprung geht (gehe)', v.w.abrufe.length === 0 && v.w.melden.length === 0 && JSON.stringify(v.w.gehe) === '["/title/5"]', v.w)
  v = verdrahtet({ selbstAn: false })
  await v.tunW.sprung('5')
  pruefe('melder.js: Durchgang aus → weder Urteil noch Sprung noch weiter', v.w.melden.length + v.w.weiter.length + v.w.gehe.length === 0, v.w)
  v = verdrahtet({ antwort: antwort('/title/5', false) })
  await v.tunW.sprung('5')
  pruefe('melder.js: keine Umleitung → gehe /title/5, nichts gemeldet', JSON.stringify(v.w.gehe) === '["/title/5"]' && v.w.melden.length === 0 && v.w.weiter.length === 0, v.w)
  const bM = neu()
  v = verdrahtet({ bremse: bM })
  await v.tunW.sprung('5')
  pruefe('melder.js: der Beleg landet an der bremse des Melders', ui(bM, '5').nd.length === 1)
  const uM = new Map()
  v = verdrahtet({ uebersprungen: uM })
  v.w.melden.length = 0
  await new Function('akNetflixNichtDaTun', 'totMelden', 'offeneTitel', 'selbstUebersprungen', 'spur', 'gehe', 'selbstWeiter', 'selbstAn', 'bremse', 'akProfilwahlSeite', 'document', 'fetch', 'fertig', 'verbindungLebt', `${zeileNichtDa}\nreturn nichtDaTun.urteil('5', 'Grund')`)(
    k.akNetflixNichtDaTun, async () => ({ ok: false, text: 'x' }), {}, uM, () => {}, () => {}, () => {}, true, neu(), () => false, {}, async () => antwort('/browse', true), () => false, () => true)
  pruefe('melder.js: scheitert totMelden, landet der Titel in selbstUebersprungen', uM.get('5') === 'Grund', [...uM])

  /* --- totMelden: der Grund steht in der Notiz, ohne Grund die Knopf-Notiz --- */
  const totMeldenText = (() => {
    const von = melderText.indexOf('async function totMelden(')
    return melderText.slice(von, melderText.indexOf('\n}\n', von) + 3)
  })()
  const tot = async (grund) => {
    const gesendet = []
    const g = { akKontext: { lesen: async () => ({ token: 'T' }), keinTokenText: () => 'kein Token' }, akNetflixTotGemeldet: async () => {} }
    const res = await new Function('globalThis', 'WORKER', 'titelIdFuer', 'beobachtung', 'fetch', 'frischGemeldetNetflix', 'merkeTot', `${totMeldenText}\nreturn totMelden('5', 'Fünf', ${JSON.stringify(grund)})`)(
      g, 'https://worker.test/', () => 'tid', () => ({}), async (u, o) => { gesendet.push(JSON.parse(o.body)); return { ok: true } }, null, null)
    return { res, notiz: gesendet[0]?.notiz }
  }
  let tm = await tot('Umleitung auf Startseite')
  pruefe('totMelden mit Grund: die Notiz nennt den Grund', tm.res.ok === true && tm.notiz === 'Vom Durchgang als nicht bei Netflix gemeldet — Umleitung auf Startseite', tm)
  tm = await tot(undefined)
  pruefe('totMelden ohne Grund: die Notiz des Knopfes', /^Aus der Übersicht als toter Verweis gemeldet/.test(tm.notiz), tm)

  /* --- Ende des Durchgangs: Vorgabe für `nichtDa` ist die Sitzungs-Map --- */
  const sitzung = { akProtokoll: () => {} }
  new Function('globalThis', lies('netflix-uebernahme.js'))(sitzung)
  sitzung.akNetflixNichtDa().set('5', 'Umleitung auf Startseite')
  const ende = sitzung.akNetflixEnde('x', new Map(), new Set(), 3, {}, new Set())
  pruefe('akNetflixEnde ohne 8. Argument nimmt die Urteile der Sitzung (nicht rot, nichtDa 1)', ende.zaehlung.nichtDa === 1 && ende.rot === false && /nicht bei Netflix 1/.test(ende.text), ende)

  /* --- ohne Tonspur: die Zählung selbst, und die Aufrufstelle im Durchlauf --- */
  let dl = { stoerung: 'UI3012' }
  k.akNetflixOhneSpurZaehlen(dl)
  pruefe('ohne Tonspur zählt nicht bei einer Netflix-Störung', dl.ohneSpur === undefined, dl)
  dl = { stoerung: null }
  k.akNetflixOhneSpurZaehlen(dl)
  k.akNetflixOhneSpurZaehlen(dl)
  pruefe('ohne Tonspur ohne Störung: zählt hoch', dl.ohneSpur === 2, dl)
  pruefe('melder.js: der Durchlauf ruft akNetflixOhneSpurZaehlen(DURCHLAUF) in der Zweigstelle „keine Tonspur“', /else if \(!spuren\) \{[\s\S]{0,1200}?akNetflixOhneSpurZaehlen\(DURCHLAUF\)/.test(melderText) && !/DURCHLAUF\.ohneSpur = /.test(melderText.replace(/DURCHLAUF\.ohneSpur = null/g, '')))

  /* --- Start eines Durchgangs: die Urteile des vorigen Laufs gehen (Zählung des Endberichts) --- */
  const karte = k.akNetflixZurueckNeu({}, () => false, { speicher: { get: async () => ({}), set: async () => {} }, jetzt: () => T0, datum: () => null })
  k.akNetflixNichtDa().set('77', 'Umleitung auf Startseite')
  pruefe('Vorbedingung: ein Urteil des vorigen Laufs steht da', k.akNetflixNichtDa().size >= 1)
  karte.clear()
  pruefe('selbstUebersprungen.clear() (Start eines Durchgangs) leert auch die Urteile', k.akNetflixNichtDa().size === 0, [...k.akNetflixNichtDa()])

  if (fehler.length) {
    console.log(`\n${fehler.length} Fall/Fälle rot`)
    process.exit(1)
  }
  console.log('\nNetflix nicht bei Netflix: alle Fälle grün')
})()
