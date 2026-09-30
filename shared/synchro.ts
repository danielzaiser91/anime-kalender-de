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
 * - `g` — **bestätigte** deutsche Folgen. Schlüssel ist die Folgenkennung aus der Watch-Adresse
 *   (`/de/watch/<kennung>/…`), Wert der Zeitpunkt, seit dem sie deutsch ist (UTC).
 * - `w` — **angekündigte** deutsche Folgen aus dem Crunchyroll-Wochenprogramm, je Serienkennung ein
 *   Bereich `von…bis` mit Zeitpunkt. Damit wird eine Folge grün, sobald ihre Uhrzeit erreicht ist,
 *   ohne auf den nächsten Datenlauf zu warten (Daniel: „das 19:20 vs 19:25 beispiel").
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
  /** Serienkennung → angekündigte deutsche Bereiche aus dem Wochenprogramm. */
  w: Record<string, { von: number; bis: number; ab: string }[]>
}

/** Ein sichtbarer Watchlist-Eintrag: Serienkennung, Folgenkennung, Folgennummer (so weit bekannt). */
export interface SynchroEintrag {
  s?: string
  e?: string
  n?: number
}

export interface SynchroFarbe {
  f: 'gruen' | 'gelb'
  /** Seit wann deutsch (bestätigt). */
  seit?: string
  /** Ab wann deutsch (angekündigt). */
  ab?: string
}

/**
 * **Eine Ankündigung gilt zwei Tage.**
 *
 * Danach zählt nur der bestätigte Bestand. Sonst bliebe eine Ankündigung, die nie eintraf, für immer
 * grün: Für „Meine Wiedergeburt als Schleim in einer anderen Welt" Staffel 4 kündigte das
 * Wochenprogramm Folge 22 für den 25.09.2026 an, der Dub-Bestand reicht aber bis Folge 21, und die
 * Episodenseite nennt am 30.09. weiterhin nur „Dub: Japanese, English" (Daniel). Zwei Tage genügen,
 * damit der tägliche Dub-Lauf eine echte Veröffentlichung bestätigt.
 */
const ANKUENDIGUNG_GILT_MS = 48 * 60 * 60 * 1000

/**
 * **Die Farbe eines Eintrags.** Alles, was nicht als deutsch belegt oder angekündigt ist, ist gelb —
 * „nicht bestätigt" und „kein Deutsch" werden bewusst nicht getrennt (Daniel: „keine ungenauigkeit
 * gegen bestand").
 */
export function farbeFuer(eintrag: SynchroEintrag, daten: SynchroDaten, jetzt: number): SynchroFarbe {
  const seit = eintrag.e ? daten.g[eintrag.e] : undefined
  if (seit !== undefined && (!seit || Date.parse(seit) <= jetzt)) return { f: 'gruen', seit }
  const nummer = eintrag.n
  const bereiche = eintrag.s && nummer !== undefined ? daten.w[eintrag.s] : undefined
  const treffer = bereiche?.find((b) => nummer! >= b.von && nummer! <= b.bis)
  if (treffer) {
    const ab = Date.parse(treffer.ab)
    if (ab <= jetzt && jetzt - ab <= ANKUENDIGUNG_GILT_MS) return { f: 'gruen', ab: treffer.ab }
    return { f: 'gelb', ab: treffer.ab }
  }
  return { f: 'gelb' }
}
