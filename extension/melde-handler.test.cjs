/**
 * Der echte Klick-Handler des Prime-Melde-Knopfs (4.31.7): nur eine angekommene Meldung sperrt.
 *
 * Der Handler wird als Text aus `amazon.js` geschnitten und gegen eine Kulisse gespielt (Speicher, `fetch`,
 * Knopf, Befund); alles andere, was er anfasst, ist ein stummer Platzhalter. Nichts davon ist nachgebaut:
 * `if (antwort.ok)`, der Vermerk und der Fehlerzweig laufen so, wie sie im Code stehen.
 * Gezählt wird, ob die Seite danach gesperrt ist: ein zweiter Klick meldet nichts.
 */
const { lies, knopfNeu, handlerKompilieren, stummNeu } = require('./melde-geruest.cjs')
const vm = require('node:vm')

/** Die echte Widerspruchsregel; der Rest von `globalThis` bleibt hier stumm wie bisher. */
const regeln = { globalThis: null }
regeln.globalThis = regeln
vm.runInNewContext(lies('prime-stand.js'), regeln)
const widerspruch = regeln.akPrimeMeldungWiderspruch

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const quelle = lies('amazon.js')
const ANFANG = "knopf.addEventListener('click', meldeSperre.mitSperre(async (befundBeimKlick) => {"
const von = quelle.indexOf(ANFANG)
const bis = quelle.indexOf('\n  }))\n', von)
const handler = von < 0 || bis < 0 ? '' : quelle.slice(von + "knopf.addEventListener('click', meldeSperre.mitSperre(".length, bis + 4)
pruefe('Handler im Quelltext gefunden', handler.startsWith('async (befundBeimKlick) => {') && handler.length > 1000, handler.length)

/** Eine Seite mit dem echten Handler; `antwort` bestimmt, was der Worker auf die Meldung sagt. */
function seiteNeu(antwort) {
  const zustand = { pfad: '/dp/A', meldungen: 0, sperre: null }
  const uhr = { t: 1_700_000_000_000 }
  const k = { Date: class extends Date { static now() { return uhr.t } }, String, Number, Boolean, Object, JSON }
  k.globalThis = k
  vm.createContext(k)
  vm.runInContext(lies('melde-sperre.js'), k)
  const knopf = knopfNeu()
  const meldeSperre = k.AK_MELDE_SPERRE.fuer(knopf, {
    befund: () => zustand.pfad,
    angekommen: () => false,
    zeichneRoh: () => { knopf.disabled = false },
    standVergessen: () => {},
  })
  const ablage = new Set()
  const fetchen = []
  const echt = {
    knopf,
    meldeSperre,
    verbindungLebt: () => true,
    standGeladen: true,
    erledigt: {},
    listenId: 'LISTE',
    location: { get pathname() { return zustand.pfad } },
    staffelSchluessel: () => 's1',
    deutschInFolgen: () => true,
    geladeneFolgen: () => 12,
    sprachenAusFolgen: () => ['Deutsch'],
    seitenLage: () => ({ folgenLautSeite: 12 }),
    gesehen: { gesamt: 12, jeFolge: null },
    eintrag: { url: 'https://www.amazon.de/dp/A', titel: 'Titel' },
    quelltextVonFruehererSeite: () => false,
    titelVerlassen: null,
    document: { querySelector: () => null },
    globalThis: new Proxy(stummNeu(), { get: (stumm, name) => (name === 'akPrimeMeldungWiderspruch' ? widerspruch : stumm[name]) }),
    WORKER: 'https://worker.test/pruefung',
    chrome: { storage: { sync: { get: async () => ({ token: 'tok' }) } } },
    setTimeout: () => 0,
    fetch: (adresse, optionen) => {
      fetchen.push({ adresse, methode: optionen?.method })
      zustand.meldungen++
      return antwort(zustand)
    },
    speicherLesen: async () => ({}),
    speicherSchreiben: async () => {},
    briefkastenAdressen: ablage,
    frischGemeldet: ablage,
    uebersichtZeichnen: () => {},
    vorfallMelden: async () => {},
  }
  const { klick } = handlerKompilieren(handler, echt)
  return { knopf, zustand, uhr, meldeSperre, fetchen, klick: meldeSperre.mitSperre(klick) }
}

const antwortOk = async () => ({ ok: true, status: 200, clone() { return this }, json: async () => ({}) })
const antwort500 = async () => ({ ok: false, status: 500, clone() { return this }, json: async () => ({}) })
const antwortAusnahme = async () => { throw new Error('Netz weg') }

/** Klickt, wartet das Ende des Handlers ab und klickt noch einmal: wie viele Meldungen gingen raus? */
async function klickeZweimal(seite) {
  await seite.klick()
  const nachErstem = seite.zustand.meldungen
  seite.knopf.disabled = false
  await seite.klick()
  return { erster: nachErstem, zweiter: seite.zustand.meldungen - nachErstem }
}

async function main() {
  console.log('Melde-Handler (echter Code aus amazon.js): nur eine angekommene Meldung sperrt\n')
  {
    const s = seiteNeu(antwortOk)
    const z = await klickeZweimal(s)
    pruefe('Antwort ok: erster Klick meldet', z.erster === 1, z)
    pruefe('Antwort ok: gesperrt, der zweite Klick meldet nichts', z.zweiter === 0, z)
    pruefe('Antwort ok: der Worker bekam genau einen POST', s.fetchen.length === 1 && s.fetchen[0].methode === 'POST', s.fetchen)
  }
  {
    const s = seiteNeu(antwort500)
    const z = await klickeZweimal(s)
    pruefe('HTTP 500: Knopf nennt den Fehler', s.knopf.textContent === 'Fehler 500', s.knopf.textContent)
    pruefe('HTTP 500: nicht gesperrt, der zweite Klick meldet erneut', z.erster === 1 && z.zweiter === 1, z)
    pruefe('HTTP 500: beide Klicks gingen an den Worker', s.fetchen.length === 2)
  }
  {
    const s = seiteNeu(antwortAusnahme)
    const z = await klickeZweimal(s)
    pruefe('Ausnahme: Knopf nennt „Nicht erreichbar"', s.knopf.textContent === 'Nicht erreichbar: Netz weg', s.knopf.textContent)
    pruefe('Ausnahme: nicht gesperrt, der zweite Klick meldet erneut', z.erster === 1 && z.zweiter === 1, z)
  }
  {
    /* Erst ein Fehlschlag, dann Erfolg: der Fehlschlag hat keine Marke hinterlassen, der Erfolg setzt sie. */
    let aufruf = 0
    const s = seiteNeu(() => (++aufruf === 1 ? antwort500() : antwortOk()))
    await s.klick()
    await s.klick()
    const vorher = s.zustand.meldungen
    await s.klick()
    pruefe('erst 500, dann ok: die zweite Meldung kam durch, die dritte nicht mehr', vorher === 2 && s.zustand.meldungen === 2, s.zustand.meldungen)
  }
  {
    /* Jede angekommene Meldung sperrt ihren Befund, nicht nur die erste der Seite (A, dann B). */
    const s = seiteNeu(antwortOk)
    await s.klick()
    s.zustand.pfad = '/dp/B'
    s.knopf.disabled = false
    await s.klick()
    const nachB = s.zustand.meldungen
    await s.klick()
    pruefe('zweite Meldung der Seite (B): auch sie sperrt', nachB === 2 && s.zustand.meldungen === 2, s.zustand.meldungen)
    s.zustand.pfad = '/dp/A'
    await s.klick()
    pruefe('… und A bleibt gesperrt', s.zustand.meldungen === 2, s.zustand.meldungen)
  }
  {
    /* Befund beim Klick festgehalten: wandert die Seite während des Sendens weiter, sperrt der gemeldete Befund. */
    const s = seiteNeu(async (zustand) => {
      zustand.pfad = '/dp/B'
      return antwortOk()
    })
    await s.klick()
    pruefe('Befund ändert sich beim Senden: gemeldet wurde A', s.fetchen.length === 1)
    pruefe('… der neue Befund B ist nicht gesperrt', s.meldeSperre.mitSperre(() => 'frei')() === 'frei')
    s.zustand.pfad = '/dp/A'
    pruefe('… zurück auf A ist gesperrt (gemeldet wurde A)', s.meldeSperre.mitSperre(() => 'frei')() === undefined)
  }
  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) verletzt`)
    process.exit(1)
  }
  console.log('\nalle Zusicherungen erfüllt')
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
