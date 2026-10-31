/**
 * Melde-Knopf nach „gemeldet ✓" (4.31.7, 16.10.2026): nicht mehr klickbar, ein zweiter Klick meldet nichts.
 *
 * Anlass: Daniel, Prime, Arifureta — Staffel 1 (grün, Deutsch) und Staffel 2 (rot, „nicht mehr verfügbar") ließen
 * sich nach der Meldung erneut melden; der Knopf wurde nach 1,2 s wieder freigegeben und der Takt beschriftete ihn neu.
 * Gespielt wird der echte Code: `melde-sperre.js` und die Verdrahtung aus `amazon.js`, `adn.js`, `disney.js`,
 * `melder.js` (Netflix), je mit einem nachgebauten Knopf.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const lies = (datei) => readFileSync(__dirname + '/' + datei, 'utf8')
const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Ein Knopf mit dem, was die Sperre anfasst. */
function knopfNeu() {
  const attribute = new Map()
  return {
    dataset: {},
    style: { display: '' },
    disabled: false,
    textContent: 'noch nicht gemeldet',
    onclick: null,
    isConnected: true,
    className: '',
    setAttribute: (k, v) => attribute.set(k, String(v)),
    removeAttribute: (k) => attribute.delete(k),
    getAttribute: (k) => attribute.get(k) ?? null,
  }
}

const sperreCode = lies('melde-sperre.js')
function weltNeu(zusatz = {}) {
  const uhr = { t: 1_700_000_000_000 }
  class Uhr extends Date {
    static now() {
      return uhr.t
    }
  }
  const k = { Date: Uhr, String, Number, Boolean, Object, JSON, ...zusatz }
  k.globalThis = k
  vm.createContext(k)
  vm.runInContext(sperreCode, k)
  return { k, uhr }
}

console.log('Melde-Knopf: Sperre nach angekommener Meldung\n')

/* --- Der gemeinsame Helfer ------------------------------------------------ */
{
  const { k, uhr } = weltNeu()
  const S = k.AK_MELDE_SPERRE
  const knopf = knopfNeu()
  const m = new Map()
  pruefe('ohne Meldung: frei', S.anwenden(knopf, m, 'a|true', uhr.t, true) === 'frei' && !knopf.disabled)
  S.sperren(m, 'a|true', uhr.t)
  pruefe('nach der Meldung: gesperrt, disabled und aria-disabled, Beschriftung „gemeldet ✓"',
    S.anwenden(knopf, m, 'a|true', uhr.t, true) === 'gesperrt' &&
      knopf.disabled &&
      knopf.getAttribute('aria-disabled') === 'true' &&
      knopf.textContent === 'gemeldet ✓',
    { disabled: knopf.disabled, aria: knopf.getAttribute('aria-disabled'), text: knopf.textContent })
  pruefe('anderer Befund (andere Seite oder anderes Tonurteil): frei',
    S.anwenden(knopf, m, 'b|true', uhr.t, true) === 'frei',
  )
  pruefe('… aber a|true bleibt gemerkt: A → B → A ist wieder gesperrt',
    m.has('a|true') && S.anwenden(knopf, m, 'a|true', uhr.t, true) === 'gesperrt' && knopf.disabled)
  const m2 = new Map()
  S.sperren(m2, 'a|false', uhr.t)
  pruefe('Tonurteil gekippt (nicht → Deutsch): frei', S.zustand(m2, 'a|true', uhr.t, true) === 'frei')
  S.sperren(m2, 'a|true', uhr.t)
  pruefe('mehrere Befunde zugleich gemerkt, Frist je Befund (ältester abgelaufen, jüngster nicht)',
    S.zustand(m2, 'a|false', uhr.t + S.FRIST_MS + 1000, false) === 'abgelaufen' &&
      S.zustand(m2, 'a|true', uhr.t + S.FRIST_MS - 1000, false) === 'gesperrt')
  S.anwenden(knopf, m2, 'a|false', uhr.t + S.FRIST_MS + 1000, false)
  pruefe('abgelaufen: der Befund wird vergessen, der andere bleibt', !m2.has('a|false') && m2.has('a|true'))

  /* Änderung wird spätestens nach FRIST_MS sichtbar: kam die Meldung nicht an, geht der Knopf wieder auf. */
  S.sperren(m, 'c|true', uhr.t)
  pruefe('nicht angekommen, vor der Frist: gesperrt (Briefkasten hält die Edge bis zu 2 h)',
    S.zustand(m, 'c|true', uhr.t + S.FRIST_MS - 1000, false) === 'gesperrt')
  pruefe('nicht angekommen, nach der Frist: abgelaufen (erneut melden erlaubt)',
    S.zustand(m, 'c|true', uhr.t + S.FRIST_MS + 1000, false) === 'abgelaufen')
  pruefe('angekommen: bleibt gesperrt, egal wie spät',
    S.zustand(m, 'c|true', uhr.t + 10 * S.FRIST_MS, true) === 'gesperrt')

  const klick = () => {}
  S.setzeKlick(knopf, klick)
  pruefe('setzeKlick mit Handler: klickbar', !knopf.disabled && knopf.getAttribute('aria-disabled') === 'false' && knopf.onclick === klick)
  S.setzeKlick(knopf, null)
  pruefe('setzeKlick ohne Handler: gesperrt, aria-disabled', knopf.disabled && knopf.getAttribute('aria-disabled') === 'true' && knopf.onclick === null)
}

/* --- Frist und Briefkasten: „nicht da“ zählt erst nach dem Höchstalter des Edge-Caches (Prüfer, 1397, Auflage C) --- */
{
  const { k } = weltNeu()
  const worker = readFileSync(__dirname + '/../worker/src/pruefung-zaehlen.ts', 'utf8')
  const sekunden = Number(/export const ZAEHLEN_SEKUNDEN = (\d+)/.exec(worker)?.[1])
  pruefe('ZAEHLEN_SEKUNDEN im Worker gefunden', sekunden > 0, sekunden)
  pruefe('FRIST_MS deckt das Cache-Alter von ?zaehlen=1 plus 5 min', k.AK_MELDE_SPERRE.FRIST_MS >= (sekunden + 300) * 1000,
    { FRIST_MS: k.AK_MELDE_SPERRE.FRIST_MS, sekunden })
  /* Auflage E: der Cache des zaehlen-Zweigs endet an der Konstante, nicht an einer Zahl an der Aufrufstelle. */
  const lesen = readFileSync(__dirname + '/../worker/src/pruefung-lesen.ts', 'utf8')
  const zweig = /get\('zaehlen'\) === '1'\) return ausCache\(async \(\) => \{[\s\S]*?\}, ([^)]*)\)/.exec(lesen)
  pruefe('zaehlen-Zweig in pruefung-lesen.ts endet mit ZAEHLEN_SEKUNDEN', zweig?.[1] === 'ZAEHLEN_SEKUNDEN', zweig?.[1])
  const m = new Map([['a|true', 0]])
  pruefe('nicht angekommen: spätestens ZAEHLEN_SEKUNDEN + 15 min danach wieder frei',
    k.AK_MELDE_SPERRE.zustand(m, 'a|true', (sekunden + 900) * 1000, false) === 'abgelaufen')
  /* Kennung nicht lesbar: mit Briefkasten-Antwort „nicht da“ (false), ohne sie unbekannt (null) — Auflage D. */
  const wirft = () => { throw new Error('weg') }
  const belegt = k.AK_MELDUNG_BELEGT
  pruefe('Kennung wirft, Briefkasten ohne die Adresse: false',
    belegt('u', wirft, new Set(['x', 'y']), new Set(['A'])) === false, belegt('u', wirft, new Set(['x', 'y']), new Set(['A'])))
  pruefe('Kennung wirft, keine Briefkasten-Antwort: null', belegt('u', wirft, null, null) === null, belegt('u', wirft, null, null))
  pruefe('Kennung lesbar, keine Briefkasten-Antwort: null', belegt('u', () => 'A', null, null) === null, belegt('u', () => 'A', null, null))
  pruefe('Kennung wirft, Briefkasten führt die Adresse: true', belegt('u', wirft, new Set(['x', 'u', 'y']), null) === true)
}

/* --- Prime: die Verdrahtung aus amazon.js ---------------------------------- */
{
  const quelle = lies('amazon.js')
  const von = quelle.indexOf('  // Sperre nach angekommener Meldung')
  const bis = quelle.indexOf('  function zeichnenRoh() {')
  pruefe('Verdrahtung in amazon.js gefunden', von > 0 && bis > von)

  const zustand = { pfad: '/gp/video/detail/B0STAFFEL1', staffel: '1', deutsch: true, angekommen: true, roh: 0 }
  const knopf = knopfNeu()
  const { k, uhr } = weltNeu({
    knopf,
    listenId: 'B0STAFFEL1',
    location: {
      get pathname() {
        return zustand.pfad
      },
    },
    deutschInFolgen: () => zustand.deutsch,
    staffelSchluessel: () => zustand.staffel,
    liste: { B0STAFFEL1: { url: 'https://www.amazon.de/dp/B0STAFFEL1' } },
    asin: () => null,
    briefkastenAdressen: { has: () => zustand.angekommen },
    briefkastenSeiten: null,
    letzterStand: 'x',
    speicherLesen: async () => ({}),
    speicherSchreiben: async () => true,
    /* Der Takt: beschriftet den Knopf aus „vielen Zweigen" und gibt ihn frei — wie die Zweige in amazon.js. */
    zeichnenRoh: () => {
      zustand.roh++
      knopf.disabled = false
      knopf.style.display = ''
      knopf.textContent = zustand.deutsch ? '🇩🇪 Deutsch · 12 Folgen · melden' : '✕ in dieser Region nicht mehr verfügbar — melden'
    },
  })
  vm.runInContext(sperreCode, k)
  vm.runInContext(quelle.slice(von, bis).replace(/\bconst meldeSperre\b/, 'var meldeSperre'), k)

  k.zeichnen()
  pruefe('vor der Meldung: Knopf klickbar', !knopf.disabled && knopf.textContent.endsWith('melden'), knopf.textContent)
  pruefe('… und der Takt vergisst seinen Stand nicht ohne Grund (sonst rechnet er jeden Takt neu)', k.letzterStand === 'x')

  /* Der Handler, wie er an den Knopf gehängt wird: Erfolg → vermerken. */
  let meldungen = 0
  const klick = vm.runInContext('meldeSperre.mitSperre', k)(() => {
    meldungen++
    vm.runInContext('meldeSperre.vermerken()', k)
  })
  klick()
  pruefe('erster Klick meldet', meldungen === 1)

  /* Der 1,2-s-Timer aus amazon.js: Freigabe, Stand vergessen, neu zeichnen. */
  knopf.disabled = false
  k.letzterStand = ''
  k.zeichnen()
  pruefe('Staffel 1 (grün): nach der Meldung gesperrt trotz Freigabe und Neuzeichnen',
    knopf.disabled && knopf.getAttribute('aria-disabled') === 'true' && knopf.textContent === 'gemeldet ✓',
    { disabled: knopf.disabled, text: knopf.textContent })
  klick()
  pruefe('zweiter Klick löst keine Meldung aus', meldungen === 1, meldungen)
  for (let i = 0; i < 5; i++) k.zeichnen()
  pruefe('auch viele Takte später gesperrt', knopf.disabled && klick() === undefined && meldungen === 1)

  /* Staffel 2 (rot, „nicht mehr verfügbar"): anderer Befund, wird neu gemeldet und gesperrt. */
  k.letzterStand = 'stand-staffel-1'
  zustand.pfad = '/gp/video/detail/B0STAFFEL2'
  zustand.deutsch = false
  k.zeichnen()
  pruefe('andere Staffel: Knopf wieder frei und neu beschriftet',
    !knopf.disabled && knopf.getAttribute('aria-disabled') === null && knopf.textContent.includes('nicht mehr verfügbar'),
    knopf.textContent)
  pruefe('… und letzterStand wurde vergessen (sonst bliebe „gemeldet ✓" stehen)', k.letzterStand === '')
  klick()
  pruefe('Staffel 2: Klick meldet', meldungen === 2, meldungen)
  k.zeichnen()
  klick()
  pruefe('Staffel 2: nach der Meldung gesperrt, zweiter Klick meldet nichts',
    knopf.disabled && meldungen === 2 && knopf.getAttribute('aria-disabled') === 'true',
    meldungen)

  /* Dasselbe Tonurteil, andere Seite: auch das ist ein neuer Befund. */
  zustand.pfad = '/gp/video/detail/B0STAFFEL3'
  k.zeichnen()
  pruefe('andere Seite bei gleichem Tonurteil: frei', !knopf.disabled)
  zustand.pfad = '/gp/video/detail/B0STAFFEL2'
  k.zeichnen()
  /* Dieselbe Adresse, andere Staffelnummer im Quelltext (Kanal-Titel): ebenfalls neu. */
  klick()
  zustand.staffel = '2'
  k.zeichnen()
  pruefe('andere Staffelnummer bei gleicher Adresse und gleichem Ton: frei', !knopf.disabled)
  /* Angekommen: die Sperre hält auch weit über die Frist hinaus. */
  klick()
  uhr.t += 300_000
  k.zeichnen()
  pruefe('angekommen: nach 300 s weiter gesperrt', knopf.disabled && knopf.getAttribute('aria-disabled') === 'true')
  /* Tonurteil kippt auf derselben Seite (mehr Folgen geladen): neue Meldung erlaubt. */
  zustand.deutsch = true
  k.zeichnen()
  pruefe('anderer Ton-Befund auf derselben Seite: frei', !knopf.disabled)

  /* Meldung kam nicht an: nach der Frist wieder melden, vorher nicht. */
  klick()
  k.letzterStand = 'stand-vor-frist'
  zustand.angekommen = false
  uhr.t += 60_000
  k.zeichnen()
  pruefe('nicht angekommen, nach 60 s: noch gesperrt', knopf.disabled)
  uhr.t += 2 * 3600_000 - 61_000
  k.zeichnen()
  pruefe('nicht angekommen, knapp 2 h (Briefkasten aus dem Edge-Cache): noch gesperrt', knopf.disabled)
  uhr.t += k.AK_MELDE_SPERRE.FRIST_MS - 2 * 3600_000 + 2000
  k.zeichnen()
  pruefe('nicht angekommen, nach FRIST_MS: Knopf wieder frei (Frist)', !knopf.disabled && k.letzterStand === '')

  /* Hin und zurück (A → B → A): jeder schon gemeldete Befund bleibt gesperrt, der neue bleibt meldbar. */
  zustand.angekommen = true
  zustand.deutsch = true
  zustand.staffel = '1'
  const meldeUndZeichne = () => {
    const vorher = meldungen
    klick()
    k.zeichnen()
    return meldungen - vorher
  }
  zustand.pfad = '/hinzurueck/S1'
  k.zeichnen()
  pruefe('A → B → A (Adressen): S1 meldet einmal', meldeUndZeichne() === 1 && knopf.disabled)
  zustand.pfad = '/hinzurueck/S2'
  k.zeichnen()
  pruefe('… S2 ist nach dem Wechsel meldbar (kein Falsch-Negativ)', !knopf.disabled)
  pruefe('… und meldet einmal', meldeUndZeichne() === 1 && knopf.disabled)
  zustand.pfad = '/hinzurueck/S1'
  k.zeichnen()
  pruefe('… zurück auf S1: gesperrt', knopf.disabled && knopf.getAttribute('aria-disabled') === 'true')
  pruefe('… zweiter Klick auf S1 meldet nichts', meldeUndZeichne() === 0)
  zustand.pfad = '/hinzurueck/S2'
  k.zeichnen()
  pruefe('… wieder auf S2: ebenfalls gesperrt, Klick meldet nichts', knopf.disabled && meldeUndZeichne() === 0)

  zustand.pfad = '/hinzurueck/gleiche-adresse'
  zustand.staffel = '1'
  k.zeichnen()
  pruefe('A → B → A (Staffelnummer, gleiche Adresse): Staffel 1 meldet einmal', meldeUndZeichne() === 1)
  zustand.staffel = '2'
  k.zeichnen()
  pruefe('… Staffel 2 meldbar und meldet einmal', !knopf.disabled && meldeUndZeichne() === 1)
  zustand.staffel = '1'
  k.zeichnen()
  pruefe('… zurück auf Staffel 1: gesperrt, Klick meldet nichts', knopf.disabled && meldeUndZeichne() === 0)

  zustand.pfad = '/hinzurueck/ton'
  zustand.staffel = '1'
  zustand.deutsch = true
  k.zeichnen()
  pruefe('A → B → A (Tonurteil): Deutsch meldet einmal', meldeUndZeichne() === 1)
  zustand.deutsch = false
  k.zeichnen()
  pruefe('… Tonurteil „nein" ist ein neuer Befund: meldbar, meldet einmal', !knopf.disabled && meldeUndZeichne() === 1)
  zustand.deutsch = true
  k.zeichnen()
  pruefe('… zurück auf Deutsch: gesperrt, Klick meldet nichts', knopf.disabled && meldeUndZeichne() === 0)
  /* Ein Tonurteil, das nur kurz kippt (leerer Schnappschuss), ohne dass dort gemeldet wurde. */
  zustand.pfad = '/hinzurueck/ton-kurz'
  k.zeichnen()
  pruefe('Tonurteil kippt kurz, ohne Meldung: Deutsch meldet einmal', meldeUndZeichne() === 1)
  zustand.deutsch = false
  k.zeichnen()
  zustand.deutsch = true
  k.zeichnen()
  pruefe('… nach dem Zurückkippen weiter gesperrt', knopf.disabled && meldeUndZeichne() === 0)

  /* Frist abgelaufen, noch kein Takt dazwischen: der Klick selbst darf schon melden (kam nicht an). */
  zustand.pfad = '/hinzurueck/frist'
  zustand.angekommen = false
  k.zeichnen()
  pruefe('nicht angekommen: erste Meldung', meldeUndZeichne() === 1)
  uhr.t += k.AK_MELDE_SPERRE.FRIST_MS + 1000
  pruefe('… nach der Frist meldet schon der Klick, ohne Takt dazwischen', (() => {
    const vorher = meldungen
    klick()
    return meldungen - vorher
  })() === 1)

  /* Die zwei Stellen im Handler selbst: Registrierung und Vermerk nach Erfolg. */
  pruefe('der Klick-Handler ist mit der Sperre umhüllt', /knopf\.addEventListener\('click', meldeSperre\.mitSperre\(async \(befundBeimKlick\) => \{/.test(quelle))
  const erfolg = quelle.indexOf('        if (eintrag.ausSuche && !teilOffen && !erwartungNochOffen(suchAdresse)) suchauftragVergessen()')
  const vermerk = quelle.indexOf('        meldeSperre.vermerken(befundBeimKlick)')
  const fehlerzweig = quelle.indexOf("knopf.textContent = `Nicht erreichbar: ${err.message}`")
  pruefe('der Vermerk steht im Erfolgszweig (nach dem Abhaken, vor dem Fehlerzweig)', erfolg > 0 && vermerk > erfolg && vermerk < fehlerzweig, { erfolg, vermerk, fehlerzweig })
  /* Zwischen dem Abhaken und dem Vermerk darf nur Kommentar stehen: keine Steuerzeile (`if (false)`, `return`), die ihn überspringt. */
  const zwischen = quelle.slice(erfolg + '        if (eintrag.ausSuche && !teilOffen && !erwartungNochOffen(suchAdresse)) suchauftragVergessen()'.length, vermerk)
  pruefe('zwischen Abhaken und Vermerk steht nur Kommentar, nichts, was den Vermerk überspringt',
    erfolg > 0 && vermerk > erfolg && zwischen.replace(/\/\*[\s\S]*?\*\//g, '').trim() === '', zwischen)
  /* Die Marke „alles durch" (`gemeldetMarke(an, …)`) hängt an `durchFuerPfad`, nicht an einer Konstanten. */
  pruefe('die Marke folgt der Sperre und dem Pfad-Merker', quelle.includes('const an = meldeSperre.gesperrt() || durchFuerPfad === location.pathname'))
  pruefe('genau ein Vermerk und kein zweiter Weg zur Marke', (quelle.match(/meldeSperre\.vermerken\(/g) ?? []).length === 1)
  pruefe('zeichnen() läuft über die Sperre', /function zeichnen\(\) \{\s*meldeSperre\.zeichnen\(\)\s*\}/.test(quelle))
}

/* --- ADN und Disney+: „kein Klick" heißt gesperrt ---------------------------- */
function schnitt(quelle, anfang) {
  const a = quelle.indexOf(anfang)
  const b = quelle.indexOf('\n  }\n', a)
  return a < 0 || b < 0 ? '' : quelle.slice(a, b + 5)
}

{
  const quelle = lies('adn.js')
  const code = schnitt(quelle, '  function zeige(text')
  pruefe('ADN: zeige() gefunden', code.length > 0)
  const S = { knopf: null }
  const knopf = knopfNeu()
  const { k } = weltNeu({
    S,
    document: { createElement: () => knopf },
    kasten: () => ({ querySelector: () => ({ appendChild() {} }) }),
    debugZeile() {},
    prueflisteZeigen() {},
  })
  vm.runInContext(code + '\nthis.zeige = zeige', k)
  k.zeige('✓ 12 schon gemeldet', { klasse: 'gut' })
  pruefe('ADN: nach „gemeldet" (ohne Klick-Handler) gesperrt', knopf.disabled && knopf.getAttribute('aria-disabled') === 'true' && knopf.onclick === null)
  const melden = () => {}
  k.zeige('▸ 3 melden', { klick: melden })
  pruefe('ADN: mit offenen Meldungen klickbar', !knopf.disabled && knopf.onclick === melden)
  k.zeige('✓ „nicht im Angebot" gemeldet', { klasse: 'gut', klick: null })
  pruefe('ADN: nach „nicht im Angebot gemeldet" wieder gesperrt', knopf.disabled && knopf.onclick === null)
}

{
  const quelle = lies('disney.js')
  const code = schnitt(quelle, '  function zeigePruefung(text')
  pruefe('Disney+: zeigePruefung() gefunden', code.length > 0)
  const knopf = knopfNeu()
  const { k } = weltNeu({
    pruefKnopf: null,
    document: { createElement: () => knopf },
    disneyKasten: () => ({ querySelector: () => ({ appendChild() {} }) }),
    disneyDebugZeile() {},
    drehe() {},
    haltAn() {},
  })
  vm.runInContext(code + '\nthis.zeige = zeigePruefung', k)
  k.zeige('✓ S1 gemeldet (12× deutsch)', { klasse: 'gut' })
  pruefe('Disney+: nach „gemeldet" gesperrt', knopf.disabled && knopf.getAttribute('aria-disabled') === 'true' && knopf.onclick === null)
  const nochmal = () => {}
  k.zeige('3 kamen nicht an — Klick sendet sie erneut', { klasse: 'schlecht', klick: nochmal })
  pruefe('Disney+: kam etwas nicht an, ist der Knopf zum Wiederholen klickbar', !knopf.disabled && knopf.onclick === nochmal)
}

/* --- Netflix: gesendet ist nicht mehr anklickbar ------------------------------ */
{
  const quelle = lies('melder.js')
  const a = quelle.indexOf('function beschriftung(spuren) {')
  const b = quelle.indexOf('\n}\n', a)
  pruefe('Netflix: beschriftung() gefunden', a > 0 && b > a)
  const gesendet = new Map()
  const { k } = weltNeu({
    stand: { reihe: '81234', folgeNr: 3, staffel: 1, staffeln: [1, 2] },
    gesendet,
    schluessel: () => '81234|1|3',
  })
  vm.runInContext(quelle.slice(a, b + 3) + '\nthis.beschriftung = beschriftung', k)
  gesendet.set('81234|1|3', 'deutsch')
  const deutsch = k.beschriftung([])
  gesendet.set('81234|1|3', 'kein_deutsch')
  const nein = k.beschriftung([])
  pruefe('Netflix: „Deutsch gesendet ✓" nicht aktiv', deutsch.aktiv === false && deutsch.text.includes('✓'), deutsch)
  pruefe('Netflix: „Kein Deutsch gesendet ✓" nicht aktiv', nein.aktiv === false && nein.text.includes('✓'), nein)
  pruefe('Netflix: ein zweiter Auto-Start meldet nicht (gesendet.has → return)', /if \(gesendet\.has\(k\)\) return\s+gesendet\.set\(k, 'unterwegs'\)/.test(quelle))
}

/* --- Manifest: jede Gruppe mit einem Melde-Knopf lädt die Sperre vor ihm ------ */
{
  const manifest = JSON.parse(lies('manifest.json'))
  for (const skript of ['amazon.js', 'disney.js', 'adn.js']) {
    const gruppe = manifest.content_scripts.find((g) => g.js.includes(skript))
    const js = gruppe?.js ?? []
    pruefe(`Manifest: melde-sperre.js lädt vor ${skript}`, js.includes('melde-sperre.js') && js.indexOf('melde-sperre.js') < js.indexOf(skript), js)
  }
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nalle Zusicherungen erfüllt')
