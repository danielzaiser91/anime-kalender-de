/**
 * **„Deutscher Ton?" je Crunchyroll-Folge** (30.09.2026).
 *
 * Daniel: „das führt dazu, das die chrome utility extension von mir hier grün anzeigt, obwohl es
 * gelb sein müsste" — Crunchyrolls Watchlist-Text („Jetzt/Erneut anschauen") trug monatelang die
 * deutsche Verfügbarkeit mit und zählt seit einem Update jede Synchro (gesehen an Jaadugar:
 * „Synchro English" bei englischer Fassung). Statt dieser Angabe entscheidet jetzt unser Bestand.
 *
 * Dazu gibt es eine schlanke API (`POST /synchro`): Die Erweiterung schickt die sichtbaren
 * Watchlist-Einträge und bekommt je Eintrag eine Farbe zurück — kein Abo, kein Zwischenspeicher.
 *
 * Die Wahrheit liegt in `public/data/synchro.json` (Bau-Phase `pipeline/bau/15-synchro.ts`):
 * `g` — **bestätigte** deutsche Folgen. Schlüssel ist die Folgenkennung aus der Watch-Adresse
 * (`/de/watch/<kennung>/…`), Wert der Zeitpunkt, seit dem sie deutsch ist (UTC).
 *
 * **Nur Bestätigtes wird grün.** Eine angekündigte oder geschätzte deutsche Folge reicht nicht:
 * Für „Meine Wiedergeburt als Schleim in einer anderen Welt" Staffel 4 kündigte das
 * Crunchyroll-Wochenprogramm Folge 22 für den 25.09.2026 als deutsch an; belegt ist aber nur bis
 * Folge 21 (25.09.), Folge 22 ist im Kalender **geschätzt** (02.10.) und die Episodenseite nennt am
 * 30.09. nur „Dub: Japanese, English" (Daniel). Die Ankündigung lag also eine Woche daneben — der
 * Punkt war grün. Deshalb entscheidet allein der bestätigte Bestand.
 *
 * Die Farbregel steht hier und nicht im Worker, damit Prüflauf und Auslieferung dieselbe Rechnung
 * benutzen — eine Wahrheit.
 */
export interface SynchroDaten {
  /** Formatkennung; der Worker verwirft fremde Werte. */
  v: number
  erzeugtAm: string
  /** Folgenkennung → Zeitpunkt der deutschen Fassung (UTC ISO), `''` wenn ohne Datum belegt. */
  g: Record<string, string>
}

/**
 * Ein sichtbarer Watchlist-Eintrag. Die Erweiterung schickt alle drei Angaben; **entscheidend ist
 * nur die Folgenkennung** — Serienkennung und Folgennummer sind zu unzuverlässig (verschiedene
 * Zählungen bei Crunchyroll und bei uns, siehe oben).
 */
export interface SynchroEintrag {
  s?: string
  e?: string
  n?: number
}

export interface SynchroFarbe {
  f: 'gruen' | 'gelb'
  /** Seit wann deutsch (bestätigt). */
  seit?: string
}

/**
 * **Die Farbe eines Eintrags.** Grün nur, wenn die Folge im bestätigten Bestand steht und ihr
 * Zeitpunkt erreicht ist; alles andere ist gelb — „nicht bestätigt" und „kein Deutsch" werden
 * bewusst nicht getrennt (Daniel: „keine ungenauigkeit gegen bestand").
 */
export function farbeFuer(eintrag: SynchroEintrag, daten: SynchroDaten, jetzt: number): SynchroFarbe {
  const seit = eintrag.e ? daten.g[eintrag.e] : undefined
  if (seit !== undefined && (!seit || Date.parse(seit) <= jetzt)) return { f: 'gruen', seit }
  return { f: 'gelb' }
}
