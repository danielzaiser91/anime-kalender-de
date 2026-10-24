/**
 * Adressen vergleichen sich nur ohne Protokoll, Parameter und Schrägstrich —
 * und bei Amazon zusätzlich ohne den Pfadteil vor der Kennung: Dieselbe Ausgabe
 * steht dort als `/dp/<ASIN>` und als `/gp/video/detail/<ASIN>`.
 */
export function adressKern(u: string | undefined): string {
  if (!u) return ''
  const ohne = u
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('?')[0]!
    .replace(/\/$/, '')
    .toLowerCase()
  const asin = /\/(?:dp|gp\/video\/detail)\/([a-z0-9]{10,26})/.exec(ohne)?.[1]
  if (asin) return `amazon:${asin}`
  /* JustWatchs Amazon-Adresse trägt die Kennung im Parameter (gti-Brücke, 17.09.2026). */
  const gti = /[?&]gti=(amzn1\.dv\.gti\.[0-9a-f-]{36})/.exec(u)?.[1]
  if (gti) return `amazon-gti:${gti}`
  /*
    Bei YouTube steckt die Kennung im Parameter. Ohne ihn war jede Adresse
    `youtube.com/watch`, und ein belegtes Nein zu einem Video sperrte im
    Gedächtnis der entfernten Verweise alle YouTube-Videos aller Titel —
    gemessen am 17.09.2026: 30 Titel, deren aniSearch-Video nie ergänzt wurde.
    Groß- und Kleinschreibung zählt in der Kennung.
  */
  const yt = /(?:^|\.)youtube\.com\/(?:watch|playlist)$/.test(ohne) ? /[?&](v|list)=([\w-]+)/.exec(u) : null
  if (yt) return `${ohne}?${yt[1]}=${yt[2]}`
  /*
    Dasselbe bei Partnerlinks: bücher.de läuft über `awin1.com/pclick.php?p=<Produkt>`. Ohne den
    Parameter teilten sich acht Titel einen Kern (gemessen am 22.09.2026).
  */
  const awin = /(?:^|\.)awin1\.com\/pclick\.php$/.test(ohne) ? /[?&]p=(\d+)/.exec(u) : null
  return awin ? `${ohne}?p=${awin[1]}` : ohne
}

/** Meinen zwei Adressen dieselbe Ausgabe? */
export function adressGleich(a: string | undefined, b: string | undefined): boolean {
  const ka = adressKern(a)
  return Boolean(ka) && ka === adressKern(b)
}

/**
 * Ist der Kern (`adressKern`) keine Ausgabe, sondern eine Such-, Start- oder Länderseite (`amazon.de/s`, `crunchyroll.com`, `anbieter.de/de`)?
 * Sie zeigt auf keinen Titel, taugt also weder als Adresse eines Nein noch als zweite Ausgabe eines Ja.
 */
export function istSammelKern(kern: string): boolean {
  const host = '[^/:]+\\.[^/:]+'
  const nurHost = new RegExp(`^${host}$`)
  const land = new RegExp(`^${host}/(de|en|fr|es|it|pt)(-[a-z]{2})?$`)
  const suche = new RegExp(`^${host}/(s|search|suche)(/|$)`)
  return nurHost.test(kern) || land.test(kern) || suche.test(kern)
}

/** Die Seite einer Netflix-Meldung ohne Staffelmarke (`…/title/1#s2`, `…/title/1#0`); andere Anbieter bleiben, wie sie sind (Prime `#N` gilt der Teilseite). */
export function ohneStaffelMarke(u: string): string {
  return /^https?:\/\/(?:www\.)?netflix\.com\/title\//.test(u) ? u.replace(/#s?\d+$/, '') : u
}
