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
const k = { globalThis: null, console, AbortController, URL, setTimeout, clearTimeout }
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
const filmTakt = (merkmale, zeit, wartet = { seite: '70023531', seit: T0 }) => {
  const z = { spuren: [], weiter: 0, uebersprungen: new Map(), stoerung: 0, geladen: 0 }
  const o = { seite: '70023531', reihe: '70023531', film: true, erinnern: false, frist: 20000, jetzt: T0 + zeit, durchlauf: { folgen: [{ film: true }], listeFuer: null }, merkmale: () => merkmale }
  const tun = {
    spur: (...a) => z.spuren.push(a),
    uebersprungen: z.uebersprungen,
    weiter: () => z.weiter++,
    bremse: { stoerung: () => z.stoerung++, ok() {} },
    vollLaden: { versucht: () => false, laden: () => z.geladen++ },
  }
  z.rest = k.akNetflixListeWarten(wartet, o, tun)
  return z
}

/* --- a: Film, Titeladresse zeigt die Startseite --- */
let z = filmTakt(startseite, 3000)
pruefe('a: nach 3 s noch keine Entscheidung (Schonzeit), kein Weitergehen', z.weiter === 0 && z.uebersprungen.size === 0 && !z.rest.entschieden && !z.rest.filmFrei, z.rest)
z = filmTakt(startseite, 9000)
pruefe('a: nach der Schonzeit zurückgestellt, mit Grund in der Liste', z.weiter === 1 && z.uebersprungen.get('70023531') === 'Titelfenster ohne Inhalt, Film nicht im Player geprüft', [...z.uebersprungen])
pruefe('a: nicht als Störung der Sitzung gebucht, nicht voll geladen, nicht frei für den Player', z.stoerung === 0 && z.geladen === 0 && !z.rest.filmFrei && z.rest.entschieden === true, z)
pruefe('a: kein Urteil „nicht bei Netflix“ (nichts Meldendes im Ablauf)', !z.spuren.some((s) => /nicht bei Netflix/.test(String(s[0]))), z.spuren)
const wieder = filmTakt(startseite, 12000, z.rest)
pruefe('a: ein entschiedener Film wird nicht noch einmal weitergereicht', wieder.weiter === 0 && wieder.rest.entschieden === true)
z = filmTakt(mitInhalt, 1000)
pruefe('a: zeigt die Seite den Titel, ist der Film frei für den Player', z.rest.filmFrei === true && z.weiter === 0 && z.uebersprungen.size === 0, z.rest)

/* --- b: laufende Frist sichtbar --- */
pruefe('b: Film wartet auf den Titel, mit Sekunden und Frist', k.akNetflixWartetText({ seite: 'x', seit: T0, film: true, frist: 8000 }, T0 + 3400) === 'wartet auf den Titel, 3 von 8 s', k.akNetflixWartetText({ seite: 'x', seit: T0, film: true, frist: 8000 }, T0 + 3400))
pruefe('b: Serie wartet auf die Folgenliste, 12 von 20 s', k.akNetflixWartetText({ seite: 'x', seit: T0, frist: 20000 }, T0 + 12100) === 'wartet auf die Folgenliste, 12 von 20 s')
pruefe('b: über der Frist bleibt die Zahl bei der Frist', k.akNetflixWartetText({ seite: 'x', seit: T0, frist: 20000 }, T0 + 25000) === 'wartet auf die Folgenliste, 20 von 20 s')
pruefe('b: ohne Warten oder nach der Entscheidung kein Text', k.akNetflixWartetText(null, T0) === '' && k.akNetflixWartetText({ seite: 'x', seit: T0, entschieden: true, frist: 8000 }, T0 + 1000) === '')
const f = k.akNetflixFortschritt(2, 5, 'Appleseed', 0, 'wartet auf den Titel, 3 von 8 s')
pruefe('b: die Fortschrittszeile trägt den Wartetext', f.text === 'Durchgang: 1 von 5 geprüft · gerade: Appleseed · wartet auf den Titel, 3 von 8 s', f.text)
pruefe('b: Takt-Ergebnis trägt die Frist des Wartens (Film 8 s, Serie 20 s)', filmTakt(startseite, 3000).rest.frist === 8000 && k.akNetflixListeWarten({ seite: 's', seit: T0 }, { seite: 's', reihe: 's', erinnern: false, frist: 20000, jetzt: T0 + 2000, durchlauf: { folgen: [], listeFuer: null }, merkmale: () => null }, { spur() {}, uebersprungen: new Map(), weiter() {} }).frist === 20000)

/* --- c: kein zweiter Versuch über den gescheiterten Weg --- */
{
  const s = speicherNeu()
  pruefe('c: der erste Weg in den Player ist frei', k.akNetflixFilmVersuch('70023531', s) === false)
  pruefe('c: derselbe Film im selben Durchgang noch einmal: nein', k.akNetflixFilmVersuch('70023531', s) === true)
  pruefe('c: ein anderer Film ist frei', k.akNetflixFilmVersuch('70000001', s) === false)
  k.akNetflixZaehlerSetze(0, 5, s)
  pruefe('c: ein neuer Durchgang (Zähler 0) vergisst die Versuche', k.akNetflixFilmVersuch('70023531', s) === false)
}
{
  /* Im Takt: Film mit Titelinhalt, zweiter Besuch derselben Titelseite im selben Durchgang (der Player lieferte nichts). */
  k.sessionStorage = speicherNeu()
  const takt = (erledigt) => {
    const z = { weiter: 0, uebersprungen: new Map() }
    const o = { seite: '70023531', reihe: '70023531', film: true, erledigt, frist: 20000, jetzt: T0 + 1000, durchlauf: { folgen: [{ film: true }], listeFuer: null }, merkmale: () => mitInhalt }
    z.rest = k.akNetflixListeWarten({ seite: '70023531', seit: T0 }, o, { spur() {}, uebersprungen: z.uebersprungen, weiter: () => z.weiter++ })
    return z
  }
  const erst = takt(false)
  pruefe('c: erster Besuch: der Film geht in den Player', erst.rest.filmFrei === true && erst.weiter === 0, erst.rest)
  const zweit = takt(false)
  pruefe('c: zweiter Besuch, Film noch offen: kein Player, zurückgestellt mit Grund, weiter', !zweit.rest.filmFrei && zweit.rest.entschieden === true && zweit.weiter === 1 && zweit.uebersprungen.get('70023531') === 'Player ohne Ergebnis, nicht erneut versucht', [zweit.rest, [...zweit.uebersprungen]])
  const geklappt = takt(true)
  pruefe('c: zweiter Besuch nach geglückter Messung (nicht mehr offen): normaler Weg, nichts zurückgestellt', geklappt.rest.filmFrei === true && geklappt.uebersprungen.size === 0 && geklappt.weiter === 0, geklappt.rest)
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

/* --- Verdrahtung in melder.js --- */
{
  const melder = lies('melder.js')
  const start = melder.slice(melder.indexOf('async function selbstStartenSchritt'), melder.indexOf('async function selbstSammeln'))
  pruefe('Verdrahtung: ein Film wartet über akNetflixListeWarten (film: filmHier), bis seine Seite Inhalt zeigt', /filmHier && !selbstWartet\?\.filmFrei/.test(start) && /film: filmHier/.test(start))
  pruefe('Verdrahtung: der Takt kennt, ob der Film laut Prüfliste noch offen ist (zweiter Weg in den Player)', /erledigt: filmHier && fertig\(reihe/.test(start))
  pruefe('Verdrahtung: besucht kommt aus dem Besuchtzähler, nicht aus Sprüngen plus Rückgaben', /akNetflixBesuchtStand\(\)/.test(melder) && !/selbstGezaehlt \+ akNetflixErledigtStand\(\)/.test(melder) && /undefined, null, hierAuftrag\)/.test(melder))
}

if (fehler.length) {
  console.log(`\n${fehler.length} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('\nAlle Prüfungen bestanden.')
