/**
 * **Erscheint die Prüfliste auf einer Netflix-Titelseite?**
 *
 * Der Knopf unten rechts („Anime-Kalender N") ist der einzige Einstieg in die
 * Liste. Am 06.09.2026 fehlte er dreimal hintereinander auf Daniels Bildschirm,
 * und die Fehlersuche lief jedes Mal über Vermutungen: die Liste sei leer, die
 * Erweiterung nicht neu geladen, der Knopf vom Netflix-Overlay verdeckt.
 *
 * Keine davon ließ sich prüfen, weil `melder.js` nur im Browser lief. Dieser
 * Sandkasten stellt so viel Netflix nach, wie das Skript zum Starten braucht —
 * DOM, `chrome.storage`, `fetch` — und beantwortet die eine Frage: Entsteht der
 * Knopf?
 *
 * Geprüft wird mit der **echten** `offene-netflix.js`, also mit dem Stand, den
 * die Erweiterung ausliefert. Was hier grün ist, kann auf der Seite immer noch
 * verdeckt sein; was hier rot ist, kann dort gar nicht erscheinen.
 */
const { readFileSync } = require('node:fs')
const { ladeSkripte, skripteBis } = require('./test-lader.cjs')
const vm = require('node:vm')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}

/** Ein Element, das nur kann, was `melder.js` von ihm verlangt. */
function macheElement(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    /* Angehaengt gilt als verbunden — akBox() prueft es, seit es den Kasten merkt. */
    isConnected: true,
    className: '',
    id: '',
    hidden: false,
    disabled: false,
    textContent: '',
    title: '',
    style: {},
    dataset: {},
    kinder: [],
    classList: {
      _: new Set(),
      add(...n) { n.forEach((x) => this._.add(x)) },
      remove(...n) { n.forEach((x) => this._.delete(x)) },
      toggle(n, an) { if (an) this._.add(n); else this._.delete(n) },
      contains(n) { return this._.has(n) },
    },
    appendChild(k) { this.kinder.push(k); return k },
    append(...k) { this.kinder.push(...k) },
    /* Die Tabelle der Zurückgestellten zeichnet ihren Rumpf damit neu (netflix-liste-ansicht.js). */
    replaceChildren(...k) { this.kinder = k },
    get children() { return this.kinder },
    insertBefore(k, vor) {
      const i = vor ? this.kinder.indexOf(vor) : -1
      if (i < 0) this.kinder.push(k)
      else this.kinder.splice(i, 0, k)
      return k
    },
    /*
      `contains` ist der Griff, mit dem `uebersichtZeigen()` seit dem 06.09.2026
      fragt, ob sein Knopf noch im Dokument hängt. Fehlt er hier, wirft der
      Aufruf, der Takt fängt es ab — und der Test meldet „blieb weg", obwohl der
      Fix greift. Dieselbe Falle wie bei `window.addEventListener` weiter unten.
    */
    contains(k) {
      if (!k) return false
      return this.kinder.some((x) => x === k || (typeof x.contains === 'function' && x.contains(k)))
    },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    /*
      **Sucht wirklich** — seit dem 10.09.2026 baut box.js einen Kasten mit
      Zeilen und Fuss, und der Melder haengt seine Knoepfe ueber querySelector
      hinein. Ein querySelector, der immer null gibt, laesst alles leer.
    */
    querySelector(sel) {
      const klasse = String(sel).trim().split(/\s+/).pop().replace(/^\./, '')
      for (const k of this.kinder ?? []) {
        if (String(k?.className ?? '').split(/\s+/).includes(klasse)) return k
        const tiefer = k?.querySelector?.(sel)
        if (tiefer) return tiefer
      }
      return null
    },
    /* Nur reine Klassenlisten („.a, .b“), wie sie die Sperre in netflix-liste-ansicht.js fragt; alles andere bleibt leer. */
    querySelectorAll(sel) {
      const klassen = String(sel).split(',').map((s) => /^\.([\w-]+)$/.exec(s.trim())?.[1])
      if (klassen.some((k) => !k)) return []
      const treffer = []
      const suchen = (el) => {
        for (const k of el.kinder ?? []) {
          if (klassen.some((c) => String(k?.className ?? '').split(/\s+/).includes(c))) treffer.push(k)
          suchen(k)
        }
      }
      suchen(this)
      return treffer
    },
    setAttribute() {},
    getAttribute() { return null },
    closest() { return null },
    click() {},
    focus() {},
    insertAdjacentHTML() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 } },
  }
}

/**
 * Netflix so weit nachstellen, dass `melder.js` startet.
 *
 * Alles, was hier fehlt, fällt beim Laden als `ReferenceError` auf — und genau
 * das ist der Zweck: Ein Skript, das im Sandkasten nicht durchläuft, läuft auch
 * im Browser nicht durch.
 */
function baueUmgebung(pfad, suche = '', start = {}) {
  const body = macheElement('body')
  /** Alles, was das Skript per setInterval anmeldet — der Test löst es selbst aus. */
  const takte = []
  const doc = {
    body,
    head: macheElement('head'),
    documentElement: macheElement('html'),
    readyState: 'complete',
    title: 'Fate/Grand Order — Netflix',
    createElement: macheElement,
    createTextNode: (t) => ({ textContent: t }),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true },
    /*
      **Sucht wirklich** — seit dem 10.09.2026 baut box.js einen Kasten mit
      Zeilen und Fuss, und der Melder haengt seine Knoepfe ueber querySelector
      hinein. Ein querySelector, der immer null gibt, laesst alles leer.
    */
    querySelector(sel) {
      const klasse = String(sel).trim().split(/\s+/).pop().replace(/^\./, '')
      for (const k of this.kinder ?? []) {
        if (String(k?.className ?? '').split(/\s+/).includes(klasse)) return k
        const tiefer = k?.querySelector?.(sel)
        if (tiefer) return tiefer
      }
      return null
    },
    querySelectorAll() { return [] },
    getElementById() { return null },
    contains: (k) => body.contains(k),
  }
  /* Eigene Wurzeln hängen an <html> (akWurzelAnhaengen); die Sucher des Tests lesen den body. */
  doc.documentElement.appendChild = (k) => body.appendChild(k)
  const speicher = { ...start }
  const chrome = {
    storage: {
      local: {
        get: async (k) => (typeof k === 'string' ? { [k]: speicher[k] } : { ...speicher }),
        set: async (o) => Object.assign(speicher, o),
      },
      sync: {
        get: async () => ({ token: 'test-token' }),
        set: async () => {},
      },
      /* `melder.js` hört auf Änderungen am Speicher — ohne das bricht es ab. */
      onChanged: { addListener() {}, removeListener() {} },
    },
    runtime: { getURL: (p) => p, id: 'test', onMessage: { addListener() {} } },
  }
  const umgebung = {
    document: doc,
    location: { pathname: pfad, search: suche, href: 'https://www.netflix.com' + pfad + suche, hostname: 'www.netflix.com' },
    navigator: { userAgent: 'test' },
    chrome,
    console,
    /*
      **Der Takt wird gesammelt, nicht verworfen.**

      Ein Sandkasten ohne Takt prüft nur den Zustand direkt nach dem Laden —
      und genau dort war nie etwas kaputt. Die Callbacks landen deshalb in
      einer Liste, die der Test von Hand auslösen kann.
    */
    setInterval: (fn) => {
      if (typeof fn === 'function') takte.push(fn)
      return takte.length
    },
    clearInterval: () => {},
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0 },
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => { fn(); return 0 },
    fetch: async () => ({ ok: true, json: async () => ({ anbieter: [] }), text: async () => '' }),
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i?.detail } },
    URL,
    URLSearchParams,
    Date,
    JSON,
    Math,
    Promise,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Set,
    WeakMap,
    Map,
    Error,
    RegExp,
    isNaN,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
  }
  /*
    Auch `window` hört zu. Ohne diese drei Zeilen bricht `melder.js` mit
    „window.addEventListener is not a function" ab — und ein Sandkasten, der an
    seiner eigenen Umgebung scheitert, verdeckt genau den Fehler, den er finden
    soll (dieselbe Falle wie bei `URLSearchParams` am 28.08.2026).
  */
  umgebung.addEventListener = () => {}
  umgebung.removeEventListener = () => {}
  umgebung.dispatchEvent = () => true
  umgebung.window = umgebung
  umgebung.globalThis = umgebung
  umgebung.self = umgebung
  return { umgebung, body, takte }
}

/**
 * @param liste Ersetzt die ausgelieferte Auftragsliste. Wird gebraucht, um den
 *   leeren Fall zu prüfen, ohne dass die Zusicherung am Datenstand hängt.
 */
function lade(pfad, liste, suchteil = '', start = {}) {
  const { umgebung, body, takte } = baueUmgebung(pfad, suchteil, start)
  const kontext = vm.createContext(umgebung)
  /* `box.js` lädt im Browser vor `melder.js` — hier genauso, sonst fehlt akBox(). */
  ladeSkripte(kontext, skripteBis('melder.js', { nur: ['kontext.js', 'box.js', 'offene-netflix.js', 'netflix-zurueckgestellt.js', 'netflix-liste-ansicht.js', 'netflix-erinnern.js', 'netflix-durchgang-steuerung.js', 'netflix-staffel.js', 'netflix-uebernahme.js', 'netflix-stand.js', 'netflix-seitentreue.js', 'netflix-staffelzaehlung.js'] }))
  if (liste) umgebung.AK_OFFENE_TITEL = liste
  let fehler = null
  try {
    ladeSkripte(kontext, ['melder.js'])
  } catch (e) {
    fehler = e
  }
  return { umgebung, body, fehler, takte }
}

/** Sucht rekursiv nach einem Element mit dieser Klasse. */
function suche(el, klasse) {
  if (!el) return null
  if (String(el.className ?? '').split(/\s+/).includes(klasse)) return el
  for (const k of el.kinder ?? []) {
    const t = suche(k, klasse)
    if (t) return t
  }
  return null
}

/** Die Klassen jeder Listenzeile (`ak-zeile`) in Anzeigereihenfolge. */
function zeilenKlassen(body) {
  const klassen = []
  const sammle = (el) => {
    if (String(el?.className).split(/\s+/).includes('ak-zeile')) klassen.push([...el.classList._])
    for (const k of el?.kinder ?? []) sammle(k)
  }
  sammle(body)
  return klassen
}

/** Alle Elemente unter `el`, in Dokumentreihenfolge. */
function alleElemente(el, alle = []) {
  alle.push(el)
  for (const k of el?.kinder ?? []) alleElemente(k, alle)
  return alle
}

/**
 * Eigene Ansicht (15.11.2026): Knopf mit Zahl, Zeile in der Liste markiert (dort ausgeblendet) und ans Ende sortiert,
 * dazu die Tabelle hinter der Liste mit genau diesem Titel; ein Klick darauf merkt den geöffneten Auftrag.
 */
async function pruefeZurueckZeilen(body, umgebung) {
  const alle = alleElemente(body)
  const zeilen = alle.filter((el) => String(el.className).split(/\s+/).includes('ak-zeile'))
  const markiert = zeilen.filter((z) => z.classList.contains('ak-zurueck'))
  pruefe('zurückgestellt: genau eine von drei Zeilen trägt ak-zurueck, und es ist die letzte', zeilen.length === 3 && markiert.length === 1 && zeilen[2] === markiert[0], zeilen.map((z) => [...z.classList._]))
  const knoepfe = alle.filter((el) => /zurückgestellt/.test(el.textContent) && !(el.kinder ?? []).length)
  pruefe('zurückgestellt: genau ein Knopf „1 zurückgestellt“, sonst nennt nichts die Zahl', knoepfe.length === 1 && knoepfe[0].textContent === '1 zurückgestellt' && knoepfe[0].tagName === 'BUTTON', knoepfe.map((el) => el.textContent))
  const kasten = suche(body, 'ak-kasten')
  pruefe('Kasten: Kopf, Liste, dahinter die Ansicht der Zurückgestellten', kasten?.kinder.map((k) => k.className).join(' | ') === 'ak-kopf ak-kopf-zeilen | ak-liste | ak-zurueck-ansicht', kasten?.kinder.map((k) => k.className))
  const unten = suche(body, 'ak-kopf-unten')
  pruefe('Kopf: das Suchfeld steht ganz links, der Durchgang gleich daneben', unten?.kinder[0]?.className === 'ak-suche' && /alle durchgehen/.test(String(unten?.kinder[1]?.textContent)), unten?.kinder.map((k) => k.className + ':' + k.textContent))
  pruefe('Kopf: ohne laufenden Durchgang ist der Knopf nicht hervorgehoben und sagt, was er tut', unten?.kinder[1]?.className === 'ak-umschalter' && /^Geht alle offenen Titel/.test(String(unten?.kinder[1]?.title)), [unten?.kinder[1]?.className, unten?.kinder[1]?.title])
  const links = alleElemente(suche(body, 'ak-zurueck-ansicht')).filter((el) => el.tagName === 'A')
  pruefe('Tabelle: genau der zurückgestellte Titel, mit Verweis auf seine Titelseite', links.length === 1 && links[0].href === 'https://www.netflix.com/title/80243876', links.map((l) => l.href))
  const grund = alleElemente(suche(body, 'ak-zurueck-ansicht')).filter((el) => el.className === 'ak-zurueck-grund')
  pruefe('Tabelle: der Grund aus der Merkliste steht in der Zeile', grund.length === 1 && grund[0].textContent === 'Erinnern statt Folgenliste', grund.map((g) => g.textContent))
  links[0].closest = () => links[0]
  vm.runInContext('akKlickVerteilen', vm.createContext(umgebung))({ target: links[0] })
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r))
  const gemerkt = (await umgebung.chrome.storage.local.get('zuletztGeoeffnet')).zuletztGeoeffnet
  pruefe('Tabelle: ein Klick auf den Titel merkt ihn als zuletzt geöffnet', gemerkt?.id === '80243876', gemerkt)
}

console.log('Netflix-Prüfliste: erscheint der Knopf?\n')

/**
 * **Die Kulisse, gegen die gezählt wird — nicht die ausgelieferte Liste.**
 *
 * Am 06.09.2026 hat ein Datenlauf die letzten Netflix-Meldungen übernommen, und
 * `offene-netflix.js` fiel auf **null** Aufträge. Drei Zusicherungen wurden rot,
 * weil die Arbeit erledigt war — genau der Fehler, den `CLAUDE.md` seit dem
 * 25.08.2026 beschreibt („Eine Prüfung, die rot wird, weil die Arbeit erledigt
 * ist, misst das Falsche"), und er stand hier schon wieder drin.
 *
 * Die Kulisse bildet Daniels Fall nach: drei Titel, einer davon mit drei
 * Staffeln. Damit sind Titelzahl (3) und Staffelzahl (5) verschieden — sonst
 * würde die Gegenprobe unten nichts unterscheiden.
 */
const KULISSE = {
  '70302573': {
    titel: 'Sword Art Online',
    staffeln: [
      { nr: 1, folgen: 25, film: false, offen: true },
      { nr: 2, folgen: 24, film: false, offen: true },
      { nr: 3, folgen: 24, film: false, offen: true },
    ],
  },
  '80243876': { titel: 'Berserk', staffeln: [{ nr: 1, folgen: 25, film: false, offen: true }] },
  '81186100': { titel: 'Testreihe', staffeln: [{ nr: 1, folgen: 12, film: false, offen: true }] },
}

/* Die ausgelieferte Liste wird gelesen, aber nicht auf Inhalt geprüft — leer ist
   dort der Normalfall am Ende der Arbeit. */
const auftraege = JSON.parse(
  readFileSync(__dirname + '/offene-netflix.js', 'utf8').replace(/^[^{]*/, '').replace(/;\s*$/, ''),
)
pruefe(
  'die ausgelieferte Liste parst als JSON',
  auftraege && typeof auftraege === 'object',
  typeof auftraege,
)

const titelseite = lade('/title/81186100', KULISSE)
pruefe('melder.js läuft auf einer Titelseite durch', !titelseite.fehler, titelseite.fehler?.message)

/*
  Der Knopf entsteht asynchron: `uebersichtZeigen()` hängt an `erledigtGeladen`,
  und das kommt aus `chrome.storage`. Ein Durchlauf der Microtask-Warteschlange
  genügt — im Browser sind es Millisekunden.
*/
;(async () => {
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))

  const knopf = suche(titelseite.body, 'ak-uebersicht')
  pruefe(
    'der Prüflisten-Knopf steht auf der Titelseite',
    Boolean(knopf),
    titelseite.body.kinder.map((k) => k.className),
  )
  if (knopf) {
    pruefe(
      'er nennt die Zahl der offenen Aufträge',
      /Anime-Kalender/.test(String(knopf.textContent)),
      knopf.textContent,
    )
  }

  /*
    **Der Fall, an dem die erste Fassung dieses Tests vorbeigemessen hat.**

    Netflix ist eine Einseiten-Anwendung und baut Teile des `body` neu auf, ohne
    dass sich der Pfad ändert. Nimmt jemand den Knopf dabei mit, muss der
    nächste Takt ihn wieder anhängen — die Bedingung `if (!uebersichtKnopf)`
    tat das nicht, denn die Variable zeigte weiter auf das herausgelöste
    Element.

    Der Test nimmt den Knopf deshalb selbst heraus und ruft die Zeichenfunktion
    erneut auf. Ein Test, der nur den frisch geladenen Zustand prüft, trifft
    genau die Hälfte des Lebens, in der ohnehin alles stimmt.
  */
  if (knopf) {
    titelseite.body.kinder = titelseite.body.kinder.filter((k) => k !== knopf)
    for (const takt of titelseite.takte) {
      try {
        takt()
      } catch {
        /* Ein Takt, der stolpert, hält den Test nicht auf. */
      }
    }
    const wieder = suche(titelseite.body, 'ak-uebersicht')
    pruefe(
      'nach einem Umbau der Seite kommt der Knopf zurück',
      Boolean(wieder),
      'nach dem Entfernen blieb er weg',
    )
  }

  /**
   * **Auch ohne einen einzigen Auftrag steht der Knopf da.**
   *
   * Daniel am 06.09.2026, nachdem ein Datenlauf die letzten Netflix-Meldungen
   * übernommen hatte und der Knopf verschwunden war: „wenn 0 einträge, dann
   * prüfliste button trotzdem anzeigen mit 'alles gemeldet'". Ein Knopf, der an
   * einem Tag da ist und am nächsten fehlt, sieht aus wie eine kaputte
   * Erweiterung — und genau danach hat er an diesem Abend viermal gesucht.
   *
   * Geprüft wird mit einer **leeren** Liste, nicht mit der ausgelieferten:
   * Sonst hinge die Zusicherung am Datenstand und würde rot, sobald wieder
   * Aufträge da sind (CLAUDE.md, 25.08.2026).
   */
  {
    const leer = lade('/title/81186100', {})
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))
    const k = suche(leer.body, 'ak-uebersicht')
    pruefe('ohne Aufträge steht der Knopf trotzdem da', Boolean(k), 'kein Knopf bei leerer Liste')
    if (k) {
      pruefe(
        'und er sagt „Alles gemeldet"',
        /Alles gemeldet/.test(String(k.textContent)),
        k.textContent,
      )
    }
  }

  /* Im Player bleibt die Erweiterung unsichtbar — Daniels Vorgabe vom 22.08.2026. */
  const player = lade('/watch/81186102', KULISSE)
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
  pruefe('im Player erscheint kein Knopf', !suche(player.body, 'ak-uebersicht'), 'Knopf im Player gefunden')

  /**
   * **Auch mit Auftrag zeigt der Player nichts** (Daniel, 09.10.2026: der Kasten „Folge 4: deutsche
   * Tonspur gefunden · Als deutsch melden" oben links soll weg). `?ak=1` ist der Auftrag, mit dem
   * der Durchlauf in den Player springt — vor 4.24.18 baute der Takt dann `.ak-player-anzeige`.
   * Die Erkennung läuft unabhängig davon: Der Durchlauf liest die Tonspuren und meldet über
   * `durchlaufMelden()`; geprüft wird, dass die Meldung mit der deutschen Spur den Worker erreicht.
   */
  {
    const auftrag = lade('/watch/81186102', KULISSE, '?ak=1')
    pruefe('Player mit Auftrag: melder.js läuft durch', !auftrag.fehler, auftrag.fehler?.message)
    const gesendet = []
    auftrag.umgebung.fetch = async (url, opt) => {
      gesendet.push({ url, body: opt?.body ? JSON.parse(opt.body) : null })
      return { ok: true, json: async () => ({}), text: async () => '' }
    }
    for (let i = 0; i < 3; i++) {
      for (const takt of auftrag.takte) {
        try { takt() } catch { /* ein stolpernder Takt hält den Test nicht auf */ }
      }
      await new Promise((r) => setImmediate(r))
    }
    const anzeige = (el) => String(el.className ?? '').includes('ak-player') || (el.kinder ?? []).some(anzeige)
    pruefe('Player mit Auftrag: keine Anzeige, kein Knopf', !anzeige(auftrag.body), auftrag.body.kinder.map((k) => k.className))

    const ok = await vm.runInContext(
      `durchlaufMelden({ videoId: 81186103, nummer: 4, titel: 'Test' }, [{ code: 'de', name: 'Deutsch' }], true)`,
      vm.createContext(auftrag.umgebung),
    ).then(() => true, (e) => e.message)
    const meldung = gesendet.find((g) => g.body?.plattform === 'netflix')
    pruefe('Player mit Auftrag: der Durchlauf erzeugt die Meldung weiter', ok === true && Boolean(meldung), ok)
    pruefe('… mit der deutschen Tonspur', meldung?.body?.sprachen?.includes('de|Deutsch'), meldung?.body?.sprachen)
  }

  /**
   * **Der Knopf zählt Titel — dasselbe wie die Kopfzeile der Liste.**
   *
   * Am 06.09.2026 stand auf Daniels Bildschirm „3 Titel zu prüfen" über einem
   * Knopf mit der Zahl 5: Der Knopf zählte offene Staffelkürzel (Berserk 1 +
   * Fate 1 + Sword Art Online 3), die Kopfzeile Titel. Beide Rechnungen waren
   * schon zweimal angeglichen worden (26.08. und 30.08.2026) und beide Male
   * wieder auseinandergelaufen; seitdem lesen sie aus **einer** Funktion.
   *
   * Gezählt wird gegen die **geladene** Liste, nicht gegen eine feste Zahl —
   * eine Zusicherung, die vom Datenstand abhängt, wird rot, sobald die Arbeit
   * erledigt ist (CLAUDE.md, 25.08.2026).
   */
  if (knopf) {
    const titelZahl = Object.keys(KULISSE).length
    const staffelZahl = Object.values(KULISSE).reduce((n, e) => n + (e.staffeln?.length || 1), 0)
    const amKnopf = Number(/(\d+)/.exec(String(knopf.textContent))?.[1] ?? NaN)
    pruefe(
      'der Knopf nennt die Zahl der Titel, nicht die der Staffeln',
      amKnopf === titelZahl,
      { amKnopf, titelZahl, staffelZahl, text: knopf.textContent },
    )
    /* Die Gegenprobe trägt nur, solange sich beide Zahlen unterscheiden. */
    if (staffelZahl !== titelZahl) {
      pruefe(
        'die Staffelzahl steht nicht am Knopf',
        amKnopf !== staffelZahl,
        { amKnopf, staffelZahl },
      )
    }
  }

  /*
    **Eine Staffel, die es beim Anbieter nicht gibt — und nur sie.**

    Daniel am 06.09.2026: „prüfliste fragt nach s3, netflix hat keine s3, was
    jetzt?" Der Knopf am Zeilenende meint den ganzen Verweis; dieser hier meint
    eine Staffel und meldet deshalb **titelgenau**. Geprüft wird der Quelltext,
    weil die Kachel nur mit passenden Aufträgen entsteht — was hier zählt, ist
    die Bedingung davor und das, was mitgeschickt wird.
  */
  {
    const q = readFileSync(__dirname + '/melder.js', 'utf8')
    pruefe(
      'der Staffel-Knopf verlangt eine aufgelöste Titel-Kennung',
      q.includes('const staffelTitelId = titelIdFuer(id, st.nr)') &&
        q.includes('if (staffelTitelId && staffeln.length > 1'),
    )
    const fn = q.slice(q.indexOf('async function staffelWegMelden'), q.indexOf('async function totMelden'))
    pruefe(
      'er meldet titelgenau, nicht über die Adresse',
      fn.includes('titelId,') && fn.includes('staffel: Number(st.nr)'),
    )
    pruefe('und mit demselben Befund wie ein toter Verweis', fn.includes('...beobachtung(false)'))
    pruefe('er fragt einmal nach, bevor er streicht', q.includes("weg.dataset.sicher !== 'ja'"))
    /*
      **Und was über die Zählung des Anbieters hinausgeht, trägt seinen Namen.**

      Die Liste hängt seit dem 09.09.2026 Einträge an, die der Anbieter nicht als
      Staffel führt (). Eine Nummer wäre dort eine Erfindung.
    */
    pruefe(
      'ein Eintrag außerhalb der Anbieter-Zählung zeigt seinen Namen',
      q.includes('st.ausserhalb && st.name'),
    )
  }
  {
    /*
      **Jede Rohfolge trägt ihre Beobachtung** (Stufe 1, Migration 035). Am
      22.09.2026 kamen 8 Netflix-Rohfolgen mit leerem `vorhanden`/`ton_de` an —
      die Meldung trug beides, die Rohfolge daneben nicht.
    */
    for (const datei of ['melder.js', 'disney.js']) {
      const q = readFileSync(`${__dirname}/${datei}`, 'utf8')
      const bloecke = q.split('rohfolgen: [').slice(1).map((b) => b.slice(0, b.search(/\n\s*\],/)))
      pruefe(
        `${datei}: jede Rohfolge trägt vorhanden/ton_de (${bloecke.length} Stellen)`,
        bloecke.length > 0 && bloecke.every((b) => /\.\.\.beobachtung\(|vorhanden:/.test(b)),
        bloecke.map((b) => b.slice(0, 80)),
      )
    }
  }
  /**
   * **Zurückgestellt zählt nicht als offen** (F135 C, Daniel 14.11.2026): Berserk ist bis in ferne Zukunft zurückgestellt
   * (`netflixZurueckgestellt` im Speicher), die beiden anderen Titel sind offen. Knopf und Kopfzeile der Liste nennen dieselbe Zahl.
   */
  {
    const bis = Number.MAX_SAFE_INTEGER
    const zurueck = lade('/title/81186100', KULISSE, '', { netflixZurueckgestellt: { 80243876: { grund: 'Erinnern statt Folgenliste', bis } } })
    for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r))
    const zknopf = suche(zurueck.body, 'ak-uebersicht')
    pruefe('zurückgestellt: der Knopf zählt 2 offene Titel (3 in der Liste, Berserk zurückgestellt)', Number(/(\d+)/.exec(String(zknopf?.textContent))?.[1]) === 2, zknopf?.textContent)
    await vm.runInContext('dialogOeffnen()', vm.createContext(zurueck.umgebung))
    const kopfzeile = (function finde(el) {
      if (String(el?.tagName) === 'STRONG' && /Titel zu prüfen|Alles geprüft/.test(String(el.textContent))) return el
      for (const k of el?.kinder ?? []) {
        const t = finde(k)
        if (t) return t
      }
      return null
    })(zurueck.body)
    pruefe('zurückgestellt: die Überschrift der Liste sagt „2 Titel zu prüfen“', kopfzeile?.textContent === '2 Titel zu prüfen', kopfzeile?.textContent)
    const gemeldetKnopf = (function finde(el) {
      if (/^\d+ gemeldet$/.test(String(el?.textContent ?? '')) && !(el.kinder ?? []).length) return el
      for (const k of el?.kinder ?? []) {
        const t = finde(k)
        if (t) return t
      }
      return null
    })(zurueck.body)
    pruefe('zurückgestellt: ein zurückgestellter Titel zählt nicht als „gemeldet“ (kein Knopf „N gemeldet“)', gemeldetKnopf === null, gemeldetKnopf?.textContent)
    pruefe('ohne Gemeldetes steht keine „nächste Übernahme“ im Kopf', suche(zurueck.body, 'ak-lauf') === null)
    await pruefeZurueckZeilen(zurueck.body, zurueck.umgebung)
  }
  /* Ein anderer Tab führt den Durchgang (4071, Schnitt 2): die echte Prüfliste ist gesperrt, der Titel-Verweis bleibt klickbar und schreibt nur den Klick-Eintrag mit der Kennung dieses Tabs. */
  {
    const bis = Number.MAX_SAFE_INTEGER
    const start = { netflixZurueckgestellt: { 80243876: { grund: 'Erinnern statt Folgenliste', bis } }, netflixDurchgangBesitzer: { tab: 'anderer-tab', puls: Date.now() } } // uhr-echt: der Melder prüft den Puls gegen seine echte Uhr
    const fremd = lade('/title/81186100', KULISSE, '', start)
    for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r))
    await vm.runInContext('dialogOeffnen()', vm.createContext(fremd.umgebung))
    const alle = alleElemente(fremd.body)
    const durchgang = alle.find((el) => el.className === 'ak-umschalter')
    pruefe('fremder Durchgang: der Durchgangs-Knopf ist gesperrt und sagt, wo er läuft', durchgang?.disabled === true && /anderen Tab/.test(String(durchgang?.textContent)), [durchgang?.disabled, durchgang?.textContent])
    pruefe('fremder Durchgang: ein Satz im Kopf sagt, warum', alle.some((el) => /anderen Tab/.test(String(el.textContent)) && !(el.kinder ?? []).length && el !== durchgang))
    const sperren = alle.filter((el) => ['ak-tot', 'ak-staffel-weg'].some((k) => String(el.className).split(/\s+/).includes(k)))
    pruefe('fremder Durchgang: „nichts da?“ und „Staffel melden“ sind gesperrt', sperren.length > 0 && sperren.every((el) => el.disabled === true), sperren.map((el) => [el.className, el.disabled]))
    const link = alleElemente(suche(fremd.body, 'ak-zurueck-ansicht')).find((el) => el.tagName === 'A')
    link.closest = () => link
    const vorher = Object.keys(await fremd.umgebung.chrome.storage.local.get(null))
    vm.runInContext('akKlickVerteilen', vm.createContext(fremd.umgebung))({ target: link })
    for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r))
    const gespeichert = await fremd.umgebung.chrome.storage.local.get(null)
    pruefe('fremder Durchgang: der Titel-Verweis bleibt klickbar und schreibt nur zuletztGeoeffnet, mit Tab-Kennung', gespeichert.zuletztGeoeffnet?.id === '80243876' && typeof gespeichert.zuletztGeoeffnet?.tab === 'string' && gespeichert.zuletztGeoeffnet.tab !== 'anderer-tab' && Object.keys(gespeichert).filter((k) => !vorher.includes(k)).join() === 'zuletztGeoeffnet', gespeichert)
  }
  /* Genau ein gemeldeter Titel (Testreihe, „tot“), einer zurückgestellt (Berserk), einer offen: „1 gemeldet zeigen“, nicht 2 und nicht keiner. */
  {
    const bis = Number.MAX_SAFE_INTEGER
    const einer = lade('/title/81186100', KULISSE, '', {
      erledigt: { 81186100: ['tot'] },
      netflixZurueckgestellt: { 80243876: { grund: 'Erinnern statt Folgenliste', bis } },
    })
    for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r))
    await vm.runInContext('dialogOeffnen()', vm.createContext(einer.umgebung))
    const texte = []
    const sammle = (el) => {
      texte.push(String(el?.textContent ?? ''))
      for (const k of el?.kinder ?? []) sammle(k)
    }
    sammle(einer.body)
    pruefe('1 gemeldet, 1 zurückgestellt, 1 offen: Überschrift „1 Titel zu prüfen“, Knopf „1 zurückgestellt“', texte.includes('1 Titel zu prüfen') && texte.includes('1 zurückgestellt'), texte.filter((t) => /zu prüfen|zurückgestellt/.test(t) && t.length < 60))
    pruefe('… und der Schalter „1 gemeldet“', texte.includes('1 gemeldet'), texte.filter((t) => /gemeldet/.test(t) && t.length < 40))
    const lauf = suche(einer.body, 'ak-lauf')
    pruefe('… und oben „nächste Übernahme: <Uhrzeit>“ (Minute 23 des Datenlaufs)', /^nächste Übernahme: (\d{1,2}\.\d{1,2}\. )?\d\d:23$/.test(String(lauf?.textContent)), lauf?.textContent)
    const folge = zeilenKlassen(einer.body)
    pruefe('Reihenfolge: offen, dann zurückgestellt, dann gemeldet', folge.length === 3 && !folge[0].includes('ak-zurueck') && !folge[0].includes('ak-abgehakt') && folge[1].includes('ak-zurueck') && folge[2].includes('ak-abgehakt'), folge)
  }
  /* Ohne zurückgestellte Titel gibt es weder Filterknopf noch markierte Zeile. */
  {
    const keiner = lade('/title/81186100', KULISSE)
    for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r))
    await vm.runInContext('dialogOeffnen()', vm.createContext(keiner.umgebung))
    const texte = []
    const sammle = (el) => {
      texte.push(String(el?.textContent ?? ''))
      for (const k of el?.kinder ?? []) sammle(k)
    }
    sammle(keiner.body)
    pruefe('ohne zurückgestellte Titel: kein Knopf „N zurückgestellt“ und keine Tabelle', !texte.some((t) => /^\d+ zurückgestellt/.test(t)) && suche(keiner.body, 'ak-zurueck-ansicht') === null, texte.filter((t) => /zurückgestellt/.test(t)))
    pruefe('ohne zurückgestellte Titel: keine Zeile mit ak-zurueck', zeilenKlassen(keiner.body).length === 3 && zeilenKlassen(keiner.body).every((k) => !k.includes('ak-zurueck')), zeilenKlassen(keiner.body))
  }
  /* Verdrahtung (15.11.2026): das ganze melder.js meldet die gespeicherte Zurückstellung an den Worker; ohne `worker` an der Merkliste bliebe es stumm. */
  {
    const bis = Number.MAX_SAFE_INTEGER
    const gespeichert = { 80243876: { grund: 'Erinnern statt Folgenliste', bis } }
    const meldung = lade('/title/81186100', KULISSE, '', { netflixZurueckgestellt: gespeichert })
    const posts = []
    const standard = meldung.umgebung.fetch
    meldung.umgebung.fetch = async (adresse, init) => {
      if (init?.method === 'POST' && String(adresse).includes('zurueck=1')) posts.push({ adresse, init })
      return standard(adresse, init)
    }
    for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r))
    pruefe('melder.js: genau ein POST /pruefung?zurueck=1 an den Worker', posts.length === 1 && posts[0].adresse === 'https://newsletter.animekalender.workers.dev/pruefung?zurueck=1', posts.map((p) => p.adresse))
    pruefe('melder.js: der POST trägt den Token der Erweiterung und die Zurückstellung', posts[0]?.init.headers['X-Lauf-Token'] === 'test-token' && JSON.parse(posts[0].init.body).eintraege['80243876']?.grund === 'Erinnern statt Folgenliste', posts[0]?.init)
  }
  /*
    Der Stand liegt im Speicher (4059, 16.11.2026): Dialog auf und zu löst nie einen Abruf aus (bei 100 und 230 Titeln); „↻“ genau einen,
    der Stand bleibt dabei stehen; ein Worker ohne Sammelroute (403/404/405) löst den Rückfall je Reihe aus, 429/5xx nicht.
  */
  {
    const letzter = (seite) => seite.body.kinder.filter((k) => k.className === 'ak-dialog').pop()
    const hat = (el, klasse) => alleElemente(el).some((x) => String(x.className).split(/\s+/).includes(klasse))
    const finde = (el, klasse) => alleElemente(el).find((x) => String(x.className).split(/\s+/).includes(klasse))
    const warten = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)) }
    const klickAuf = (seite, ziel) => {
      ziel.closest = () => ziel
      vm.runInContext('akKlickVerteilen', vm.createContext(seite.umgebung))({ target: ziel })
    }
    const oeffnen = async (seite) => {
      klickAuf(seite, suche(seite.body, 'ak-uebersicht'))
      await warten()
    }
    const baue = async (n, antwort) => {
      const liste = {}
      for (let i = 0; i < n; i++) liste[String(70000000 + i)] = { titel: `Titel ${i}`, staffeln: [{ nr: 1, folgen: 1, film: false, offen: true }] }
      const seite = lade('/title/70000000', liste)
      await warten()
      const abfragen = []
      seite.umgebung.fetch = async (adresse) => {
        const a = String(adresse)
        if (!a.includes('gemeldet')) return { ok: true, json: async () => ({}), text: async () => '' }
        abfragen.push(a)
        return antwort(a)
      }
      return { seite, abfragen }
    }
    const sammelAntwort = (n) => ({ ok: true, json: async () => ({ adressen: { 'https://www.netflix.com/title/70000000': { paare: [{ nummer: 1, staffel: 1, am: '2026-11-16' }] } } }) })

    for (const n of [100, 230]) {
      const { seite, abfragen } = await baue(n, async () => sammelAntwort(n))
      for (let i = 0; i < 10; i++) {
        await oeffnen(seite)
        await oeffnen(seite)
      }
      pruefe(`Stand im Speicher: zehnmal Dialog auf und zu bei ${n} Titeln: 0 Abrufe`, abfragen.length === 0, abfragen.length)
      await oeffnen(seite)
      const knopf = finde(letzter(seite), 'ak-stand-knopf')
      pruefe(`Dialog bei ${n} Titeln: „Stand“ und ↻ stehen im Kopf, noch ohne Stand`, Boolean(knopf) && finde(letzter(seite), 'ak-stand-text')?.textContent === 'noch kein Stand', finde(letzter(seite), 'ak-stand-text')?.textContent)
      const fertige = (el) => alleElemente(el).filter((x) => String(x.className).split(/\s+/).includes('ak-fertig')).length
      const vorher = fertige(letzter(seite))
      klickAuf(seite, knopf)
      await warten()
      pruefe(`↻ bei ${n} Titeln: die Antwort erreicht die Zeile (vorher kein, danach genau ein Kürzel ak-fertig)`, vorher === 0 && fertige(letzter(seite)) === 1, [vorher, fertige(letzter(seite))])
      pruefe(`↻ bei ${n} Titeln: genau ein Abruf, die Sammelroute`, abfragen.length === 1 && abfragen[0].includes('gemeldet-liste='), abfragen.length)
      pruefe(`↻ bei ${n} Titeln: danach „Stand von HH:MM“, weiter ${n} Zeilen`, /^Stand von \d\d:\d\d$/.test(String(finde(letzter(seite), 'ak-stand-text')?.textContent)) && alleElemente(letzter(seite)).filter((x) => String(x.className).split(/\s+/).includes('ak-zeile')).length === n, finde(letzter(seite), 'ak-stand-text')?.textContent)
    }

    /* Während des Abrufs bleibt der alte Stand stehen; der Knopf zeigt „…“ und ist gesperrt. */
    {
      let freigeben
      const spaet = new Promise((r) => { freigeben = r })
      const { seite, abfragen } = await baue(2, async () => (await spaet, sammelAntwort(2)))
      await oeffnen(seite)
      klickAuf(seite, finde(letzter(seite), 'ak-stand-knopf'))
      await warten()
      const mitten = letzter(seite)
      pruefe('Abruf läuft: Knopf „…“ und gesperrt, Zeilen und Stand bleiben stehen', finde(mitten, 'ak-stand-knopf')?.textContent === '…' && finde(mitten, 'ak-stand-knopf')?.disabled === true && finde(mitten, 'ak-stand-text')?.textContent === 'noch kein Stand' && alleElemente(mitten).filter((x) => String(x.className).split(/\s+/).includes('ak-zeile')).length === 2, [finde(mitten, 'ak-stand-knopf')?.textContent, abfragen.length])
      freigeben()
      await warten()
      pruefe('Abruf fertig: Knopf wieder „↻“', finde(letzter(seite), 'ak-stand-knopf')?.textContent === '↻')
    }

    for (const [status, fallback] of [[429, false], [500, false], [403, true], [404, true], [405, true]]) {
      const f = await baue(2, async (a) => (a.includes('gemeldet-liste') ? { ok: false, status, json: async () => ({}) } : { ok: true, json: async () => ({ paare: [] }) }))
      await oeffnen(f.seite)
      klickAuf(f.seite, finde(letzter(f.seite), 'ak-stand-knopf'))
      await warten()
      pruefe(`↻, Sammelroute antwortet ${status}: ${fallback ? 'Rückfall auf eine Anfrage je Reihe (1 + 2)' : 'keine Einzelanfragen, lokaler Stand'}`, f.abfragen.length === (fallback ? 3 : 1), f.abfragen.length)
    }
  }
  const schlecht = faelle.filter((x) => !x).length
  console.log(schlecht ? `\n${schlecht} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.')
  process.exit(schlecht ? 1 : 0)
})()
