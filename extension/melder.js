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
  const alt = knopf.textContent
  knopf.textContent = text
  knopf.classList.add(gutgegangen ? 'ak-erfolg' : 'ak-fehler')
  setTimeout(() => {
    knopf.classList.remove('ak-erfolg', 'ak-fehler')
    knopf.textContent = alt
  }, 3500)
}

function knopfZeigen() {
  const { spuren, reihe } = stand
  if (!reihe && !spuren) {
    if (knopf) { knopf.remove(); knopf = null }
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
