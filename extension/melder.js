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

let stand = { spuren: null, reihe: null, folge: null, titel: '' }
/** Reihen, die in dieser Sitzung schon gemeldet wurden. */
const gemeldet = new Set()
/** Netzfunde, die noch nicht weitergereicht wurden. */
const funde = []

window.addEventListener('message', (e) => {
  if (e.source !== window) return
  if (e.data?.marke === 'ak-spuren') {
    stand = { spuren: e.data.spuren, reihe: e.data.reihe, folge: e.data.folge, titel: e.data.titel }
    knopfZeigen()
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

// --- Knopf ------------------------------------------------------------------

let knopf = null

function urteil(spuren) {
  const echte = spuren.filter((s) => !IST_BESCHREIBUNG.test(s.name))
  const deutsch = echte.some((s) => IST_DEUTSCH(s.code, s.name))
  return { deutsch, echte }
}

/**
 * Ohne Tonspuren gibt es genau einen sinnvollen Befund: „hier ist nichts
 * abspielbar" — und der muss meldbar sein, ohne dass die Erweiterung ihn selbst
 * erkennt. Was zutrifft, sieht Daniel besser als jede Heuristik.
 */
function beschriftung(spuren) {
  if (!stand.reihe) {
    return { text: 'Über die Titelseite öffnen — sonst fehlt die Reihe', klasse: 'ak-leer', aktiv: false }
  }
  // Gemeldet wird je **Reihe**, nicht je Folge: Netflix führt die Tonspuren am
  // Titel, nicht an der einzelnen Episode. Einmal genügt (Daniel, 22.08.2026:
  // „muss ich jede folge durchgehen und alle einzeln melden?").
  if (stand.reihe && gemeldet.has(stand.reihe)) {
    return { text: 'Diese Reihe ist gemeldet ✓', klasse: 'ak-leer', aktiv: false }
  }
  if (!spuren) {
    if (!stand.reihe) return { text: 'Kein Titel erkannt', klasse: 'ak-leer', aktiv: false }
    return { text: 'Keine Folge gesehen — als nicht abrufbar melden', klasse: 'ak-nein', aktiv: true }
  }
  const { deutsch, echte } = urteil(spuren)
  return deutsch
    ? { text: `Deutsch melden (${echte.length} Spuren)`, klasse: 'ak-ja', aktiv: true }
    : { text: `Kein Deutsch melden (${echte.length} Spuren)`, klasse: 'ak-nein', aktiv: true }
}

async function melden() {
  const spuren = stand.spuren
  const ohneFolge = !spuren
  if (!stand.reihe) return zeigeErgebnis('Kein Titel erkannt — Titelseite öffnen', false)

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
        notiz: ohneFolge
          ? 'Titelseite ohne abspielbare Folge — nur „Erinnern"'
          : `${echte.length} Tonspuren, ${spuren.length - echte.length} Audiodeskriptionen`,
      }),
    })
    const daten = await antwort.json().catch(() => ({}))
    if (!antwort.ok) return zeigeErgebnis(daten.error ?? `Fehler ${antwort.status}`, false)
    gemeldet.add(stand.reihe)
    const kopf = ohneFolge ? 'Als nicht abrufbar gemeldet' : deutsch ? 'Deutsch gemeldet' : 'Kein Deutsch gemeldet'
    zeigeErgebnis(`${kopf} · ${daten.offen} wartet auf Übernahme`, true)
  } catch (err) {
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
