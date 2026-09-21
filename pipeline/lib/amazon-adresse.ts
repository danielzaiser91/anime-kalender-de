/**
 * **Aus einer Suchadresse wird die echte Titelseite.**
 *
 * 118 unserer Prime-Verweise sind Suchen statt Titelseiten — weder AniList noch
 * aniSearch führen für diese Titel eine Produktseite, und weder MOTN noch TMDB
 * kennen eine (beides am 27.08.2026 gemessen, beides null Treffer). Die
 * Erweiterung zeigt auf der Suchseite, welcher Titel gemeint ist; der Klick auf
 * den richtigen Treffer trägt ihn auf die Titelseite, wo die gewohnte Prüfung
 * läuft.
 *
 * Gemeldet wird trotzdem unter der **Suchadresse** — nur die kennt unser
 * Datensatz, und nur über sie findet die Übernahme den Titel wieder. Die echte
 * Seite steht in der Notiz, die jede Amazon-Meldung seit jeher mit ihrer
 * Kennung eröffnet (`Amazon-Seite B0B8MTPWRN: …`). Hier wird daraus der
 * Verweis, der künftig im Kalender steht.
 *
 * Ohne diesen Schritt bliebe der Befund richtig und der Verweis eine Suche —
 * der nächste Mensch, der ihn öffnet, stünde wieder vor einer Trefferliste.
 */
export function echteAmazonAdresse(p: {
  plattform: string
  url: string
  notiz: string | null
}): string | null {
  if (p.plattform !== 'primevideo' || !/\/s\?/.test(p.url)) return null
  /*
    Zehn Zeichen sind eine ASIN, sechsundzwanzig eine GTI. Beide führt Prime
    Video, und ein Muster auf `{10}` schnitt die lange Form ab — genau der
    Fehler, der am 25.08.2026 „Babylon" und „Akame ga Kill" unlesbar machte.
  */
  const kennung = /^Amazon-Seite ([A-Z0-9]{10,26})/.exec(p.notiz ?? '')?.[1]
  return kennung ? amazonTitelAdresse(kennung) : null
}

/**
 * **Eine GTI gehört unter `/gp/video/detail/`, nie unter `/dp/`.**
 *
 * `/dp/` kennt nur zehnstellige ASINs. Haikyu!! (20464) stand am 15.09.2026 mit
 * `amazon.de/dp/0Q6QUJIEW346VMM87OG648DPND` im Kalender, und der Klick zeigte
 * „Suchen Sie etwas?"; dieselbe Kennung unter `/gp/video/detail/` öffnet die
 * Staffel. Jede Stelle, die eine Prime-Adresse baut oder übernimmt, geht deshalb
 * über diese beiden Funktionen.
 */
export function amazonTitelAdresse(kennung: string): string {
  return `https://www.amazon.de/gp/video/detail/${kennung}`
}

/**
 * **Auch die zehnstellige ASIN gehört unter `/gp/video/detail/`** (20.09.2026).
 *
 * Bis hierher galt `/dp/` für kurze ASINs als in Ordnung — gemessen ist es das
 * nicht. Stichprobe über fünfzehn Prime-Verweise, die im Bestand als „lebt"
 * geführt wurden: **sieben von fünfzehn** antworteten unter ihrer eigenen
 * `/dp/`-Adresse mit 404 „Seite wurde nicht gefunden". Dieselben fünfzehn
 * ASINs unter `/gp/video/detail/`: **fünfzehn von fünfzehn** mit voller
 * Titelseite, auch die acht, deren `/dp/`-Form lebt.
 *
 * Der Befund in `link-check.json` verdeckte das, weil die Prüfung bei einem 404
 * still auf die Video-Adresse ausweicht und den Erfolg unter der alten Adresse
 * bucht. Im Kalender stand damit ein grüner Verweis, der Besucher auf eine
 * Fehlerseite schickte — hochgerechnet rund 300 von 643.
 *
 * Gilt für **Prime Video**. Discs und andere Shop-Artikel gibt es nur unter
 * `/dp/`; ihre Verweise laufen nicht durch diese Funktion.
 */
export function amazonAdresseRichten(url: string): string {
  return url.replace(/^(https?:\/\/(?:www\.)?amazon\.de)\/dp\/([A-Z0-9]{10,32})(?=[/?#]|$)/i, '$1/gp/video/detail/$2')
}

/**
 * **Welcher Zusatzkanal hinter einem Prime-Weg steht — aus der Notiz der Meldung.**
 *
 * Die Erweiterung liest die Abos einer Seite aus deren eigenen Daten und schreibt sie in die
 * Notiz („Abos: crunchyrollde, zugang=abo"). Die Pille zeigte bis zum 21.09.2026 trotzdem nur
 * „Prime Video": Bei JoJo Stardust Crusaders stand der richtige Crunchyroll-Kanal-Weg ohne
 * Hinweis neben einem JustWatch-Bezugsweg „Amazon Prime (Crunchyroll)" (Daniel mit Bild:
 * „warum steht bei der pill die zur korrekten seite führt nicht (crunchyroll) im label?").
 *
 * Gegenprobe vor dem Bau, am selben Tag: An allen sieben Adressen, die unsere Meldungen und
 * JustWatchs Bezugswege gemeinsam kennen, nannten beide denselben Kanal. Ein Vergleich je
 * Titel sah neun Widersprüche — die betrafen jeweils eine andere Ausgabe desselben Titels.
 * Der Kanal gehört zur Adresse.
 *
 * Nur bei genau einem Kanal und ohne „Prime": Was in Prime enthalten ist, braucht kein
 * Zusatzabo, und bei mehreren Kanälen hilft ein einzelner Name nicht weiter.
 */
const KANAL_NAMEN: Record<string, string> = {
  crunchyrollde: 'Crunchyroll',
  aniversede: 'aniverse',
  animedigitalde: 'ADN',
  prosiebenfun: 'ProSieben FUN',
  prosiebende: 'ProSieben FUN',
  midnightfactoryde: 'Midnight Factory',
  rtlde: 'RTL+',
  pokemonde: 'Pokémon',
  zdfschatzkistede: 'ZDF Schatzkiste',
  amasiade: 'Amasia+',
  flimmerkistetvde: 'Flimmerkiste',
  kixi: 'KIXI',
  ardplusde: 'ARD Plus',
  arthousecnma: 'Arthouse CNMA',
  cinemixplusde: 'Cinemix+',
  maxde: 'HBO Max',
}

export function kanalAusNotiz(notiz: string | null | undefined): string | undefined {
  const abos = /Abos: ([^—"]+)/.exec(notiz ?? '')?.[1]
  if (!abos || /\bPrime\b/.test(abos)) return undefined
  const namen = new Set(
    abos
      .split(/[,\s]+/)
      .map((k) => KANAL_NAMEN[k.trim()])
      .filter((n): n is string => Boolean(n)),
  )
  return namen.size === 1 ? [...namen][0] : undefined
}
