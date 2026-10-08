import { useSyncExternalStore } from 'react'

/**
 * **Vorschauen: neue Oberflächen live, aber nur auf Zuruf** (Daniel, 07.10.2026: „bau den Mockup direkt in die Seite, sichtbar nur per Konsolenbefehl").
 * Eine Vorschau ist eine Variante, die jeder Besucher geliefert bekommt, aber nur sieht, wer sie in der Konsole einschaltet:
 *
 *     akVorschau('beleg', 'schalter')   // einschalten, mit Variante
 *     akVorschau('beleg', false)        // ausschalten
 *     akVorschau()                      // Liste: Namen, Varianten, was gerade an ist
 *
 * **Debug-Bereich:** Ist das Flag `ak-debug` gesetzt (`akDebug()` in der Konsole), erscheint in den Einstellungen die Liste aller Vorschauen mit Schalter, Beschreibung und einem Sprung zu einem Beispielort.
 *
 * Der Wert liegt im `localStorage` dieses Browsers (`ak-vorschau`) und überlebt das Neuladen. Neue Vorschau = ein Eintrag in `VORSCHAUEN` und ein `useVorschau('name')` an der Stelle.
 */
const SCHLUESSEL = 'ak-vorschau'
const EREIGNIS = 'ak-vorschau-geaendert'

/** Alle Vorschauen mit ihren Varianten und einer Zeile Beschreibung. */
export const VORSCHAUEN: Record<string, { varianten: string[]; text: string; titel: string; beispiel: string; beispielText: string }> = {
  beleg: {
    titel: 'Beleg-Fenster als Ausschnitt',
    beispiel: '#/woche?t=17554',
    beispielText: 'Tank Chair öffnen, dann im Panel unter „Neuigkeiten“ auf „Beleg“ klicken',
    varianten: ['schalter', 'klick', 'karte'],
    text: 'Beleg-Fenster: Ausschnitt zuerst. schalter = Umschalter „Beleg | Ganze Seite", klick = nur Ausschnitt, Klick zeigt die ganze Seite, karte = Ausschnitt mit Übersichtskarte der Seite.',
  },
  startgeruest: {
    titel: 'Start mit Spinner statt Gerüst',
    beispiel: '#/woche',
    beispielText: 'Seite neu laden: statt Kopf, Navigation und Wochen-Skelett erscheinen wie früher drei Punkte',
    varianten: ['spinner'],
    text: 'Der Start mit Gerüst ist Standard (seit 08.10.2026); „spinner" bringt den alten Start mit Punkten zurück.',
  },
  leisten: {
    titel: 'Schlankere Leisten',
    beispiel: '#/woche',
    beispielText: 'Am Handy abwärts scrollen (ausblenden); in der Datenbank die Filter-Leiste ansehen (pille)',
    varianten: ['ausblenden', 'pille'],
    text: 'Mehr Platz für Karten: ausblenden = die untere Navigation weicht beim Abwärtsscrollen, pille = die Filter-Leiste ist nur so breit wie ihr Knopf.',
  },
  tippziele: {
    titel: 'Größere Tipp-Ziele',
    beispiel: '#/woche?t=21',
    beispielText: 'One Piece öffnen: Schließen, Merken und Teilen im Panel; dazu die Links in der Fußzeile und die Chips unter News',
    varianten: ['gross'],
    text: 'Knöpfe, Links und Chips lassen sich mit dem Daumen sicher treffen, ohne Fehltipps auf den Nachbarn.',
  },
  'suche-woche': {
    titel: 'Suche in der Woche',
    beispiel: '#/woche?q=dragon',
    beispielText: 'In der Woche nach einem Titel suchen, den es diese Woche nicht gibt',
    varianten: ['zusammen'],
    text: 'Du siehst sofort, ob ein gesuchter Titel diese Woche läuft oder nur in der Datenbank steht, statt sieben leere Tage zu überfliegen.',
  },
  'db-reserve': {
    titel: 'Ruhige Datenbank',
    beispiel: '#/datenbank',
    beispielText: 'Datenbank neu laden: Raster und Fußzeile bleiben an ihrem Platz, Cover ohne Bild zeigen einen Buchstaben',
    varianten: ['ruhig'],
    text: 'Die Datenbank wackelt beim Laden nicht mehr, und Karten ohne Cover bleiben unterscheidbar.',
  },
  'panel-kopf': {
    titel: 'Kompakter Panel-Kopf',
    beispiel: '#/woche?t=195539',
    beispielText: 'Cyberpunk: Edgerunners 2 am Handy öffnen: die nächste Folge steht ohne Scrollen im ersten Bild',
    varianten: ['kompakt'],
    text: 'Am Handy steht „Wann kommt die nächste Folge und wo“ gleich im ersten Bildschirm, ohne erst am Cover vorbeizuscrollen.',
  },
  'db-ohne-synchro': {
    titel: 'Ruhigere Ansicht ohne Synchro',
    beispiel: '#/datenbank',
    beispielText: 'In der Datenbank „Anime ohne deutsche Synchro“ einschalten',
    varianten: ['ruhig'],
    text: 'Die Liste ohne deutsche Synchro sagt es einmal klar am Anfang, statt es auf jeder Karte zu wiederholen.',
  },
  'db-sortierung': {
    titel: 'Datenbank nach Relevanz',
    beispiel: '#/datenbank',
    beispielText: 'Datenbank ohne Sortierung in der Adresse öffnen; „Titel A–Z“ bleibt wählbar',
    varianten: ['relevanz'],
    text: 'Die Datenbank beginnt mit dem, was jetzt oder bald auf Deutsch läuft, statt mit dem Alphabet ab „.hack“.',
  },
  'sprecher-suche': {
    titel: 'Sprecher-Suche',
    beispiel: '#/datenbank?q=Konrad%20B%C3%B6sherz',
    beispielText: 'In der Datenbank „Konrad Bösherz“ suchen; im Panel unter „Deutsche Stimmen“ auf einen Namen tippen',
    varianten: ['an'],
    text: 'Die Suche findet Synchronsprecher: eine Gruppe „Sprecher“ über den Treffern, je Name die Titel mit Rolle; im Panel führt jeder Sprechername zu dieser Liste.',
  },
  'tv-kasten': {
    titel: 'TV-Kasten ohne Abschneiden',
    beispiel: '#/woche',
    beispielText: 'Am Desktop die rechte Spalte „Im Fernsehen“ ansehen',
    varianten: ['wachsen', 'mehr'],
    text: 'Du erkennst, dass es mehr Sendetermine gibt, statt eine halbe Zeile zu lesen: wachsen = der Kasten zeigt alles, mehr = Verlauf und „+N weitere“ am Rand.',
  },
  'reihe-namen': {
    titel: 'Sprechende Staffelnamen',
    beispiel: '#/woche?t=195539',
    beispielText: 'Cyberpunk: Edgerunners 2 öffnen: Reihenliste und Überschrift im Panel',
    varianten: ['voll'],
    text: 'In der Reihenliste erkennst du auf einen Blick, welche Staffel du ansiehst, statt nur eine Ziffer zu lesen.',
  },
  'anbieter-legende': {
    titel: 'Anbieter mit Legende',
    beispiel: '#/woche?t=21519',
    beispielText: 'Your Name. öffnen: Anbieter-Pillen mit Haken im Panel',
    varianten: ['an'],
    text: 'Du weißt, was der Haken bei einem Anbieter heißt, und das Kalender-Symbol verdeckt keinen Text mehr.',
  },
  'meine-woche': {
    titel: 'Meine Woche',
    beispiel: '#/woche',
    beispielText: 'In der Woche auf „Meine Woche“ umschalten: nur gemerkte Titel auf den eigenen Plattformen, mit Sprung zum Anbieter',
    varianten: ['an', 'leer'],
    text: 'Du siehst auf einen Blick, was du diese Woche auf Deutsch sehen kannst — nur deine Favoriten, nur deine Plattformen. leer = der Einstieg ohne Favoriten.',
  },
  'news-platzhalter': {
    titel: 'News ohne graue Kacheln',
    beispiel: '#/news',
    beispielText: 'News öffnen und zu Meldungen ohne Cover scrollen (z. B. Dragon Ball Super: Beerus)',
    varianten: ['logo'],
    text: 'Meldungen ohne Bild zeigen den Anbieter statt einer leeren grauen Fläche, und das Datum bleibt auf jedem Bild lesbar.',
  },
}

function lesen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function vorschauWert(name: string): string | undefined {
  const w = lesen()[name]
  return w && VORSCHAUEN[name]?.varianten.includes(w) ? w : undefined
}

const DEBUG = 'ak-debug'

/** Ist der Debug-Bereich in den Einstellungen freigeschaltet? */
export function debugAn(): boolean {
  try {
    return localStorage.getItem(DEBUG) === '1'
  } catch {
    return false
  }
}

/** Schaltet eine Vorschau um (`false` = aus). Aus den Einstellungen und der Konsole aufgerufen. */
export function setzeVorschau(name: string, wert: string | false): void {
  setzen(name, wert)
}

function setzen(name: string, wert: string | false): void {
  const alle = lesen()
  if (wert === false) delete alle[name]
  else alle[name] = wert
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(alle))
  } catch {
    /* Privates Fenster ohne Speicher: dann gilt die Vorschau nur bis zum Neuladen nicht — es bleibt bei der gewohnten Ansicht. */
  }
  window.dispatchEvent(new Event(EREIGNIS))
}

/** Ob der Debug-Bereich freigeschaltet ist; reagiert auf `akDebug()` ohne Neuladen. */
export function useDebug(): boolean {
  return useSyncExternalStore(
    (f) => {
      window.addEventListener(EREIGNIS, f)
      return () => window.removeEventListener(EREIGNIS, f)
    },
    debugAn,
    () => false,
  )
}

/** Die gewählte Variante einer Vorschau — `undefined`, wenn sie aus ist. Aktualisiert sich beim Umschalten in der Konsole ohne Neuladen. */
export function useVorschau(name: string): string | undefined {
  return useSyncExternalStore(
    (f) => {
      window.addEventListener(EREIGNIS, f)
      window.addEventListener('storage', f)
      return () => {
        window.removeEventListener(EREIGNIS, f)
        window.removeEventListener('storage', f)
      }
    },
    () => vorschauWert(name),
    () => undefined,
  )
}

/** Die Konsolenbefehle `akVorschau` (Vorschauen) und `akDebug` (Debug-Bereich in den Einstellungen); ohne Argumente listet `akVorschau` die Vorschauen. */
export function installiereVorschauBefehl(): void {
  ;(window as unknown as { akDebug: unknown }).akDebug = (an: boolean = true) => {
    try {
      if (an) localStorage.setItem(DEBUG, '1')
      else localStorage.removeItem(DEBUG)
    } catch {
      return console.warn('Der Browser lässt kein Speichern zu (privates Fenster?).')
    }
    window.dispatchEvent(new Event(EREIGNIS))
    console.log(an ? 'Debug-Bereich an: Einstellungen (Zahnrad) öffnen.' : 'Debug-Bereich aus.')
  }
  ;(window as unknown as { akVorschau: unknown }).akVorschau = (name?: string, wert: string | boolean = true) => {
    if (!name) {
      for (const [n, v] of Object.entries(VORSCHAUEN)) console.log(`${n} [${v.varianten.join(' | ')}] ${vorschauWert(n) ? `AN: ${vorschauWert(n)}` : 'aus'} — ${v.text}`)
      return
    }
    const vorschau = VORSCHAUEN[name]
    if (!vorschau) return console.warn(`Unbekannte Vorschau „${name}". Bekannt: ${Object.keys(VORSCHAUEN).join(', ')}`)
    if (wert === false) return setzen(name, false)
    const variante = wert === true ? vorschau.varianten[0]! : wert
    if (!vorschau.varianten.includes(variante)) return console.warn(`Variante „${variante}" gibt es nicht. Bekannt: ${vorschau.varianten.join(', ')}`)
    setzen(name, variante)
    console.log(`Vorschau „${name}" an (${variante}).`)
  }
}
