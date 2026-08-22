/**
 * Einen Knopf einblenden, der die vorhandenen Tonspuren meldet.
 *
 * Warum das kein Scraper ist: Die Seite öffnet Daniel selbst. Diese Erweiterung
 * ruft nichts ab — sie liest, was der Player ohnehin geladen hat, und schickt es
 * erst auf einen Klick weg. `robots.txt` richtet sich an automatische Clients;
 * ein Mensch mit einer Erweiterung ist keiner. Ein Programm, das dieselben
 * Adressen von sich aus abklappert, wäre einer — und deshalb bleibt Netflix für
 * unsere Abrufe gesperrt.
 *
 * Der Ablauf (Daniels Zuschnitt, 21.08.2026): Zeile in der Prüfliste anklicken,
 * Folge öffnen, Knopf drücken, weiter zur nächsten.
 *
 * **Zwei Skripte, eine Aufgabe:** `leser.js` läuft in der Seitenwelt und kommt
 * an `window.netflix`; dieses hier läuft abgeschottet, hat dafür Token und
 * Netzzugriff. Verbunden sind sie über `window.postMessage`.
 */

const WORKER = 'https://newsletter.animekalender.workers.dev/pruefung'

/**
 * Audiodeskription ist keine Synchronfassung.
 *
 * Netflix führt sie in derselben Liste: „Japanisch – Audiodeskription",
 * „Französisch – Audiodeskription". Das ist eine gesprochene Bildbeschreibung
 * für Blinde, keine Übersetzung. Wer sie mitzählt, hält jede Serie mit deutscher
 * Audiodeskription für synchronisiert.
 */
const IST_BESCHREIBUNG = /audiodeskription|audio description|descriptive/i

/** Deutsch in allen Schreibweisen, die die Anbieter verwenden. */
const IST_DEUTSCH = (code, name) =>
  /^de(-|$)/i.test(String(code ?? '')) || /^deutsch|^german/i.test(String(name ?? '').trim())

// --- Was die Seite gerade hergibt -------------------------------------------

let stand = { spuren: null, reihe: null, folge: null, folgeNr: null, staffel: null, staffeln: null, serientitel: null, titel: '' }
/** Reihen, die in dieser Sitzung schon gemeldet wurden. */
const gemeldet = new Set()
/** Netzfunde, die noch nicht weitergereicht wurden. */
const funde = []

/**
 * Die Titel, bei denen eine Prüfung noch etwas bringt.
 *
 * Daniel am 22.08.2026, während er eine Serie sah: „die extension stört beim
 * gucken und will ich da nicht sehen" — kurz zuvor war ein Befund zu „Heroes"
 * angekommen, einer amerikanischen Serie.
 *
 * Ohne Treffer in dieser Liste bleibt die Erweiterung vollständig still: kein
 * Knopf, keine Meldung, keine Spur auf der Seite. Das ist der Normalfall — 256
 * Titel stehen darin, Netflix führt Zehntausende.
 *
 * Die Liste liegt im Paket (`tools/extension-offene-liste.mjs` erzeugt sie),
 * nicht im Netz: Ein Abruf je Seitenaufruf wäre Last ohne Gewinn, und die
 * Erweiterung wird ohnehin neu geladen, wenn sich etwas ändert.
 */
/**
 * Die Liste liegt als eigenes Content-Script bei und setzt `AK_OFFENE_TITEL`.
 *
 * Der erste Anlauf holte sie per `fetch(chrome.runtime.getURL(…))` — und
 * scheiterte still an Netflix' Sicherheitsregeln: Die Seite lässt keine Abrufe
 * auf `chrome-extension://` zu. Die Erweiterung blieb stumm, kein Knopf, keine
 * Meldung (Daniel, 22.08.2026, mit Bild von netflix.com/browse).
 *
 * Ein Content-Script lädt der Browser dagegen selbst, bevor die Seite etwas
 * dazu sagen kann. `offene-netflix.js` steht im Manifest **vor** dieser Datei,
 * die Liste ist hier also schon da.
 */
const offeneTitel = globalThis.AK_OFFENE_TITEL ?? {}

/** Steht dieser Titel auf der Liste? */
function istGesucht() {
  return Boolean(stand.reihe && offeneTitel && offeneTitel[String(stand.reihe)] !== undefined)
}

window.addEventListener('message', (e) => {
  if (e.source !== window) return
  if (e.data?.marke === 'ak-spuren') {
    stand = {
      spuren: e.data.spuren,
      reihe: e.data.reihe,
      folge: e.data.folge,
      folgeNr: e.data.folge_nr ?? e.data.folgeNr ?? null,
      staffel: e.data.staffel ?? null,
      staffeln: e.data.staffeln ?? null,
      serientitel: e.data.serientitel ?? null,
      titel: e.data.titel,
    }
    // Beim Wechsel auf einen Titel, der nicht auf der Liste steht, muss der
    // Knopf des vorigen weg — Netflix wechselt die Seite ohne Neuladen.
    if (!istGesucht()) {
      knopfEntfernen()
      return
    }
    knopfZeigen()
    vielleichtSenden()
    return
  }
  if (e.data?.marke === 'ak-netzfund') {
    funde.push(e.data)
    void fundSchicken(e.data)
  }
})

/**
 * Was Netflix im Hintergrund lädt, einmal je Adresse an den Kalender melden.
 *
 * Der Zweck ist eine einzige Frage: Steht in diesen Antworten schon, welche
 * Sprachen eine Reihe hat? Wenn ja, erspart das die Handarbeit — dann liest die
 * Erweiterung beim Öffnen mit, statt dass jemand jede Folge startet.
 * Geschickt werden nur Feldnamen und kurze Fundstellen, nicht die Antwort.
 */
async function fundSchicken(fund) {
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return
  try {
    await fetch(WORKER.replace('/pruefung', '/netzfund'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify(fund),
    })
  } catch {
    /* Ein Fundbericht darf nie im Weg stehen. */
  }
}

/**
 * Von selbst melden, sobald alles beisammen ist.
 *
 * Daniels Zuschnitt (22.08.2026): „sobald daten gesammelt, soll die extension
 * die daten abschicken … so beschränkt sich mein manueller aufwand auf link
 * anklicken -> episode auswählen und warten."
 *
 * Beisammen heißt: eine Reihe aus Netflix' Metadaten **und** eine Tonspurliste
 * aus dem Abspieler. Beides trifft ein paar Sekunden nach dem Start ein; bis
 * dahin sagt der Knopf, worauf er wartet.
 *
 * Je Folge wird genau einmal gesendet. Der Schlüssel ist Reihe plus
 * Folgennummer — wer dieselbe Folge noch einmal öffnet, löst nichts aus, wer
 * zur nächsten springt, schon.
 */
const gesendet = new Map()

function schluessel() {
  return `${stand.reihe}:${stand.folgeNr ?? '—'}`
}

function vielleichtSenden() {
  if (!stand.reihe || !stand.spuren) return
  const k = schluessel()
  if (gesendet.has(k)) return
  gesendet.set(k, 'unterwegs')
  void melden({ automatisch: true })
}

// --- Knopf ------------------------------------------------------------------

let knopf = null

function urteil(spuren) {
  const echte = spuren.filter((s) => !IST_BESCHREIBUNG.test(s.name))
  const deutsch = echte.some((s) => IST_DEUTSCH(s.code, s.name))
  return { deutsch, echte }
}

/**
 * Was der Knopf anbietet, hängt davon ab, wo er steht.
 *
 * Drei Lagen, und die mittlere hat gefehlt:
 *
 * 1. **Im Player, Tonspuren gelesen** — melden, was dasteht.
 * 2. **Auf der Titelseite mit Folgen** — hier gibt es nichts zu lesen. Der
 *    Knopf sagt, was zu tun ist, und bleibt untätig. Vorher bot er „als nicht
 *    abrufbar melden" an, und das ist bei einer Reihe mit 24 Folgen schlicht
 *    falsch (Daniel, 22.08.2026, bei „Die Tagebücher der Apothekerin").
 * 3. **Auf einer Titelseite ohne Folgen** — erkennbar an „Erinnern": Netflix
 *    bietet dort nur an, zu benachrichtigen. Das ist ein Befund, und nur dann
 *    ist die Meldung „nicht abrufbar" richtig.
 *
 * Der Abspielknopf taugt nicht als Unterscheidung: Auf Netflix liegt die
 * Titelkarte als Überlagerung über der Startseite, und deren Abspielknopf zählt
 * mit — daran ist die erste Fassung gescheitert.
 */
function keineFolgeVorhanden() {
  const text = document.body.innerText || ''
  return /\bErinnern\b|\bRemind me\b/.test(text)
}

/**
 * Was der Knopf anzeigt — er meldet inzwischen von selbst.
 *
 * Vier Lagen, und keine davon verlangt noch einen Klick, solange alles läuft:
 *
 * 1. **Schon gesendet** — das Ergebnis steht da, damit sichtbar ist, was ankam.
 * 2. **Im Player, Tonspuren gelesen** — wird gerade geschickt.
 * 3. **Titelseite mit Folgen** — hier gibt es nichts zu lesen; der Knopf sagt,
 *    was zu tun ist.
 * 4. **Titelseite ohne Folgen** — erkennbar an „Erinnern". Das ist ein Befund,
 *    und den meldet ein Klick, weil hier nichts von selbst eintrifft.
 */
function beschriftung(spuren) {
  if (!stand.reihe) {
    return { text: 'Über die Titelseite öffnen — sonst fehlt die Reihe', klasse: 'ak-leer', aktiv: false }
  }
  const stand_ = gesendet.get(schluessel())
  if (stand_ && stand_ !== 'unterwegs') {
    const wo = stand.folgeNr ? ` (${stand.staffel && stand.staffeln?.length > 1 ? `St. ${stand.staffel}, ` : ''}Flg. ${stand.folgeNr})` : ''
    return {
      text: stand_ === 'deutsch' ? `Deutsch gesendet${wo} ✓` : `Kein Deutsch gesendet${wo} ✓`,
      klasse: stand_ === 'deutsch' ? 'ak-ja' : 'ak-nein',
      aktiv: false,
    }
  }
  if (!spuren) {
    if (keineFolgeVorhanden()) {
      return { text: 'Keine Folge da — als nicht abrufbar melden', klasse: 'ak-nein', aktiv: true }
    }
    return { text: 'Auf Abspielen klicken, dann läuft es von selbst', klasse: 'ak-leer', aktiv: false }
  }
  const { deutsch } = urteil(spuren)
  const wo = stand.folgeNr
    ? ` (${stand.staffel && stand.staffeln?.length > 1 ? `St. ${stand.staffel}, ` : ''}Flg. ${stand.folgeNr})`
    : ''
  return deutsch
    ? { text: `Deutsche Tonspur${wo} — wird gesendet …`, klasse: 'ak-ja', aktiv: false }
    : { text: `Keine deutsche Tonspur${wo} — wird gesendet …`, klasse: 'ak-nein', aktiv: false }
}

async function melden({ automatisch = false } = {}) {
  const spuren = stand.spuren
  const ohneFolge = !spuren && keineFolgeVorhanden()
  if (!stand.reihe) return zeigeErgebnis('Kein Titel erkannt — Titelseite öffnen', false)
  if (!spuren && !ohneFolge) return zeigeErgebnis('Erst auf Abspielen klicken', false)

  const { deutsch, echte } = spuren ? urteil(spuren) : { deutsch: false, echte: [] }
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return zeigeErgebnis('Kein Token — Rechtsklick aufs Symbol, dann Optionen', false)

  try {
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        // Die Titelseite, nicht die Abspieladresse — danach sucht die Pipeline.
        url: `https://www.netflix.com/title/${stand.reihe}`,
        sprachen: echte.map((s) => `${s.code}|${s.name}`),
        befund: ohneFolge ? 'weg' : deutsch ? 'dub' : 'kein_dub',
        titel: (stand.titel || '').replace(/\s*-\s*Netflix\s*$/i, '').trim() || null,
        // Die laufende Folge als Beleg, nie als Ersatz fuer die Reihe.
        folge: stand.folge,
        // Die Nummer der laufenden Folge — daraus leitet die Pipeline ab, für
        // welchen Bereich die Auskunft gilt.
        folge_nr: stand.folgeNr,
        staffel: stand.staffel,
        // Wie die Reihe beim Anbieter aufgeteilt ist: je Staffel die Zahl der
        // Folgen. Damit lässt sich eine Meldung später einer unserer Staffeln
        // zuordnen, auch wenn der Anbieter anders einteilt.
        staffeln: stand.staffeln,
        serientitel: stand.serientitel,
        notiz: ohneFolge
          ? 'Titelseite ohne abspielbare Folge — nur „Erinnern"'
          : `${echte.length} Tonspuren, ${spuren.length - echte.length} Audiodeskriptionen`,
      }),
    })
    const daten = await antwort.json().catch(() => ({}))
    if (!antwort.ok) {
      gesendet.delete(schluessel())
      return zeigeErgebnis(daten.error ?? `Fehler ${antwort.status}`, false)
    }
    gemeldet.add(stand.reihe)
    // Für die Übersicht: Diese Folge ist durch. Kein Beleg — der steht im
    // Datensatz —, sondern eine Gedächtnisstütze beim Abarbeiten.
    void merkeErledigt(stand.reihe, stand.staffel, stand.folgeNr)
    gesendet.set(schluessel(), deutsch ? 'deutsch' : 'kein_deutsch')
    const kopf = ohneFolge ? 'Als nicht abrufbar gemeldet' : deutsch ? 'Deutsche Tonspur gemeldet' : 'Kein Deutsch gemeldet'
    zeigeErgebnis(kopf, true)
  } catch (err) {
    gesendet.delete(schluessel())
    zeigeErgebnis(`Nicht erreichbar: ${err.message}`, false)
  }
}

function zeigeErgebnis(text, gutgegangen) {
  if (!knopf) return
  knopf.textContent = text
  knopf.classList.add(gutgegangen ? 'ak-erfolg' : 'ak-fehler')
  clearTimeout(zurueckstellen)
  /**
   * Danach den **jetzigen** Zustand zeigen, nicht den gemerkten alten.
   *
   * Vorher hielt diese Funktion den Text fest, der beim Melden dastand, und
   * setzte ihn dreieinhalb Sekunden später zurück — inzwischen hatte der Nutzer
   * aber längst die Folge gewechselt, und der Knopf log für die nächste Runde.
   */
  zurueckstellen = setTimeout(() => {
    knopf?.classList.remove('ak-erfolg', 'ak-fehler')
    knopfZeigen()
  }, 2000)
}
let zurueckstellen = null

function knopfEntfernen() {
  if (knopf) {
    knopf.remove()
    knopf = null
  }
}

function knopfZeigen() {
  const { spuren, reihe } = stand
  // Zweite Sicherung an der Stelle, die tatsächlich in die Seite schreibt: Wer
  // hier ankommt, ohne dass der Titel gesucht ist, hat einen Weg gefunden, den
  // niemand vorgesehen hat.
  if ((!reihe && !spuren) || !istGesucht()) {
    knopfEntfernen()
    return
  }
  if (!knopf) {
    knopf = document.createElement('button')
    knopf.className = 'ak-melder'
    knopf.addEventListener('click', melden)
    document.body.appendChild(knopf)
  }
  const { text, klasse, aktiv } = beschriftung(spuren)
  knopf.disabled = !aktiv
  if (!knopf.classList.contains('ak-erfolg') && !knopf.classList.contains('ak-fehler')) {
    knopf.textContent = text
    knopf.classList.remove('ak-ja', 'ak-nein', 'ak-leer')
    knopf.classList.add(klasse)
  }
}

// --- Die Übersicht: was noch zu prüfen ist -----------------------------------

/**
 * Ein zweiter Knopf, der nur **außerhalb** des Players erscheint.
 *
 * Daniels Wunsch vom 22.08.2026: Beim Fernsehen soll nichts stören, aber auf
 * den Übersichts- und Stöberseiten will er sehen, wie viel noch offen ist —
 * und von dort direkt losarbeiten können, statt eine Liste in einer Datei zu
 * suchen.
 *
 * Die Trennung läuft über die Adresse: `/watch/` heißt, der Player läuft.
 */
function imPlayer() {
  return location.pathname.startsWith('/watch/')
}

/** Was diese Installation schon gemeldet hat — überlebt einen Neustart. */
let erledigt = {}
const erledigtGeladen = chrome.storage.local
  .get('erledigt')
  .then((x) => {
    erledigt = x.erledigt ?? {}
  })
  .catch(() => {
    erledigt = {}
  })

/** Eine Folge in Daniels Kurzform: Staffel, `e`, zweistellige Folge. */
function folgenKuerzel(staffel, folge) {
  return `${staffel}e${String(folge).padStart(2, '0')}`
}

/**
 * Welche Folgen einer Adresse sich lohnen.
 *
 * **Erste und letzte je Staffel.** Sind beide gleich, ist die Staffel
 * einheitlich; weichen sie ab, liegt die Grenze dazwischen — bei Black Clover
 * nach Folge 155, bei My Hero Academia in Staffel 7. Eine Staffel mit einer
 * einzigen Folge braucht nur einen Eintrag.
 */
function empfohleneFolgen(eintrag) {
  const raus = []
  for (const s of eintrag.staffeln) {
    if (!s.offen) continue
    raus.push(folgenKuerzel(s.nr, 1))
    if (s.folgen > 1) raus.push(folgenKuerzel(s.nr, s.folgen))
  }
  return raus
}

function istErledigt(id, kuerzel) {
  return Boolean(erledigt[String(id)]?.includes(kuerzel))
}

/**
 * Eine Meldung als erledigt vermerken — für die Anzeige, nicht als Beleg.
 *
 * **Die Staffel darf fehlen.** Netflix nennt sie nicht überall: Bei einer Serie
 * mit nur einer Staffel steht in der Titelzeile bloß „Flg. 3", und der erste
 * Anlauf verwarf solche Meldungen still — Daniel meldete zwei Folgen von
 * 7SEEDS und sah die Liste danach unverändert (22.08.2026). Hat der Titel
 * genau **eine** offene Staffel, ist sie gemeint; gibt es mehrere, bleibt es
 * ohne Vermerk, denn dann wäre jede Wahl geraten.
 */
async function merkeErledigt(id, staffel, folge) {
  if (!id || !folge) return
  if (!staffel) {
    const offene = (offeneTitel[String(id)]?.staffeln ?? []).filter((x) => x.offen)
    if (offene.length !== 1) return
    staffel = offene[0].nr
  }
  const schluessel = String(id)
  const kuerzel = folgenKuerzel(staffel, folge)
  const bisher = erledigt[schluessel] ?? []
  if (bisher.includes(kuerzel)) return
  erledigt[schluessel] = [...bisher, kuerzel]
  try {
    await chrome.storage.local.set({ erledigt })
  } catch {
    /* Ohne Speicher bleibt die Anzeige unvollständig, mehr nicht. */
  }
}

let uebersichtKnopf = null

function uebersichtZeigen() {
  if (imPlayer() || !offeneTitel || !Object.keys(offeneTitel).length) {
    if (uebersichtKnopf) {
      uebersichtKnopf.remove()
      uebersichtKnopf = null
    }
    return
  }
  if (!uebersichtKnopf) {
    uebersichtKnopf = document.createElement('button')
    uebersichtKnopf.className = 'ak-uebersicht'
    uebersichtKnopf.addEventListener('click', dialogOeffnen)
    document.body.appendChild(uebersichtKnopf)
  }
  const offeneAdressen = Object.keys(offeneTitel).length
  uebersichtKnopf.textContent = `Anime-Kalender ${offeneAdressen}`
  uebersichtKnopf.title = `${offeneAdressen} Titel warten auf eine Prüfung`
}

let dialog = null

function dialogSchliessen() {
  if (dialog) {
    dialog.remove()
    dialog = null
  }
  document.removeEventListener('keydown', beiEscape)
}

function beiEscape(e) {
  if (e.key === 'Escape') dialogSchliessen()
}

/**
 * Die Liste der offenen Titel, zum Durchklicken.
 *
 * Bewusst ohne Netflix' eigene Bausteine: Die Seite baut ihre Oberfläche bei
 * jedem Wechsel neu auf, und was daran hängt, verschwindet mit ihr. Dieser
 * Dialog steht für sich, direkt am `body`.
 */
async function dialogOeffnen() {
  if (dialog) {
    dialogSchliessen()
    return
  }
  /**
   * Den Stand frisch holen, nicht den vom Seitenaufbau nehmen.
   *
   * Gemeldet wird im Player (`/watch/…`), nachgesehen auf der Stöberseite —
   * das sind zwei Seitenaufrufe mit je eigenem Skript. Was der eine speichert,
   * kennt der andere erst nach einem Blick in den Speicher.
   */
  try {
    const x = await chrome.storage.local.get('erledigt')
    erledigt = x.erledigt ?? {}
  } catch {
    /* Dann eben mit dem Stand von vorhin. */
  }
  dialog = document.createElement('div')
  dialog.className = 'ak-dialog'

  const kasten = document.createElement('div')
  kasten.className = 'ak-kasten'
  dialog.appendChild(kasten)

  const kopf = document.createElement('div')
  kopf.className = 'ak-kopf'
  const eintraege = Object.entries(offeneTitel).sort((a, b) => a[1].titel.localeCompare(b[1].titel, 'de'))
  const titelzeile = document.createElement('strong')
  titelzeile.textContent = `${eintraege.length} Titel zu prüfen`
  kopf.appendChild(titelzeile)

  const suche = document.createElement('input')
  suche.className = 'ak-suche'
  suche.type = 'search'
  suche.placeholder = 'Suchen'
  kopf.appendChild(suche)

  const zu = document.createElement('button')
  zu.className = 'ak-zu'
  zu.textContent = '×'
  zu.title = 'Schließen (Esc)'
  zu.addEventListener('click', dialogSchliessen)
  kopf.appendChild(zu)
  kasten.appendChild(kopf)

  /**
   * Eine Zeile je Titel: Name, die Folgen zum Anklicken, ihr Stand.
   *
   * Die Folgenkürzel sind selbst Verweise — ein Klick öffnet die Titelseite in
   * einem neuen Tab. Direkt auf eine Folge zu verweisen geht nicht: Netflix
   * leitet dann auf eine Folgen-Kennung um, die unser Datensatz nicht kennt
   * (neun von zwölf Meldungen aus Batch 1 waren deshalb nicht zuzuordnen).
   */
  const liste = document.createElement('div')
  liste.className = 'ak-liste'
  for (const [id, eintrag] of eintraege) {
    const zeile = document.createElement('div')
    zeile.className = 'ak-zeile'
    zeile.dataset.suchtext = eintrag.titel.toLowerCase()

    const link = document.createElement('a')
    link.className = 'ak-titel'
    link.href = `https://www.netflix.com/title/${id}`
    link.target = '_blank'
    link.rel = 'noreferrer noopener'
    link.textContent = eintrag.titel || `Titel ${id}`
    zeile.appendChild(link)

    const folgen = document.createElement('div')
    folgen.className = 'ak-folgen'
    const empfohlen = empfohleneFolgen(eintrag)
    if (!empfohlen.length) {
      const leer = document.createElement('span')
      leer.className = 'ak-hinweis'
      leer.textContent = 'keine Folgenangabe'
      folgen.appendChild(leer)
    }
    for (const kuerzel of empfohlen) {
      const marke = document.createElement('span')
      const fertig = istErledigt(id, kuerzel)
      marke.className = fertig ? 'ak-folge ak-fertig' : 'ak-folge'
      marke.textContent = kuerzel
      marke.title = fertig ? 'schon gemeldet' : 'noch offen'
      folgen.appendChild(marke)
    }
    zeile.appendChild(folgen)
    liste.appendChild(zeile)
  }
  kasten.appendChild(liste)

  suche.addEventListener('input', () => {
    const wort = suche.value.trim().toLowerCase()
    for (const zeile of liste.children) {
      zeile.style.display = !wort || zeile.dataset.suchtext.includes(wort) ? '' : 'none'
    }
  })

  // Ein Klick neben den Kasten schließt — wie überall sonst auch.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialogSchliessen()
  })
  document.addEventListener('keydown', beiEscape)
  document.body.appendChild(dialog)
  suche.focus()
}

// --- Start ------------------------------------------------------------------

/**
 * Netflix wechselt die Seite ohne Neuladen — der Knopf muss mitbekommen, ob
 * gerade der Player läuft.
 *
 * `popstate` allein genügt nicht: Es feuert beim Zurück-Knopf, nicht bei einem
 * Klick auf eine Kachel. Ein Beobachter über den ganzen Baum wäre das andere
 * Extrem — Netflix baut beim Stöbern unablässig Kacheln um, und jede Änderung
 * riefe die Prüfung erneut auf. Ein Blick pro Sekunde kostet nichts und merkt
 * jeden Wechsel früh genug.
 *
 * `history.pushState` zu überschreiben wäre der kürzeste Weg und der falsche:
 * Genau daran ist der Netzwerk-Mitschnitt zweimal gescheitert (NSES-UHX,
 * 22.08.2026). An fremden Seiten wird nichts ersetzt, was sie selbst aufrufen.
 */
let letzterPfad = location.pathname
function pfadPruefen() {
  if (location.pathname === letzterPfad) return
  letzterPfad = location.pathname
  dialogSchliessen()
  uebersichtZeigen()
}
window.addEventListener('popstate', pfadPruefen)
setInterval(pfadPruefen, 1000)

// Und einmal sofort: Beim Laden einer Stöberseite soll der Knopf da sein, ohne
// dass erst ein Wechsel nötig wäre.
uebersichtZeigen()
